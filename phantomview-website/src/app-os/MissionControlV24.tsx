import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Globe, Trash2, Shield, Plus, X, Play, RefreshCw, Square,
  AlertTriangle, ExternalLink, Eye, Clock, Target, Monitor, Zap,
  Moon, Sun, Cpu, Grid, Layout, Sparkles, Layers, Maximize2,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useTheme } from '../hooks/useTheme';
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
  { w: 1280, h: 720 },
  { w: 1280, h: 800 },
  { w: 1360, h: 768 },
  { w: 1366, h: 768 },
];

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

function getCycleDuration(urlType: string, isFast: boolean, hardTimerMin: number = 0): { min: number; max: number } {
  if (hardTimerMin > 0) {
    const ms = hardTimerMin * 60 * 1000;
    return { min: ms, max: ms };
  }
  if (isFast) {
    switch (urlType) {
      case 'Video': return { min: 8000, max: 15000 };
      case 'Social': return { min: 2000, max: 5000 };
      case 'Article': return { min: 4000, max: 8000 };
      case 'Image': return { min: 3000, max: 6000 };
      case 'Document': return { min: 3000, max: 5000 };
      default: return { min: 5000, max: 10000 };
    }
  }
  switch (urlType) {
    case 'Video': return { min: 25000, max: 45000 };
    case 'Social': return { min: 8000, max: 15000 };
    case 'Article': return { min: 15000, max: 25000 };
    case 'Image': return { min: 5000, max: 10000 };
    case 'Document': return { min: 10000, max: 15000 };
    default: return { min: 20000, max: 30000 };
  }
}

let popupIdCounter = 0;

interface MissionControlV24Props {
  onBack?: () => void;
}

