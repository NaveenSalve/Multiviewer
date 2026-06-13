import { create } from 'zustand';
import { getRandomCorsProxy } from '../utils/proxyUtils';

const getCorsProxy = () => getRandomCorsProxy().url;

export type PresetType = 'study' | 'creator' | 'monitoring' | 'trading' | 'research';
export type OverlayModeType = 'floating' | 'alwaysOnTop' | 'transparent' | 'clickThrough';
export type VideoMatrixModeType = '4' | '9' | '16' | '25';

export type SessionType = 'youtube' | 'tradingview' | 'terminal' | 'lofi' | 'crypto-ticker' | 'news' | 'wikipedia' | 'video' | 'browser';

export interface OsSession {
  id: string;
  title: string;
  type: SessionType;
  url: string;
  proxy: string;
  muted: boolean;
  quality: '1080p' | '720p' | '480p';
  partition?: string;
  proxyIndex?: number;
  /** Actual CORS proxy URL being used */
  corsProxyUrl?: string;
}

const PROXY_POOL = [
  'SOCKS5: Tokyo #1', 'SOCKS5: Tokyo #2', 'SOCKS5: Tokyo #3', 'SOCKS5: Tokyo #4',
  'SOCKS5: Zurich Core', 'SOCKS5: Zurich Backup', 'SOCKS5: Frankfurt Node',
  'SOCKS5: Singapore Relay', 'SOCKS5: Reykjavik (Hermetic)',
  'SOCKS5: New York POP', 'SOCKS5: London Gateway', 'SOCKS5: Mumbai Edge',
  'SOCKS5: Sao Paulo Exit', 'SOCKS5: Sydney Relay', 'SOCKS5: Dubai Tunnel',
  'SOCKS5: Seoul Gateway', 'SOCKS5: Stockholm Node',
  'DoH Secure Isolated', 'DoH DNS-over-HTTPS',
  'Direct ISP Connection', 'Direct (High Bandwidth)'
];

interface AppState {
  activePreset: PresetType;
  setActivePreset: (preset: PresetType) => void;
  overlayMode: OverlayModeType;
  setOverlayMode: (mode: OverlayModeType) => void;
  resourceAiActive: boolean;
  setResourceAiActive: (active: boolean) => void;
  videoMatrixMode: VideoMatrixModeType;
  setVideoMatrixMode: (mode: VideoMatrixModeType) => void;
  isMobile: boolean;
  setIsMobile: (mobile: boolean) => void;

  // CORS Proxy
  corsProxyUrl: string;
  setCorsProxyUrl: (url: string) => void;
  corsProxyEnabled: boolean;
  setCorsProxyEnabled: (enabled: boolean) => void;

  // WebRTC Leak Protection
  webrtcProtection: boolean;
  setWebrtcProtection: (on: boolean) => void;

  // Working Sessions
  osSessions: OsSession[];
  osLayout: 'grid-1' | 'grid-4' | 'grid-9' | 'dynamic';
  gridCount: number;
  proxyList: string[];
  setGridCount: (count: number) => void;
  setProxyList: (proxies: string[]) => void;
  setOsLayout: (layout: 'grid-1' | 'grid-4' | 'grid-9' | 'dynamic') => void;
  addOsSession: (session: Omit<OsSession, 'id'>) => void;
  launchMultiVideo: (url: string, count?: number) => void;
  removeOsSession: (id: string) => void;
  updateOsSession: (id: string, updates: Partial<OsSession>) => void;
  refreshSession: (id: string) => void;
  cycleProxy: (id: string) => void;
  loadOsPreset: (preset: PresetType) => void;

  // Mission Control v2.4 — mass tab launcher
  missionTabs: OsSession[];
  missionProxyList: string[];
  setMissionProxies: (proxies: string[]) => void;
  addMissionTab: (session: Omit<OsSession, 'id'>) => void;
  launchMissionTabs: (url: string, count: number, quality: '1080p' | '720p' | '480p', proxyList?: string[]) => void;
  removeMissionTab: (id: string) => void;
  clearMissionTabs: () => void;

