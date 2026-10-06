const DEFAULT_SITE_URL = "https://akira-ia.onrender.com";

function parsePublicUrl(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const isLocal = hostname === "localhost" || hostname === "::1" || hostname === "127.0.0.1";
    const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    const isPrivateIpv4 = ipv4
      ? (() => {
          const octets = ipv4.slice(1).map(Number);
          if (octets.some((octet) => octet > 255)) return true;
          const [first, second] = octets;
          return first === 0 || first === 10 || first === 127 ||
            (first === 169 && second === 254) ||
            (first === 172 && second >= 16 && second <= 31) ||
            (first === 192 && second === 168) ||
            (first === 100 && second >= 64 && second <= 127);
        })()
      : false;
    const isPublicHostname = hostname.includes(".") &&
      !hostname.endsWith(".local") &&
      !hostname.endsWith(".internal") &&
      hostname !== "0.0.0.0" &&
      !isPrivateIpv4 &&
      !hostname.startsWith("127.");
    if (!isLocal && !isPublicHostname) return null;
    if (process.env.NODE_ENV === "production" && isLocal) return null;
    if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && isLocal)) return null;
    url.pathname = "/";
    url.search = "";
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

export function getPublicSiteUrl(requestUrl?: string): string {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.RENDER_EXTERNAL_URL,
    process.env.NODE_ENV !== "production" ? requestUrl : undefined,
    DEFAULT_SITE_URL,
  ];
  for (const candidate of candidates) {
    const url = parsePublicUrl(candidate);
    if (url) return url.origin;
  }
  return DEFAULT_SITE_URL;
}
