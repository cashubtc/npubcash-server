/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly HOSTNAME?: string;
  readonly NPC_BASEURL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
