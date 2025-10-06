export type SignalPayload =
  | {
      kind: "offer";
      description: RTCSessionDescriptionInit;
    }
  | {
      kind: "answer";
      description: RTCSessionDescriptionInit;
    }
  | {
      kind: "ice-candidate";
      candidate: RTCIceCandidateInit;
    };

export type SignalingOutboundMessage =
  | {
      type: "register-host";
    }
  | {
      type: "join-room";
      code: string;
    }
  | {
      type: "leave-room";
    }
  | {
      type: "signal-host";
      payload: SignalPayload;
    }
  | {
      type: "signal-viewer";
      viewerId: string;
      payload: SignalPayload;
    };

export type SignalingInboundMessage =
  | {
      type: "room-registered";
      code: string;
    }
  | {
      type: "room-joined";
      code: string;
      viewerId: string;
    }
  | {
      type: "room-closed";
    }
  | {
      type: "viewer-joined";
      viewerId: string;
    }
  | {
      type: "viewer-left";
      viewerId: string;
    }
  | {
      type: "signal";
      from: "host" | "viewer";
      payload: SignalPayload;
      viewerId?: string;
    }
  | {
      type: "error";
      reason: string;
      recoverable?: boolean;
    };
