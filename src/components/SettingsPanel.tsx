import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X, Palette, Mic2, Brain, User as UserIcon, LogOut,
  Trash2, Plus, ChevronRight, Sparkles, Volume2, Check, ImageIcon,
  Cpu, KeyRound, Zap, Eye, EyeOff, Maximize2
} from "lucide-react";
import { signOut, type User } from "firebase/auth";
import { auth, memoryService } from "../lib/firebase";
import { THEMES, SOLID_THEMES, GRADIENT_THEMES, VOICES, PERFORMANCE_MODES, GEMINI_MODELS, type Settings, type ThemeConfig, type VoiceConfig } from "../lib/useSettings";
import { ORB_STYLES } from "../lib/orbStyles";

type Tab = "appearance" | "voice" | "memory" | "system" | "account";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  settings: Settings;
  updateSettings: (partial: Partial<Settings>) => void;
  currentTheme: ThemeConfig;
  currentVoice: VoiceConfig;
  addToast: (message: string, type: 'success' | 'error' | 'info' | 'warning', duration?: number) => void;
}

const tabs: { id: Tab; label: string; icon: any }[] = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "voice", label: "Voice", icon: Mic2 },
  { id: "system", label: "System", icon: Cpu },
  { id: "memory", label: "Memory", icon: Brain },
  { id: "account", label: "Account", icon: UserIcon },
];

