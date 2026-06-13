# PhantomView OS

Professional multi-workspace surveillance app with headless desktop farm engine.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  React UI (Vite)                     │
│  ┌──────────────────────────────────────────────┐   │
│  │          MissionControlV24                   │   │
│  │  ┌──────────┐  ┌─────────────┐              │   │
│  │  │  Iframe  │  │   Desktop   │              │   │
│  │  │  Mode    │  │   Mode      │              │   │
│  │  └──────────┘  └──────┬──────┘              │   │
│  └────────────────────────┼─────────────────────┘   │
└───────────────────────────┼─────────────────────────┘
                            │ HTTP API
┌───────────────────────────▼─────────────────────────┐
│              Desktop Engine (Node.js)                │
│  ┌──────────────────────────────────────────────┐   │
│  │           FarmEngine                          │   │
│  │  ┌────────────┐  ┌──────────┐  ┌─────────┐  │   │
│  │  │ Pool[10]   │  │  Proxy   │  │  Stats  │  │   │
│  │  │ Browsers   │  │  Router  │  │  Logger │  │   │
│  │  └────────────┘  └──────────┘  └─────────┘  │   │
│  └──────────────────────────────────────────────┘   │
└───────────────────────────────────┬─────────────────┘
                                    │
┌───────────────────────────────────▼─────────────────┐
│              Proxy Server (Node.js)                  │
│  Shared proxy-lib (HTTP CONNECT + SOCKS5 tunnel)    │
│  + Proxy Harvester + Proxy Bank (persistent pool)   │
└─────────────────────────────────────────────────────┘
```

## Features

- **Desktop Farm** — Headless Puppeteer browser pool for traffic generation
- **Two Modes** — Desktop (headless farm, screenshots in UI) or Iframe (in-page embed)
- **Proxy Rotation** — HTTP/SOCKS5 proxy chaining with auto IP rotation
- **Proxy Bank** — Persistent pool of verified proxies, auto-refresh every 5 min
- **Proxy Harvester** — Scrapes 50+ free proxy sources, tests via HTTPS (api.ipify.org)
- **Anti-Detection** — WebRTC block, DNS force, fingerprint injection, canvas noise
- **Browser Pool** — 10 headless browsers reused across views (~650 MB RAM)
- **Content-Aware Timing** — Video(8-15s) / Image(2-5s) / Article(4-8s) auto-detection
- **Overlay Close** — Auto-dismisses signup/cookie/newsletter popups
- **Per-tab Viewport** — Random screen sizes, referral params, behavioral patterns
- **Privacy Engine** — WebRTC kill, isolated partitions, temp profile cleanup
- **Shared Testing Lib** — `proxy-lib.mjs` with unified HTTPS proxy testing for both server and harvester

## Getting Started

### Prerequisites

- Node.js >= 20
- Microsoft Edge or Google Chrome installed
- npm

### Installation

```bash
cd phantomview-website
npm install
cd desktop
npm install
cd ..
```

### Running

**Quick start:**
```bash
.\start.bat
```

**Manual (3 terminals):**
```bash
# Terminal 1 — Dev server
cd phantomview-website
npm run dev

# Terminal 2 — Proxy server
node server/proxy-server.mjs

# Terminal 3 — Desktop farm engine
node desktop/main.mjs
```

Then open **http://localhost:5173**

### Usage

1. Enter target URL
2. Select **Desktop** mode (default)
3. Paste proxies (IP:PORT or socks5://IP:PORT)
4. Toggle Fast Mode for 5-10s views
5. Click **Launch View**
6. Screenshots appear in UI — no browser windows open

## API Endpoints

### Proxy Server (`:3456`)

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Health check |
| `/proxy?url=TARGET&proxy=IP:PORT` | GET | Fetch URL through proxy |
| `/proxy-bank/status` | GET | Proxy pool status |
| `/proxy-engine/harvest` | GET | Scrape & test new proxies |
| `/proxy-engine/status` | GET | Harvester status |
| `/test-proxy?proxy=IP:PORT` | GET | Test proxy connectivity |
| `/scrape-proxies` | GET | Fetch free public proxies |

### Desktop Engine (`:3457`)

| Endpoint | Method | Body | Description |
|---|---|---|---|
| `/status` | GET | — | Farm + pool status |
| `/config` | POST | `{fastMode, headless, concurrency}` | Update settings |
| `/start` | POST | `{url, proxies, fastMode?}` | Start farming |
| `/stop` | POST | — | Stop all browsers |
| `/pause` | POST | — | Pause views |
| `/resume` | POST | — | Resume views |
| `/screenshots` | GET | — | Live base64 screenshots |

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript 6 + Vite 8 |
| Styling | Tailwind CSS 3 + Framer Motion |
| Backend | Node.js + Puppeteer Core 24 |
| 3D | React Three Fiber + Drei |
| State | Zustand 5 |
| Icons | Lucide React |
| Proxy | socks (SOCKS5) |
| Shared Lib | `proxy-lib.mjs` (unified HTTP/SOCKS5 testing) |

## License

MIT
