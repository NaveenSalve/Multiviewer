// ──────────────────────────────────────────────
// PhantomView OS — Local Proxy Server v3
// Routes requests through user-specified HTTP/HTTPS/SOCKS5 proxies
// Run: node server/proxy-server.mjs
// ──────────────────────────────────────────────

import http from 'http';
import https from 'https';
import net from 'net';
import { URL } from 'url';
import fs from 'fs';
import path from 'path';
import { SocksClient } from 'socks';
import { ProxyHarvester } from './proxy-engine.mjs';
import { parseProxy, fetchThroughProxy, getRandomUA, fastTestProxy, fastTestBatch } from './proxy-lib.mjs';

const PORT = parseInt(process.env.PROXY_PORT || '3456', 10);
const TIMEOUT = 30000;
const PROXY_DATA_DIR = path.join(process.cwd(), 'data');
const PROXY_DATA_FILE = path.join(PROXY_DATA_DIR, 'live-proxies.json');

// ── Proxy Bank — Persistent pool of working proxies with round-robin ──
class ProxyBank {
  constructor() {
    this.pool = [];
    this.index = 0;
    this._cleanInterval = null;
    this._fillInterval = null;
    this.cleanMinutes = 5;
    this.fillMinutes = 5;
    this._filling = false;
  }

  // Load saved proxies from disk
  loadFromDisk() {
    try {
      if (!fs.existsSync(PROXY_DATA_DIR)) fs.mkdirSync(PROXY_DATA_DIR, { recursive: true });
      if (fs.existsSync(PROXY_DATA_FILE)) {
        const raw = fs.readFileSync(PROXY_DATA_FILE, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data.proxies)) {
          this.pool = data.proxies.filter(p => typeof p === 'string' && p.trim());
          this.index = data.index || 0;
          console.log(`[ProxyBank] Loaded ${this.pool.length} proxies from disk`);
        }
      }
    } catch (err) {
      console.log(`[ProxyBank] Disk load error: ${err.message}`);
    }
  }

  // Save current pool to disk
  saveToDisk() {
    try {
      if (!fs.existsSync(PROXY_DATA_DIR)) fs.mkdirSync(PROXY_DATA_DIR, { recursive: true });
      fs.writeFileSync(PROXY_DATA_FILE, JSON.stringify({ proxies: this.pool, index: this.index, savedAt: Date.now() }));
    } catch (err) {
      console.log(`[ProxyBank] Disk save error: ${err.message}`);
    }
  }

  start() {
    this.loadFromDisk();
    // Clean dead proxies every 5 min
    this._cleanInterval = setInterval(() => this.cleanDead(), this.cleanMinutes * 60000);
    // Fill pool every 5 min
    this._fillInterval = setInterval(() => this.fill(), this.fillMinutes * 60000);
    console.log(`[ProxyBank] Started — pool: ${this.pool.length}, clean every ${this.cleanMinutes}min, fill every ${this.fillMinutes}min`);
  }

  stop() {
    this.saveToDisk();
    if (this._cleanInterval) { clearInterval(this._cleanInterval); this._cleanInterval = null; }
    if (this._fillInterval) { clearInterval(this._fillInterval); this._fillInterval = null; }
  }

  get size() { return this.pool.length; }
  get all() { return [...this.pool]; }

  add(proxyStr) {
    if (!proxyStr || typeof proxyStr !== 'string') return false;
    const p = proxyStr.trim();
    if (p && p.includes(':') && !this.pool.includes(p)) {
      this.pool.push(p);
      this.saveToDisk();
      return true;
    }
    return false;
  }

  addMany(proxies) {
    let count = 0;
    for (const p of proxies) { if (this.add(p)) count++; }
    if (count > 0) this.saveToDisk();
    return count;
  }

  remove(proxyStr) {
    const idx = this.pool.indexOf(proxyStr);
    if (idx >= 0) { this.pool.splice(idx, 1); this.saveToDisk(); return true; }
    return false;
  }

  getNext() {
    if (this.pool.length === 0) return null;
    const proxy = this.pool[this.index % this.pool.length];
    this.index = (this.index + 1) % this.pool.length;
    return proxy;
  }

  getMultiple(count) {
    const result = [];
    for (let i = 0; i < count; i++) {
      const p = this.getNext();
      if (p) result.push(p);
    }
    return result;
  }

  // Test and remove dead proxies from pool
  async cleanDead() {
    if (this.pool.length === 0) return;
    const before = this.pool.length;
    const results = await Promise.allSettled(this.pool.map(p => fastTestProxy(p)));
    const alive = [];
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'fulfilled' && results[i].value.ok) {
        alive.push(this.pool[i]);
      }
    }
    if (alive.length < before) {
      this.pool = alive;
      this.saveToDisk();
      console.log(`[ProxyBank] Clean: ${before}→${alive.length} (removed ${before - alive.length} dead)`);
    }
  }

  // Scrape and add new proxies to pool
  async fill() {
    if (this._filling) return;
    this._filling = true;
    try {
      const stats = await harvester.harvestAndVerify();
      if (stats.alive > 0) console.log(`[ProxyBank] Fill: +${stats.alive} live proxies (pool: ${this.pool.length})`);
      else console.log(`[ProxyBank] Fill: no live proxies found`);
    } catch (err) {
      console.log(`[ProxyBank] Fill error: ${err.message}`);
    }
    this._filling = false;
  }

  status() {
    return {
      poolSize: this.pool.length,
      currentIndex: this.index,
      proxies: this.pool.slice(0, 10),
    };
  }
}

