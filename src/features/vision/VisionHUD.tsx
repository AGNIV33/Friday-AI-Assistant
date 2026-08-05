// ─── VisionHUD — Iron Man / JARVIS-style Visual Overlay ───────────────────────
// Renders the vision analysis overlay with scanning, analyzing, and result modes.
// Fully self-contained — uses its own CSS file for animations.

import React, { useEffect, useState, useRef, type RefObject } from 'react';
import './VisionHUD.css';

export type VisionMode = 'idle' | 'scanning' | 'analyzing' | 'result' | 'screen';

interface VisionHUDProps {
  mode: VisionMode;
  videoRef?: RefObject<HTMLVideoElement | null>;
  result?: string;
  onClose: () => void;
  screenThumbnail?: string | null;
  cursorPosition?: { x: number; y: number } | null;
  screenDimensions?: { width: number; height: number } | null;
}

// Generate random hex strings for the analyzing background
function randomHex(length: number): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

export default function VisionHUD({
  mode,
  videoRef,
  result,
  onClose,
  screenThumbnail,
  cursorPosition,
  screenDimensions,
}: VisionHUDProps) {
  const [hexLines, setHexLines] = useState<string[]>([]);
  const [displayedText, setDisplayedText] = useState('');
  const [timestamp, setTimestamp] = useState('');
  const typewriterRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Hex background animation for analyzing mode ──
  useEffect(() => {
    if (mode !== 'analyzing') {
      setHexLines([]);
      return;
    }
    const interval = setInterval(() => {
      setHexLines(Array.from({ length: 20 }, () => randomHex(48)));
    }, 100);
    return () => clearInterval(interval);
  }, [mode]);

  // ── Typewriter effect for result mode ──
  useEffect(() => {
    if (mode !== 'result' || !result) {
      setDisplayedText('');
      return;
    }

    setTimestamp(new Date().toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }));

    let index = 0;
    setDisplayedText('');

    const tick = () => {
      if (index < result.length) {
        setDisplayedText(result.slice(0, index + 1));
        index++;
        typewriterRef.current = setTimeout(tick, 30);
      }
    };
    typewriterRef.current = setTimeout(tick, 200); // initial delay

    return () => {
      if (typewriterRef.current) clearTimeout(typewriterRef.current);
    };
  }, [mode, result]);

  // ── Sync video stream from capture service ──
  const localVideoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (localVideoRef.current && videoRef?.current?.srcObject) {
      localVideoRef.current.srcObject = videoRef.current.srcObject;
    }
  }, [videoRef?.current, mode]);

  // ── Screen mode: position in top-right; otherwise bottom-right ──
  const isScreenMode = mode === 'screen';

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    ...(isScreenMode
      ? { top: 20, right: 20, width: 320 }
      : { bottom: 20, right: 20, width: 340 }),
    zIndex: 9999,
    background: 'rgba(10, 15, 26, 0.92)',
    border: '1px solid rgba(0, 229, 255, 0.3)',
    borderRadius: 8,
    boxShadow: '0 0 30px rgba(0, 229, 255, 0.15), inset 0 0 60px rgba(0, 229, 255, 0.03)',
    fontFamily: "system-ui, 'Courier New', monospace",
    color: '#e0f7ff',
    overflow: 'hidden',
  };

  return (
    <div className="vision-hud-enter" style={containerStyle}>
      {/* Corner Brackets */}
      <div className="vision-corner tl" />
      <div className="vision-corner tr" />
      <div className="vision-corner bl" />
      <div className="vision-corner br" />

      {/* Close Button */}
      <button
        onClick={onClose}
        className="vision-close"
        style={{
          position: 'absolute',
          top: 8,
          right: 12,
          zIndex: 20,
          background: 'none',
          border: 'none',
          color: '#00e5ff88',
          fontSize: 14,
          fontFamily: 'monospace',
          cursor: 'pointer',
          padding: '2px 4px',
          transition: 'color 0.2s, text-shadow 0.2s',
        }}
        title="Close Vision"
      >
        [×]
      </button>

      {/* ─── Camera Feed (scanning/analyzing/result with camera) ─── */}
      {videoRef?.current && mode !== 'screen' && (
        <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', overflow: 'hidden' }}>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              transform: 'scaleX(-1)', // mirror the webcam preview so it acts like a mirror
            }}
          />
          {/* Scan line over video */}
          {(mode === 'scanning' || mode === 'analyzing') && (
            <div className="vision-scan-line" />
          )}
          {/* Corner brackets over video */}
          <div className="vision-corner tl" />
          <div className="vision-corner tr" />
          <div className="vision-corner bl" />
          <div className="vision-corner br" />
        </div>
      )}

      {/* ─── Content Area ─── */}
      <div style={{ padding: '16px 16px 10px', position: 'relative', minHeight: 80 }}>

        {/* Hex background (analyzing mode) */}
        {mode === 'analyzing' && (
          <div className="vision-hex-bg">
            {hexLines.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        )}

        {/* ── IDLE ── */}
        {mode === 'idle' && (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{
              fontSize: 10,
              letterSpacing: 3,
              textTransform: 'uppercase',
              color: '#00e5ff88',
              marginBottom: 8,
            }}>
              VISION SYSTEMS STANDBY
            </div>
          </div>
        )}

        {/* ── SCANNING ── */}
        {mode === 'scanning' && (
          <div style={{ textAlign: 'center', position: 'relative', zIndex: 2 }}>
            {/* Scan line (when no video feed) */}
            {!videoRef?.current && <div className="vision-scan-line" />}
            <div style={{
              fontSize: 13,
              letterSpacing: 4,
              textTransform: 'uppercase',
              color: '#00e5ff',
              marginBottom: 8,
            }}>
              SCANNING<span className="vision-blink">_</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 6 }}>
              <span className="vision-dot" />
              <span className="vision-dot" />
              <span className="vision-dot" />
            </div>
          </div>
        )}

        {/* ── ANALYZING ── */}
        {mode === 'analyzing' && (
          <div style={{ textAlign: 'center', position: 'relative', zIndex: 2 }}>
            {/* Spinner */}
            <svg className="vision-spinner" width="48" height="48" viewBox="0 0 90 90" style={{ margin: '0 auto 12px' }}>
              <circle cx="45" cy="45" r="40" />
            </svg>
            <div style={{
              fontSize: 11,
              letterSpacing: 3,
              textTransform: 'uppercase',
              color: '#00e5ff',
              marginBottom: 10,
            }}>
              NEURAL PROCESSING...
            </div>
            {/* Progress bar */}
            <div style={{
              width: '80%',
              margin: '0 auto',
              height: 2,
              background: 'rgba(0, 229, 255, 0.15)',
              borderRadius: 1,
              overflow: 'hidden',
            }}>
              <div className="vision-progress-bar" />
            </div>
          </div>
        )}

        {/* ── RESULT ── */}
        {mode === 'result' && (
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{
                fontSize: 9,
                letterSpacing: 3,
                textTransform: 'uppercase',
                color: '#00e5ff',
                fontWeight: 600,
              }}>
                VISUAL ANALYSIS COMPLETE
              </div>
              <div style={{ fontSize: 9, color: '#00e5ff55', fontFamily: 'monospace' }}>
                {timestamp}
              </div>
            </div>
            <div
              className="vision-typewriter"
              style={{
                fontSize: 12,
                lineHeight: 1.6,
                color: '#c8e6ff',
                maxHeight: 200,
                overflowY: 'auto',
                paddingRight: 4,
              }}
            >
              {displayedText}
              {displayedText.length < (result?.length || 0) && (
                <span className="vision-blink" style={{ color: '#00e5ff' }}>▋</span>
              )}
            </div>
          </div>
        )}

        {/* ── SCREEN MODE ── */}
        {mode === 'screen' && (
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{
              fontSize: 10,
              letterSpacing: 3,
              textTransform: 'uppercase',
              color: '#ff6b35',
              marginBottom: 10,
              textAlign: 'center',
            }}>
              ANALYZING DISPLAY...
            </div>
            {/* Mini screen thumbnail */}
            {screenThumbnail && (
              <div style={{ position: 'relative', margin: '0 auto', width: '100%', borderRadius: 4, overflow: 'hidden' }}>
                <img
                  src={screenThumbnail}
                  alt="Screen capture"
                  style={{ width: '100%', opacity: 0.4, display: 'block', borderRadius: 4 }}
                />
                {/* Cursor ring on thumbnail */}
                {cursorPosition && screenDimensions && (
                  <div
                    className="vision-cursor-ring"
                    style={{
                      left: `${(cursorPosition.x / screenDimensions.width) * 100}%`,
                      top: `${(cursorPosition.y / screenDimensions.height) * 100}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  />
                )}
                {/* Scan line on thumbnail */}
                <div className="vision-scan-line" />
              </div>
            )}
            {/* Spinner below */}
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <svg className="vision-spinner" width="32" height="32" viewBox="0 0 90 90">
                <circle cx="45" cy="45" r="40" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* ─── Status Bar ─── */}
      <div style={{
        borderTop: '1px solid rgba(0, 229, 255, 0.12)',
        padding: '6px 16px',
        display: 'flex',
        alignItems: 'center',
        fontSize: 9,
        letterSpacing: 2,
        textTransform: 'uppercase',
        color: '#00e5ff66',
        fontFamily: 'monospace',
      }}>
        <span className={`vision-status-dot ${mode === 'idle' ? 'inactive' : ''}`} />
        <span>
          NEMOTRON VISION · {mode === 'idle' ? 'READY' : mode === 'result' ? 'COMPLETE' : 'ACTIVE'}
        </span>
      </div>
    </div>
  );
}
