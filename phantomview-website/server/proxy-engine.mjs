// ── Proxy Engine v4 — 10k+ proxies in 2-5 min ──
import fs from 'fs';
import path from 'path';
import { fastTestProxy, parseProxy } from './proxy-lib.mjs';

const DATA_DIR = path.join(process.cwd(), 'data');
const SEEN_FILE = path.join(DATA_DIR, 'seen-proxies.json');
const SEEN_LOG = path.join(DATA_DIR, 'seen-log.txt');

async function testProxy(proxyStr) {
  const result = await fastTestProxy(proxyStr, 8000);
  if (result.ok) return { ok: true, ip: result.ip, latency: result.latency };
  return null;
}

class SeenTracker {
  constructor() {
    this.seen = new Set();
    this._load();
  }
  _load() {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      if (fs.existsSync(SEEN_FILE)) {
        const raw = fs.readFileSync(SEEN_FILE, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) data.forEach(p => this.seen.add(p));
        console.log(`[SeenTracker] Loaded ${this.seen.size} seen proxies`);
      }
    } catch (e) { console.error(`[SeenTracker] Load error: ${e.message}`); }
  }
  _save() {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(SEEN_FILE, JSON.stringify([...this.seen]));
    } catch (e) { console.error(`[SeenTracker] Save error: ${e.message}`); }
  }
  filterFresh(list) { return list.filter(p => !this.seen.has(p)); }
  markTested(proxies) {
    for (const p of proxies) this.seen.add(p);
    this._save();
    try { fs.appendFileSync(SEEN_LOG, proxies.map(p => `${Date.now()},${p}`).join('\n') + '\n'); } catch (e) { console.error(`[SeenTracker] Log append error: ${e.message}`); }
  }
  clear() { this.seen.clear(); this._save(); }
  get size() { return this.seen.size; }
}

class ProxyHarvester {
  constructor(proxyBank) {
    this.bank = proxyBank;
    this.seen = new SeenTracker();
    this.lastHarvest = null;
    this.stats = { raw: 0, fresh: 0, alive: 0, time: 0 };
    this.sources = [
      'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
      'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt',
      'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt',
      'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/socks5.txt',
      'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
      'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt',
      'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies_anonymous/http.txt',
      'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies_anonymous/socks5.txt',
      'https://raw.githubusercontent.com/roosterkid/openproxylist/main/HTTPS.txt',
      'https://raw.githubusercontent.com/roosterkid/openproxylist/main/SOCKS5.txt',
      'https://raw.githubusercontent.com/zloi-user/hideip.me/main/http.txt',
      'https://raw.githubusercontent.com/zloi-user/hideip.me/main/socks5.txt',
      'https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-http.txt',
      'https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-socks5.txt',
      'https://raw.githubusercontent.com/sunny9577/proxy-scraper/master/proxies.txt',
      'https://raw.githubusercontent.com/UserNein/proxy-list/main/proxies.txt',
      'https://raw.githubusercontent.com/HenryXiaoYang/ProxyList/master/proxy_list_http.txt',
      'https://raw.githubusercontent.com/HenryXiaoYang/ProxyList/master/proxy_list_socks5.txt',
      'https://raw.githubusercontent.com/ALIILAPRO/Proxy/main/http.txt',
      'https://raw.githubusercontent.com/ALIILAPRO/Proxy/main/socks5.txt',
      'https://raw.githubusercontent.com/vamir/ProxyList/master/http.txt',
      'https://raw.githubusercontent.com/vamir/ProxyList/master/socks5.txt',
      'https://raw.githubusercontent.com/rdavydov/proxy-list/main/proxies/http.txt',
      'https://raw.githubusercontent.com/rdavydov/proxy-list/main/proxies/socks5.txt',
      'https://raw.githubusercontent.com/proxy4parsing/proxy-list/main/http.txt',
      'https://raw.githubusercontent.com/proxy4parsing/proxy-list/main/socks5.txt',
      'https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=10000&country=all',
      'https://api.proxyscrape.com/v2/?request=getproxies&protocol=socks5&timeout=10000&country=all',
      'https://api.proxyscrape.com/v3/free-proxy-list/get?request=displayproxies&proxy_format=protocolipport&format=text',
      'https://www.proxy-list.download/api/v1/get?type=http',
      'https://www.proxy-list.download/api/v1/get?type=https',
      'https://www.proxy-list.download/api/v1/get?type=socks5',
      'https://www.proxyscan.io/download?type=http',
      'https://www.proxyscan.io/download?type=socks5',
      'https://openproxy.space/list/http',
      'https://openproxy.space/list/socks5',
      'https://spys.me/proxy.txt',
      'https://spys.me/socks.txt',
      'https://sslproxies.org',
      'https://free-proxy-list.net',
      'https://www.us-proxy.org',
      'https://www.socks-proxy.net',
      'https://proxylist.geonode.com/api/proxy-list?limit=500&page=1&sort_by=lastChecked&sort_type=desc',
      'https://raw.githubusercontent.com/Impos1tive/proxy-lists/main/http.txt',
      'https://raw.githubusercontent.com/Impos1tive/proxy-lists/main/socks5.txt',
      'https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt',
      'https://raw.githubusercontent.com/mmpx12/proxy-list/master/http.txt',
      'https://raw.githubusercontent.com/mmpx12/proxy-list/master/socks5.txt',
      'https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt',
    ];
  }

