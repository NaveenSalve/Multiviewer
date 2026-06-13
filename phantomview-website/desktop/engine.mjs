import puppeteer from 'puppeteer-core';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const VIEWPORT_SIZES = [
  { width: 1280, height: 720 }, { width: 1280, height: 800 },
  { width: 1360, height: 768 }, { width: 1366, height: 768 },
];
const EDGE_PATHS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];
const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function getViewDuration(fastMode, url) {
  if (!url) return fastMode ? randomBetween(5000, 10000) : randomBetween(20000, 30000);
  const u = url.toLowerCase();
  const isVideo = /youtube|youtu\.be|vimeo|twitch|tiktok|dailymotion|netflix|hulu/.test(u);
  const isSocial = /instagram|twitter|x\.com|pinterest|imgur|flickr|reddit|tumblr/.test(u);
  const isArticle = /medium|blog|news|article|wikipedia|docs\.google/.test(u);
  if (isVideo) return fastMode ? randomBetween(8000, 15000) : randomBetween(25000, 45000);
  if (isSocial) return fastMode ? randomBetween(2000, 5000) : randomBetween(8000, 15000);
  if (isArticle) return fastMode ? randomBetween(4000, 8000) : randomBetween(15000, 25000);
  return fastMode ? randomBetween(5000, 10000) : randomBetween(20000, 30000);
}

function findBrowser() {
  for (const p of EDGE_PATHS) {
    if (fs.existsSync(p)) return { path: p, type: 'edge' };
  }
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) return { path: p, type: 'chrome' };
  }
  return null;
}

export class FarmEngine {
  constructor() {
    this.running = false;
    this.paused = false;
    this.currentIndex = 0;
    this.proxies = [];
    this.url = '';
    this.stats = { viewsSent: 0, cycles: 0, startedAt: null, activeView: false };
    this._onEvent = null;
    this._profilePrefix = path.join(os.tmpdir(), 'phantomview-session');
    this.headless = true;
    this.allowDirect = false;
    this.concurrency = 10;
    this.fastMode = true;
    this.viewsPerBrowser = 50;
    this._browserPool = [];
    this._activeViews = [];
    this._browserLaunchCounter = 0;
    this._proxyPollInterval = null;
    this._bankUrl = 'http://localhost:3456';
  }

  onEvent(cb) {
    this._onEvent = cb;
  }

  _emit(name, data) {
    if (this._onEvent) this._onEvent({ name, ...data, stats: { ...this.stats } });
  }

  getScreenshots() {
    return this._browserPool
      .filter(e => e.screenshot)
      .map(e => ({
        id: e.proxyLabel || 'direct',
        proxy: e.proxyLabel || 'direct',
        screenshot: e.screenshot,
        width: e.page?.viewport()?.width || 0,
        height: e.page?.viewport()?.height || 0,
        viewsDone: e.viewsDone,
        busy: e.busy,
        age: Date.now() - (e.screenshotAt || Date.now()),
      }));
  }

  getStatus() {
    const poolActive = this._browserPool.filter(e => e.busy).length;
    const poolIdle = this._browserPool.filter(e => !e.busy).length;
    const poolViewsDone = this._browserPool.reduce((s, e) => s + e.viewsDone, 0);
    return {
      running: this.running,
      paused: this.paused,
      proxyCount: this.proxies.length,
      currentIndex: this.currentIndex,
      ...this.stats,
      pool: {
        size: this._browserPool.length,
        active: poolActive,
        idle: poolIdle,
        totalViewsDone: poolViewsDone,
        viewsPerBrowser: this.viewsPerBrowser,
        headless: this.headless,
        fastMode: this.fastMode,
      },
    };
  }

  setProxies(list) {
    this.proxies = list;
  }

  async fetchFromProxyBank() {
    try {
      const r = await fetch('http://localhost:3456/proxy-bank/pool?n=10', { signal: AbortSignal.timeout(5000) });
      const d = await r.json();
      if (d.ok && d.proxies.length > 0) {
        const parsed = d.proxies.map(p => {
          const parts = p.split(':');
          return { host: parts[0], port: parseInt(parts[1]), type: 'http', user: '', pass: '' };
        }).filter(p => p.host && p.port);
        if (parsed.length > 0) {
          this.proxies = parsed;
          console.log(`[FarmEngine] Fetched ${parsed.length} proxies from bank`);
          return true;
        }
      }
    } catch (err) {
      console.log(`[FarmEngine] Proxy bank fetch failed: ${err.message}`);
    }
    return false;
  }

