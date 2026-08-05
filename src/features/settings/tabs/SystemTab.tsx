import { useState } from "react";
import { motion } from "motion/react";
import { Check, KeyRound, Zap, Eye, EyeOff } from "lucide-react";
import { PERFORMANCE_MODES, GEMINI_MODELS, type Settings, type ThemeConfig } from "../useSettings";
import { SectionTitle, GlassCard, AccentButton, containerVariants, itemVariants } from "../SettingsUI";

export function SystemTab({ settings, updateSettings, currentTheme, addToast }: {
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