  async collectAll() {
    const all = new Set();
    await Promise.race([
      Promise.allSettled(this.sources.map(src => this._fetchSrc(src, all))),
      new Promise(resolve => setTimeout(resolve, 20000))  // hard 20s limit
    ]);
    return all;
  }

  async _fetchSrc(url, set) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!resp.ok) return;
      const text = await resp.text();
      try {
        const json = JSON.parse(text);
        if (Array.isArray(json)) {
          for (const item of json) {
            const p = typeof item === 'string' ? item : `${item.ip || item.host || ''}:${item.port || ''}`;
            const parsed = parseProxy(p);
            if (parsed) set.add(parsed.label);
          }
          return;
        }
        if (json.data && Array.isArray(json.data)) {
          for (const item of json.data) {
            const p = `${item.ip || item.host}:${item.port}`;
            const parsed = parseProxy(p);
            if (parsed) set.add(parsed.label);
          }
          return;
        }
    } catch (e) { console.error(`[Harvester] JSON parse error from ${url}: ${e.message}`); }
      for (const line of text.split('\n')) {
        const p = parseProxy(line.trim());
        if (p) set.add(p.label);
      }
    } catch (e) { console.error(`[Harvester] Fetch error from ${url}: ${e.message}`); }
  }

  // Streaming: each batch tested → add to bank immediately
  async testInBatches(proxies, batchSize = 1500) {
    const alive = [];
    for (let i = 0; i < proxies.length; i += batchSize) {
      const batch = proxies.slice(i, i + batchSize);
      const results = await Promise.race([
        Promise.allSettled(batch.map(p => testProxy(p))),
        new Promise(resolve => setTimeout(resolve, 15000))
      ]) || [];
      const batchAlive = [];
      for (let j = 0; j < results.length; j++) {
        if (results[j].status === 'fulfilled' && results[j].value && results[j].value.ok) {
          batchAlive.push(batch[j]);
        }
      }
      if (batchAlive.length > 0) {
        this.bank.addMany(batchAlive);
        alive.push(...batchAlive);
        console.log(`[Harvester] Batch ${Math.floor(i/batchSize)+1}: +${batchAlive.length} (pool: ${this.bank.size})`);
      }
    }
    return alive;
  }

  async harvestAndVerify() {
    const start = Date.now();
    const raw = await this.collectAll();
    const rawList = [...raw];
    const fresh = this.seen.filterFresh(rawList);
    const alive = await this.testInBatches(fresh);
    this.seen.markTested(fresh);
    this.lastHarvest = new Date().toISOString();
    this.stats = { raw: rawList.length, fresh: fresh.length, alive: alive.length, time: Date.now() - start };
    console.log(`[Harvester] ${rawList.length} raw → ${fresh.length} fresh → ${alive.length} alive in ${this.stats.time}ms`);
    return this.stats;
  }

  getStatus() {
    return { ...this.stats, lastHarvest: this.lastHarvest, poolSize: this.bank.size, seenCount: this.seen.size, sourceCount: this.sources.length };
  }
}

export { ProxyHarvester, SeenTracker };
