import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react";

import {
  type Event,
  type EventTemplate,
  generateSecretKey,
  getPublicKey,
} from "nostr-tools";
import {
  BunkerSigner,
  createNostrConnectURI,
  type BunkerPointer,
} from "nostr-tools/nip46";
import { bytesToHex, hexToBytes } from "nostr-tools/utils";

type ExtensionConfig = {
  type: "extension";
  pubkey: string;
  signer: (t: EventTemplate) => Promise<Event>;
};

type Nip46Config = {
  type: "nip46";
  pubkey: string;
  signer: (t: EventTemplate) => Promise<Event>;
  bunkerSigner: BunkerSigner;
};

type NostrConfig = ExtensionConfig | Nip46Config;

type Nip46ConnectionState = "idle" | "awaiting" | "connected" | "error";

export interface AuthContextType {
  nostrConfig: NostrConfig | null;
  isAuthenticated: boolean;
  /** True while restoring a previous session on app load */
  isRestoring: boolean;
  isLoading: boolean;
  login: () => Promise<void>;
  /** Initiates NIP-46 login flow and returns the nostrconnect:// URI to display */
  loginWithNip46: (relays?: string[]) => string;
  cancelNip46Login: () => void;
  nip46State: Nip46ConnectionState;
  nip46Error: string | null;
  logout: () => Promise<void>;
  /** Clears stored session data and stops any pending restoration */
  clearSession: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const CONFIG_KEY = "npc-login";
const NIP46_CONFIG_KEY = "npc-nip46";

type StoredNip46Config = {
  clientSecretKey: string; // hex
  bunkerPointer: BunkerPointer;
  userPubkey: string;
};

// Extension storage helpers
function getStoredExtensionPubkey(): string | null {
  return localStorage.getItem(CONFIG_KEY);
}

function setStoredExtensionPubkey(pubkey: string) {
  localStorage.setItem(CONFIG_KEY, pubkey);
}

function clearStoredExtensionPubkey() {
  localStorage.removeItem(CONFIG_KEY);
}

// NIP-46 storage helpers
function getStoredNip46Config(): StoredNip46Config | null {
  const stored = localStorage.getItem(NIP46_CONFIG_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as StoredNip46Config;
  } catch {
    return null;
  }
}

function setStoredNip46Config(config: StoredNip46Config) {
  localStorage.setItem(NIP46_CONFIG_KEY, JSON.stringify(config));
}

function clearStoredNip46Config() {
  localStorage.removeItem(NIP46_CONFIG_KEY);
}

function clearAllStoredConfig() {
  clearStoredExtensionPubkey();
  clearStoredNip46Config();
}

function createExtensionSigner(): (t: EventTemplate) => Promise<Event> {
  return (t: EventTemplate) => {
    if (!window.nostr) {
      return Promise.reject(new Error("Nostr extension not available"));
    }
    return window.nostr.signEvent(t);
  };
}

// For initial load, we only restore extension config synchronously
// NIP-46 requires async reconnection, handled separately
function getInitialExtensionConfig(): ExtensionConfig | null {
  const storedPubkey = getStoredExtensionPubkey();
  if (storedPubkey) {
    return {
      type: "extension",
      pubkey: storedPubkey,
      signer: createExtensionSigner(),
    };
  }
  return null;
}

async function reconnectNip46(): Promise<Nip46Config | null> {
  const stored = getStoredNip46Config();
  if (!stored) return null;

  try {
    const clientSecretKey = hexToBytes(stored.clientSecretKey);
    const bunkerSigner = BunkerSigner.fromBunker(
      clientSecretKey,
      stored.bunkerPointer
    );

    // Verify connection is still valid
    await bunkerSigner.ping();

    return {
      type: "nip46",
      pubkey: stored.userPubkey,
      signer: (t: EventTemplate) => bunkerSigner.signEvent(t),
      bunkerSigner,
    };
  } catch (e) {
    console.error("Failed to reconnect NIP-46 session:", e);
    clearStoredNip46Config();
    return null;
  }
}

// Default relays for NIP-46 connections
const DEFAULT_NIP46_RELAYS = [
  "wss://relay.nsec.app",
  "wss://relay.damus.io",
];

// Check if we need to restore a session on initial load
function getInitialState(): {
  config: NostrConfig | null;
  isRestoring: boolean;
} {
  // First check for extension config (synchronous)
  const extensionConfig = getInitialExtensionConfig();
  if (extensionConfig) {
    return { config: extensionConfig, isRestoring: false };
  }

  // Check if there's a stored NIP-46 config that needs async restoration
  const hasStoredNip46 = getStoredNip46Config() !== null;
  return { config: null, isRestoring: hasStoredNip46 };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initialState] = useState(getInitialState);
  const [nostrConfig, setNostrConfig] = useState<NostrConfig | null>(
    initialState.config
  );
  const [isRestoring, setIsRestoring] = useState(initialState.isRestoring);
  const [isLoading, setIsLoading] = useState(false);
  const [nip46State, setNip46State] = useState<Nip46ConnectionState>("idle");
  const [nip46Error, setNip46Error] = useState<string | null>(null);