const proxyBank = new ProxyBank();
const harvester = new ProxyHarvester(proxyBank);





// ── Generate per-tab fingerprint + behavior injection script ──
function generateFingerprintScript() {
  const ua = getRandomUA();
  const platform = ua.includes('Windows') ? 'Win32' : ua.includes('Mac') ? 'MacIntel' : 'Linux x86_64';
  const langPool = [
    ['en-US','en'], ['en-GB','en'], ['fr-FR','fr','en'], ['de-DE','de','en'],
    ['ja-JP','ja','en'], ['es-ES','es','en'], ['pt-BR','pt','en'], ['it-IT','it','en'],
  ];
  const langs = JSON.stringify(langPool[Math.floor(Math.random() * langPool.length)]);
  const hc = [2, 4, 8, 16][Math.floor(Math.random() * 4)];
  const tz = [480, 300, 0, -60, -120, -330, -480, -540][Math.floor(Math.random() * 8)];
  const cd = [24, 30, 48][Math.floor(Math.random() * 3)];
  const res = [[1920,1080],[1440,900],[1366,768],[1536,864],[1600,900],[1280,720],[2560,1440],[1680,1050]];
  const [sw, sh] = res[Math.floor(Math.random() * res.length)];
  const vendors = ['Google Inc. (Intel)','Intel Inc.','NVIDIA Corporation','AMD','Apple'];
  const renderers = ['Intel Iris OpenGL Engine','NVIDIA GeForce RTX 3060','AMD Radeon RX 6700 XT','Apple M1','Apple M2'];
  const vendor = vendors[Math.floor(Math.random() * vendors.length)];
  const renderer = renderers[Math.floor(Math.random() * renderers.length)];
  var uaStr = JSON.stringify(ua);
  var platStr = JSON.stringify(platform);
  var vendorStr = JSON.stringify(vendor);
  var rendererStr = JSON.stringify(renderer);
  var scr =
'<script>' +
'(function(){' +
'var _l=' + langs + ';' +
"try{Object.defineProperty(navigator,'userAgent',{get:function(){return " + uaStr + ";}})}catch(e){}" +
"try{Object.defineProperty(navigator,'platform',{get:function(){return " + platStr + ";}})}catch(e){}" +
"try{Object.defineProperty(navigator,'hardwareConcurrency',{get:function(){return " + hc + ";}})}catch(e){}" +
"try{Object.defineProperty(navigator,'languages',{get:function(){return _l;}})}catch(e){}" +
"try{Object.defineProperty(navigator,'language',{get:function(){return _l[0];}})}catch(e){}" +
"try{Object.defineProperty(screen,'width',{get:function(){return " + sw + ";}})}catch(e){}" +
"try{Object.defineProperty(screen,'height',{get:function(){return " + sh + ";}})}catch(e){}" +
"try{Object.defineProperty(screen,'colorDepth',{get:function(){return " + cd + ";}})}catch(e){}" +
"try{Object.defineProperty(screen,'pixelDepth',{get:function(){return " + cd + ";}})}catch(e){}" +
'try{delete window.RTCPeerConnection}catch(e){}' +
'try{delete window.webkitRTCPeerConnection}catch(e){}' +
'try{delete window.RTCDataChannel}catch(e){}' +
"try{navigator.mediaDevices=undefined}catch(e){}" +
"try{navigator.getBattery=undefined}catch(e){}" +
'var _g=CanvasRenderingContext2D.prototype.getImageData;CanvasRenderingContext2D.prototype.getImageData=function(){var d=_g.apply(this,arguments);for(var i=0;i<d.data.length;i+=4){if(Math.random()>.9995){d.data[i]=(d.data[i]+1)%256;d.data[i+1]=(d.data[i+1]+2)%256;d.data[i+2]=(d.data[i+2]-1)%256;}}return d;};' +
"var _gp=WebGLRenderingContext.prototype.getParameter;WebGLRenderingContext.prototype.getParameter=function(p){if(p===37445)return " + vendorStr + ";if(p===37446)return " + rendererStr + ";return _gp.apply(this,arguments);};" +
"Date.prototype.getTimezoneOffset=function(){return " + tz + ";};" +
'localStorage.clear();' +
'sessionStorage.clear();' +
"document.cookie.split(';').forEach(function(c){var e=c.indexOf('=');var n=e>-1?c.substr(0,e).trim():c.trim();document.cookie=n+'=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';document.cookie=n+'=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain='+location.hostname;});" +
'function _r(a,b){return Math.floor(Math.random()*(b-a+1)+a)}' +
'function _d(a,b){return new Promise(function(r){setTimeout(r,_r(a,b))})}' +
'(async function(){' +
'await _d(500,4000);' +
'setInterval(function(){var m=Math.max(document.body.scrollHeight-window.innerHeight,50);window.scrollTo({top:_r(0,m),behavior:Math.random()>.5?"smooth":"instant"})},_r(5000,15000));' +
"setInterval(function(){try{document.dispatchEvent(new MouseEvent('mousemove',{clientX:_r(50," + sw + "),clientY:_r(50," + sh + "),buttons:0}))}catch(e){}},_r(3000,10000));" +
"setTimeout(function(){try{document.dispatchEvent(new MouseEvent('click',{clientX:_r(50," + sw + "),clientY:_r(50," + sh + "),bubbles:true}))}catch(e){}},_r(8000,25000));" +
'setTimeout(function(){window.scrollBy({top:_r(100,400),behavior:"smooth"})},_r(3000,8000));' +
"setTimeout(function(){try{Object.defineProperty(document,'hidden',{get:function(){return true},configurable:true});document.dispatchEvent(new Event('visibilitychange'));setTimeout(function(){Object.defineProperty(document,'hidden',{get:function(){return false},configurable:true});document.dispatchEvent(new Event('visibilitychange'))},_r(5000,15000))}catch(e){}},_r(15000,40000));" +
'})();' +
'})();' +
'</script>';
  return scr;
}

