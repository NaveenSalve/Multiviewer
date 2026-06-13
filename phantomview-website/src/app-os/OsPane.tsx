import { useRef, useState, useCallback } from 'react';
import {
  Monitor, Terminal, ChartLine, Globe, Video,
  Shield, ShieldOff, X, AlertTriangle,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import {
  getIsolatedIframeSrcdoc,
  buildProxyUrl,
  injectPrivacyScripts,
  parseProxy,
} from '../utils/proxyUtils';

interface OsPaneProps {
  id: string;
  title: string;
  type: string;
  url?: string;
  muted?: boolean;
  proxy?: string;
  onRemove?: (id: string) => void;
  bare?: boolean;
}

export function OsPane({ id, title, type, url: propUrl, muted: propMuted, proxy: propProxy, onRemove, bare }: OsPaneProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loadError, setLoadError] = useState(false);

  const store = useAppStore();
  const session = store.osSessions.find(s => s.id === id);
  const url = propUrl ?? session?.url ?? '';
  const proxy = propProxy ?? session?.proxy ?? 'Direct';
  const muted = propMuted ?? session?.muted ?? true;
  const corsEnabled = store.corsProxyEnabled;

  const isDirect = proxy === 'Direct' || proxy.includes('Direct');
  const isProxied = !isDirect;

  const typeIcon = (
    type === 'trading' || type === 'tradingview' ? ChartLine :
    type === 'terminal' ? Terminal :
    type === 'browser' ? Globe :
    type === 'video' || type === 'youtube' || type === 'lofi' ? Video :
    Monitor
  );
  const Icon = typeIcon;

  const handleLoad = useCallback(() => {
    setLoadError(false);
    if (iframeRef.current) {
      injectPrivacyScripts(iframeRef.current);
      // Detect if blocked (empty body with X-Frame-Options)
      try {
        const doc = iframeRef.current.contentDocument;
        if (doc && doc.body && doc.body.innerHTML.trim() === '' && !doc.querySelector('iframe')) {
          // Page loaded but could be blocked — let it show
        }
      } catch {
        // cross-origin — expected for real pages
      }
    }
  }, []);

  const handleError = useCallback(() => {
    setLoadError(true);
  }, []);

  const iframeSrc = useCallback(() => {
    if (!url) return undefined;
    if (type === 'tradingview') return undefined;
    if (type === 'youtube' || type === 'lofi') {
      return `https://www.youtube-nocookie.com/embed/${url}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0`;
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
      if (corsEnabled && isProxied) {
        const parsedUserProxy = proxy ? parseProxy(proxy) : null;
        return buildProxyUrl(url, parsedUserProxy);
      }
      return url;
    }
    return undefined;
  }, [url, type, corsEnabled, isProxied, proxy]);

  const src = iframeSrc();
  const srcDoc = (!isProxied && url)
    ? getIsolatedIframeSrcdoc(url)
    : undefined;

  const iframeProps = {
    ref: iframeRef,
    className: 'absolute inset-0 w-full h-full',
    sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups',
    referrerPolicy: 'no-referrer' as const,
    loading: 'lazy' as const,
    onLoad: handleLoad,
    onError: handleError,
    allow: 'autoplay; encrypted-media',
    title: title,
  };

  if (bare) {
    return (
      <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
        {url && !loadError ? (
          <iframe
            {...iframeProps}
            src={src}
            srcDoc={srcDoc}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-900">
            <div className="text-center">
              <Icon className="w-6 h-6 text-neutral-600 mx-auto mb-2" />
              <p className="text-xs text-neutral-500">{loadError ? 'Blocked' : title}</p>
            </div>
          </div>
        )}
        {isProxied && (
          <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-900/70 text-emerald-400 border border-emerald-700/50">
            PROXY
          </span>
        )}
        {muted && (
          <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-neutral-900/70 text-neutral-400">
            MUTED
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400 truncate">{title}</span>
          {isProxied ? (
            <Shield className="w-3 h-3 text-emerald-500 shrink-0" aria-label="Protected via proxy" />
          ) : (
            <ShieldOff className="w-3 h-3 text-amber-500 shrink-0" aria-label="Direct connection" />
          )}
        </div>
        <div className="flex items-center gap-1">
          {muted && <span className="text-[10px] font-mono text-neutral-400">MUTED</span>}
          {onRemove && (
            <button onClick={() => onRemove(id)} className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 cursor-pointer" aria-label="Close">
              <X className="w-3 h-3 text-neutral-400 hover:text-red-500" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 relative bg-neutral-100 dark:bg-neutral-800 min-h-[150px]">
        {src && !loadError ? (
          <iframe
            {...iframeProps}
            src={src}
            srcDoc={srcDoc}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center max-w-[200px]">
              {loadError ? (
                <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto mb-2" />
              ) : (
                <Icon className="w-8 h-8 text-neutral-300 dark:text-neutral-600 mx-auto mb-2" />
              )}
              <p className="text-xs text-neutral-400 dark:text-neutral-500">
                {type === 'tradingview' ? 'TradingView Widget' : loadError ? 'Blocked (X-Frame-Options)' : 'No URL'}
              </p>
              {loadError && isProxied && (
                <p className="text-[10px] text-neutral-500 mt-1">Try disabling CORS proxy</p>
              )}
              {loadError && !isProxied && (
                <p className="text-[10px] text-neutral-500 mt-1">Site blocks embedding</p>
              )}
            </div>
          </div>
        )}

        {isProxied && (
          <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-900/80 text-emerald-400 border border-emerald-700/50 backdrop-blur-sm">
            {proxy}
          </span>
        )}
        {isDirect && url && (
          <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded text-[10px] font-mono bg-amber-900/80 text-amber-400 border border-amber-700/50 backdrop-blur-sm">
            DIRECT — IP visible
          </span>
        )}
        {muted && (
          <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded text-[10px] font-mono bg-neutral-900/70 text-neutral-400">
            MUTED
          </span>
        )}
      </div>
    </div>
  );
}
