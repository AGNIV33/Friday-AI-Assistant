import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// ─── Theme Definitions ─────────────────────────────────────────────────────

export interface ThemeConfig {
  id: string;
  name: string;
  accent: string;       // CSS color (primary for gradients)
  accentRgb: string;    // RGB values for rgba()
  glow: string;         // glow color
  bgGradient: string;   // radial gradient center color
  description: string;
  isGradient?: boolean;           // Whether this is an animated gradient theme
  gradient?: string;              // Full CSS gradient string
  gradientColors?: string[];      // Array of gradient stop colors (for preview)
  gradientAngle?: number;         // Starting angle for animation
}

// ─── Solid Themes ────────────────────────────────────────────────────────────

export const SOLID_THEMES: ThemeConfig[] = [
  { id: 'cyber-blue', name: 'Cyber Blue', accent: '#00f2ff', accentRgb: '0, 242, 255', glow: 'rgba(0, 242, 255, 0.4)', bgGradient: '#00f2ff', description: 'The classic Friday look' },
  { id: 'neon-purple', name: 'Purple Galaxy', accent: '#a855f7', accentRgb: '168, 85, 247', glow: 'rgba(168, 85, 247, 0.4)', bgGradient: '#a855f7', description: 'Deep cosmic vibes' },
  { id: 'matrix-green', name: 'Matrix Green', accent: '#22c55e', accentRgb: '34, 197, 94', glow: 'rgba(34, 197, 94, 0.4)', bgGradient: '#22c55e', description: 'Hacker aesthetic' },
  { id: 'gold-premium', name: 'Gold Premium', accent: '#f59e0b', accentRgb: '245, 158, 11', glow: 'rgba(245, 158, 11, 0.4)', bgGradient: '#f59e0b', description: 'Luxury & elegance' },
  { id: 'rose-pink', name: 'Rose Pink', accent: '#ec4899', accentRgb: '236, 72, 153', glow: 'rgba(236, 72, 153, 0.4)', bgGradient: '#ec4899', description: 'Soft & vibrant' },
  { id: 'arctic-white', name: 'Arctic White', accent: '#94a3b8', accentRgb: '148, 163, 184', glow: 'rgba(148, 163, 184, 0.3)', bgGradient: '#94a3b8', description: 'Minimal & clean' },
  // ─── 20 New Solid Themes ───
  { id: 'electric-violet', name: 'Electric Violet', accent: '#8b5cf6', accentRgb: '139, 92, 246', glow: 'rgba(139, 92, 246, 0.4)', bgGradient: '#8b5cf6', description: 'Vivid ultraviolet' },
  { id: 'blood-orange', name: 'Blood Orange', accent: '#f97316', accentRgb: '249, 115, 22', glow: 'rgba(249, 115, 22, 0.4)', bgGradient: '#f97316', description: 'Fiery citrus warmth' },
  { id: 'mint-fresh', name: 'Mint Fresh', accent: '#34d399', accentRgb: '52, 211, 153', glow: 'rgba(52, 211, 153, 0.4)', bgGradient: '#34d399', description: 'Cool mint breeze' },
  { id: 'ruby-red', name: 'Ruby Red', accent: '#ef4444', accentRgb: '239, 68, 68', glow: 'rgba(239, 68, 68, 0.4)', bgGradient: '#ef4444', description: 'Bold crimson fire' },
  { id: 'sapphire-blue', name: 'Sapphire Blue', accent: '#3b82f6', accentRgb: '59, 130, 246', glow: 'rgba(59, 130, 246, 0.4)', bgGradient: '#3b82f6', description: 'Royal deep blue' },
  { id: 'coral-reef', name: 'Coral Reef', accent: '#fb7185', accentRgb: '251, 113, 133', glow: 'rgba(251, 113, 133, 0.4)', bgGradient: '#fb7185', description: 'Tropical coral glow' },
  { id: 'jade-green', name: 'Jade Green', accent: '#059669', accentRgb: '5, 150, 105', glow: 'rgba(5, 150, 105, 0.4)', bgGradient: '#059669', description: 'Deep emerald forest' },
  { id: 'amber-glow', name: 'Amber Glow', accent: '#d97706', accentRgb: '217, 119, 6', glow: 'rgba(217, 119, 6, 0.4)', bgGradient: '#d97706', description: 'Warm amber sunset' },
  { id: 'sky-blue', name: 'Sky Blue', accent: '#38bdf8', accentRgb: '56, 189, 248', glow: 'rgba(56, 189, 248, 0.4)', bgGradient: '#38bdf8', description: 'Clear daytime sky' },
  { id: 'fuchsia-pop', name: 'Fuchsia Pop', accent: '#d946ef', accentRgb: '217, 70, 239', glow: 'rgba(217, 70, 239, 0.4)', bgGradient: '#d946ef', description: 'Bold neon fuchsia' },
  { id: 'teal-depths', name: 'Teal Depths', accent: '#14b8a6', accentRgb: '20, 184, 166', glow: 'rgba(20, 184, 166, 0.4)', bgGradient: '#14b8a6', description: 'Ocean teal serenity' },
  { id: 'indigo-night', name: 'Indigo Night', accent: '#6366f1', accentRgb: '99, 102, 241', glow: 'rgba(99, 102, 241, 0.4)', bgGradient: '#6366f1', description: 'Midnight indigo glow' },
  { id: 'lime-burst', name: 'Lime Burst', accent: '#84cc16', accentRgb: '132, 204, 22', glow: 'rgba(132, 204, 22, 0.4)', bgGradient: '#84cc16', description: 'Fresh lime energy' },
  { id: 'peach-blush', name: 'Peach Blush', accent: '#f9a8d4', accentRgb: '249, 168, 212', glow: 'rgba(249, 168, 212, 0.35)', bgGradient: '#f9a8d4', description: 'Soft pastel warmth' },
  { id: 'steel-gray', name: 'Steel Gray', accent: '#64748b', accentRgb: '100, 116, 139', glow: 'rgba(100, 116, 139, 0.35)', bgGradient: '#64748b', description: 'Industrial minimal' },
  { id: 'lavender-haze', name: 'Lavender Haze', accent: '#c084fc', accentRgb: '192, 132, 252', glow: 'rgba(192, 132, 252, 0.4)', bgGradient: '#c084fc', description: 'Dreamy lavender mist' },
  { id: 'crimson-flame', name: 'Crimson Flame', accent: '#dc2626', accentRgb: '220, 38, 38', glow: 'rgba(220, 38, 38, 0.4)', bgGradient: '#dc2626', description: 'Intense fiery red' },
  { id: 'ocean-mist', name: 'Ocean Mist', accent: '#06b6d4', accentRgb: '6, 182, 212', glow: 'rgba(6, 182, 212, 0.4)', bgGradient: '#06b6d4', description: 'Cool cyan waves' },
  { id: 'bronze-age', name: 'Bronze Age', accent: '#b45309', accentRgb: '180, 83, 9', glow: 'rgba(180, 83, 9, 0.4)', bgGradient: '#b45309', description: 'Ancient bronze tone' },
  { id: 'ice-crystal', name: 'Ice Crystal', accent: '#67e8f9', accentRgb: '103, 232, 249', glow: 'rgba(103, 232, 249, 0.4)', bgGradient: '#67e8f9', description: 'Frozen crystalline blue' },
];

