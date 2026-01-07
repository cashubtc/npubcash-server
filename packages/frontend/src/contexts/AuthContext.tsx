import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
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
  isLoading: boolean;
  login: () => Promise<void>;
  /** Initiates NIP-46 login flow and returns the nostrconnect:// URI to display */
  loginWithNip46: (relays?: string[]) => string;
  cancelNip46Login: () => void;
  nip46State: Nip46ConnectionState;
  nip46Error: string | null;
  logout: () => Promise<void>;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [nostrConfig, setNostrConfig] = useState<NostrConfig | null>(
    getInitialExtensionConfig
  );
  const [isLoading, setIsLoading] = useState(false);
  const [nip46State, setNip46State] = useState<Nip46ConnectionState>("idle");
  const [nip46Error, setNip46Error] = useState<string | null>(null);

  // Track pending NIP-46 connection for cancellation
  const pendingNip46Ref = useRef<{
    bunkerSigner: BunkerSigner | null;
    cancelled: boolean;
  }>({ bunkerSigner: null, cancelled: false });

  // Attempt to restore NIP-46 session on mount
  const hasAttemptedNip46Restore = useRef(false);
  if (!hasAttemptedNip46Restore.current && !nostrConfig) {
    hasAttemptedNip46Restore.current = true;
    const stored = getStoredNip46Config();
    if (stored) {
      // Set loading state and attempt reconnection
      setIsLoading(true);
      reconnectNip46()
        .then((config) => {
          if (config) {
            setNostrConfig(config);
          }
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
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

  const loginWithNip46 = useCallback(
    (relays: string[] = DEFAULT_NIP46_RELAYS): string => {
      // Reset state
      setNip46State("awaiting");
      setNip46Error(null);
      pendingNip46Ref.current = { bunkerSigner: null, cancelled: false };

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

      // Start the async connection process
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

          // Check if cancelled while waiting
          if (pendingNip46Ref.current.cancelled) {
            await bunkerSigner.close();
            return;
          }

          pendingNip46Ref.current.bunkerSigner = bunkerSigner;

          // fromURI already waits for the bunker's connect response,
          // so we just need to get the user's public key
          const userPubkey = await bunkerSigner.getPublicKey();

          // Check again if cancelled
          if (pendingNip46Ref.current.cancelled) {
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

          setNostrConfig(config);
          setNip46State("connected");
        } catch (e) {
          if (!pendingNip46Ref.current.cancelled) {
            console.error("NIP-46 login failed:", e);
            setNip46State("error");
            setNip46Error(e instanceof Error ? e.message : "Connection failed");
          }
        }
      })();

      return connectionURI;
    },
    []
  );

  const cancelNip46Login = useCallback(() => {
    pendingNip46Ref.current.cancelled = true;
    if (pendingNip46Ref.current.bunkerSigner) {
      pendingNip46Ref.current.bunkerSigner.close();
    }
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

  return (
    <AuthContext.Provider
      value={{
        nostrConfig,
        isAuthenticated: nostrConfig !== null,
        isLoading,
        login,
        loginWithNip46,
        cancelNip46Login,
        nip46State,
        nip46Error,
        logout,
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
