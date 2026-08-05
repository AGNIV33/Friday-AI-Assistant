# Friday AI Assistant

A real-time, voice-to-voice AI desktop assistant powered by the Gemini Live API, inspired by Iron Man's Friday. Built for Windows with a high-performance, GPU-accelerated UI.

You talk. She listens, decides what to do, does it on your actual machine, and talks back.

---

## Features

**Voice & presence**
- **Voice-to-voice AI** — natural spoken conversation via Gemini Live, no typing
- **Wake word + clap detection** — sleeps to a low-overhead standby, wakes on voice or a double clap
- **Animated orb** — 40+ canvas-rendered orb styles that react to speech and listening state
- **49 themes** — 26 solid + 23 animated gradient, plus 8 voices

**Doing things on your PC**
- **App control** — open and close applications by name
- **File intelligence** — search the whole machine, open, move, delete, batch-organize folders
- **Document writing** — dictate straight into Notepad or Microsoft Word with real formatting
- **System control** — volume, brightness, Bluetooth, WiFi, Windows settings pages
- **Window management** — snap any app to halves, quarters, or fullscreen
- **Game mode** — scans Steam, Epic, GOG, EA, Ubisoft and Xbox libraries with a themed UI

**Seeing and showing**
- **Vision** — analyze your screen (with cursor highlighting) or webcam through a JARVIS-style HUD
- **3D maps** — ask for any location and get a holographic Mapbox flyover
- **Image generation** — text-to-image via NVIDIA's models
- **Floating widgets** — music, YouTube, news, images, and a cinematic 3D news briefing

**Memory & proactivity**
- **Persistent memory** — remembers facts about you and past conversations across sessions
- **People memory** — remembers who's who: "my sister Priya works in Bangalore" → "who is Priya?"
- **Reminders & alarms** — "remind me in 20 minutes", "every weekday at 9am"; survives restarts
- **Daily briefing** — a short status greeting when you wake her
- **Health warnings** — speaks up if CPU, memory, or disk stays under pressure
- **Usage suggestions** — offers something relevant based on what you normally do at that time of day
- **Emotional tone** — her delivery and the UI colour shift between urgent, calm, and normal

**Productivity**
- **Routines** — bundle actions into one phrase: "do my morning setup"
- **Notes** — "note that…" and "what did I note about X?" with keyword search
- **Clipboard history** — "what did I copy earlier?" and paste older items back *(opt-in)*
- **Document summarization** — reads PDFs, Word docs, and text/code files and summarizes them
- **Cited research** — researches a topic and tells you which sources each claim came from, optionally written up as a Word document

**Communication**
- **Google Calendar** — check your schedule, create and cancel events by voice
- **Gmail** — triage your inbox, read messages, and send mail (always confirms first)
- **WhatsApp** — send messages by voice

> Everything proactive is **off by default**. Turn on only what you want in **Settings → Proactive**.

---

## Setup

### Prerequisites
- **Node.js 18+**
- **Windows** — required for app launching, Word automation, and system control
- A **Firebase project** (free tier is fine) for sign-in and memory

### 1. Install

```bash
npm install
```

### 2. API keys

Copy `.env.example` to `.env` and fill in:

```env
# Voice conversation (required)
GEMINI_API_KEY="your_gemini_api_key_here"

# Image generation (optional)
NVIDIA_API_KEY="your_nvidia_api_key_here"

# 3D maps (optional)
VITE_MAPBOX_TOKEN="your_mapbox_public_token_here"

# Vision — screen & webcam analysis (optional)
VITE_VISION_API_KEY="your_vision_api_key_here"
VITE_VISION_MODEL="nvidia/nemotron-3-nano-omni-30b-a3b-reasoning"
VITE_VISION_BASE_URL="https://integrate.api.nvidia.com/v1"

# Optional — YouTube search for the music/video/news widgets
YOUTUBE_API_KEY="your_youtube_data_api_key_here"
```

Only `GEMINI_API_KEY` is needed to talk to her. The rest unlock individual features — anything missing degrades with a clear message rather than failing silently.

You can also set the Gemini and NVIDIA keys in-app under **Settings → System**.

### 3. Firebase

Rename `firebase-applet-config.example.json` → `firebase-applet-config.json` and fill in your project config:

```json
{
  "apiKey": "your_api_key_here",
  "authDomain": "your_project.firebaseapp.com",
  "projectId": "your_project_id",
  "storageBucket": "your_project.appspot.com",
  "messagingSenderId": "1234567890",
  "appId": "1:1234567890:web:abcdef123456",
  "firestoreDatabaseId": "(default)"
}
```

Enable **Google sign-in** in Firebase Auth, and deploy `firestore.rules` to your project.

### 4. Calendar & Gmail (optional)

Friday asks for Calendar and Gmail permission during Google sign-in. To make that work:

