import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X, Palette, Mic2, Cpu, Brain, User as UserIcon, Sparkles, Radar,
} from "lucide-react";
import { signOut, type User } from "firebase/auth";
import { auth, memoryService } from "@/services/firebase";
import { type Settings, type ThemeConfig, type VoiceConfig } from "./useSettings";
import { AppearanceTab } from "./tabs/AppearanceTab";
import { VoiceTab } from "./tabs/VoiceTab";
import { MemoryTab } from "./tabs/MemoryTab";
import { SystemTab } from "./tabs/SystemTab";
import { AccountTab } from "./tabs/AccountTab";
import { ProactiveTab } from "./tabs/ProactiveTab";
type Tab = "appearance" | "voice" | "memory" | "system" | "proactive" | "account";

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
  { id: "proactive", label: "Proactive", icon: Radar },
  { id: "account", label: "Account", icon: UserIcon },
];

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
                    {activeTab === "proactive" && (
                      <ProactiveTab settings={settings} updateSettings={updateSettings} currentTheme={currentTheme} />
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
