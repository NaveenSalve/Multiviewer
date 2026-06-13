import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Globe, Trash2, Shield, Plus, X, Play, RefreshCw, Square,
  AlertTriangle, ExternalLink, Eye, Clock, Target, Monitor, Zap,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import {
  delay,
  randomBetween,
  parseProxyList,
} from '../utils/proxyUtils';

interface PopupInstance {
  id: string;
  window: Window | null;
  url: string;
  proxy: string;
  openedAt: number;
  width: number;
  height: number;
}

const VIEWPORT_SIZES = [
  { w: 1366, h: 768 },
  { w: 1440, h: 900 },
  { w: 1536, h: 864 },
  { w: 1600, h: 900 },
  { w: 1280, h: 720 },
  { w: 1920, h: 1080 },
  { w: 1360, h: 768 },
  { w: 1400, h: 900 },
  { w: 1680, h: 1050 },
  { w: 1280, h: 800 },
  { w: 1440, h: 810 },
  { w: 1600, h: 1000 },
];

const CYCLE_DURATION = { min: 20000, max: 30000 }; // 20-30s then refresh with new IP

const REFERRAL_SOURCES = [
  'https://google.com', 'https://facebook.com', 'https://twitter.com',
  'https://reddit.com', 'https://youtube.com', 'https://bing.com',
  'https://instagram.com', 'https://t.co', 'https://linkedin.com', '',
];

function addRandomReferralParams(url: string): string {
  try {
    const u = new URL(url);
    if (!u.searchParams.has('ref')) {
      const src = REFERRAL_SOURCES[Math.floor(Math.random() * REFERRAL_SOURCES.length)];
      if (src) u.searchParams.set('ref', src);
    }
    if (!u.searchParams.has('utm_source')) {
      const utmSources = ['google', 'facebook', 'twitter', 'reddit', 'direct', 'youtube', 'instagram'];
      u.searchParams.set('utm_source', utmSources[Math.floor(Math.random() * utmSources.length)]);
      u.searchParams.set('utm_medium', ['social', 'referral', 'organic', 'email'][Math.floor(Math.random() * 4)]);
    }
    return u.toString();
  } catch {
    return url;
  }
}

let popupIdCounter = 0;

