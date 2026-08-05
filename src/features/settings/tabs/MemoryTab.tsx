import { motion } from "motion/react";
import { Brain, Trash2, Plus, ChevronRight } from "lucide-react";
import type { User } from "firebase/auth";
import type { ThemeConfig } from "../useSettings";
import { SectionTitle, AccentButton, containerVariants, itemVariants } from "../SettingsUI";

export function MemoryTab({ facts, newFact, setNewFact, customInstructions, setCustomInstructions, loading, onDeleteFact, onAddFact, onSaveInstructions, currentTheme, user }: {
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
