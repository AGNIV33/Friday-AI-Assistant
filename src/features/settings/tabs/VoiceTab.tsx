import { motion } from "motion/react";
import { Volume2, Check } from "lucide-react";
import { VOICES, type Settings, type ThemeConfig, type VoiceConfig } from "../useSettings";
import { SectionTitle, GlassCard, containerVariants, itemVariants } from "../SettingsUI";

export function VoiceTab({ settings, updateSettings, currentTheme, currentVoice }: {
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
