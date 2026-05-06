# Friday AI Assistant

A real-time, voice-to-voice AI desktop assistant powered by Gemini Live API, inspired by Iron Man's Friday. Built for Windows with a stunning, high-performance UI.

## Features

- **Voice-to-Voice AI** — Speak naturally, Friday responds with fluid voice using the Gemini Live API.
- **Desktop Automation** — Open/close apps, manage files, and write documents natively in Microsoft Word and Notepad.
- **Geospatial Intelligence** — Real-time 3D interactive Mapbox maps with tactical holographic overlays.
- **AI Image Generation** — Generate high-quality images from text prompts using NVIDIA's AI models.
- **Dynamic Memory** — Remembers facts and conversation summaries across sessions, persistently saving instructions.
- **WhatsApp Integration** — Send messages seamlessly via WhatsApp Web.
- **Web & Media Search** — Search Google, open YouTube videos, and play Spotify natively.
- **System Control** — Volume, brightness, Bluetooth, WiFi, and more system-level controls.
- **Game Mode** — Automatically scans installed games (Steam, Epic, Xbox, etc.) with a themed UI launcher.
- **Sleep/Wake Mechanics** — Low-overhead standby mode with clap detection and voice wake-word triggers.

## Setup

### Prerequisites
- Node.js 18+
- Windows OS (Required for deep system integrations like App launching and Word automation)

### Install & Run

```bash
npm install

# Terminal 1: Start Vite dev server
npm run dev

# Terminal 2: Start Electron
npm run electron:dev
```

### Environment Variables & API Keys

To use all of Friday's features, you need to set up your API keys. Create a `.env` file in the project root (you can copy `.env.example`) and add:

```env
# Required for Voice-to-Voice AI communication
GEMINI_API_KEY="your_gemini_api_key_here"

# Required for AI Image Generation (NVIDIA NIM APIs)
NVIDIA_API_KEY="your_nvidia_api_key_here"

# Required for Geospatial Intelligence (3D Maps)
VITE_MAPBOX_TOKEN="your_mapbox_public_token_here"
```

*Note: You can also configure the Gemini and NVIDIA API keys directly in the application via **Settings > System**.*

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Desktop**: Electron
- **AI**: Gemini Live API (voice-to-voice), NVIDIA AI (Image Generation)
- **Maps**: Mapbox GL JS
- **Auth/Memory**: Firebase (Auth + Firestore)
- **Styling**: Tailwind CSS + custom GPU-accelerated animations
- **Audio**: Web Audio API with AudioWorklet
