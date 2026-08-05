import { useEffect, useRef } from "react";
import type { SessionState } from "./live-session";

export interface ProactiveEvent {
  kind: string;
  priority: 'critical' | 'normal' | 'low';
  text: string;
  data?: any;
  at: string;
}

export interface ProactiveOptions {
  /** Master switch. When false the hook subscribes to nothing. */
  enabled: boolean;
  /** Suppress everything while Friday is asleep. */
  isSleeping: boolean;
  /** Current live-session state — used to avoid interrupting. */
  state: SessionState;
  /** Injects a turn into the live session (makes Friday speak). */
  sendText: (text: string) => void;
  /** Low-priority events surface here instead of being spoken. */
  addToast?: (msg: string, type: 'success' | 'error' | 'info' | 'warning', duration?: number) => void;
  /** "HH:MM" 24h strings. While inside this window nothing is spoken. */
  quietHours?: { start: string; end: string } | null;
}

/** Same `kind` won't be announced twice inside this window. */
const DEDUPE_WINDOW_MS = 10 * 60 * 1000;
/** Floor between any two spoken events, regardless of kind. */
const MIN_GAP_MS = 60 * 1000;

function isWithinQuietHours(quiet: { start: string; end: string } | null | undefined): boolean {
  if (!quiet?.start || !quiet?.end) return false;
  const [sh, sm] = quiet.start.split(':').map(Number);
  const [eh, em] = quiet.end.split(':').map(Number);
  if ([sh, sm, eh, em].some(n => Number.isNaN(n))) return false;

  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const start = sh * 60 + sm;
  const end = eh * 60 + em;

  // Handles windows that wrap midnight (e.g. 22:00 → 07:00)
  return start <= end ? mins >= start && mins < end : mins >= start || mins < end;
}

/**
 * Bridges main-process events into Friday's voice.
 *
 * The hard rule is: never talk over the user. Anything arriving while Friday is
 * mid-turn is queued and drained once the session goes idle, rather than being
 * injected immediately (which would cut her off mid-sentence).
 */
export function useProactive(options: ProactiveOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const queueRef = useRef<ProactiveEvent[]>([]);
  const lastAnnouncedAtRef = useRef<Record<string, number>>({});
  const lastSpokeAtRef = useRef(0);

  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Deliver anything queued, when it's safe to speak.
  const drain = useRef(() => {
    const opts = optionsRef.current;
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (!opts.enabled || opts.isSleeping) return;
    if (!queueRef.current.length) return;
    // 'listening' means connected and idle — the only safe moment to speak up.
    if (opts.state !== 'listening') return;
    if (isWithinQuietHours(opts.quietHours)) return;

    const waited = Date.now() - lastSpokeAtRef.current;
    if (waited < MIN_GAP_MS) {
      // Too soon since the last announcement — try again when the gap elapses,
      // otherwise a queued event could sit forever waiting on a state change
      // that never comes.
      retryTimerRef.current = setTimeout(() => drain.current(), MIN_GAP_MS - waited);
      return;
    }

    const next = queueRef.current.shift();
    if (!next) return;

    lastSpokeAtRef.current = Date.now();
    opts.sendText(next.text);

    // More waiting? Come back for it rather than stalling the backlog.
    if (queueRef.current.length) {
      retryTimerRef.current = setTimeout(() => drain.current(), MIN_GAP_MS);
    }
  });

  // Re-attempt drain whenever the session goes idle.
  useEffect(() => {
    if (options.state === 'listening') {
      const t = setTimeout(() => drain.current(), 800);
      return () => clearTimeout(t);
    }
  }, [options.state]);

  // Clean up any pending retry on unmount.
  useEffect(() => () => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
  }, []);

  useEffect(() => {
    if (!options.enabled) return;
    const api = window.electronAPI;
    if (!api?.onProactiveEvent) return;

    const unsubscribe = api.onProactiveEvent((event: ProactiveEvent) => {
      const opts = optionsRef.current;
      if (!opts.enabled || opts.isSleeping) return;

      // De-dupe: don't re-announce the same kind of thing repeatedly.
      const now = Date.now();
      const last = lastAnnouncedAtRef.current[event.kind] || 0;
      if (now - last < DEDUPE_WINDOW_MS) return;
      lastAnnouncedAtRef.current[event.kind] = now;

      if (isWithinQuietHours(opts.quietHours) && event.priority !== 'critical') return;

      // Low priority never interrupts with voice — it's a toast.
      if (event.priority === 'low') {
        opts.addToast?.(event.data?.label || 'Friday has an update', 'info');
        return;
      }

      if (event.priority === 'critical') {
        lastSpokeAtRef.current = now;
        opts.sendText(event.text);
        return;
      }

      queueRef.current.push(event);
      // Cap the queue — if 20 things piled up while the user was talking,
      // announcing all of them later would be worse than dropping the oldest.
      if (queueRef.current.length > 5) queueRef.current.shift();
      drain.current();
    });

    return unsubscribe;
  }, [options.enabled]);
}
