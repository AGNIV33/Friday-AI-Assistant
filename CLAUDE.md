# CLAUDE.md — Friday AI Assistant

Guidance for AI agents working in this repo. Read this before making changes.

---

## 1. What this project is

A **voice-to-voice AI desktop assistant** for Windows, inspired by Iron Man's Friday. The user talks; Gemini Live decides which tool to call; the tool does real work on the machine (open apps, control volume, search files, send WhatsApp); the result goes back to the model, which speaks the answer.

**Stack:** Electron + React 19 + TypeScript + Vite + Tailwind v4 · Gemini Live API (voice) · NVIDIA NIM (vision + image gen) · Firebase (auth + cloud memory) · Mapbox GL.

**Scale:** ~16,000 lines. 74 voice tools. 72 IPC channels.

> ⚠️ **This project is never committed or pushed.** The owner keeps it local. Do not run `git commit`, `git push`, or create branches. Read-only git (`git status`, `git diff`) is fine.

---

## 2. Two-process architecture

Electron splits into two processes. Getting this boundary wrong is the #1 source of bugs here.

| | **Main process** (`electron/`) | **Renderer** (`src/`) |
|---|---|---|
| Runs | Node.js | Chromium (browser) |
| Can do | filesystem, spawn PowerShell, native OS | React UI, Web Audio, WebSockets |
| Cannot | touch the DOM | touch the filesystem directly |
| Language | CommonJS `.cjs` | ESM TypeScript |

They talk **only** through IPC, bridged by `electron/preload.cjs`. `nodeIntegration: false` and `contextIsolation: true` — the renderer can never reach Node directly, and that is deliberate. Everything the renderer is allowed to do must be explicitly exposed on `window.electronAPI`.

### Two IPC directions

**A. Request/response (renderer → main).** The default. 58 channels.
```
renderer: window.electronAPI.systemVolume('set', 40)
  → preload: ipcRenderer.invoke('system-volume', { action, level })
    → main: ipcMain.handle('system-volume', async (e, { action, level }) => ...)
```

**B. Push (main → renderer).** Exactly one channel: `friday:proactive`. This is how the main process makes Friday speak on her own (reminders, health warnings). See §7.

---

## 3. Folder structure

```
electron/                    MAIN PROCESS
  main.cjs                   entry: env, single-instance lock, cache guard,
                             GPU flags, module wiring, app lifecycle (~160 lines)
  window.cjs                 BrowserWindow creation, minimize/restore, window positioning
  preload.cjs                THE BRIDGE — every renderer-reachable channel is listed here
  proactive.cjs              main→renderer push bus (emitProactive)
  monitors.cjs               background health polling with hysteresis
  ipc/
    apps.cjs                 open/close apps, installed-app + game scanners, system info
    files.cjs                search, open, delete, move, organize, episodes
    media.cjs                image gen/search, YouTube, news, Spotify, Google search
    documents.cjs            Notepad + Word automation
    system-controls.cjs      volume, brightness, bluetooth, wifi, settings pages
    whatsapp.cjs             whatsapp-web.js integration (lazy-loaded)
    vision.cjs               screen capture, cursor position, vision API relay
    memory-cache.cjs         local conversation history + pattern mining
    scheduler.cjs            persisted reminders/alarms
    clipboard.cjs            clipboard history (opt-in, polled)
    notes.cjs                personal notes + keyword search
    routines.cjs             saved multi-step tool sequences
    documents-read.cjs       text extraction for summarization (Word COM for PDF/DOCX)

src/                         RENDERER
  app/                       composition root — App.tsx, main.tsx, index.css
  features/
    assistant/               THE CORE
      useFriday.ts           orchestration hook: session, auth, wake word, reconnect
      useProactive.ts        receives main→renderer events, decides when to speak
      live-session.ts        Gemini Live wrapper + THE SYSTEM PROMPT
      audio-streamer.ts      mic capture + playback (AudioWorklet)
      perf.ts                timing instrumentation
      tools/                 tool DECLARATIONS (schemas the model sees)
      handlers/              tool IMPLEMENTATIONS (what actually runs)
    vision/                  camera/screen analysis + HUD overlay
    orb/                     the animated orb avatar (canvas renderers)
    widgets/                 floating draggable panels
      items/                 individual widget components
    settings/                settings panel
      tabs/                  one file per tab
    map/                     Mapbox holographic map
    app-launcher/            app browser grid
  shared/                    Toast, ProgressBar, useToast
  services/firebase.ts       auth + cloud memory

public/                      AudioWorklet processors (loaded by URL — do NOT move)
scripts/                     standalone dev scripts (not part of the build)
```

