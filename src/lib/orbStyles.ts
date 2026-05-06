// ─── Orb Style Definitions ───────────────────────────────────────────────────

export interface OrbStyleConfig {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji
}

export const ORB_STYLES: OrbStyleConfig[] = [
  // ── Animated styles ──
  { id: 'wireframe',      name: 'Wireframe Sphere', description: 'Classic 3D wireframe mesh',   icon: '🌐' },
  { id: 'pulse-ring',     name: 'Pulse Rings',      description: 'Concentric expanding rings',  icon: '🔘' },
  { id: 'particle-cloud', name: 'Particle Cloud',   description: 'Floating particle swarm',     icon: '✨' },
  { id: 'waveform',       name: 'Waveform',         description: 'Audio waveform circle',       icon: '🎵' },
  // ── Static styles (pulse on speak, color on listen) ──
  { id: 'solid-circle',    name: 'Solid Circle',     description: 'Clean solid orb with glow',       icon: '⚫' },
  { id: 'gradient-sphere', name: 'Gradient Sphere',  description: '3D shaded sphere',                icon: '🔮' },
  { id: 'ring',            name: 'Single Ring',      description: 'Minimal ring outline',             icon: '⭕' },
  { id: 'double-ring',     name: 'Double Ring',      description: 'Two concentric rings',             icon: '🎯' },
  { id: 'triple-ring',     name: 'Triple Ring',      description: 'Three fading rings',               icon: '🪐' },
  { id: 'diamond',         name: 'Diamond',          description: 'Rotated diamond shape',            icon: '💎' },
  { id: 'hexagon',         name: 'Hexagon',          description: 'Hexagonal frame',                  icon: '⬡' },
  { id: 'octagon',         name: 'Octagon',          description: 'Filled octagon badge',             icon: '🛑' },
  { id: 'crosshair',       name: 'Crosshair',        description: 'Tactical reticle',                 icon: '🎯' },
  { id: 'dot-grid',        name: 'Dot Grid',         description: 'Circular dot matrix',              icon: '🔵' },
  { id: 'starburst',       name: 'Starburst',        description: 'Eight-pointed star',               icon: '⭐' },
  { id: 'crescent',        name: 'Crescent',         description: 'Crescent moon shape',              icon: '🌙' },
  { id: 'eye',             name: 'Eye',              description: 'Watching eye with iris',            icon: '👁️' },
  { id: 'lotus',           name: 'Lotus',            description: 'Petal flower pattern',              icon: '🪷' },
  { id: 'atom',            name: 'Atom',             description: 'Orbiting electron paths',           icon: '⚛️' },
  { id: 'triangle',        name: 'Triangle',         description: 'Equilateral triangle',             icon: '🔺' },
  { id: 'rotated-square',  name: 'Nested Squares',   description: 'Rotated square within square',     icon: '🔲' },
  { id: 'infinity',        name: 'Infinity',         description: 'Infinity loop symbol',              icon: '♾️' },
  { id: 'shield',          name: 'Shield',           description: 'Protective shield badge',           icon: '🛡️' },
  { id: 'minimalist-dot',  name: 'Minimalist Dot',   description: 'Tiny dot with large aura',         icon: '🌟' },
];
