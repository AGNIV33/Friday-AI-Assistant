import { useState, useCallback, useRef, useEffect } from "react";
import { AudioStreamer } from "./audio-streamer";
import {
  LiveSession,
  type SessionState,
} from "./live-session";
import { auth, googleProvider, memoryService } from "./firebase";
import { signInWithPopup, onAuthStateChanged, User } from "firebase/auth";
import type { Settings } from "./useSettings";
import type { MapCommand } from "../components/MapView";
import type { WidgetData } from "../components/WidgetManager";
import { perf } from "./perf";

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
      wifiControl: (action: string, networkName?: string, password?: string) => Promise<{ success: boolean; result?: string; message?: string; error?: string }>;
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
      // Widgets
      fetchNews: () => Promise<{ success: boolean; articles?: any[]; error?: string }>;
      searchYoutubeEmbed: (query: string) => Promise<{ success: boolean; videoId?: string; embedUrl?: string; error?: string }>;
    };
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

// Tracks when playMedia last opened a URL to prevent duplicate openWebsite calls
let lastMediaOpenTime = 0;

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
      await signInWithPopup(auth, googleProvider);
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
      liveSessionRef.current = new LiveSession(apiKey);

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
          // ── Log tool call to local cache ──
          try {
            window.electronAPI?.cacheSaveTurn?.('tool', '', name, args, null);
          } catch (_) {}
          perf.start(`tool:${name}`);
          try {
            if (name === "goToSleep") {
              // Friday has already spoken her goodbye — now we disconnect after a short pause
              setTimeout(() => {
                goSleepRef.current();
              }, 1200);
              return { success: true, message: "Going to sleep. Wake listener will be activated." };
            }

            if (name === "renderMap") {
              const cmd: MapCommand = {
                action: 'RENDER_MAP',
                speech_confirmation: `Displaying the map of ${args.target}.`,
                telemetry: {
                  target: args.target,
                  coordinates: [args.longitude, args.latitude],
                  zoom_level: args.zoom_level || 12,
                  pitch: 50,
                  bearing: -15,
                },
                render_settings: {
                  animation_mode: args.animation_mode || 'globe_glide',
                  theme: 'tactical_blue_hologram',
                },
              };
              setMapCommand(cmd);
              addToast?.(`Geospatial Module: Displaying ${args.target}`, "info");
              return { success: true, message: `Map of ${args.target} is now being rendered on screen. The user can see an interactive holographic map.` };
            }

            if (name === "closeMap") {
              setMapCommand(null);
              addToast?.(`Geospatial Module: Map dismissed.`, "info");
              return { success: true, message: "The map has been closed and the main UI is restored." };
            }

            // ── Widget Tools ──
            if (name === "openWidget") {
              const wType = (args.widgetType || 'custom') as 'music' | 'news' | 'image' | 'youtube' | 'custom';
              const wId = `widget-${wType}-${Date.now()}`;
              const widgetData: any = {};

              if (wType === 'music' || wType === 'youtube') {
                widgetData.query = args.query || '';
              } else if (wType === 'image') {
                widgetData.src = args.query || '';
                widgetData.caption = args.caption || '';
              } else if (wType === 'custom') {
                widgetData.content = args.content || args.query || '';
              }

              const widget = {
                id: wId,
                type: wType,
                title: args.title || wType.charAt(0).toUpperCase() + wType.slice(1),
                data: widgetData,
              };

              openWidget(widget);
              addToast?.(`Widget opened: ${widget.title}`, "info");
              return { success: true, message: `${widget.title} widget is now displayed on screen. The user can drag it anywhere and close it when done.` };
            }

            if (name === "closeWidget") {
              const searchTitle = (args.widgetTitle || '').toLowerCase();
              setWidgets(prev => {
                const match = prev.find(w =>
                  w.title.toLowerCase().includes(searchTitle) ||
                  w.type.toLowerCase().includes(searchTitle)
                );
                if (match) {
                  addToast?.(`Widget closed: ${match.title}`, "info");
                  return prev.filter(w => w.id !== match.id);
                }
                return prev;
              });
              return { success: true, message: `Widget matching "${args.widgetTitle}" has been closed.` };
            }

            if (name === "closeAllWidgets") {
              closeAllWidgets();
              addToast?.("All widgets closed.", "info");
              return { success: true, message: "All widgets have been closed." };
            }

            if (name === "openWebsite") {
              // ── Duplicate-tab guard ──
              // If playMedia recently opened a YouTube/Spotify URL, skip this openWebsite call
              const urlLower = (args.url || "").toLowerCase();
              if (urlLower.includes("youtube.com") || urlLower.includes("youtu.be") || urlLower.includes("spotify.com")) {
                const now = Date.now();
                if (now - lastMediaOpenTime < 15000) {
                  console.log("[Friday] Blocked duplicate openWebsite for media URL (playMedia already handled it)");
                  return { success: true, message: "Already opened by playMedia — skipping duplicate." };
                }
              }

              if (window.electronAPI) {
                const res = await window.electronAPI.openInChrome(args.url);
                return res.success ? { success: true, message: `Opened ${args.url} in Google Chrome` } : { error: res.error };
              } else {
                window.open(args.url, "_blank");
                return { success: true, message: `Opened ${args.url}` };
              }
            }
            if (name === "saveFact") {
              await memoryService.saveFact(uid, args.fact);
              return { success: true, message: "Fact saved to memory." };
            }
            if (name === "saveSessionSummary") {
              await memoryService.saveSummary(uid, args.summary);
              return { success: true, message: "Session summary saved." };
            }

            // Electron System Tools
            if (window.electronAPI) {
              if (name === "openApp") {
                const res = await window.electronAPI.openApp(args.appName);
                return res.success ? { success: true } : { error: res.error };
              }
              if (name === "closeApp") {
                const res = await window.electronAPI.closeApp(args.appName);
                return res.success ? { success: true } : { error: res.error };
              }
              if (name === "openFile") {
                const res = await window.electronAPI.openFile(args.filePath);
                return res.success ? { success: true } : { error: res.error };
              }
              if (name === "createFolder") {
                const res = await window.electronAPI.createFolder(args.folderName, args.folderPath);
                return res.success ? { success: true, path: res.path } : { error: res.error };
              }
              if (name === "closeChromeTab") {
                const res = await window.electronAPI.closeChromeTab();
                return res.success ? { success: true } : { error: res.error };
              }
              if (name === "setGameMode") {
                setIsGameMode(args.enabled);
                if (args.enabled) {
                  return {
                    success: true,
                    message: `Game mode activated successfully. SYSTEM OVERRIDE: You are now operating at FULL POTENTIAL. Drop your standard tone. Be hyper-focused, tactical, intense, and use hardcore gamer terminology. You are now the ultimate gaming assistant. Check the user's installed games if they haven't explicitly started one yet.`
                  };
                } else {
                  return {
                    success: true,
                    message: "Game mode deactivated. Return to your normal flirtatious, witty, relaxed Friday persona."
                  };
                }
              }
              if (name === "getSystemInfo") {
                const res = await window.electronAPI.getSystemInfo();
                if (res.success) {
                  return {
                    success: true,
                    cpu_model: res.cpu?.model,
                    cpu_cores: res.cpu?.cores,
                    cpu_usage_percent: res.cpu?.usagePercent,
                    ram_total_gb: res.ram?.totalGB,
                    ram_used_gb: res.ram?.usedGB,
                    ram_free_gb: res.ram?.freeGB,
                    ram_usage_percent: res.ram?.usagePercent,
                    gpu_name: res.gpu?.name,
                    current_date: res.dateTime?.date,
                    current_time: res.dateTime?.time,
                    timezone: res.dateTime?.timezone,
                    platform: res.platform,
                    hostname: res.hostname,
                    arch: res.arch,
                  };
                }
                return { error: res.error || "Failed to get system info." };
              }
              if (name === "checkInstalledGames") {
                const res = await window.electronAPI.getInstalledApps();
                if (res.success && res.games) {
                  return {
                    success: true,
                    totalFound: res.games.length,
                    breakdown: res.breakdown,
                    games: res.games.slice(0, 100) // return up to 100 for context limit
                  };
                }
                return { error: res.error || "Failed to check games." };
              }
              if (name === "checkSocialMedia") {
                const res = await window.electronAPI.checkSocial(args.platform);
                return res.success ? { success: true, message: `Opened ${args.platform} status feed.` } : { error: res.error };
              }
              if (name === "playMedia") {
                const res = await window.electronAPI.playMedia(args.platform, args.query);
                if (res.success) {
                  lastMediaOpenTime = Date.now(); // Mark timestamp to block duplicate openWebsite calls
                }
                return res.success ? { success: true, message: `Automated playback for ${args.query} on ${args.platform}.` } : { error: res.error };
              }
              if (name === "generateImage") {
                setIsGeneratingImage(true);
                setProgressTask({ active: true, label: 'Generating image…', type: 'generate' });
                try {
                  const res = await window.electronAPI.generateImage(args.prompt);
                  setIsGeneratingImage(false);
                  setProgressTask(null);
                  if (res.success) {
                    return { success: true, message: `Image generated successfully and opened in the Photos app. The image is currently showing on screen. Now ask the user what they'd like to name it and where to save it.` };
                  }
                  return { error: res.error || "Image generation failed." };
                } catch (err: any) {
                  setIsGeneratingImage(false);
                  setProgressTask(null);
                  return { error: err.message || "Image generation failed." };
                }
              }
              if (name === "saveGeneratedImage") {
                const res = await window.electronAPI.saveGeneratedImage(args.fileName, args.savePath || "");
                if (res.success) {
                  return { success: true, message: `Image saved successfully to: ${res.savedPath}` };
                }
                return { error: res.error || "Failed to save image." };
              }
              if (name === "initWhatsApp") {
                const res = await window.electronAPI.whatsappInit();
                if (res.success) {
                  if (res.status === 'connected') {
                    addToast?.("WhatsApp connected successfully", "success");
                  }
                  return { success: true, status: res.status, message: res.message || 'WhatsApp initializing. If a QR code appeared in the terminal, tell the user to scan it with WhatsApp.' };
                }
                return { error: res.error || 'Failed to initialize WhatsApp.' };
              }
              if (name === "sendWhatsApp") {
                // First check if WhatsApp is connected
                const statusRes = await window.electronAPI.whatsappStatus();
                if (statusRes.status !== 'connected') {
                  return { error: 'WhatsApp is not connected. Please call initWhatsApp first and ask the user to scan the QR code in the terminal.' };
                }
                const res = await window.electronAPI.whatsappSend(args.contactNameOrNumber, args.message);
                if (res.success) {
                  return { success: true, message: res.message };
                }
                return { error: res.error, suggestions: res.suggestions };
              }
              if (name === "logoutWhatsApp") {
                const res = await window.electronAPI.whatsappLogout();
                if (res.success) {
                  addToast?.("WhatsApp disconnected", "info");
                  return { success: true, message: res.message };
                }
                return { error: res.error || 'Failed to logout from WhatsApp.' };
              }
              if (name === "setVolume") {
                const res = await window.electronAPI.systemVolume(args.action, args.level);
                if (res.success) {
                  return { success: true, result: res.result };
                }
                return { error: res.error || 'Failed to control volume.' };
              }
              if (name === "setBrightness") {
                const res = await window.electronAPI.systemBrightness(args.action, args.level);
                if (res.success) {
                  return { success: true, result: res.result };
                }
                return { error: res.error || 'Failed to control brightness.' };
              }
              if (name === "openSettings") {
                const res = await window.electronAPI.openSettings(args.page);
                if (res.success) {
                  return { success: true, message: res.message };
                }
                return { error: res.error || 'Failed to open settings.' };
              }
              if (name === "bluetoothControl") {
                const res = await window.electronAPI.bluetoothControl(args.action, args.deviceName);
                if (res.success) {
                  return { success: true, result: res.result, message: res.message };
                }
                return { error: res.error || 'Failed to control Bluetooth.' };
              }
              if (name === "wifiControl") {
                const res = await window.electronAPI.wifiControl(args.action, args.networkName, args.password);
                if (res.success) {
                  return { success: true, result: res.result, message: res.message };
                }
                return { error: res.error || 'Failed to control WiFi.' };
              }
              if (name === "positionWindow") {
                const res = await window.electronAPI.positionWindow(args.appName, args.position || 'fullscreen');
                if (res.success) {
                  return { success: true, message: res.message };
                }
                return { error: res.error || 'Failed to position window.' };
              }
              if (name === "writeDocument") {
                const appLabel = args.target === 'word' ? 'Microsoft Word' : 'Notepad';
                setProgressTask({ active: true, label: `Writing to ${appLabel}…`, type: 'write' });
                const res = await window.electronAPI.writeDocument(args.target, args.content, args.title);
                setProgressTask(null);
                if (res.success) {
                  return { success: true, message: res.message };
                }
                return { error: res.error || 'Failed to write document.' };
              }
              if (name === "formatWord") {
                const res = await window.electronAPI.formatWord(args.action, args.value);
                if (res.success) {
                  return { success: true, result: res.result };
                }
                return { error: res.error || 'Failed to format Word document.' };
              }
              if (name === "searchFiles") {
                // ── Non-blocking: return immediately, inject results when done ──
                const query = args.query || '';
                setProgressTask({ active: true, label: `Scanning system for "${query}"…`, type: 'search' });
                // Fire search in background — do NOT await here
                window.electronAPI.searchFiles(query, args.searchIn, args.type).then((res: any) => {
                  setProgressTask(null);
                  let followUp = '';
                  if (res.success && res.results?.length > 0) {
                    const summary = res.results.slice(0, 10).map((r: any, i: number) =>
                      `${i + 1}. ${r.Name} (${r.IsDir ? 'Folder' : 'File'}) — ${r.Path}`
                    ).join('\n');
                    followUp = `[BACKGROUND SEARCH COMPLETE] File search for "${query}" finished. Found ${res.results.length} result(s):\n${summary}\nRead the results naturally to the user and offer to open the best match.`;
                  } else {
                    followUp = `[BACKGROUND SEARCH COMPLETE] File search for "${query}" finished. No matching files or folders were found. Inform the user politely.`;
                  }
                  liveSessionRef.current?.sendText(followUp);
                }).catch(() => {
                  setProgressTask(null);
                  liveSessionRef.current?.sendText(`[BACKGROUND SEARCH COMPLETE] The file search for "${query}" encountered an error. Inform the user.`);
                });
                // Return immediately so the model can speak right away
                return {
                  success: true,
                  status: 'searching_in_background',
                  message: `File search started in the background for "${query}". This may take up to a minute. Immediately tell the user something like: "I'm on it boss! I've started scanning your entire system for ${query}. I'll report back the moment I find something — in the meantime, what else can I help you with?" Then listen for their next command.`
                };
              }
              if (name === "searchImages") {
                const q = args.query || '';
                setProgressTask({ active: true, label: `Fetching "${q}" images…`, type: 'search' });
                const res = await window.electronAPI.searchImages(q, args.count);
                setProgressTask(null);
                if (res.success) {
                  return { success: true, message: res.message, totalImages: res.totalImages };
                }
                return { error: res.error || 'Image search failed.' };
              }
              if (name === "browseImage") {
                const res = await window.electronAPI.browseImage(args.direction);
                if (res.success) {
                  return { success: true, message: res.message };
                }
                return { error: res.error || 'Failed to browse images.' };
              }
              if (name === "saveBrowsedImage") {
                const res = await window.electronAPI.saveBrowsedImage(args.fileName, args.savePath);
                if (res.success) {
                  return { success: true, message: res.message, savedPath: res.savedPath };
                }
                return { error: res.error || 'Failed to save image.' };
              }
              if (name === "openDocument") {
                setProgressTask({ active: true, label: `Finding "${args.name}"…`, type: 'search' });
                const res = await window.electronAPI.openDocument(args.name, args.searchIn);
                setProgressTask(null);
                if (res.success) return { success: true, message: res.message };
                return { error: res.error || 'Could not find document.' };
              }
              if (name === "deleteFile") {
                setProgressTask({ active: true, label: `Deleting file…`, type: 'general' });
                const res = await window.electronAPI.deleteFile(args.filePath, args.permanently);
                setProgressTask(null);
                if (res.success) return { success: true, message: res.message };
                return { error: res.error || 'Failed to delete file.' };
              }
              if (name === "emptyRecycleBin") {
                setProgressTask({ active: true, label: `Emptying Recycle Bin…`, type: 'general' });
                const res = await window.electronAPI.emptyRecycleBin();
                setProgressTask(null);
                if (res.success) return { success: true, message: res.message };
                return { error: res.error || 'Failed to empty recycle bin.' };
              }
              if (name === "playEpisode") {
                setProgressTask({ active: true, label: `Searching for S${args.season}E${args.episode}…`, type: 'search' });
                const res = await window.electronAPI.findAndPlayEpisode(args.folderPath, args.season, args.episode, args.player);
                setProgressTask(null);
                if (res.success) return { success: true, message: res.message };
                return { error: res.error || 'Failed to find/play episode.' };
              }
              if (name === "listFolderContents") {
                setProgressTask({ active: true, label: `Listing folder…`, type: 'search' });
                const res = await window.electronAPI.listFolderContents(args.folderPath, args.sortBy);
                setProgressTask(null);
                if (res.success) {
                  // Summarize if it's too long
                  const items = res.items || [];
                  const summary = items.slice(0, 50).map((i: any) => 
                    `- ${i.Name} (${i.IsDir ? 'Folder' : i.Ext || 'File'})`
                  ).join('\n');
                  return { success: true, message: res.message, items: summary };
                }
                return { error: res.error || 'Failed to list folder.' };
              }
              if (name === "moveFile") {
                setProgressTask({ active: true, label: `Moving file…`, type: 'general' });
                const res = await window.electronAPI.moveFile(args.sourcePath, args.destPath);
                setProgressTask(null);
                if (res.success) return { success: true, message: res.message };
                return { error: res.error || 'Failed to move file.' };
              }
              if (name === "organizeFolder") {
                const planCount = args.plan?.length || 0;
                setProgressTask({ active: true, label: `Organizing ${planCount} files…`, type: 'general' });
                const res = await window.electronAPI.organizeFolder(args.folderPath, args.plan);
                setProgressTask(null);
                if (res.success) {
                  return {
                    success: true,
                    message: res.message,
                    totalMoved: res.totalMoved,
                    totalFailed: res.totalFailed,
                    results: res.results,
                  };
                }
                return { error: res.error || 'Failed to organize folder.' };
              }
            } else if (["openApp", "closeApp", "openFile", "createFolder", "closeChromeTab", "getSystemInfo", "checkInstalledGames", "checkSocialMedia", "playMedia", "generateImage", "saveGeneratedImage", "initWhatsApp", "sendWhatsApp", "logoutWhatsApp", "setVolume", "setBrightness", "openSettings", "bluetoothControl", "wifiControl", "positionWindow", "writeDocument", "formatWord", "searchFiles", "searchImages", "browseImage", "saveBrowsedImage", "openDocument", "deleteFile", "emptyRecycleBin", "playEpisode", "listFolderContents", "moveFile", "organizeFolder"].includes(name)) {
              return { error: "System tools are only available in the desktop application." };
            }

            // Web Search & Weather
            if (name === "searchWeb") {
              if (window.electronAPI) {
                setProgressTask({ active: true, label: `Searching web for "${args.query}"…`, type: 'web' });
                const res = await window.electronAPI.searchGoogle(args.query);
                setProgressTask(null);
                if (res.success && res.data) {
                  return { success: true, searchResultText: res.data };
                }
                return { error: res.error || "Search failed" };
              } else {
                const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(args.query)}`;
                window.open(searchUrl, "_blank");
                return { success: true, message: `Searching for ${args.query}` };
              }
            }
            if (name === "getWeather") {
              const weatherRes = await fetch(`https://wttr.in/${encodeURIComponent(args.location)}?format=j1`);
              const weatherData = await weatherRes.json();
              const current = weatherData.current_condition[0];
              return {
                success: true,
                temp: `${current.temp_C}°C`,
                condition: current.weatherDesc[0].value,
                humidity: `${current.humidity}%`
              };
            }

          } catch (err) {
            console.error(`Tool ${name} failed:`, err);
            perf.end(`tool:${name}`, { status: 'error' });
            return { error: "Failed to execute tool." };
          }
          perf.end(`tool:${name}`, { status: 'not_found' });
          return { error: "Tool not found" };
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

  // ── Idle Suggestion Timer ──
  // Resets on every state change to "listening" or "speaking". Fires once after
  // IDLE_SUGGESTION_DELAY_MS of continuous "listening" silence.
  useEffect(() => {
    // Clear any existing timer on state change
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }

    // Only start idle timer when listening (user is silent)
    if (state === 'listening' && !idleSuggestionFiredRef.current) {
      idleTimerRef.current = setTimeout(async () => {
        // Re-check state — user might have spoken in the meantime
        if (idleSuggestionFiredRef.current) return;
        idleSuggestionFiredRef.current = true; // only suggest once per session

        // Build suggestion context from cache frequency data
        let suggestionContext = '';
        try {
          if (window.electronAPI?.cacheGetFrequent) {
            const freq = await window.electronAPI.cacheGetFrequent();
            if (freq.success) {
              const toolList = (freq.topTools || []).map(([t, c]: [string, number]) => `${t} (${c}x)`).join(', ');
              const topicList = (freq.topTopics || []).map(([t, c]: [string, number]) => `${t} (${c}x)`).join(', ');
              suggestionContext = `Most used tools: ${toolList || 'none'}. Frequent topics: ${topicList || 'none'}.`;
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
  }, [state]);

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
    login,
    toggleConnection,
    connect,
    disconnect,
    clearMapCommand,
    getPlaybackAmplitude,
    openWidget,
    closeWidget,
    closeAllWidgets,
  };
}
