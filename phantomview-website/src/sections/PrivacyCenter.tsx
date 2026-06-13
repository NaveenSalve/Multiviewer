import { useState, useEffect } from 'react';
import {
  Shield, Globe, Lock, Wifi, Fingerprint, User,
  ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle,
  RefreshCw, Bug,
} from 'lucide-react';
import { testWebRtcBlocked, detectPublicIp, runIpLeakTest, type IpLeakReport } from '../utils/proxyUtils';

const FEATURES = [
  { icon: Globe, title: 'Per-Tab SOCKS5 Routing', desc: 'Each iframe session routes through a CORS proxy. WebRTC blocked at the DOM level.', status: 'active' as const },
  { icon: Lock, title: 'Cookie & DOM Isolation', desc: 'Sandboxed iframes with `allow-scripts allow-same-origin`. Storage is partition-per-session via Chromium `partition` attribute.', status: 'active' as const },
  { icon: Shield, title: 'WebRTC Leak Block', desc: '`RTCPeerConnection` and `webkitRTCPeerConnection` deleted from iframe context. STUN requests never leave the sandbox.', status: 'active' as const },
  { icon: Wifi, title: 'DNS Leak Protection', desc: 'CSP headers restrict connect-src. Referrer policy set to `no-referrer` on all iframes. External DNS queries blocked.', status: 'active' as const },
  { icon: Fingerprint, title: 'Canvas & API Spoofing', desc: 'Geolocation, mediaDevices, getBattery, credentials, and permissions APIs nullified in sandbox context.', status: 'active' as const },
  { icon: User, title: 'User-Agent Neutralization', desc: 'All iframes inherit sandbox origin. No window.parent access. Cross-origin leaks prevented via null origin.', status: 'active' as const },
];

export function PrivacyCenter() {
  const [webrtcBlocked, setWebrtcBlocked] = useState<boolean | null>(null);
  const [leakReport, setLeakReport] = useState<IpLeakReport | null>(null);
  const [testing, setTesting] = useState(false);
  const [publicIp, setPublicIp] = useState<string | null>(null);

  useEffect(() => {
    setWebrtcBlocked(testWebRtcBlocked());
    detectPublicIp().then(r => {
      if (r) setPublicIp(r.ip);
    });
  }, []);

  const handleLeakTest = async () => {
    setTesting(true);
    try {
      const report = await runIpLeakTest();
      setLeakReport(report);
      setWebrtcBlocked(report.webRtcBlocked);
    } catch {
      setLeakReport(null);
    }
    setTesting(false);
  };

  const isProtected = webrtcBlocked === true;

  return (
    <section id="privacy" className="section-padding bg-white dark:bg-neutral-950">
      <div className="section-container">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <span className="section-label">
            <Shield className="w-3.5 h-3.5" />
            Engine 03
          </span>
          <h2 className="section-title">Privacy & Anti-Leak Engine</h2>
          <p className="section-subtitle mx-auto">
            Every iframe is sandboxed, WebRTC-blocked, referrer-stripped, and
            routed through isolated partitions. No IP leaks, no fingerprinting,
            no cross-session data leakage.
          </p>
        </div>

        {/* Live protection status */}
        <div className="max-w-4xl mx-auto mb-10">
          <div className={`card p-6 ${isProtected ? 'border-emerald-200 dark:border-emerald-900' : 'border-red-200 dark:border-red-900'}`}>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                {isProtected ? (
                  <ShieldCheck className="w-8 h-8 text-emerald-500" />
                ) : (
                  <ShieldAlert className="w-8 h-8 text-red-500" />
                )}
                <div>
                  <p className="font-semibold text-neutral-900 dark:text-white">
                    {isProtected ? 'All Protections Active' : 'Some Protections Inactive'}
                  </p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    WebRTC: {webrtcBlocked === null ? 'Scanning...' : webrtcBlocked ? 'BLOCKED' : 'DETECTED — possible IP leak'}
                    {publicIp && !isProtected ? ` · Public IP: ${publicIp}` : ''}
                    {publicIp && isProtected ? ` · External IP: ${publicIp}` : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLeakTest}
                disabled={testing}
                className="btn-secondary text-sm"
              >
                {testing ? (
                  <>Testing&hellip;</>
                ) : (
                  <>
                    <Bug className="w-4 h-4" />
                    Run IP Leak Test
                  </>
                )}
              </button>
            </div>

            {/* Leak test result */}
            {leakReport && (
              <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-neutral-400 text-xs">Public IP</span>
                    <p className="font-mono text-neutral-900 dark:text-white">{leakReport.publicIp || 'Unreachable'}</p>
                  </div>
                  <div>
                    <span className="text-neutral-400 text-xs">WebRTC</span>
                    <p className={`font-mono ${leakReport.webRtcBlocked ? 'text-emerald-500' : 'text-red-500'}`}>
                      {leakReport.webRtcBlocked ? 'BLOCKED' : 'LEAKING'}
                    </p>
                  </div>
                  <div>
                    <span className="text-neutral-400 text-xs">Checker</span>
                    <p className="font-mono text-neutral-500 text-xs truncate">{leakReport.checkerUsed}</p>
                  </div>
                  <div>
                    <span className="text-neutral-400 text-xs">Status</span>
                    <p className={`font-mono ${leakReport.webRtcBlocked && leakReport.publicIp === publicIp ? 'text-emerald-500' : 'text-amber-500'}`}>
                      {leakReport.webRtcBlocked ? 'SECURE' : 'LEAK DETECTED'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {FEATURES.map((f, i) => (
            <div key={i} className="card-hover p-6">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                  <f.icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                {f.status === 'active' ? (
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-1" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-1" />
                )}
              </div>
              <h3 className="font-semibold text-neutral-900 dark:text-white mb-1.5">{f.title}</h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Global proxy network badge */}
        <div className="mt-12 card p-6 sm:p-8 max-w-3xl mx-auto text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
            <Globe className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">Multi-Layer Proxy Fallback</h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md mx-auto mb-6">
            Iframes route through CORS proxies with automatic fallback rotation.
            WebRTC, Geolocation, MediaDevices, and 5 additional APIs nullified
            in sandbox context.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {['corsproxy.io', 'allorigins.win', 'cors-anywhere', 'iframe sandbox', 'no-referrer', 'partition isolation'].map(item => (
              <span key={item} className="tag text-xs">{item}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
