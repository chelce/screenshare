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

type HostStatus =
  | "idle"
  | "requesting-permission"
  | "connecting"
  | "waiting"
  | "live";

export type HostSessionState = {
  status: HostStatus;
  roomCode: string | null;
  viewerCount: number;
  error: string | null;
};

export function useHostSession(videoRef: RefObject<HTMLVideoElement | null>) {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [status, setStatus] = useState<HostStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [viewerCount, setViewerCount] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const readyViewersRef = useRef<Set<string>>(new Set());
  const cleanup = useCallback(() => {
    readyViewersRef.current.clear();
    setViewerCount(0);

    peersRef.current.forEach((pc) => {
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      pc.close();
    });
    peersRef.current.clear();

    if (socketRef.current) {
      try {
        if (socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: "leave-room" }));
        }
      } catch (socketError) {
        console.warn("Error while notifying signaling server", socketError);
      }
      socketRef.current.onclose = null;
      socketRef.current.onerror = null;
      socketRef.current.onmessage = null;
      socketRef.current.close();
      socketRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setRoomCode(null);
    setStatus("idle");
  }, [videoRef]);

  const handleSocketClose = useCallback(
    (event: CloseEvent) => {
      if (status === "idle") {
        return;
      }
      console.warn("Signaling connection closed", event.code, event.reason);
      setError("Lost connection to signaling server.");
      cleanup();
    },
    [cleanup, status],
  );

  const handleSocketError = useCallback((event: Event) => {
    console.error("Signaling socket error", event);
    setError("Unable to reach signaling server.");
  }, []);

  const setupPreview = useCallback(
    (stream: MediaStream) => {
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      void videoRef.current.play().catch(() => {
        /* autoplay can fail silently; ignore */
      });
    },
    [videoRef],
  );

  const handleViewerDisconnected = useCallback((viewerId: string) => {
    const peer = peersRef.current.get(viewerId);
    if (peer) {
      peer.close();
      peersRef.current.delete(viewerId);
    }
    if (readyViewersRef.current.delete(viewerId)) {
      setViewerCount(readyViewersRef.current.size);
      if (readyViewersRef.current.size === 0) {
        setStatus("waiting");
      }
    }
  }, []);

  const sendSignal = useCallback(
    (viewerId: string, payload: SignalPayload) => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        setError("Signaling connection is not ready.");
        return;
      }
      socket.send(
        JSON.stringify({
          type: "signal-viewer",
          viewerId,
          payload,
        }),
      );
    },
    [],
  );

  const handleViewerSignal = useCallback(
    async (viewerId: string, payload: SignalPayload) => {
      const peer = peersRef.current.get(viewerId);
      if (!peer) {
        console.warn("No peer connection for viewer", viewerId);
        return;
      }

      try {
        switch (payload.kind) {
          case "answer":
            await peer.setRemoteDescription(payload.description);
            break;
          case "ice-candidate":
            if (payload.candidate) {
              await peer.addIceCandidate(payload.candidate);
            }
            break;
          default:
            console.warn("Unhandled signal from viewer", payload);
        }
      } catch (signalError) {
        console.error("Failed to process viewer signal", signalError);
        setError("Failed to exchange media with a viewer.");
      }
    },
    [setError],
  );

  const createPeerConnection = useCallback(
    async (viewerId: string) => {
      const stream = streamRef.current;
      const socket = socketRef.current;
      if (!stream || !socket) {
        return;
      }

      if (peersRef.current.has(viewerId)) {
        return;
      }

      const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peersRef.current.set(viewerId, peer);

      stream.getTracks().forEach((track) => {
        peer.addTrack(track, stream);
      });

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal(viewerId, {
            kind: "ice-candidate",
            candidate: event.candidate.toJSON(),
          });
        }
      };

      peer.onconnectionstatechange = () => {
        const state = peer.connectionState;
        if (state === "connected") {
          readyViewersRef.current.add(viewerId);
          setViewerCount(readyViewersRef.current.size);
          setStatus("live");
        } else if (state === "disconnected" || state === "failed") {
          readyViewersRef.current.delete(viewerId);
          setViewerCount(readyViewersRef.current.size);
          if (state === "failed") {
            console.warn("Peer connection failed for viewer", viewerId);
          }
          if (readyViewersRef.current.size === 0) {
            setStatus("waiting");
          }
        } else if (state === "closed") {
          readyViewersRef.current.delete(viewerId);
          setViewerCount(readyViewersRef.current.size);
          if (readyViewersRef.current.size === 0) {
            setStatus("waiting");
          }
        }
      };

      try {
        const offer = await peer.createOffer({ offerToReceiveVideo: false });
        await peer.setLocalDescription(offer);
        sendSignal(viewerId, {
          kind: "offer",
          description: offer,
        });
      } catch (offerError) {
        console.error("Failed to create WebRTC offer", offerError);
        setError("Unable to set up WebRTC offer.");
        handleViewerDisconnected(viewerId);
      }
    },
    [handleViewerDisconnected, sendSignal, setError],
  );

  const handleMessage = useCallback(
    (message: SignalingInboundMessage) => {
      switch (message.type) {
        case "room-registered":
          setRoomCode(message.code);
          setStatus("waiting");
          break;
        case "viewer-joined":
          void createPeerConnection(message.viewerId);
          break;
        case "viewer-left":
          handleViewerDisconnected(message.viewerId);
          break;
        case "signal":
          if (message.from === "viewer" && message.viewerId) {
            void handleViewerSignal(message.viewerId, message.payload);
          }
          break;
        case "error":
          setError(`Signaling error: ${message.reason}`);
          break;
        default:
          break;
      }
    },
    [createPeerConnection, handleViewerDisconnected, handleViewerSignal],
  );

  const startSharing = useCallback(async () => {
    if (typeof window === "undefined") {
      return;
    }

    if (status === "requesting-permission" || status === "connecting") {
      return;
    }

    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError("Screen sharing isn't supported in this browser.");
      return;
    }

    setError(null);
    setStatus("requesting-permission");

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 30, max: 60 },
          width: { ideal: 1920 },
        },
        audio: true,
      });

      streamRef.current = stream;
      setupPreview(stream);

      const [videoTrack] = stream.getVideoTracks();
      if (videoTrack) {
        videoTrack.addEventListener("ended", () => {
          cleanup();
        });
      }

      setStatus("connecting");

      const socket = await openSocket(SIGNALING_URL);
      socketRef.current = socket;

      socket.onclose = handleSocketClose;
      socket.onerror = handleSocketError;
      socket.onmessage = (event) => {
        if (typeof event.data !== "string") return;
        try {
          const parsed = JSON.parse(event.data) as SignalingInboundMessage;
          handleMessage(parsed);
        } catch (parseError) {
          console.warn("Failed to parse signaling payload", parseError);
        }
      };

      socket.send(JSON.stringify({ type: "register-host" }));
    } catch (err) {
      console.error("Failed to start sharing", err);
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Screen sharing was cancelled or blocked.",
      );
      cleanup();
    }
  }, [cleanup, handleMessage, handleSocketClose, handleSocketError, setupPreview, status]);

  const stopSharing = useCallback(() => {
    cleanup();
  }, [cleanup]);

  useEffect(() => () => cleanup(), [cleanup]);

  return useMemo(
    () => ({
      state: { roomCode, status, viewerCount, error } as HostSessionState,
      startSharing,
      stopSharing,
      clearError: () => setError(null),
    }),
    [error, roomCode, startSharing, status, stopSharing, viewerCount],
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