1. In [Google Cloud Console](https://console.cloud.google.com) → your Firebase project → **APIs & Services**, enable the **Google Calendar API** and **Gmail API**.
2. Under **OAuth consent screen**, add yourself as a **Test user**.
3. Sign out and back in to Friday, and accept the permission prompt.

Both APIs are free. Everything else works without this — you'll just be told Calendar and Gmail aren't connected if you try to use them.

> **Known limitation:** Google access expires after about an hour and there's no automatic refresh. When it does, Friday will say so and you sign out and back in. Fixing this properly needs a server-side OAuth flow.

### 5. Run

Two terminals:

```bash
# Terminal 1 — dev server
npm run dev

# Terminal 2 — desktop app
npm run electron:dev
```

Sign in with Google, then click the mic to start talking.

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on port 3000 |
| `npm run electron:dev` | Launches the desktop app (waits for the dev server) |
| `npm run build` | Production web build |
| `npm run electron:build` | Packages a Windows installer |
| `npm run lint` | TypeScript check |
| `npm run clean` | Wipes `dist/` |

---

## Things you can say

| | |
|---|---|
| **Apps** | "Open Chrome" · "Close Spotify" · "Put Notepad on the left" |
| **Files** | "Find my resume" · "Organize this folder by year" · "What's in my Downloads?" |
| **Writing** | "Write me a cover letter in Word" · "Make that bold" |
| **System** | "Set volume to 40" · "Turn on Bluetooth" · "How's my CPU doing?" |
| **Vision** | "What's on my screen?" · "Take a look at this" |
| **Media** | "Play some jazz" · "Show me the news" · "Show me Tokyo on the map" |
| **Memory** | "Remember I prefer dark roast" · "What did we talk about yesterday?" |
| **People** | "My sister Priya just moved to Pune" · "Who is Priya?" |
| **Reminders** | "Remind me in 20 minutes to check the oven" · "What reminders do I have?" |
| **Notes** | "Note that the wifi password is upstairs" · "What did I note about wifi?" |
| **Routines** | "Save this as my morning setup" · "Run my morning setup" |
| **Clipboard** | "What did I copy earlier?" · "Copy that link back" |
| **Documents** | "Summarize this PDF" · "What are the key points in my report?" |
| **Research** | "Research electric cars and tell me the sources" · "…and write it up in Word" |
| **Calendar** | "What's on my calendar tomorrow?" · "Schedule a dentist appointment Friday at 3" |
| **Email** | "Check my email" · "Any unread from Dave?" · "Reply saying I'll be late" |
| **Sleep** | "That's all for today" (sleeps) · double-clap or say her name to wake |

---

## Project layout

```
electron/          Main process — OS access, IPC handlers
  ipc/             One module per domain (apps, files, media, …)
src/
  app/             App shell
  features/
    assistant/     Core: session, orchestration, tools + handlers
    vision/        Screen & camera analysis
    orb/           Animated orb renderers
    widgets/       Floating panels
    settings/      Settings panel + tabs
    map/           3D map view
  shared/          Toast, progress bar
  services/        Firebase
```

Detailed architecture notes are in [CLAUDE.md](CLAUDE.md).

---

## Where your data lives

- **Cloud (Firebase)** — facts you asked her to remember, people you've told her about, custom instructions, session summaries. Tied to your Google account.
- **Local (`.friday-data/`)** — conversation history, usage patterns, reminders, notes, routines, and clipboard history. Never leaves your machine. Gitignored.
- **Settings** — browser localStorage.

Clipboard history is **off by default** because it would capture everything you copy, passwords included. Turn it on in **Settings → Proactive** only if that's acceptable to you.

To wipe local history, delete the `.friday-data/` folder.

---

## Troubleshooting

**"Gemini API Key is missing"** — set it in `.env` or Settings → System, then restart.

**Mic not working** — Windows Settings → Privacy → Microphone → allow desktop apps. Only one Friday instance can run at a time.

**WhatsApp won't connect** — a QR code appears in the terminal running `electron:dev`; scan it from WhatsApp → Linked Devices. The session persists afterwards.

**App won't start / cache errors** — the app self-heals a corrupt cache on boot. If it persists, delete `%APPDATA%/friday-ai-dev-data`.

**She greets me on every reconnect** — she shouldn't; reconnects are meant to be silent. If it happens, the session is fully restarting rather than reconnecting — check your network.

**UI feels laggy** — try Settings → System → Performance Mode, or a solid theme instead of an animated gradient.

---

## Security notes

- The renderer is fully sandboxed (`nodeIntegration: false`, `contextIsolation: true`); it can only reach the OS through explicitly exposed channels.
- Deleting files always confirms first and prefers the Recycle Bin.
- Vision frames are sent to the configured vision API for analysis and are not stored.

- All API keys live in `.env`, which is gitignored. Nothing is hardcoded in source.

⚠️ **Two keys need rotating.** An NVIDIA key and a YouTube key were hardcoded in earlier versions and remain in this repo's git history (commit `c1610b8`). They've since been moved to `.env`, but that doesn't erase them from history — anyone with the repo can still read them. Generate replacements in the NVIDIA and Google Cloud consoles, put the new values in `.env`, and revoke the old ones.

---

*Made by AGNIV Sarkar*