// ─── Animated Gradient Themes ────────────────────────────────────────────────

export const GRADIENT_THEMES: ThemeConfig[] = [
  {
    id: 'aurora-borealis',
    name: 'Aurora Borealis',
    accent: '#00e5a0',
    accentRgb: '0, 229, 160',
    glow: 'rgba(0, 229, 160, 0.4)',
    bgGradient: '#00e5a0',
    description: 'Northern lights magic',
    isGradient: true,
    gradient: 'linear-gradient(135deg, #00e5a0, #00b4d8, #7b2ff7, #00e5a0)',
    gradientColors: ['#00e5a0', '#00b4d8', '#7b2ff7'],
    gradientAngle: 135,
  },
  {
    id: 'sunset-horizon',
    name: 'Sunset Horizon',
    accent: '#ff6b35',
    accentRgb: '255, 107, 53',
    glow: 'rgba(255, 107, 53, 0.4)',
    bgGradient: '#ff6b35',
    description: 'Warm dusk gradient',
    isGradient: true,
    gradient: 'linear-gradient(135deg, #ff6b35, #f72585, #b5179e, #ff6b35)',
    gradientColors: ['#ff6b35', '#f72585', '#b5179e'],
    gradientAngle: 135,
  },
  {
    id: 'ocean-depths',
    name: 'Ocean Depths',
    accent: '#0077b6',
    accentRgb: '0, 119, 182',
    glow: 'rgba(0, 119, 182, 0.4)',
    bgGradient: '#0077b6',
    description: 'Deep sea symphony',
    isGradient: true,
    gradient: 'linear-gradient(135deg, #00b4d8, #0077b6, #03045e, #00b4d8)',
    gradientColors: ['#00b4d8', '#0077b6', '#03045e'],
    gradientAngle: 135,
  },
  {
    id: 'neon-fusion',
    name: 'Neon Fusion',
    accent: '#ff00e5',
    accentRgb: '255, 0, 229',
    glow: 'rgba(255, 0, 229, 0.4)',
    bgGradient: '#ff00e5',
    description: 'Electric cyberpunk glow',
    isGradient: true,
    gradient: 'linear-gradient(135deg, #ff00e5, #00f2ff, #7b2ff7, #ff00e5)',
    gradientColors: ['#ff00e5', '#00f2ff', '#7b2ff7'],
    gradientAngle: 135,
  },
  {
    id: 'cosmic-dust',
    name: 'Cosmic Dust',
    accent: '#c084fc',
    accentRgb: '192, 132, 252',
    glow: 'rgba(192, 132, 252, 0.4)',
    bgGradient: '#c084fc',
    description: 'Interstellar nebula',
    isGradient: true,
    gradient: 'linear-gradient(135deg, #c084fc, #f472b6, #fb923c, #c084fc)',
    gradientColors: ['#c084fc', '#f472b6', '#fb923c'],
    gradientAngle: 135,
  },
  {
    id: 'cherry-blossom',
    name: 'Cherry Blossom',
    accent: '#f9a8d4',
    accentRgb: '249, 168, 212',
    glow: 'rgba(249, 168, 212, 0.35)',
    bgGradient: '#f9a8d4',
    description: 'Sakura spring bloom',
    isGradient: true,
    gradient: 'linear-gradient(135deg, #f9a8d4, #a78bfa, #67e8f9, #f9a8d4)',
    gradientColors: ['#f9a8d4', '#a78bfa', '#67e8f9'],
    gradientAngle: 135,
  },
  {
    id: 'emerald-fire',
    name: 'Emerald Fire',
    accent: '#10b981',
    accentRgb: '16, 185, 129',
    glow: 'rgba(16, 185, 129, 0.4)',
    bgGradient: '#10b981',
    description: 'Jade meets inferno',
    isGradient: true,
    gradient: 'linear-gradient(135deg, #10b981, #eab308, #ef4444, #10b981)',
    gradientColors: ['#10b981', '#eab308', '#ef4444'],
    gradientAngle: 135,
  },
  { id: 'midnight-sapphire', name: 'Midnight Sapphire', accent: '#6366f1', accentRgb: '99, 102, 241', glow: 'rgba(99, 102, 241, 0.4)', bgGradient: '#6366f1', description: 'Royal twilight hues', isGradient: true, gradient: 'linear-gradient(135deg, #6366f1, #06b6d4, #8b5cf6, #6366f1)', gradientColors: ['#6366f1', '#06b6d4', '#8b5cf6'], gradientAngle: 135 },
  // ─── 15 New Gradient Themes ───
  { id: 'plasma-storm', name: 'Plasma Storm', accent: '#e11d48', accentRgb: '225, 29, 72', glow: 'rgba(225, 29, 72, 0.4)', bgGradient: '#e11d48', description: 'Electric plasma surge', isGradient: true, gradient: 'linear-gradient(135deg, #e11d48, #7c3aed, #2563eb, #e11d48)', gradientColors: ['#e11d48', '#7c3aed', '#2563eb'], gradientAngle: 135 },
  { id: 'tropical-paradise', name: 'Tropical Paradise', accent: '#06b6d4', accentRgb: '6, 182, 212', glow: 'rgba(6, 182, 212, 0.4)', bgGradient: '#06b6d4', description: 'Island breeze colors', isGradient: true, gradient: 'linear-gradient(135deg, #06b6d4, #10b981, #fbbf24, #06b6d4)', gradientColors: ['#06b6d4', '#10b981', '#fbbf24'], gradientAngle: 135 },
  { id: 'volcanic-ember', name: 'Volcanic Ember', accent: '#dc2626', accentRgb: '220, 38, 38', glow: 'rgba(220, 38, 38, 0.4)', bgGradient: '#dc2626', description: 'Molten lava flow', isGradient: true, gradient: 'linear-gradient(135deg, #dc2626, #f97316, #fbbf24, #dc2626)', gradientColors: ['#dc2626', '#f97316', '#fbbf24'], gradientAngle: 135 },
  { id: 'winter-frost', name: 'Winter Frost', accent: '#93c5fd', accentRgb: '147, 197, 253', glow: 'rgba(147, 197, 253, 0.4)', bgGradient: '#93c5fd', description: 'Icy winter elegance', isGradient: true, gradient: 'linear-gradient(135deg, #93c5fd, #c4b5fd, #e0e7ff, #93c5fd)', gradientColors: ['#93c5fd', '#c4b5fd', '#e0e7ff'], gradientAngle: 135 },
  { id: 'toxic-waste', name: 'Toxic Waste', accent: '#84cc16', accentRgb: '132, 204, 22', glow: 'rgba(132, 204, 22, 0.4)', bgGradient: '#84cc16', description: 'Radioactive gamer glow', isGradient: true, gradient: 'linear-gradient(135deg, #84cc16, #22d3ee, #a855f7, #84cc16)', gradientColors: ['#84cc16', '#22d3ee', '#a855f7'], gradientAngle: 135 },
  { id: 'velvet-night', name: 'Velvet Night', accent: '#7c3aed', accentRgb: '124, 58, 237', glow: 'rgba(124, 58, 237, 0.4)', bgGradient: '#7c3aed', description: 'Deep velvet luxury', isGradient: true, gradient: 'linear-gradient(135deg, #7c3aed, #be185d, #1e1b4b, #7c3aed)', gradientColors: ['#7c3aed', '#be185d', '#1e1b4b'], gradientAngle: 135 },
  { id: 'golden-hour', name: 'Golden Hour', accent: '#f59e0b', accentRgb: '245, 158, 11', glow: 'rgba(245, 158, 11, 0.4)', bgGradient: '#f59e0b', description: 'Warm golden sunlight', isGradient: true, gradient: 'linear-gradient(135deg, #f59e0b, #ef4444, #ec4899, #f59e0b)', gradientColors: ['#f59e0b', '#ef4444', '#ec4899'], gradientAngle: 135 },
  { id: 'arctic-aurora', name: 'Arctic Aurora', accent: '#2dd4bf', accentRgb: '45, 212, 191', glow: 'rgba(45, 212, 191, 0.4)', bgGradient: '#2dd4bf', description: 'Frozen northern glow', isGradient: true, gradient: 'linear-gradient(135deg, #2dd4bf, #818cf8, #c084fc, #2dd4bf)', gradientColors: ['#2dd4bf', '#818cf8', '#c084fc'], gradientAngle: 135 },
  { id: 'shadow-realm', name: 'Shadow Realm', accent: '#6b7280', accentRgb: '107, 114, 128', glow: 'rgba(107, 114, 128, 0.4)', bgGradient: '#6b7280', description: 'Dark dimensional rift', isGradient: true, gradient: 'linear-gradient(135deg, #6b7280, #374151, #a78bfa, #6b7280)', gradientColors: ['#6b7280', '#374151', '#a78bfa'], gradientAngle: 135 },
  { id: 'candy-rush', name: 'Candy Rush', accent: '#f472b6', accentRgb: '244, 114, 182', glow: 'rgba(244, 114, 182, 0.4)', bgGradient: '#f472b6', description: 'Sweet candy colors', isGradient: true, gradient: 'linear-gradient(135deg, #f472b6, #a78bfa, #38bdf8, #f472b6)', gradientColors: ['#f472b6', '#a78bfa', '#38bdf8'], gradientAngle: 135 },
  { id: 'forest-canopy', name: 'Forest Canopy', accent: '#16a34a', accentRgb: '22, 163, 74', glow: 'rgba(22, 163, 74, 0.4)', bgGradient: '#16a34a', description: 'Deep woodland greens', isGradient: true, gradient: 'linear-gradient(135deg, #16a34a, #065f46, #a3e635, #16a34a)', gradientColors: ['#16a34a', '#065f46', '#a3e635'], gradientAngle: 135 },
  { id: 'supernova', name: 'Supernova', accent: '#fb923c', accentRgb: '251, 146, 60', glow: 'rgba(251, 146, 60, 0.4)', bgGradient: '#fb923c', description: 'Stellar explosion burst', isGradient: true, gradient: 'linear-gradient(135deg, #fb923c, #f43f5e, #a855f7, #fb923c)', gradientColors: ['#fb923c', '#f43f5e', '#a855f7'], gradientAngle: 135 },
  { id: 'moonlight-sonata', name: 'Moonlight Sonata', accent: '#a5b4fc', accentRgb: '165, 180, 252', glow: 'rgba(165, 180, 252, 0.4)', bgGradient: '#a5b4fc', description: 'Serene moonlit hues', isGradient: true, gradient: 'linear-gradient(135deg, #a5b4fc, #67e8f9, #d8b4fe, #a5b4fc)', gradientColors: ['#a5b4fc', '#67e8f9', '#d8b4fe'], gradientAngle: 135 },
  { id: 'dragon-breath', name: 'Dragon Breath', accent: '#ef4444', accentRgb: '239, 68, 68', glow: 'rgba(239, 68, 68, 0.4)', bgGradient: '#ef4444', description: 'Fierce dragon fire', isGradient: true, gradient: 'linear-gradient(135deg, #ef4444, #b91c1c, #fbbf24, #ef4444)', gradientColors: ['#ef4444', '#b91c1c', '#fbbf24'], gradientAngle: 135 },
  { id: 'synthwave', name: 'Synthwave', accent: '#e879f9', accentRgb: '232, 121, 249', glow: 'rgba(232, 121, 249, 0.4)', bgGradient: '#e879f9', description: 'Retro 80s synthwave', isGradient: true, gradient: 'linear-gradient(135deg, #e879f9, #6366f1, #0ea5e9, #e879f9)', gradientColors: ['#e879f9', '#6366f1', '#0ea5e9'], gradientAngle: 135 },
];

