# Friday AI Assistant

A real-time, voice-to-voice AI desktop assistant powered by Gemini Live API, inspired by Iron Man's Friday.

## Features

- **Voice-to-Voice** — Speak naturally, Friday responds with voice
- **Desktop Automation** — Open/close apps, manage files, control system settings
- **Memory** — Remembers facts and conversation summaries across sessions
- **WhatsApp Integration** — Send messages via WhatsApp Web
- **AI Image Generation** — Generate images from text prompts
- **Web Search** — Search Google and get spoken answers
- **System Control** — Volume, brightness, Bluetooth, WiFi
- **Game Mode** — Scans installed games with themed UI
- **Sleep/Wake** — Clap detection + voice wake word

## Setup

### Prerequisites
- Node.js 18+
- A Gemini API key

### Install & Run

```bash
npm install

# Terminal 1: Start Vite dev server
npm run dev

# Terminal 2: Start Electron
npm run electron:dev
```

### Environment

Create a `.env` file in the project root:

```
GEMINI_API_KEY=your_api_key_here
```

Or set the API key in the app via **Settings > System**.

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Desktop**: Electron
- **AI**: Gemini Live API (voice-to-voice)
- **Auth/Memory**: Firebase (Auth + Firestore)
- **Styling**: Tailwind CSS + custom animations
- **Audio**: Web Audio API with AudioWorklet
