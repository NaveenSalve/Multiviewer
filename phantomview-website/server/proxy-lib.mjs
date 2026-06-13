import net from 'net';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import { SocksClient } from 'socks';

const UA_POOL = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
];

export function getRandomUA() {
  return UA_POOL[Math.floor(Math.random() * UA_POOL.length)];
}

export function parseProxy(str) {
  if (!str || typeof str !== 'string') return null;
  let raw = str.trim();

  let type = 'http';
  if (raw.startsWith('socks5://') || raw.startsWith('socks://')) {
    type = 'socks5';
    raw = raw.replace(/^(socks5?:\/\/)/, '');
  }

  const lastColon = raw.lastIndexOf(':');
  if (lastColon < 1) return null;

  const parts = raw.split(':');
  const port = parseInt(parts[parts.length - 1], 10);
  if (isNaN(port) || port < 1 || port > 65535) {
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
    return null;
  }
  if (parts.length === 4) {
    return { type, host: parts[0], port, user: parts[2], pass: parts[3], label: `${parts[0]}:${port}` };
  }
  if (parts.length >= 5) {
    return { type, host: parts[0], port, user: parts[2], pass: parts.slice(3).join(':'), label: `${parts[0]}:${port}` };
  }
  return null;
}

function httpConnectTunnel(proxyHost, proxyPort, targetHost, targetPort, auth, connectTimeout = 30000) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error('CONNECT tunnel timeout'));
    }, connectTimeout);

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

export async function fetchThroughProxy(targetUrl, proxyInfo, connectTimeout = 30000) {
  const url = new URL(targetUrl);
  const isHttps = url.protocol === 'https:';
  const targetPort = parseInt(url.port, 10) || (isHttps ? 443 : 80);
  const auth = proxyInfo.user ? Buffer.from(`${proxyInfo.user}:${proxyInfo.pass}`).toString('base64') : null;

  let tunnelSocket;

  if (proxyInfo.type === 'socks5') {
    const destination = { host: url.hostname, port: targetPort };
    const proxy = {
      host: proxyInfo.host,
      port: proxyInfo.port,
      userId: proxyInfo.user || undefined,
      password: proxyInfo.pass || undefined,
    };
    const conn = await SocksClient.createConnection({ destination, proxy, command: 'connect', timeout: connectTimeout });
    tunnelSocket = conn.socket;
  } else {
    tunnelSocket = await httpConnectTunnel(proxyInfo.host, proxyInfo.port, url.hostname, targetPort, auth, connectTimeout);
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

export async function fastTestProxy(proxyStr, timeout = 8000) {
  const proxyInfo = parseProxy(proxyStr);
  if (!proxyInfo) return { proxy: proxyStr, ok: false, error: 'Invalid', latency: 0 };
  const start = Date.now();
  try {
    const result = await fetchThroughProxy('https://api.ipify.org?format=json', proxyInfo, timeout);
    const data = JSON.parse(result.body.toString());
    return { proxy: proxyStr, ok: true, ip: data.ip, latency: Date.now() - start };
  } catch (e) {
    return { proxy: proxyStr, ok: false, error: 'Dead', latency: Date.now() - start };
  }
}

export async function fastTestBatch(proxyList, batchSize = 100) {
  const alive = [];
  for (let i = 0; i < proxyList.length; i += batchSize) {
    const batch = proxyList.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map(p => fastTestProxy(p)));
    for (let j = 0; j < results.length; j++) {
      if (results[j].status === 'fulfilled' && results[j].value.ok) alive.push(results[j].value.proxy);
    }
  }
  return alive;
}
