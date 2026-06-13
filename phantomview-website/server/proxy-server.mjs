// ──────────────────────────────────────────────
// PhantomView OS — Local Proxy Server
// Routes requests through user-specified HTTP/HTTPS/SOCKS5 proxies
// Run: node server/proxy-server.mjs
// ──────────────────────────────────────────────

import http from 'http';
import https from 'https';
import net from 'net';
import { URL } from 'url';
import { SocksClient } from 'socks';

const PORT = parseInt(process.env.PROXY_PORT || '3456', 10);
const TIMEOUT = 30000;

// ── Parse proxy string ──
// Formats: IP:PORT, IP:PORT:USER:PASS, socks5://IP:PORT, socks5://IP:PORT:USER:PASS
function parseProxy(str) {
  if (!str || typeof str !== 'string') return null;
  let raw = str.trim();

  let type = 'http'; // default
  if (raw.startsWith('socks5://') || raw.startsWith('socks://')) {
    type = 'socks5';
    raw = raw.replace(/^(socks5?:\/\/)/, '');
  }

  const lastColon = raw.lastIndexOf(':');
  if (lastColon < 1) return null;

  // Try to find port — the last colon-separated segment that's a number
  const parts = raw.split(':');
  const port = parseInt(parts[parts.length - 1], 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    // Try second-to-last as port
    const port2 = parseInt(parts[parts.length - 2], 10);
    if (isNaN(port2) || port2 < 1 || port2 > 65535) return null;
    return {
      type,
      host: parts.slice(0, parts.length - 2).join(':'),
      port: port2,
      user: parts[parts.length - 1],
      pass: '',
      label: `${parts.slice(0, parts.length - 2).join(':')}:${port2}`,
    };
  }

  if (parts.length === 2) {
    return { type, host: parts[0], port, user: '', pass: '', label: raw };
  }
  if (parts.length === 3) {
    return null; // invalid
  }
  if (parts.length === 4) {
    return { type, host: parts[0], port, user: parts[2], pass: parts[3], label: `${parts[0]}:${port}` };
  }
  if (parts.length >= 5) {
    // IP:PORT:USER:PASS where IP could be IPv6
    return { type, host: parts[0], port, user: parts[2], pass: parts.slice(3).join(':'), label: `${parts[0]}:${port}` };
  }
  return null;
}

// ── HTTP CONNECT tunnel through proxy ──
function httpConnectTunnel(proxyHost, proxyPort, targetHost, targetPort, auth) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error('CONNECT tunnel timeout'));
    }, TIMEOUT);

    socket.connect(proxyPort, proxyHost, () => {
      const connectReq = `CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\nHost: ${targetHost}:${targetPort}\r\n${auth ? `Proxy-Authorization: Basic ${auth}\r\n` : ''}\r\n`;
      socket.write(connectReq);
    });

    socket.once('data', (data) => {
      const response = data.toString();
      if (response.includes('200') || response.includes('HTTP/1.1 200') || response.includes('HTTP/1.0 200')) {
        clearTimeout(timeout);
        resolve(socket);
      } else {
        clearTimeout(timeout);
        socket.destroy();
        reject(new Error(`CONNECT failed: ${response.slice(0, 100)}`));
      }
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

// ── Fetch URL through proxy ──
async function fetchThroughProxy(targetUrl, proxyInfo) {
  const url = new URL(targetUrl);
  const isHttps = url.protocol === 'https:';
  const targetPort = parseInt(url.port, 10) || (isHttps ? 443 : 80);
  const auth = proxyInfo.user ? Buffer.from(`${proxyInfo.user}:${proxyInfo.pass}`).toString('base64') : null;

  let tunnelSocket;

  if (proxyInfo.type === 'socks5') {
    // SOCKS5
    const destination = { host: url.hostname, port: targetPort };
    const proxy = {
      host: proxyInfo.host,
      port: proxyInfo.port,
      userId: proxyInfo.user || undefined,
      password: proxyInfo.pass || undefined,
    };
    const conn = await SocksClient.createConnection({ destination, proxy, command: 'connect', timeout: TIMEOUT });
    tunnelSocket = conn.socket;
  } else {
    // HTTP CONNECT tunnel
    tunnelSocket = await httpConnectTunnel(proxyInfo.host, proxyInfo.port, url.hostname, targetPort, auth);
  }

  return new Promise((resolve, reject) => {
    const selectedUA = getRandomUA();
    const chromeVersion = selectedUA.match(/Chrome\/(\d+)/)?.[1] || '125';
    const secChUa = `"Google Chrome";v="${chromeVersion}", "Chromium";v="${chromeVersion}", "Not.A/Brand";v="24"`;
    const platform = selectedUA.includes('Windows') ? 'Windows' : selectedUA.includes('Mac') ? 'macOS' : 'Linux';
    const headers = {
      'Host': url.hostname,
      'User-Agent': getRandomUA(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-CH-UA': secChUa,
      'Sec-CH-UA-Mobile': '?0',
      'Sec-CH-UA-Platform': `"${platform}"`,
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0',
    };
    const request = isHttps
      ? https.request({ host: url.hostname, port: targetPort, path: url.pathname + url.search, method: 'GET', headers, createConnection: () => tunnelSocket, rejectUnauthorized: true })
      : http.request({ host: url.hostname, port: targetPort, path: url.pathname + url.search, method: 'GET', headers, createConnection: () => tunnelSocket });

    let body = [];
    request.on('response', (res) => {
      res.on('data', (chunk) => body.push(chunk));
      res.on('end', () => {
        const fullBody = Buffer.concat(body);
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: fullBody,
          contentType: res.headers['content-type'] || '',
        });
      });
    });

    request.on('error', (err) => {
      tunnelSocket.destroy();
      reject(err);
    });

    request.end();
  });
}

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

// ── User-Agent rotation ──
const UA_POOL = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
];

