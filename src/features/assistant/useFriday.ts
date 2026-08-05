import { useState, useCallback, useRef, useEffect } from "react";
import { AudioStreamer } from "./audio-streamer";
// LiveSession is imported dynamically inside connect(). It pulls in
// @google/genai (~280kB), which is only needed once the user actually starts a
// session — keeping it out of the startup bundle makes the app boot faster.
// The type import below is erased at compile time and costs nothing.
import type { LiveSession, SessionState } from "./live-session";
import { auth, googleProvider, memoryService, setGoogleAccessToken } from "@/services/firebase";
import { signInWithPopup, onAuthStateChanged, User, GoogleAuthProvider } from "firebase/auth";
import type { Settings } from "@/features/settings/useSettings";
import type { MapCommand } from "@/features/map/MapView";
import type { WidgetData } from "@/features/widgets/WidgetManager";
import { perf } from "./perf";
import { useVisionCommands } from "@/features/vision/useVisionCommands";
import { dispatchToolCall } from "./handlers";
import { useProactive } from "./useProactive";

declare global {
  interface Window {
    electronAPI?: {
      platform: string;
      openApp: (appName: string) => Promise<{ success: boolean; error?: string }>;
      closeApp: (appName: string) => Promise<{ success: boolean; error?: string }>;
      openFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
      createFolder: (folderName: string, folderPath?: string) => Promise<{ success: boolean; error?: string; path?: string }>;
      closeChromeTab: () => Promise<{ success: boolean; error?: string }>;
      getSystemInfo: () => Promise<{
        success: boolean;
        cpu?: { model: string; cores: number; usagePercent: number };
        ram?: { totalGB: string; usedGB: string; freeGB: string; usagePercent: number };
        gpu?: { name: string };
        dateTime?: { date: string; time: string; timezone: string; iso: string };
        platform?: string;
        hostname?: string;
        arch?: string;
        error?: string;
      }>;
      getInstalledApps: () => Promise<{
        success: boolean;
        totalFound?: number;
        games?: Array<{ name: string; platform: string; installPath: string; appId: string }>;
        breakdown?: { steam: number; epic: number; gog: number; ea: number; ubisoft: number; xbox: number; registry: number };
        error?: string;
      }>;
      checkSocial: (platform: string) => Promise<{ success: boolean; error?: string }>;
      playMedia: (platform: string, query: string) => Promise<{ success: boolean; error?: string }>;
      searchGoogle: (query: string) => Promise<{ success: boolean; data?: string; error?: string }>;
      openInChrome: (url: string) => Promise<{ success: boolean; error?: string }>;
      generateImage: (prompt: string) => Promise<{ success: boolean; tempPath?: string; error?: string }>;
      saveGeneratedImage: (fileName: string, savePath?: string) => Promise<{ success: boolean; savedPath?: string; error?: string }>;
      whatsappInit: () => Promise<{ success: boolean; status?: string; message?: string; error?: string }>;
      whatsappStatus: () => Promise<{ success: boolean; status?: string; user?: string; phone?: string }>;
      whatsappSend: (contactNameOrNumber: string, message: string) => Promise<{ success: boolean; message?: string; error?: string; suggestions?: string[] }>;
      whatsappLogout: () => Promise<{ success: boolean; message?: string; error?: string }>;
      systemVolume: (action: string, level?: number) => Promise<{ success: boolean; result?: string; error?: string }>;
      systemBrightness: (action: string, level?: number) => Promise<{ success: boolean; result?: string; error?: string }>;
      openSettings: (page: string) => Promise<{ success: boolean; message?: string; error?: string }>;
      bluetoothControl: (action: string, deviceName?: string) => Promise<{ success: boolean; result?: string; message?: string; error?: string }>;
      wifiControl: (action: string, networkName?: string) => Promise<{ success: boolean; result?: string; message?: string; error?: string }>;
      positionWindow: (appName: string, position: string) => Promise<{ success: boolean; message?: string; error?: string }>;
      writeDocument: (target: string, content: string, title?: string) => Promise<{ success: boolean; message?: string; error?: string }>;
      formatWord: (action: string, value?: string) => Promise<{ success: boolean; result?: string; error?: string }>;
      getAllApps: () => Promise<{ success: boolean; totalApps?: number; categories?: Record<string, any[]>; error?: string }>;
      searchFiles: (query: string, searchIn?: string, type?: string) => Promise<{ success: boolean; results?: any[]; message?: string; error?: string }>;
      openSearchResult: (resultPath: string) => Promise<{ success: boolean; message?: string; error?: string }>;
      searchImages: (query: string, count?: number) => Promise<{ success: boolean; totalImages?: number; message?: string; error?: string }>;
      browseImage: (direction: string) => Promise<{ success: boolean; currentIndex?: number; total?: number; message?: string; error?: string }>;
      saveBrowsedImage: (fileName: string, savePath?: string) => Promise<{ success: boolean; savedPath?: string; message?: string; error?: string }>;
      openDocument: (name: string, searchIn?: string) => Promise<{ success: boolean; filePath?: string; message?: string; error?: string }>;
      deleteFile: (filePath: string, permanently?: boolean) => Promise<{ success: boolean; message?: string; error?: string }>;
      emptyRecycleBin: () => Promise<{ success: boolean; message?: string; error?: string }>;
      moveFile: (sourcePath: string, destPath: string) => Promise<{ success: boolean; message?: string; error?: string }>;
      organizeFolder: (folderPath: string, plan: Array<{ fileName: string; targetSubFolder: string }>) => Promise<{ success: boolean; message?: string; results?: any[]; totalMoved?: number; totalFailed?: number; error?: string }>;
      findAndPlayEpisode: (folderPath: string, season: number, episode: number, player: string) => Promise<{ success: boolean; filePath?: string; message?: string; error?: string }>;
      listFolderContents: (folderPath: string, sortBy?: string) => Promise<{ success: boolean; totalItems?: number; items?: any[]; sortedBy?: string; message?: string; error?: string }>;
      fridayMinimize: () => Promise<{ success: boolean; error?: string }>;
      fridayRestore: () => Promise<{ success: boolean; error?: string }>;
      // Conversation Cache
      cacheStartSession: () => Promise<{ success: boolean; sessionId?: string }>;
      cacheSaveTurn: (role: string, text: string, toolName?: string, toolArgs?: any, toolResult?: any) => Promise<{ success: boolean }>;
      cacheEndSession: (summary: string, topics: string[]) => Promise<{ success: boolean }>;
      cacheGetContext: () => Promise<{ success: boolean; recentSessions?: string; topTools?: string; topTopics?: string; detailedHistory?: string; totalSessions?: number }>;
      cacheGetFrequent: () => Promise<{ success: boolean; topTools?: [string, number][]; topTopics?: [string, number][] }>;
      cacheSetSessionSummary: (summary: string, topics: string[]) => Promise<{ success: boolean }>;
      cacheGetPatterns: () => Promise<{
        success: boolean;
        currentBucket?: string;
        bucketTools?: [string, number][];
        recentTools?: [string, number][];
        topTools?: [string, number][];
        sampleSize?: number;
      }>;
      // Proactive events (main → renderer). Returns an unsubscribe function.
      onProactiveEvent: (callback: (payload: any) => void) => () => void;
      // Scheduler
      schedulerAdd: (job: {
        label: string; text: string; runAt: number;
        repeat?: string | null; intervalMs?: number; priority?: string;
      }) => Promise<{ success: boolean; id?: string; scheduledFor?: string; error?: string }>;
      schedulerList: () => Promise<{ success: boolean; jobs?: Array<{ id: string; label: string; nextRun: string; repeat: string | null }> }>;
      schedulerCancel: (id: string) => Promise<{ success: boolean; removed?: number; error?: string }>;
      // Lightweight vitals (no PowerShell subprocess)
      getSystemVitals: () => Promise<{
        success: boolean;
        cpuPercent?: number | null;
        ram?: { totalGB: number; usedGB: number; freeGB: number; usagePercent: number };
        diskFreeGB?: number | null;
        uptimeHours?: number;
        error?: string;
      }>;
      setMonitorConfig: (config: { enabled: boolean; cpuPercent?: number; ramPercent?: number; diskFreeGB?: number }) => Promise<{ success: boolean }>;
      // Clipboard history
      clipboardSetEnabled: (enabled: boolean) => Promise<{ success: boolean; enabled?: boolean }>;
      clipboardHistory: (limit?: number) => Promise<{ success: boolean; total?: number; entries?: Array<{ index: number; preview: string; at: string }>; error?: string }>;
      clipboardSearch: (query: string) => Promise<{ success: boolean; matches?: Array<{ index: number; preview: string; at: string }>; count?: number; error?: string }>;
      clipboardRestore: (index: number) => Promise<{ success: boolean; restored?: string; error?: string }>;
      clipboardClear: () => Promise<{ success: boolean }>;
      // Notes
      noteAdd: (title: string | undefined, body: string, tags?: string[]) => Promise<{ success: boolean; id?: string; title?: string; error?: string }>;
      noteSearch: (query: string, limit?: number) => Promise<{ success: boolean; count?: number; notes?: Array<{ id: string; title: string; body: string; at: string }>; error?: string }>;
      noteList: (limit?: number) => Promise<{ success: boolean; total?: number; notes?: Array<{ id: string; title: string; at: string }>; error?: string }>;
      noteDelete: (query: string) => Promise<{ success: boolean; removed?: number; error?: string }>;
      // Routines
      routineSave: (name: string, steps: Array<{ tool: string; args?: any }>) => Promise<{ success: boolean; name?: string; stepCount?: number; error?: string }>;
      routineList: () => Promise<{ success: boolean; routines?: Array<{ name: string; stepCount: number; steps: string[] }> }>;
      routineGet: (name: string) => Promise<{ success: boolean; routine?: { name: string; steps: Array<{ tool: string; args: any }> }; error?: string }>;
      routineDelete: (name: string) => Promise<{ success: boolean; removed?: number; error?: string }>;
      // Document reading
      readDocumentText: (filePath: string) => Promise<{ success: boolean; fileName?: string; format?: string; text?: string; truncated?: boolean; originalChars?: number; error?: string }>;
      // Widgets
      fetchNews: () => Promise<{ success: boolean; articles?: any[]; error?: string }>;
      searchYoutubeEmbed: (query: string) => Promise<{ success: boolean; videoId?: string; embedUrl?: string; error?: string }>;
      searchYoutubeNews: (query: string) => Promise<{ success: boolean; results?: any[]; cached?: boolean; error?: string }>;
    };
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export function useFriday(addToast?: (msg: string, type: 'success' | 'error' | 'info' | 'warning', duration?: number) => void, voiceId: string = 'Zephyr', settings?: Settings) {
  const [state, setState] = useState<SessionState>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isGameMode, setIsGameMode] = useState<boolean>(false);
  const [isSleeping, setIsSleeping] = useState<boolean>(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState<boolean>(false);
  const [progressTask, setProgressTask] = useState<{
    active: boolean;
    label: string;
    type: 'search' | 'generate' | 'write' | 'web' | 'news' | 'general';
  } | null>(null);
  const [mapCommand, setMapCommand] = useState<MapCommand | null>(null);
  const [widgets, setWidgets] = useState<WidgetData[]>([]);
  // Emotional register — shifts the orb + accent colour to match the moment.
  const [tone, setTone] = useState<'neutral' | 'urgent' | 'calm'>('neutral');

  // ── Vision Intelligence Module ──
  const vision = useVisionCommands();
  const visionRef = useRef(vision);
  useEffect(() => { visionRef.current = vision; }, [vision]);

  const audioStreamerRef = useRef<AudioStreamer | null>(null);
  const liveSessionRef = useRef<LiveSession | null>(null);
  const connectingRef = useRef<boolean>(false); // mutex to prevent double-connect
  const squelchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // post-speak squelch

  // ── Pre-fetched memory cache (Optimization 4) ──
  // Memory is fetched in the background on login so connect() never blocks on Firebase.
  const cachedMemoryRef = useRef<{ memory: any; summaries: any; uid: string } | null>(null);

  // Auto-reconnect state
  const userDisconnectedRef = useRef<boolean>(true); // start as true so startup doesn't trigger reconnect
  const hasEverConnectedRef = useRef<boolean>(false); // becomes true after first successful connect
  const hasGreetedRef = useRef<boolean>(false);        // true after the ONE startup greeting is sent — never reset
  const reconnectAttemptsRef = useRef<number>(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionStartedAtRef = useRef<number>(0); // timestamp when connection became "connected"
  const lastDisconnectAtRef = useRef<number>(0);     // timestamp of last disconnect event
  // Keep latest settings/voice in refs so connect() always reads current values
  const settingsRef = useRef(settings);
  const voiceIdRef = useRef(voiceId);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { voiceIdRef.current = voiceId; }, [voiceId]);

  // Wake listener refs
  const wakeAudioContextRef = useRef<AudioContext | null>(null);
  const wakeStreamRef = useRef<MediaStream | null>(null);
  const wakeAnimFrameRef = useRef<number | null>(null);
  const wakeSpeechRef = useRef<any>(null);
  const isSleepingRef = useRef<boolean>(false); // sync ref for callbacks
  // Stable refs to avoid circular dependencies in callbacks
  const wakeUpRef = useRef<() => void>(() => {});
  const goSleepRef = useRef<() => void>(() => {});

  // ── Idle suggestion timer ──
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleSuggestionFiredRef = useRef<boolean>(false);
  const IDLE_SUGGESTION_DELAY_MS = 60000; // 60 seconds of silence

  // Handle Auth State — also pre-fetches memory in the background
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      // ── Pre-fetch memory on login (non-blocking) ──
      // This runs in the background so connect() can use cached data instantly.
      if (currentUser) {
        const uid = currentUser.uid;
        Promise.all([
          memoryService.getUserMemory(uid),
          memoryService.getRecentSummaries(uid),
        ]).then(([memory, summaries]) => {
          cachedMemoryRef.current = { memory, summaries, uid };
          console.log('[Friday] Memory pre-fetched and cached for instant connect.');
        }).catch((err) => {
          console.warn('[Friday] Memory pre-fetch failed (will retry on connect):', err);
        });
      } else {
        cachedMemoryRef.current = null;
      }
    });
    return () => unsubscribe();
  }, []);

  // ─── Auto-connect after auth resolves ────────────────────────────────────
  // Fires ONCE when user first signs in. Subsequent reconnects are handled
  // by the auto-reconnect effect below. Using hasMountedRef guards against
  // React StrictMode double-invocation.
  const autoConnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!user) return;
    // Already connected/connecting — do nothing
    if (connectingRef.current || hasEverConnectedRef.current) return;
    // Sleeping — let the wake listener handle reconnect
    if (isSleepingRef.current) return;

    autoConnectTimerRef.current = setTimeout(() => {
      // Re-check guards inside timeout (state may have changed)
      if (connectingRef.current || hasEverConnectedRef.current || isSleepingRef.current) return;
      userDisconnectedRef.current = false;
      connect();
    }, 300);

    return () => {
      if (autoConnectTimerRef.current) clearTimeout(autoConnectTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // only runs when user first becomes available

  // ─── Speaking gate: mute mic while Friday speaks to prevent echo loop ────
  // Without this, Friday's speaker output is captured by the mic and sent back
  // to the API, causing confused/erratic responses.
  useEffect(() => {
    if (state === "speaking") {
      // Friday is talking — mute mic immediately
      if (squelchTimerRef.current) clearTimeout(squelchTimerRef.current);
      audioStreamerRef.current?.setMuted(true);
    } else if (state === "listening") {
      // Friday finished talking — brief squelch to let speaker echo die out
      if (squelchTimerRef.current) clearTimeout(squelchTimerRef.current);
      squelchTimerRef.current = setTimeout(() => {
        audioStreamerRef.current?.setMuted(false);
      }, 100); // 100ms squelch — tight enough to feel instant, long enough to clear echo
    }
    return () => {
      if (squelchTimerRef.current) clearTimeout(squelchTimerRef.current);
    };
  }, [state]);

  const login = useCallback(async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      // Capture the Google OAuth token so Calendar/Gmail tools can call
      // Google's APIs. Sign-in still succeeds if the user declined those
      // scopes — the tools just report that access isn't granted.
      try {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        setGoogleAccessToken(credential?.accessToken || null);
      } catch (_) {
        setGoogleAccessToken(null);
      }
    } catch (err) {
      console.error("Login Error:", err);
      setError("Failed to sign in with Google.");
    }
  }, []);

  // ─── Wake Listener (clap + voice) ────────────────────────────────────────
  const startWakeListener = useCallback(async () => {
    console.log("[Friday] Wake listener starting…");

    // --- Clap detector via AudioWorklet (off main thread) ---
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      wakeStreamRef.current = stream;

      const audioCtx = new AudioContext();
      wakeAudioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);

      // Load the wake-detector worklet (runs clap detection entirely off main thread)
      try {
        await audioCtx.audioWorklet.addModule('/wake-detector-processor.js');
        const wakeNode = new AudioWorkletNode(audioCtx, 'wake-detector-processor');

        wakeNode.port.onmessage = (event: MessageEvent) => {
          if (event.data?.type === 'wake' && isSleepingRef.current) {
            console.log("[Friday] AudioWorklet: Double-clap detected — waking up!");
            wakeUpRef.current();
          }
        };

        source.connect(wakeNode);
        // Connect through silent gain to keep the audio graph alive
        const silentGain = audioCtx.createGain();
        silentGain.gain.value = 0;
        wakeNode.connect(silentGain);
        silentGain.connect(audioCtx.destination);

        // Store for cleanup (reuse the animFrame ref as a flag)
        wakeAnimFrameRef.current = -1; // sentinel: worklet mode, no interval to clear
        console.log("[Friday] Clap detector running via AudioWorklet (off main thread)");
      } catch (workletErr) {
        // Fallback: AudioWorklet not supported — use analyser + setInterval
        console.warn("[Friday] AudioWorklet wake detector failed, falling back to setInterval:", workletErr);

        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.fftSize);
        const CLAP_THRESHOLD = 180;
        const CLAP_WINDOW_MS = 1500;
        const COOLDOWN_MS = 300;
        let clapCount = 0;
        let firstClapTime = 0;
        let lastClapTime = 0;

        const clapInterval = setInterval(() => {
          if (!isSleepingRef.current) { clearInterval(clapInterval); return; }
          analyser.getByteTimeDomainData(dataArray);
          const peak = dataArray.reduce((max, v) => Math.max(max, Math.abs(v - 128)), 0);
          const now = Date.now();
          if (peak > CLAP_THRESHOLD && now - lastClapTime > COOLDOWN_MS) {
            lastClapTime = now;
            if (clapCount === 0) { clapCount = 1; firstClapTime = now; }
            else if (now - firstClapTime < CLAP_WINDOW_MS) {
              clapCount = 0; clearInterval(clapInterval); wakeUpRef.current(); return;
            } else { clapCount = 1; firstClapTime = now; }
          }
          if (clapCount === 1 && Date.now() - firstClapTime > CLAP_WINDOW_MS) clapCount = 0;
        }, 30);
        wakeAnimFrameRef.current = clapInterval as unknown as number;
      }
    } catch (err) {
      console.warn("[Friday] Could not start clap detector:", err);
    }

    // --- Wake-word via SpeechRecognition ---
    // Small delay to avoid microphone conflicts with clap detector
    setTimeout(() => {
      if (!isSleepingRef.current) return;

      const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognitionCtor) {
        const recognition = new SpeechRecognitionCtor();
        recognition.continuous = true;
        recognition.lang = "en-US";
        recognition.interimResults = false;
        recognition.maxAlternatives = 3;

        // ── Retry storm prevention ──────────────────────────────────────
        // Each failed recognition.start() creates a chunked upload to Google's
        // speech servers that immediately aborts → Chromium logs
        // "chunked_data_pipe_upload_data_stream OnSizeReceived Error: -2".
        // Exponential backoff + error cap prevents a tight retry loop.
        let consecutiveErrors = 0;
        let restarting = false; // guard: prevent onerror+onend both scheduling restarts
        const MAX_CONSECUTIVE_ERRORS = 5;

        const scheduleRestart = (delayMs: number) => {
          if (restarting) return; // already scheduled
          restarting = true;
          setTimeout(() => {
            restarting = false;
            if (isSleepingRef.current) {
              try { recognition.start(); } catch (_) {}
            }
          }, delayMs);
        };

        recognition.onresult = (event: any) => {
          if (!isSleepingRef.current) return;
          consecutiveErrors = 0; // successful result resets error counter
          // Check all result alternatives for better accuracy
          for (let i = 0; i < event.results.length; i++) {
            const result = event.results[i];
            if (!result.isFinal) continue;
            for (let j = 0; j < result.length; j++) {
              const transcript: string = result[j].transcript.toLowerCase().trim();
              console.log("[Friday] Heard while sleeping:", transcript);

              // Primary: "hey friday", "hi friday", "okay friday", "wake friday", etc.
              const primaryWake =
                /\b(hey|hi|ok|okay|wake|come back|activate|start|turn on)\s+friday\b/.test(transcript) ||
                /\bfriday\s+(wake up|come back|are you there|respond)\b/.test(transcript);

              // Secondary: just "friday" alone (high-confidence shortcut)
              const fridayAlone = transcript === "friday" || transcript === "friday.";

              if (primaryWake || fridayAlone) {
                console.log("[Friday] Wake-word detected — waking up!");
                try { recognition.stop(); } catch (_) {}
                wakeUpRef.current();
                return;
              }
            }
          }
        };

        recognition.onerror = (e: any) => {
          // Don't spam console on expected network errors
          if (e.error !== 'no-speech') {
            console.warn("[Friday] SpeechRecognition error:", e.error);
          }
          // Restart on recoverable errors if still sleeping
          if (isSleepingRef.current && e.error !== 'not-allowed' && e.error !== 'service-not-allowed') {
            consecutiveErrors++;
            if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
              console.warn(`[Friday] SpeechRecognition failed ${consecutiveErrors} times — switching to clap-only wake mode.`);
              // Stop retrying — clap detector still works as fallback.
              // Will recover next time the user manually wakes or the app restarts.
              return;
            }
            // Exponential backoff: 2s → 4s → 8s → 16s → 30s cap
            const baseDelay = e.error === 'network' ? 5000 : 2000;
            const backoffDelay = Math.min(baseDelay * Math.pow(2, consecutiveErrors - 1), 30000);
            scheduleRestart(backoffDelay);
          }
        };

        recognition.onend = () => {
          // Always restart if still sleeping — SpeechRecognition stops after silence
          if (isSleepingRef.current) {
            // If we just had an error, onerror already scheduled the restart
            if (consecutiveErrors > 0) return;
            console.log("[Friday] SpeechRecognition ended, restarting…");
            scheduleRestart(1000);
          }
        };

        try {
          recognition.start();
          wakeSpeechRef.current = recognition;
          console.log("[Friday] SpeechRecognition wake listener active");
        } catch (err) {
          console.warn("[Friday] SpeechRecognition failed to start:", err);
        }
      } else {
        console.warn("[Friday] SpeechRecognition not available — clap-only wake");
      }
    }, 800); // 800ms delay to let mic settle after clap detector grabs it
  }, []); // wakeUp is stable; injected via ref below

  const stopWakeListener = useCallback(() => {
    if (wakeAnimFrameRef.current !== null) {
      // If using setInterval fallback (not worklet sentinel -1), clear it
      if (wakeAnimFrameRef.current !== -1) {
        clearInterval(wakeAnimFrameRef.current);
      }
      wakeAnimFrameRef.current = null;
    }
    if (wakeAudioContextRef.current) {
      wakeAudioContextRef.current.close().catch(() => {});
      wakeAudioContextRef.current = null;
    }
    if (wakeStreamRef.current) {
      wakeStreamRef.current.getTracks().forEach(t => t.stop());
      wakeStreamRef.current = null;
    }
    if (wakeSpeechRef.current) {
      try { wakeSpeechRef.current.stop(); } catch (_) {}
      wakeSpeechRef.current = null;
    }
    console.log("[Friday] Wake listener stopped.");
  }, []);

  // ─── Connect ─────────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    // ── Mutex: prevent double-connect (StrictMode / rapid toggles) ──
    if (connectingRef.current) {
      console.warn('[Friday] connect() already in progress — skipping duplicate call');
      return;
    }
    connectingRef.current = true;

    // Read latest values from refs (avoids stale-closure bugs)
    const currentSettings = settingsRef.current;
    const currentVoiceId = voiceIdRef.current;

    // Use settings API key first, fall back to .env
    const apiKey = currentSettings?.geminiApiKey || process.env.GEMINI_API_KEY;
    const modelId = currentSettings?.geminiModel || 'gemini-3.1-flash-live-preview';
    if (!apiKey) {
      setError("Gemini API Key is missing. Set it in Settings > System.");
      connectingRef.current = false;
      return;
    }

    if (!auth.currentUser) {
      setError("Please sign in first so I can remember you.");
      connectingRef.current = false;
      return;
    }

    try {
      setError(null);
      const connectStartTime = performance.now();
      const uid = auth.currentUser.uid;

      // Load Memory Context — use pre-fetched cache if available, else fetch now
      let memory: any, summaries: any;
      if (cachedMemoryRef.current && cachedMemoryRef.current.uid === uid) {
        memory = cachedMemoryRef.current.memory;
        summaries = cachedMemoryRef.current.summaries;
        console.log('[Friday] Using pre-cached memory (0ms).');
        // Refresh cache in background for next connect
        Promise.all([
          memoryService.getUserMemory(uid),
          memoryService.getRecentSummaries(uid),
        ]).then(([m, s]) => {
          cachedMemoryRef.current = { memory: m, summaries: s, uid };
        }).catch(() => {});
      } else {
        perf.start('memory-load');
        [memory, summaries] = await Promise.all([
          memoryService.getUserMemory(uid),
          memoryService.getRecentSummaries(uid)
        ]);
        perf.end('memory-load');
        cachedMemoryRef.current = { memory, summaries, uid };
      }

      // Always inject current date/time so Friday knows it without needing a tool call
      const now = new Date();
      const currentDate = now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const currentTime = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // ── Time-of-day greeting & last-used tracking ──
      const hour = now.getHours();
      const timeOfDay = hour < 5 ? 'late night' : hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night';
      const greetingWord = hour < 5 ? 'Good Night' : hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : hour < 21 ? 'Good Evening' : 'Good Night';

      // Read last-used timestamp
      let lastUsedInfo = 'This is the first time the user is using Friday.';
      try {
        const lastUsedRaw = localStorage.getItem('friday-last-used');
        if (lastUsedRaw) {
          const lastUsedDate = new Date(lastUsedRaw);
          const diffMs = now.getTime() - lastUsedDate.getTime();
          const diffMins = Math.floor(diffMs / 60000);
          const diffHours = Math.floor(diffMins / 60);
          const diffDays = Math.floor(diffHours / 24);
          if (diffMins < 2) lastUsedInfo = 'The user was just here moments ago.';
          else if (diffMins < 60) lastUsedInfo = `The user last used Friday ${diffMins} minutes ago.`;
          else if (diffHours < 24) lastUsedInfo = `The user last used Friday about ${diffHours} hour${diffHours > 1 ? 's' : ''} ago.`;
          else if (diffDays === 1) lastUsedInfo = 'The user last used Friday yesterday.';
          else if (diffDays < 7) lastUsedInfo = `The user last used Friday ${diffDays} days ago.`;
          else lastUsedInfo = `The user last used Friday on ${lastUsedDate.toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })}.`;
        }
      } catch (_) {}
      // Save current time as last used
      try { localStorage.setItem('friday-last-used', now.toISOString()); } catch (_) {}

      // ── Load conversation cache context (persistent local memory) ──
      let cacheContext = '';
      try {
        if (window.electronAPI?.cacheGetContext) {
          const cacheData = await window.electronAPI.cacheGetContext();
          if (cacheData.success && cacheData.totalSessions && cacheData.totalSessions > 0) {
            cacheContext = `
        CONVERSATION HISTORY (from local cache — ${cacheData.totalSessions} past sessions):
        Recent sessions:
        ${cacheData.recentSessions || 'None'}
        
        Most used tools: ${cacheData.topTools || 'None yet'}
        Frequent topics: ${cacheData.topTopics || 'None yet'}
        
        Detailed recent actions:
        ${cacheData.detailedHistory || '[]'}
        
        Use this history to recall what the user talked about in past sessions. If they ask "what did we talk about last time" or "remember when I asked you to...", reference this data.`;
          }
        }
      } catch (e) {
        console.warn('[Friday] Cache context load failed:', e);
      }

      // ── Daily briefing (opt-in) ──
      // Gathers what Friday should volunteer at wake time. Only assembled on a
      // genuine first connect — never on an auto-reconnect, where she must stay
      // silent. Failures here are non-fatal; the briefing is simply skipped.
      let briefingContext = '';
      if (currentSettings?.proactiveEnabled && currentSettings?.proactiveDailyBriefing && !hasGreetedRef.current) {
        try {
          const vitals = await window.electronAPI?.getSystemVitals?.();
          const parts: string[] = [];
          if (vitals?.success) {
            if (typeof vitals.ram?.usagePercent === 'number') {
              parts.push(`memory at ${vitals.ram.usagePercent}%`);
            }
            if (typeof vitals.diskFreeGB === 'number' && vitals.diskFreeGB !== null) {
              parts.push(`${vitals.diskFreeGB}GB disk free`);
            }
            if (typeof vitals.uptimeHours === 'number') {
              parts.push(`up ${vitals.uptimeHours}h`);
            }
          }

          let pendingReminders = '';
          try {
            const jobs = await window.electronAPI?.schedulerList?.();
            const upcoming = (jobs?.jobs || []).slice(0, 3);
            if (upcoming.length) {
              pendingReminders = upcoming
                .map(j => `"${j.label}" at ${new Date(j.nextRun).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}`)
                .join('; ');
            }
          } catch (_) {}

          briefingContext = `
        DAILY BRIEFING (deliver this ONCE as part of your greeting, woven in naturally — do NOT read it as a list):
        System status: ${parts.length ? parts.join(', ') : 'nothing notable'}.
        ${pendingReminders ? `Upcoming reminders: ${pendingReminders}.` : 'No reminders scheduled.'}
        Mention only what's actually interesting or needs attention. If everything is normal, a passing "all systems nominal" is enough — do not recite numbers the user didn't ask for. Keep the whole greeting to 2-3 sentences.`;
        } catch (e) {
          console.warn('[Friday] Briefing assembly failed (non-fatal):', e);
        }
      }

      const context = `
        User UID: ${uid}
        Facts I know about you: ${memory?.facts?.join(", ") || "None yet."}
        Recent conversation summaries: ${summaries?.map((s: any) => s.summary).join(" | ") || "No previous sessions."}
        ${memory?.customInstructions ? `\nUSER CUSTOM INSTRUCTIONS (follow these strictly):\n${memory.customInstructions}` : ''}
        
        CURRENT DATE & TIME (refreshed at session start):
        Date: ${currentDate}
        Time: ${currentTime}
        Timezone: ${currentTimezone}
        ISO: ${now.toISOString()}
        Time of day: ${timeOfDay}
        Appropriate greeting: ${greetingWord}
        Always use this as the current date/time. If the user asks what time or date it is, answer directly from this context or call getSystemInfo for the freshest reading.
        
        LAST USED: ${lastUsedInfo}
        
        PERFORMANCE MODE: ${currentSettings?.performanceMode || 'performance'}
        
        IS_RECONNECT: ${hasGreetedRef.current ? 'true' : 'false'}
        ${hasGreetedRef.current ? 'NOTE: This is a RECONNECT (session restored after a drop). Do NOT greet. Do NOT speak. Just silently resume and wait for the user to talk to you.' : ''}
        ${cacheContext}
        ${briefingContext}
      `;

      // ── Start a new cache session (only on first connect, not reconnects) ──
      if (!hasGreetedRef.current) {
        try { window.electronAPI?.cacheStartSession?.(); } catch (_) {}
      }

      // ── Clean up any lingering previous instances to prevent resource leaks/zombies ──
      if (audioStreamerRef.current) {
        try {
          audioStreamerRef.current.stop();
          audioStreamerRef.current.dispose();
        } catch (_) {}
      }
      if (liveSessionRef.current) {
        try { liveSessionRef.current.disconnect(); } catch (_) {}
      }

      audioStreamerRef.current = new AudioStreamer(16000, {
        chunkSize: 4096,      // 256ms chunks — reduces WebSocket/encoding overhead 4x vs 1024
        vadEnabled: false,    // Gemini Live API has server-side VAD built-in via sendRealtimeInput
                              // Local VAD adds ~160-200ms delay. Let the server handle turn detection.
      });
      // Loaded on first connect rather than at startup — see the import note.
      // Vite caches the chunk, so subsequent connects pay nothing.
      const { LiveSession: LiveSessionClass } = await import("./live-session");
      liveSessionRef.current = new LiveSessionClass(apiKey);

      await liveSessionRef.current.connect({
        onStateChange: (newState) => {
          console.log(`[Friday] State: ${newState}`);
          if (newState === 'connected' || newState === 'listening') {
            connectionStartedAtRef.current = Date.now();
          }
          if (newState === 'disconnected') {
            lastDisconnectAtRef.current = Date.now();
            const aliveMs = connectionStartedAtRef.current ? Date.now() - connectionStartedAtRef.current : 0;
            console.warn(`[Friday] Session dropped after ${aliveMs}ms alive`);
          }
          setState(newState);
        },
        onAudioData: (base64) => audioStreamerRef.current?.playAudioChunk(base64),
        onInterrupted: () => audioStreamerRef.current?.stopPlayback(),
        onError: (err) => {
          console.error("[Friday] Live Session Error:", err);
          // Don't show error if we'll auto-reconnect
          if (userDisconnectedRef.current || isSleepingRef.current) {
            setError("Connection lost.");
          }
        },
        onToolCall: async (name, args) => {
          return dispatchToolCall(name, {
            args,
            electronAPI: window.electronAPI,
            uid,
            sendText: (text: string) => liveSessionRef.current?.sendText(text),
            addToast,
            setProgressTask,
            setMapCommand,
            setIsGameMode,
            setIsGeneratingImage,
            setWidgets,
            openWidget,
            closeAllWidgets,
            vision: visionRef.current,
            goSleep: () => goSleepRef.current(),
            setTone,
          });
        },
      }, context, currentVoiceId, modelId);

      // Only show toast on the first connect (not on auto-reconnects)
      const connectDuration = Math.round(performance.now() - connectStartTime);
      console.log(`[Friday] Connection established in ${connectDuration}ms`);
      if (reconnectAttemptsRef.current === 0) {
        addToast?.(`All Friday systems connected (${connectDuration}ms)`, "success");
      }

      await audioStreamerRef.current.start((base64) => {
        liveSessionRef.current?.sendAudio(base64);
      });

      // ✅ Mark as awake and unlock mutex — MUST happen after start()
      isSleepingRef.current = false;
      setIsSleeping(false);
      connectingRef.current = false;
      reconnectAttemptsRef.current = 0;
      userDisconnectedRef.current = false;
      hasEverConnectedRef.current = true; // allow auto-reconnect from now on

      // ── Send greeting ONLY on the very first startup (never on sleep→wake reconnects) ──
      // hasGreetedRef persists across the entire app lifetime and is never reset.
      if (!hasGreetedRef.current) {
        hasGreetedRef.current = true;
        setTimeout(() => {
          liveSessionRef.current?.sendText(
            "System: Session just started. Microphone is live. Please execute your STARTUP BEHAVIOR and greet the user proactively now."
          );
        }, 800); // 800ms for WebSocket + audio pipeline to fully stabilize
      }

      // ── Start idle suggestion timer ──
      idleSuggestionFiredRef.current = false;

    } catch (err: any) {
      console.error("Connection Error:", err);
      connectingRef.current = false; // ✅ always unlock mutex on error
      let errorMsg = "Failed to connect to Friday.";
      if (err.name === 'NotFoundError' || (err.message && err.message.includes('Requested device not found'))) {
        errorMsg = "Microphone not found. Please connect a microphone to use Friday.";
      } else if (err.name === 'NotAllowedError' || (err.message && err.message.includes('Permission denied'))) {
        errorMsg = "Microphone access denied. Please allow microphone permissions in your OS/Browser.";
      } else {
        errorMsg = `Connection failed: ${err.message || String(err)}`;
      }
      setError(errorMsg);
      setState("disconnected");
    }
  }, []);

  // ─── Auto-reconnect on unexpected session drop ────────────────────────────
  useEffect(() => {
    // Only attempt if this was a real unexpected drop:
    // - We have connected before (hasEverConnected)
    // - The user did NOT manually disconnect
    // - We are NOT sleeping
    // - We are NOT already trying to connect
    if (
      state !== "disconnected" ||
      !hasEverConnectedRef.current ||
      userDisconnectedRef.current ||
      isSleepingRef.current ||
      connectingRef.current
    ) {
      return;
    }

    // ── Stability guard ──
    // If the connection was alive for less than 5 seconds, it means the server
    // rejected us instantly (bad model, rate limit, auth error). Reconnecting
    // immediately would just create an infinite on/off loop. Give up instead.
    const aliveMs = connectionStartedAtRef.current
      ? lastDisconnectAtRef.current - connectionStartedAtRef.current
      : 0;
    if (aliveMs > 0 && aliveMs < 5000) {
      console.warn(`[Friday] Connection was only alive for ${aliveMs}ms — likely a server rejection. NOT auto-reconnecting.`);
      setError("Connection keeps dropping. Check your API key and network, then click the button to reconnect.");
      reconnectAttemptsRef.current = 0;
      return;
    }

    // ── Cooldown guard ──
    // Don't schedule a reconnect if we disconnected less than 3 seconds ago
    // (prevents overlapping reconnect attempts from rapid state changes).
    const timeSinceLastDisconnect = Date.now() - lastDisconnectAtRef.current;
    if (timeSinceLastDisconnect < 3000 && reconnectAttemptsRef.current > 0) {
      console.log(`[Friday] Cooldown: only ${timeSinceLastDisconnect}ms since last disconnect, skipping this effect cycle.`);
      return;
    }

    const MAX_ATTEMPTS = 5;
    if (reconnectAttemptsRef.current >= MAX_ATTEMPTS) {
      console.warn("[Friday] Max reconnect attempts reached. Giving up.");
      setError("Connection lost. Please click the button to reconnect.");
      reconnectAttemptsRef.current = 0;
      return;
    }

    const delay = Math.min(2000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
    console.log(`[Friday] Session dropped (was alive ${aliveMs}ms). Auto-reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${MAX_ATTEMPTS})…`);
    reconnectAttemptsRef.current += 1;

    reconnectTimerRef.current = setTimeout(() => {
      // Re-check all guards inside the timeout — user may have manually reconnected
      if (!userDisconnectedRef.current && !isSleepingRef.current && !connectingRef.current) {
        connect();
      }
    }, delay);

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // ─── Go To Sleep ──────────────────────────────────────────────────────────
  // NOTE: declared after connect so it can reference it via wakeUp callback
  const goSleep = useCallback(() => {
    userDisconnectedRef.current = true; // mark intentional sleep so no auto-reconnect
    audioStreamerRef.current?.stop();
    liveSessionRef.current?.disconnect();
    setState("disconnected");
    isSleepingRef.current = true;
    setIsSleeping(true);
    // Clear map when going to sleep
    setMapCommand(null);
    console.log("[Friday] Going to sleep. Starting wake listener…");
    startWakeListener();
    // Minimize window to taskbar
    if (window.electronAPI?.fridayMinimize) {
      window.electronAPI.fridayMinimize().catch(() => {});
    }
  }, [startWakeListener]);

  // ─── Wake Up ──────────────────────────────────────────────────────────────
  const wakeUp = useCallback(() => {
    console.log("[Friday] Waking up…");
    stopWakeListener();
    isSleepingRef.current = false;
    setIsSleeping(false);
    // Restore window from taskbar to fullscreen
    if (window.electronAPI?.fridayRestore) {
      window.electronAPI.fridayRestore().catch(() => {});
    }
    connect();
  }, [stopWakeListener, connect]);

  // Keep refs in sync with latest functions
  useEffect(() => {
    wakeUpRef.current = wakeUp;
    goSleepRef.current = goSleep;
  }, [wakeUp, goSleep]);

  // ─── Manual Toggle (preserves original button behaviour) ────────────────
  const disconnect = useCallback(() => {
    userDisconnectedRef.current = true; // intentional — suppress auto-reconnect
    reconnectAttemptsRef.current = 0;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    // ── End cache session on disconnect ──
    try {
      window.electronAPI?.cacheEndSession?.(
        'Session ended by user disconnect.',
        []
      );
    } catch (_) {}
    // ── Clear idle timer ──
    if (idleTimerRef.current) { clearTimeout(idleTimerRef.current); idleTimerRef.current = null; }
    stopWakeListener();
    audioStreamerRef.current?.stop();
    liveSessionRef.current?.disconnect();
    isSleepingRef.current = false;
    setIsSleeping(false);
    setState("disconnected");
  }, [stopWakeListener]);

  const toggleConnection = useCallback(() => {
    if (state === "disconnected") {
      // User manually reconnecting — clear intentional-disconnect flag
      userDisconnectedRef.current = false;
      reconnectAttemptsRef.current = 0;
      // If woken manually while sleeping, stop wake listener first
      stopWakeListener();
      isSleepingRef.current = false;
      setIsSleeping(false);
      connect();
    } else {
      disconnect();
    }
  }, [state, connect, disconnect, stopWakeListener]);

  // Cleanup on unmount — use dispose() to fully release all resources
  useEffect(() => {
    return () => {
      userDisconnectedRef.current = true; // prevent reconnect on unmount
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      stopWakeListener();
      audioStreamerRef.current?.dispose();
      liveSessionRef.current?.disconnect();
    };
  }, [stopWakeListener]);

  // Stable callback for real-time playback amplitude (for orb sync)
  const getPlaybackAmplitude = useCallback((): number => {
    return audioStreamerRef.current?.getPlaybackAmplitude() ?? 0;
  }, []);

  // Stable callback to dismiss the map overlay
  const clearMapCommand = useCallback(() => {
    setMapCommand(null);
  }, []);

  // ── Widget management callbacks ──
  const openWidget = useCallback((widget: WidgetData) => {
    setWidgets(prev => {
      // Don't duplicate same ID
      if (prev.find(w => w.id === widget.id)) return prev;
      return [...prev, widget];
    });
  }, []);

  const closeWidget = useCallback((widgetId: string) => {
    setWidgets(prev => prev.filter(w => w.id !== widgetId));
  }, []);

  const closeAllWidgets = useCallback(() => {
    setWidgets([]);
  }, []);

  // ── Proactive event bus (main process → Friday's voice) ──
  // Delivers scheduler/monitor events. Gated entirely on the opt-in setting.
  useProactive({
    enabled: !!settings?.proactiveEnabled,
    isSleeping,
    state,
    sendText: (text: string) => liveSessionRef.current?.sendText(text),
    addToast,
    quietHours: settings?.proactiveQuietHoursEnabled
      ? { start: settings.proactiveQuietStart, end: settings.proactiveQuietEnd }
      : null,
  });

  // ── Push watchdog thresholds to the main process ──
  // The monitor loop is inert until this says otherwise.
  useEffect(() => {
    window.electronAPI?.setMonitorConfig?.({
      enabled: !!settings?.proactiveEnabled && !!settings?.proactiveHealthWatchdog,
    });
  }, [settings?.proactiveEnabled, settings?.proactiveHealthWatchdog]);

  // ── Clipboard history capture ──
  // Off unless explicitly enabled — this records everything the user copies,
  // which can include passwords, so it must never default to on.
  useEffect(() => {
    window.electronAPI?.clipboardSetEnabled?.(!!settings?.clipboardHistoryEnabled);
  }, [settings?.clipboardHistoryEnabled]);

  // ── Idle Suggestion Timer ──
  // Fires once after IDLE_SUGGESTION_DELAY_MS of continuous "listening" silence.
  // Opt-in: requires both the proactive master switch and the suggestions toggle.
  useEffect(() => {
    // Clear any existing timer on state change
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }

    const suggestionsOn = !!settings?.proactiveEnabled && !!settings?.proactiveSuggestions;

    // Only start idle timer when listening (user is silent)
    if (suggestionsOn && state === 'listening' && !idleSuggestionFiredRef.current) {
      idleTimerRef.current = setTimeout(async () => {
        // Re-check state — user might have spoken in the meantime
        if (idleSuggestionFiredRef.current) return;
        idleSuggestionFiredRef.current = true; // only suggest once per session

        // Prefer time-of-day + recent patterns over lifetime totals. Lifetime
        // counts produce useless suggestions ("you use searchWeb a lot");
        // what's actionable is what the user does at THIS time of day.
        let suggestionContext = '';
        try {
          const p = await window.electronAPI?.cacheGetPatterns?.();
          if (p?.success && (p.sampleSize || 0) > 0) {
            const fmt = (list?: [string, number][]) =>
              (list || []).map(([t, c]) => `${t} (${c}x)`).join(', ');
            const parts: string[] = [];
            if (p.bucketTools?.length) parts.push(`What they usually do in the ${p.currentBucket}: ${fmt(p.bucketTools)}.`);
            if (p.recentTools?.length) parts.push(`This past week: ${fmt(p.recentTools)}.`);
            if (!parts.length && p.topTools?.length) parts.push(`All time: ${fmt(p.topTools)}.`);
            suggestionContext = parts.join(' ');
          } else {
            // Fall back to lifetime frequency when there's no timestamped history yet.
            const freq = await window.electronAPI?.cacheGetFrequent?.();
            if (freq?.success) {
              const toolList = (freq.topTools || []).map(([t, c]: [string, number]) => `${t} (${c}x)`).join(', ');
              suggestionContext = `Most used tools: ${toolList || 'none'}.`;
            }
          }
        } catch (_) {}

        const hour = new Date().getHours();
        const timeHint = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night';

        liveSessionRef.current?.sendText(
          `System: The user has been silent for over a minute. Proactively suggest something helpful based on the time of day (${timeHint}) and their usage patterns. ${suggestionContext} Keep it SHORT (1-2 sentences) and conversational — don't be pushy. Examples: offer to play music, check the news, show weather, search for something, or ask if they need anything. Only suggest ONE thing.`
        );
      }, IDLE_SUGGESTION_DELAY_MS);
    }

    // Reset fired flag when user speaks (enters speaking state means model is responding to user input)
    if (state === 'speaking') {
      idleSuggestionFiredRef.current = false;
    }

    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };
  }, [state, settings?.proactiveEnabled, settings?.proactiveSuggestions]);

  return {
    state,
    error,
    user,
    isGameMode,
    isSleeping,
    isGeneratingImage,
    progressTask,
    mapCommand,
    widgets,
    tone,
    login,
    toggleConnection,
    clearMapCommand,
    getPlaybackAmplitude,
    closeWidget,
    // Vision Intelligence
    isVisionActive: vision.isVisionActive,
    visionMode: vision.visionMode,
    visionResult: vision.currentResult,
    visionVideoRef: vision.videoRef,
    visionScreenThumbnail: vision.screenThumbnail,
    visionCursorPosition: vision.cursorPosition,
    visionScreenDimensions: vision.screenDimensions,
    closeVision: vision.closeVision,
  };
}
