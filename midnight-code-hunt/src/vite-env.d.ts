/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEAD_CIRCUIT_CHECK_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