export const THEMES: ThemeConfig[] = [...SOLID_THEMES, ...GRADIENT_THEMES];

// ─── Voice Definitions ──────────────────────────────────────────────────────

export interface VoiceConfig {
  id: string;
  name: string;
  gender: 'female' | 'male';
  description: string;
}

export const VOICES: VoiceConfig[] = [
  { id: 'Zephyr', name: 'Zephyr', gender: 'female', description: 'Bright & breezy' },
  { id: 'Kore', name: 'Kore', gender: 'female', description: 'Warm & composed' },
  { id: 'Aoede', name: 'Aoede', gender: 'female', description: 'Melodic & soft' },
  { id: 'Leda', name: 'Leda', gender: 'female', description: 'Calm & nurturing' },
  { id: 'Puck', name: 'Puck', gender: 'male', description: 'Playful & energetic' },
  { id: 'Charon', name: 'Charon', gender: 'male', description: 'Deep & serious' },
  { id: 'Fenrir', name: 'Fenrir', gender: 'male', description: 'Bold & commanding' },
  { id: 'Orus', name: 'Orus', gender: 'male', description: 'Smooth & refined' },
];

// ─── Performance Mode Definitions ───────────────────────────────────────────

export type PerformanceMode = 'silent' | 'performance' | 'turbo';

