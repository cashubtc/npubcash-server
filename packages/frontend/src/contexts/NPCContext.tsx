import { createContext, useContext, type ReactNode } from "react";
import { type NPCClient } from "npubcash-sdk";

interface NPCContextType {
  client: NPCClient;
}

const NPCContext = createContext<NPCContextType | null>(null);

export function NPCProvider({
  client,
  children,
}: {
  client: NPCClient;
  children: ReactNode;
}) {
  return (
    <NPCContext.Provider value={{ client }}>{children}</NPCContext.Provider>
  );
}

export function useNPC(): NPCClient {
  const context = useContext(NPCContext);
  if (!context) {
    throw new Error("useNPC must be used within an NPCProvider");
  }
  return context.client;
}
