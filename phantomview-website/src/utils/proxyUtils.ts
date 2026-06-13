// ──────────────────────────────────────────────
// PhantomView OS — IP Leak Prevention + Real Proxy Routing
// ──────────────────────────────────────────────

// ── User-Agent Pool for rotation ──
const UA_POOL = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
];

export function getRandomUA(): string {
  return UA_POOL[Math.floor(Math.random() * UA_POOL.length)];
}

// ── Public CORS Proxies (fallback chain) ──
const CORS_PROXIES = [
  { name: 'corsproxy.io', url: 'https://corsproxy.io/?url=' },
  { name: 'api.allorigins.win', url: 'https://api.allorigins.win/get?url=' },
  { name: 'corsproxy.io backup', url: 'https://corsproxy.io/?url=' },
];

export function getRandomCorsProxy(): { name: string; url: string } {
  return CORS_PROXIES[Math.floor(Math.random() * CORS_PROXIES.length)];
}

// ── User's own proxy parsing ──
export interface ParsedProxy {
  raw: string;
  host: string;
  port: number;
  user: string;
  pass: string;
  label: string;
  type: 'http' | 'socks5';
}

export function parseProxy(raw: string): ParsedProxy | null {
  let s = raw.trim();
  if (!s) return null;
  let type: 'http' | 'socks5' = 'http';
  if (s.startsWith('socks5://') || s.startsWith('socks://')) {
    type = 'socks5';
    s = s.replace(/^socks5?:\/\//, '');
  }
  // Format: IP:PORT, IP:PORT:USER:PASS, IP:PORT:USER (password empty)
  const parts = s.split(':');
  if (parts.length < 2) return null;
  const port = parseInt(parts[1], 10);
  if (isNaN(port) || port < 1 || port > 65535) return null;
  const host = parts[0];
  let user = '';
  let pass = '';
  if (parts.length === 3) {
    user = parts[2];
  } else if (parts.length >= 4) {
    user = parts[2];
    pass = parts.slice(3).join(':');
  }
  return {
    raw: s,
    host,
    port,
    user,
    pass,
    label: `${host}:${port}`,
    type,
  };
}

export function parseProxyList(text: string): ParsedProxy[] {
  return text
    .split('\n')
    .map(parseProxy)
    .filter((p): p is ParsedProxy => p !== null);
}

// ── Proxy Health Check (via CORS fetch through proxy) ──
// We test if a proxy can successfully fetch a known endpoint.

interface HealthResult {
  proxy: string;
  ok: boolean;
  latency: number;
  error?: string;
  detectedIp?: string;
}

async function checkSingleProxy(proxyUrl: string, timeoutMs = 8000): Promise<HealthResult> {
  const start = performance.now();
  try {
    const testUrl = `${proxyUrl}${encodeURIComponent('https://api.ipify.org?format=json')}`;
    const res = await fetch(testUrl, {
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });
    const latency = Math.round(performance.now() - start);
    if (!res.ok) {
      return { proxy: proxyUrl, ok: false, latency, error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    return {
      proxy: proxyUrl,
      ok: true,
      latency,
      detectedIp: data.ip || 'unknown',
    };
  } catch (err: any) {
    return {
      proxy: proxyUrl,
      ok: false,
      latency: Math.round(performance.now() - start),
      error: err?.name === 'TimeoutError' ? 'Timeout' : err?.message || 'Unknown',
    };
  }
}

export async function checkProxyHealth(proxyUrls: string[]): Promise<HealthResult[]> {
  return Promise.all(proxyUrls.map(u => checkSingleProxy(u)));
}

// ── Build a proxy URL from user's parsed proxy ──
// Uses corsproxy.io as the transport, embeds user proxy credentials
// in the target URL via query parameters for proxy-chaining.
// Note: Most public CORS proxies don't support chaining, so we
// fall back to direct CORS proxy usage with rotation.

export function buildProxyUrl(targetUrl: string, userProxy: ParsedProxy | null): string {
  if (userProxy) {
    // Route through local proxy server for SOCKS5/HTTP proxy support
    const proxyServer = 'http://localhost:3456/proxy';
    const proxyStr = `${userProxy.host}:${userProxy.port}:${userProxy.user}:${userProxy.pass}`;
    return `${proxyServer}?url=${encodeURIComponent(targetUrl)}&proxy=${encodeURIComponent(proxyStr)}`;
  }

  // No user proxy — use public CORS proxy with rotation
  const cp = getRandomCorsProxy();
  return `${cp.url}${encodeURIComponent(targetUrl)}`;
}

// ── Generate sandboxed srcdoc with UA override + blocked APIs ──
export function getIsolatedIframeSrcdoc(targetUrl: string, userAgent?: string): string {
  const ua = userAgent || getRandomUA();
  const blockedAPIs = `
    // WebRTC Block
    try { delete window.RTCPeerConnection; } catch(e) {}
    try { delete window.webkitRTCPeerConnection; } catch(e) {}
    try { navigator.geolocation = undefined; } catch(e) {}
    try { navigator.mediaDevices = undefined; } catch(e) {}
    try { navigator.getBattery = undefined; } catch(e) {}
    try { navigator.credentials = undefined; } catch(e) {}
    try { navigator.permissions = undefined; } catch(e) {}

    // Override user-agent via navigator descriptor
    try {
      Object.defineProperty(navigator, 'userAgent', {
        get: function() { return '${ua.replace(/'/g, "\\'")}'; },
        configurable: true
      });
    } catch(e) {}

    // Canvas noise (basic fingerprint resistance)
    try {
      const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
      CanvasRenderingContext2D.prototype.getImageData = function() {
        const data = origGetImageData.apply(this, arguments);
        for (let i = 0; i < data.data.length; i += 4) {
          if (Math.random() > 0.9995) {
            data.data[i] = (data.data[i] + 1) % 256;
            data.data[i+1] = (data.data[i+1] + 2) % 256;
            data.data[i+2] = (data.data[i+2] - 1) % 256;
          }
        }
        return data;
      };
    } catch(e) {}
  `;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta http-equiv="Content-Security-Policy"
            content="default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;
                     script-src * 'unsafe-inline' 'unsafe-eval';
                     style-src * 'unsafe-inline';
                     img-src * data: blob:;
                     connect-src *;
                     frame-src *;
                     media-src *;
                     font-src * data:;">
      <meta name="referrer" content="no-referrer">
      <meta name="referrer" content="strict-origin-when-cross-origin">
      <base href="${targetUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}">
    </head>
    <body style="margin:0;overflow:hidden;background:transparent;">
      <script>${blockedAPIs}</script>
      <iframe
        src="${targetUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"
        style="position:fixed;top:0;left:0;width:100%;height:100%;border:none;"
        referrerpolicy="no-referrer"
        importance="low"
        allow="autoplay *; encrypted-media *"
        allowfullscreen
      ></iframe>
    </body>
    </html>
  `;
}

// ── Inject privacy scripts into an already-loaded iframe ──
export function injectPrivacyScripts(iframe: HTMLIFrameElement, userAgent?: string): void {
  try {
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    const meta = doc.createElement('meta');
    meta.name = 'referrer';
    meta.content = 'no-referrer';
    doc.head?.prepend(meta);

    const script = doc.createElement('script');
    script.textContent = `
      (function() {
        try { delete window.RTCPeerConnection; } catch(e) {}
        try { delete window.webkitRTCPeerConnection; } catch(e) {}
        try { navigator.geolocation = undefined; } catch(e) {}
        try { navigator.mediaDevices = undefined; } catch(e) {}
        try { navigator.getBattery = undefined; } catch(e) {}
        try { navigator.credentials = undefined; } catch(e) {}
        try { navigator.permissions = undefined; } catch(e) {}
        ${userAgent ? `
        try {
          Object.defineProperty(navigator, 'userAgent', {
            get: function() { return '${userAgent.replace(/'/g, "\\'")}'; },
            configurable: true
          });
        } catch(e) {}
        ` : ''}
      })();
    `;
    doc.body?.appendChild(script);
  } catch {
    // cross-origin — silently fail
  }
}

// ── IP Leak Detection ──

export interface IpLeakReport {
  publicIp: string | null;
  checkerUsed: string;
  webRtcBlocked: boolean;
  webRtcIp: string | null;
  timestamp: number;
}

export function testWebRtcBlocked(): boolean {
  try {
    return (
      typeof (window as any).RTCPeerConnection === 'undefined' &&
      typeof (window as any).webkitRTCPeerConnection === 'undefined'
    );
  } catch {
    return true;
  }
}

export async function detectPublicIp(): Promise<{ ip: string; checker: string } | null> {
  const checkers = [
    async () => {
      const r = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(5000), cache: 'no-store' });
      const d = await r.json();
      return { ip: d.ip as string, checker: 'ipify' };
    },
    async () => {
      const r = await fetch('https://jsonip.com', { signal: AbortSignal.timeout(5000), cache: 'no-store' });
      const d = await r.json();
      return { ip: d.ip as string, checker: 'jsonip' };
    },
    async () => {
      const r = await fetch('https://checkip.amazonaws.com', { signal: AbortSignal.timeout(5000), cache: 'no-store' });
      const t = (await r.text()).trim();
      return { ip: t, checker: 'checkip.amazonaws.com' };
    },
  ];
  for (const fn of checkers) {
    try { return await fn(); } catch { continue; }
  }
  return null;
}

export async function detectWebRtcIp(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const PC = (window as any).RTCPeerConnection || (window as any).webkitRTCPeerConnection;
      if (!PC) return resolve(null);
      const pc = new PC({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      let done = false;
      const finish = (ip: string | null) => { if (!done) { done = true; pc.close(); resolve(ip); } };
      setTimeout(() => finish(null), 3000);
      pc.onicecandidate = (e: any) => {
        if (!e.candidate) return;
        const m = e.candidate.candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
        if (m) finish(m[0]);
      };
      pc.createDataChannel('');
      pc.createOffer().then((o: any) => pc.setLocalDescription(o)).catch(() => finish(null));
    } catch { resolve(null); }
  });
}

export async function runIpLeakTest(): Promise<IpLeakReport> {
  const webRtcBlocked = testWebRtcBlocked();
  const publicIp = await detectPublicIp();
  const webRtcIp = webRtcBlocked ? null : await detectWebRtcIp();
  return {
    publicIp: publicIp?.ip ?? null,
    checkerUsed: publicIp?.checker ?? 'none',
    webRtcBlocked,
    webRtcIp,
    timestamp: Date.now(),
  };
}

// ── Random timing helpers ──
export function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

export function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ── Partition key for storage isolation ──
export function getPartitionKey(sessionId: string): string {
  return `persist:phantom-${sessionId}`;
}
