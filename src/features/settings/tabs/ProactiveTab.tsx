import { motion } from "motion/react";
import { Radar, Clock, ShieldAlert } from "lucide-react";
import { type Settings, type ThemeConfig } from "../useSettings";
import { SectionTitle, GlassCard, Toggle, containerVariants, itemVariants } from "../SettingsUI";

export function ProactiveTab({ settings, updateSettings, currentTheme }: {
  settings: Settings;
  updateSettings: (p: Partial<Settings>) => void;
  currentTheme: ThemeConfig;
}) {
  const master = settings.proactiveEnabled;

  return (
    <motion.div className="space-y-7" variants={containerVariants} initial="hidden" animate="show">
      {/* Master switch */}
      <motion.div variants={itemVariants}>
        <SectionTitle title="Proactive Mode" accentColor={currentTheme.accent} />
        <GlassCard className="mt-3">
          <Toggle
            checked={master}
            onChange={(v) => updateSettings({ proactiveEnabled: v })}
            label="Let Friday speak up on her own"
            description="When off, Friday only responds when spoken to. Nothing below runs until this is on."
            accentColor={currentTheme.accent}
            accentRgb={currentTheme.accentRgb}
          />
          <div className="mt-3 flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <Radar className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: currentTheme.accent, opacity: 0.6 }} />
            <p className="text-[11px] text-white/35 leading-relaxed">
              Friday never interrupts mid-sentence — anything that comes up while you're
              talking waits until the conversation is idle.
            </p>
          </div>
        </GlassCard>
      </motion.div>

      {/* Individual behaviours */}
      <motion.div variants={itemVariants}>
        <SectionTitle title="What She Can Bring Up" accentColor={currentTheme.accent} />
        <GlassCard className="mt-3 divide-y divide-white/[0.04]">
          <Toggle
            checked={settings.proactiveDailyBriefing}
            onChange={(v) => updateSettings({ proactiveDailyBriefing: v })}
            label="Daily briefing"
            description="A short greeting with the time, weather and system status when you wake her."
            accentColor={currentTheme.accent}
            accentRgb={currentTheme.accentRgb}
            disabled={!master}
          />
          <Toggle
            checked={settings.proactiveHealthWatchdog}
            onChange={(v) => updateSettings({ proactiveHealthWatchdog: v })}
            label="System health warnings"
            description="Speaks up if CPU, memory or disk space stays under pressure for a while."
            accentColor={currentTheme.accent}
            accentRgb={currentTheme.accentRgb}
            disabled={!master}
          />
          <Toggle
            checked={settings.proactiveSuggestions}
            onChange={(v) => updateSettings({ proactiveSuggestions: v })}
            label="Usage suggestions"
            description="Offers something relevant when you've been quiet, based on what you usually do at this time of day."
            accentColor={currentTheme.accent}
            accentRgb={currentTheme.accentRgb}
            disabled={!master}
          />
        </GlassCard>
      </motion.div>

      {/* Clipboard history — independent of the proactive master switch */}
      <motion.div variants={itemVariants}>
        <SectionTitle title="Clipboard History" accentColor={currentTheme.accent} />
        <GlassCard className="mt-3">
          <Toggle
            checked={settings.clipboardHistoryEnabled}
            onChange={(v) => updateSettings({ clipboardHistoryEnabled: v })}
            label="Remember what I copy"
            description="Lets you ask 'what did I copy earlier?' and paste older items back."
            accentColor={currentTheme.accent}
            accentRgb={currentTheme.accentRgb}
          />
          <div className="mt-3 flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-amber-500/[0.06] border border-amber-500/[0.15]">
            <ShieldAlert className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-400/70" />
            <p className="text-[11px] text-amber-200/50 leading-relaxed">
              This records <strong>everything</strong> you copy, which can include passwords.
              It's stored only on this machine and never uploaded — but leave it off if you
              copy sensitive credentials.
            </p>
          </div>
        </GlassCard>
      </motion.div>

      {/* Quiet hours */}
      <motion.div variants={itemVariants}>
        <SectionTitle title="Quiet Hours" accentColor={currentTheme.accent} />
        <GlassCard className="mt-3">
          <Toggle
            checked={settings.proactiveQuietHoursEnabled}
            onChange={(v) => updateSettings({ proactiveQuietHoursEnabled: v })}
            label="Stay silent during set hours"
            description="Friday won't volunteer anything in this window. She still answers when spoken to."
            accentColor={currentTheme.accent}
            accentRgb={currentTheme.accentRgb}
            disabled={!master}
          />

          {settings.proactiveQuietHoursEnabled && master && (
            <div className="mt-4 flex items-center gap-3">
              <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: currentTheme.accent, opacity: 0.5 }} />
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="time"
                  value={settings.proactiveQuietStart}
                  onChange={(e) => updateSettings({ proactiveQuietStart: e.target.value })}
                  className="flex-1 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-white/70 font-mono outline-none focus:border-white/20 transition-colors"
                />
                <span className="text-[10px] text-white/25 uppercase tracking-wider">to</span>
                <input
                  type="time"
                  value={settings.proactiveQuietEnd}
                  onChange={(e) => updateSettings({ proactiveQuietEnd: e.target.value })}
                  className="flex-1 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-white/70 font-mono outline-none focus:border-white/20 transition-colors"
                />
              </div>
            </div>
          )}
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