export interface PerformanceModeConfig {
  id: PerformanceMode;
  name: string;
  description: string;
  icon: string; // emoji
}

export const PERFORMANCE_MODES: PerformanceModeConfig[] = [
  { id: 'silent', name: 'Silent', description: 'Minimal resources · Low power', icon: '🔇' },
  { id: 'performance', name: 'Performance', description: 'Balanced · Default mode', icon: '⚡' },
  { id: 'turbo', name: 'Turbo', description: 'Max power · GPU accelerated', icon: '🚀' },
];

// Available Gemini models for live voice
export const GEMINI_MODELS = [
  { id: 'gemini-3.1-flash-live-preview', name: 'Gemini 3.1 Flash (Live)', description: 'Fast & efficient' },
  { id: 'gemini-2.5-flash-preview-native-audio', name: 'Gemini 2.5 Flash (Native Audio)', description: 'Latest audio model' },
  { id: 'gemini-2.0-flash-live-001', name: 'Gemini 2.0 Flash (Live)', description: 'Stable release' },
];

// ─── Settings State ──────────────────────────────────────────────────────────

export interface Settings {
  themeId: string;
  voiceId: string;
  animationIntensity: 'minimal' | 'normal' | 'high';
  customInstructions: string;
  backgroundImage: string;  // base64 data URL or empty
  backgroundBlur: number;   // blur in px (0 to 20)
  // API & Model
  geminiApiKey: string;
  geminiModel: string;
  nvidiaApiKey: string;
  // Performance
  performanceMode: PerformanceMode;
  // Orb
  orbStyle: string;    // orb design id
  orbScale: number;    // 0.5 to 2.0
}

