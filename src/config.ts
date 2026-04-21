export interface AppConfig {
  sipWssUri: string;
  iceServers: RTCIceServer[];
  jssipDebug: boolean;
}

const DEFAULT_ICE: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

function parseIceServersJson(raw: string | undefined): RTCIceServer[] {
  if (!raw?.trim()) return DEFAULT_ICE;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_ICE;
    return parsed as RTCIceServer[];
  } catch {
    return DEFAULT_ICE;
  }
}

function envConfig(): AppConfig {
  return {
    sipWssUri:
      import.meta.env.VITE_SIP_WSS_URI ??
      "wss://kamailio-edge.example.invalid:5061",
    iceServers: parseIceServersJson(import.meta.env.VITE_ICE_SERVERS_JSON),
    jssipDebug: import.meta.env.VITE_JSSIP_DEBUG === "true",
  };
}

/** Optional runtime overrides from `config.json` next to the app (e.g. Kubernetes ConfigMap, GitHub Pages deploy). */
export async function loadAppConfig(): Promise<AppConfig> {
  const base = envConfig();
  try {
    const res = await fetch(
      `${import.meta.env.BASE_URL}config.json`,
      { cache: "no-store" },
    );
    if (!res.ok) return base;
    const data = (await res.json()) as Partial<{
      sipWssUri: string;
      iceServers: RTCIceServer[] | undefined;
      jssipDebug: boolean;
    }>;
    return {
      sipWssUri: data.sipWssUri?.trim() || base.sipWssUri,
      iceServers:
        Array.isArray(data.iceServers) && data.iceServers.length > 0
          ? data.iceServers
          : base.iceServers,
      jssipDebug:
        typeof data.jssipDebug === "boolean" ? data.jssipDebug : base.jssipDebug,
    };
  } catch {
    return base;
  }
}