// ── Extract main content only (no sidebar, ads, etc.) ──
function extractMainContent(html, baseUrl) {
  let main = html;
  const removals = [
    /<header[^>]*>[\s\S]*?<\/header>/gi,
    /<footer[^>]*>[\s\S]*?<\/footer>/gi,
    /<nav[^>]*>[\s\S]*?<\/nav>/gi,
    /<aside[^>]*>[\s\S]*?<\/aside>/gi,
    /<div[^>]*?(?:class|id)=["'][^"']*(?:sidebar|widget|advert|banner|promo|social|share|related|recommend|comment|footer|header|menu|nav|popup|overlay|modal|cookie|notification)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi,
    /<div[^>]*?class=["'][^"']*ad[-_ ][^"']*["'][^>]*>[\s\S]*?<\/div>/gi,
    /<iframe[^>]*>[\s\S]*?<\/iframe>/gi,
    /<script[^>]*>[\s\S]*?<\/script>/gi,
    /<style[^>]*>[\s\S]*?<\/style>/gi,
    /<link[^>]*>/gi,
    /<meta[^>]*>/gi,
  ];
  for (const re of removals) { main = main.replace(re, ''); }

  // Try to find main content area
  const contentMatch = main.match(/<(?:main|article)[^>]*>([\s\S]*?)<\/(?:main|article)>/i)
    || main.match(/<div[^>]*?(?:class|id)=["'][^"']*(?:content|main|article|post|entry)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);

  let body = contentMatch ? contentMatch[1] : main;

  // Simplify: remove excess whitespace
  body = body.replace(/\s+/g, ' ').trim();

  // Wrap in minimal HTML
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="${baseUrl}">${generateFingerprintScript()}<style>body{font-family:sans-serif;line-height:1.6;padding:16px;max-width:800px;margin:0 auto;color:#222;background:#fff}img,video{max-width:100%;height:auto}a{color:#1a73e8}*{margin:0 0 8px}</style></head><body>${body}</body></html>`;
}

// ── Rewrite HTML URLs to go through proxy ──
function rewriteHtml(html, baseUrl, proxyStr) {
  const proxyEndpoint = `http://localhost:${PORT}/proxy?url=`;
  const proxyParam = proxyStr ? `&proxy=${encodeURIComponent(proxyStr)}` : '';
  const base = baseUrl.replace(/\/+$/, '');

  // Replace relative URLs with absolute proxy URLs
  return html
    .replace(/(<(?:img|script|link|iframe|source|video|audio)\s[^>]*?(?:src|href)=["'])(\/[^"']+)/gi, (match, prefix, path) => {
      return `${prefix}${proxyEndpoint}${encodeURIComponent(base + path)}${proxyParam}`;
    })
    .replace(/(action=["'])(\/[^"']+)/gi, (match, prefix, path) => {
      return `${prefix}${proxyEndpoint}${encodeURIComponent(base + path)}${proxyParam}`;
    })
    .replace(/url\(['"]?(\/[^'")\s]+)/gi, (match, path) => {
      return `url(${proxyEndpoint}${encodeURIComponent(base + path)}${proxyParam})`;
    })
    // Inject referrer policy meta tag + fingerprint/behavior script
    .replace('</head>', `<meta name="referrer" content="no-referrer">
    ${generateFingerprintScript()}
    </head>`)
    // Strip X-Frame-Options from meta tags
    .replace(/<meta[^>]*?X-Frame-Options[^>]*?>/gi, '')
    .replace(/<meta[^>]*?frame-ancestors[^>]*?>/gi, '');
}





// ── HTTP Server ──
const server = http.createServer(async (req, res) => {
  // CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsed = new URL(req.url, `http://localhost:${PORT}`);
  const path = parsed.pathname;

  // Health check
  if (path === '/health' || path === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', port: PORT }));
    return;
  }

  // Proxy endpoint — auto-retry through bank on failure
  if (path === '/proxy') {
    const targetUrl = parsed.searchParams.get('url');
    const contentOnly = parsed.searchParams.get('content-only') === 'true';
    let proxyStr = parsed.searchParams.get('proxy') || '';

    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Missing URL</title><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f5f5;color:#333}.card{background:#fff;border-radius:12px;padding:32px 40px;box-shadow:0 4px 24px rgba(0,0,0,.1);max-width:480px;text-align:center}h1{font-size:20px;color:#d32f2f;margin:0 0 8px}p{font-size:14px;color:#666}</style></head><body><div class="card"><h1>Missing URL</h1><p>No target URL was provided. Use: /proxy?url=TARGET_URL&proxy=IP:PORT</p></div></body></html>');
      return;
    }

    // Retry loop: try up to 5 proxies from bank
    let tried = 0;
    let lastErr = '';
    while (tried < 5) {
      let currentProxy = proxyStr || proxyBank.getNext();
      if (!currentProxy) break;

      const proxyInfo = parseProxy(currentProxy);
      if (!proxyInfo) continue;

      try {
        const result = await fetchThroughProxy(targetUrl, proxyInfo);
        const isHtml = result.contentType && result.contentType.includes('text/html');

        let body = result.body;
        if (isHtml) {
          const htmlStr = body.toString('utf-8');
          if (contentOnly) {
            body = Buffer.from(extractMainContent(htmlStr, targetUrl), 'utf-8');
          } else {
            body = Buffer.from(rewriteHtml(htmlStr, targetUrl, currentProxy), 'utf-8');
          }
        }

        const responseHeaders = {};
        const blocklist = ['x-frame-options', 'content-security-policy', 'content-security-policy-report-only', 'strict-transport-security', 'public-key-pins'];
        for (const [key, value] of Object.entries(result.headers)) {
          if (!blocklist.includes(key.toLowerCase())) responseHeaders[key] = value;
        }

        res.writeHead(result.status, responseHeaders);
        res.end(body);
        return;
      } catch (err) {
        lastErr = err.message;
        proxyBank.remove(currentProxy);
        tried++;
        if (!proxyStr) proxyStr = ''; // use bank on next retry
      }
    }

    const errMsg = lastErr.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    res.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Proxy Error</title><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f5f5;color:#333}.card{background:#fff;border-radius:12px;padding:32px 40px;box-shadow:0 4px 24px rgba(0,0,0,.1);max-width:480px;text-align:center}h1{font-size:20px;margin:0 0 8px;color:#d32f2f}p{font-size:14px;color:#666;margin:0 0 4px;line-height:1.5}.hint{font-size:12px;color:#999;margin-top:12px}</style></head><body><div class="card"><h1>⚠️ Proxy Error</h1><p>${errMsg}</p><p class="hint">Tried 5 proxies — all dead. Pool size: ${proxyBank.size}</p></div></body></html>`);
    return;
  }

  // ── Proxy Bank endpoints ──
  if (path === '/proxy-bank/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(proxyBank.status()));
    return;
  }

  if (path === '/proxy-bank/next') {
    const proxy = proxyBank.getNext();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: !!proxy, proxy }));
    return;
  }

  if (path === '/proxy-bank/pool') {
    const n = parseInt(parsed.searchParams.get('n') || '5', 10);
    const proxies = proxyBank.getMultiple(n);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, count: proxies.length, proxies }));
    return;
  }

  if (path === '/proxy-bank/refresh') {
    await proxyBank.fill();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, poolSize: proxyBank.size }));
    return;
  }

  if (path === '/proxy-bank/fill') {
    if (proxyBank._filling) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, message: 'Already filling', poolSize: proxyBank.size }));
      return;
    }
    proxyBank.fill();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, message: 'Fill started in background', poolSize: proxyBank.size }));
    return;
  }

  // ── Proxy Engine endpoints ──
  if (path === '/proxy-engine/harvest') {
    const stats = await harvester.harvestAndVerify();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, ...stats }));
    return;
  }

  if (path === '/proxy-engine/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, ...harvester.getStatus() }));
    return;
  }

  if (path === '/proxy-engine/clear-seen') {
    harvester.seen.clear();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, seenCount: 0 }));
    return;
  }

  // ── Proxy Bank: upload list ──
  if (path === '/proxy-bank/upload' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      const lines = body.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#') && !l.startsWith('//'));
      let added = 0;
      for (const line of lines) {
        const parsed = parseProxy(line);
        if (parsed && proxyBank.add(parsed.label)) added++;
      }
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ ok: true, added, total: lines.length, poolSize: proxyBank.size }));
    });
    return;
  }

  if (path === '/proxy-bank/add') {
    const p = parsed.searchParams.get('proxy') || '';
    const added = proxyBank.add(p);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, added, poolSize: proxyBank.size }));
    return;
  }

  // ── IP Leak Check ──
  if (path === '/check-ip') {
    try {
      const [directRes, proxyRes] = await Promise.allSettled([
        fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(5000) }),
        fetchThroughProxy('https://api.ipify.org?format=json', { type: 'direct', host: '', port: 0, user: '', pass: '' }).then(r => JSON.parse(r.body.toString())).catch(() => null),
      ]);
      const directIp = directRes.status === 'fulfilled' ? (await directRes.value.json()).ip : 'unknown';
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({
        ok: true,
        realIp: directIp,
        note: 'Proxy bank may or may not change your visible IP depending on proxy type',
        proxyBankActive: proxyBank.size > 0,
        poolSize: proxyBank.size,
      }));
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // Test proxy endpoint
  if (path === '/test-proxy') {
    const proxyStr = parsed.searchParams.get('proxy');
    if (!proxyStr) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing proxy parameter' }));
      return;
    }

    const proxyInfo = parseProxy(proxyStr);
    if (!proxyInfo) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid proxy format. Use IP:PORT or IP:PORT:USER:PASS' }));
      return;
    }

    const start = Date.now();
    try {
      const result = await fetchThroughProxy('https://api.ipify.org?format=json', proxyInfo, 5000);
      const data = JSON.parse(result.body.toString());
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({
        ok: true,
        ip: data.ip,
        latency: Date.now() - start,
        proxy: proxyInfo.label,
        type: proxyInfo.type,
      }));
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({
        ok: false,
        error: err.message,
        latency: Date.now() - start,
        proxy: proxyInfo.label,
      }));
    }
    return;
  }

  // Scrape free proxies — returns ONLY live/verified proxies
  if (path === '/scrape-proxies') {
    const sources = [
      'https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=10000&country=all',
      'https://api.proxyscrape.com/v2/?request=getproxies&protocol=socks5&timeout=10000&country=all',
      'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
      'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt',
      'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt',
      'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/socks5.txt',
      'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
      'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt',
      'https://raw.githubusercontent.com/roosterkid/openproxylist/main/HTTPS.txt',
      'https://raw.githubusercontent.com/roosterkid/openproxylist/main/SOCKS5.txt',
      'https://raw.githubusercontent.com/zloi-user/hideip.me/main/http.txt',
      'https://raw.githubusercontent.com/zloi-user/hideip.me/main/socks5.txt',
      'https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-http.txt',
      'https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-socks5.txt',
      'https://www.proxy-list.download/api/v1/get?type=http',
      'https://www.proxy-list.download/api/v1/get?type=socks5',
    ];

    try {
      const allProxies = new Set();
      const results = await Promise.allSettled(sources.map(async (src) => {
        try {
          const resp = await fetch(src, { signal: AbortSignal.timeout(5000) });
          if (!resp.ok) return;
          const text = await resp.text();
          for (const line of text.split('\n')) {
            const p = parseProxy(line.trim());
            if (p) allProxies.add(`${p.host}:${p.port}`);
          }
        } catch (e) { console.error(`[Scrape] Source failed: ${src} — ${e.message}`); }
      }));

      const rawList = Array.from(allProxies);
      const batchSize = parseInt(parsed.searchParams.get('batch') || '100', 10);
      const skipTest = parsed.searchParams.get('verify') === 'false';
      const limit = parseInt(parsed.searchParams.get('limit') || '0', 10) || rawList.length;

      if (skipTest || rawList.length === 0) {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: true, count: rawList.length, proxies: rawList, tested: false }));
        return;
      }

      const toTest = rawList.slice(0, Math.min(limit, rawList.length));
      const alive = await fastTestBatch(toTest, batchSize);
      const deadCount = toTest.length - alive.length;
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({
        ok: true,
        count: alive.length,
        total: rawList.length,
        testedCount: toTest.length,
        alive: alive.length,
        dead: deadCount,
        proxies: alive,
        tested: true,
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found. Use /proxy?url=TARGET&proxy=IP:PORT' }));
});

server.listen(PORT, () => {
  console.log(`[PhantomView Proxy v3] Server running on http://localhost:${PORT}`);
  console.log(`[PhantomView Proxy] Use: /proxy?url=TARGET&proxy=IP:PORT`);
  console.log(`[PhantomView Proxy] Content-only: /proxy?url=TARGET&content-only=true`);
  console.log(`[PhantomView Proxy] Proxy Bank: /proxy-bank/status`);
  console.log(`[PhantomView Proxy] IP Check: /check-ip`);
  console.log(`[PhantomView Proxy] Data: ${PROXY_DATA_FILE}`);
  proxyBank.start();
});

server.on('error', (err) => {
  console.error(`[PhantomView Proxy] Failed to start: ${err.message}`);
  process.exit(1);
});
