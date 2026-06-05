import React, { useState, useEffect, useRef, useMemo, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertCircle, Globe, LogIn, User as UserIcon, Settings, LayoutGrid, MoonStar, Mic2 } from "lucide-react";
import { useFriday } from "./lib/useFriday";
import { useToast } from "./lib/useToast";
import { useSettings } from "./lib/useSettings";
import ToastContainer from "./components/Toast";
import ProgressBar from "./components/ProgressBar";
import FridayOrb from "./components/FridayOrb";
import WidgetManager from "./components/WidgetManager";

// ─── Lazy-loaded heavy components (only loaded when opened) ─────────────────
const SettingsPanel = lazy(() => import("./components/SettingsPanel"));
const AppBrowser = lazy(() => import("./components/AppBrowser"));
const MapView = lazy(() => import("./components/MapView"));
const VisionHUD = lazy(() => import("./components/VisionHUD"));


export default function App() {
  const { toasts, addToast, removeToast } = useToast();
  const { settings, updateSettings, currentTheme, currentVoice } = useSettings();
  const { state, error, user, isGameMode, isSleeping, isGeneratingImage, progressTask, mapCommand, widgets, login, toggleConnection, clearMapCommand, getPlaybackAmplitude, closeWidget, isVisionActive, visionMode, visionResult, visionVideoRef, visionScreenThumbnail, visionCursorPosition, visionScreenDimensions, closeVision } = useFriday(addToast, settings.voiceId, settings);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [appBrowserOpen, setAppBrowserOpen] = useState(false);

  // Live clock — DOM-mutation approach avoids React re-renders every second
  const clockRef = useRef<HTMLDivElement>(null);
  const dateRef  = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      if (clockRef.current) {
        clockRef.current.textContent = now.toLocaleTimeString('en-US', {
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
        });
      }
      if (dateRef.current) {
        dateRef.current.textContent = now.toLocaleDateString('en-US', {
          weekday: 'long', month: 'short', day: 'numeric', year: 'numeric',
        });
      }
    };
    tick(); // run immediately so there's no blank frame
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  const isConnected = state !== "disconnected";
  const isConnecting = state === "connecting";
  const isSpeaking = state === "speaking";
  const mapActive = !!mapCommand;

  // Use theme color (game mode still overrides with red)
  const accentColor = isGameMode ? "#ff0055" : currentTheme.accent;
  const accentRgb = isGameMode ? "255, 0, 85" : currentTheme.accentRgb;
  const isGradientTheme = !isGameMode && currentTheme.isGradient && currentTheme.gradientColors;

  // Memoize expensive computed values to avoid rebuilding on every render
  const bgAtmosphere = useMemo(() => isConnected
    ? isGradientTheme
      ? `radial-gradient(circle at 50% 50%, ${currentTheme.gradientColors![0]} 0%, ${currentTheme.gradientColors![1]} 25%, transparent 55%)`
      : `radial-gradient(circle at 50% 50%, ${accentColor} 0%, transparent 50%)`
    : 'radial-gradient(circle at 50% 50%, #333 0%, transparent 50%)'
  , [isConnected, isGradientTheme, accentColor, currentTheme.gradientColors]);

  return (
    <div className="relative h-screen w-screen flex flex-col bg-friday-dark font-sans select-none overflow-hidden">
      {/* Custom Background Image */}
      {settings.backgroundImage && (
        <div
          className="absolute inset-0 z-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${settings.backgroundImage})`,
            filter: `blur(${settings.backgroundBlur}px)`,
            transform: 'translateZ(0) scale(1.1)', // GPU layer isolation + prevent blur edge artifacts
            willChange: 'transform', // dedicated compositor layer — prevents blur recalc on overlapping animations
            // No transition-all — 'transition-all' recalculates every property each frame
          }}
        />
      )}
      {/* Dark overlay on background image for readability */}
      {settings.backgroundImage && (
        <div className="absolute inset-0 z-0 bg-black/50" />
      )}

      {/* Background Atmosphere */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-[1]">
        <div
          className={`friday-atmosphere absolute top-[-10%] left-[-10%] w-[120%] h-[120%] transition-opacity duration-700 ${
            isGradientTheme && isConnected ? 'opacity-25 gradient-swatch' : 'opacity-30'
          }`}
          style={{ background: bgAtmosphere }}
        />
        {/* Speaking atmosphere — static div, CSS opacity only (no mount/unmount) */}
        <div
          className={isGradientTheme ? 'gradient-swatch' : ''}
          style={{
            position: 'absolute',
            inset: 0,
            opacity: isSpeaking ? 0.2 : 0,
            background: isGradientTheme
              ? `radial-gradient(circle at 50% 50%, ${currentTheme.gradientColors![0]} 0%, ${currentTheme.gradientColors![2] || currentTheme.gradientColors![1]} 35%, transparent 70%)`
              : `radial-gradient(circle at 50% 50%, ${accentColor} 0%, transparent 70%)`,
            transition: 'opacity 400ms ease',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Top Bar — hidden when map is active */}
      {!mapActive && (
      <div className="friday-top-bar relative flex items-center z-20 flex-shrink-0">
        {/* Clock & Date — Left (DOM-mutated, no React re-render on tick) */}
        <div className="flex flex-col gap-0.5 flex-shrink-0">
          <div
            ref={clockRef}
            className="friday-clock font-light font-mono tracking-wider leading-none"
            style={{ color: accentColor, opacity: 0.85 }}
          />
          <div
            ref={dateRef}
            className="friday-date uppercase tracking-[0.2em] font-mono leading-none"
            style={{ color: `rgba(${accentRgb}, 0.45)` }}
          />
        </div>

        {/* User Profile & Settings — Center */}
        <div className="flex-1 flex items-center justify-center gap-2 flex-wrap min-w-0">
          {!user ? (
            <button 
              onClick={login}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition-colors text-xs uppercase tracking-widest"
            >
              <LogIn className="w-3 h-3" />
              Sign In
            </button>
          ) : (
            <div 
              className="flex items-center gap-3 px-3 py-1.5 rounded-full border"
              style={{
                borderColor: `rgba(${accentRgb}, 0.2)`,
                background: `rgba(${accentRgb}, 0.05)`,
              }}
            >
              <span 
                className="text-[10px] uppercase tracking-tighter font-mono"
                style={{ color: `rgba(${accentRgb}, 0.8)` }}
              >
                {user.displayName?.split(' ')[0]}
              </span>
              {user.photoURL ? (
                <img 
                  src={user.photoURL} alt="Profile" 
                  className="w-6 h-6 rounded-full border"
                  style={{ borderColor: `rgba(${accentRgb}, 0.4)` }}
                  referrerPolicy="no-referrer" 
                />
              ) : (
                <UserIcon className="w-4 h-4" style={{ color: accentColor }} />
              )}
            </div>
          )}

          {/* Settings Button */}
          <motion.button
            whileHover={{ scale: 1.1, rotate: 45 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSettingsOpen(true)}
            className="p-2.5 rounded-xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.08] transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4 text-white/50" />
          </motion.button>

          {/* App Browser Button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setAppBrowserOpen(true)}
            className="p-2.5 rounded-xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.08] transition-colors"
            title="App Browser"
          >
            <LayoutGrid className="w-4 h-4 text-white/50" />
          </motion.button>
        </div>

        {/* Spacer to balance the layout (same width as clock) */}
        <div className="friday-spacer flex-shrink-0 hidden md:block" style={{ width: 'clamp(80px, 12vw, 170px)' }} />
      </div>
      )}

      {/* Main Content — minimized to corner when map is active */}
      <div className={`relative z-10 flex flex-col items-center friday-center-gap flex-1 min-h-0 justify-center ${mapActive ? 'friday-orb-minimized' : ''}`}>
        {/* Status Display — hidden when map active */}
        {!mapActive && (
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`friday-title font-light tracking-[0.2em] uppercase transition-colors duration-500 ${
              isGradientTheme ? 'gradient-text-animated' : ''
            }`}
            style={isGradientTheme
              ? { backgroundImage: currentTheme.gradient }
              : { color: accentColor }
            }
          >
            Friday
          </motion.h1>
          <div className="h-6 flex items-center justify-center overflow-hidden">
            {/* CSS-only crossfade: single always-mounted element, opacity transition only.
                AnimatePresence was unmounting+remounting the DOM node on every state change,
                triggering a React re-render cascade at the same moment the orb ramps to 60fps. */}
            <span
              className="friday-status font-mono uppercase tracking-widest text-white/50"
              style={{ transition: 'opacity 250ms ease' }}
            >
              {isGeneratingImage && "Generating Image..."}
              {!isGeneratingImage && isSleeping && "Sleeping..."}
              {!isGeneratingImage && !isSleeping && state === "disconnected" && "Offline"}
              {!isGeneratingImage && !isSleeping && state === "connecting" && "Initializing Systems..."}
              {!isGeneratingImage && !isSleeping && state === "connected" && "Online & Ready"}
              {!isGeneratingImage && !isSleeping && state === "listening" && "Listening..."}
              {!isGeneratingImage && !isSleeping && state === "speaking" && "Speaking..."}
            </span>
          </div>

        </div>
        )}

        {/* Central Interface — Animated Wireframe Orb */}
        <div className="relative group flex-shrink min-h-0 flex items-center justify-center">
          <FridayOrb
            state={state}
            accentColor={accentColor}
            gradientColors={isGradientTheme ? currentTheme.gradientColors : undefined}
            isGameMode={isGameMode}
            onClick={toggleConnection}
            disabled={isConnecting}
            getPlaybackAmplitude={getPlaybackAmplitude}
            orbStyle={settings.orbStyle}
            orbScale={settings.orbScale}
          />
        </div>

        {/* Image Generation Indicator */}
        <AnimatePresence>
          {isGeneratingImage && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-3 px-5 py-2.5 rounded-full border border-purple-500/30 bg-purple-500/10 mt-4"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full"
              />
              <span className="text-xs font-mono uppercase tracking-widest text-purple-400">Generating Image…</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Sleep / Wake Indicator ── */}
        <AnimatePresence>
          {isSleeping && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="flex flex-col items-center gap-2"
            >
              {/* Moon pulse ring */}
              <div className="relative flex items-center justify-center">
                <motion.div
                  animate={{ scale: [1, 1.45, 1], opacity: [0.18, 0, 0.18] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute w-14 h-14 rounded-full"
                  style={{ background: `rgba(${accentRgb}, 0.2)` }}
                />
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.08, 0.3] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
                  className="absolute w-10 h-10 rounded-full"
                  style={{ background: `rgba(${accentRgb}, 0.15)` }}
                />
                <div
                  className="relative z-10 flex items-center justify-center w-9 h-9 rounded-full border"
                  style={{
                    borderColor: `rgba(${accentRgb}, 0.25)`,
                    background: `rgba(${accentRgb}, 0.08)`,
                  }}
                >
                  <MoonStar className="w-4 h-4" style={{ color: `rgba(${accentRgb}, 0.7)` }} />
                </div>
              </div>

              {/* Wake word hints */}
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-3">
                  {/* Hey Friday hint */}
                  <div
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-mono uppercase tracking-widest"
                    style={{
                      borderColor: `rgba(${accentRgb}, 0.2)`,
                      background: `rgba(${accentRgb}, 0.06)`,
                      color: `rgba(${accentRgb}, 0.6)`,
                    }}
                  >
                    <Mic2 className="w-3 h-3" />
                    <span>"Hey Friday"</span>
                  </div>

                  <span className="text-white/15 text-[10px] font-mono">or</span>

                  {/* Double clap hint */}
                  <div
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-mono uppercase tracking-widest"
                    style={{
                      borderColor: `rgba(${accentRgb}, 0.2)`,
                      background: `rgba(${accentRgb}, 0.06)`,
                      color: `rgba(${accentRgb}, 0.6)`,
                    }}
                  >
                    <span>👏👏 Double Clap</span>
                  </div>
                </div>
                <span className="text-white/20 text-[9px] font-mono uppercase tracking-widest">to wake Friday</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Info — hidden when map active */}
      {!mapActive && (
      <div className="friday-bottom-bar relative flex flex-col items-center gap-3 flex-shrink-0 z-20 pb-3">
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-friday-red/10 border border-friday-red/20 text-friday-red text-sm"
          >
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </motion.div>
        )}

        <div className="flex items-center gap-6 text-white/20">
          {/* Performance Mode Badge */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border"
            style={{
              borderColor: `rgba(${accentRgb}, 0.2)`,
              background: `rgba(${accentRgb}, 0.05)`,
            }}
          >
            <span className="text-[10px]">
              {settings.performanceMode === 'silent' ? '🔇' : settings.performanceMode === 'turbo' ? '🚀' : '⚡'}
            </span>
            <span
              className="text-[9px] uppercase tracking-widest font-mono font-semibold"
              style={{ color: `rgba(${accentRgb}, 0.7)` }}
            >
              {settings.performanceMode}
            </span>
          </div>

          <div className="w-1 h-1 rounded-full bg-white/10" />

          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            <span className="text-[10px] uppercase tracking-widest font-mono">Memory Active</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-white/10" />
          <span className="text-[10px] uppercase tracking-widest font-mono">v3.1 Live</span>
        </div>
      </div>
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Task Progress Bar */}
      <ProgressBar task={progressTask} />

      {/* Settings Panel (lazy-loaded, only mounted when opened) */}
      {settingsOpen && (
        <Suspense fallback={null}>
          <SettingsPanel
            isOpen={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            user={user}
            settings={settings}
            updateSettings={updateSettings}
            currentTheme={currentTheme}
            currentVoice={currentVoice}
            addToast={addToast}
          />
        </Suspense>
      )}

      {/* App Browser (lazy-loaded, only mounted when opened) */}
      {appBrowserOpen && (
        <Suspense fallback={null}>
          <AppBrowser
            isOpen={appBrowserOpen}
            onClose={() => setAppBrowserOpen(false)}
            accentColor={accentColor}
            accentRgb={accentRgb}
          />
        </Suspense>
      )}

      {/* Geospatial Map View (lazy-loaded, only mounted when map command is active) */}
      {mapCommand && (
        <Suspense fallback={null}>
          <MapView
            command={mapCommand}
            onClose={clearMapCommand}
            accentColor={accentColor}
            accentRgb={accentRgb}
          />
        </Suspense>
      )}

      {/* Floating Widgets (music, news, image, youtube, custom) */}
      <WidgetManager
        widgets={widgets}
        onCloseWidget={closeWidget}
        accentColor={accentColor}
      />

      {/* Vision Intelligence HUD */}
      {isVisionActive && (
        <Suspense fallback={null}>
          <VisionHUD
            mode={visionMode}
            videoRef={visionVideoRef}
            result={visionResult ?? undefined}
            onClose={closeVision}
            screenThumbnail={visionScreenThumbnail}
            cursorPosition={visionCursorPosition}
            screenDimensions={visionScreenDimensions}
          />
        </Suspense>
      )}
    </div>
  );
}
