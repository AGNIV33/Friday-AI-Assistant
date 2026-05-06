/**
 * WidgetShell — Futuristic draggable container for all Friday widgets.
 * 
 * Features:
 * - Glassmorphic background with holographic border
 * - Drag handle (top bar) for free positioning anywhere on screen
 * - Close button with hover glow
 * - Smooth entry/exit animations
 * - Responsive sizing
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { X, GripHorizontal } from 'lucide-react';

export interface WidgetShellProps {
  id: string;
  title: string;
  width?: number;
  height?: number;
  initialX?: number;
  initialY?: number;
  onClose: (id: string) => void;
  children: React.ReactNode;
  accentColor?: string;
}

export default function WidgetShell({
  id, title, width = 340, height = 260,
  initialX, initialY, onClose, children, accentColor = '#00f2ff',
}: WidgetShellProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [entered, setEntered] = useState(false);
  // Store position in ref to avoid re-renders during drag
  const posRef = useRef({ x: initialX ?? 100, y: initialY ?? 100 });
  const draggingRef = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Entry animation
  useEffect(() => {
    const el = shellRef.current;
    if (el) {
      el.style.left = posRef.current.x + 'px';
      el.style.top = posRef.current.y + 'px';
    }
    requestAnimationFrame(() => setEntered(true));
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    const rect = shellRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    // Add listeners directly — no setState, no re-renders
    const onMove = (ev: MouseEvent) => {
      if (!draggingRef.current) return;
      const x = Math.max(0, Math.min(window.innerWidth - 80, ev.clientX - dragOffset.current.x));
      const y = Math.max(0, Math.min(window.innerHeight - 40, ev.clientY - dragOffset.current.y));
      posRef.current = { x, y };
      if (shellRef.current) {
        shellRef.current.style.left = x + 'px';
        shellRef.current.style.top = y + 'px';
      }
    };
    const onUp = () => {
      draggingRef.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  return (
    <div
      ref={shellRef}
      className="friday-widget-shell"
      style={{
        position: 'fixed',
        width,
        minHeight: height,
        zIndex: 60,
        opacity: entered ? 1 : 0,
        transform: entered ? 'scale(1) translateY(0)' : 'scale(0.85) translateY(20px)',
        transition: 'opacity 350ms ease, transform 350ms cubic-bezier(0.34,1.56,0.64,1)',
        // Solid dark background — NO backdrop-filter blur (saves massive GPU overhead)
        background: 'rgba(8, 12, 24, 0.95)',
        border: `1px solid rgba(${parseInt(accentColor.slice(1,3),16)},${parseInt(accentColor.slice(3,5),16)},${parseInt(accentColor.slice(5,7),16)},0.25)`,
        borderRadius: 16,
        boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 1px ${accentColor}40, inset 0 1px 0 rgba(255,255,255,0.05)`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Inter', sans-serif",
        userSelect: 'auto',
      }}
    >
      {/* ── Drag Handle (Title Bar) ── */}
      <div
        className="friday-widget-drag-handle"
        onMouseDown={onMouseDown}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          cursor: 'grab',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(255,255,255,0.02)',
          flexShrink: 0,
        }}
      >
        <GripHorizontal style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.2)' }} />
        <span style={{
          flex: 1,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.45)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {title}
        </span>
        {/* Close button */}
        <button
          onClick={() => onClose(id)}
          className="friday-widget-close-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            borderRadius: 6,
            border: 'none',
            background: 'rgba(255,255,255,0.04)',
            color: 'rgba(255,255,255,0.3)',
            cursor: 'pointer',
            transition: 'background 200ms, color 200ms',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(255,60,60,0.2)';
            e.currentTarget.style.color = '#ff4466';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
            e.currentTarget.style.color = 'rgba(255,255,255,0.3)';
          }}
        >
          <X style={{ width: 13, height: 13 }} />
        </button>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {children}
      </div>

      {/* ── Holographic border accent (bottom edge) ── */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: '10%',
        right: '10%',
        height: 1,
        background: `linear-gradient(90deg, transparent, ${accentColor}40, transparent)`,
        pointerEvents: 'none',
      }} />
    </div>
  );
}
