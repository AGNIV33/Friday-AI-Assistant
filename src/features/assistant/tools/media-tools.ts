import { type FunctionDeclaration, Type } from "@google/genai";

export const playMediaTool: FunctionDeclaration = {
  name: "playMedia",
  description: "Directly auto-plays a song or video on Spotify or YouTube. Use this whenever the user explicitly asks to play a song/video on YouTube or Spotify. This tool handles EVERYTHING — it searches, finds the video/song, and opens it automatically. Do NOT also call openWebsite or any other tool for the same request. One call to playMedia is all you need. LIVE STREAMS: When the user asks for a live stream, live TV, or live news channel (e.g., 'open ABP news live', 'play CNN live', 'NDTV live'), you MUST include the word 'live' in the query and pass the exact channel name (e.g., query='ABP Ananda live' or 'CNN News18 live'). The tool automatically detects live intent and searches for currently broadcasting live streams first.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      platform: { type: Type.STRING, description: "The media platform to play on ('youtube' or 'spotify')." },
      query: { type: Type.STRING, description: "The name of the song, artist, video, or channel to play. For live streams, always include 'live' in the query (e.g., 'ABP Ananda live', 'CNN live news')." }
    },
    required: ["platform", "query"],
  },
};

export const generateImageTool: FunctionDeclaration = {
  name: "generateImage",
  description: "Generates an image from a text description using an AI image generation model (flux). Use this ONLY when the user explicitly asks you to generate, create, or make an image/picture/photo. After calling this, the image will automatically open in the Photos app for the user to see. You MUST then ask the user what name they want to save it as and where they want to save it.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      prompt: {
        type: Type.STRING,
        description: "A concise but descriptive prompt for the image (MUST be under 500 characters). Focus on the key subject, style, and mood. Do NOT write long paragraphs.",
      },
    },
    required: ["prompt"],
  },
};

export const saveGeneratedImageTool: FunctionDeclaration = {
  name: "saveGeneratedImage",
  description: "Saves the most recently generated image to a specific location with a specific filename. Use this AFTER the user tells you where they want to save the generated image and what name to give it. If the user doesn't specify a path, save to the Desktop by default.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      fileName: {
        type: Type.STRING,
        description: "The filename for the saved image (e.g., 'sunset_painting'). No need to include .png extension.",
      },
      savePath: {
        type: Type.STRING,
        description: "The directory path where the image should be saved. If the user says 'desktop', use an empty string to default to Desktop. Otherwise use the full path like 'C:\\Users\\Username\\Pictures'.",
      },
    },
    required: ["fileName"],
  },
};

export const playEpisodeTool: FunctionDeclaration = {
  name: "playEpisode",
  description: "Finds and plays a specific TV show episode from a folder on the computer. Detects episode files named in formats like S01E01, S1E1, 1x01, Episode 1, etc. ALWAYS ask the user which media player to use (VLC, Windows Media Player, or system default) BEFORE calling this tool.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      folderPath: {
        type: Type.STRING,
        description: "Full path to the show's folder (e.g. 'D:\\Shows\\Breaking Bad'). If unsure, use searchFiles first to find it.",
      },
      season: {
        type: Type.NUMBER,
        description: "Season number (e.g. 1 for Season 1).",
      },
      episode: {
        type: Type.NUMBER,
        description: "Episode number (e.g. 1 for Episode 1).",
      },
      player: {
        type: Type.STRING,
        description: "Media player to use: 'vlc', 'windows media player', or 'default'. Ask the user each time.",
      },
    },
    required: ["folderPath", "season", "episode", "player"],
  },
};
