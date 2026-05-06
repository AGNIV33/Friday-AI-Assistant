/**
 * Alternate orb rendering functions.
 * Each function draws a complete frame onto the given canvas context.
 * All receive the same RenderContext for consistency.
 *
 * Active styles: wireframe (FridayOrb), pulse-ring, particle-cloud, waveform
 */

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  S: number;       // canvas size
  CX: number;      // center X
  CY: number;      // center Y
  R: number;       // base radius
  t: number;       // elapsed seconds
  amp: number;     // smoothed displacement amplitude
  spd: number;     // smoothed speed
  voiceAmp: number;// raw smoothed voice amplitude (0-1)
  active: boolean;
  speaking: boolean;
  listening: boolean;
  c1: [number,number,number];
  c2: [number,number,number];
  c3: [number,number,number];
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function lerpC(a: [number,number,number], b: [number,number,number], t: number): [number,number,number] {
  return [lerp(a[0],b[0],t), lerp(a[1],b[1],t), lerp(a[2],b[2],t)];
}
function rgba(c: [number,number,number], a: number) { return `rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a})`; }
function posCol(n: number, c1: [number,number,number], c2: [number,number,number], c3: [number,number,number]) {
  return n < 0.5 ? lerpC(c1, c2, n*2) : lerpC(c2, c3, (n-0.5)*2);
}

/* ─── 1. Pulse Rings ─────────────────────────────────────────── */
export function drawPulseRings(rc: RenderContext) {
  const { ctx, CX, CY, R, t, voiceAmp, active, speaking, c1, c2, c3 } = rc;
  const rings = 8;
  for (let i = 0; i < rings; i++) {
    const phase = (t * 0.8 + i * 0.5) % 3;
    const r = R * 0.3 + phase * R * 0.35 + voiceAmp * R * 0.15;
    const alpha = Math.max(0, (1 - phase / 3)) * (active ? (speaking ? 0.7 : 0.35) : 0.1);
    const c = posCol(i / rings, c1, c2, c3);
    ctx.strokeStyle = rgba(c, alpha);
    ctx.lineWidth = 1.5 + voiceAmp * 2;
    ctx.beginPath(); ctx.arc(CX, CY, r, 0, Math.PI * 2); ctx.stroke();
  }
  // center dot
  const gc = ctx.createRadialGradient(CX, CY, 0, CX, CY, R * 0.15);
  gc.addColorStop(0, rgba(c2, speaking ? 0.5 : 0.2));
  gc.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gc; ctx.beginPath(); ctx.arc(CX, CY, R * 0.15, 0, Math.PI * 2); ctx.fill();
}

/* ─── 2. Particle Cloud ────────────────────────────────────────── */
const _cloudPts: { a: number; r: number; s: number; sp: number; off: number }[] = [];
function ensureCloudPts() {
  if (_cloudPts.length) return;
  for (let i = 0; i < 250; i++) _cloudPts.push({
    a: Math.random() * Math.PI * 2, r: 0.3 + Math.random() * 0.7,
    s: 0.8 + Math.random() * 2.5, sp: 0.1 + Math.random() * 0.4, off: Math.random() * 100,
  });
}
export function drawParticleCloud(rc: RenderContext) {
  ensureCloudPts();
  const { ctx, CX, CY, R, t, voiceAmp, active, speaking, c1, c2, c3 } = rc;
  const al = active ? (speaking ? 0.7 : 0.35) : 0.1;
  // Batch all particles by approximate color band to reduce fillStyle changes
  const BANDS = 4;
  for (let band = 0; band < BANDS; band++) {
    const bandFrac = (band + 0.5) / BANDS;
    const c = posCol(bandFrac, c1, c2, c3);
    ctx.fillStyle = rgba(c, al * 0.5);
    ctx.beginPath();
    for (const p of _cloudPts) {
      const pBand = Math.floor((p.a / (Math.PI * 2)) * BANDS);
      if (pBand !== band) continue;
      const a = p.a + t * p.sp + Math.sin(t * 0.3 + p.off) * 0.5;
      const rMul = p.r + voiceAmp * 0.25 * Math.sin(t * 2 + p.off);
      const x = CX + Math.cos(a) * R * rMul;
      const y = CY + Math.sin(a) * R * rMul;
      const sz = p.s * (1 + voiceAmp * 0.5);
      ctx.moveTo(x + sz, y);
      ctx.arc(x, y, sz, 0, Math.PI * 2);
    }
    ctx.fill();
  }
}

/* ─── 3. Waveform ────────────────────────────────────────────── */
export function drawWaveform(rc: RenderContext) {
  const { ctx, CX, CY, R, t, voiceAmp, active, speaking, c1, c2, c3 } = rc;
  const layers = 4;
  for (let l = 0; l < layers; l++) {
    const baseR = R * (0.4 + l * 0.15);
    const pts = 128;
    ctx.beginPath();
    for (let i = 0; i <= pts; i++) {
      const a = (i / pts) * Math.PI * 2;
      const wave = Math.sin(a * 6 + t * 3 + l) * R * 0.08 * (1 + voiceAmp * 3)
        + Math.sin(a * 3 - t * 2 + l * 2) * R * 0.04 * (1 + voiceAmp * 2);
      const r = baseR + wave;
      const x = CX + Math.cos(a) * r;
      const y = CY + Math.sin(a) * r;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    const c = posCol(l / layers, c1, c2, c3);
    ctx.strokeStyle = rgba(c, active ? (speaking ? 0.7 : 0.35) : 0.1);
    ctx.lineWidth = 1.2 + voiceAmp;
    ctx.stroke();
  }
}

import { renderStaticOrb } from './staticOrbRenderers';

/** Dispatch to the correct renderer by style ID */
export function renderOrbStyle(style: string, rc: RenderContext) {
  // Try static (non-animated) renderers first
  if (renderStaticOrb(style, rc)) return;

  // Animated renderers
  switch (style) {
    case 'pulse-ring':     drawPulseRings(rc);    break;
    case 'particle-cloud': drawParticleCloud(rc); break;
    case 'waveform':       drawWaveform(rc);      break;
    default: break; // 'wireframe' is handled by FridayOrb directly
  }
}