  // Track pending NIP-46 connection for cancellation
  // connectionId increments on each new attempt so old attempts can detect they're stale
  const pendingNip46Ref = useRef<{
    bunkerSigner: BunkerSigner | null;
    connectionId: number;
  }>({ bunkerSigner: null, connectionId: 0 });

  // Store connection params for reconnection on visibility change
  const nip46ConnectionRef = useRef<{
    clientSecretKey: Uint8Array;
    connectionURI: string;
  } | null>(null);

  // Track if restoration was aborted by user
  const restorationAbortedRef = useRef(false);

  // Attempt to restore NIP-46 session on mount
  const hasAttemptedNip46Restore = useRef(false);
  if (!hasAttemptedNip46Restore.current && isRestoring) {
    hasAttemptedNip46Restore.current = true;
    reconnectNip46()
      .then((config) => {
        // Don't restore if user cleared the session
        if (config && !restorationAbortedRef.current) {
          setNostrConfig(config);
        }
      })
      .finally(() => {
        if (!restorationAbortedRef.current) {
          setIsRestoring(false);
        }
      });
  }

  const login = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!window.nostr) {
        throw new Error("Nostr extension not available");
      }
      const pk = await window.nostr.getPublicKey();
      setStoredExtensionPubkey(pk);
      setNostrConfig({
        type: "extension",
        pubkey: pk,
        signer: createExtensionSigner(),
      });
    } catch (e) {
      console.error("Login failed:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Start the async NIP-46 connection process
  const startNip46Connection = useCallback(
    (clientSecretKey: Uint8Array, connectionURI: string) => {
      // Increment connection ID and capture it for this attempt
      const myConnectionId = ++pendingNip46Ref.current.connectionId;
      pendingNip46Ref.current.bunkerSigner = null;

      // Helper to check if this connection attempt is still current
      const isStale = () => pendingNip46Ref.current.connectionId !== myConnectionId;

      (async () => {
        try {
          // Wait for the bunker to connect
          // BunkerSigner.fromURI handles subscribing to relays and waiting for the connect response
          const bunkerSigner = await BunkerSigner.fromURI(
            clientSecretKey,
            connectionURI,
            {
              onauth: (url) => {
                // Open auth URL in new window if bunker requires authentication
                window.open(url, "_blank", "width=600,height=700");
              },
            },
            120000 // 2 minute timeout
          );

          // Check if this attempt was superseded by a newer one
          if (isStale()) {
            await bunkerSigner.close();
            return;
          }

          pendingNip46Ref.current.bunkerSigner = bunkerSigner;

          // fromURI already waits for the bunker's connect response,
          // so we just need to get the user's public key
          const userPubkey = await bunkerSigner.getPublicKey();

          // Check again if stale
          if (isStale()) {
            await bunkerSigner.close();
            return;
          }

          // Store the connection info for session restoration
          const bunkerPointer: BunkerPointer = {
            pubkey: bunkerSigner.bp.pubkey,
            relays: bunkerSigner.bp.relays,
            secret: bunkerSigner.bp.secret,
          };

          setStoredNip46Config({
            clientSecretKey: bytesToHex(clientSecretKey),
            bunkerPointer,
            userPubkey,
          });

          const config: Nip46Config = {
            type: "nip46",
            pubkey: userPubkey,
            signer: (t: EventTemplate) => bunkerSigner.signEvent(t),
            bunkerSigner,
          };

          // Clear connection params since we're done
          nip46ConnectionRef.current = null;

          setNostrConfig(config);
          setNip46State("connected");
        } catch (e) {
          // Only show error if this is still the current connection attempt
          if (!isStale()) {
            console.error("NIP-46 login failed:", e);
            setNip46State("error");
            setNip46Error(e instanceof Error ? e.message : "Connection failed");
          }
        }
      })();
    },
    []
  );

  const loginWithNip46 = useCallback(
    (relays: string[] = DEFAULT_NIP46_RELAYS): string => {
      // Reset state
      setNip46State("awaiting");
      setNip46Error(null);

      // Generate a new client keypair for this connection
      const clientSecretKey = generateSecretKey();
      const clientPubkey = getPublicKey(clientSecretKey);

      // Generate a random secret for the connection
      const secret = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));

      // Create the nostrconnect:// URI
      const connectionURI = createNostrConnectURI({
        clientPubkey,
        relays,
        secret,
        name: "npub.cash",
        perms: ["sign_event"],
      });

      // Store params for reconnection on visibility change
      nip46ConnectionRef.current = { clientSecretKey, connectionURI };

      // Start the connection
      startNip46Connection(clientSecretKey, connectionURI);

      return connectionURI;
    },
    [startNip46Connection]
  );

  // Re-establish NIP-46 connection when browser returns to foreground
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        nip46State === "awaiting" &&
        nip46ConnectionRef.current
      ) {
        console.log("Browser foregrounded, re-establishing NIP-46 connection...");

        // Close current bunkerSigner if exists (startNip46Connection will invalidate old attempt via connection ID)
        if (pendingNip46Ref.current.bunkerSigner) {
          pendingNip46Ref.current.bunkerSigner.close();
        }

        // Restart connection with same params
        const { clientSecretKey, connectionURI } = nip46ConnectionRef.current;
        startNip46Connection(clientSecretKey, connectionURI);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [nip46State, startNip46Connection]);

  const cancelNip46Login = useCallback(() => {
    // Increment connection ID to invalidate any pending connection
    pendingNip46Ref.current.connectionId++;
    if (pendingNip46Ref.current.bunkerSigner) {
      pendingNip46Ref.current.bunkerSigner.close();
    }
    // Clear connection params to prevent reconnection on visibility change
    nip46ConnectionRef.current = null;
    setNip46State("idle");
    setNip46Error(null);
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      // Close NIP-46 connection if active
      if (nostrConfig?.type === "nip46") {
        await nostrConfig.bunkerSigner.close();
      }
      clearAllStoredConfig();
      setNostrConfig(null);
      setNip46State("idle");
    } finally {
      setIsLoading(false);
    }
  }, [nostrConfig]);

  const clearSession = useCallback(() => {
    restorationAbortedRef.current = true;
    clearAllStoredConfig();
    setNostrConfig(null);
    setIsRestoring(false);
    setNip46State("idle");
    setNip46Error(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        nostrConfig,
        isAuthenticated: nostrConfig !== null,
        isRestoring,
        isLoading,
        login,
        loginWithNip46,
        cancelNip46Login,
        nip46State,
        nip46Error,
        logout,
        clearSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