const STORAGE_KEY = 'friday-settings';

const DEFAULT_SETTINGS: Settings = {
  themeId: 'cyber-blue',
  voiceId: 'Zephyr',
  animationIntensity: 'normal',
  customInstructions: '',
  backgroundImage: '',
  backgroundBlur: 8,
  geminiApiKey: '',
  geminiModel: 'gemini-3.1-flash-live-preview',
  nvidiaApiKey: '',
  performanceMode: 'performance',
  orbStyle: 'wireframe',
  orbScale: 1.0,
};

function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.warn('Failed to load settings:', e);
  }
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save settings:', e);
  }
}

export function useSettings() {
  const [settings, setSettingsState] = useState<Settings>(loadSettings);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced save — avoids jank from rapid settings changes (slider drags, theme cycling)
  const debouncedSave = useCallback((newSettings: Settings) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveSettings(newSettings);
    }, 300);
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const updateSettings = useCallback((partial: Partial<Settings>) => {
    setSettingsState(prev => {
      const next = { ...prev, ...partial };
      debouncedSave(next);
      return next;
    });
  }, [debouncedSave]);

  // Memoize theme/voice lookups to avoid scanning arrays every render
  const currentTheme = useMemo(
    () => THEMES.find(t => t.id === settings.themeId) || THEMES[0],
    [settings.themeId]
  );
  const currentVoice = useMemo(
    () => VOICES.find(v => v.id === settings.voiceId) || VOICES[0],
    [settings.voiceId]
  );

  // Apply theme CSS variables to document root
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent-color', currentTheme.accent);
    root.style.setProperty('--accent-rgb', currentTheme.accentRgb);
    root.style.setProperty('--accent-glow', currentTheme.glow);
    root.style.setProperty('--accent-gradient', currentTheme.bgGradient);

    // Gradient-specific CSS variables
    if (currentTheme.isGradient && currentTheme.gradient) {
      root.style.setProperty('--theme-gradient', currentTheme.gradient);
      root.classList.add('gradient-theme');
    } else {
      root.style.removeProperty('--theme-gradient');
      root.classList.remove('gradient-theme');
    }
  }, [currentTheme]);

  return {
    settings,
    updateSettings,
    currentTheme,
    currentVoice,
    themes: THEMES,
    voices: VOICES,
  };
}