**Import convention:** `@/` maps to `src/`. Use `@/features/...` across features; relative (`./`, `../`) within a feature.

---

## 4. The tool-call pipeline — read this before adding features

This is the single most important flow in the codebase.

```
1. tools/*.ts            declare the schema (name, description, params)
2. tools/index.ts        barrel export
3. live-session.ts       (a) import  (b) add to functionDeclarations[]  (c) add prose to system prompt
4. [Gemini decides to call it]
5. live-session.ts       onToolCall(name, args)
6. handlers/index.ts     dispatchToolCall() → registry lookup
7. handlers/*.ts         the actual implementation
8. preload.cjs           bridge (only if it needs the OS)
9. electron/ipc/*.cjs    ipcMain.handle (only if it needs the OS)
```

### Adding a new tool — exact checklist

**Pure UI tool** (React state only, no OS access) — 4 edits:
1. `src/features/assistant/tools/<domain>-tools.ts` — export a `FunctionDeclaration`
2. `src/features/assistant/live-session.ts` — import it + add to the `functionDeclarations` array
3. `src/features/assistant/live-session.ts` — **add a `- toolName: ...` line to the system prompt's TOOLS section.** Not optional. The model leans on that prose more than the schema; tools missing from it get called unreliably.
4. `src/features/assistant/handlers/<domain>-handlers.ts` — add the handler

**OS-touching tool** — the above plus 3:
5. `src/features/assistant/useFriday.ts` — add the method signature to `Window.electronAPI` (the `declare global` block)
6. `electron/preload.cjs` — add the bridge line
7. `electron/ipc/<module>.cjs` — add `ipcMain.handle(...)`, and mark the handler `requiresElectron: true`

New tool category ⇒ also add one line to `tools/index.ts` and `handlers/index.ts`.
New IPC module ⇒ also `require()` it in `electron/main.cjs`.

### Handler contract

```ts
export const myHandlers: ToolRegistry = {
  myTool: {
    requiresElectron: true,   // dispatcher rejects in browser mode + derives the guard list
    handler: async ({ args, electronAPI, addToast, setProgressTask, sendText }) => {
      const res = await electronAPI!.myThing(args.foo);
      return res.success
        ? { success: true, message: "..." }
        : { error: res.error };
    },
  },
};
```

**Return shape (convention, not enforced):**
- Success → `{ success: true }` or `{ success: true, message: "..." }`
- Failure → `{ error: "..." }`
- `message` is **free-form English that steers the model** — it's not shown to the user, it's read *by* the model to decide what to say. Use it to give instructions ("Read these results naturally and offer to open the best match").

**Never** dump huge payloads into the result — it blows the context window. Existing handlers slice (100 games, 50 folder items, 10 search results).

### Available in handler context
`args`, `electronAPI`, `uid`, `sendText`, `addToast`, `setProgressTask`, `setMapCommand`, `setIsGameMode`, `setIsGeneratingImage`, `setWidgets`, `openWidget`, `closeAllWidgets`, `vision`, `goSleep`.

Everything is ref-backed. **Do not capture anything from `useFriday`'s scope directly** — see §9.

---

## 5. Long-running work: the deferred-result pattern

If a tool takes more than ~2 seconds, do **not** block. Return immediately and inject the result later, so Friday can keep talking:

```ts
handler: ({ args, electronAPI, setProgressTask, sendText }) => {
  setProgressTask({ active: true, label: 'Scanning…', type: 'search' });
  electronAPI!.searchFiles(args.query).then(res => {
    setProgressTask(null);
    sendText(`[BACKGROUND SEARCH COMPLETE] Found ${res.results.length}… Read these to the user.`);
  });
  return { success: true, status: 'searching_in_background',
           message: 'Tell the user you\'ve started scanning and will report back.' };
}
```
`sendText` injects a synthetic user turn. `searchFiles` is the reference implementation.

---

## 6. Two separate memory systems — do not conflate

| | **Firestore (cloud)** | **Local disk cache** |
|---|---|---|
| Where | `users/{uid}/memory/main`, `users/{uid}/summaries` | `.friday-data/cache/` |
| Holds | facts about the user, custom instructions, summaries | per-session tool-call history |
| Written by | `saveFact`, `saveSessionSummary` tools; Memory settings tab | automatically on every tool call |
| Code | `src/services/firebase.ts` (`memoryService`) | `electron/ipc/memory-cache.cjs` |