  // Poll proxy bank every 1s — adds to pool as they come
  async _pollProxyBank() {
    while (this.running) {
      try {
        const r = await fetch(`${this._bankUrl}/proxy-bank/next`, { signal: AbortSignal.timeout(2000) });
        const d = await r.json();
        if (d.ok && d.proxy) {
          const parts = d.proxy.split(':');
          const pObj = { host: parts[0], port: parseInt(parts[1]), type: 'http', user: '', pass: '', label: `${parts[0]}:${parseInt(parts[1])}` };
          if (!this.proxies.find(p => p.host === pObj.host && p.port === pObj.port)) {
            this.proxies.push(pObj);
          }
        }
      } catch (e) { console.error(`[FarmEngine] Proxy poll error: ${e.message}`); }
      await delay(1000);
    }
  }

  // Grab a proxy from the pool (block until one available)
  async _waitForProxy(timeout = 120000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (!this.running) return null;
      if (this.proxies.length > 0) {
        const idx = this.currentIndex++ % this.proxies.length;
        return this.proxies[idx];
      }
      await delay(500);
    }
    return null;
  }

  async start(targetUrl) {
    const browserInfo = findBrowser();
    if (!browserInfo) {
      throw new Error('No Edge/Chrome found. Install Microsoft Edge or Google Chrome.');
    }

    await this._clearPool();
    this.running = true;
    this.paused = false;
    this.url = targetUrl;
    this.stats.startedAt = Date.now();
    this.currentIndex = 0;

    this._emit('start', { browser: browserInfo.type });

    // A1: User provided proxies (via setProxies) — use them directly
    if (this.proxies.length > 0) {
      console.log(`[FarmEngine] Using ${this.proxies.length} user-provided proxies`);
    } else {
      // 1. Try to fetch existing proxies from bank first
      console.log('[FarmEngine] Checking proxy bank for existing proxies...');
      let hasProxies = await this.fetchFromProxyBank();

      // 2. If no proxies, trigger harvest and WAIT for it
      if (!hasProxies) {
        console.log('[FarmEngine] No proxies in bank, running harvest (may take 2-5 min)...');
        try {
          const r = await fetch(`${this._bankUrl}/proxy-engine/harvest`, { signal: AbortSignal.timeout(300000) });
          const data = await r.json();
          console.log(`[FarmEngine] Harvest complete: ${data.alive || 0} live proxies found`);
          hasProxies = await this.fetchFromProxyBank();
        } catch (e) {
          console.error(`[FarmEngine] Harvest failed: ${e.message}`);
        }
      } else {
        console.log(`[FarmEngine] Using ${this.proxies.length} existing proxies from bank`);
      }
    }

    // 3. Start polling bank every 1s for new proxies
    this._proxyPollInterval = setInterval(() => this._pollProxyBank(), 1000);

    this._activeViews = [];

    const worker = async () => {
      while (this.running) {
        while (this.paused && this.running) {
          await delay(500);
        }
        if (!this.running) break;

        const proxy = await this._waitForProxy();
        if (!proxy) continue;

        try {
          const proxyLabel = proxy.label;
          await this._launchView(targetUrl, proxy, browserInfo.path);
          this.stats.viewsSent++;
          this._emit('view', { proxy: proxyLabel, index: this.stats.viewsSent });
        } catch (err) {
          this.proxies = this.proxies.filter(p => p.host !== proxy?.host || p.port !== proxy?.port);
          this._emit('error', { proxy: proxy?.label || 'unknown', error: String(err) });
        }
        this.stats.cycles++;
      }
    };

    const maxConcurrent = Math.max(1, Math.min(this.concurrency, 10));
    const workers = [];
    for (let i = 0; i < maxConcurrent; i++) {
      workers.push(worker());
    }
    await Promise.all(workers);

    await this._clearPool();
    if (this._proxyPollInterval) { clearInterval(this._proxyPollInterval); this._proxyPollInterval = null; }
    this.running = false;
    this._emit('stop', {});
  }

  stop() {
    this.running = false;
    if (this._proxyPollInterval) { clearInterval(this._proxyPollInterval); this._proxyPollInterval = null; }
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }

  async _getPooledBrowser(proxy, execPath) {
    const proxyLabel = proxy ? `${proxy.host}:${proxy.port}` : 'direct';
    for (const entry of this._browserPool) {
      if (entry.proxyLabel === proxyLabel && entry.viewsDone < this.viewsPerBrowser && !entry.busy) {
        return entry;
      }
    }
    if (this._browserPool.length >= 15) {
      const oldest = this._browserPool.reduce((a, b) => a.viewsDone < b.viewsDone ? a : b);
      if (oldest.viewsDone >= this.viewsPerBrowser) {
        await this._recycleBrowser(oldest);
      } else {
        throw new Error('Pool full, no browser available');
      }
    }
    const entry = await this._createBrowser(proxy, execPath);
    entry.proxyLabel = proxyLabel;
    this._browserPool.push(entry);
    return entry;
  }

  async _createBrowser(proxy, execPath) {
    const profileDir = `${this._profilePrefix}-${Date.now()}-${this._browserLaunchCounter++}`;
    // Clean up any leftover profile dir from previous run
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) { console.error(`[FarmEngine] Cleanup profile error: ${e.message}`); }
    const browserArgs = [
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-sync',
      '--disable-extensions',
      '--disable-webrtc',
      '--enforce-webrtc-permission-check',
      '--disable-background-networking',
      '--proxy-bypass-list=<-loopback>',
      '--disable-features=UseDnsHttpsSvcb,WebRtcRemoteEventLog',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-breakpad',
      '--disable-client-side-phishing-detection',
      '--disable-component-update',
      '--disable-default-apps',
      '--disable-dev-shm-usage',
      '--disable-features=TranslateUI',
      '--disable-hang-monitor',
      '--disable-ipc-flooding-protection',
      '--disable-popup-blocking',
      '--disable-prompt-on-repost',
      '--disable-renderer-backgrounding',
      '--disable-speech-api',
      '--discard-yield-to-tasks',
      '--no-crash-upload',
      '--no-pings',
      '--disable-gpu',
      '--disable-accelerated-video-decode',
      '--disable-accelerated-video-encode',
      '--disable-accelerated-2d-canvas',
      '--disable-features=VizDisplayCompositor',
      '--disable-features=CanvasOopRasterization',
      '--force-device-scale-factor=1',
      `--user-data-dir=${profileDir}`,
    ];

    if (proxy) {
      const proxyProto = proxy.type === 'socks5' ? 'socks5' : 'http';
      browserArgs.push(`--proxy-server=${proxyProto}://${proxy.host}:${proxy.port}`);
      if (proxy.type === 'socks5') {
        browserArgs.push('--proxy-dns');
      }
    }

    const browser = await puppeteer.launch({
      executablePath: execPath,
      headless: this.headless,
      args: browserArgs,
      defaultViewport: null,
      ignoreDefaultArgs: ['--enable-automation'],
      timeout: 25000,
    });

    const page = await browser.newPage();

    if (proxy?.user) {
      await page.authenticate({ username: proxy.user, password: proxy.pass });
    }

    const vp = VIEWPORT_SIZES[Math.floor(Math.random() * VIEWPORT_SIZES.length)];
    await page.setViewport(vp);

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
          { name: 'Native Client', filename: 'internal-nacl-plugin' }
        ]
      });
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => [2, 4, 8][Math.floor(Math.random() * 3)] });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => [4, 8][Math.floor(Math.random() * 2)] });
      const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
      CanvasRenderingContext2D.prototype.getImageData = function (...args) {
        const imageData = originalGetImageData.apply(this, args);
        const noise = () => Math.floor(Math.random() * 4 - 2);
        for (let i = 3; i < imageData.data.length; i += 4) {
          imageData.data[i] = Math.min(255, Math.max(0, imageData.data[i] + noise()));
        }
        return imageData;
      };
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function (param) {
        if (param === 37445) return 'Intel Inc.';
        if (param === 37446) return 'Intel Iris OpenGL Engine';
        return getParameter.call(this, param);
      };
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
    });

    return { browser, page, viewsDone: 0, profileDir, busy: false, proxy, screenshot: null, screenshotAt: 0 };
  }

  async _recycleBrowser(entry) {
    try {
      const pid = entry.browser?.process()?.pid;
      await entry.browser.close();
      // Force-kill orphan child processes on Windows
      if (pid) {
        try { execSync(`taskkill /F /T /PID ${pid} 2>nul`, { stdio: 'ignore' }); } catch (e) { console.error(`[FarmEngine] Recycle taskkill error: ${e.message}`); }
      }
    } catch (e) { console.error(`[FarmEngine] Recycle browser close error: ${e.message}`); }
    try { fs.rmSync(entry.profileDir, { recursive: true, force: true }); } catch (e) { console.error(`[FarmEngine] Recycle profile cleanup error: ${e.message}`); }
    const idx = this._browserPool.indexOf(entry);
    if (idx >= 0) this._browserPool.splice(idx, 1);
  }

  async _clearPool() {
    for (const entry of this._browserPool) {
      try {
        const pid = entry.browser?.process()?.pid;
        await entry.browser.close();
        if (pid) {
          try { execSync(`taskkill /F /T /PID ${pid} 2>nul`, { stdio: 'ignore' }); } catch (e) { console.error(`[FarmEngine] ClearPool taskkill error: ${e.message}`); }
        }
      } catch (e) { console.error(`[FarmEngine] ClearPool browser close error: ${e.message}`); }
      try { fs.rmSync(entry.profileDir, { recursive: true, force: true }); } catch (e) { console.error(`[FarmEngine] ClearPool profile cleanup error: ${e.message}`); }
    }
    this._browserPool = [];
  }

  async _closeOverlays(page) {
    try {
      await page.evaluate(() => {
        const selectors = [
          'button[aria-label="Close"]',
          'button[aria-label="close"]',
          'button[aria-label="Dismiss"]',
          'button[aria-label="dismiss"]',
          'button[aria-label="×"]',
          '[class*="close"]',
          '[class*="dismiss"]',
          '[class*="modal"] button',
          '[class*="overlay"] button',
          '[class*="popup"] button',
          '[class*="cookie"] button',
          '[id*="close"]',
          '[data-testid*="close"]',
          '[data-testid*="Close"]',
          '[data-dismiss]',
          '.modal-close',
          '.close-button',
          '.btn-close',
          '.dismiss-button',
          'button:has(svg)',
          // LinkedIn-specific
          'button[data-tracking-control-name*="guest-modal"]',
          '.sign-in-modal button[aria-label="Dismiss"]',
          '.auth-wall button[aria-label="Dismiss"]',
          'button[aria-label="Dismiss sign-in modal"]',
        ];
        for (const sel of selectors) {
          try {
            const els = document.querySelectorAll(sel);
            for (const el of els) {
              if (el.offsetParent !== null) {
                el.click();
              }
            }
          } catch (e) { console.error(`[FarmEngine] Overlay click error: ${e.message}`); }
        }
      });
    } catch (e) { console.error(`[FarmEngine] Close overlays evaluate error: ${e.message}`); }
  }

  async _launchView(url, proxy, execPath) {
    const poolEntry = await this._getPooledBrowser(proxy, execPath);

    if (!poolEntry) {
      throw new Error('Failed to allocate browser from pool');
    }

    poolEntry.busy = true;

    try {
      const vp = VIEWPORT_SIZES[Math.floor(Math.random() * VIEWPORT_SIZES.length)];
      await poolEntry.page.setViewport(vp);

      this.stats.activeView = true;

      await poolEntry.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      await delay(randomBetween(500, 1500));
      await this._closeOverlays(poolEntry.page);

      // Capture screenshot for UI preview
      try {
        poolEntry.screenshot = await poolEntry.page.screenshot({ type: 'jpeg', quality: 30, encoding: 'base64' });
        poolEntry.screenshotAt = Date.now();
      } catch (e) { console.error(`[FarmEngine] Screenshot error: ${e.message}`); poolEntry.screenshot = null; }

      const watchTime = getViewDuration(this.fastMode, url);
      const startTime = Date.now();
      let lastHealthCheck = 0;
      let failCount = 0;

      while (Date.now() - startTime < watchTime && this.running) {
        await delay(randomBetween(3000, 8000));

        // Proxy health check every 10s
        if (Date.now() - lastHealthCheck > 10000) {
          lastHealthCheck = Date.now();
          const alive = await poolEntry.page.evaluate(() =>
            fetch('http://checkip.amazonaws.com', { mode: 'no-cors' }).then(r => true).catch(() => false)
          ).catch(() => false);
          if (alive) {
            failCount = 0;
          } else {
            failCount++;
            if (failCount >= 2) throw new Error('Proxy died during view');
          }
        }

        try {
          await poolEntry.page.evaluate(() => {
            window.scrollTo({ top: Math.floor(Math.random() * 500), behavior: 'smooth' });
          });
          } catch (e) { console.error(`[FarmEngine] Scroll error: ${e.message}`); }
      }

      poolEntry.viewsDone++;
      this.stats.activeView = false;

      if (poolEntry.viewsDone >= this.viewsPerBrowser) {
        await this._recycleBrowser(poolEntry);
      }
    } finally {
      poolEntry.busy = false;
    }
  }
}
