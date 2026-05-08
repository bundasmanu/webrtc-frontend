import JsSIP from "jssip";
import type {
  EndEvent,
  PeerConnectionEvent,
  RTCSession,
} from "jssip/lib/RTCSession";
import type { IncomingResponse } from "jssip/lib/SIPMessage";
import type { RTCSessionEvent, UnRegisteredEvent } from "jssip/lib/UA";
import type { AppConfig } from "@/config";
import { parseSipIdentity } from "./parseSipIdentity";
import type { CallUiState } from "./types";

/** JsSIP sets `RTCSession.direction` to these strings at runtime; `SessionDirection` from typings is not bundled. */
const SIP_DIRECTION_INCOMING = "incoming";

export type RegistrationStatus = "idle" | "registering" | "registered" | "failed";

export interface SipLabCallbacks {
  onRegistrationStatus: (s: RegistrationStatus) => void;
  onRegistrationError: (message: string) => void;
  onCallState: (s: CallUiState) => void;
  onSessionInfo: (info: { remote: string; direction: "in" | "out" }) => void;
  onLog: (line: string) => void;
  /** Play remote audio into this element (by id). */
  remoteAudioElementId?: string;
}

function formatRegistrationFailure(response: IncomingResponse | undefined): string {
  if (!response) return "Registration failed (no SIP response). Check WSS URI, TLS, and credentials.";
  const code = response.status_code;
  const reason = response.reason_phrase ?? "";
  if (code === 401 || code === 403) {
    return `Authentication failed (${code} ${reason}). Wrong user, password, or realm.`;
  }
  if (code === 408 || code === 504) return `Timeout (${code} ${reason}).`;
  return `Registration failed: ${code} ${reason}`.trim();
}

export class SipLab {
  private ua: JsSIP.UA | null = null;
  private session: RTCSession | null = null;
  private autoAnswer = false;
  private instanceId: string | null = null;
  /** Host part from the last successful REGISTER (for short dial targets). */
  private homeDomain: string | null = null;

  constructor(
    private readonly cfg: AppConfig,
    private readonly cb: SipLabCallbacks,
  ) {}

  setAutoAnswer(value: boolean): void {
    this.autoAnswer = value;
    this.cb.onLog(`Auto-answer ${value ? "enabled" : "disabled"}`);
  }

  getAutoAnswer(): boolean {
    return this.autoAnswer;
  }

  getInstanceId(): string | null {
    return this.instanceId;
  }