export function MissionControlV24({ onBack }: MissionControlV24Props) {
  const { missionTabs, launchMissionTabs, clearMissionTabs, addSecurityLog } = useAppStore();
  const { theme, toggle: toggleTheme } = useTheme();
  const [url, setUrl] = useState('');
  const [count, setCount] = useState(10);
  const [mode, setMode] = useState<'iframe'>('iframe');
  const [randomDelay, setRandomDelay] = useState(true);
  const [autoCycle, setAutoCycle] = useState(true);
  const [cycleDuration, setCycleDuration] = useState(60); // seconds
  const [launching, setLaunching] = useState(false);
  const [launchProgress, setLaunchProgress] = useState(0);
  const [proxyListText, setProxyListText] = useState('');
  const [autoFetchProxy, setAutoFetchProxy] = useState(true);
  const [fetchingProxy, setFetchingProxy] = useState(false);
  const [proxyCount, setProxyCount] = useState(0);
  const [proxyBankSize, setProxyBankSize] = useState(0);
  const [harvestStatus, setHarvestStatus] = useState({ raw: 0, fresh: 0, alive: 0, time: 0, lastHarvest: null as string | null, polling: false });
  const [proxyTestResults, setProxyTestResults] = useState<{ proxy: string; ok: boolean; latency: number; ip?: string; error?: string }[] | null>(null);
  const [testingProxies, setTestingProxies] = useState(false);
  const [popupBlockedCount, setPopupBlockedCount] = useState(0);
  const [desktopMode, setDesktopMode] = useState(true);
  const [desktopConnected, setDesktopConnected] = useState(false);
  const [farmStatus, setFarmStatus] = useState<FarmStatus | null>(null);
  const [fastMode, setFastMode] = useState(true);
  const [headless, setHeadless] = useState(true);
  const [farmConfig, setFarmConfig] = useState({ headless: true, concurrency: 10, fastMode: true });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeTab, setActiveTab] = useState<'monitor' | 'logs' | 'proxies'>('monitor');
  const [screenshots, setScreenshots] = useState<{ proxy: string; screenshot: string; width: number; height: number; age: number }[]>([]);
  const [detectedType, setDetectedType] = useState<string | null>(null);
  const [activities, setActivities] = useState<{ id: number; time: string; text: string; type: 'info' | 'success' | 'error' | 'view' }[]>([]);
  const activityIdRef = useRef(0);

  const addActivity = useCallback((text: string, type: 'info' | 'success' | 'error' | 'view' = 'info') => {
    const id = ++activityIdRef.current;
    const time = new Date().toLocaleTimeString();
    setActivities(prev => [{ id, time, text, type }, ...prev].slice(0, 50));
  }, []);

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

  interface FarmIssues {
    signin: number;
    signup: number;
    geoBlock: number;
    ageGate: number;
    paywall: number;
    captcha: number;
    empty: number;
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
    issuesSkipped?: FarmIssues;
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
  const urlTypeRef = useRef<string>('Website');
  const checkDoneRef = useRef<number | null>(null);

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

  // Poll screenshots from desktop farm
  useEffect(() => {
    if (!desktopMode || !farmStatus?.running) {
      setScreenshots([]);
      return;
    }
    const iv = setInterval(async () => {
      try {
        const r = await fetch('http://localhost:3457/screenshots', { signal: AbortSignal.timeout(3000) });
        if (r.ok) setScreenshots(await r.json());
      } catch {}
    }, 3000);
    return () => clearInterval(iv);
  }, [desktopMode, farmStatus?.running]);

  // Cleanup on unmount — close all popups and clear timers (RAM leak prevention)
  useEffect(() => {
    return () => {
      popupsRef.current.forEach((p) => {
        if (p.window && !p.window.closed) p.window.close();
      });
      popupsRef.current.clear();
      cycleTimersRef.current.forEach((id) => clearTimeout(id));
      cycleTimersRef.current.clear();
      cycleDataRef.current.clear();
      if (checkDoneRef.current) {
        clearInterval(checkDoneRef.current);
        checkDoneRef.current = null;
      }
    };
  }, []);

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

    // Use proxy bank for unique IP per tab if active
    const bankOn = proxyBankRef.current;
    let actualProxy = proxyStr;
    if (actualProxy) {
      const proxyServer = `http://localhost:3456/proxy`;
      finalUrl = `${proxyServer}?url=${encodeURIComponent(finalUrl)}&proxy=${encodeURIComponent(actualProxy)}`;
      proxyLabel = actualProxy.split(':').slice(0, 2).join(':');
    } else if (bankOn) {
      const proxyServer = `http://localhost:3456/proxy`;
      finalUrl = `${proxyServer}?url=${encodeURIComponent(finalUrl)}`;
      proxyLabel = 'bank';
    }

    const features = [
      `width=${vp.w}`,
      `height=${vp.h}`,
      'menubar=no',
      'toolbar=no',
      'location=yes',
      'status=yes',
      'resizable=yes',
      'scrollbars=yes',
    ].join(',');

    try {
      const win = window.open(finalUrl, `phantom-tab-${id}`, features);
      if (!win || win.closed) {
        setPopupBlockedCount(prev => prev + 1);
        return null;
      }

      const popup: PopupInstance = {
        id, window: win, url: targetUrl, proxy: proxyLabel,
        openedAt: Date.now(), width: vp.w, height: vp.h,
      };
      popupsRef.current.set(id, popup);

      if (autoCycle) {
        const cd = getCycleDuration(urlTypeRef.current, false, hardTimerRef.current);
        const watchDuration = randomBetween(cd.min, cd.max);
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

  // Poll proxy engine status every 5s
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const r = await fetch('http://localhost:3456/proxy-engine/status');
        const d = await r.json();
        if (d.ok) {
          setProxyBankSize(d.poolSize || 0);
          setHarvestStatus({
            raw: d.raw || 0, fresh: d.fresh || 0, alive: d.alive || 0, time: d.time || 0,
            lastHarvest: d.lastHarvest || null,
            polling: d.raw > 0 || (Date.now() - new Date(d.lastHarvest || Date.now()).getTime() > 120000 && d.raw === 0)
          });
        }
      } catch {}
    }, 5000);
    return () => clearInterval(t);
  }, []);

  // Debounced save — avoids localStorage write on every keystroke
  const proxyDebounceRef = useRef<number | null>(null);
  useEffect(() => {
    if (proxyDebounceRef.current) clearTimeout(proxyDebounceRef.current);
    proxyDebounceRef.current = window.setTimeout(() => {
      saveProxiesToDisk(proxyListText);
      setProxyCount(parseProxyList(proxyListText).length);
    }, 500);
    return () => { if (proxyDebounceRef.current) clearTimeout(proxyDebounceRef.current); };
  }, [proxyListText, saveProxiesToDisk]);

  // ── Auto-scrape proxies (backend returns only LIVE ones) ──
  const fetchScrapeProxies = useCallback(async () => {
    setFetchingProxy(true);
    addSecurityLog('Scraping & verifying free proxies...');
    try {
      const res = await fetch('http://localhost:3456/scrape-proxies', { signal: AbortSignal.timeout(120000) });
      const data = await res.json();
      if (data.ok && data.proxies.length > 0) {
        const text = data.proxies.join('\n');
        setProxyListText(text);
        saveProxiesToDisk(text);
        setProxyCount(data.proxies.length);
        const verified = data.tested ? ` (${data.alive} live, ${data.dead} dead filtered)` : '';
        addSecurityLog(`Fetched ${data.proxies.length} verified proxies${verified}`);
      } else {
        addSecurityLog(data.tested
          ? `All ${data.total} proxies dead — try later`
          : 'No proxies found from scraper'
        );
      }
    } catch (err: any) {
      addSecurityLog(`Proxy scrape failed: ${err.message}`);
    }
    setFetchingProxy(false);
  }, [addSecurityLog, saveProxiesToDisk]);

  const testAllProxies = useCallback(async () => {
    const proxies = parseProxyList(proxyListText);
    if (proxies.length === 0) {
      addActivity('No proxies to test', 'error');
      return;
    }
    setTestingProxies(true);
    setProxyTestResults(null);
    addActivity(`Testing ${proxies.length} proxies...`, 'info');
    addSecurityLog(`Testing ${proxies.length} proxies...`);
    const results: { proxy: string; ok: boolean; latency: number; ip?: string; error?: string }[] = [];
    for (const p of proxies) {
      const label = `${p.host}:${p.port}`;
      const start = performance.now();
      try {
        const testUrl = `http://localhost:3456/test-proxy?proxy=${encodeURIComponent(`${p.host}:${p.port}:${p.user}:${p.pass}`)}`;
        const res = await fetch(testUrl, { signal: AbortSignal.timeout(8000) });
        const data = await res.json();
        results.push({
          proxy: label,
          ok: data.ok,
          latency: Math.round(performance.now() - start),
          ip: data.ip,
          error: data.error,
        });
      } catch (err: any) {
        results.push({
          proxy: label,
          ok: false,
          latency: Math.round(performance.now() - start),
          error: err?.name === 'TimeoutError' ? 'Timeout' : err?.message || 'Connection failed',
        });
      }
    }
    setProxyTestResults(results);
    setTestingProxies(false);
    const alive = results.filter(r => r.ok).length;
    addActivity(`Proxy test done: ${alive}/${results.length} alive`, alive > 0 ? 'success' : 'error');
    addSecurityLog(`Proxy test: ${alive}/${results.length} alive`);
  }, [proxyListText, addActivity, addSecurityLog]);

  const removeDeadProxies = useCallback(() => {
    if (!proxyTestResults) return;
    const aliveProxies = proxyTestResults.filter(r => r.ok).map(r => r.proxy);
    const lines = proxyListText.split('\n').filter(line => {
      const p = parseProxy(line.trim());
      return p && aliveProxies.includes(`${p.host}:${p.port}`);
    });
    setProxyListText(lines.join('\n'));
    setProxyTestResults(null);
    addActivity(`Removed ${proxyTestResults.filter(r => !r.ok).length} dead proxies`, 'info');
    addSecurityLog(`Removed dead proxies, ${aliveProxies.length} remaining`);
  }, [proxyTestResults, proxyListText, addActivity, addSecurityLog]);

  const PROXY_BANK_URL = 'http://localhost:3456/proxy-bank';
  const proxyBankRef = useRef(false);
  const [proxyBankActive, setProxyBankActive] = useState(false);
  const [proxyBankPool, setProxyBankPool] = useState(0);
  const hardTimerRef = useRef(2); // 2 minutes default
  const [hardTimerMin, setHardTimerMin] = useState(2);

  const toggleProxyBank = useCallback(async () => {
    const next = !proxyBankActive;
    setProxyBankActive(next);
    proxyBankRef.current = next;
    if (next) {
      try {
        const r = await fetch(`${PROXY_BANK_URL}/refresh`, { signal: AbortSignal.timeout(120000) });
        const d = await r.json();
        setProxyBankPool(d.poolSize);
        addActivity(`Proxy Bank: ${d.poolSize} proxies in pool`, d.poolSize > 0 ? 'success' : 'error');
      } catch (err: any) {
        addActivity(`Proxy Bank refresh failed: ${err.message}`, 'error');
      }
    }
  }, [proxyBankActive, addActivity]);

  const [ipCheckResult, setIpCheckResult] = useState<{ realIp?: string; poolSize?: number } | null>(null);

  const runIpCheck = useCallback(async () => {
    try {
      const r = await fetch('http://localhost:3456/check-ip', { signal: AbortSignal.timeout(8000) });
      const d = await r.json();
      setIpCheckResult(d);
      addActivity(`IP Check: ${d.realIp} (pool: ${d.poolSize})`, d.ok ? 'info' : 'error');
    } catch (err: any) {
      addActivity(`IP check failed: ${err.message}`, 'error');
    }
  }, [addActivity]);

  const autoFetchAndVerify = useCallback(async () => {
    addActivity('Auto-fetching & verifying proxies...', 'info');
    addSecurityLog('Auto-fetching & verifying proxies...');
    setFetchingProxy(true);
    try {
      const res = await fetch('http://localhost:3456/scrape-proxies', { signal: AbortSignal.timeout(120000) });
      const data = await res.json();
      if (data.ok && data.proxies.length > 0) {
        const text = data.proxies.join('\n');
        setProxyListText(text);
        saveProxiesToDisk(text);
        setProxyCount(data.proxies.length);
        setFetchingProxy(false);

        if (data.tested) {
          // Backend already verified — show results directly
          addActivity(`${data.alive} live / ${data.dead} dead (${data.total} scraped)`, data.alive > 0 ? 'success' : 'error');
          addSecurityLog(`Backend verified: ${data.alive} alive, ${data.dead} dead of ${data.total} scraped`);
        } else {
          // Fallback: test on frontend (legacy)
          addSecurityLog(`Fetched ${data.proxies.length} proxies (unverified), testing...`);
          addActivity(`Fetched ${data.proxies.length} proxies, testing...`, 'info');
          const proxies = parseProxyList(text);
          setTestingProxies(true);
          setProxyTestResults(null);
          const results: { proxy: string; ok: boolean; latency: number; ip?: string; error?: string }[] = [];
          for (const p of proxies) {
            const label = `${p.host}:${p.port}`;
            const start = performance.now();
            try {
              const testUrl = `http://localhost:3456/test-proxy?proxy=${encodeURIComponent(`${p.host}:${p.port}:${p.user}:${p.pass}`)}`;
              const r2 = await fetch(testUrl, { signal: AbortSignal.timeout(8000) });
              const d2 = await r2.json();
              results.push({ proxy: label, ok: d2.ok, latency: Math.round(performance.now() - start), ip: d2.ip, error: d2.error });
            } catch (err: any) {
              results.push({ proxy: label, ok: false, latency: Math.round(performance.now() - start), error: err?.name === 'TimeoutError' ? 'Timeout' : err?.message || 'Connection failed' });
            }
          }
          setProxyTestResults(results);
          setTestingProxies(false);
          const alive = results.filter(r => r.ok).length;
          if (alive > 0) {
            const aliveProxies = results.filter(r => r.ok).map(r => r.proxy);
            const lines = text.split('\n').filter(line => {
              const p = parseProxy(line.trim());
              return p && aliveProxies.includes(`${p.host}:${p.port}`);
            });
            setProxyListText(lines.join('\n'));
            setProxyCount(lines.length);
            saveProxiesToDisk(lines.join('\n'));
            setProxyTestResults(null);
            addActivity(`Auto-removed ${results.length - alive} dead, ${alive} live`, 'success');
            addSecurityLog(`Frontend verified: ${alive} alive`);
          } else {
            addActivity('All proxies dead — try later', 'error');
            addSecurityLog('All proxies dead');
          }
        }
      } else {
        const msg = data.tested
          ? `All ${data.total} scraped proxies dead — try later`
          : 'Proxy scraper returned 0 proxies';
        addActivity(msg, 'error');
        addSecurityLog(msg);
        setFetchingProxy(false);
      }
    } catch (err: any) {
      addActivity(`Proxy fetch failed: ${err.message}`, 'error');
      addSecurityLog(`Proxy fetch failed: ${err.message}`);
      setFetchingProxy(false);
    }
  }, [addActivity, addSecurityLog, saveProxiesToDisk]);

  const normalizeUrl = (input: string) => {
    let u = input.trim();
    if (!u) return u;
    if (!u.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//)) {
      if (!u.includes('.')) u += '.com';
      u = `https://${u}`;
    }
    return u;
  };

  const detectUrlType = (input: string): string => {
    const u = input.toLowerCase();
    if (/youtube|youtu\.be|vimeo|dailymotion|twitch|tiktok|netflix|hulu|hotstar|sonyliv|primevideo/i.test(u))
      return 'Video';
    if (/instagram|twitter|x\.com|pinterest|imgur|flickr|reddit|tumblr|snapchat|threads\.net/i.test(u))
      return 'Social';
    if (/linkedin|facebook|fb\.com|telegram|whatsapp|discord|slack/i.test(u))
      return 'Social';
    if (/medium|blog|news|article|wikipedia|docs\.google|notion|substack|hashnode/i.test(u))
      return 'Article';
    if (/\.(png|jpg|jpeg|gif|webp|avif|svg)(\?|$)/i.test(u))
      return 'Image';
    if (/\.(mp4|webm|avi|mov|mkv)(\?|$)/i.test(u))
      return 'Video';
    if (/\.(pdf)(\?|$)/i.test(u))
      return 'Document';
    return 'Website';
  };

  const handleLaunch = async () => {
    if (!url.trim()) return;
    const normalizedUrl = normalizeUrl(url);
    setUrl(normalizedUrl);
    const urlType = detectUrlType(normalizedUrl);
    setDetectedType(urlType);
    urlTypeRef.current = urlType;
    addSecurityLog(`[Auto-Detect] ${urlType} link detected → ${normalizedUrl}`);
    const tabCount = Math.min(Math.max(1, count), 999);

    setLaunching(true);
    setLaunchProgress(0);
    setPopupBlockedCount(0);

    if (desktopMode) {
      addActivity(`Starting Desktop farm for ${urlType}: ${normalizedUrl}`, 'info');
      const proxyText = proxyListText.trim();
      const proxies = proxyText ? parseProxyList(proxyText) : [];
      const target = proxies.length > 0 ? proxies.length : count;
      try {
        const r = await fetch('http://localhost:3457/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: normalizedUrl, proxies, fastMode, headless, concurrency: farmConfig.concurrency, proxyTarget: target }),
        });
        if (r.ok) {
          addSecurityLog(`[Desktop] Farm started — target ${target} proxies, fastMode=${fastMode}, headless=${headless}`);
          addActivity(`Farm running — collecting ${target} proxies`, 'success');
          setLaunchProgress(10);
        } else {
          const d = await r.json();
          addSecurityLog(`[Desktop] Failed: ${d.error}`);
          addActivity(`Desktop farm failed: ${d.error}`, 'error');
          setLaunching(false);
          return;
        }
      } catch (err: any) {
        addSecurityLog(`[Desktop] Connection failed: ${err.message}`);
        addActivity(`Desktop engine offline — run: node desktop/main.mjs`, 'error');
        setLaunching(false);
        return;
      }
      // Watch farm status for completion
      const checkDone = setInterval(async () => {
        try {
          const r = await fetch('http://localhost:3457/status', { signal: AbortSignal.timeout(2000) });
          if (r.ok) {
            const d = await r.json();
            setFarmStatus(d);
            if (d.running) {
              const proxyPct = d.proxyCount > 0 ? Math.round((d.proxyCount / (d.pool?.viewsPerBrowser || target)) * 60) : 0;
              const viewPct = d.viewsSent > 0 ? Math.round((d.viewsSent / Math.max(1, target)) * 10) : 0;
              setLaunchProgress(Math.min(90, 10 + proxyPct + viewPct));
            }
            if (!d.running) {
              setLaunchProgress(d.viewsSent > 0 ? 100 : 0);
              setLaunching(false);
              clearInterval(checkDone);
              checkDoneRef.current = null;
              if (d.viewsSent === 0) {
                addActivity('Desktop farm stopped with 0 views sent', 'error');
                addSecurityLog('[Desktop] Farm stopped before any views were sent');
              }
            }
          }
        } catch {}
      }, 2000);
      checkDoneRef.current = checkDone;
      return;
    }

    if (mode === 'iframe') {
      addActivity(`Iframe mode: ${tabCount} tabs for ${urlType}`, 'info');
      launchMissionTabs(normalizedUrl, tabCount, '480p');
      addSecurityLog(`Launched ${tabCount} iframe tabs`);
      // Simulated progress for iframe
      for (let p = 10; p <= 100; p += 15) {
        setLaunchProgress(p);
        await delay(200);
      }
      setLaunching(false);
      setLaunchProgress(100);
      addActivity(`Iframe: ${tabCount} tabs active`, 'success');
      return;
    }

    // Popup mode
    addActivity(`Launching ${tabCount} popup tabs for ${urlType}`, 'info');

    // Auto-fetch if no proxies saved and toggle is on
    let currentText = proxyListText;
    if (!currentText.trim() && autoFetchProxy) {
      addActivity('No proxies found — auto-fetching...', 'info');
      addSecurityLog('No proxies found — auto-fetching live proxies...');
      setFetchingProxy(true);
      try {
        const res = await fetch('http://localhost:3456/scrape-proxies', { signal: AbortSignal.timeout(120000) });
        const data = await res.json();
        if (data.ok && data.proxies.length > 0) {
          currentText = data.proxies.join('\n');
          setProxyListText(currentText);
          saveProxiesToDisk(currentText);
          const verified = data.tested ? ` (${data.alive} live of ${data.total} scraped)` : '';
          addSecurityLog(`Auto-fetched ${data.proxies.length} verified proxies${verified}`);
          addActivity(`Auto-fetched ${data.proxies.length} live proxies`, 'success');
        } else {
          const msg = data.tested
            ? `All ${data.total} scraped proxies dead — launching without IP protection`
            : 'Proxy scraper returned 0 proxies — launching without IP protection';
          addActivity(msg, 'error');
          addSecurityLog(data.tested ? 'All proxies dead' : 'Proxy scraper empty');
        }
      } catch (err: any) {
        addActivity('Proxy service unavailable — launching directly without IP protection', 'error');
        addSecurityLog(`Proxy service down (${err.message}) — proceeding without proxies`);
      }
      setFetchingProxy(false);
    }

    const proxies = parseProxyList(currentText);

    // Health check: test proxies before launching (skip if backend down)
    if (proxies.length > 0) {
      addActivity(`Testing ${proxies.length} proxies...`, 'info');
      addSecurityLog(`Testing ${proxies.length} proxies...`);
      const healthyProxies: typeof proxies = [];
      for (const p of proxies) {
        try {
          const testUrl = `http://localhost:3456/test-proxy?proxy=${encodeURIComponent(`${p.host}:${p.port}:${p.user}:${p.pass}`)}`;
          const res = await fetch(testUrl, { signal: AbortSignal.timeout(5000) });
          const data = await res.json();
          if (data.ok) healthyProxies.push(p);
        } catch { /* proxy test backend down — skip check */ }
      }
      if (healthyProxies.length > 0) {
        proxies.splice(0, proxies.length, ...healthyProxies);
        addSecurityLog(`${healthyProxies.length} proxies alive, using them`);
        addActivity(`${healthyProxies.length} healthy proxies`, 'success');
      } else {
        addActivity('Proxy testing skipped (backend down) — using all proxies as-is', 'info');
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
        const result = openPopupWindow(normalizedUrl, idx, proxyStr, proxies);
        if (result) {
          successCount++;
        }
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
    addActivity(`${successCount}/${tabCount} tabs active — ${urlType} farming started`, 'success');
    setLaunching(false);
    setLaunchProgress(100);
  };

  const closeAllPopups = useCallback(() => {
    const ids = Array.from(popupsRef.current.keys());
    ids.forEach(id => closePopup(id));
    clearMissionTabs();
    setStats({ totalLaunched: 0, activePopups: 0, totalCycles: 0, viewTimeMs: 0 });
    setLaunching(false);
    setLaunchProgress(0);
    setFarmStatus(null);
    setScreenshots([]);
    if (checkDoneRef.current) {
      clearInterval(checkDoneRef.current);
      checkDoneRef.current = null;
    }
  }, [closePopup, clearMissionTabs]);

  const stopDesktopFarm = useCallback(async () => {
    try {
      await fetch('http://localhost:3457/stop', { method: 'POST' });
    } catch {}
    addSecurityLog('[Desktop] Farm stopped');
    setLaunching(false);
    setLaunchProgress(0);
    setFarmStatus(null);
    setScreenshots([]);
    if (checkDoneRef.current) {
      clearInterval(checkDoneRef.current);
      checkDoneRef.current = null;
    }
  }, [addSecurityLog]);

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
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-all cursor-pointer"
            >
              ← Back
            </button>
          )}
          <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
            <Target className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-neutral-900 dark:text-white">View Farm v2.4</h2>
              <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
                {desktopMode ? 'Desktop mode • Headless farm • Screenshots in UI' : 'Iframe mode • In-page embed'}
              </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Stats */}
          <div className="flex items-center gap-3 text-xs">
            {desktopMode && farmStatus?.running ? (
              <>
                <span className="flex items-center gap-1 text-neutral-500">
                  <Eye className="w-3.5 h-3.5" />
                  <span className="font-semibold text-neutral-900 dark:text-white">{farmStatus.viewsSent}</span> sent
                </span>
                <span className="flex items-center gap-1 text-neutral-500">
                  <Play className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="font-semibold text-emerald-600">{farmStatus.pool?.active ?? 0}</span> active
                </span>
                <span className="flex items-center gap-1 text-neutral-500">
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span className="font-semibold text-neutral-900 dark:text-white">{farmStatus.cycles}</span> cycles
                </span>
                <span className="flex items-center gap-1 text-neutral-500">
                  <Globe className="w-3.5 h-3.5 text-blue-500" />
                  <span className="font-semibold text-neutral-900 dark:text-white">{farmStatus.proxyCount}</span> proxies
                </span>
                <span className="flex items-center gap-1 text-neutral-500">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <span className="font-semibold text-amber-600">{Object.values(farmStatus.issuesSkipped || {}).reduce((a: number, b: number) => a + b, 0)}</span> blocked
                </span>
                <span className="flex items-center gap-1 text-neutral-500">
                  <Monitor className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="font-semibold text-emerald-600">{farmStatus.pool?.headless ? 'Headless' : 'Visible'}</span>
                </span>
              </>
            ) : null}
          </div>

          <button
            onClick={toggleTheme}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all cursor-pointer"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

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
              <button onClick={stopDesktopFarm} className="btn-ghost text-xs text-red-500 hover:text-red-700">
                <Square className="w-3.5 h-3.5" />
                Stop
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar controls */}
        <aside className="w-80 border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 flex flex-col gap-3 overflow-y-auto shrink-0">

          {/* URL Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                Target URL
              </label>
              <div className="flex items-center gap-1.5">
                {proxyBankSize > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-semibold">
                    {proxyBankSize} proxies
                  </span>
                )}
                {detectedType && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                    {detectedType}
                  </span>
                )}
              </div>
            </div>
            <input
              value={url}
              onChange={e => { setUrl(e.target.value); setDetectedType(null); }}
              onKeyDown={e => e.key === 'Enter' && handleLaunch()}
              placeholder="Paste any link here..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder-neutral-400"
            />
          </div>

          {/* Proxy File Upload */}
          <div>
            <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5 block">
              Upload Proxy List
            </label>
            <input
              type="file"
              accept=".txt,.csv"
              onChange={async e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const text = await file.text();
                try {
                  const r = await fetch('http://localhost:3456/proxy-bank/upload', {
                    method: 'POST', body: text,
                  });
                  const d = await r.json();
                  addActivity(`Uploaded: +${d.added} proxies (bank: ${d.poolSize})`, 'success');
                  setProxyCount(d.poolSize);
                } catch (err) {
                  addActivity(`Upload failed: ${err}`, 'error');
                }
                e.target.value = '';
              }}
              className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary-50 dark:file:bg-primary-900/30 file:text-primary-700 dark:file:text-primary-300 hover:file:bg-primary-100 dark:hover:file:bg-primary-900/50 cursor-pointer"
            />
            <p className="text-[10px] text-neutral-400 mt-1">Upload .txt file (one proxy per line, IP:PORT)</p>
          </div>

          {/* Harvest Status */}
          <div className="flex items-center gap-1.5 text-[10px]">
            {harvestStatus.polling ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-amber-600 dark:text-amber-400">
                  Harvest: {harvestStatus.raw} collected, {harvestStatus.alive} alive
                </span>
              </>
            ) : harvestStatus.lastHarvest ? (
              <span className="text-neutral-400">
                Last harvest: {harvestStatus.alive} alive in {(harvestStatus.time / 1000).toFixed(0)}s
              </span>
            ) : (
              <span className="text-neutral-500">Proxy harvest: waiting...</span>
            )}
          </div>

          {/* Mode selector — always visible */}
          <div>
            <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5 block">
              Mode
            </label>
            <div className="flex gap-1">

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
                onClick={() => setDesktopMode(true)}
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

          {/* Fast Mode toggle — visible when Desktop is selected */}
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

          {/* Show browsers toggle — Desktop only */}
          {desktopMode && (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <Monitor className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-xs text-neutral-600 dark:text-neutral-400">Show browsers</span>
              </div>
              <button
                onClick={async () => {
                  const next = !headless;
                  setHeadless(next);
                  try { await fetch('http://localhost:3457/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ headless: next }) }); } catch {}
                }}
                className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${
                  !headless ? 'bg-emerald-600' : 'bg-neutral-300 dark:bg-neutral-700'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                  !headless ? 'translate-x-4' : 'translate-x-0'
                }`} />
              </button>
            </div>
          )}

          {/* Tab Count / Proxy Target */}
          <div>
            <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5 block">
              {desktopMode ? 'Proxy Target' : 'Windows'} (max 999)
            </label>
            <input
              type="number"
              min={1}
              max={999}
              value={count}
              onChange={e => setCount(Math.min(999, Math.max(1, Number(e.target.value))))}
              className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white"
            />
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
                Launch View
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

          {popupBlockedCount > 0 && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold">{popupBlockedCount} popup{popupBlockedCount !== 1 ? 's' : ''} blocked.</span>
                <p className="text-amber-600 dark:text-amber-400 mt-0.5">Please allow popups for this site in your browser settings and try again.</p>
              </div>
            </div>
          )}

          {/* Advanced Settings Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center justify-between w-full px-3 py-2 text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <span className="font-semibold uppercase tracking-wider">Advanced Settings</span>
            <span className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`}>▼</span>
          </button>

          {showAdvanced && (
            <>

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
                  <span className="text-[10px] text-neutral-400">
                    {desktopMode && !proxyListText.trim() ? 'empty = auto-fetch from bank' : proxyBankSize > 0 ? `${proxyBankSize} in bank` : ''}
                  </span>
                </div>
                <textarea
                  value={proxyListText}
                  onChange={e => setProxyListText(e.target.value)}
                  placeholder={`123.45.67.89:1080:user1:pass1\n98.76.54.32:1080:user2:pass2`}
                  rows={4}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder-neutral-400 font-mono resize-none"
                />
                <div className="flex items-center gap-2 mt-1">
                  <button
                    onClick={autoFetchAndVerify}
                    disabled={fetchingProxy || testingProxies}
                    className="flex-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    {fetchingProxy || testingProxies ? (
                      <><RefreshCw className="w-3 h-3 inline animate-spin mr-1" />{fetchingProxy ? 'Fetching...' : 'Testing...'}</>
                    ) : (
                      <><Zap className="w-3 h-3 inline mr-1" />Auto Fetch & Verify</>
                    )}
                  </button>
                  <button
                    onClick={testAllProxies}
                    disabled={testingProxies || !proxyListText.trim()}
                    className="text-[11px] text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer"
                  >
                    Test
                  </button>
                  <button
                    onClick={fetchScrapeProxies}
                    disabled={fetchingProxy}
                    className="text-[11px] text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer"
                  >
                    Scrape
                  </button>
                </div>
                {proxyTestResults && (
                  <div className="mt-2 border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
                    <div className="max-h-28 overflow-y-auto text-[11px] font-mono">
                      {proxyTestResults.map((r, i) => (
                        <div key={i} className={`flex items-center justify-between px-2 py-1 ${r.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'} ${i % 2 === 0 ? 'bg-neutral-50 dark:bg-neutral-900' : ''}`}>
                          <span className="truncate max-w-[120px]">{r.proxy}</span>
                          <span className="shrink-0 ml-2">
                            {r.ok ? `${r.latency}ms${r.ip ? ` • ${r.ip}` : ''}` : r.error || 'Dead'}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between px-2 py-1.5 bg-neutral-100 dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700">
                      <span className="text-[11px] text-neutral-500">
                        {proxyTestResults.filter(r => r.ok).length}/{proxyTestResults.length} alive
                      </span>
                      <button
                        onClick={removeDeadProxies}
                        className="text-[11px] text-red-500 hover:text-red-700 font-semibold cursor-pointer"
                      >
                        Remove Dead
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Info box */}
          {!showAdvanced && (
            <div className="mt-auto pt-3 border-t border-neutral-200 dark:border-neutral-800">
              <div className="flex items-start gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                <Monitor className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                <p>
                  Desktop Mode runs a headless farm — no browser windows. Screenshots appear in the UI.
                  Switch to Iframe for in-page embed.
                </p>
              </div>
            </div>
          )}

          {showAdvanced && desktopMode && (
            <div className="mt-auto pt-3 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
              <div className="flex items-start gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                <Monitor className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">Desktop Mode — Optimized Pool</p>
                  <p className="text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {fastMode
                      ? 'Fast Mode: ~5-10s per view • 10 browsers pool • ~600MB RAM • 1000 views in ~10 min'
                      : 'Normal Mode: ~20-30s per view • 10 browsers pool • ~600MB RAM'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* Main area — stats dashboard */}
        <div className="flex-1 bg-neutral-50 dark:bg-neutral-900 p-6 overflow-y-auto flex flex-col">
          {desktopMode && farmStatus?.running ? (
            <div className="space-y-6">
              {/* Tab bar */}
              <div className="flex gap-1 border-b border-neutral-200 dark:border-neutral-800 pb-2">
                {(['monitor', 'logs', 'proxies'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-all cursor-pointer ${
                      activeTab === tab
                        ? 'bg-white dark:bg-neutral-800 text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
                        : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    {tab === 'monitor' ? '📊 Monitor' : tab === 'logs' ? '📋 Logs' : '🛡️ Proxies'}
                  </button>
                ))}
              </div>

              {/* Tab: Monitor */}
              {activeTab === 'monitor' && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="card p-5 text-center">
                      <Eye className="w-8 h-8 text-primary-500 mx-auto mb-2" />
                      <div className="text-3xl font-bold text-neutral-900 dark:text-white">{farmStatus.viewsSent}</div>
                      <div className="text-xs text-neutral-500">Total Views</div>
                    </div>
                    <div className="card p-5 text-center border-emerald-200 dark:border-emerald-900">
                      <Play className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                      <div className="text-3xl font-bold text-emerald-600">{farmStatus.pool?.active ?? 0}</div>
                      <div className="text-xs text-neutral-500">Active Now</div>
                    </div>
                    <div className="card p-5 text-center">
                      <RefreshCw className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                      <div className="text-3xl font-bold text-amber-600">{farmStatus.cycles}</div>
                      <div className="text-xs text-neutral-500">Cycles</div>
                    </div>
                    <div className="card p-5 text-center">
                      <Globe className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                      <div className="text-3xl font-bold text-blue-600">{farmStatus.proxyCount}</div>
                      <div className="text-xs text-neutral-500">Proxies</div>
                    </div>
                    <div className="card p-5 text-center">
                      <Clock className="w-8 h-8 text-violet-500 mx-auto mb-2" />
                      <div className="text-3xl font-bold text-violet-600">
                        {formatDuration(farmStatus?.startedAt ? Date.now() - farmStatus.startedAt : 0)}
                      </div>
                      <div className="text-xs text-neutral-500">Run Time</div>
                    </div>
                  </div>

                  {farmStatus?.pool && (
                    <div className="card p-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-neutral-900 dark:text-white">Farm Engine</h4>
                        <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                          farmStatus.paused
                            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                            : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                        }`}>
                          {farmStatus.paused ? 'Paused' : 'Running'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 mt-3 text-center text-xs">
                        <div>
                          <span className="block text-lg font-bold text-neutral-900 dark:text-white">{farmStatus.pool.size}</span>
                          <span className="text-neutral-500">Pool Size</span>
                        </div>
                        <div>
                          <span className="block text-lg font-bold text-neutral-900 dark:text-white">{farmStatus.pool.headless ? 'Hidden' : 'Visible'}</span>
                          <span className="text-neutral-500">Mode</span>
                        </div>
                        <div>
                          <span className="block text-lg font-bold text-neutral-900 dark:text-white">~{estimatedRam}MB</span>
                          <span className="text-neutral-500">RAM</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Blocked Pages Breakdown */}
                  {farmStatus?.issuesSkipped && Object.values(farmStatus.issuesSkipped).some(v => v > 0) && (
                    <div className="card p-4">
                      <h4 className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-2">Blocked Pages</h4>
                      <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
                        {Object.entries(farmStatus.issuesSkipped).map(([key, val]) => (
                          <div key={key} className="p-2 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                            <div className="text-sm font-bold text-neutral-900 dark:text-white">{val as number}</div>
                            <div className="text-neutral-500 truncate">{key}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Live Browser Screenshots */}
                  {screenshots.length > 0 && (
                    <div className="card p-4">
                      <h4 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3">
                        🖼️ Live Browsers ({farmStatus?.pool?.active ?? 0})
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {screenshots.map((ss, i) => (
                          <div key={ss.proxy + i} className="rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800">
                            <img
                              src={`data:image/jpeg;base64,${ss.screenshot}`}
                              alt={ss.proxy}
                              className="w-full h-28 object-cover"
                            />
                            <div className="px-2 py-1.5">
                              <div className="text-[10px] text-neutral-500 truncate font-mono">{ss.proxy}</div>
                              <div className="flex items-center justify-between mt-0.5">
                                <span className="text-[9px] text-neutral-400">{ss.width}x{ss.height}</span>
                                <span className="text-[9px] text-neutral-400">{Math.floor(ss.age / 1000)}s</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between mt-3 px-2 py-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-[10px]">
                        <span className="text-neutral-600 dark:text-neutral-400">
                          <strong className="text-neutral-900 dark:text-white">{farmStatus.viewsSent}</strong> views
                        </span>
                        <span className="text-neutral-600 dark:text-neutral-400">
                          <strong className="text-emerald-600">{farmStatus.pool?.active ?? 0}</strong> active
                        </span>
                        <span className="text-neutral-600 dark:text-neutral-400">
                          <strong className="text-neutral-900 dark:text-white">{farmStatus.cycles}</strong> cycles
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="card p-4 text-center">
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-600 dark:text-primary-400 hover:underline">
                      Farm watching &rarr; {url}
                    </a>
                  </div>
                </>
              )}

              {/* Tab: Logs */}
              {activeTab === 'logs' && (
                <div className="card p-4">
                  <h4 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3">Live Activity</h4>
                  {activities.length > 0 ? (
                    <div className="max-h-[400px] overflow-y-auto space-y-0.5">
                      {activities.map(a => (
                        <div key={a.id} className="flex items-center gap-2 text-[11px] font-mono py-0.5">
                          <span className="text-neutral-400 shrink-0">[{a.time}]</span>
                          <span className={`shrink-0 ${
                            a.type === 'success' ? 'text-emerald-500' :
                            a.type === 'error' ? 'text-red-500' :
                            a.type === 'view' ? 'text-blue-500' :
                            'text-neutral-500'
                          }`}>
                            {a.type === 'success' ? '✓' : a.type === 'error' ? '✗' : a.type === 'view' ? '▸' : '·'}
                          </span>
                          <span className="text-neutral-600 dark:text-neutral-400">{a.text}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-400 text-center py-8">No activity yet. Launch a farm to see logs.</p>
                  )}
                </div>
              )}

              {/* Tab: Proxies */}
              {activeTab === 'proxies' && (
                <div className="card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Proxy Manager</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-neutral-500">{proxyBankSize} proxies</span>
                      <button
                        onClick={autoFetchAndVerify}
                        disabled={fetchingProxy || testingProxies}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                      >
                        {fetchingProxy || testingProxies ? (
                          <><RefreshCw className="w-3 h-3 inline animate-spin mr-1" />{fetchingProxy ? 'Fetching...' : 'Testing...'}</>
                        ) : (
                          <><Zap className="w-3 h-3 inline mr-1" />Auto Fetch & Verify</>
                        )}
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={proxyListText}
                    onChange={e => setProxyListText(e.target.value)}
                    placeholder={`123.45.67.89:1080:user1:pass1\n98.76.54.32:1080:user2:pass2`}
                    rows={6}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder-neutral-400 font-mono resize-none"
                  />
                  {proxyTestResults && (
                    <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
                      <div className="max-h-32 overflow-y-auto text-[11px] font-mono">
                        {proxyTestResults.map((r, i) => (
                          <div key={i} className={`flex items-center justify-between px-2 py-1 ${r.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'} ${i % 2 === 0 ? 'bg-neutral-50 dark:bg-neutral-900' : ''}`}>
                            <span className="truncate max-w-[180px]">{r.proxy}</span>
                            <span className="shrink-0 ml-2">
                              {r.ok ? `${r.latency}ms${r.ip ? ` • ${r.ip}` : ''}` : r.error || 'Dead'}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between px-2 py-1.5 bg-neutral-100 dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700">
                        <span className="text-[11px] text-neutral-500">
                          {proxyTestResults.filter(r => r.ok).length}/{proxyTestResults.length} alive
                        </span>
                        <button
                          onClick={removeDeadProxies}
                          className="text-[11px] text-red-500 hover:text-red-700 font-semibold cursor-pointer"
                        >
                          Remove Dead
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setAutoFetchProxy(!autoFetchProxy)}
                        className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0 ${
                          autoFetchProxy ? 'bg-emerald-600' : 'bg-neutral-300 dark:bg-neutral-700'
                        }`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                          autoFetchProxy ? 'translate-x-4' : 'translate-x-0'
                        }`} />
                      </button>
                      <span className="text-[11px] text-neutral-500">
                        {autoFetchProxy ? 'IP protection ON' : 'IP protection OFF'}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400">
                      {autoFetchProxy ? 'Auto-fetches free proxies if empty' : 'Real IP visible'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <Target className="w-16 h-16 text-neutral-300 dark:text-neutral-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-neutral-700 dark:text-neutral-300 mb-3">View Farm</h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed mb-6">
                  Enter a URL and proxies, then click Launch. Desktop Mode runs a headless
                  farm — screenshots appear in the UI, no browser windows.
                </p>
                <div className="grid grid-cols-2 gap-3 text-left text-xs">
                  <div className="card p-3">
                    <span className="font-semibold text-neutral-900 dark:text-white">🖥️ Desktop Mode</span>
                    <p className="text-neutral-500 mt-1">Headless Puppeteer farm. Screenshots in UI. Proxy rotation, anti-detection.</p>
                  </div>
                  <div className="card p-3">
                    <span className="font-semibold text-neutral-900 dark:text-white">🖥️ Random Viewport</span>
                    <p className="text-neutral-500 mt-1">                    Random viewport sizes. Each session looks like a different device.</p>
                  </div>
                  <div className="card p-3">
                    <span className="font-semibold text-neutral-900 dark:text-white">🔄 Auto-Cycle</span>
                    <p className="text-neutral-500 mt-1">Sessions cycle with random durations for natural traffic patterns.</p>
                  </div>
                  <div className="card p-3">
                    <span className="font-semibold text-neutral-900 dark:text-white">⏱️ Staggered Launch</span>
                    <p className="text-neutral-500 mt-1">Random delays between launches for natural traffic patterns.</p>
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
