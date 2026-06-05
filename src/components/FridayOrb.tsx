import React, { useRef, useEffect } from "react";
import { Mic, Power } from "lucide-react";
import { renderOrbStyle, type RenderContext } from "./orbRenderers";

type SessionState = "disconnected" | "connecting" | "connected" | "listening" | "speaking";

interface FridayOrbProps {
  state: SessionState;
  accentColor: string;
  gradientColors?: string[];
  isGameMode: boolean;
  onClick: () => void;
  disabled?: boolean;
  getPlaybackAmplitude?: () => number;
  orbStyle?: string;
  orbScale?: number;
}

/* ── helpers ─────────────────────────────────────────────────── */

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return isNaN(r) ? [0, 242, 255] : [r, g, b];
}

function lerpColor(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

/* Smooth multi-octave 3D displacement */
function displacement(
  x: number, y: number, z: number,
  t: number, amp: number, speed: number,
): number {
  const s = speed;
  return amp * (
    Math.sin(x * 1.4 + t * s * 0.45) *
      Math.cos(y * 1.2 + t * s * 0.55) *
      Math.sin(z * 1.6 + t * s * 0.35) * 0.7 +
    Math.sin(x * 2.3 - t * s * 0.65) *
      Math.sin(y * 1.9 + t * s * 0.30) * 0.25 +
    Math.cos(z * 2.8 + t * s * 0.75) *
      Math.sin(x * 0.9 - y * 0.6 + t * s * 0.25) * 0.15
  );
}

/* ── constants ──────────────────────────────────────── */
const S = 420;           // CSS display size — smaller canvas = fewer pixels to fill
const CX = S / 2;
const CY = S / 2;
const BASE_R = S * 0.34;
const LAT = 14;          // latitude rings
const LON = 20;          // longitude slices
const PARTICLES = 24;    // surface particles — all simple dots, zero per-particle gradients
const FOV = 900;

/* ── component ───────────────────────────────────────────────── */

export default function FridayOrb({
  state, accentColor, gradientColors, isGameMode, onClick, disabled, getPlaybackAmplitude,
  orbStyle = 'wireframe', orbScale = 1.0,
}: FridayOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef  = useRef<number>(0);
  const stateRef = useRef(state);
  const colorRef = useRef({ accentColor, gradientColors, isGameMode });
  const ampFnRef = useRef(getPlaybackAmplitude);
  const styleRef = useRef(orbStyle);
  const scaleRef = useRef(orbScale);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { colorRef.current = { accentColor, gradientColors, isGameMode }; }, [accentColor, gradientColors, isGameMode]);
  useEffect(() => { ampFnRef.current = getPlaybackAmplitude; }, [getPlaybackAmplitude]);
  useEffect(() => { styleRef.current = orbStyle; }, [orbStyle]);
  useEffect(() => { scaleRef.current = orbScale; }, [orbScale]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true })!;
    if (!ctx) return;

    // ── HiDPI support (capped at 2× for performance) ──
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = Math.round(S * dpr);
    canvas.height = Math.round(S * dpr);
    ctx.scale(dpr, dpr);

    /* ── PRE-COMPUTED GEOMETRY LOOKUP TABLE ──
     * The base unit-sphere normals (nx, ny, nz) are STATIC — they never change.
     * Pre-calculating them once eliminates ~600 sin/cos calls per frame.
     * Only the dynamic displacement + rotation is computed per-frame. */
    const rowCount = LAT + 1;
    const colCount = LON + 1;
    const gridSize = rowCount * colCount;
    const geoNx = new Float32Array(gridSize);
    const geoNy = new Float32Array(gridSize);
    const geoNz = new Float32Array(gridSize);
    for (let la = 0; la <= LAT; la++) {
      const theta = (la / LAT) * Math.PI;
      const sinT = Math.sin(theta), cosT = Math.cos(theta);
      for (let lo = 0; lo <= LON; lo++) {
        const phi = (lo / LON) * Math.PI * 2;
        const idx = la * colCount + lo;
        geoNx[idx] = sinT * Math.cos(phi);
        geoNy[idx] = cosT;
        geoNz[idx] = sinT * Math.sin(phi);
      }
    }
    const sxArr = new Float32Array(gridSize);
    const syArr = new Float32Array(gridSize);
    const zArr  = new Float32Array(gridSize);

    /* ── pre-generate surface particles with cached normals ── */
    const pts: { nx: number; ny: number; nz: number; theta: number; phi: number; size: number; bright: number }[] = [];
    for (let i = 0; i < PARTICLES; i++) {
      const theta = Math.random() * Math.PI;
      const phi   = Math.random() * Math.PI * 2;
      pts.push({
        nx: Math.sin(theta) * Math.cos(phi), ny: Math.cos(theta), nz: Math.sin(theta) * Math.sin(phi),
        theta, phi,
        size:  0.8 + Math.random() * 2.2,
        bright: 0.3 + Math.random() * 0.7,
      });
    }

    let t0: number | null = null;
    let lastFrameTs = 0;
    let sAmp  = 0.12;
    let sSpd  = 0.25;
    let smoothRealAmp = 0;

    const proj = (x: number, y: number, z: number) => {
      const p = FOV / (FOV + z + BASE_R * 1.6);
      return { x: CX + x * p, y: CY + y * p, s: p };
    };

    const vertN = (nx: number, ny: number, nz: number, t: number, amp: number, spd: number, cosR: number, sinR: number) => {
      const r = BASE_R * (1.0 + displacement(nx, ny, nz, t, amp, spd));
      const x = nx * r, y = ny * r, z = nz * r;
      return { x: x * cosR - z * sinR, y, z: x * sinR + z * cosR };
    };

    const posColor = (
      tNorm: number,
      c1: [number, number, number],
      c2: [number, number, number],
      c3: [number, number, number],
    ): [number, number, number] =>
      tNorm < 0.5
        ? lerpColor(c1, c2, tNorm * 2)
        : lerpColor(c2, c3, (tNorm - 0.5) * 2);

    /* ── animation loop ── */
    const frame = (ts: number) => {
      animRef.current = requestAnimationFrame(frame);

      const st = stateRef.current;
      const active = st !== "disconnected";
      const currentStyle = styleRef.current;
      const isStatic = currentStyle !== 'wireframe' && currentStyle !== 'pulse-ring' 
                     && currentStyle !== 'particle-cloud' && currentStyle !== 'waveform'
                     && currentStyle !== 'arcane-core';

      // Adaptive frame-rate:
      // Static orbs: 15fps idle, 30fps speaking (they only pulse, no continuous animation)
      // Animated orbs: 30fps idle, 60fps active
      const targetMs = isStatic
        ? (st === 'speaking' ? 33.33 : 66.67)   // static: 30fps speaking, 15fps otherwise
        : (active ? 16.67 : 33.33);              // animated: 60fps active, 30fps idle
      if (ts - lastFrameTs < targetMs) return;
      lastFrameTs = ts;

      if (!t0) t0 = ts;
      const t = (ts - t0) / 1000;

      const { accentColor: ac, gradientColors: gc, isGameMode: gm } = colorRef.current;
      const speaking  = st === "speaking";
      const listening = st === "listening" || st === "connected";

      let c1: [number, number, number], c2: [number, number, number], c3: [number, number, number];
      if (gm) {
        c1 = [255, 0, 85]; c2 = [200, 0, 140]; c3 = [255, 60, 0];
      } else if (gc && gc.length >= 2) {
        c1 = hexToRgb(gc[0]); c2 = hexToRgb(gc[1]); c3 = gc[2] ? hexToRgb(gc[2]) : hexToRgb(gc[0]);
      } else {
        const [r, g, b] = hexToRgb(ac);
        c1 = [Math.max(0, r - 40), Math.min(255, g + 30), Math.min(255, b + 60)];
        c2 = [r, g, b];
        c3 = [Math.min(255, r + 80), Math.max(0, g - 30), Math.min(255, b + 20)];
      }

      const tAmp = speaking ? 0.18 : listening ? 0.09 : active ? 0.05 : 0.03;
      const tSpd = speaking ? 1.4  : listening ? 0.5  : active ? 0.28 : 0.12;
      sAmp += (tAmp - sAmp) * 0.055;
      sSpd += (tSpd - sSpd) * 0.055;

      const realAmp = speaking && ampFnRef.current ? ampFnRef.current() : 0;
      smoothRealAmp += (realAmp - smoothRealAmp) * 0.18;

      const voiceBoost = speaking ? smoothRealAmp * 0.22 : 0;
      const amp = sAmp + voiceBoost;
      const rotY = t * 0.12;
      const cosR = Math.cos(rotY), sinR = Math.sin(rotY);

      ctx.clearRect(0, 0, S, S);

      // ─── Alternate orb styles ───
      if (currentStyle !== 'wireframe') {
        if (active) {
          const [gr, gg, gb] = lerpColor(c1, c3, 0.5);
          const glR = BASE_R * 0.9;
          const a = speaking ? 0.18 : listening ? 0.08 : 0.03;
          const grd = ctx.createRadialGradient(CX, CY, BASE_R * 0.2, CX, CY, glR);
          grd.addColorStop(0, `rgba(${gr|0},${gg|0},${gb|0},${a})`);
          grd.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = grd;
          ctx.beginPath(); ctx.arc(CX, CY, glR, 0, Math.PI * 2); ctx.fill();
        }
        const rc: RenderContext = { ctx, S, CX, CY, R: BASE_R, t, amp, spd: sSpd, voiceAmp: smoothRealAmp, active, speaking, listening, c1, c2, c3 };
        renderOrbStyle(currentStyle, rc);
        return;
      }

      /* ── outer glow — single gradient (the ONLY gradient per frame) ── */
      if (active) {
        const [gr, gg, gb] = lerpColor(c1, c3, 0.5);
        const glowMul = speaking ? (1.0 + smoothRealAmp * 1.5) : 1.0;
        const outerR  = BASE_R + 100 * (speaking ? (1.0 + smoothRealAmp * 0.3) : 1.0);
        const baseAlpha = (speaking ? 0.22 : listening ? 0.10 : 0.04) * glowMul;
        const grd = ctx.createRadialGradient(CX, CY, BASE_R * 0.3, CX, CY, outerR);
        grd.addColorStop(0,   `rgba(${gr|0},${gg|0},${gb|0},${baseAlpha})`);
        grd.addColorStop(0.5, `rgba(${gr|0},${gg|0},${gb|0},${baseAlpha * 0.3})`);
        grd.addColorStop(1,   "rgba(0,0,0,0)");
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(CX, CY, outerR, 0, Math.PI * 2); ctx.fill();
      }

      /* ── build vertex grid (using pre-computed normals — zero trig here) ── */
      for (let i = 0; i < gridSize; i++) {
        const nx = geoNx[i], ny = geoNy[i], nz = geoNz[i];
        const r = BASE_R * (1.0 + displacement(nx, ny, nz, t, amp, sSpd));
        const x = nx * r, y = ny * r, z = nz * r;
        const rx = x * cosR - z * sinR;
        const rz = x * sinR + z * cosR;
        const p = FOV / (FOV + rz + BASE_R * 1.6);
        sxArr[i] = CX + rx * p;
        syArr[i] = CY + y * p;
        zArr[i]  = rz;
      }

      /* ── draw wireframe ── */
      ctx.globalAlpha = active ? (speaking ? 0.92 : 0.72) : 0.22;

      const BANDS = 4;
      for (let band = 0; band < BANDS; band++) {
        const tNorm = (band + 0.5) / BANDS;
        const [cr, cg, cb] = posColor(tNorm, c1, c2, c3);
        ctx.strokeStyle = `rgba(${cr|0},${cg|0},${cb|0},${speaking ? 0.9 : 0.65})`;
        ctx.lineWidth = 0.6;

        const latMin = Math.floor((band / BANDS) * LAT);
        const latMax = Math.ceil(((band + 1) / BANDS) * LAT);

        for (let la = latMin; la <= Math.min(latMax, LAT); la++) {
          const rowBase = la * colCount;
          ctx.beginPath();
          let drawing = false;
          for (let lo = 0; lo < LON; lo++) {
            const idxA = rowBase + lo;
            const idxB = idxA + 1;
            if (zArr[idxA] < -BASE_R * 0.25 && zArr[idxB] < -BASE_R * 0.25) { drawing = false; continue; }
            if (!drawing) { ctx.moveTo(sxArr[idxA], syArr[idxA]); drawing = true; }
            ctx.lineTo(sxArr[idxB], syArr[idxB]);
          }
          ctx.stroke();
        }

        for (let lo = 0; lo <= LON; lo++) {
          ctx.beginPath();
          let drawing = false;
          for (let la = latMin; la < Math.min(latMax, LAT); la++) {
            const idxA = la * colCount + lo;
            const idxB = idxA + colCount;
            if (zArr[idxA] < -BASE_R * 0.25 && zArr[idxB] < -BASE_R * 0.25) { drawing = false; continue; }
            if (!drawing) { ctx.moveTo(sxArr[idxA], syArr[idxA]); drawing = true; }
            ctx.lineTo(sxArr[idxB], syArr[idxB]);
          }
          ctx.stroke();
        }
      }

      ctx.globalAlpha = 1;

      /* ── particles — using pre-computed normals (ZERO per-particle trig) ── */
      const pAlpha = active ? (speaking ? 0.9 : 0.5) : 0.1;
      for (const p of pts) {
        const v = vertN(p.nx, p.ny, p.nz, t, amp, sSpd, cosR, sinR);
        const push = 1.12 + 0.06 * Math.sin(t * 1.2 + p.phi * 2.5);
        const pz = v.z * push;
        if (pz < -BASE_R * 0.1) continue;
        const pp = proj(v.x * push, v.y * push, pz);
        const df = Math.max(0, Math.min(1, (pz + BASE_R * 1.6) / (BASE_R * 3.2)));
        const [cr, cg, cb] = posColor(p.theta / Math.PI, c1, c2, c3);
        const a = df * p.bright * pAlpha;
        const sz = p.size * pp.s * (speaking ? 1.5 : 1.1);
        ctx.fillStyle = `rgba(${Math.min(255, cr + 60)|0},${Math.min(255, cg + 60)|0},${Math.min(255, cb + 60)|0},${a})`;
        ctx.beginPath(); ctx.arc(pp.x, pp.y, sz, 0, Math.PI * 2); ctx.fill();
      }
    };

    animRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  const isConnected = state !== "disconnected";
  const isConnecting = state === "connecting";
  const speaking = state === "speaking";

  return (
    <div
      className={`friday-orb-container relative flex items-center justify-center select-none transition-transform duration-300 ${
        disabled ? "cursor-wait opacity-60" : "cursor-pointer hover:scale-[1.02] active:scale-[0.97]"
      }`}
      style={{ '--orb-scale': orbScale } as React.CSSProperties}
      onClick={!disabled ? onClick : undefined}
      title={isConnected ? "Click to disconnect" : "Click to connect"}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{
          width: S,
          height: S,
          willChange: "transform",
        }}
      />

      {/* translucent glass mic */}
      <div
        className="relative z-10 flex items-center justify-center rounded-full"
        style={{
          width: 62, height: 62,
          background: isConnected ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
          // NOTE: backdropFilter blur intentionally removed — it forces a GPU
          // compositing layer recalculation every canvas repaint (60fps when online),
          // causing the orb lag. A static semi-transparent fill looks identical.
          border: `1px solid rgba(255,255,255,${isConnected ? 0.12 : 0.06})`,
          boxShadow: speaking
            ? "0 0 24px rgba(255,255,255,0.08), inset 0 0 14px rgba(255,255,255,0.04)"
            : "inset 0 0 8px rgba(255,255,255,0.02)",
          transition: "box-shadow 500ms ease, background 500ms ease, border-color 500ms ease",
        }}
      >
        {isConnected ? (
          <Mic
            style={{
              width: 24, height: 24,
              color: `rgba(255,255,255,${speaking ? 0.6 : 0.35})`,
              transform: speaking ? "scale(1.1)" : "scale(1)",
              transition: "transform 300ms ease, color 300ms ease",
            }}
          />
        ) : (
          <Power
            className={isConnecting ? "animate-pulse" : ""}
            style={{ width: 24, height: 24, color: "rgba(255,255,255,0.25)" }}
          />
        )}
      </div>
    </div>
  );
}
