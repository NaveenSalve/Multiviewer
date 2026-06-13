# PhantomView OS

Professional multi-workspace cinematic surveillance app with desktop farm engine.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  React UI (Vite)                     │
│  ┌──────────────────────────────────────────────┐   │
│  │          MissionControlV24                   │   │
│  │  ┌────────┐  ┌──────────┐  ┌─────────────┐  │   │
│  │  │ Popup  │  │  Iframe  │  │   Desktop   │  │   │
│  │  │ Mode   │  │  Mode    │  │   Mode      │  │   │
│  │  └────────┘  └──────────┘  └──────┬──────┘  │   │
│  └────────────────────────────────────┼─────────┘   │
└───────────────────────────────────────┼─────────────┘
                                        │ HTTP API
┌───────────────────────────────────────▼─────────────┐
│              Desktop Engine (Node.js)                │
│  ┌──────────────────────────────────────────────┐   │
│  │           FarmEngine                          │   │
│  │  ┌────────────┐  ┌──────────┐  ┌─────────┐  │   │
│  │  │ Pool[10]   │  │  Proxy   │  │  Stats  │  │   │
│  │  │ Browsers   │  │  Router  │  │  Logger │  │   │
│  │  └────────────┘  └──────────┘  └─────────┘  │   │
│  └──────────────────────────────────────────────┘   │
└───────────────────────────────────────┬─────────────┘
                                        │
┌───────────────────────────────────────▼─────────────┐
│              Proxy Server (Node.js)                  │
│  HTTP CONNECT + SOCKS5 tunnel + HTML rewrite        │
└─────────────────────────────────────────────────────┘
```

## Features

- **View Farm** — Real browser automation via Puppeteer for traffic generation
- **Three Modes** — Popup (real tabs), Iframe (embedded), Desktop (Puppeteer pool)
- **Proxy Rotation** — HTTP/SOCKS5 proxy chaining with auto IP rotation
- **Anti-Detection** — WebRTC block, DNS force, fingerprint injection, canvas noise
- **Browser Pool** — 10 headless browsers reused across views (~650 MB RAM)
- **Content-Aware Timing** — Video(8-15s) / Image(2-5s) / Article(4-8s) auto-detection
- **Overlay Close** — Auto-dismisses signup/cookie/newsletter popups
- **Proxy Scraper** — Built-in free proxy fetcher from multiple sources
- **Per-tab Viewport** — Random screen sizes, referral params, behavioral patterns
- **Privacy Engine** — WebRTC kill, isolated partitions, temp profile cleanup

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
2. Select **Desktop** mode
3. Paste proxies (IP:PORT or socks5://IP:PORT)
4. Toggle Fast Mode for 5-10s views
5. Click **Launch**

## API Endpoints

### Proxy Server (`:3456`)

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Health check |
| `/proxy?url=TARGET&proxy=IP:PORT` | GET | Fetch URL through proxy |
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

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript 6 + Vite 8 |
| Styling | Tailwind CSS 3 + Framer Motion |
| Backend | Node.js + Puppeteer Core |
| 3D | React Three Fiber + Drei |
| State | Zustand 5 |
| Icons | Lucide React |
| Proxy | socks (SOCKS5) |

## License

MIT