// ─── Animation Variants ──────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.035, delayChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 350, damping: 25 } },
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SettingsPanel({
  isOpen, onClose, user, settings, updateSettings, currentTheme, currentVoice, addToast
}: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("appearance");
  const [facts, setFacts] = useState<string[]>([]);
  const [newFact, setNewFact] = useState("");
  const [customInstructions, setCustomInstructions] = useState(settings.customInstructions);
  const [loadingMemory, setLoadingMemory] = useState(false);

  // Load memory when the memory tab is selected
  useEffect(() => {
    if (activeTab === "memory" && user) {
      setLoadingMemory(true);
      memoryService.getUserMemory(user.uid).then(data => {
        if (data?.facts) setFacts(data.facts);
        if (data?.customInstructions) setCustomInstructions(data.customInstructions);
        setLoadingMemory(false);
      }).catch(() => setLoadingMemory(false));
    }
  }, [activeTab, user]);

  const handleDeleteFact = async (index: number) => {
    if (!user) return;
    const updated = facts.filter((_, i) => i !== index);
    try {
      await memoryService.updateFacts(user.uid, updated);
      setFacts(updated);
      addToast("Memory deleted", "info");
    } catch {
      addToast("Failed to delete memory", "error");
    }
  };

  const handleAddFact = async () => {
    if (!user || !newFact.trim()) return;
    try {
      await memoryService.saveFact(user.uid, newFact.trim());
      setFacts(prev => [...prev, newFact.trim()]);
      setNewFact("");
      addToast("Memory added", "success");
    } catch {
      addToast("Failed to add memory", "error");
    }
  };

  const handleSaveInstructions = async () => {
    if (!user) return;
    try {
      await memoryService.updateCustomInstructions(user.uid, customInstructions);
      updateSettings({ customInstructions });
      addToast("Custom instructions saved", "success");
    } catch {
      addToast("Failed to save instructions", "error");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      addToast("Signed out successfully", "info");
      onClose();
    } catch {
      addToast("Failed to sign out", "error");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop — deeper blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-xl z-50"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: "100%", opacity: 0.5, scale: 0.98 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: "100%", opacity: 0.5, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 280, damping: 30, mass: 0.8 }}
            className="fixed top-0 right-0 h-full w-full max-w-[540px] z-50 flex"
          >
            {/* Animated accent edge line */}
            <div
              className="w-[2px] flex-shrink-0 settings-edge-line"
              style={{ '--accent': currentTheme.accent } as React.CSSProperties}
            />

            <div
              className="flex-1 flex flex-col overflow-hidden"
              style={{
                background: 'linear-gradient(165deg, rgba(16,16,24,0.98) 0%, rgba(10,10,16,0.99) 50%, rgba(14,14,22,0.98) 100%)',
                boxShadow: `-20px 0 60px rgba(0,0,0,0.7), inset 1px 0 0 rgba(255,255,255,0.03)`,
              }}
            >
              {/* ─── Header ─────────────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: -15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08, type: "spring", stiffness: 300 }}
                className="px-6 pt-6 pb-4"
              >
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3.5">
                    <motion.div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center relative overflow-hidden"
                      style={{
                        background: `linear-gradient(135deg, rgba(${currentTheme.accentRgb}, 0.18), rgba(${currentTheme.accentRgb}, 0.04))`,
                        border: `1px solid rgba(${currentTheme.accentRgb}, 0.12)`,
                      }}
                      whileHover={{ scale: 1.08, rotate: 8 }}
                      transition={{ type: "spring", stiffness: 400 }}
                    >
                      <Sparkles className="w-5 h-5 relative z-10" style={{ color: currentTheme.accent }} />
                      {/* Pulsing ring */}
                      <motion.div
                        className="absolute inset-0 rounded-2xl"
                        style={{ border: `1.5px solid rgba(${currentTheme.accentRgb}, 0.25)` }}
                        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                      />
                    </motion.div>
                    <div>
                      <h2 className="text-[17px] font-bold text-white tracking-wide">Settings</h2>
                      <p className="text-[9px] text-white/20 font-mono tracking-[0.2em] uppercase mt-0.5">Customize Friday</p>
                    </div>
                  </div>
                  <motion.button
                    onClick={onClose}
                    className="w-9 h-9 rounded-xl flex items-center justify-center border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06] transition-colors"
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  >
                    <X className="w-4 h-4 text-white/40" />
                  </motion.button>
                </div>

                {/* ─── Segmented Tab Control ────────────────────────────── */}
                <div className="flex p-1 rounded-2xl bg-white/[0.025] border border-white/[0.05]">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <motion.button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className="relative flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-semibold uppercase tracking-wider z-10"
                        whileHover={!isActive ? { scale: 1.02 } : {}}
                        whileTap={{ scale: 0.97 }}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="settings-active-pill"
                            className="absolute inset-0 rounded-xl"
                            style={{
                              background: `rgba(${currentTheme.accentRgb}, 0.1)`,
                              border: `1px solid rgba(${currentTheme.accentRgb}, 0.12)`,
                              boxShadow: `0 0 20px rgba(${currentTheme.accentRgb}, 0.06), inset 0 1px 0 rgba(255,255,255,0.03)`,
                            }}
                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                          />
                        )}
                        <Icon
                          className="w-3.5 h-3.5 relative z-10 transition-colors duration-200"
                          style={{ color: isActive ? currentTheme.accent : 'rgba(255,255,255,0.28)' }}
                        />
                        <span
                          className="relative z-10 hidden sm:inline transition-colors duration-200"
                          style={{ color: isActive ? currentTheme.accent : 'rgba(255,255,255,0.28)' }}
                        >
                          {tab.label}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>

              {/* Accent gradient separator */}
              <div
                className="mx-6 h-px flex-shrink-0"
                style={{ background: `linear-gradient(90deg, transparent, rgba(${currentTheme.accentRgb}, 0.12), transparent)` }}
              />

              {/* ─── Content ────────────────────────────────────────────── */}
              <div className="flex-1 overflow-y-auto px-6 py-5 custom-scrollbar scroll-smooth">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ type: "spring", stiffness: 300, damping: 28, mass: 0.6 }}
                  >
                    {activeTab === "appearance" && (
                      <AppearanceTab settings={settings} updateSettings={updateSettings} currentTheme={currentTheme} />
                    )}
                    {activeTab === "voice" && (
                      <VoiceTab settings={settings} updateSettings={updateSettings} currentTheme={currentTheme} currentVoice={currentVoice} />
                    )}
                    {activeTab === "memory" && (
                      <MemoryTab
                        facts={facts} newFact={newFact} setNewFact={setNewFact}
                        customInstructions={customInstructions} setCustomInstructions={setCustomInstructions}
                        loading={loadingMemory} onDeleteFact={handleDeleteFact} onAddFact={handleAddFact}
                        onSaveInstructions={handleSaveInstructions} currentTheme={currentTheme} user={user}
                      />
                    )}
                    {activeTab === "system" && (
                      <SystemTab settings={settings} updateSettings={updateSettings} currentTheme={currentTheme} addToast={addToast} />
                    )}
                    {activeTab === "account" && (
                      <AccountTab user={user} currentTheme={currentTheme} onLogout={handleLogout} />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Shared Components ───────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function SectionTitle({ title, accentColor }: { title: string; accentColor?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      {accentColor && (
        <div
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: accentColor, boxShadow: `0 0 6px ${accentColor}` }}
        />
      )}
      <h3 className="text-[11px] text-white/30 uppercase tracking-[0.18em] font-semibold">{title}</h3>
      <div className="flex-1 h-px bg-white/[0.04]" />
    </div>
  );
}

