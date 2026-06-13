// ──────────────────────────────────────────────
// PhantomView Desktop — Entry Point
// Starts proxy server + farm engine + UI
// Run: node desktop/main.mjs
// ──────────────────────────────────────────────

import http from 'http';
import { FarmEngine } from './engine.mjs';

const PORT = 3457; // Desktop farm API port
const engine = new FarmEngine();

// ── Event logging ──
engine.onEvent((evt) => {
  console.log(`[Farm] ${evt.name}:`, evt.proxy || '', evt.error || '');
});

// ── HTTP API for React UI to control the farm ──
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsed = new URL(req.url, `http://localhost:${PORT}`);
  const path = parsed.pathname;

  // GET /status — current farm state
  if (path === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(engine.getStatus()));
    return;
  }

  // POST /config — update engine settings
  if (path === '/config' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (typeof data.headless === 'boolean') engine.headless = data.headless;
        if (typeof data.fastMode === 'boolean') engine.fastMode = data.fastMode;
        if (typeof data.concurrency === 'number') engine.concurrency = Math.max(1, Math.min(data.concurrency, 15));
        if (typeof data.viewsPerBrowser === 'number') engine.viewsPerBrowser = Math.max(1, data.viewsPerBrowser);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, config: { headless: engine.headless, fastMode: engine.fastMode, concurrency: engine.concurrency, viewsPerBrowser: engine.viewsPerBrowser } }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // POST /start — begin farming
  if (path === '/start' && req.method === 'POST') {
    if (engine.running) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Farm already running. Stop first.' }));
      return;
    }
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (!data.url) throw new Error('Missing url');
        if (typeof data.fastMode === 'boolean') engine.fastMode = data.fastMode;
        if (typeof data.headless === 'boolean') engine.headless = data.headless;
        if (typeof data.concurrency === 'number') engine.concurrency = Math.max(1, Math.min(data.concurrency, 15));
        if (typeof data.proxyTarget === 'number') engine.proxyTarget = Math.max(1, Math.min(data.proxyTarget, 999));
        engine.setProxies(data.proxies || []);
        engine.start(data.url).catch(err => {
          console.error('[Farm] Error:', err.message);
          engine.running = false;
          engine.stats.viewsSent = 0;
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // GET /screenshots — live browser screenshots
  if (path === '/screenshots') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(engine.getScreenshots()));
    return;
  }

  // POST /stop
  if (path === '/stop' && req.method === 'POST') {
    engine.stop();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // POST /pause
  if (path === '/pause' && req.method === 'POST') {
    engine.pause();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // POST /resume
  if (path === '/resume' && req.method === 'POST') {
    engine.resume();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`[PhantomView Desktop] Farm API on http://localhost:${PORT}`);
  console.log(`[PhantomView Desktop] Open browser UI and switch to "Desktop Mode"`);
});

// Cleanup on exit — kill orphaned browser processes
async function cleanup() {
  console.log('[PhantomView] Shutting down farm...');
  engine.running = false;
  await engine._clearPool();
  process.exit(0);
}
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
