## BeamShare

BeamShare is a lightweight, browser-based screen sharing app built with Next.js and WebRTC. Hosts receive a six-digit room code that viewers can enter from any device to watch the live stream—no extensions or installs required.

### ✨ Features

- **Instant rooms** – hosts generate a unique six-digit code with one click.
- **Peer-to-peer video** – powered by WebRTC with Google STUN servers for global reach.
- **Minimal signaling layer** – Node-based WebSocket server coordinates offer/answer and ICE exchange.
- **Responsive UI** – optimized for desktop and mobile viewing.

---

## Prerequisites

- Node.js 18+ (required by Next.js 15)
- npm 9+ (bundled with Node 18)
- Modern browser with `getDisplayMedia` support (Chrome, Edge, Firefox, Safari)

---

## Local development

1. **Install dependencies**

	```powershell
	npm install
	```

2. **Start the signaling server** (defaults to `ws://localhost:8080`)

	```powershell
	npm run dev:signaling
	```

3. **Start the Next.js app** (in a second terminal)

	```powershell
	npm run dev
	```

4. Visit [http://localhost:3000](http://localhost:3000) and open the site in at least two browser windows/tabs to test the host/viewer flows.

> **Tip:** By default the frontend points to `ws://localhost:8080`. Override this with `NEXT_PUBLIC_SIGNALING_URL` if you run the signaling server elsewhere.

---

## Building for production

Compile both the frontend (Next.js) and the signaling server before deploying:

```powershell
npm run build           # Next.js (outputs to .next)
npm run build:signaling # Node signaling server (outputs to dist/server)
```

To run locally in production mode:

```powershell
# Terminal 1 – signaling server
npm run start:signaling

# Terminal 2 – Next.js
npm run start
```

---

## Deployment guide

### Frontend (Vercel)

1. Deploy this repository to Vercel.
2. In the Vercel project settings add an environment variable:
	- `NEXT_PUBLIC_SIGNALING_URL = wss://your-signaling-host.example.com`
3. Redeploy to propagate the variable to all environments.

### Signaling server (any Node-friendly host)

The signaling service is a lightweight Node app using `ws`. Any provider that supports a persistent Node process + WebSocket upgrades will work (Fly.io, Render, Railway, Azure Container Apps, etc.).

1. Deploy `dist/server/index.js` (or run `npm run dev:signaling`) behind HTTPS/WSS.
2. Expose port `8080` (configurable via `PORT` env var).
3. Ensure the deployed URL is reachable via secure WebSockets (`wss://`).
4. Update `NEXT_PUBLIC_SIGNALING_URL` everywhere the frontend is hosted.

> **Note:** Vercel currently requires a separate service for long-lived WebSocket connections. Keep the signaling server off Vercel and reference it via the public URL.

---

## Scripts reference

| Script | Description |
| --- | --- |
| `npm run dev` | Next.js dev server with Turbopack |
| `npm run dev:signaling` | Runs the WebSocket signaling server with `tsx` |
| `npm run build` | Builds the Next.js application |
| `npm run build:signaling` | Compiles the TypeScript signaling server to `dist/` |
| `npm run start` | Starts the production Next.js server |
| `npm run start:signaling` | Starts the compiled signaling server |
| `npm run lint` | Runs ESLint/type-checking |

---

## Project structure

```
src/
  app/...............Next.js App Router entry + styles
  hooks/.............Reusable host/viewer WebRTC hooks
  lib/signaling/.....Shared signaling message contracts
server/..............Standalone Node WebSocket signaling server
tsconfig.server.json  TypeScript config for the server build
```

---

## Troubleshooting

- **Browser denies screen capture** – make sure you grant permission when prompted and that the page is served over HTTPS (required by most browsers).
- **Viewers never connect** – verify the signaling server URL is correct and reachable from both presenter and viewers. Check network/firewall rules that might block WebSockets.
- **Black screen** – some browsers block DRM-protected content from being shared. Try sharing the full screen instead of a protected tab.

---

## License

This project is provided as-is without an explicit license. Add your preferred license before distributing.
