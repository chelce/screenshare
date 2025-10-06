"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { useHostSession, type HostSessionState } from "@/hooks/useHostSession";
import styles from "./page.module.css";

type ViewMode = "landing" | "host" | "viewer";

export default function Home() {
  const [mode, setMode] = useState<ViewMode>("landing");

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <span className={styles.badge}>BETA</span>
          <h1>BeamShare</h1>
          <p>
            Start a room, share your screen, and invite others with a six-digit
            code—no installs, just the browser.
          </p>
        </header>

        {mode === "landing" ? (
          <section className={styles.actions}>
            <button
              type="button"
              className={styles.card}
              onClick={() => setMode("host")}
            >
              <h2>Start sharing</h2>
              <p>Launch a room and broadcast any screen, window, or tab.</p>
              <span className={styles.linkCue}>I want to present →</span>
            </button>
            <button
              type="button"
              className={styles.card}
              onClick={() => setMode("viewer")}
            >
              <h2>Join a room</h2>
              <p>Enter a code from the presenter to see their screen live.</p>
              <span className={styles.linkCue}>I want to watch →</span>
            </button>
          </section>
        ) : mode === "host" ? (
          <HostPanel onBack={() => setMode("landing")} />
        ) : (
          <ViewerPanel onBack={() => setMode("landing")} />
        )}

        <footer className={styles.footer}>
          <p>
            Peer-to-peer powered by WebRTC. Works on Chrome, Edge, Firefox, and
            Safari.
          </p>
        </footer>
      </div>
    </div>
  );
}

function HostPanel({ onBack }: { onBack: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { state, startSharing, stopSharing, clearError } =
    useHostSession(videoRef);

  const { status, roomCode, viewerCount, error } = state;
  const isStarting = status === "requesting-permission" || status === "connecting";
  const isActive = status === "waiting" || status === "live";

  const statusLabel = useMemo(
    () => hostStatusCopy(status, viewerCount),
    [status, viewerCount],
  );

  const handleStart = () => {
    clearError();
    void startSharing();
  };

  const handleStop = () => {
    stopSharing();
  };

  const handleBack = () => {
    stopSharing();
    onBack();
  };

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <button type="button" className={styles.backButton} onClick={handleBack}>
          ← Back
        </button>
        <div>
          <h2>Share your screen</h2>
          <p className={styles.helper}>
            Choose any screen, window, or tab. We’ll keep it in sync for everyone
            who joins your room.
          </p>
        </div>
      </div>

      <div className={styles.roomCode}>
        <span>Room code</span>
        <strong>{formatRoomCode(roomCode)}</strong>
      </div>

      <div className={styles.controls}>
        {isActive ? (
          <button
            type="button"
            className={styles.criticalButton}
            onClick={handleStop}
          >
            Stop sharing
          </button>
        ) : (
          <button
            type="button"
            className={styles.primaryButton}
            onClick={handleStart}
            disabled={isStarting}
          >
            {isStarting ? "Preparing…" : "Start screen share"}
          </button>
        )}
        <p className={styles.status}>{statusLabel}</p>
      </div>

      <div className={styles.videoFrame}>
        <video
          ref={videoRef}
          className={styles.video}
          autoPlay
          muted
          playsInline
        />
        {!isActive && status !== "connecting" && (
          <span className={styles.videoPlaceholder}>Preview</span>
        )}
      </div>

      {error && <p className={styles.error}>{error}</p>}
    </section>
  );
}

function ViewerPanel({ onBack }: { onBack: () => void }) {
  const [code, setCode] = useState("");

  const isCodeValid = useMemo(() => /^\d{6}$/.test(code), [code]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isCodeValid) {
      return;
    }
    // Open viewer in a new window
    const viewerUrl = `${window.location.origin}/viewer?code=${code}`;
    window.open(viewerUrl, '_blank', 'width=1280,height=720,resizable=yes');
  };

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <button type="button" className={styles.backButton} onClick={onBack}>
          ← Back
        </button>
        <div>
          <h2>Join a room</h2>
          <p className={styles.helper}>
            Enter the six-digit room code to open the viewer in a new window.
          </p>
        </div>
      </div>

      <form className={styles.joinForm} onSubmit={handleSubmit}>
        <label htmlFor="room-code">Room code</label>
        <input
          id="room-code"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          placeholder="123456"
          value={code}
          onChange={(event) => {
            const sanitized = event.target.value.replace(/[^0-9]/g, "");
            setCode(sanitized);
          }}
          className={styles.codeInput}
          aria-describedby="code-help"
          aria-invalid={!isCodeValid && code.length > 0}
        />
        <span id="code-help" className={styles.helper}>
          Codes are always six digits.
        </span>
        <div className={styles.controls}>
          <button
            type="submit"
            className={styles.primaryButton}
            disabled={!isCodeValid}
          >
            Open viewer window
          </button>
        </div>
      </form>
    </section>
  );
}

function formatRoomCode(code: string | null) {
  if (!code) return "———";
  return code.replace(/(\d{3})(\d{3})/, "$1\u2009$2");
}

function hostStatusCopy(
  status: HostSessionState["status"],
  viewerCount: number,
) {
  switch (status) {
    case "idle":
      return "Ready when you are.";
    case "requesting-permission":
      return "Waiting for you to pick what to share.";
    case "connecting":
      return "Connecting to the signaling server…";
    case "waiting":
      return viewerCount > 0
        ? `Connected to ${viewerCount} viewer${viewerCount === 1 ? "" : "s"}.`
        : "Share the code so viewers can join.";
    case "live":
      return `Streaming to ${viewerCount} viewer${viewerCount === 1 ? "" : "s"}.`;
    default:
      return "";
  }
}
