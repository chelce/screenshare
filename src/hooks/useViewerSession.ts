"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import type {
  SignalPayload,
  SignalingInboundMessage,
} from "@/lib/signaling/types";

const SIGNALING_URL =
  process.env.NEXT_PUBLIC_SIGNALING_URL ?? "ws://localhost:8080";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302"] },
  { urls: ["stun:stun1.l.google.com:19302"] },
];

type ViewerStatus = "idle" | "connecting" | "waiting" | "watching" | "ended";

export type ViewerSessionState = {
  status: ViewerStatus;
  error: string | null;
  roomCode: string | null;
};

export function useViewerSession(videoRef: RefObject<HTMLVideoElement | null>) {
  const [status, setStatus] = useState<ViewerStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const viewerIdRef = useRef<string | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(
    (nextStatus: ViewerStatus = "idle") => {
    if (socketRef.current) {
      try {
        if (socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: "leave-room" }));
        }
      } catch (socketError) {
        console.warn("Error closing signaling socket", socketError);
      }
      socketRef.current.onmessage = null;
      socketRef.current.onclose = null;
      socketRef.current.onerror = null;
      socketRef.current.close();
      socketRef.current = null;
    }

    if (peerRef.current) {
      peerRef.current.onicecandidate = null;
      peerRef.current.ontrack = null;
      peerRef.current.onconnectionstatechange = null;
      peerRef.current.close();
      peerRef.current = null;
    }

    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => track.stop());
      remoteStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    viewerIdRef.current = null;
    setRoomCode(null);
    setStatus(nextStatus);
  }, [videoRef]);

  const attachRemoteStream = useCallback(
    (stream: MediaStream) => {
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      void videoRef.current.play().catch(() => {
        /* autoplay might fail silently; ignore */
      });
    },
    [videoRef],
  );

  const ensurePeerConnection = useCallback(() => {
    if (peerRef.current) {
      return peerRef.current;
    }

    const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerRef.current = peer;

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        const socket = socketRef.current;
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(
            JSON.stringify({
              type: "signal-host",
              payload: {
                kind: "ice-candidate",
                candidate: event.candidate.toJSON(),
              },
            }),
          );
        }
      }
    };

    peer.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) {
        remoteStreamRef.current = stream;
        attachRemoteStream(stream);
      }
    };

    peer.onconnectionstatechange = () => {
      const state = peer.connectionState;
      if (state === "connected") {
        setStatus("watching");
      } else if (state === "failed" || state === "disconnected") {
        setStatus("waiting");
      }
    };

    return peer;
  }, [attachRemoteStream]);

  const handleHostSignal = useCallback(
    async (payload: SignalPayload) => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return;
      }

      const peer = ensurePeerConnection();

      try {
        switch (payload.kind) {
          case "offer": {
            await peer.setRemoteDescription(payload.description);
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            socket.send(
              JSON.stringify({
                type: "signal-host",
                payload: {
                  kind: "answer",
                  description: answer,
                },
              }),
            );
            break;
          }
          case "ice-candidate":
            if (payload.candidate) {
              await peer.addIceCandidate(payload.candidate);
            }
            break;
          case "answer":
            // viewers should not receive answers from host
            break;
          default:
            console.warn("Unhandled signal from host", payload);
        }
      } catch (signalError) {
        console.error("Failed processing signal", signalError);
        setError("WebRTC negotiation failed.");
      }
    },
    [ensurePeerConnection],
  );

  const handleMessage = useCallback(
    (message: SignalingInboundMessage) => {
      switch (message.type) {
        case "room-joined":
          viewerIdRef.current = message.viewerId;
          setRoomCode(message.code);
          setStatus("waiting");
          break;
        case "signal":
          if (message.from === "host") {
            void handleHostSignal(message.payload);
          }
          break;
        case "room-closed":
          cleanup("ended");
          setError("The presenter ended the session.");
          break;
        case "error":
          cleanup();
          setError(`Signaling error: ${message.reason}`);
          break;
        default:
          break;
      }
    },
    [cleanup, handleHostSignal],
  );

  const handleSocketClose = useCallback(
    (event: CloseEvent) => {
      if (status === "idle") return;
      console.warn("Viewer signaling closed", event.code, event.reason);
      setError("Lost connection to presenter.");
  cleanup();
    },
    [cleanup, status],
  );

  const startViewing = useCallback(
    async (code: string) => {
      if (typeof window === "undefined") {
        return;
      }

      if (!/^\d{6}$/.test(code)) {
        setError("Room codes are six digits long.");
        return;
      }

      setError(null);
      setStatus("connecting");

      try {
        const socket = await openSocket(SIGNALING_URL);
        socketRef.current = socket;
        socket.onclose = handleSocketClose;
        socket.onerror = () => {
          setError("Unable to reach signaling server.");
        };
        socket.onmessage = (event) => {
          if (typeof event.data !== "string") return;
          try {
            const parsed = JSON.parse(event.data) as SignalingInboundMessage;
            handleMessage(parsed);
          } catch (parseError) {
            console.warn("Failed to parse viewer message", parseError);
          }
        };

        socket.send(
          JSON.stringify({
            type: "join-room",
            code,
          }),
        );
      } catch (err) {
        console.error("Unable to join room", err);
        setError("Unable to join room. Check your connection and code.");
        cleanup();
      }
    },
    [cleanup, handleMessage, handleSocketClose],
  );

  const stopViewing = useCallback(() => {
    cleanup();
  }, [cleanup]);

  useEffect(() => () => cleanup(), [cleanup]);

  return useMemo(
    () => ({
      state: { status, error, roomCode } as ViewerSessionState,
      startViewing,
      stopViewing,
      clearError: () => setError(null),
    }),
    [error, roomCode, startViewing, status, stopViewing],
  );
}

async function openSocket(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    try {
      const socket = new WebSocket(url);
      const cleanup = () => {
        socket.removeEventListener("open", handleOpen);
        socket.removeEventListener("error", handleError);
      };

      const handleOpen = () => {
        cleanup();
        resolve(socket);
      };

      const handleError = (event: Event) => {
        cleanup();
        reject(new Error(`Unable to connect to signaling server: ${event}`));
      };

      socket.addEventListener("open", handleOpen, { once: true });
      socket.addEventListener("error", handleError, { once: true });
    } catch (connectionError) {
      reject(connectionError);
    }
  });
}
