import { motion } from "motion/react";
import { User as UserIcon, LogOut, Check } from "lucide-react";
import type { User } from "firebase/auth";
import type { ThemeConfig } from "../useSettings";
import { SectionTitle, GlassCard, InfoRow, containerVariants, itemVariants } from "../SettingsUI";

export function AccountTab({ user, currentTheme, onLogout }: {
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
