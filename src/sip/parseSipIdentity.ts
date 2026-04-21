/** Parse `user@domain` or `sip:user@domain` for REGISTER (digest user = local part). */

export type ParsedSipIdentity =
  | {
      ok: true;
      user: string;
      domain: string;
      /** Normalised value for JsSIP `uri` (e.g. sip:alice@example.net). */
      uriStr: string;
    }
  | { ok: false; error: string };

export function parseSipIdentity(input: string): ParsedSipIdentity {
  let s = input.trim();
  if (!s) {
    return { ok: false, error: "SIP address is required (user@domain)." };
  }
  if (s.toLowerCase().startsWith("sip:")) {
    s = s.slice(4).trim();
  }
  const at = s.indexOf("@");
  if (at <= 0 || at === s.length - 1) {
    return {
      ok: false,
      error: "Use the form user@domain (you can prefix with sip:).",
    };
  }
  const user = s.slice(0, at).trim();
  const domain = s.slice(at + 1).trim();
  if (!user || !domain) {
    return { ok: false, error: "Invalid SIP address: empty user or domain." };
  }
  const uriStr = `sip:${encodeURIComponent(user)}@${domain}`;
  return { ok: true, user, domain, uriStr };
}
