import { createServer } from "http";
import { randomUUID } from "node:crypto";
import { RawData, WebSocketServer, WebSocket } from "ws";

const PORT = Number(process.env.PORT ?? 8080);

type ClientRole = "host" | "viewer";

type SignalPayload = unknown;

type SignalTarget = "host" | "viewer";

type IncomingMessage =
  | { type: "register-host" }
  | { type: "join-room"; code?: string }
  | { type: "leave-room" }
  | { type: "signal-host"; payload: SignalPayload }
  | { type: "signal-viewer"; viewerId: string; payload: SignalPayload };

type OutgoingMessage =
  | { type: "room-registered"; code: string }
  | { type: "room-joined"; code: string; viewerId: string }
  | { type: "room-closed" }
  | { type: "viewer-joined"; viewerId: string }
  | { type: "viewer-left"; viewerId: string }
  | {
      type: "signal";
      from: SignalTarget;
      viewerId?: string;
      payload: SignalPayload;
    }
  | { type: "error"; reason: string; recoverable?: boolean };

type ClientContext = {
  id: string;
  socket: WebSocket;
  role: ClientRole;
  roomCode: string;
  viewerId?: string;
};

type Room = {
  code: string;
  host: ClientContext;
  viewers: Map<string, ClientContext>;
  createdAt: number;
};

const rooms = new Map<string, Room>();

const server = createServer();
const wss = new WebSocketServer({ server, path: "/" });

wss.on("connection", (socket: WebSocket) => {
  const connectionId = randomUUID();
  let context: ClientContext | null = null;

  socket.on("message", (raw: RawData) => {
    let parsed: IncomingMessage | undefined;
    try {
      parsed = JSON.parse(raw.toString());
    } catch (error) {
      console.warn(`[${connectionId}] Failed to parse signaling payload`, error);
      send(socket, {
        type: "error",
        reason: "invalid-json",
        recoverable: false,
      });
      return;
    }

    if (!parsed || typeof parsed !== "object") {
      send(socket, {
        type: "error",
        reason: "invalid-message",
        recoverable: false,
      });
      return;
    }

    switch (parsed.type) {
      case "register-host": {
        if (context) {
          send(socket, {
            type: "error",
            reason: "already-registered",
            recoverable: false,
          });
          return;
        }

        const code = generateRoomCode();
        const hostContext: ClientContext = {
          id: connectionId,
          socket,
          role: "host",
          roomCode: code,
        };

        context = hostContext;
        rooms.set(code, {
          code,
          host: hostContext,
          viewers: new Map(),
          createdAt: Date.now(),
        });

        send(socket, { type: "room-registered", code });
        break;
      }

      case "join-room": {
        if (context) {
          send(socket, {
            type: "error",
            reason: "already-in-room",
            recoverable: false,
          });
          return;
        }

        const code = sanitizeCode(parsed.code);
        if (!code) {
          send(socket, {
            type: "error",
            reason: "invalid-code",
            recoverable: true,
          });
          return;
        }

        const room = rooms.get(code);
        if (!room) {
          send(socket, {
            type: "error",
            reason: "room-not-found",
            recoverable: true,
          });
          return;
        }

        const viewerId = randomUUID();
        const viewerContext: ClientContext = {
          id: connectionId,
          socket,
          role: "viewer",
          roomCode: code,
          viewerId,
        };

        context = viewerContext;
        room.viewers.set(viewerId, viewerContext);

        send(socket, { type: "room-joined", code, viewerId });
        send(room.host.socket, { type: "viewer-joined", viewerId });
        break;
      }

      case "leave-room": {
        if (!context) {
          send(socket, {
            type: "error",
            reason: "not-in-room",
            recoverable: true,
          });
          return;
        }

        cleanupContext(context);
        context = null;
        break;
      }

      case "signal-host": {
        if (!context || context.role !== "viewer") {
          send(socket, {
            type: "error",
            reason: "not-authorized",
            recoverable: false,
          });
          return;
        }

        const room = rooms.get(context.roomCode);
        if (!room) {
          send(socket, {
            type: "error",
            reason: "room-not-found",
            recoverable: true,
          });
          return;
        }

        send(room.host.socket, {
          type: "signal",
          from: "viewer",
          viewerId: context.viewerId,
          payload: parsed.payload,
        });
        break;
      }

      case "signal-viewer": {
        if (!context || context.role !== "host") {
          send(socket, {
            type: "error",
            reason: "not-authorized",
            recoverable: false,
          });
          return;
        }

        const room = rooms.get(context.roomCode);
        if (!room) {
          send(socket, {
            type: "error",
            reason: "room-not-found",
            recoverable: true,
          });
          return;
        }

        const targetViewer = room.viewers.get(parsed.viewerId);
        if (!targetViewer) {
          send(socket, {
            type: "error",
            reason: "viewer-not-found",
            recoverable: true,
          });
          return;
        }

        send(targetViewer.socket, {
          type: "signal",
          from: "host",
          payload: parsed.payload,
        });
        break;
      }

      default:
        send(socket, {
          type: "error",
          reason: "unsupported-message",
          recoverable: false,
        });
    }
  });

  socket.on("close", () => {
    if (context) {
      cleanupContext(context);
      context = null;
    }
  });
});

function cleanupContext(ctx: ClientContext) {
  if (ctx.role === "host") {
    const room = rooms.get(ctx.roomCode);
    if (!room) {
      return;
    }

    rooms.delete(ctx.roomCode);
    room.viewers.forEach((viewer) => {
      send(viewer.socket, { type: "room-closed" });
      viewer.socket.close(1000, "host-disconnected");
    });
  } else if (ctx.role === "viewer") {
    const room = rooms.get(ctx.roomCode);
    if (!room) {
      return;
    }

    if (ctx.viewerId) {
      room.viewers.delete(ctx.viewerId);
      send(room.host.socket, { type: "viewer-left", viewerId: ctx.viewerId });
    }
  }
}

function generateRoomCode(): string {
  const maxAttempts = 1000;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const code = Math.floor(Math.random() * 1_000_000)
      .toString()
      .padStart(6, "0");
    if (!rooms.has(code)) {
      return code;
    }
  }
  throw new Error("Unable to allocate unique room code");
}

function sanitizeCode(code?: string): string | null {
  if (!code) return null;
  const trimmed = code.trim();
  if (!/^\d{6}$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function send(socket: WebSocket, payload: OutgoingMessage) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

server.listen(PORT, () => {
  console.log(`BeamShare signaling server running on port ${PORT}`);
});
