import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X, Palette, Mic2, Brain, User as UserIcon, LogOut,
  Trash2, Plus, ChevronRight, Sparkles, Volume2, Check, ImageIcon,
  Cpu, KeyRound, Zap, Eye, EyeOff, Circle, Maximize2
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
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-50"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: "100%", opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 32, mass: 0.8 }}
            className="fixed top-0 right-0 h-full w-full max-w-[520px] z-50 flex"
          >
            <div 
              className="flex-1 flex flex-col overflow-hidden rounded-l-2xl shadow-2xl"
              style={{
                background: 'linear-gradient(145deg, rgba(12,12,18,0.98) 0%, rgba(8,8,14,0.99) 100%)',
                borderLeft: `1px solid rgba(${currentTheme.accentRgb}, 0.12)`,
                boxShadow: `inset 1px 0 30px rgba(${currentTheme.accentRgb}, 0.03), -10px 0 40px rgba(0,0,0,0.5)`,
              }}
            >
              {/* Header */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                className="flex items-center justify-between px-6 py-5 border-b border-white/5"
              >
                <div className="flex items-center gap-3">
                  <motion.div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: `rgba(${currentTheme.accentRgb}, 0.15)` }}
                    whileHover={{ scale: 1.1, rotate: 15 }}
                    transition={{ type: "spring", stiffness: 400 }}
                  >
                    <Sparkles className="w-4 h-4" style={{ color: currentTheme.accent }} />
                  </motion.div>
                  <h2 className="text-lg font-semibold text-white tracking-wide">Settings</h2>
                </div>
                <motion.button
                  onClick={onClose}
                  className="p-2 rounded-xl hover:bg-white/5 transition-colors"
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <X className="w-5 h-5 text-white/50" />
                </motion.button>
              </motion.div>

              {/* Tab Navigation */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15, duration: 0.3 }}
                className="flex gap-0.5 px-3 py-2.5 border-b border-white/5 overflow-x-auto custom-scrollbar"
              >
                {tabs.map((tab, i) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <motion.button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + i * 0.04, duration: 0.25 }}
                      whileHover={{ scale: 1.04, y: -1 }}
                      whileTap={{ scale: 0.97 }}
                      className="relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium uppercase tracking-wider transition-colors flex-shrink-0"
                      style={{
                        color: isActive ? currentTheme.accent : 'rgba(255,255,255,0.35)',
                        background: isActive ? `rgba(${currentTheme.accentRgb}, 0.1)` : 'transparent',
                      }}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{tab.label}</span>
                      {isActive && (
                        <motion.div
                          layoutId="tab-indicator"
                          className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                          style={{ background: currentTheme.accent }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                      )}
                    </motion.button>
                  );
                })}
              </motion.div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-5 py-5 custom-scrollbar scroll-smooth">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ type: "spring", stiffness: 400, damping: 35, mass: 0.6 }}
                  >
                    {activeTab === "appearance" && (
                      <AppearanceTab
                        settings={settings}
                        updateSettings={updateSettings}
                        currentTheme={currentTheme}
                      />
                    )}
                    {activeTab === "voice" && (
                      <VoiceTab
                        settings={settings}
                        updateSettings={updateSettings}
                        currentTheme={currentTheme}
                        currentVoice={currentVoice}
                      />
                    )}
                    {activeTab === "memory" && (
                      <MemoryTab
                        facts={facts}
                        newFact={newFact}
                        setNewFact={setNewFact}
                        customInstructions={customInstructions}
                        setCustomInstructions={setCustomInstructions}
                        loading={loadingMemory}
                        onDeleteFact={handleDeleteFact}
                        onAddFact={handleAddFact}
                        onSaveInstructions={handleSaveInstructions}
                        currentTheme={currentTheme}
                        user={user}
                      />
                    )}
                    {activeTab === "system" && (
                      <SystemTab
                        settings={settings}
                        updateSettings={updateSettings}
                        currentTheme={currentTheme}
                        addToast={addToast}
                      />
                    )}
                    {activeTab === "account" && (
                      <AccountTab
                        user={user}
                        currentTheme={currentTheme}
                        onLogout={handleLogout}
                      />
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

// ─── Appearance Tab ─────────────────────────────────────────────────────────

function GradientSwatch({ colors, size = 24 }: { colors: string[]; size?: number }) {
  const gradientStr = `conic-gradient(${colors.join(', ')}, ${colors[0]})`;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Spinning outer ring */}
      <div
        className="absolute inset-0 rounded-full gradient-swatch-ring"
        style={{
          background: gradientStr,
          opacity: 0.5,
          filter: 'blur(3px)',
        }}
      />
      {/* Inner animated gradient fill */}
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
      // Limit to ~5MB
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
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => updateSettings({ themeId: theme.id })}
        className={`relative group p-3 rounded-xl text-left transition-all ${
          isGrad && isSelected ? 'gradient-border-animated' : ''
        }`}
        style={{
          '--card-gradient': theme.gradient || 'none',
          borderColor: !isGrad
            ? (isSelected ? theme.accent : 'rgba(255,255,255,0.06)')
            : (isSelected ? 'transparent' : 'rgba(255,255,255,0.06)'),
          borderWidth: '1px',
          borderStyle: 'solid',
          background: isSelected
            ? `rgba(${theme.accentRgb}, 0.08)`
            : 'rgba(255,255,255,0.02)',
          boxShadow: isSelected
            ? `0 0 20px rgba(${theme.accentRgb}, 0.15)` : 'none',
        } as React.CSSProperties}
      >
        {isSelected && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-2 right-2">
            <Check className="w-3.5 h-3.5" style={{ color: theme.accent }} />
          </motion.div>
        )}
        <div className="flex items-center gap-3">
          {isGrad && theme.gradientColors ? (
            <GradientSwatch colors={theme.gradientColors} size={24} />
          ) : (
            <div className="w-6 h-6 rounded-full flex-shrink-0" style={{ background: theme.accent, boxShadow: `0 0 10px ${theme.glow}` }} />
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
            <div className="text-[10px] text-white/35 truncate">{theme.description}</div>
          </div>
        </div>
      </motion.button>
    );
  };

  return (
    <div className="space-y-6">
      {/* Custom Background Image */}
      <SectionTitle title="Background Image" />
      <div className="space-y-3">
        {settings.backgroundImage ? (
          <div className="relative group rounded-xl overflow-hidden border border-white/10">
            <img src={settings.backgroundImage} alt="Background" className="w-full h-28 object-cover" style={{ filter: `blur(${settings.backgroundBlur / 4}px)` }} />
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={handleImageUpload} className="px-3 py-1.5 rounded-lg bg-white/15 text-xs text-white/90 hover:bg-white/25 transition-colors backdrop-blur-sm">Change</button>
              <button onClick={() => updateSettings({ backgroundImage: '' })} className="px-3 py-1.5 rounded-lg bg-red-500/20 text-xs text-red-300 hover:bg-red-500/30 transition-colors backdrop-blur-sm">Remove</button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleImageUpload}
            className="w-full py-6 rounded-xl border border-dashed border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20 transition-all flex flex-col items-center gap-2"
          >
            <ImageIcon className="w-6 h-6 text-white/25" />
            <span className="text-xs text-white/35">Click to upload background image</span>
            <span className="text-[10px] text-white/20">PNG, JPG up to 5MB</span>
          </button>
        )}

        {/* Blur Slider */}
        {settings.backgroundImage && (
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-white/35 w-8">Blur</span>
            <input
              type="range"
              min="0"
              max="20"
              step="1"
              value={settings.backgroundBlur}
              onChange={(e) => updateSettings({ backgroundBlur: parseInt(e.target.value) })}
              className="flex-1 accent-current h-1"
              style={{ accentColor: currentTheme.accent }}
            />
            <span className="text-[11px] text-white/40 font-mono w-8 text-right">{settings.backgroundBlur}px</span>
          </div>
        )}
      </div>

      {/* Solid Colors Section */}
      <SectionTitle title={`Solid Colors (${SOLID_THEMES.length})`} />
      <div className="grid grid-cols-2 gap-2 max-h-[280px] overflow-y-auto custom-scrollbar pr-1">
        {SOLID_THEMES.map(renderThemeCard)}
      </div>

      {/* Animated Gradients Section */}
      <SectionTitle title={`Animated Gradients (${GRADIENT_THEMES.length})`} />
      <div
        className="px-3 py-2 rounded-lg mb-1 text-[11px] text-white/30 flex items-center gap-2"
        style={{ background: 'rgba(255,255,255,0.02)' }}
      >
        <Sparkles className="w-3 h-3" style={{ color: currentTheme.accent, opacity: 0.6 }} />
        Gradient themes animate across the UI for a dynamic look
      </div>
      <div className="grid grid-cols-2 gap-2 max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
        {GRADIENT_THEMES.map(renderThemeCard)}
      </div>

      {/* Orb Design */}
      <SectionTitle title={`Orb Design (${ORB_STYLES.length})`} />
      <div
        className="px-3 py-2 rounded-lg mb-1 text-[11px] text-white/30 flex items-center gap-2"
        style={{ background: 'rgba(255,255,255,0.02)' }}
      >
        🎨 4 animated + 20 static designs — static orbs pulse when speaking & change color when listening
      </div>
      <div className="grid grid-cols-3 gap-1.5 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
        {ORB_STYLES.map(orb => {
          const isSelected = settings.orbStyle === orb.id;
          return (
            <motion.button
              key={orb.id}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => updateSettings({ orbStyle: orb.id })}
              className="relative flex flex-col items-center gap-1 p-2.5 rounded-xl border text-center transition-all"
              style={{
                borderColor: isSelected ? currentTheme.accent : 'rgba(255,255,255,0.06)',
                background: isSelected ? `rgba(${currentTheme.accentRgb}, 0.1)` : 'rgba(255,255,255,0.02)',
                boxShadow: isSelected ? `0 0 12px rgba(${currentTheme.accentRgb}, 0.15)` : 'none',
              }}
            >
              {isSelected && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-1 right-1">
                  <Check className="w-3 h-3" style={{ color: currentTheme.accent }} />
                </motion.div>
              )}
              <span className="text-lg">{orb.icon}</span>
              <span className="text-[10px] font-medium truncate w-full" style={{ color: isSelected ? currentTheme.accent : 'rgba(255,255,255,0.7)' }}>
                {orb.name}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Orb Size */}
      <SectionTitle title="Orb Size" />
      <div className="flex items-center gap-3">
        <Maximize2 className="w-3.5 h-3.5 text-white/25 flex-shrink-0" />
        <input
          type="range"
          min="0.5"
          max="2"
          step="0.1"
          value={settings.orbScale}
          onChange={(e) => updateSettings({ orbScale: parseFloat(e.target.value) })}
          className="flex-1 accent-current h-1"
          style={{ accentColor: currentTheme.accent }}
        />
        <span className="text-[11px] text-white/40 font-mono w-10 text-right">{settings.orbScale.toFixed(1)}x</span>
      </div>

      {/* Animation Intensity */}
      <SectionTitle title="Animation Intensity" />
      <div className="flex gap-2">
        {(["minimal", "normal", "high"] as const).map(level => (
          <button
            key={level}
            onClick={() => updateSettings({ animationIntensity: level })}
            className="flex-1 py-2.5 rounded-lg border text-xs font-medium uppercase tracking-wider transition-all"
            style={{
              borderColor: settings.animationIntensity === level
                ? currentTheme.accent : 'rgba(255,255,255,0.06)',
              background: settings.animationIntensity === level
                ? `rgba(${currentTheme.accentRgb}, 0.1)` : 'rgba(255,255,255,0.02)',
              color: settings.animationIntensity === level
                ? currentTheme.accent : 'rgba(255,255,255,0.4)',
            }}
          >
            {level}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Voice Tab ───────────────────────────────────────────────────────────────

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
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => updateSettings({ voiceId: voice.id })}
        className="flex items-center gap-3 p-3 rounded-xl border transition-all w-full text-left"
        style={{
          borderColor: isSelected ? currentTheme.accent : 'rgba(255,255,255,0.06)',
          background: isSelected
            ? `rgba(${currentTheme.accentRgb}, 0.08)` : 'rgba(255,255,255,0.02)',
        }}
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
          style={{
            background: isSelected ? `rgba(${currentTheme.accentRgb}, 0.2)` : 'rgba(255,255,255,0.05)',
          }}
        >
          <Volume2 className="w-4 h-4" style={{ color: isSelected ? currentTheme.accent : 'rgba(255,255,255,0.3)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium" style={{ color: isSelected ? currentTheme.accent : 'rgba(255,255,255,0.8)' }}>
            {voice.name}
          </div>
          <div className="text-[11px] text-white/35">{voice.description}</div>
        </div>
        {isSelected && <Check className="w-4 h-4 flex-shrink-0" style={{ color: currentTheme.accent }} />}
      </motion.button>
    );
  };

  return (
    <div className="space-y-6">
      <div className="p-3 rounded-xl border border-white/5 bg-white/[0.02]">
        <div className="text-[11px] text-white/40 uppercase tracking-wider mb-1">Current Voice</div>
        <div className="text-sm font-medium" style={{ color: currentTheme.accent }}>
          {currentVoice.name} — {currentVoice.description}
        </div>
        <div className="text-[11px] text-white/30 mt-1">Voice changes take effect on next connection</div>
      </div>

      <SectionTitle title="Female Voices" />
      <div className="grid grid-cols-1 gap-2">
        {femaleVoices.map(v => renderVoiceCard(v))}
      </div>

      <SectionTitle title="Male Voices" />
      <div className="grid grid-cols-1 gap-2">
        {maleVoices.map(v => renderVoiceCard(v))}
      </div>
    </div>
  );
}

// ─── Memory Tab ──────────────────────────────────────────────────────────────

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
      <div className="flex flex-col items-center justify-center py-16 text-white/30">
        <Brain className="w-10 h-10 mb-3 opacity-50" />
        <p className="text-sm">Sign in to manage Friday's memory</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          className="w-6 h-6 border-2 rounded-full border-t-transparent"
          style={{ borderColor: currentTheme.accent, borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Custom Instructions */}
      <SectionTitle title="Custom Instructions" />
      <div className="space-y-3">
        <textarea
          value={customInstructions}
          onChange={e => setCustomInstructions(e.target.value)}
          placeholder="Add custom instructions for Friday... (e.g., 'Always respond in a formal tone' or 'Remember I prefer metric units')"
          className="w-full h-28 rounded-xl border border-white/6 bg-white/[0.02] px-4 py-3 text-sm text-white/80 placeholder:text-white/20 resize-none focus:outline-none transition-colors"
          style={{ borderColor: `rgba(${currentTheme.accentRgb}, 0.1)` }}
          onFocus={e => e.target.style.borderColor = `rgba(${currentTheme.accentRgb}, 0.3)`}
          onBlur={e => e.target.style.borderColor = `rgba(${currentTheme.accentRgb}, 0.1)`}
        />
        <button
          onClick={onSaveInstructions}
          className="px-4 py-2 rounded-lg text-xs font-medium uppercase tracking-wider transition-all"
          style={{
            background: `rgba(${currentTheme.accentRgb}, 0.15)`,
            color: currentTheme.accent,
          }}
          onMouseEnter={e => (e.target as HTMLElement).style.background = `rgba(${currentTheme.accentRgb}, 0.25)`}
          onMouseLeave={e => (e.target as HTMLElement).style.background = `rgba(${currentTheme.accentRgb}, 0.15)`}
        >
          Save Instructions
        </button>
      </div>

      {/* Memories / Facts */}
      <SectionTitle title={`Memories (${facts.length})`} />
      
      {/* Add new fact */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newFact}
          onChange={e => setNewFact(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onAddFact()}
          placeholder="Add a new memory..."
          className="flex-1 rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none transition-colors"
          style={{ borderColor: `rgba(${currentTheme.accentRgb}, 0.1)` }}
          onFocus={e => e.target.style.borderColor = `rgba(${currentTheme.accentRgb}, 0.3)`}
          onBlur={e => e.target.style.borderColor = `rgba(${currentTheme.accentRgb}, 0.1)`}
        />
        <button
          onClick={onAddFact}
          className="p-2 rounded-lg transition-all"
          style={{ background: `rgba(${currentTheme.accentRgb}, 0.15)` }}
        >
          <Plus className="w-4 h-4" style={{ color: currentTheme.accent }} />
        </button>
      </div>

      {/* Facts list */}
      <div className="space-y-2">
        {facts.length === 0 ? (
          <div className="text-center py-8 text-white/25 text-sm">
            No memories yet. Friday will remember things as you talk.
          </div>
        ) : (
          facts.map((fact, i) => (
            <motion.div
              key={`${i}-${fact}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="group flex items-start gap-3 p-3 rounded-lg border border-white/5 bg-white/[0.015] hover:bg-white/[0.03] transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: currentTheme.accent, opacity: 0.5 }} />
              <span className="flex-1 text-sm text-white/60 leading-relaxed">{fact}</span>
              <button
                onClick={() => onDeleteFact(i)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400/60" />
              </button>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Account Tab ─────────────────────────────────────────────────────────────

function AccountTab({ user, currentTheme, onLogout }: {
  user: User | null;
  currentTheme: ThemeConfig;
  onLogout: () => void;
}) {
  return (
    <div className="space-y-6">
      <SectionTitle title="Profile" />
      
      {user ? (
        <div className="flex items-center gap-4 p-4 rounded-xl border border-white/5 bg-white/[0.02]">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt="Profile"
              className="w-14 h-14 rounded-full border-2"
              style={{ borderColor: `rgba(${currentTheme.accentRgb}, 0.3)` }}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: `rgba(${currentTheme.accentRgb}, 0.15)` }}
            >
              <UserIcon className="w-6 h-6" style={{ color: currentTheme.accent }} />
            </div>
          )}
          <div>
            <div className="text-sm font-medium text-white/90">{user.displayName || "User"}</div>
            <div className="text-xs text-white/40 mt-0.5">{user.email}</div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-white/30 text-sm">Not signed in</div>
      )}

      <SectionTitle title="App Info" />
      <div className="space-y-2">
        <InfoRow label="Version" value="v3.1 Live" />
        <InfoRow label="Model" value="Gemini 3.1 Flash" />
        <InfoRow label="Voice Engine" value="Gemini Live" />
      </div>

      {user && (
        <>
          <SectionTitle title="Danger Zone" />
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm font-medium hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </motion.button>
        </>
      )}
    </div>
  );
}

// ─── Shared Components ───────────────────────────────────────────────────────

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3">
      <h3 className="text-[11px] text-white/30 uppercase tracking-[0.2em] font-semibold">{title}</h3>
      <div className="flex-1 h-px bg-white/5" />
    </div>
  );
}

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
    <div className="space-y-6">
      {/* API Keys */}
      <SectionTitle title="API Keys" />
      <div className="space-y-3">
        {/* Gemini API Key */}
        <div className="space-y-1.5">
          <label className="text-[11px] text-white/40 font-mono flex items-center gap-1.5">
            <KeyRound className="w-3 h-3" /> Gemini API Key
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                type={showGeminiKey ? 'text' : 'password'}
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="AIza..."
                className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/8 text-xs text-white/80 font-mono placeholder:text-white/15 focus:outline-none focus:border-white/20 transition-colors"
              />
              <button
                onClick={() => setShowGeminiKey(!showGeminiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors"
              >
                {showGeminiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <p className="text-[9px] text-white/20">Used for Gemini Live voice connection. Leave blank to use .env file.</p>
        </div>

        {/* NVIDIA API Key */}
        <div className="space-y-1.5">
          <label className="text-[11px] text-white/40 font-mono flex items-center gap-1.5">
            <KeyRound className="w-3 h-3" /> NVIDIA API Key
          </label>
          <div className="flex-1 relative">
            <input
              type={showNvidiaKey ? 'text' : 'password'}
              value={nvidiaKey}
              onChange={(e) => setNvidiaKey(e.target.value)}
              placeholder="nvapi-..."
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/8 text-xs text-white/80 font-mono placeholder:text-white/15 focus:outline-none focus:border-white/20 transition-colors"
            />
            <button
              onClick={() => setShowNvidiaKey(!showNvidiaKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors"
            >
              {showNvidiaKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="text-[9px] text-white/20">Used for image generation. Leave blank to use hardcoded key.</p>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSaveKeys}
          className="w-full py-2 rounded-lg text-xs font-medium uppercase tracking-wider transition-all"
          style={{
            background: `rgba(${currentTheme.accentRgb}, 0.1)`,
            border: `1px solid rgba(${currentTheme.accentRgb}, 0.3)`,
            color: currentTheme.accent,
          }}
        >
          Save API Keys
        </button>
      </div>

      {/* Model Selection */}
      <SectionTitle title="AI Model" />
      <div className="space-y-2">
        {GEMINI_MODELS.map((model) => (
          <button
            key={model.id}
            onClick={() => {
              updateSettings({ geminiModel: model.id });
              addToast(`Model changed to ${model.name}. Restart for effect.`, 'info');
            }}
            className="w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all"
            style={{
              borderColor: settings.geminiModel === model.id
                ? currentTheme.accent : 'rgba(255,255,255,0.06)',
              background: settings.geminiModel === model.id
                ? `rgba(${currentTheme.accentRgb}, 0.08)` : 'rgba(255,255,255,0.02)',
            }}
          >
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{
                background: settings.geminiModel === model.id ? currentTheme.accent : 'rgba(255,255,255,0.15)',
                boxShadow: settings.geminiModel === model.id ? `0 0 8px ${currentTheme.glow}` : 'none',
              }}
            />
            <div className="min-w-0">
              <div className="text-xs font-medium" style={{
                color: settings.geminiModel === model.id ? currentTheme.accent : 'rgba(255,255,255,0.7)',
              }}>{model.name}</div>
              <div className="text-[10px] text-white/30">{model.description}</div>
            </div>
            {settings.geminiModel === model.id && (
              <Check className="w-3.5 h-3.5 ml-auto flex-shrink-0" style={{ color: currentTheme.accent }} />
            )}
          </button>
        ))}
      </div>

      {/* Performance Mode */}
      <SectionTitle title="Performance Mode" />
      <div className="space-y-2">
        {PERFORMANCE_MODES.map((mode) => {
          const isSelected = settings.performanceMode === mode.id;
          return (
            <button
              key={mode.id}
              onClick={() => {
                updateSettings({ performanceMode: mode.id });
                addToast(`Performance mode: ${mode.name}`, 'info');
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all"
              style={{
                borderColor: isSelected ? currentTheme.accent : 'rgba(255,255,255,0.06)',
                background: isSelected ? `rgba(${currentTheme.accentRgb}, 0.08)` : 'rgba(255,255,255,0.02)',
                boxShadow: isSelected ? `0 0 15px rgba(${currentTheme.accentRgb}, 0.1)` : 'none',
              }}
            >
              <span className="text-lg">{mode.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold" style={{
                  color: isSelected ? currentTheme.accent : 'rgba(255,255,255,0.7)',
                }}>{mode.name}</div>
                <div className="text-[10px] text-white/30">{mode.description}</div>
              </div>
              {isSelected && (
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3 h-3" style={{ color: currentTheme.accent }} />
                  <span className="text-[9px] uppercase tracking-wider font-mono" style={{ color: currentTheme.accent }}>Active</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div
        className="px-3 py-2 rounded-lg text-[10px] text-white/25 leading-relaxed"
        style={{ background: 'rgba(255,255,255,0.02)' }}
      >
        <strong className="text-white/35">Silent:</strong> Reduces background processing & animations.{' '}
        <strong className="text-white/35">Performance:</strong> Balanced mode for everyday use.{' '}
        <strong className="text-white/35">Turbo:</strong> Enables GPU acceleration (GTX 1650) for faster inference and peak responsiveness.
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.015]">
      <span className="text-xs text-white/35">{label}</span>
      <span className="text-xs text-white/60 font-mono">{value}</span>
    </div>
  );
}