**Firestore rules constraints** (`firestore.rules`): catch-all deny — any new collection needs its own `match` block, and subcollections do **not** inherit from the parent. `facts` is capped at 100 entries; `summary` at 5000 chars.

**Local data layout** — all of `.friday-data/` is gitignored and never leaves the machine:
```
.friday-data/
  cache/index.json          { sessions[], frequency{}, topics{} }
  cache/sessions/<id>.json  { turns[] with per-turn timestamps, toolName, toolArgs }
  scheduler.json            { jobs[] }        reminders/alarms
  clipboard-history.json    { entries[] }     opt-in
  notes.json                { notes[] }
  routines.json             { routines[] }
```

There is also a **third** memory store: `users/{uid}/people` in Firestore holds structured
records about people in the user's life (name, relationship, details). Use `rememberPerson`
for anything about a specific human — `saveFact` is a flat string list that can't be queried
by name and is capped at 100 entries.
`cache-get-patterns` mines the per-turn timestamps for time-of-day and recency-weighted usage. `cache-get-frequent` returns lifetime totals only (kept for fallback).

---

## 7. The proactive system (Friday speaking unprompted)

```
main process event (scheduler / monitor)
  → emitProactive({ kind, priority, text })      electron/proactive.cjs
    → webContents.send('friday:proactive')
      → preload onProactiveEvent subscription
        → useProactive.ts  ← ALL GATING HAPPENS HERE
          → sendText(...)  → Friday speaks
```

**Rules enforced in `useProactive.ts` — preserve these:**
- **Never interrupt.** Events arriving mid-turn are queued and drained only when `state === 'listening'`.
- Suppressed entirely when asleep, when the master toggle is off, or during quiet hours.
- De-duped per `kind` (10 min) and rate-limited to one announcement per minute.
- Priority: `critical` speaks immediately · `normal` queues · `low` becomes a toast.

**Everything proactive is opt-in and defaults to `false`.** The main-process monitor loop stays inert until the renderer pushes `setMonitorConfig({ enabled: true })`.

`text` is an **instruction to the model**, not literal speech — prefix with `[SYSTEM EVENT]` or `[REMINDER]`.

---

## 8. Adding other things

**A widget:** extend the union in `WidgetManager.tsx`, add to `DEFAULT_SIZES`, add a render branch, create the component in `widgets/items/`. To command an already-open widget, dispatch a `window` CustomEvent (see `controlNewsWidget` → `friday-news-control`) — note that pattern is un-addressed and broadcasts to every listener.

**A setting:** add the field to the `Settings` interface **and** `DEFAULT_SETTINGS` in `useSettings.ts`. Persistence is localStorage spread over defaults, so additive fields need no migration. Default anything privacy-touching to `false`.

**A settings tab:** widen the `Tab` union, add to the `tabs` array, add a render branch in `SettingsPanel.tsx`, create the file in `settings/tabs/`. Reuse `SettingsUI.tsx` primitives (`SectionTitle`, `GlassCard`, `Toggle`, `AccentButton`, `containerVariants`, `itemVariants`).

**Windows automation** is done by base64-encoding a PowerShell script and running it via `-EncodedCommand` (dodges shell escaping). See `system-controls.cjs`. Always set a `timeout`.

---

## 9. Traps that will bite you

1. **`connect` is `useCallback(…, [])`.** It closes over everything. The established fix is refs (`visionRef`, `settingsRef`, `voiceIdRef`, `goSleepRef`). New dependencies **must** be ref-backed or they go stale silently.

2. **`__dirname` depth.** `electron/ipc/*.cjs` is one level deeper than `electron/*.cjs`. Project-root paths are `'..','..'` from `ipc/`, `'..'` from `electron/`. This has already caused one real bug.

3. **Don't poll `get-system-info`.** It spawns PowerShell for the GPU name on every call. Use `get-system-vitals` (pure `os.*`, no subprocess) for anything repeated.

4. **The system prompt is load-bearing.** A tool absent from the TOOLS prose in `live-session.ts` gets called unreliably even with a perfect schema.

5. **Adding a preload method does not make it voice-callable.** Four preload methods (`getAllApps`, `openSearchResult`, `fetchNews`, `searchYoutubeEmbed`) are UI-only by design.

6. **Widgets are ephemeral.** In-memory only; no persistence, and drag position is never written back.

7. **`animationIntensity` is a dead setting** — written by the UI, read by nothing. Don't model new work on it.

8. **GPU flags are set twice** in `main.cjs` (top and bottom) with conflicting `enable-features` values. Pre-existing; deduping changes which value wins, so it's been left alone deliberately.

