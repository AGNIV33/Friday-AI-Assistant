/**
 * Static (non-animated) orb renderers.
 * Each design is a still geometric shape that:
 *   - Stays static during idle
 *   - PULSES (scale + glow) when Friday speaks (via voiceAmp)
 *   - CHANGES COLOR when listening (c1 = listening color, c2 = accent, c3 = speaking color)
 *
 * All share the same RenderContext as animated renderers for consistency.
 */

import type { RenderContext } from './orbRenderers';

/* ── helpers ───────────────────────────────────────────────── */
function rgba(c: [number,number,number], a: number) { return `rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a})`; }
function lerpC(a: [number,number,number], b: [number,number,number], t: number): [number,number,number] {
  return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
}

/** Pick the state-appropriate color and alpha */
function stateColor(rc: RenderContext): { col: [number,number,number]; alpha: number; pulse: number } {
  const { speaking, listening, active, voiceAmp, c1, c2, c3 } = rc;
  if (speaking) return { col: c3, alpha: 0.85, pulse: 1.0 + voiceAmp * 0.35 };
  if (listening) return { col: c1, alpha: 0.7, pulse: 1.0 };
  if (active)    return { col: c2, alpha: 0.4, pulse: 1.0 };
  return { col: c2, alpha: 0.15, pulse: 1.0 };
}

/** Draw a centered glow behind the shape */
function drawGlow(ctx: CanvasRenderingContext2D, CX: number, CY: number, r: number, col: [number,number,number], a: number) {
  const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, r);
  g.addColorStop(0, rgba(col, a * 0.6));
  g.addColorStop(0.5, rgba(col, a * 0.15));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(CX, CY, r, 0, Math.PI * 2); ctx.fill();
}