function GlassCard({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4 ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

function GradientSwatch({ colors, size = 24 }: { colors: string[]; size?: number }) {
  const gradientStr = `conic-gradient(${colors.join(', ')}, ${colors[0]})`;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div
        className="absolute inset-0 rounded-full gradient-swatch-ring"
        style={{ background: gradientStr, opacity: 0.5, filter: 'blur(3px)' }}
      />
      <div
        className="absolute inset-[2px] rounded-full gradient-swatch"
        style={{
          background: `linear-gradient(135deg, ${colors.join(', ')}, ${colors[0]})`,
          boxShadow: `0 0 12px rgba(${colors[0]}, 0.3)`,
        }}
      />
    </div>
  );
}

function AccentSlider({ value, onChange, min, max, step, accentColor, glowColor, label, displayValue }: {
  value: number;
  onChange: (v: number) => void;
  min: string;
  max: string;
  step: string;
  accentColor: string;
  glowColor: string;
  label?: React.ReactNode;
  displayValue: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {label}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 settings-slider"
        style={{
          '--slider-color': accentColor,
          '--slider-glow': glowColor,
        } as React.CSSProperties}
      />
      <span className="text-[11px] text-white/35 font-mono w-10 text-right">{displayValue}</span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 px-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
      <span className="text-xs text-white/35">{label}</span>
      <span className="text-xs text-white/60 font-mono">{value}</span>
    </div>
  );
}

function AccentButton({ onClick, children, accentRgb, accent, className = "" }: {
  onClick: () => void;
  children: React.ReactNode;
  accentRgb: string;
  accent: string;
  className?: string;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className={`px-5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all ${className}`}
      style={{
        background: `linear-gradient(135deg, rgba(${accentRgb}, 0.15), rgba(${accentRgb}, 0.08))`,
        border: `1px solid rgba(${accentRgb}, 0.2)`,
        color: accent,
        boxShadow: `0 0 20px rgba(${accentRgb}, 0.06)`,
      }}
    >
      {children}
    </motion.button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Appearance Tab ──────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function AppearanceTab({ settings, updateSettings, currentTheme }: {
  settings: Settings;
  updateSettings: (p: Partial<Settings>) => void;
  currentTheme: ThemeConfig;
}) {
  const handleImageUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        alert('Image must be under 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        updateSettings({ backgroundImage: ev.target?.result as string });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const renderThemeCard = (theme: ThemeConfig) => {
    const isSelected = settings.themeId === theme.id;
    const isGrad = theme.isGradient && theme.gradientColors;

    return (
      <motion.button
        key={theme.id}
        variants={itemVariants}
        whileHover={{ scale: 1.03, y: -1 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => updateSettings({ themeId: theme.id })}
        className={`relative group p-3 rounded-xl text-left transition-all ${
          isGrad && isSelected ? 'gradient-border-animated' : ''
        }`}
        style={{
          '--card-gradient': theme.gradient || 'none',
          borderColor: !isGrad
            ? (isSelected ? theme.accent : 'rgba(255,255,255,0.05)')
            : (isSelected ? 'transparent' : 'rgba(255,255,255,0.05)'),
          borderWidth: '1px',
          borderStyle: 'solid',
          background: isSelected
            ? `linear-gradient(135deg, rgba(${theme.accentRgb}, 0.1), rgba(${theme.accentRgb}, 0.03))`
            : 'rgba(255,255,255,0.015)',
          boxShadow: isSelected
            ? `0 0 24px rgba(${theme.accentRgb}, 0.12), inset 0 1px 0 rgba(255,255,255,0.03)` : 'none',
        } as React.CSSProperties}
      >
        {isSelected && (
          <motion.div
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 20 }}
            className="absolute top-2 right-2"
          >
            <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: `rgba(${theme.accentRgb}, 0.2)` }}>
              <Check className="w-3 h-3" style={{ color: theme.accent }} />
            </div>
          </motion.div>
        )}
        <div className="flex items-center gap-3">
          {isGrad && theme.gradientColors ? (
            <GradientSwatch colors={theme.gradientColors} size={26} />
          ) : (
            <div
              className="w-6 h-6 rounded-full flex-shrink-0 ring-2 ring-offset-1 ring-offset-transparent"
              style={{
                background: theme.accent,
                boxShadow: `0 0 12px ${theme.glow}`,
                ringColor: isSelected ? theme.accent : 'transparent',
              }}
            />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {isGrad ? (
                <span className="text-xs font-semibold gradient-text-animated truncate" style={{ backgroundImage: theme.gradient }}>{theme.name}</span>
              ) : (
                <span className="text-xs font-medium text-white/90 truncate">{theme.name}</span>
              )}
              {isGrad && <span className="gradient-tag" style={{ background: `rgba(${theme.accentRgb}, 0.15)`, color: theme.accent }}>Gradient</span>}
            </div>
            <div className="text-[10px] text-white/30 truncate mt-0.5">{theme.description}</div>
          </div>
        </div>
      </motion.button>
    );
  };

  return (
    <motion.div className="space-y-7" variants={containerVariants} initial="hidden" animate="show">
      {/* Background Image */}
      <motion.div variants={itemVariants}>
        <SectionTitle title="Background Image" accentColor={currentTheme.accent} />
        <div className="mt-3 space-y-3">
          {settings.backgroundImage ? (
            <div className="relative group rounded-2xl overflow-hidden border border-white/[0.08]">
              <img src={settings.backgroundImage} alt="Background" className="w-full h-32 object-cover" style={{ filter: `blur(${settings.backgroundBlur / 4}px)` }} />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleImageUpload} className="px-4 py-2 rounded-xl bg-white/15 text-xs text-white/90 hover:bg-white/25 transition-colors backdrop-blur-sm border border-white/10">Change</motion.button>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => updateSettings({ backgroundImage: '' })} className="px-4 py-2 rounded-xl bg-red-500/20 text-xs text-red-300 hover:bg-red-500/30 transition-colors backdrop-blur-sm border border-red-500/15">Remove</motion.button>
              </div>
            </div>
          ) : (
            <motion.button
              onClick={handleImageUpload}
              whileHover={{ scale: 1.01, borderColor: 'rgba(255,255,255,0.15)' }}
              whileTap={{ scale: 0.99 }}
              className="w-full py-8 rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.015] hover:bg-white/[0.03] transition-all flex flex-col items-center gap-2.5"
            >
              <ImageIcon className="w-7 h-7 text-white/20" />
              <span className="text-xs text-white/30">Click to upload background image</span>
              <span className="text-[10px] text-white/15">PNG, JPG up to 5MB</span>
            </motion.button>
          )}

          {settings.backgroundImage && (
            <AccentSlider
              value={settings.backgroundBlur}
              onChange={(v) => updateSettings({ backgroundBlur: v })}
              min="0" max="20" step="1"
              accentColor={currentTheme.accent}
              glowColor={currentTheme.glow}
              label={<span className="text-[11px] text-white/30 w-8">Blur</span>}
              displayValue={`${settings.backgroundBlur}px`}
            />
          )}
        </div>
      </motion.div>

      {/* Solid Colors */}
      <motion.div variants={itemVariants}>
        <SectionTitle title={`Solid Colors (${SOLID_THEMES.length})`} accentColor={currentTheme.accent} />
        <motion.div className="grid grid-cols-2 gap-2 max-h-[280px] overflow-y-auto custom-scrollbar pr-1 mt-3" variants={containerVariants} initial="hidden" animate="show">
          {SOLID_THEMES.map(renderThemeCard)}
        </motion.div>
      </motion.div>

      {/* Animated Gradients */}
      <motion.div variants={itemVariants}>
        <SectionTitle title={`Animated Gradients (${GRADIENT_THEMES.length})`} accentColor={currentTheme.accent} />
        <GlassCard className="mt-3 !p-2.5 flex items-center gap-2 text-[11px] text-white/25">
          <Sparkles className="w-3 h-3 flex-shrink-0" style={{ color: currentTheme.accent, opacity: 0.5 }} />
          Gradient themes animate across the UI for a dynamic look
        </GlassCard>
        <motion.div className="grid grid-cols-2 gap-2 max-h-[320px] overflow-y-auto custom-scrollbar pr-1 mt-2" variants={containerVariants} initial="hidden" animate="show">
          {GRADIENT_THEMES.map(renderThemeCard)}
        </motion.div>
      </motion.div>

      {/* Orb Design */}
      <motion.div variants={itemVariants}>
        <SectionTitle title={`Orb Design (${ORB_STYLES.length})`} accentColor={currentTheme.accent} />
        <GlassCard className="mt-3 !p-2.5 flex items-center gap-2 text-[11px] text-white/25">
          🎨 5 animated + 20 static designs — static orbs pulse when speaking &amp; change color when listening
        </GlassCard>
        <motion.div className="grid grid-cols-3 gap-1.5 max-h-[420px] overflow-y-auto custom-scrollbar pr-1 mt-2" variants={containerVariants} initial="hidden" animate="show">
          {ORB_STYLES.map(orb => {
            const isSelected = settings.orbStyle === orb.id;
            return (
              <motion.button
                key={orb.id}
                variants={itemVariants}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => updateSettings({ orbStyle: orb.id })}
                className="relative flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all"
                style={{
                  borderColor: isSelected ? currentTheme.accent : 'rgba(255,255,255,0.04)',
                  background: isSelected
                    ? `linear-gradient(135deg, rgba(${currentTheme.accentRgb}, 0.12), rgba(${currentTheme.accentRgb}, 0.04))`
                    : 'rgba(255,255,255,0.015)',
                  boxShadow: isSelected ? `0 0 16px rgba(${currentTheme.accentRgb}, 0.12)` : 'none',
                }}
              >
                {isSelected && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500 }} className="absolute top-1 right-1">
                    <Check className="w-3 h-3" style={{ color: currentTheme.accent }} />
                  </motion.div>
                )}
                <span className="text-lg">{orb.icon}</span>
                <span className="text-[10px] font-medium truncate w-full" style={{ color: isSelected ? currentTheme.accent : 'rgba(255,255,255,0.6)' }}>
                  {orb.name}
                </span>
              </motion.button>
            );
          })}
        </motion.div>
      </motion.div>

      {/* Orb Size */}
      <motion.div variants={itemVariants}>
        <SectionTitle title="Orb Size" accentColor={currentTheme.accent} />
        <div className="mt-3">
          <AccentSlider
            value={settings.orbScale}
            onChange={(v) => updateSettings({ orbScale: v })}
            min="0.5" max="2" step="0.1"
            accentColor={currentTheme.accent}
            glowColor={currentTheme.glow}
            label={<Maximize2 className="w-3.5 h-3.5 text-white/20 flex-shrink-0" />}
            displayValue={`${settings.orbScale.toFixed(1)}x`}
          />
        </div>
      </motion.div>

      {/* Animation Intensity */}
      <motion.div variants={itemVariants}>
        <SectionTitle title="Animation Intensity" accentColor={currentTheme.accent} />
        <div className="flex gap-2 mt-3">
          {(["minimal", "normal", "high"] as const).map(level => {
            const isActive = settings.animationIntensity === level;
            return (
              <motion.button
                key={level}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => updateSettings({ animationIntensity: level })}
                className="flex-1 py-3 rounded-xl border text-xs font-semibold uppercase tracking-wider transition-all"
                style={{
                  borderColor: isActive ? currentTheme.accent : 'rgba(255,255,255,0.05)',
                  background: isActive
                    ? `linear-gradient(135deg, rgba(${currentTheme.accentRgb}, 0.12), rgba(${currentTheme.accentRgb}, 0.04))`
                    : 'rgba(255,255,255,0.015)',
                  color: isActive ? currentTheme.accent : 'rgba(255,255,255,0.35)',
                  boxShadow: isActive ? `0 0 16px rgba(${currentTheme.accentRgb}, 0.1)` : 'none',
                }}
              >
                {level}
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Voice Tab ───────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function VoiceTab({ settings, updateSettings, currentTheme, currentVoice }: {
  settings: Settings;
  updateSettings: (p: Partial<Settings>) => void;
  currentTheme: ThemeConfig;
  currentVoice: VoiceConfig;
}) {
  const femaleVoices = VOICES.filter(v => v.gender === 'female');
  const maleVoices = VOICES.filter(v => v.gender === 'male');

  const renderVoiceCard = (voice: VoiceConfig) => {
    const isSelected = settings.voiceId === voice.id;
    return (
      <motion.button
        key={voice.id}
        variants={itemVariants}
        whileHover={{ scale: 1.015, x: 2 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => updateSettings({ voiceId: voice.id })}
        className="flex items-center gap-3 p-3.5 rounded-xl border transition-all w-full text-left"
        style={{
          borderColor: isSelected ? `rgba(${currentTheme.accentRgb}, 0.3)` : 'rgba(255,255,255,0.04)',
          background: isSelected
            ? `linear-gradient(135deg, rgba(${currentTheme.accentRgb}, 0.1), rgba(${currentTheme.accentRgb}, 0.03))`
            : 'rgba(255,255,255,0.015)',
          boxShadow: isSelected ? `0 0 20px rgba(${currentTheme.accentRgb}, 0.08)` : 'none',
        }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: isSelected
              ? `linear-gradient(135deg, rgba(${currentTheme.accentRgb}, 0.25), rgba(${currentTheme.accentRgb}, 0.1))`
              : 'rgba(255,255,255,0.04)',
          }}
        >
          <Volume2 className="w-4 h-4" style={{ color: isSelected ? currentTheme.accent : 'rgba(255,255,255,0.25)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium" style={{ color: isSelected ? currentTheme.accent : 'rgba(255,255,255,0.75)' }}>
            {voice.name}
          </div>
          <div className="text-[11px] text-white/30 mt-0.5">{voice.description}</div>
        </div>
        {isSelected && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500 }}>
            <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: `rgba(${currentTheme.accentRgb}, 0.15)` }}>
              <Check className="w-3.5 h-3.5" style={{ color: currentTheme.accent }} />
            </div>
          </motion.div>
        )}
      </motion.button>
    );
  };

  return (
    <motion.div className="space-y-7" variants={containerVariants} initial="hidden" animate="show">
      {/* Current Voice Hero Card */}
      <motion.div variants={itemVariants}>
        <GlassCard
          className="!p-4 relative overflow-hidden"
          style={{ border: `1px solid rgba(${currentTheme.accentRgb}, 0.1)` }}
        >
          {/* Subtle gradient overlay */}
          <div
            className="absolute inset-0 opacity-[0.04] pointer-events-none rounded-2xl"
            style={{ background: `radial-gradient(ellipse at top right, ${currentTheme.accent}, transparent 70%)` }}
          />
          <div className="relative z-10">
            <div className="text-[10px] text-white/35 uppercase tracking-widest mb-1.5 font-mono">Current Voice</div>
            <div className="text-[15px] font-semibold" style={{ color: currentTheme.accent }}>
              {currentVoice.name}
            </div>
            <div className="text-[12px] text-white/40 mt-1">{currentVoice.description}</div>
            <div className="text-[10px] text-white/20 mt-2 flex items-center gap-1.5">
              <div className="w-1 h-1 rounded-full bg-green-400/60" />
              Voice changes take effect on next connection
            </div>
          </div>
        </GlassCard>
      </motion.div>

      <motion.div variants={itemVariants}>
        <SectionTitle title="Female Voices" accentColor={currentTheme.accent} />
        <motion.div className="grid grid-cols-1 gap-2 mt-3" variants={containerVariants} initial="hidden" animate="show">
          {femaleVoices.map(v => renderVoiceCard(v))}
        </motion.div>
      </motion.div>

      <motion.div variants={itemVariants}>
        <SectionTitle title="Male Voices" accentColor={currentTheme.accent} />
        <motion.div className="grid grid-cols-1 gap-2 mt-3" variants={containerVariants} initial="hidden" animate="show">
          {maleVoices.map(v => renderVoiceCard(v))}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Memory Tab ──────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function MemoryTab({ facts, newFact, setNewFact, customInstructions, setCustomInstructions, loading, onDeleteFact, onAddFact, onSaveInstructions, currentTheme, user }: {
  facts: string[];
  newFact: string;
  setNewFact: (s: string) => void;
  customInstructions: string;
  setCustomInstructions: (s: string) => void;
  loading: boolean;
  onDeleteFact: (i: number) => void;
  onAddFact: () => void;
  onSaveInstructions: () => void;
  currentTheme: ThemeConfig;
  user: User | null;
}) {
  if (!user) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-20 text-white/25"
      >
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <Brain className="w-7 h-7 opacity-40" />
        </div>
        <p className="text-sm font-medium">Sign in to manage Friday's memory</p>
        <p className="text-[11px] text-white/15 mt-1">Your memories are stored securely in the cloud</p>
      </motion.div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 rounded-full border-t-transparent"
          style={{ borderColor: currentTheme.accent, borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  return (
    <motion.div className="space-y-7" variants={containerVariants} initial="hidden" animate="show">
      {/* Custom Instructions */}
      <motion.div variants={itemVariants}>
        <SectionTitle title="Custom Instructions" accentColor={currentTheme.accent} />
        <div className="mt-3 space-y-3">
          <textarea
            value={customInstructions}
            onChange={e => setCustomInstructions(e.target.value)}
            placeholder="Add custom instructions for Friday... (e.g., 'Always respond in a formal tone' or 'Remember I prefer metric units')"
            className="w-full h-32 rounded-xl border bg-white/[0.02] px-4 py-3 text-sm text-white/80 placeholder:text-white/15 resize-none focus:outline-none transition-all duration-300"
            style={{
              borderColor: `rgba(${currentTheme.accentRgb}, 0.08)`,
            }}
            onFocus={e => {
              e.target.style.borderColor = `rgba(${currentTheme.accentRgb}, 0.25)`;
              e.target.style.boxShadow = `0 0 20px rgba(${currentTheme.accentRgb}, 0.06)`;
            }}
            onBlur={e => {
              e.target.style.borderColor = `rgba(${currentTheme.accentRgb}, 0.08)`;
              e.target.style.boxShadow = 'none';
            }}
          />
          <AccentButton onClick={onSaveInstructions} accentRgb={currentTheme.accentRgb} accent={currentTheme.accent}>
            Save Instructions
          </AccentButton>
        </div>
      </motion.div>

      {/* Memories / Facts */}
      <motion.div variants={itemVariants}>
        <SectionTitle title={`Memories (${facts.length})`} accentColor={currentTheme.accent} />

        {/* Add new fact */}
        <div className="flex gap-2 mt-3">
          <input
            type="text"
            value={newFact}
            onChange={e => setNewFact(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onAddFact()}
            placeholder="Add a new memory..."
            className="flex-1 rounded-xl border bg-white/[0.02] px-4 py-2.5 text-sm text-white/80 placeholder:text-white/15 focus:outline-none transition-all duration-300"
            style={{ borderColor: `rgba(${currentTheme.accentRgb}, 0.08)` }}
            onFocus={e => {
              e.target.style.borderColor = `rgba(${currentTheme.accentRgb}, 0.25)`;
              e.target.style.boxShadow = `0 0 16px rgba(${currentTheme.accentRgb}, 0.06)`;
            }}
            onBlur={e => {
              e.target.style.borderColor = `rgba(${currentTheme.accentRgb}, 0.08)`;
              e.target.style.boxShadow = 'none';
            }}
          />
          <motion.button
            onClick={onAddFact}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all"
            style={{
              background: `linear-gradient(135deg, rgba(${currentTheme.accentRgb}, 0.2), rgba(${currentTheme.accentRgb}, 0.08))`,
              border: `1px solid rgba(${currentTheme.accentRgb}, 0.15)`,
            }}
          >
            <Plus className="w-4 h-4" style={{ color: currentTheme.accent }} />
          </motion.button>
        </div>

        {/* Facts list */}
        <motion.div className="space-y-2 mt-3" variants={containerVariants} initial="hidden" animate="show">
          {facts.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <Brain className="w-5 h-5 text-white/15" />
              </div>
              <div className="text-sm text-white/20">No memories yet</div>
              <div className="text-[11px] text-white/12 mt-1">Friday will remember things as you talk</div>
            </div>
          ) : (
            facts.map((fact, i) => (
              <motion.div
                key={`${i}-${fact}`}
                variants={itemVariants}
                className="group flex items-start gap-3 p-3.5 rounded-xl border border-white/[0.04] bg-white/[0.015] hover:bg-white/[0.03] hover:border-white/[0.07] transition-all duration-200"
              >
                <ChevronRight className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: currentTheme.accent, opacity: 0.4 }} />
                <span className="flex-1 text-sm text-white/55 leading-relaxed">{fact}</span>
                <motion.button
                  onClick={() => onDeleteFact(i)}
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400/50" />
                </motion.button>
              </motion.div>
            ))
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── System Tab ──────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function SystemTab({ settings, updateSettings, currentTheme, addToast }: {
  settings: Settings;
  updateSettings: (p: Partial<Settings>) => void;
  currentTheme: ThemeConfig;
  addToast: (message: string, type: 'success' | 'error' | 'info' | 'warning', duration?: number) => void;
}) {
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showNvidiaKey, setShowNvidiaKey] = useState(false);
  const [geminiKey, setGeminiKey] = useState(settings.geminiApiKey);
  const [nvidiaKey, setNvidiaKey] = useState(settings.nvidiaApiKey);

  const handleSaveKeys = () => {
    updateSettings({ geminiApiKey: geminiKey, nvidiaApiKey: nvidiaKey });
    addToast('API keys saved. Restart Friday for changes to take effect.', 'success');
  };

  return (
    <motion.div className="space-y-7" variants={containerVariants} initial="hidden" animate="show">
      {/* API Keys */}
      <motion.div variants={itemVariants}>
        <SectionTitle title="API Keys" accentColor={currentTheme.accent} />
        <GlassCard className="mt-3 space-y-4">
          {/* Gemini API Key */}
          <div className="space-y-2">
            <label className="text-[11px] text-white/35 font-mono flex items-center gap-1.5">
              <KeyRound className="w-3 h-3" /> Gemini API Key
            </label>
            <div className="relative">
              <input
                type={showGeminiKey ? 'text' : 'password'}
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="AIza..."
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border text-xs text-white/80 font-mono placeholder:text-white/12 focus:outline-none transition-all duration-300 pr-10"
                style={{ borderColor: `rgba(${currentTheme.accentRgb}, 0.08)` }}
                onFocus={e => {
                  e.target.style.borderColor = `rgba(${currentTheme.accentRgb}, 0.25)`;
                  e.target.style.boxShadow = `0 0 16px rgba(${currentTheme.accentRgb}, 0.06)`;
                }}
                onBlur={e => {
                  e.target.style.borderColor = `rgba(${currentTheme.accentRgb}, 0.08)`;
                  e.target.style.boxShadow = 'none';
                }}
              />
              <button
                onClick={() => setShowGeminiKey(!showGeminiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors"
              >
                {showGeminiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[9px] text-white/15 pl-1">Used for Gemini Live voice connection. Leave blank to use .env file.</p>
          </div>

          {/* NVIDIA API Key */}
          <div className="space-y-2">
            <label className="text-[11px] text-white/35 font-mono flex items-center gap-1.5">
              <KeyRound className="w-3 h-3" /> NVIDIA API Key
            </label>
            <div className="relative">
              <input
                type={showNvidiaKey ? 'text' : 'password'}
                value={nvidiaKey}
                onChange={(e) => setNvidiaKey(e.target.value)}
                placeholder="nvapi-..."
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border text-xs text-white/80 font-mono placeholder:text-white/12 focus:outline-none transition-all duration-300 pr-10"
                style={{ borderColor: `rgba(${currentTheme.accentRgb}, 0.08)` }}
                onFocus={e => {
                  e.target.style.borderColor = `rgba(${currentTheme.accentRgb}, 0.25)`;
                  e.target.style.boxShadow = `0 0 16px rgba(${currentTheme.accentRgb}, 0.06)`;
                }}
                onBlur={e => {
                  e.target.style.borderColor = `rgba(${currentTheme.accentRgb}, 0.08)`;
                  e.target.style.boxShadow = 'none';
                }}
              />
              <button
                onClick={() => setShowNvidiaKey(!showNvidiaKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors"
              >
                {showNvidiaKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[9px] text-white/15 pl-1">Used for image generation. Leave blank to use hardcoded key.</p>
          </div>

          <AccentButton onClick={handleSaveKeys} accentRgb={currentTheme.accentRgb} accent={currentTheme.accent} className="w-full">
            Save API Keys
          </AccentButton>
        </GlassCard>
      </motion.div>

      {/* Model Selection */}
      <motion.div variants={itemVariants}>
        <SectionTitle title="AI Model" accentColor={currentTheme.accent} />
        <motion.div className="space-y-2 mt-3" variants={containerVariants} initial="hidden" animate="show">
          {GEMINI_MODELS.map((model) => {
            const isSelected = settings.geminiModel === model.id;
            return (
              <motion.button
                key={model.id}
                variants={itemVariants}
                whileHover={{ scale: 1.01, x: 2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  updateSettings({ geminiModel: model.id });
                  addToast(`Model changed to ${model.name}. Restart for effect.`, 'info');
                }}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all"
                style={{
                  borderColor: isSelected ? `rgba(${currentTheme.accentRgb}, 0.25)` : 'rgba(255,255,255,0.04)',
                  background: isSelected
                    ? `linear-gradient(135deg, rgba(${currentTheme.accentRgb}, 0.1), rgba(${currentTheme.accentRgb}, 0.03))`
                    : 'rgba(255,255,255,0.015)',
                  boxShadow: isSelected ? `0 0 20px rgba(${currentTheme.accentRgb}, 0.08)` : 'none',
                }}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all"
                  style={{
                    background: isSelected ? currentTheme.accent : 'rgba(255,255,255,0.1)',
                    boxShadow: isSelected ? `0 0 10px ${currentTheme.glow}` : 'none',
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold" style={{ color: isSelected ? currentTheme.accent : 'rgba(255,255,255,0.65)' }}>
                    {model.name}
                  </div>
                  <div className="text-[10px] text-white/25 mt-0.5">{model.description}</div>
                </div>
                {isSelected && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500 }}>
                    <Check className="w-3.5 h-3.5" style={{ color: currentTheme.accent }} />
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </motion.div>
      </motion.div>

      {/* Performance Mode */}
      <motion.div variants={itemVariants}>
        <SectionTitle title="Performance Mode" accentColor={currentTheme.accent} />
        <motion.div className="space-y-2 mt-3" variants={containerVariants} initial="hidden" animate="show">
          {PERFORMANCE_MODES.map((mode) => {
            const isSelected = settings.performanceMode === mode.id;
            return (
              <motion.button
                key={mode.id}
                variants={itemVariants}
                whileHover={{ scale: 1.01, x: 2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  updateSettings({ performanceMode: mode.id });
                  addToast(`Performance mode: ${mode.name}`, 'info');
                }}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-xl border text-left transition-all"
                style={{
                  borderColor: isSelected ? `rgba(${currentTheme.accentRgb}, 0.25)` : 'rgba(255,255,255,0.04)',
                  background: isSelected
                    ? `linear-gradient(135deg, rgba(${currentTheme.accentRgb}, 0.1), rgba(${currentTheme.accentRgb}, 0.03))`
                    : 'rgba(255,255,255,0.015)',
                  boxShadow: isSelected ? `0 0 20px rgba(${currentTheme.accentRgb}, 0.08)` : 'none',
                }}
              >
                <span className="text-lg">{mode.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold" style={{ color: isSelected ? currentTheme.accent : 'rgba(255,255,255,0.65)' }}>
                    {mode.name}
                  </div>
                  <div className="text-[10px] text-white/25 mt-0.5">{mode.description}</div>
                </div>
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500 }}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
                    style={{ background: `rgba(${currentTheme.accentRgb}, 0.1)` }}
                  >
                    <Zap className="w-3 h-3" style={{ color: currentTheme.accent }} />
                    <span className="text-[9px] uppercase tracking-wider font-mono font-bold" style={{ color: currentTheme.accent }}>Active</span>
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </motion.div>

        <GlassCard className="mt-3 !p-3 text-[10px] text-white/20 leading-relaxed">
          <strong className="text-white/30">Silent:</strong> Reduces background processing &amp; animations.{' '}
          <strong className="text-white/30">Performance:</strong> Balanced mode for everyday use.{' '}
          <strong className="text-white/30">Turbo:</strong> Enables GPU acceleration for faster inference and peak responsiveness.
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Account Tab ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function AccountTab({ user, currentTheme, onLogout }: {
  user: User | null;
  currentTheme: ThemeConfig;
  onLogout: () => void;
}) {
  return (
    <motion.div className="space-y-7" variants={containerVariants} initial="hidden" animate="show">
      {/* Profile */}
      <motion.div variants={itemVariants}>
        <SectionTitle title="Profile" accentColor={currentTheme.accent} />
        {user ? (
          <GlassCard className="mt-3 !p-5 relative overflow-hidden" style={{ border: `1px solid rgba(${currentTheme.accentRgb}, 0.08)` }}>
            {/* Decorative gradient */}
            <div
              className="absolute inset-0 opacity-[0.03] pointer-events-none rounded-2xl"
              style={{ background: `radial-gradient(ellipse at top left, ${currentTheme.accent}, transparent 60%)` }}
            />
            <div className="flex items-center gap-4 relative z-10">
              {user.photoURL ? (
                <div className="relative">
                  <img
                    src={user.photoURL}
                    alt="Profile"
                    className="w-14 h-14 rounded-2xl"
                    style={{
                      border: `2px solid rgba(${currentTheme.accentRgb}, 0.25)`,
                      boxShadow: `0 0 20px rgba(${currentTheme.accentRgb}, 0.1)`,
                    }}
                    referrerPolicy="no-referrer"
                  />
                  <div
                    className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center border-2 border-[#0a0a10]"
                    style={{ background: '#22c55e' }}
                  >
                    <Check className="w-2 h-2 text-white" />
                  </div>
                </div>
              ) : (
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, rgba(${currentTheme.accentRgb}, 0.2), rgba(${currentTheme.accentRgb}, 0.05))`,
                    border: `1px solid rgba(${currentTheme.accentRgb}, 0.15)`,
                  }}
                >
                  <UserIcon className="w-6 h-6" style={{ color: currentTheme.accent }} />
                </div>
              )}
              <div>
                <div className="text-[15px] font-semibold text-white/90">{user.displayName || "User"}</div>
                <div className="text-xs text-white/35 mt-0.5">{user.email}</div>
              </div>
            </div>
          </GlassCard>
        ) : (
          <div className="text-center py-10 text-white/25 text-sm">Not signed in</div>
        )}
      </motion.div>

      {/* App Info */}
      <motion.div variants={itemVariants}>
        <SectionTitle title="App Info" accentColor={currentTheme.accent} />
        <div className="space-y-1.5 mt-3">
          <InfoRow label="Version" value="v3.1 Live" />
          <InfoRow label="Model" value="Gemini 3.1 Flash" />
          <InfoRow label="Voice Engine" value="Gemini Live" />
        </div>
      </motion.div>

      {/* Danger Zone */}
      {user && (
        <motion.div variants={itemVariants}>
          <SectionTitle title="Danger Zone" />
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={onLogout}
            className="mt-3 w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl border text-sm font-medium transition-all"
            style={{
              borderColor: 'rgba(239, 68, 68, 0.15)',
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.06), rgba(239, 68, 68, 0.02))',
              color: 'rgba(248, 113, 113, 0.9)',
            }}
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </motion.button>
        </motion.div>
      )}
    </motion.div>
  );
}
