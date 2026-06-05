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

/* ─── 4. Arcane Core ─────────────────────────────────────────── */

// Pre-generate arcane particles
const _arcaneParticles: { angle: number; dist: number; speed: number; size: number; phase: number; trail: number }[] = [];
function ensureArcaneParticles() {
  if (_arcaneParticles.length) return;
  for (let i = 0; i < 120; i++) {
    _arcaneParticles.push({
      angle: Math.random() * Math.PI * 2,
      dist: 0.3 + Math.random() * 0.7,
      speed: 0.15 + Math.random() * 0.5,
      size: 0.5 + Math.random() * 2.5,
      phase: Math.random() * Math.PI * 2,
      trail: 0.3 + Math.random() * 0.7,
    });
  }
}

export function drawArcaneCore(rc: RenderContext) {
  ensureArcaneParticles();
  const { ctx, CX, CY, R, t, voiceAmp, active, speaking, listening, c1, c2, c3 } = rc;
  const baseAlpha = active ? (speaking ? 1.0 : listening ? 0.6 : 0.3) : 0.12;
  const pulse = 1.0 + (speaking ? voiceAmp * 0.4 : 0) + Math.sin(t * 1.5) * 0.03;

  // ── 1. Deep background aura ──
  const auraR = R * 1.1 * pulse;
  const aura = ctx.createRadialGradient(CX, CY, 0, CX, CY, auraR);
  const ac = posCol(0.5, c1, c2, c3);
  aura.addColorStop(0, rgba(ac, baseAlpha * 0.25));
  aura.addColorStop(0.4, rgba(ac, baseAlpha * 0.08));
  aura.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = aura;
  ctx.beginPath(); ctx.arc(CX, CY, auraR, 0, Math.PI * 2); ctx.fill();

  // ── 2. Concentric rotating rings with rune-like broken segments ──
  const ringCount = 4;
  for (let ri = 0; ri < ringCount; ri++) {
    const rFrac = 0.35 + ri * 0.17;
    const ringR = R * rFrac * pulse;
    const rotSpeed = (ri % 2 === 0 ? 1 : -1) * (0.3 + ri * 0.12);
    const rotation = t * rotSpeed;
    const segCount = 8 + ri * 4;
    const gapFrac = 0.25 + ri * 0.05; // fraction of segment that is gap
    const segAngle = (Math.PI * 2) / segCount;
    const drawAngle = segAngle * (1 - gapFrac);
    const col = posCol(ri / ringCount, c1, c2, c3);
    const ringAlpha = baseAlpha * (0.5 + 0.5 * Math.sin(t * 1.2 + ri * 1.5));
    const lw = 1.2 + (speaking ? voiceAmp * 2.5 : 0) - ri * 0.15;

    ctx.strokeStyle = rgba(col, ringAlpha * 0.8);
    ctx.lineWidth = Math.max(0.5, lw);

    for (let s = 0; s < segCount; s++) {
      const startA = rotation + s * segAngle;
      ctx.beginPath();
      ctx.arc(CX, CY, ringR, startA, startA + drawAngle);
      ctx.stroke();
    }

    // Small ticks at segment boundaries (rune marks)
    if (ri < 3) {
      ctx.strokeStyle = rgba(col, ringAlpha * 0.4);
      ctx.lineWidth = 0.8;
      for (let s = 0; s < segCount; s++) {
        const a = rotation + s * segAngle;
        const innerR = ringR - 4;
        const outerR = ringR + 4;
        ctx.beginPath();
        ctx.moveTo(CX + Math.cos(a) * innerR, CY + Math.sin(a) * innerR);
        ctx.lineTo(CX + Math.cos(a) * outerR, CY + Math.sin(a) * outerR);
        ctx.stroke();
      }
    }
  }

  // ── 3. Radiating energy beams ──
  const beamCount = 12;
  for (let bi = 0; bi < beamCount; bi++) {
    const baseAngle = (bi / beamCount) * Math.PI * 2;
    const wobble = Math.sin(t * 2.5 + bi * 1.7) * 0.08;
    const angle = baseAngle + wobble + t * 0.05;
    const beamLen = R * (0.5 + 0.4 * Math.sin(t * 1.8 + bi * 0.9)) * pulse;
    const beamAlpha = baseAlpha * (0.15 + 0.25 * Math.sin(t * 3.0 + bi * 2.1));
    const bw = 1.0 + (speaking ? voiceAmp * 3.0 : 0);
    const col = posCol((bi / beamCount + t * 0.05) % 1, c1, c2, c3);

    // Gradient along the beam
    const innerR = R * 0.15;
    const outerR = innerR + beamLen;
    const x1 = CX + Math.cos(angle) * innerR;
    const y1 = CY + Math.sin(angle) * innerR;
    const x2 = CX + Math.cos(angle) * outerR;
    const y2 = CY + Math.sin(angle) * outerR;

    const beamGrad = ctx.createLinearGradient(x1, y1, x2, y2);
    beamGrad.addColorStop(0, rgba(col, beamAlpha * 1.5));
    beamGrad.addColorStop(0.6, rgba(col, beamAlpha * 0.5));
    beamGrad.addColorStop(1, rgba(col, 0));

    ctx.strokeStyle = beamGrad;
    ctx.lineWidth = bw;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // ── 4. Swirling particles (orbit around the core) ──
  for (const p of _arcaneParticles) {
    const orbitAngle = p.angle + t * p.speed;
    const radialWobble = Math.sin(t * 1.5 + p.phase) * 0.08;
    const dist = (p.dist + radialWobble + (speaking ? voiceAmp * 0.15 : 0)) * R * 0.85 * pulse;
    const x = CX + Math.cos(orbitAngle) * dist;
    const y = CY + Math.sin(orbitAngle) * dist;
    const col = posCol((p.angle / (Math.PI * 2) + t * 0.03) % 1, c1, c2, c3);
    const sz = p.size * (1 + (speaking ? voiceAmp * 0.8 : 0));
    const alpha = baseAlpha * p.trail * (0.3 + 0.3 * Math.sin(t * 2 + p.phase));

    ctx.fillStyle = rgba(col, alpha);
    ctx.beginPath();
    ctx.arc(x, y, sz, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 5. Inner energy web (geometric pattern inside the core) ──
  const webNodes = 6;
  const webR = R * 0.22 * pulse;
  const webCol = posCol(0.3, c1, c2, c3);
  const webAlpha = baseAlpha * 0.3;
  ctx.strokeStyle = rgba(webCol, webAlpha);
  ctx.lineWidth = 0.6 + (speaking ? voiceAmp * 1.5 : 0);

  // Draw connecting lines between web nodes
  for (let i = 0; i < webNodes; i++) {
    const a1 = (i / webNodes) * Math.PI * 2 + t * 0.2;
    const x1 = CX + Math.cos(a1) * webR;
    const y1 = CY + Math.sin(a1) * webR;
    for (let j = i + 2; j < webNodes; j++) {
      const a2 = (j / webNodes) * Math.PI * 2 + t * 0.2;
      const x2 = CX + Math.cos(a2) * webR;
      const y2 = CY + Math.sin(a2) * webR;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  // ── 6. Bright central core ──
  const coreR = R * 0.12 * pulse * (1 + (speaking ? voiceAmp * 0.5 : 0));
  const coreGlow = ctx.createRadialGradient(CX, CY, 0, CX, CY, coreR * 3);
  const brightCol: [number, number, number] = [
    Math.min(255, c2[0] + 100),
    Math.min(255, c2[1] + 80),
    Math.min(255, c2[2] + 60),
  ];
  coreGlow.addColorStop(0, rgba(brightCol, baseAlpha * 0.9));
  coreGlow.addColorStop(0.3, rgba(c2, baseAlpha * 0.5));
  coreGlow.addColorStop(0.7, rgba(c2, baseAlpha * 0.12));
  coreGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = coreGlow;
  ctx.beginPath(); ctx.arc(CX, CY, coreR * 3, 0, Math.PI * 2); ctx.fill();

  // Solid bright core center
  ctx.fillStyle = rgba(brightCol, baseAlpha);
  ctx.beginPath(); ctx.arc(CX, CY, coreR, 0, Math.PI * 2); ctx.fill();

  // ── 7. Outer ring of sparks (scattered bright dots along the perimeter) ──
  const sparkCount = 20;
  const sparkR = R * 0.82 * pulse;
  for (let i = 0; i < sparkCount; i++) {
    const a = (i / sparkCount) * Math.PI * 2 + t * 0.15;
    const jitter = Math.sin(t * 4 + i * 3.7) * R * 0.04;
    const sx = CX + Math.cos(a) * (sparkR + jitter);
    const sy = CY + Math.sin(a) * (sparkR + jitter);
    const sparkAlpha = baseAlpha * (0.3 + 0.5 * Math.abs(Math.sin(t * 3 + i * 2.3)));
    const sparkSize = 1.0 + (speaking ? voiceAmp * 2.5 : 0) + Math.sin(t * 5 + i) * 0.5;
    ctx.fillStyle = rgba(brightCol, sparkAlpha);
    ctx.beginPath(); ctx.arc(sx, sy, Math.max(0.3, sparkSize), 0, Math.PI * 2); ctx.fill();
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
    case 'arcane-core':    drawArcaneCore(rc);    break;
    default: break; // 'wireframe' is handled by FridayOrb directly
  }
}