/** Draw a regular polygon */
function polygon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, sides: number, rotation: number = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i <= sides; i++) {
    const a = rotation + (i / sides) * Math.PI * 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/* ── 1. Solid Circle ───────────────────────────────────────── */
export function drawSolidCircle(rc: RenderContext) {
  const { ctx, CX, CY, R } = rc;
  const { col, alpha, pulse } = stateColor(rc);
  const r = R * 0.5 * pulse;
  drawGlow(ctx, CX, CY, R * 0.8, col, alpha * 0.5);
  ctx.fillStyle = rgba(col, alpha);
  ctx.beginPath(); ctx.arc(CX, CY, r, 0, Math.PI * 2); ctx.fill();
}

/* ── 2. Gradient Sphere ────────────────────────────────────── */
export function drawGradientSphere(rc: RenderContext) {
  const { ctx, CX, CY, R } = rc;
  const { col, alpha, pulse } = stateColor(rc);
  const r = R * 0.55 * pulse;
  drawGlow(ctx, CX, CY, R * 0.9, col, alpha * 0.4);
  const g = ctx.createRadialGradient(CX - r * 0.25, CY - r * 0.25, r * 0.05, CX, CY, r);
  g.addColorStop(0, rgba([Math.min(255,col[0]+80), Math.min(255,col[1]+80), Math.min(255,col[2]+80)], alpha));
  g.addColorStop(0.7, rgba(col, alpha * 0.8));
  g.addColorStop(1, rgba([col[0]*0.3|0, col[1]*0.3|0, col[2]*0.3|0], alpha * 0.5));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(CX, CY, r, 0, Math.PI * 2); ctx.fill();
}

/* ── 3. Single Ring ────────────────────────────────────────── */
export function drawRing(rc: RenderContext) {
  const { ctx, CX, CY, R } = rc;
  const { col, alpha, pulse } = stateColor(rc);
  const r = R * 0.5 * pulse;
  drawGlow(ctx, CX, CY, R * 0.6, col, alpha * 0.3);
  ctx.strokeStyle = rgba(col, alpha);
  ctx.lineWidth = 2.5 + rc.voiceAmp * 3;
  ctx.beginPath(); ctx.arc(CX, CY, r, 0, Math.PI * 2); ctx.stroke();
}

/* ── 4. Double Ring ────────────────────────────────────────── */
export function drawDoubleRing(rc: RenderContext) {
  const { ctx, CX, CY, R } = rc;
  const { col, alpha, pulse } = stateColor(rc);
  drawGlow(ctx, CX, CY, R * 0.7, col, alpha * 0.25);
  ctx.strokeStyle = rgba(col, alpha);
  ctx.lineWidth = 2;
  const r1 = R * 0.4 * pulse;
  const r2 = R * 0.6 * pulse;
  ctx.beginPath(); ctx.arc(CX, CY, r1, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = rgba(col, alpha * 0.6);
  ctx.beginPath(); ctx.arc(CX, CY, r2, 0, Math.PI * 2); ctx.stroke();
}

/* ── 5. Triple Ring ────────────────────────────────────────── */
export function drawTripleRing(rc: RenderContext) {
  const { ctx, CX, CY, R } = rc;
  const { col, alpha, pulse } = stateColor(rc);
  drawGlow(ctx, CX, CY, R * 0.8, col, alpha * 0.2);
  for (let i = 0; i < 3; i++) {
    const r = R * (0.3 + i * 0.15) * pulse;
    ctx.strokeStyle = rgba(col, alpha * (1 - i * 0.25));
    ctx.lineWidth = 1.8 - i * 0.3;
    ctx.beginPath(); ctx.arc(CX, CY, r, 0, Math.PI * 2); ctx.stroke();
  }
}

/* ── 6. Diamond ────────────────────────────────────────────── */
export function drawDiamond(rc: RenderContext) {
  const { ctx, CX, CY, R } = rc;
  const { col, alpha, pulse } = stateColor(rc);
  const r = R * 0.5 * pulse;
  drawGlow(ctx, CX, CY, R * 0.7, col, alpha * 0.3);
  polygon(ctx, CX, CY, r, 4, -Math.PI / 2);
  ctx.strokeStyle = rgba(col, alpha);
  ctx.lineWidth = 2 + rc.voiceAmp * 2;
  ctx.stroke();
}

/* ── 7. Hexagon ────────────────────────────────────────────── */
export function drawHexagon(rc: RenderContext) {
  const { ctx, CX, CY, R } = rc;
  const { col, alpha, pulse } = stateColor(rc);
  const r = R * 0.5 * pulse;
  drawGlow(ctx, CX, CY, R * 0.7, col, alpha * 0.3);
  polygon(ctx, CX, CY, r, 6, -Math.PI / 2);
  ctx.strokeStyle = rgba(col, alpha);
  ctx.lineWidth = 2 + rc.voiceAmp * 2;
  ctx.stroke();
  // Inner fill
  polygon(ctx, CX, CY, r * 0.6, 6, -Math.PI / 2);
  ctx.fillStyle = rgba(col, alpha * 0.12);
  ctx.fill();
}

/* ── 8. Octagon ────────────────────────────────────────────── */
export function drawOctagon(rc: RenderContext) {
  const { ctx, CX, CY, R } = rc;
  const { col, alpha, pulse } = stateColor(rc);
  const r = R * 0.5 * pulse;
  drawGlow(ctx, CX, CY, R * 0.7, col, alpha * 0.25);
  polygon(ctx, CX, CY, r, 8, -Math.PI / 8);
  ctx.fillStyle = rgba(col, alpha * 0.15);
  ctx.fill();
  ctx.strokeStyle = rgba(col, alpha);
  ctx.lineWidth = 2;
  ctx.stroke();
}

/* ── 9. Crosshair ──────────────────────────────────────────── */
export function drawCrosshair(rc: RenderContext) {
  const { ctx, CX, CY, R } = rc;
  const { col, alpha, pulse } = stateColor(rc);
  const r = R * 0.5 * pulse;
  drawGlow(ctx, CX, CY, R * 0.5, col, alpha * 0.25);
  ctx.strokeStyle = rgba(col, alpha);
  ctx.lineWidth = 1.5;
  // Circle
  ctx.beginPath(); ctx.arc(CX, CY, r, 0, Math.PI * 2); ctx.stroke();
  // Cross lines (with gap in center)
  const gap = r * 0.2;
  ctx.beginPath(); ctx.moveTo(CX - r, CY); ctx.lineTo(CX - gap, CY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(CX + gap, CY); ctx.lineTo(CX + r, CY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(CX, CY - r); ctx.lineTo(CX, CY - gap); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(CX, CY + gap); ctx.lineTo(CX, CY + r); ctx.stroke();
  // Center dot
  ctx.fillStyle = rgba(col, alpha);
  ctx.beginPath(); ctx.arc(CX, CY, 3, 0, Math.PI * 2); ctx.fill();
}

/* ── 10. Dot Grid ──────────────────────────────────────────── */
export function drawDotGrid(rc: RenderContext) {
  const { ctx, CX, CY, R } = rc;
  const { col, alpha, pulse } = stateColor(rc);
  drawGlow(ctx, CX, CY, R * 0.6, col, alpha * 0.2);
  const count = 12;
  ctx.fillStyle = rgba(col, alpha);
  for (let ring = 1; ring <= 3; ring++) {
    const r = R * 0.17 * ring * pulse;
    const dots = count * ring;
    for (let i = 0; i < dots; i++) {
      const a = (i / dots) * Math.PI * 2;
      const x = CX + Math.cos(a) * r;
      const y = CY + Math.sin(a) * r;
      const sz = 1.5 + (3 - ring) * 0.5;
      ctx.beginPath(); ctx.arc(x, y, sz, 0, Math.PI * 2); ctx.fill();
    }
  }
}

/* ── 11. Starburst ─────────────────────────────────────────── */
export function drawStarburst(rc: RenderContext) {
  const { ctx, CX, CY, R } = rc;
  const { col, alpha, pulse } = stateColor(rc);
  const points = 8;
  const outer = R * 0.55 * pulse;
  const inner = R * 0.25 * pulse;
  drawGlow(ctx, CX, CY, R * 0.7, col, alpha * 0.3);
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    const x = CX + Math.cos(a) * r;
    const y = CY + Math.sin(a) * r;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = rgba(col, alpha * 0.15);
  ctx.fill();
  ctx.strokeStyle = rgba(col, alpha);
  ctx.lineWidth = 1.8;
  ctx.stroke();
}

/* ── 12. Crescent ──────────────────────────────────────────── */
export function drawCrescent(rc: RenderContext) {
  const { ctx, CX, CY, R } = rc;
  const { col, alpha, pulse } = stateColor(rc);
  const r = R * 0.5 * pulse;
  drawGlow(ctx, CX, CY, R * 0.6, col, alpha * 0.25);
  ctx.fillStyle = rgba(col, alpha * 0.5);
  ctx.beginPath(); ctx.arc(CX, CY, r, 0, Math.PI * 2); ctx.fill();
  // Cut out offset circle to create crescent
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = 'rgba(0,0,0,1)';
  ctx.beginPath(); ctx.arc(CX + r * 0.4, CY - r * 0.15, r * 0.85, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  // Edge glow
  ctx.strokeStyle = rgba(col, alpha * 0.6);
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(CX, CY, r, 0, Math.PI * 2); ctx.stroke();
}

/* ── 13. Eye ───────────────────────────────────────────────── */
export function drawEye(rc: RenderContext) {
  const { ctx, CX, CY, R } = rc;
  const { col, alpha, pulse } = stateColor(rc);
  const w = R * 0.65 * pulse;
  const h = R * 0.35 * pulse;
  drawGlow(ctx, CX, CY, R * 0.6, col, alpha * 0.25);
  // Eye outline (two arcs)
  ctx.strokeStyle = rgba(col, alpha);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(CX, CY, w, h, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Iris
  const irisR = h * 0.6;
  ctx.fillStyle = rgba(col, alpha * 0.4);
  ctx.beginPath(); ctx.arc(CX, CY, irisR, 0, Math.PI * 2); ctx.fill();
  // Pupil
  ctx.fillStyle = rgba(col, alpha);
  ctx.beginPath(); ctx.arc(CX, CY, irisR * 0.4, 0, Math.PI * 2); ctx.fill();
}

/* ── 14. Lotus ─────────────────────────────────────────────── */
export function drawLotus(rc: RenderContext) {
  const { ctx, CX, CY, R } = rc;
  const { col, alpha, pulse } = stateColor(rc);
  const petals = 6;
  const r = R * 0.5 * pulse;
  drawGlow(ctx, CX, CY, R * 0.7, col, alpha * 0.25);
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2 - Math.PI / 2;
    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.35, r * 0.18, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fillStyle = rgba(col, alpha * 0.2);
    ctx.fill();
    ctx.strokeStyle = rgba(col, alpha * 0.6);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }
  // Center
  ctx.fillStyle = rgba(col, alpha);
  ctx.beginPath(); ctx.arc(CX, CY, 4, 0, Math.PI * 2); ctx.fill();
}

/* ── 15. Atom ──────────────────────────────────────────────── */
export function drawAtom(rc: RenderContext) {
  const { ctx, CX, CY, R } = rc;
  const { col, alpha, pulse } = stateColor(rc);
  const r = R * 0.45 * pulse;
  drawGlow(ctx, CX, CY, R * 0.5, col, alpha * 0.2);
  ctx.strokeStyle = rgba(col, alpha * 0.5);
  ctx.lineWidth = 1.3;
  // 3 orbit ellipses
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate((i / 3) * Math.PI);
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.35, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  // Nucleus
  ctx.fillStyle = rgba(col, alpha);
  ctx.beginPath(); ctx.arc(CX, CY, 6 + rc.voiceAmp * 4, 0, Math.PI * 2); ctx.fill();
}

/* ── 16. Triangle ──────────────────────────────────────────── */
export function drawTriangle(rc: RenderContext) {
  const { ctx, CX, CY, R } = rc;
  const { col, alpha, pulse } = stateColor(rc);
  const r = R * 0.5 * pulse;
  drawGlow(ctx, CX, CY, R * 0.7, col, alpha * 0.3);
  polygon(ctx, CX, CY, r, 3, -Math.PI / 2);
  ctx.fillStyle = rgba(col, alpha * 0.1);
  ctx.fill();
  ctx.strokeStyle = rgba(col, alpha);
  ctx.lineWidth = 2.5 + rc.voiceAmp * 2;
  ctx.stroke();
}

/* ── 17. Rotated Square ────────────────────────────────────── */
export function drawRotatedSquare(rc: RenderContext) {
  const { ctx, CX, CY, R } = rc;
  const { col, alpha, pulse } = stateColor(rc);
  const r = R * 0.42 * pulse;
  drawGlow(ctx, CX, CY, R * 0.65, col, alpha * 0.3);
  // Outer rotated square
  polygon(ctx, CX, CY, r, 4, 0);
  ctx.fillStyle = rgba(col, alpha * 0.1);
  ctx.fill();
  ctx.strokeStyle = rgba(col, alpha);
  ctx.lineWidth = 2;
  ctx.stroke();
  // Inner aligned square
  polygon(ctx, CX, CY, r * 0.55, 4, Math.PI / 4);
  ctx.strokeStyle = rgba(col, alpha * 0.5);
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

/* ── 18. Infinity ──────────────────────────────────────────── */
export function drawInfinity(rc: RenderContext) {
  const { ctx, CX, CY, R } = rc;
  const { col, alpha, pulse } = stateColor(rc);
  const w = R * 0.35 * pulse;
  const h = R * 0.22 * pulse;
  drawGlow(ctx, CX, CY, R * 0.5, col, alpha * 0.25);
  ctx.strokeStyle = rgba(col, alpha);
  ctx.lineWidth = 2.5 + rc.voiceAmp * 2;
  ctx.beginPath();
  // Left lobe
  ctx.bezierCurveTo(CX - w, CY - h * 2, CX - w * 2.2, CY - h * 2, CX - w, CY);
  ctx.bezierCurveTo(CX - w * 2.2, CY + h * 2, CX - w, CY + h * 2, CX, CY);
  ctx.moveTo(CX, CY);
  // Right lobe
  ctx.bezierCurveTo(CX + w, CY - h * 2, CX + w * 2.2, CY - h * 2, CX + w, CY);
  ctx.bezierCurveTo(CX + w * 2.2, CY + h * 2, CX + w, CY + h * 2, CX, CY);
  ctx.stroke();
}

/* ── 19. Shield ────────────────────────────────────────────── */
export function drawShield(rc: RenderContext) {
  const { ctx, CX, CY, R } = rc;
  const { col, alpha, pulse } = stateColor(rc);
  const w = R * 0.4 * pulse;
  const h = R * 0.55 * pulse;
  drawGlow(ctx, CX, CY, R * 0.6, col, alpha * 0.25);
  ctx.beginPath();
  ctx.moveTo(CX, CY - h);
  ctx.quadraticCurveTo(CX + w * 1.2, CY - h * 0.6, CX + w, CY);
  ctx.quadraticCurveTo(CX + w * 0.6, CY + h * 0.7, CX, CY + h);
  ctx.quadraticCurveTo(CX - w * 0.6, CY + h * 0.7, CX - w, CY);
  ctx.quadraticCurveTo(CX - w * 1.2, CY - h * 0.6, CX, CY - h);
  ctx.closePath();
  ctx.fillStyle = rgba(col, alpha * 0.12);
  ctx.fill();
  ctx.strokeStyle = rgba(col, alpha);
  ctx.lineWidth = 2;
  ctx.stroke();
}

/* ── 20. Minimalist Dot ────────────────────────────────────── */
export function drawMinimalistDot(rc: RenderContext) {
  const { ctx, CX, CY, R } = rc;
  const { col, alpha, pulse } = stateColor(rc);
  // Large soft glow
  drawGlow(ctx, CX, CY, R * 0.9 * pulse, col, alpha * 0.5);
  // Small bright center dot
  const dotR = 6 + rc.voiceAmp * 12;
  ctx.fillStyle = rgba(col, alpha);
  ctx.beginPath(); ctx.arc(CX, CY, dotR, 0, Math.PI * 2); ctx.fill();
  // Subtle halo
  ctx.strokeStyle = rgba(col, alpha * 0.2);
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(CX, CY, R * 0.3 * pulse, 0, Math.PI * 2); ctx.stroke();
}

/* ── Dispatch ──────────────────────────────────────────────── */
const STATIC_RENDERERS: Record<string, (rc: RenderContext) => void> = {
  'solid-circle':    drawSolidCircle,
  'gradient-sphere': drawGradientSphere,
  'ring':            drawRing,
  'double-ring':     drawDoubleRing,
  'triple-ring':     drawTripleRing,
  'diamond':         drawDiamond,
  'hexagon':         drawHexagon,
  'octagon':         drawOctagon,
  'crosshair':       drawCrosshair,
  'dot-grid':        drawDotGrid,
  'starburst':       drawStarburst,
  'crescent':        drawCrescent,
  'eye':             drawEye,
  'lotus':           drawLotus,
  'atom':            drawAtom,
  'triangle':        drawTriangle,
  'rotated-square':  drawRotatedSquare,
  'infinity':        drawInfinity,
  'shield':          drawShield,
  'minimalist-dot':  drawMinimalistDot,
};

/** Returns true if this style ID is a static orb design */
export function isStaticOrbStyle(style: string): boolean {
  return style in STATIC_RENDERERS;
}

/** Draw the static orb for the given style ID */
export function renderStaticOrb(style: string, rc: RenderContext): boolean {
  const fn = STATIC_RENDERERS[style];
  if (fn) { fn(rc); return true; }
  return false;
}
