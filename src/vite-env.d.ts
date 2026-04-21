/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SIP_WSS_URI: string;
  readonly VITE_ICE_SERVERS_JSON: string;
  readonly VITE_JSSIP_DEBUG: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
