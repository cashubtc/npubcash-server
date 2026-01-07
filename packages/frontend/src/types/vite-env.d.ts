/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly NPC_HOSTNAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