  register(sipAddressInput: string, password: string, displayName?: string): void {
    this.stopUa();

    const parsed = parseSipIdentity(sipAddressInput);
    if (!parsed.ok) {
      this.cb.onRegistrationStatus("failed");
      this.cb.onRegistrationError(parsed.error);
      this.cb.onLog(parsed.error);
      return;
    }

    this.homeDomain = parsed.domain;

    if (this.cfg.jssipDebug) {
      JsSIP.debug.enable("JsSIP:*");
    } else {
      JsSIP.debug.disable();
    }

    const uriStr = parsed.uriStr;
    const socket = new JsSIP.WebSocketInterface(this.cfg.sipWssUri.trim());
    const instanceId = globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}`;
    this.instanceId = instanceId;

    this.cb.onRegistrationStatus("registering");
    this.cb.onRegistrationError("");
    this.cb.onLog(`WSS ${this.cfg.sipWssUri}`);
    this.cb.onLog(`REGISTER as ${uriStr} (+sip.instance ${instanceId})`);

    this.ua = new JsSIP.UA({
      uri: uriStr,
      password,
      authorization_user: parsed.user,
      display_name: displayName?.trim() || undefined,
      sockets: [socket],
      instance_id: instanceId,
    });

    this.ua.on("registered", () => {
      this.cb.onRegistrationStatus("registered");
      this.cb.onLog("Registered successfully.");
    });

    this.ua.on("registrationFailed", (e: UnRegisteredEvent) => {
      this.cb.onRegistrationStatus("failed");
      const msg = formatRegistrationFailure(e.response);
      this.cb.onRegistrationError(msg);
      this.cb.onLog(`registrationFailed: ${msg}`);
    });

    this.ua.on("disconnected", () => {
      this.cb.onLog("Transport disconnected.");
    });

    this.ua.on("newRTCSession", (data: RTCSessionEvent) => {
      const session = data.session;
      if (this.session && this.session !== session) {
        this.cb.onLog("Rejecting new session: already in a call.");
        session.terminate({ status_code: 486, reason_phrase: "Busy Here" });
        return;
      }
      this.session = session;
      this.attachRemoteAudio(session);

      const remote = session.remote_identity?.uri?.toString() ?? "(unknown)";
      this.cb.onSessionInfo({
        remote,
        direction:
          session.direction === SIP_DIRECTION_INCOMING ? "in" : "out",
      });

      if (session.direction === SIP_DIRECTION_INCOMING) {
        this.cb.onCallState("ringing_in");
        this.cb.onLog(`Incoming from ${remote}`);
        if (this.autoAnswer) {
          this.answer();
        }
      } else {
        this.cb.onCallState("ringing_out");
      }

      session.on("accepted", () => {
        this.cb.onCallState("active");
        this.cb.onLog("Call accepted.");
      });
      session.on("confirmed", () => {
        this.cb.onCallState("active");
      });
      session.on("ended", () => {
        this.cb.onLog("Call ended.");
        this.clearSession();
      });
      session.on("failed", (e: EndEvent) => {
        const cause = e.cause ?? "unknown";
        this.cb.onLog(`Call failed: ${cause}`);
        this.clearSession();
      });
      session.on("hold", () => {
        this.cb.onCallState("held");
        this.cb.onLog("Remote hold.");
      });
      session.on("unhold", () => {
        this.cb.onCallState("active");
        this.cb.onLog("Remote unhold.");
      });
    });

    this.ua.start();
  }

  dial(target: string): void {
    if (!this.ua) {
      this.cb.onLog("Not registered.");
      return;
    }
    if (!this.homeDomain) {
      this.cb.onLog("No home domain (register again).");
      return;
    }
    let dest = target.trim();
    if (!dest.toLowerCase().startsWith("sip:")) {
      dest = `sip:${dest}@${this.homeDomain}`;
    }
    this.cb.onLog(`Dial ${dest}`);
    this.ua.call(dest, {
      mediaConstraints: { audio: true, video: false },
      pcConfig: { iceServers: this.cfg.iceServers },
    });
  }

  answer(): void {
    if (
      !this.session ||
      this.session.direction !== SIP_DIRECTION_INCOMING
    )
      return;
    this.cb.onLog("Answering…");
    this.session.answer({
      mediaConstraints: { audio: true, video: false },
      pcConfig: { iceServers: this.cfg.iceServers },
    });
  }

  reject(): void {
    if (
      !this.session ||
      this.session.direction !== SIP_DIRECTION_INCOMING
    )
      return;
    this.cb.onLog("Rejecting call.");
    this.session.terminate({ status_code: 486, reason_phrase: "Rejected" });
  }

  hangup(): void {
    if (!this.session) return;
    this.cb.onLog("Hangup.");
    this.session.terminate();
  }

  hold(): void {
    if (!this.session) return;
    this.session.hold({}, () => {
      this.cb.onCallState("held");
      this.cb.onLog("Local hold.");
    });
  }

  unhold(): void {
    if (!this.session) return;
    this.session.unhold({}, () => {
      this.cb.onCallState("active");
      this.cb.onLog("Local unhold.");
    });
  }

  unregister(): void {
    this.stopUa();
    this.cb.onRegistrationStatus("idle");
    this.cb.onLog("Unregistered / stopped.");
  }

  private attachRemoteAudio(session: RTCSession): void {
    const id = this.cb.remoteAudioElementId ?? "sip-remote-audio";
    session.on("peerconnection", (e: PeerConnectionEvent) => {
      const pc = e.peerconnection;
      const setStream = (stream: MediaStream) => {
        const el = document.getElementById(id) as HTMLAudioElement | null;
        if (el) {
          el.srcObject = stream;
          void el.play().catch(() => {
            this.cb.onLog("Could not autoplay remote audio (browser policy); click the page once.");
          });
        }
      };
      pc.addEventListener("track", (ev: RTCTrackEvent) => {
        if (ev.streams[0]) setStream(ev.streams[0]);
      });
    });
  }

  private clearSession(): void {
    const id = this.cb.remoteAudioElementId ?? "sip-remote-audio";
    const el = document.getElementById(id) as HTMLAudioElement | null;
    if (el) el.srcObject = null;
    this.session = null;
    this.cb.onCallState("idle");
    this.cb.onSessionInfo({ remote: "", direction: "out" });
  }

  private stopUa(): void {
    if (this.session) {
      try {
        this.session.terminate();
      } catch {
        /* ignore */
      }
    }
    this.session = null;
    if (this.ua) {
      try {
        this.ua.stop();
      } catch {
        /* ignore */
      }
    }
    this.ua = null;
    this.instanceId = null;
    this.homeDomain = null;
    this.cb.onCallState("idle");
  }
}
