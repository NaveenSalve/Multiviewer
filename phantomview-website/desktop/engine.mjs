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
    this.stats = { viewsSent: 0, cycles: 0, startedAt: null, activeView: false, signInWallsSkipped: 0 };
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
    this.proxyTarget = 10;
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
      console.log(`[FarmEngine] Proxy bank offline (http://localhost:3456) — ${err.message}. Start proxy server: node server/proxy-server.mjs`);
    }
    return false;
  }

  // Poll proxy bank every 1s — adds to pool as they come until proxyTarget reached
  async _pollProxyBank() {
    while (this.running) {
      if (this.proxies.length >= this.proxyTarget) {
        await delay(2000);
        continue;
      }
      try {
        const r = await fetch(`${this._bankUrl}/proxy-bank/next`, { signal: AbortSignal.timeout(2000) });
        const d = await r.json();
        if (d.ok && d.proxy) {
          const parts = d.proxy.split(':');
          const pObj = { host: parts[0], port: parseInt(parts[1]), type: 'http', user: '', pass: '', label: `${parts[0]}:${parseInt(parts[1])}` };
          const exists = this.proxies.find(p => p.host === pObj.host && p.port === pObj.port);
          if (!exists) {
            this.proxies.push(pObj);
            console.log(`[FarmEngine] Proxy collected: ${pObj.label} (${this.proxies.length}/${this.proxyTarget})`);
          }
        }
      } catch (e) { console.error(`[FarmEngine] Proxy poll error: ${e.message} (bank offline?)`); }
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
    this.currentIndex = 0;
    this.stats = { viewsSent: 0, cycles: 0, startedAt: Date.now(), activeView: false, signInWallsSkipped: 0 };

    this._emit('start', { browser: browserInfo.type });

    // User provided proxies — use as-is, no bank polling
    if (this.proxies.length > 0) {
      this.proxyTarget = this.proxies.length;
      console.log(`[FarmEngine] Using ${this.proxies.length} user-provided proxies`);
    } else {
      // Bank mode — continuously fetch until proxyTarget reached
      // First check if proxy server is alive
      try {
        const health = await fetch(`${this._bankUrl}/health`, { signal: AbortSignal.timeout(2000) });
        if (!health.ok) throw new Error(`Status ${health.status}`);
        console.log('[FarmEngine] Proxy bank online at', this._bankUrl);
      } catch (e) {
        console.error(`[FarmEngine] Proxy server OFFLINE at ${this._bankUrl} — ${e.message}`);
        console.error('[FarmEngine] Start it: node server/proxy-server.mjs in a separate terminal');
        throw new Error(`Proxy server not running at ${this._bankUrl}. Run: node server/proxy-server.mjs`);
      }

      this._proxyPollInterval = setInterval(() => this._pollProxyBank(), 1000);

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
          console.error(`[FarmEngine] Harvest failed: ${e.message}. Check proxy server at http://localhost:3456`);
        }
      } else {
        console.log(`[FarmEngine] Using ${this.proxies.length} existing proxies from bank`);
      }
    }

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
    if (!proxy) throw new Error('Cannot launch browser without a proxy — IP leak risk');
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
      '--host-resolver-rules="MAP * ~NOTAVAILABLE , EXCLUDE localhost"',
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
    await this._setupPageDefaults(page, proxy);

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

  async _setupFingerprint(page) {
    return page.evaluateOnNewDocument(() => {
      try { delete window.RTCPeerConnection; } catch(e) {}
      try { delete window.webkitRTCPeerConnection; } catch(e) {}
      try { delete window.RTCDataChannel; } catch(e) {}
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
  }

  async _setupPageDefaults(page, proxy) {
    const vp = VIEWPORT_SIZES[Math.floor(Math.random() * VIEWPORT_SIZES.length)];
    await page.setViewport(vp);
    if (proxy?.user) {
      await page.authenticate({ username: proxy.user, password: proxy.pass });
    }
    await this._setupFingerprint(page);
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
          // Sign-in wall close buttons
          'button[aria-label*="Sign"]',
          'button[aria-label*="sign"]',
          'button[aria-label*="Close sign"]',
          'button[aria-label*="Dismiss sign"]',
          '[class*="auth"] button[aria-label*="Close"]',
          '[class*="auth"] button[aria-label*="Dismiss"]',
          '[class*="auth"] [aria-label*="×"]',
          '[class*="sign-in"] button, [class*="signin"] button',
          '[class*="login"] button[aria-label*="Close"]',
          '[class*="login"] button[aria-label*="Dismiss"]',
          '[aria-label*="Close sign-in"]',
          '[aria-label*="Dismiss sign-in"]',
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

  async _detectSignInWall(page) {
    try {
      const currentUrl = page.url() || '';
      const urlLower = decodeURIComponent(currentUrl).toLowerCase();
      const urlPatterns = ['/login', '/signin', '/auth', '/register', '/signup', '/log-in', '/logon', '/authenticate'];
      if (urlPatterns.some(p => urlLower.includes(p))) return true;

      return await page.evaluate(() => {
        const title = (document.title || '').toLowerCase();
        if (['sign in', 'log in', 'login', 'signin', 'create account', 'sign up', 'register'].some(k => title.includes(k))) return true;

        const bodyText = (document.body?.textContent || '').toLowerCase();
        const keywords = ['sign in', 'log in', 'create account', 'sign up', 'welcome back', 'register', 'continue with', 'forgot password'];
        const matchCount = keywords.filter(k => bodyText.includes(k)).length;

        const pwFields = document.querySelectorAll('input[type="password"]');
        const emailFields = document.querySelectorAll('input[type="email"], input[name="email"], input[name="username"], input[name="login"]');
        const hasFormField = pwFields.length > 0 || emailFields.length > 0;

        // Strong signal: form field + sign-in keyword
        if (hasFormField && matchCount >= 1) return true;

        // Check visible auth containers (class, id, form action)
        const authSelectors = [
          '[class*="auth-wall"]', '[class*="auth-container"]',
          '[class*="signin"]', '[class*="sign-in"]',
          '[class*="signup"]', '[class*="sign-up"]', '[class*="register"]',
          '[class*="login"]', '[class*="log-in"]', '[class*="logon"]',
          '[id*="login"]', '[id*="signin"]', '[id*="sign-in"]',
          '.auth-form', '#signin-form', '#signup-form', '#login-form',
          'form[action*="login"]', 'form[action*="signin"]', 'form[action*="auth"]',
          'form[action*="register"]', 'form[action*="signup"]',
          '[data-testid*="login"]', '[data-testid*="Login"]',
          '[data-testid*="signin"]', '[data-testid*="Signin"]',
          '[data-testid*="auth"]', '[data-testid*="Auth"]',
          '[data-testid*="signup"]', '[data-testid*="Signup"]',
        ];
        for (const sel of authSelectors) {
          try {
            const el = document.querySelector(sel);
            if (el && el.offsetParent !== null) return true;
          } catch(e) {}
        }

        // Check role="dialog" / modal with sign-in text
        const dialogs = document.querySelectorAll('div[role="dialog"], [role="presentation"], .modal, [class*="modal"], [class*="overlay"]');
        for (const el of dialogs) {
          try {
            if (el.offsetParent === null) continue;
            const text = (el.textContent || '').toLowerCase();
            if (keywords.some(k => text.includes(k)) && hasFormField) return true;
          } catch(e) {}
        }

        // Check prominent headings/buttons for sign-in text
        const headings = document.querySelectorAll('h1, h2, h3, button[type="submit"], [class*="heading"], [class*="title"]');
        for (const el of headings) {
          const text = (el.textContent || '').toLowerCase().trim();
          if (['sign in', 'log in', 'sign up', 'sign up now', 'create account', 'register', 'get started', 'continue with'].includes(text)) return true;
        }

        // Check for full-page overlay with form (position fixed + high z-index)
        const allDivs = document.querySelectorAll('div');
        const maxCheck = Math.min(allDivs.length, 200);
        for (let i = 0; i < maxCheck; i++) {
          try {
            const el = allDivs[i];
            const cs = window.getComputedStyle(el);
            if (cs.position === 'fixed' && parseInt(cs.zIndex) > 100 && el.offsetParent !== null) {
              const text = (el.textContent || '').toLowerCase();
              if (keywords.some(k => text.includes(k)) && el.querySelector('input')) return true;
            }
          } catch(e) {}
        }

        return false;
      });
    } catch(e) {
      return false;
    }
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

      // Wait for JS to render (sign-in walls are often client-side rendered)
      await delay(3000);

      // Capture screenshot for UI preview
      try {
        poolEntry.screenshot = await poolEntry.page.screenshot({ type: 'jpeg', quality: 30, encoding: 'base64' });
        poolEntry.screenshotAt = Date.now();
      } catch (e) { console.error(`[FarmEngine] Screenshot error: ${e.message}`); poolEntry.screenshot = null; }

      // Sign-in wall detection — try to dismiss first, else close page & reuse same IP
      const hasSignIn = await this._detectSignInWall(poolEntry.page);
      if (hasSignIn) {
        console.log(`[FarmEngine] Sign-in wall detected for ${poolEntry.proxyLabel}, attempting dismiss...`);
        await this._closeOverlays(poolEntry.page);
        await delay(2000);

        if (await this._detectSignInWall(poolEntry.page)) {
          console.log(`[FarmEngine] Sign-in wall persists for ${poolEntry.proxyLabel}, closing page and reusing same IP...`);
          this.stats.signInWallsSkipped++;
          try { await poolEntry.page.close(); } catch(e) {}
          const newPage = await poolEntry.browser.newPage();
          await this._setupPageDefaults(newPage, proxy);
          poolEntry.page = newPage;
          poolEntry.viewsDone++;
          this.stats.activeView = false;
          return;
        }
      }

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