  // Security Logs
  securityLogs: string[];
  addSecurityLog: (log: string) => void;
}

const DEFAULT_SESSIONS: OsSession[] = [
  { id: 's-1', title: 'TradingView Perpetual — BTC/USDT', type: 'tradingview', url: 'BINANCE:BTCUSDT', proxy: 'SOCKS5: Zurich Core', muted: true, quality: '1080p' },
  { id: 's-2', title: 'Lofi Girl 4K — 24/7 Focus Stream', type: 'lofi', url: 'jfKfPfyJRdk', proxy: 'Direct (High Bandwidth)', muted: true, quality: '1080p' },
  { id: 's-3', title: 'Cyber Ops Security Shell', type: 'terminal', url: '', proxy: 'SOCKS5: Tokyo #2', muted: true, quality: '1080p' },
  { id: 's-4', title: 'Live Crypto & Market Ticker', type: 'crypto-ticker', url: '', proxy: 'DoH Secure Isolated', muted: true, quality: '1080p' },
];

const now = () => new Date().toLocaleTimeString();

// Progressive quality management: auto-downgrades as session count grows
function getAutoQuality(sessionCount: number, resourceAiActive: boolean, baseQuality?: '1080p' | '720p' | '480p'): '1080p' | '720p' | '480p' {
  if (!resourceAiActive) return baseQuality || '1080p';
  if (sessionCount <= 6) return '1080p';
  if (sessionCount <= 20) return '720p';
  return '480p';
}