9. **Google OAuth tokens expire in ~1 hour.** Firebase web auth returns an access token but *no refresh token*, so Calendar/Gmail stop working until the user signs out and back in. `googleApiFetch` detects this and returns `needsAuth` with a clear message — don't paper over it with retries. A proper fix needs a real server-side OAuth flow.

10. **`runTool` in the handler context is depth-capped at 3.** Routines use it to replay saved tool sequences; the cap stops a self-referencing routine from recursing away.

---

## 10. Performance — deliberate decisions, don't undo these

**`backgroundThrottling: false` is intentional** (`window.cjs`). Sleep mode minimises the window but must keep the wake-word listener and auto-reconnect timers alive, so Chromium's throttling can't be relied on. **The consequence is that nothing pauses itself when the window is hidden — you must handle visibility explicitly.** Two places already do:
- `FridayOrb.tsx` — cancels its rAF loop on `visibilitychange` (it was rendering a 400×400 canvas at 30fps while minimised)
- `App.tsx` — stops the 1s clock interval while hidden

**If you add any continuous loop, pause it on `document.hidden`.** `document.hidden` is true only when genuinely not visible (minimised/occluded), not when merely unfocused — so the unfocused-but-visible case still animates, which is the point of the throttling flag.

**Bundle layout** (`vite.config.ts` `manualChunks`):
- Startup: `index` + `vendor-react` + `vendor-firebase` + `vendor-motion` (~920kB)
- On first connect: `vendor-genai` + `live-session` (~346kB) — `LiveSession` is dynamically imported in `connect()` precisely to keep `@google/genai` off the startup path. **Don't turn that back into a static import.**
- On demand: `MapView` (~1.8MB, mapbox), `SettingsPanel`, `AppBrowser`, `VisionHUD`

**Memoized components:** `FridayOrb` (custom comparator — `gradientColors` is compared by contents since App rebuilds the array each render), `WidgetManager`, `ProgressBar`, `Toast`. App re-renders on every session-state flip, so anything expensive below it needs `React.memo` **and** stable props (`useCallback([])`).

**Main-process I/O rules.** The main process serves every IPC channel, so blocking it stalls the whole UI:
- No sync file reads in anything called repeatedly. `cache-get-patterns` reads up to 30 session files — it uses `fs.promises` plus a 10-minute cache.
- Debounce frequent writes. Clipboard history batches to one write per 3s, flushed on `before-quit`.
- Don't spawn PowerShell on a timer — see trap 3.

## 11. Verification

There is **no test suite**. Always run all three before declaring done:

```bash
npm run lint      # tsc --noEmit — covers all of src/
npm run build     # vite build — catches resolution/bundling issues tsc misses
node --check electron/<file>.cjs    # .cjs is invisible to tsc
```

Useful consistency checks when adding tools:
- tool declarations vs handler keys should be **1:1**
- every declared tool should appear in `live-session.ts`'s `functionDeclarations`
- every `ipcMain.handle` channel should have a matching `preload.cjs` bridge

**What cannot be verified from a coding session:** anything needing a live Electron window — WhatsApp QR login, volume/brightness/bluetooth, game scanners, camera/vision, and the whole proactive loop. These need a manual `npm run electron:dev` smoke test by the user. Say so plainly rather than implying they were tested.

---

## 12. Secrets

**All credentials live in `.env`** (gitignored). Never hardcode a key in source — there is no exception to this.

- Main process reads `process.env.X` directly (dotenv is loaded first thing in `main.cjs`).
- Renderer reads `import.meta.env.VITE_X` — only `VITE_`-prefixed vars are exposed to the client bundle, and **anything prefixed `VITE_` ends up readable in the shipped app**, so don't put anything there that must stay private.
- Missing keys should degrade with a clear message (see `requireYoutubeKey` in `media.cjs`), never fire requests that fail opaquely.
- `firebase-applet-config.json` contains a Firebase web API key. That one is *meant* to be public — it ships in every client bundle and security comes from Firestore rules plus authorized-domain restrictions, not from hiding it.

⚠️ **Historical exposure:** an NVIDIA key and a YouTube Data API key were previously hardcoded and are still present in git history (commit `c1610b8`). They've been moved to `.env`, but moving them does not remove them from history — both need rotating in their provider consoles.

## 13. Known issues (unresolved, deliberate)

- `useFriday.ts` (~1,000 lines) is still the largest renderer file. Splitting it means restructuring shared state — a logic change, not a move.
- Google OAuth tokens expire hourly with no refresh (see trap 9).
