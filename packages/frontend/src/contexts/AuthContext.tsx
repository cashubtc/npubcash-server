import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

import { type Event, type EventTemplate } from "nostr-tools";

type NostrConfig = {
  type: "extension";
  pubkey: string;
  signer: (t: EventTemplate) => Promise<Event>;
};

export interface AuthContextType {
  nostrConfig: NostrConfig | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const CONFIG_KEY = "npc-login";

function getStoredPubkey(): string | null {
  return localStorage.getItem(CONFIG_KEY);
}

function setStoredPubkey(pubkey: string) {
  localStorage.setItem(CONFIG_KEY, pubkey);
}

function clearStoredPubkey() {
  localStorage.removeItem(CONFIG_KEY);
}

function createExtensionSigner(): (t: EventTemplate) => Promise<Event> {
  return (t: EventTemplate) => {
    if (!window.nostr) {
      return Promise.reject(new Error("Nostr extension not available"));
    }
    return window.nostr.signEvent(t);
  };
}

function getInitialConfig(): NostrConfig | null {
  const storedPubkey = getStoredPubkey();
  if (storedPubkey) {
    return {
      type: "extension",
      pubkey: storedPubkey,
      signer: createExtensionSigner(),
    };
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [nostrConfig, setNostrConfig] = useState<NostrConfig | null>(getInitialConfig);
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!window.nostr) {
        throw new Error("Nostr extension not available");
      }
      const pk = await window.nostr.getPublicKey();
      setStoredPubkey(pk);
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

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      clearStoredPubkey();
      setNostrConfig(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        nostrConfig,
        isAuthenticated: nostrConfig !== null,
        isLoading,
        login,
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
