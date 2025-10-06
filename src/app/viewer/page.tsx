"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useViewerSession } from "@/hooks/useViewerSession";
import styles from "./viewer.module.css";

function ViewerContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { state, startViewing, stopViewing } = useViewerSession(videoRef);
  const { status, error } = state;

  useEffect(() => {
    if (code && code.length === 6) {
      void startViewing(code);
    }
  }, [code, startViewing]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      videoRef.current?.requestFullscreen().catch((err) => {
        console.error("Error attempting to enable fullscreen:", err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const handleLeave = () => {
    stopViewing();
    window.close();
  };

  const statusMessage = () => {
    switch (status) {
      case "connecting":
        return "Connecting to room...";
      case "waiting":
        return "Waiting for host to start sharing...";
      case "watching":
        return null;
      case "ended":
        return "Host has stopped sharing";
      default:
        return "Ready";
    }
  };

  if (!code || code.length !== 6) {
    return (
      <div className={styles.errorPage}>
        <h1>Invalid Room Code</h1>
        <p>Please use a valid 6-digit room code.</p>
      </div>
    );
  }

  return (
    <div className={styles.viewerContainer}>
      <div className={styles.videoWrapper}>
        <video
          ref={videoRef}
          className={styles.video}
          autoPlay
          playsInline
          controls={false}
        />
        
        {status !== "watching" && (
          <div className={styles.overlay}>
            <div className={styles.statusMessage}>
              {error ? (
                <>
                  <span className={styles.errorIcon}>⚠</span>
                  <p>{error}</p>
                </>
              ) : (
                <>
                  <div className={styles.spinner}></div>
                  <p>{statusMessage()}</p>
                </>
              )}
            </div>
          </div>
        )}

        <div className={styles.controls}>
          <div className={styles.roomInfo}>
            <span className={styles.badge}>Room {code.replace(/(\d{3})(\d{3})/, "$1 $2")}</span>
          </div>
          <div className={styles.buttonGroup}>
            {!isFullscreen && (
              <button
                type="button"
                className={styles.controlButton}
                onClick={toggleFullscreen}
                title="Fullscreen"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M3 7V3H7M13 3H17V7M17 13V17H13M7 17H3V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Fullscreen
              </button>
            )}
            <button
              type="button"
              className={styles.leaveButton}
              onClick={handleLeave}
            >
              Leave
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ViewerPage() {
  return (
    <Suspense fallback={<div style={{ background: '#000', width: '100vw', height: '100vh' }} />}>
      <ViewerContent />
    </Suspense>
  );
}