export const useAppStore = create<AppState>((set) => ({
  activePreset: 'creator',
  setActivePreset: (activePreset) => set({ activePreset }),
  overlayMode: 'alwaysOnTop',
  setOverlayMode: (overlayMode) => set({ overlayMode }),
  resourceAiActive: true,
  setResourceAiActive: (resourceAiActive) => {
    set((state) => {
      const autoQuality = getAutoQuality(state.osSessions.length, resourceAiActive);
      return {
        resourceAiActive,
        securityLogs: [
          `[${now()}] Neural Resource AI ${resourceAiActive ? 'ENGAGED' : 'DISABLED'} — quality: ${autoQuality}`,
          ...state.securityLogs,
        ],
        osSessions: state.osSessions.map(s => ({
          ...s,
          quality: resourceAiActive ? autoQuality as '1080p' | '720p' | '480p' : (s.quality || '1080p') as '1080p' | '720p' | '480p',
        }))
      };
    });
  },
  videoMatrixMode: '9',
  setVideoMatrixMode: (videoMatrixMode) => set({ videoMatrixMode }),
  isMobile: false,
  setIsMobile: (isMobile) => set({ isMobile }),
  corsProxyUrl: 'https://corsproxy.io/?',
  setCorsProxyUrl: (corsProxyUrl) => set({ corsProxyUrl }),
  corsProxyEnabled: true,
  setCorsProxyEnabled: (corsProxyEnabled) => set({ corsProxyEnabled }),
  webrtcProtection: true,
  setWebrtcProtection: (webrtcProtection) => set({ webrtcProtection: webrtcProtection }),

  osSessions: DEFAULT_SESSIONS.map((s, i) => ({
    ...s,
    partition: `persist:tab-${i}`,
    corsProxyUrl: getCorsProxy(),
  })),
  osLayout: 'grid-4',
  gridCount: 4,
  proxyList: [],
  setProxyList: (proxyList) => set({ proxyList }),
  setGridCount: (count) => set((state) => {
    const currentSessions = state.osSessions;
    let newSessions = [...currentSessions];

    if (count > currentSessions.length) {
      const diff = count - currentSessions.length;
      const autoQuality = getAutoQuality(count, state.resourceAiActive);
      const added = Array.from({ length: diff }).map((_, i) => {
        const index = currentSessions.length + i;
        return {
          id: `s-${Date.now()}-${index}`,
          title: `Isolated Session #${index + 1}`,
          type: 'browser' as const,
          url: 'https://www.google.com',
          proxy: state.proxyList[index % (state.proxyList.length || 1)] || 'Direct',
          muted: true,
          quality: autoQuality,
          partition: `persist:tab-${index}-${Date.now()}`,
          corsProxyUrl: getCorsProxy(),
        };
      });
      newSessions = [...newSessions, ...added];
    } else if (count < currentSessions.length) {
      newSessions = newSessions.slice(0, count);
    }

    // Auto-tune quality for all sessions based on new count
    const autoQuality = getAutoQuality(newSessions.length, state.resourceAiActive);
    newSessions = newSessions.map(s => ({
      ...s,
      quality: state.resourceAiActive ? autoQuality as '1080p' | '720p' | '480p' : s.quality,
    }));

    return {
      gridCount: count,
      osSessions: newSessions,
      osLayout: 'dynamic',
      securityLogs: [`[${now()}] Matrix Reconfigured: ${count} slots (quality: ${autoQuality})`, ...state.securityLogs]
    };
  }),
  setOsLayout: (osLayout) => set({ osLayout }),
  addOsSession: (newSession) => set((state) => {
    const newCount = state.osSessions.length + 1;
    const autoQuality = getAutoQuality(newCount, state.resourceAiActive);
    return {
      osSessions: [...state.osSessions.map(s => ({
        ...s,
        quality: state.resourceAiActive ? autoQuality as '1080p' | '720p' | '480p' : s.quality,
      })), {
        ...newSession,
        id: `s-${Date.now()}`,
        quality: newSession.quality || autoQuality,
        partition: `persist:tab-${Date.now()}`,
        corsProxyUrl: getCorsProxy(),
      }],
      securityLogs: [`[${now()}] Session Deployed: ${newSession.title} (${newSession.proxy}) — quality: ${autoQuality}`, ...state.securityLogs]
    };
  }),
  launchMultiVideo: (url, count = 4) => set((state) => {
    let type: SessionType = 'browser';
    let videoId = url;
    const youtubeRegexList = [
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&]+)/,
      /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([^?&]+)/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([^?&]+)/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^?&]+)/,
      /(?:https?:\/\/)?m\.youtube\.com\/watch\?v=([^&]+)/
    ];
    for (const regex of youtubeRegexList) {
      const match = url.match(regex);
      if (match && match[1]) { videoId = match[1]; type = 'youtube'; break; }
    }
    if (type === 'browser') {
      if (/\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(url)) type = 'video';
    }
    const autoQuality = getAutoQuality(count, state.resourceAiActive);
    const newSessions: OsSession[] = Array.from({ length: count }).map((_, i) => ({
      id: `v-${Date.now()}-${i}`,
      title: `Multi-Sync #${i + 1}`,
      type: type,
      url: videoId,
      proxy: 'Direct (Sync Optimized)',
      muted: i !== 0,
      quality: autoQuality,
      partition: `persist:tab-sync-${i}-${Date.now()}`,
      corsProxyUrl: getCorsProxy(),
    }));
    return {
      gridCount: count,
      osSessions: newSessions,
      osLayout: 'dynamic',
      securityLogs: [`[${now()}] Multi-Sync Deployed: ${count}x to ${url} (quality: ${autoQuality})`, ...state.securityLogs]
    };
  }),
  removeOsSession: (id) => set((state) => ({
    osSessions: state.osSessions.filter(s => s.id !== id),
    securityLogs: [`[${now()}] Session Terminated: ${id}`, ...state.securityLogs]
  })),
  updateOsSession: (id, updates) => set((state) => ({
    osSessions: state.osSessions.map(s => s.id === id ? { ...s, ...updates } : s)
  })),
  cycleProxy: (id) => set((state) => {
    const session = state.osSessions.find(s => s.id === id);
    if (!session) return state;
    const pool = state.proxyList.length > 0 ? state.proxyList : PROXY_POOL;
    const currentIndex = session.proxyIndex ?? Math.floor(Math.random() * pool.length);
    const nextIndex = (currentIndex + 1) % pool.length;
    const nextProxy = pool[nextIndex];
    return {
      osSessions: state.osSessions.map(s =>
        s.id === id
          ? { ...s, proxy: nextProxy, partition: `persist:tab-${id}-${Date.now()}`, proxyIndex: nextIndex, corsProxyUrl: getCorsProxy() }
          : s
      ),
      securityLogs: [`[${now()}] Session ${id} cycled to ${nextProxy}`, ...state.securityLogs]
    };
  }),
  refreshSession: (id) => set((state) => {
    const session = state.osSessions.find(s => s.id === id);
    if (!session) return state;
    const pool = state.proxyList.length > 0 ? state.proxyList : PROXY_POOL;
    const currentIndex = session.proxyIndex ?? Math.floor(Math.random() * pool.length);
    const nextIndex = (currentIndex + 1) % pool.length;
    const nextProxy = pool[nextIndex];
    return {
      osSessions: state.osSessions.map(s =>
        s.id === id
          ? { ...s, proxy: nextProxy, partition: `persist:tab-${id}-${Date.now()}`, proxyIndex: nextIndex, corsProxyUrl: getCorsProxy() }
          : s
      ),
      securityLogs: [`[${now()}] Session ${id} refreshed via ${nextProxy}`, ...state.securityLogs]
    };
  }),
  loadOsPreset: (preset) => {
    let sessions: OsSession[] = [];
    if (preset === 'trading') {
      sessions = [
        { id: 't-1', title: 'BTC/USDT', type: 'tradingview', url: 'BINANCE:BTCUSDT', proxy: 'SOCKS5: Zurich', muted: true, quality: '1080p' },
        { id: 't-2', title: 'SOL/USDT', type: 'tradingview', url: 'BINANCE:SOLUSDT', proxy: 'SOCKS5: Tokyo', muted: true, quality: '1080p' },
        { id: 't-3', title: 'ETH/USDT', type: 'tradingview', url: 'BINANCE:ETHUSDT', proxy: 'SOCKS5: Singapore', muted: true, quality: '1080p' },
        { id: 't-4', title: 'Crypto Ticker', type: 'crypto-ticker', url: '', proxy: 'DoH Secure', muted: true, quality: '1080p' },
      ];
    } else if (preset === 'creator') {
      sessions = [
        { id: 'c-1', title: 'Lo-Fi Visualizer', type: 'lofi', url: 'jfKfPfyJRdk', proxy: 'Direct', muted: true, quality: '1080p' },
        { id: 'c-2', title: 'Security Terminal', type: 'terminal', url: '', proxy: 'SOCKS5: Frankfurt', muted: true, quality: '1080p' },
        { id: 'c-3', title: 'Tech News', type: 'news', url: '', proxy: 'DoH Secure', muted: true, quality: '1080p' },
        { id: 'c-4', title: 'NASDAQ Analytics', type: 'tradingview', url: 'NASDAQ:GOOGL', proxy: 'Direct', muted: true, quality: '1080p' },
      ];
    } else if (preset === 'research') {
      sessions = [
        { id: 'r-1', title: 'Wikipedia Research', type: 'wikipedia', url: 'Cybernetics', proxy: 'SOCKS5: Reykjavik', muted: true, quality: '1080p' },
        { id: 'r-2', title: 'Python Terminal', type: 'terminal', url: '', proxy: 'SOCKS5: Zurich', muted: true, quality: '1080p' },
        { id: 'r-3', title: 'Focus Beats', type: 'lofi', url: 'jfKfPfyJRdk', proxy: 'Direct', muted: true, quality: '720p' },
        { id: 'r-4', title: 'Cyber Feed', type: 'news', url: '', proxy: 'SOCKS5: Geneva', muted: true, quality: '1080p' },
      ];
    } else if (preset === 'monitoring') {
      sessions = [
        { id: 'm-1', title: 'SecOps Terminal', type: 'terminal', url: '', proxy: 'SOCKS5: Military Grade', muted: true, quality: '1080p' },
        { id: 'm-2', title: 'Grafana Tickers', type: 'crypto-ticker', url: '', proxy: 'DoH Isolated', muted: true, quality: '1080p' },
        { id: 'm-3', title: 'Attack Ticker', type: 'news', url: '', proxy: 'SOCKS5: Tokyo', muted: true, quality: '1080p' },
        { id: 'm-4', title: 'BTC Liquidity Pool', type: 'tradingview', url: 'BINANCE:BTCUSDT', proxy: 'Direct', muted: true, quality: '1080p' },
      ];
    } else {
      sessions = [
        { id: 'st-1', title: 'Lofi Study Hub', type: 'lofi', url: 'jfKfPfyJRdk', proxy: 'Direct', muted: true, quality: '1080p' },
        { id: 'st-2', title: 'Encyclopedia', type: 'wikipedia', url: 'Artificial_intelligence', proxy: 'DoH Secure', muted: true, quality: '1080p' },
        { id: 'st-3', title: 'Python Sandbox', type: 'terminal', url: '', proxy: 'Local Kernel', muted: true, quality: '1080p' },
        { id: 'st-4', title: 'Tech News', type: 'news', url: '', proxy: 'Direct', muted: true, quality: '1080p' },
      ];
    }
    set((state) => {
      const autoQuality = getAutoQuality(sessions.length, state.resourceAiActive);
      return {
        activePreset: preset,
        osSessions: sessions.map(s => ({
          ...s,
          quality: state.resourceAiActive ? autoQuality as '1080p' | '720p' | '480p' : s.quality,
          corsProxyUrl: getCorsProxy(),
        })),
        securityLogs: [`[${now()}] Preset Loaded: ${preset.toUpperCase()} (quality: ${autoQuality})`, ...state.securityLogs],
      };
    });
  },

  // ── Mission Control v2.4 ──
  missionTabs: [],
  missionProxyList: [],
  setMissionProxies: (missionProxyList) => set({ missionProxyList }),
  addMissionTab: (session) => set((state) => ({
    missionTabs: [...state.missionTabs, {
      ...session,
      id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      partition: `persist:mission-${Date.now()}`,
      corsProxyUrl: getCorsProxy(),
    }],
  })),
  launchMissionTabs: (url, count, quality, proxyList) => set((state) => {
    const proxies = proxyList || state.missionProxyList || [];
    const newTabs: OsSession[] = Array.from({ length: count }).map((_, i) => {
      const proxy = proxies.length > 0
        ? proxies[i % proxies.length]
        : i % 3 === 0 ? 'SOCKS5: Zurich Core' : i % 3 === 1 ? 'SOCKS5: Tokyo #2' : 'DoH Secure Isolated';
      return {
        id: `m-${Date.now()}-${i}`,
        title: `Tab #${i + 1}`,
        type: 'browser',
        url: /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url) ? url : `https://${url}`,
        proxy,
        muted: true,
        quality: quality,
        partition: `persist:mission-${Date.now()}-${i}`,
        corsProxyUrl: getCorsProxy(),
      };
    });
    return {
      missionTabs: newTabs,
      missionProxyList: proxies,
      securityLogs: [
        `[${now()}] Mission Control: ${count} tabs launched → ${url}`,
        proxies.length > 0 ? `[${now()}] Proxy pool: ${proxies.length} endpoints — rotating per tab` : `[${now()}] No user proxies — using public CORS rotation`,
        ...state.securityLogs
      ]
    };
  }),
  removeMissionTab: (id) => set((state) => ({
    missionTabs: state.missionTabs.filter(t => t.id !== id),
  })),
  clearMissionTabs: () => set({ missionTabs: [] }),

  securityLogs: [
    `[${now()}] PhantomView OS v2.4 — Privacy Engine Active`,
    `[${now()}] WebRTC blocked, iframe sandbox enforced, CORS proxy enabled`,
    `[${now()}] All sessions partition-isolated. IP leak protection active.`,
  ],
  addSecurityLog: (log) => set((state) => ({
    securityLogs: [`[${now()}] ${log}`, ...state.securityLogs]
  })),
}));