export function MissionControlV24() {
  const { missionTabs, launchMissionTabs, removeMissionTab, clearMissionTabs, addSecurityLog } = useAppStore();
  const [url, setUrl] = useState('');
  const [count, setCount] = useState(10);
  const [mode, setMode] = useState<'popup' | 'iframe'>('popup');
  const [randomDelay, setRandomDelay] = useState(true);
  const [autoCycle, setAutoCycle] = useState(true);
  const [cycleDuration, setCycleDuration] = useState(60); // seconds
  const [launching, setLaunching] = useState(false);
  const [launchProgress, setLaunchProgress] = useState(0);
  const [proxyListText, setProxyListText] = useState('');
  const [autoFetchProxy, setAutoFetchProxy] = useState(true);
  const [fetchingProxy, setFetchingProxy] = useState(false);
  const [proxyCount, setProxyCount] = useState(0);
  const [desktopMode, setDesktopMode] = useState(false);
  const [desktopConnected, setDesktopConnected] = useState(false);
  const [farmStatus, setFarmStatus] = useState<FarmStatus | null>(null);
  const [fastMode, setFastMode] = useState(true);
  const [farmConfig, setFarmConfig] = useState({ headless: true, concurrency: 10, fastMode: true });

  const estimatedRam = farmStatus?.pool
    ? farmStatus.pool.size * (farmStatus.pool.headless ? 60 : 150) + 50
    : 0;

  interface FarmPoolStatus {
    size: number;
    active: number;
    idle: number;
    totalViewsDone: number;
    viewsPerBrowser: number;
    headless: boolean;
    fastMode: boolean;
    estimatedRamMb: number;
  }

  interface FarmStatus {
    running: boolean;
    paused: boolean;
    proxyCount: number;
    currentIndex: number;
    viewsSent: number;
    cycles: number;
    startedAt: number | null;
    activeView: boolean;
    pool?: FarmPoolStatus;
  }

  // Stats
  const [stats, setStats] = useState({
    totalLaunched: 0,
    activePopups: 0,
    totalCycles: 0,
    viewTimeMs: 0,
  });

  const popupsRef = useRef<Map<string, PopupInstance>>(new Map());
  const statsIntervalRef = useRef<number | null>(null);
  const cycleTimersRef = useRef<Map<string, number>>(new Map());
  const cycleDataRef = useRef<Map<string, { url: string; proxyIndex: number; proxies: ReturnType<typeof parseProxyList> }>>(new Map());

  // Track active popup count
  const updateStats = useCallback(() => {
    let active = 0;
    popupsRef.current.forEach((p, id) => {
      if (p.window && !p.window.closed) {
        active++;
      } else {
        popupsRef.current.delete(id);
        cycleTimersRef.current.delete(id);
      }
    });
    setStats(prev => ({
      ...prev,
      activePopups: active,
      viewTimeMs: prev.viewTimeMs + (active > 0 ? 1000 : 0),
    }));
  }, []);

  useEffect(() => {
    statsIntervalRef.current = window.setInterval(updateStats, 1000);
    return () => {
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    };
  }, [updateStats]);

  // Poll desktop farm status
  useEffect(() => {
    if (!desktopMode) {
      setDesktopConnected(false);
      setFarmStatus(null);
      return;
    }
    const iv = setInterval(async () => {
      try {
        const r = await fetch('http://localhost:3457/status', { signal: AbortSignal.timeout(2000) });
        if (r.ok) {
          const d = await r.json();
          setFarmStatus(d);
          setDesktopConnected(true);
        }
      } catch {
        setDesktopConnected(false);
      }
    }, 1500);
    return () => clearInterval(iv);
  }, [desktopMode]);

  const closePopup = useCallback((id: string) => {
    const popup = popupsRef.current.get(id);
    if (popup && popup.window && !popup.window.closed) {
      popup.window.close();
    }
    popupsRef.current.delete(id);
    cycleTimersRef.current.delete(id);
    updateStats();
  }, [updateStats]);

  const openPopupWindowInternalRef = useRef<((targetUrl: string, index: number, proxyStr: string | null, proxies: ReturnType<typeof parseProxyList>) => string | null) | null>(null);

  const openPopupWindow = useCallback((targetUrl: string, index: number, proxyStr: string | null, proxies?: ReturnType<typeof parseProxyList>): string | null => {
    const fn = openPopupWindowInternalRef.current;
    if (!fn) return null;
    const id = fn(targetUrl, index, proxyStr, proxies || []);
    if (id && proxies && proxies.length > 0) {
      cycleDataRef.current.set(id, { url: targetUrl, proxyIndex: index, proxies });
    }
    return id;
  }, []);

  // Stable cycle function that reads from ref to avoid circular deps
  const cyclePopupRef = useRef<(id: string) => void>((id: string) => {
    const data = cycleDataRef.current.get(id);
    if (!data) return;

    const nextIndex = (data.proxyIndex + 1) % (data.proxies.length || 1);
    const proxyForTab = data.proxies.length > 0 ? data.proxies[nextIndex % data.proxies.length] : null;
    const proxyStr = proxyForTab ? `${proxyForTab.host}:${proxyForTab.port}:${proxyForTab.user}:${proxyForTab.pass}` : null;

    cycleDataRef.current.delete(id);
    cycleTimersRef.current.delete(id);

    const fn = openPopupWindowInternalRef.current;
    if (fn) {
      const newId = fn(data.url, nextIndex, proxyStr, data.proxies);
      if (newId) {
        cycleDataRef.current.set(newId, { url: data.url, proxyIndex: nextIndex, proxies: data.proxies });
      }
    }
  });

  openPopupWindowInternalRef.current = (targetUrl, index, proxyStr, proxies) => {
    const id = `pv-${Date.now()}-${popupIdCounter++}`;
    const vp = VIEWPORT_SIZES[index % VIEWPORT_SIZES.length];

    // Randomize URL per tab to avoid identical traffic pattern
    let finalUrl = addRandomReferralParams(targetUrl);
    let proxyLabel = 'direct';
    if (proxyStr) {
      const proxyServer = `http://localhost:3456/proxy`;
      finalUrl = `${proxyServer}?url=${encodeURIComponent(finalUrl)}&proxy=${encodeURIComponent(proxyStr)}`;
      proxyLabel = proxyStr.split(':').slice(0, 2).join(':');
    }

    const features = [
      `width=${vp.w}`,
      `height=${vp.h}`,
      'noopener=yes',
      'menubar=no',
      'toolbar=no',
      'location=yes',
      'status=yes',
      'resizable=yes',
      'scrollbars=yes',
    ].join(',');

    try {
      const win = window.open(finalUrl, `phantom-tab-${id}`, features);
      if (!win || win.closed) return null;

      const popup: PopupInstance = {
        id, window: win, url: targetUrl, proxy: proxyLabel,
        openedAt: Date.now(), width: vp.w, height: vp.h,
      };
      popupsRef.current.set(id, popup);

      if (autoCycle) {
        const watchDuration = randomBetween(CYCLE_DURATION.min, CYCLE_DURATION.max);
        const timerId = window.setTimeout(() => {
          closePopup(id);
          setStats(prev => ({ ...prev, totalCycles: prev.totalCycles + 1 }));
          cyclePopupRef.current(id);
        }, watchDuration);
        cycleTimersRef.current.set(id, timerId);
      }

      setStats(prev => ({ ...prev, totalLaunched: prev.totalLaunched + 1 }));
      return id;
    } catch {
      return null;
    }
  };

  // ── Proxy persistence ──
  const PROXY_STORAGE_KEY = 'phantomview-proxies';

  const saveProxiesToDisk = useCallback((text: string) => {
    try { localStorage.setItem(PROXY_STORAGE_KEY, text); } catch {}
  }, []);

  const loadProxiesFromDisk = useCallback(() => {
    try {
      const saved = localStorage.getItem(PROXY_STORAGE_KEY);
      if (saved && saved.trim()) {
        setProxyListText(saved);
        const parsed = parseProxyList(saved);
        setProxyCount(parsed.length);
      }
    } catch {}
  }, []);

  // Load saved proxies on mount
  useEffect(() => { loadProxiesFromDisk(); }, [loadProxiesFromDisk]);

  // Save whenever text changes
  useEffect(() => {
    saveProxiesToDisk(proxyListText);
    setProxyCount(parseProxyList(proxyListText).length);
  }, [proxyListText, saveProxiesToDisk]);

  // ── Auto-scrape proxies ──
  const fetchScrapeProxies = useCallback(async () => {
    setFetchingProxy(true);
    addSecurityLog('Scraping free proxies...');
    try {
      const res = await fetch('http://localhost:3456/scrape-proxies', { signal: AbortSignal.timeout(30000) });
      const data = await res.json();
      if (data.ok && data.proxies.length > 0) {
        const text = data.proxies.join('\n');
        setProxyListText(text);
        saveProxiesToDisk(text);
        setProxyCount(data.proxies.length);
        addSecurityLog(`Fetched ${data.proxies.length} free proxies`);
      } else {
        addSecurityLog('No proxies found from scraper');
      }
    } catch (err: any) {
      addSecurityLog(`Proxy scrape failed: ${err.message}`);
    }
    setFetchingProxy(false);
  }, [addSecurityLog, saveProxiesToDisk]);

  const handleLaunch = async () => {
    if (!url.trim()) return;
    const tabCount = Math.min(Math.max(1, count), 200); // cap at 200 for popups

    // Desktop Mode — use farm engine
    if (desktopMode) {
      const proxyText = proxyListText.trim();
      const proxies = proxyText ? parseProxyList(proxyText) : [];
      if (proxies.length === 0) {
        addSecurityLog('Desktop mode needs at least 1 proxy. Auto-fetch or paste proxies.');
        return;
      }
      try {
        const r = await fetch('http://localhost:3457/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: url.trim(), proxies, fastMode, headless: farmConfig.headless, concurrency: farmConfig.concurrency }),
        });
        if (r.ok) {
          addSecurityLog(`[Desktop] Farm started — ${proxies.length} proxies, fastMode=${fastMode}, headless=${farmConfig.headless}`);
        } else {
          const d = await r.json();
          addSecurityLog(`[Desktop] Failed: ${d.error}`);
        }
      } catch (err: any) {
        addSecurityLog(`[Desktop] Connection failed: ${err.message}`);
      }
      return;
    }

    if (mode === 'iframe') {
      // Launch as iframes (existing behavior)
      launchMissionTabs(url.trim(), tabCount, '480p');
      addSecurityLog(`Launched ${tabCount} iframe tabs`);
      return;
    }

    // Popup mode
    setLaunching(true);
    setLaunchProgress(0);

    // Auto-fetch if no proxies saved and toggle is on
    let currentText = proxyListText;
    if (!currentText.trim() && autoFetchProxy) {
      addSecurityLog('No proxies found — auto-fetching...');
      setFetchingProxy(true);
      try {
        const res = await fetch('http://localhost:3456/scrape-proxies', { signal: AbortSignal.timeout(30000) });
        const data = await res.json();
        if (data.ok && data.proxies.length > 0) {
          currentText = data.proxies.join('\n');
          setProxyListText(currentText);
          saveProxiesToDisk(currentText);
          addSecurityLog(`Auto-fetched ${data.proxies.length} proxies`);
        } else {
          addSecurityLog('Auto-fetch found 0 proxies — launching with your real IP');
        }
      } catch (err: any) {
        addSecurityLog(`Auto-fetch failed: ${err.message} — launching without proxy`);
      }
      setFetchingProxy(false);
    }

    const proxies = parseProxyList(currentText);

    // Health check: test proxies before launching
    if (proxies.length > 0) {
      addSecurityLog(`Testing ${proxies.length} proxies...`);
      const healthyProxies: typeof proxies = [];
      for (const p of proxies) {
        try {
          const testUrl = `http://localhost:3456/test-proxy?proxy=${encodeURIComponent(`${p.host}:${p.port}:${p.user}:${p.pass}`)}`;
          const res = await fetch(testUrl, { signal: AbortSignal.timeout(10000) });
          const data = await res.json();
          if (data.ok) {
            healthyProxies.push(p);
          }
        } catch { /* skip dead proxy */ }
      }
      // Replace with only healthy proxies
      proxies.splice(0, proxies.length, ...healthyProxies);
      addSecurityLog(`${healthyProxies.length}/${proxies.length} proxies alive`);
      if (healthyProxies.length === 0) {
        addSecurityLog('All proxies dead — aborting');
        setLaunching(false);
        return;
      }
    }

    const batchSize = 3;
    const totalBatches = Math.ceil(tabCount / batchSize);
    let successCount = 0;

    for (let batch = 0; batch < totalBatches; batch++) {
      const batchCount = Math.min(batchSize, tabCount - batch * batchSize);

      for (let i = 0; i < batchCount; i++) {
        const idx = batch * batchSize + i;
        const proxyForTab = proxies.length > 0 ? proxies[idx % proxies.length] : null;
        const proxyStr = proxyForTab ? `${proxyForTab.host}:${proxyForTab.port}:${proxyForTab.user}:${proxyForTab.pass}` : null;
        const result = openPopupWindow(url.trim(), idx, proxyStr, proxies);
        if (result) successCount++;
        // Micro-delay between individual tabs (100-500ms) — not all at once
        if (i < batchCount - 1) {
          await delay(randomBetween(100, 500));
        }
      }

      setLaunchProgress(Math.round(((batch + 1) / totalBatches) * 100));

      if (batch < totalBatches - 1) {
        await delay(randomBetween(3000, 8000));
      }
    }

    const logMsg = proxies.length > 0
      ? `Popup farm: ${successCount}/${tabCount} tabs via ${proxies.length} proxies`
      : `Popup farm: ${successCount}/${tabCount} tabs (direct, no proxy list)`;
    addSecurityLog(logMsg);
    setLaunching(false);
    setLaunchProgress(100);
  };

  const closeAllPopups = useCallback(() => {
    const ids = Array.from(popupsRef.current.keys());
    ids.forEach(id => closePopup(id));
    clearMissionTabs();
    setStats({ totalLaunched: 0, activePopups: 0, totalCycles: 0, viewTimeMs: 0 });
  }, [closePopup, clearMissionTabs]);

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="flex flex-col h-full" style={{ height: 'calc(100vh - 52px)' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
            <Target className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-neutral-900 dark:text-white">View Farm v2.4</h2>
            <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
              {mode === 'popup' ? 'Popup mode • Real browser tabs • Views count' : 'Iframe mode • For monitoring'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Stats */}
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-neutral-500">
              <Eye className="w-3.5 h-3.5" />
              <span className="font-semibold text-neutral-900 dark:text-white">{stats.totalLaunched}</span> launched
            </span>
            <span className="flex items-center gap-1 text-neutral-500">
              <Play className="w-3.5 h-3.5 text-emerald-500" />
              <span className="font-semibold text-emerald-600">{stats.activePopups}</span> active
            </span>
            <span className="flex items-center gap-1 text-neutral-500">
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="font-semibold text-neutral-900 dark:text-white">{stats.totalCycles}</span> cycles
            </span>
            <span className="flex items-center gap-1 text-neutral-500">
              <Clock className="w-3.5 h-3.5" />
              <span className="font-semibold text-neutral-900 dark:text-white">{formatDuration(stats.viewTimeMs)}</span> view time
            </span>
          </div>

          {stats.activePopups > 0 && (
            <button onClick={closeAllPopups} className="btn-ghost text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400">
              <Trash2 className="w-3.5 h-3.5" />
              Close All
            </button>
          )}
          {desktopMode && farmStatus?.running && (
            <>
              {farmStatus.paused ? (
                <button onClick={async () => { await fetch('http://localhost:3457/resume', { method: 'POST' }); addSecurityLog('[Desktop] Farm resumed'); }} className="btn-ghost text-xs text-emerald-500 hover:text-emerald-700">
                  <Play className="w-3.5 h-3.5" />
                  Resume
                </button>
              ) : (
                <button onClick={async () => { await fetch('http://localhost:3457/pause', { method: 'POST' }); addSecurityLog('[Desktop] Farm paused'); }} className="btn-ghost text-xs text-amber-500 hover:text-amber-700">
                  <Clock className="w-3.5 h-3.5" />
                  Pause
                </button>
              )}
              <button onClick={async () => { await fetch('http://localhost:3457/stop', { method: 'POST' }); addSecurityLog('[Desktop] Farm stopped'); }} className="btn-ghost text-xs text-red-500 hover:text-red-700">
                <Square className="w-3.5 h-3.5" />
                Stop
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar controls */}
        <aside className="w-80 border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 flex flex-col gap-4 overflow-y-auto shrink-0">

          {/* URL Input */}
          <div>
            <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5 block">
              Target URL
            </label>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLaunch()}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder-neutral-400"
            />
          </div>

          {/* Tab Count */}
          <div>
            <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5 block">
              Number of Windows (max 200)
            </label>
            <input
              type="number"
              min={1}
              max={200}
              value={count}
              onChange={e => setCount(Math.min(200, Math.max(1, Number(e.target.value))))}
              className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white"
            />
          </div>

          {/* Mode selector */}
          <div>
            <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5 block">
              Mode
            </label>
            <div className="flex gap-1">
              <button
                onClick={() => { setMode('popup'); setDesktopMode(false); }}
                className={`flex-1 py-2 text-xs rounded-lg font-semibold transition-all cursor-pointer ${
                  mode === 'popup' && !desktopMode
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                <ExternalLink className="w-3.5 h-3.5 inline mr-1" />
                Popup
              </button>
              <button
                onClick={() => { setMode('iframe'); setDesktopMode(false); }}
                className={`flex-1 py-2 text-xs rounded-lg font-semibold transition-all cursor-pointer ${
                  mode === 'iframe' && !desktopMode
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                <Globe className="w-3.5 h-3.5 inline mr-1" />
                Iframe
              </button>
              <button
                onClick={() => { setDesktopMode(true); setMode('popup'); }}
                className={`flex-1 py-2 text-xs rounded-lg font-semibold transition-all cursor-pointer ${
                  desktopMode
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                <Monitor className="w-3.5 h-3.5 inline mr-1" />
                Desktop
              </button>
            </div>
            {desktopMode && (
              <div className="mt-1.5 space-y-1">
                <div className={`flex items-center gap-1.5 text-[11px] ${desktopConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${desktopConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  {desktopConnected ? 'Farm engine connected' : 'Farm engine offline — run: node desktop/main.mjs'}
                  {farmStatus?.running && (
                    <span className="ml-auto font-semibold">{farmStatus.viewsSent} views sent</span>
                  )}
                </div>
                {desktopConnected && farmStatus?.pool && !farmStatus.running && (
                  <div className="flex gap-2 text-[10px] text-neutral-400">
                    <span>Pool: {farmStatus.pool.size}browsers</span>
                    <span>~{estimatedRam}MB RAM</span>
                    <span>Headless: {farmStatus.pool.headless ? 'ON' : 'OFF'}</span>
                  </div>
                )}
                {desktopConnected && farmStatus?.running && farmStatus?.pool && (
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-neutral-400">
                    <span>Active: {farmStatus.pool.active}/{farmStatus.pool.size}</span>
                    <span>~{estimatedRam}MB</span>
                    <span>Fast: {farmStatus.pool.fastMode ? 'ON' : 'OFF'}</span>
                    <span>{farmStatus.cycles} cycles</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Auto-cycle */}
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-neutral-400" />
              <span className="text-xs text-neutral-600 dark:text-neutral-400">Auto-cycle tabs</span>
            </div>
            <button
              onClick={() => setAutoCycle(!autoCycle)}
              className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${
                autoCycle ? 'bg-primary-600' : 'bg-neutral-300 dark:bg-neutral-700'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                autoCycle ? 'translate-x-4' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Random delay */}
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-neutral-400" />
              <span className="text-xs text-neutral-600 dark:text-neutral-400">Randomized launch delay</span>
            </div>
            <button
              onClick={() => setRandomDelay(!randomDelay)}
              className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${
                randomDelay ? 'bg-primary-600' : 'bg-neutral-300 dark:bg-neutral-700'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                randomDelay ? 'translate-x-4' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Fast Mode (Desktop only) */}
          {desktopMode && (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs text-neutral-600 dark:text-neutral-400">Fast Mode (5-10s views)</span>
              </div>
              <button
                onClick={async () => {
                  const next = !fastMode;
                  setFastMode(next);
                  try { await fetch('http://localhost:3457/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fastMode: next }) }); } catch {}
                }}
                className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${
                  fastMode ? 'bg-amber-600' : 'bg-neutral-300 dark:bg-neutral-700'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                  fastMode ? 'translate-x-4' : 'translate-x-0'
                }`} />
              </button>
            </div>
          )}

          {/* Auto-fetch toggle */}
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-neutral-400" />
              <span className="text-xs text-neutral-600 dark:text-neutral-400">
                {autoFetchProxy ? 'IP protection ON' : 'IP protection OFF'}
              </span>
            </div>
            <button
              onClick={() => setAutoFetchProxy(!autoFetchProxy)}
              className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${
                autoFetchProxy ? 'bg-emerald-600' : 'bg-neutral-300 dark:bg-neutral-700'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                autoFetchProxy ? 'translate-x-4' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Proxy List */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                Proxy List
              </label>
              {proxyCount > 0 && (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  {proxyCount} proxies saved
                </span>
              )}
            </div>
            <textarea
              value={proxyListText}
              onChange={e => setProxyListText(e.target.value)}
              placeholder={`123.45.67.89:1080:user1:pass1\n98.76.54.32:1080:user2:pass2`}
              rows={4}
              className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder-neutral-400 font-mono resize-none"
            />
            <div className="flex items-center justify-between mt-1">
              <p className="text-[11px] text-neutral-400">
                {autoFetchProxy
                  ? 'Auto-fetches free proxies if list is empty'
                  : 'IP protection disabled — real IP visible'}
              </p>
              <button
                onClick={fetchScrapeProxies}
                disabled={fetchingProxy}
                className="text-[11px] text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer"
              >
                {fetchingProxy ? 'Fetching...' : 'Fetch now'}
              </button>
            </div>
          </div>

          {/* Mute info */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-900">
            <Shield className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            <div>
              <p className="text-xs font-semibold text-primary-700 dark:text-primary-300">Per-tab viewport randomization</p>
              <p className="text-[11px] text-primary-500 dark:text-primary-400">Each popup gets random size (12 presets)</p>
            </div>
          </div>

          {/* Launch button */}
          <button
            onClick={handleLaunch}
            disabled={!url.trim() || launching}
            className="btn-primary w-full justify-center text-base py-4"
          >
            {launching ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Launching... {Math.round(launchProgress)}%
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Launch {count} Popup{count > 1 ? 's' : ''}
              </>
            )}
          </button>

          {launching && (
            <div className="h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary-500 transition-all duration-500"
                style={{ width: `${launchProgress}%` }}
              />
            </div>
          )}

          {/* Active popups list */}
          {stats.activePopups > 0 && (
            <div className="border-t border-neutral-200 dark:border-neutral-800 pt-4 mt-2">
              <h4 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
                Active Windows ({stats.activePopups})
              </h4>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {Array.from(popupsRef.current.entries()).map(([id, popup]) => {
                  const elapsed = Date.now() - popup.openedAt;
                  const mins = Math.floor(elapsed / 60000);
                  const secs = Math.floor((elapsed % 60000) / 1000);
                  return (
                    <div key={id} className="flex items-center justify-between px-2 py-1.5 rounded bg-neutral-50 dark:bg-neutral-900 text-xs">
                      <span className="text-neutral-600 dark:text-neutral-400 truncate max-w-[160px]">
                        {popup.width}x{popup.height}
                      </span>
                      <span className="text-neutral-400 font-mono">{mins}:{String(secs).padStart(2, '0')}</span>
                      <button
                        onClick={() => closePopup(id)}
                        className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 cursor-pointer"
                      >
                        <X className="w-3 h-3 text-neutral-400 hover:text-red-500" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Info box */}
          {mode === 'popup' && !desktopMode && (
            <div className="mt-auto pt-4 border-t border-neutral-200 dark:border-neutral-800">
              <div className="flex items-start gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                <p>
                  Browser may block popups. Allow popups for this site when prompted.
                  Each popup is a real browser tab — views count as normal visits.
                </p>
              </div>
            </div>
          )}
          {desktopMode && (
            <div className="mt-auto pt-4 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
              <div className="flex items-start gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                <Monitor className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">Desktop Mode — Optimized Pool</p>
                  <p className="text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {fastMode
                      ? 'Fast Mode: ~5-10s per view • 10 browsers pool • ~600MB RAM • 1000 views in ~10 min'
                      : 'Normal Mode: ~20-30s per view • 10 browsers pool • ~600MB RAM'}
                  </p>
                  <p className="text-neutral-500 dark:text-neutral-400">
                    Browser pool reuses instances across views. Headless mode. Auto-recycle after 50 views per browser.
                  </p>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* Main area — stats dashboard */}
        <div className="flex-1 bg-neutral-50 dark:bg-neutral-900 p-8 overflow-y-auto">
          {stats.activePopups > 0 ? (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-neutral-700 dark:text-neutral-300">Live Farm Status</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card p-5 text-center">
                  <Eye className="w-8 h-8 text-primary-500 mx-auto mb-2" />
                  <div className="text-3xl font-bold text-neutral-900 dark:text-white">{stats.totalLaunched}</div>
                  <div className="text-xs text-neutral-500">Total Views Sent</div>
                </div>
                <div className="card p-5 text-center border-emerald-200 dark:border-emerald-900">
                  <Play className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <div className="text-3xl font-bold text-emerald-600">{stats.activePopups}</div>
                  <div className="text-xs text-neutral-500">Active Now</div>
                </div>
                <div className="card p-5 text-center">
                  <RefreshCw className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                  <div className="text-3xl font-bold text-amber-600">{stats.totalCycles}</div>
                  <div className="text-xs text-neutral-500">Auto-Cycles</div>
                </div>
                <div className="card p-5 text-center">
                  <Clock className="w-8 h-8 text-violet-500 mx-auto mb-2" />
                  <div className="text-3xl font-bold text-violet-600">{formatDuration(stats.viewTimeMs)}</div>
                  <div className="text-xs text-neutral-500">Total View Time</div>
                </div>
              </div>

              <div className="card p-6">
                <h4 className="font-semibold text-neutral-900 dark:text-white mb-3">Viewport Distribution</h4>
                <div className="flex flex-wrap gap-2">
                  {Array.from(popupsRef.current.entries()).map(([id, popup]) => (
                    <span key={id} className="tag text-xs font-mono">
                      {popup.width}x{popup.height}
                    </span>
                  ))}
                </div>
              </div>

              <div className="card p-4 text-center">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
                >
                  {stats.activePopups} window{stats.activePopups > 1 ? 's' : ''} watching &rarr; {url}
                </a>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <Target className="w-16 h-16 text-neutral-300 dark:text-neutral-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-neutral-700 dark:text-neutral-300 mb-3">View Farm</h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed mb-6">
                  Enter a URL and count, then click Launch. Each popup is a real browser tab with
                  randomized viewport size. Auto-cycle closes and reopens tabs for continuous views.
                </p>
                <div className="grid grid-cols-2 gap-3 text-left text-xs">
                  <div className="card p-3">
                    <span className="font-semibold text-neutral-900 dark:text-white">🎯 Popup Mode</span>
                    <p className="text-neutral-500 mt-1">Real browser tabs. Full JS, video, audio. Views count as normal page loads.</p>
                  </div>
                  <div className="card p-3">
                    <span className="font-semibold text-neutral-900 dark:text-white">🖥️ Random Viewport</span>
                    <p className="text-neutral-500 mt-1">12 different screen size presets. Each popup looks like a different device.</p>
                  </div>
                  <div className="card p-3">
                    <span className="font-semibold text-neutral-900 dark:text-white">🔄 Auto-Cycle</span>
                    <p className="text-neutral-500 mt-1">Tabs close after 30s-7min (random). Reopen continuously for sustained views.</p>
                  </div>
                  <div className="card p-3">
                    <span className="font-semibold text-neutral-900 dark:text-white">⏱️ Staggered Launch</span>
                    <p className="text-neutral-500 mt-1">3-8 second random delays between batches. Looks like natural traffic.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
