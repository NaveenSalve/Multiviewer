import puppeteer from 'puppeteer-core';
import os from 'os';
import fs from 'fs';
import path from 'path';

const VIEWPORT_SIZES = [
  { w: 1366, h: 768 }, { w: 1440, h: 900 }, { w: 1536, h: 864 },
  { w: 1600, h: 900 }, { w: 1280, h: 720 }, { w: 1920, h: 1080 },
  { w: 1360, h: 768 }, { w: 1400, h: 900 }, { w: 1680, h: 1050 },
  { w: 1280, h: 800 }, { w: 1440, h: 810 }, { w: 1600, h: 1000 },
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
  }

  onEvent(cb) {
    this._onEvent = cb;
  }

  _emit(name, data) {
    if (this._onEvent) this._onEvent({ name, ...data, stats: { ...this.stats } });
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

  async start(targetUrl) {
    const browserInfo = findBrowser();
    if (!browserInfo) {
      throw new Error('No Edge/Chrome found. Install Microsoft Edge or Google Chrome.');
    }
    if (!this.allowDirect && (!this.proxies || this.proxies.length === 0)) {
      throw new Error('No proxies configured. Set engine.allowDirect = true to allow direct connections, or provide proxies.');
    }

    this._clearPool();
    this.running = true;
    this.paused = false;
    this.url = targetUrl;
    this.stats.startedAt = Date.now();
    this.currentIndex = 0;

    this._emit('start', { browser: browserInfo.type });

    const maxConcurrent = Math.max(1, Math.min(this.concurrency, this.proxies.length || 1, 15));
    this._activeViews = [];

    const worker = async () => {
      while (this.running) {
        while (this.paused && this.running) {
          await delay(500);
        }
        if (!this.running) break;

        const idx = this.currentIndex++;
        const proxy = this.proxies.length > 0
          ? this.proxies[idx % this.proxies.length]
          : null;

        try {
          const viewPromise = this._launchView(targetUrl, proxy, browserInfo.path);
          this._activeViews.push(viewPromise);
          await viewPromise;
          this.stats.viewsSent++;
          this._emit('view', { proxy: proxy?.label || 'direct', index: idx + 1 });
        } catch (err) {
          this._emit('error', { proxy: proxy?.label || 'direct', error: err.message });
        }
        this.stats.cycles++;
      }
    };

    const workers = [];
    for (let i = 0; i < maxConcurrent; i++) {
      workers.push(worker());
    }
    await Promise.all(workers);

    this._clearPool();
    this._emit('stop', {});
  }

  stop() {
    this.running = false;
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
    const profileDir = `${this._profilePrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const browserArgs = [
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-sync',
      '--disable-extensions',
      '--disable-webrtc',
      '--enforce-webrtc-permission-check',
      '--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE localhost',
      '--disable-background-networking',
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
      `--user-data-dir=${profileDir}`,
    ];

    if (proxy) {
      const proxyProto = proxy.type === 'socks5' ? 'socks5' : 'http';
      browserArgs.push(`--proxy-server=${proxyProto}://${proxy.host}:${proxy.port}`);
    }

    const browser = await puppeteer.launch({
      executablePath: execPath,
      headless: this.headless,
      args: browserArgs,
      defaultViewport: null,
      ignoreDefaultArgs: ['--enable-automation'],
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

    return { browser, page, viewsDone: 0, profileDir, busy: false, proxy };
  }

  async _recycleBrowser(entry) {
    try { await entry.browser.close(); } catch {}
    try { fs.rmSync(entry.profileDir, { recursive: true, force: true }); } catch {}
    const idx = this._browserPool.indexOf(entry);
    if (idx >= 0) this._browserPool.splice(idx, 1);
  }

  _clearPool() {
    for (const entry of this._browserPool) {
      try { entry.browser.close(); } catch {}
      try { fs.rmSync(entry.profileDir, { recursive: true, force: true }); } catch {}
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
        ];
        for (const sel of selectors) {
          try {
            const els = document.querySelectorAll(sel);
            for (const el of els) {
              if (el.offsetParent !== null) {
                el.click();
              }
            }
          } catch {}
        }
      });
    } catch {}
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

      await poolEntry.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

      await delay(randomBetween(500, 1500));
      await this._closeOverlays(poolEntry.page);

      const watchTime = getViewDuration(this.fastMode, url);
      const startTime = Date.now();

      while (Date.now() - startTime < watchTime && this.running) {
        await delay(randomBetween(3000, 8000));
        try {
          await poolEntry.page.evaluate(() => {
            window.scrollTo({ top: Math.floor(Math.random() * 500), behavior: 'smooth' });
          });
        } catch {}
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