function getRandomUA() {
  return UA_POOL[Math.floor(Math.random() * UA_POOL.length)];
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

  // Proxy endpoint
  if (path === '/proxy') {
    const targetUrl = parsed.searchParams.get('url');
    const proxyStr = parsed.searchParams.get('proxy') || '';

    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing url parameter' }));
      return;
    }

    const proxyInfo = proxyStr ? parseProxy(proxyStr) : null;

    try {
      const result = await fetchThroughProxy(targetUrl, proxyInfo || { type: 'direct', host: '', port: 0, user: '', pass: '' });
      const isHtml = result.contentType && result.contentType.includes('text/html');

      let body = result.body;
      if (isHtml) {
        body = Buffer.from(rewriteHtml(body.toString('utf-8'), targetUrl, proxyStr), 'utf-8');
      }

      // Remove headers that block iframes
      const responseHeaders = {};
      const blocklist = ['x-frame-options', 'content-security-policy', 'content-security-policy-report-only', 'strict-transport-security', 'public-key-pins'];
      for (const [key, value] of Object.entries(result.headers)) {
        if (!blocklist.includes(key.toLowerCase())) {
          responseHeaders[key] = value;
        }
      }
      // Pass through original headers unmodified — no synthetic headers added

      res.writeHead(result.status, responseHeaders);
      res.end(body);
    } catch (err) {
      res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: err.message }));
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
      const result = await fetchThroughProxy('https://api.ipify.org?format=json', proxyInfo);
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

  // Scrape free proxies
  if (path === '/scrape-proxies') {
    const sources = [
      'https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=10000&country=all',
      'https://api.proxyscrape.com/v2/?request=getproxies&protocol=socks5&timeout=10000&country=all',
      'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
      'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt',
      'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt',
      'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/socks5.txt',
    ];

    try {
      const allProxies = new Set();
      const results = await Promise.allSettled(sources.map(async (src) => {
        const resp = await fetch(src, { signal: AbortSignal.timeout(10000) });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const text = await resp.text();
        for (const line of text.split('\n')) {
          const p = parseProxy(line.trim());
          if (p) allProxies.add(`${p.host}:${p.port}`);
        }
      }));

      const proxyList = Array.from(allProxies);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ ok: true, count: proxyList.length, proxies: proxyList }));
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
  console.log(`[PhantomView Proxy] Server running on http://localhost:${PORT}`);
  console.log(`[PhantomView Proxy] Use: http://localhost:${PORT}/proxy?url=TARGET_URL&proxy=IP:PORT:USER:PASS`);
  console.log(`[PhantomView Proxy] Proxy formats: IP:PORT, IP:PORT:USER:PASS, socks5://IP:PORT`);
});

server.on('error', (err) => {
  console.error(`[PhantomView Proxy] Failed to start: ${err.message}`);
  process.exit(1);
});
