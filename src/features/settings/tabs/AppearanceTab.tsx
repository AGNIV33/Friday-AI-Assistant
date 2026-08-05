import React from "react";
import { motion } from "motion/react";
import { Sparkles, Check, ImageIcon, Maximize2 } from "lucide-react";
import { SOLID_THEMES, GRADIENT_THEMES, type Settings, type ThemeConfig } from "../useSettings";
import { ORB_STYLES } from "@/features/orb/orbStyles";
import { SectionTitle, GlassCard, GradientSwatch, AccentSlider, containerVariants, itemVariants } from "../SettingsUI";

export function AppearanceTab({ settings, updateSettings, currentTheme }: {
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
