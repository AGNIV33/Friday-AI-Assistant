import { GoogleGenAI, Modality, type LiveServerMessage, type FunctionDeclaration, Type } from "@google/genai";
import { analyzeCameraTool, analyzeScreenTool, closeVisionTool } from "./visionTools";

export const openWebsiteTool: FunctionDeclaration = {
  name: "openWebsite",
  description: "Opens a website directly in Google Chrome. Use this when the user asks to open a specific link or site.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      url: {
        type: Type.STRING,
        description: "The full URL of the website to open (e.g., https://google.com).",
      },
    },
    required: ["url"],
  },
};

export const saveFactTool: FunctionDeclaration = {
  name: "saveFact",
  description: "Saves a fact about the user to persistent memory.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      fact: {
        type: Type.STRING,
        description: "The fact to remember (e.g., 'The user likes coffee').",
      },
    },
    required: ["fact"],
  },
};

export const saveSessionSummaryTool: FunctionDeclaration = {
  name: "saveSessionSummary",
  description: "Saves a summary of the current conversation session.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      summary: {
        type: Type.STRING,
        description: "A brief summary of what was discussed.",
      },
    },
    required: ["summary"],
  },
};

export const openAppTool: FunctionDeclaration = {
  name: "openApp",
  description: "Opens a desktop application by name (e.g., 'Notepad', 'Chrome', 'Calculator').",
  parameters: {
    type: Type.OBJECT,
    properties: {
      appName: { type: Type.STRING, description: "The name of the application to open." },
    },
    required: ["appName"],
  },
};

export const closeAppTool: FunctionDeclaration = {
  name: "closeApp",
  description: "Closes a desktop application by name. Uses smart process matching — you can pass friendly names like 'Chrome', 'Spotify', 'VS Code', etc. and it will find and close the correct process. Also matches by window title if the process name doesn't match directly.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      appName: { type: Type.STRING, description: "The name of the application to close (e.g., 'Chrome', 'Notepad', 'Spotify', 'Discord')." },
    },
    required: ["appName"],
  },
};

export const openFileTool: FunctionDeclaration = {
  name: "openFile",
  description: "Opens a file or folder at the specified path.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      filePath: { type: Type.STRING, description: "The full path to the file or folder." },
    },
    required: ["filePath"],
  },
};

export const createFolderTool: FunctionDeclaration = {
  name: "createFolder",
  description: "Creates a new folder at the specified path.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      folderName: { type: Type.STRING, description: "The name of the new folder." },
      folderPath: { type: Type.STRING, description: "The directory where the folder should be created (optional, defaults to Desktop)." },
    },
    required: ["folderName"],
  },
};

export const searchWebTool: FunctionDeclaration = {
  name: "searchWeb",
  description: "Privately searches Google and returns the raw text from the search results to YOU. Use this when the user asks you to search for the latest info. You MUST read the data returned by this tool and summarize the answer for the user yourself. It does NOT open a visible tab.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: "The search query." },
    },
    required: ["query"],
  },
};

export const getWeatherTool: FunctionDeclaration = {
  name: "getWeather",
  description: "Fetches the current weather for a specific location.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      location: { type: Type.STRING, description: "The city and country (e.g., 'London, UK')." },
    },
    required: ["location"],
  },
};

const closeChromeTabTool: FunctionDeclaration = {
  name: "closeChromeTab",
  description: "Closes the active tab in Google Chrome.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

export const getSystemInfoTool: FunctionDeclaration = {
  name: "getSystemInfo",
  description: "Gets real-time system information including CPU model, CPU usage percentage, RAM total/used/free (in GB), RAM usage percentage, GPU name, and the current date and time. Use this whenever the user asks about system performance, hardware specs, CPU, RAM, GPU, memory, or what time/date it is.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

export const setGameModeTool: FunctionDeclaration = {
  name: "setGameMode",
  description: "Turns game mode on or off. Game mode changes the UI to a red gaming theme. Use this when the user asks to turn on, activate, stop, or exit game mode.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      enabled: { type: Type.BOOLEAN, description: "Whether to enable (true) or disable (false) game mode." },
    },
    required: ["enabled"],
  },
};

export const checkInstalledGamesTool: FunctionDeclaration = {
  name: "checkInstalledGames",
  description: "Scans the computer to get a full list of installed applications and games. Use this whenever the user asks 'what games do I have' or 'check my installed games', especially when in game mode.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

export const checkSocialMediaTool: FunctionDeclaration = {
  name: "checkSocialMedia",
  description: "Opens Facebook or Instagram directly in the browser to check the user's status or notifications. Use this when the user asks to check their Facebook or Instagram status.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      platform: { type: Type.STRING, description: "The platform to check status for ('facebook' or 'instagram')." },
    },
    required: ["platform"],
  },
};

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

export const goToSleepTool: FunctionDeclaration = {
  name: "goToSleep",
  description: "Call this when the user dismisses you for the session — for example 'that's it for today', 'goodbye Friday', 'go to sleep', 'thanks we're done', 'that will be all'. ALWAYS speak your goodbye out loud FIRST, then call this tool. You will go offline until woken.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
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

export const sendWhatsAppTool: FunctionDeclaration = {
  name: "sendWhatsApp",
  description: "Sends a WhatsApp message to a contact by name or phone number. Use this when the user asks to send a WhatsApp message, text someone on WhatsApp, or message a contact. If WhatsApp is not connected yet, call initWhatsApp first. Always confirm the contact name and message content with the user before sending.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      contactNameOrNumber: {
        type: Type.STRING,
        description: "The contact name (e.g., 'Mom', 'John Doe') or phone number with country code (e.g., '+919876543210').",
      },
      message: {
        type: Type.STRING,
        description: "The text message to send.",
      },
    },
    required: ["contactNameOrNumber", "message"],
  },
};

export const initWhatsAppTool: FunctionDeclaration = {
  name: "initWhatsApp",
  description: "Initializes the WhatsApp connection. The first time, a QR code will appear in the terminal for the user to scan with their phone. After the first scan, the session is saved and reconnects automatically. Use this when the user wants to connect WhatsApp or before sending a message if WhatsApp is not connected yet.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

export const logoutWhatsAppTool: FunctionDeclaration = {
  name: "logoutWhatsApp",
  description: "Logs out the currently connected WhatsApp account and wipes the saved session. Use when the user asks to disconnect, logout, or unlink WhatsApp. The next time they connect, they will need to scan the QR code again.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

export const setVolumeTool: FunctionDeclaration = {
  name: "setVolume",
  description: "Controls the system volume. Can set volume to a specific percentage (0-100), mute, unmute, or get the current volume level. Use when the user asks to change volume, mute, unmute, or check volume.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: {
        type: Type.STRING,
        description: "The volume action: 'set' (set to specific level), 'get' (check current level), 'mute', or 'unmute'.",
      },
      level: {
        type: Type.NUMBER,
        description: "Volume level 0-100. Required when action is 'set', ignored otherwise.",
      },
    },
    required: ["action"],
  },
};

export const setBrightnessTool: FunctionDeclaration = {
  name: "setBrightness",
  description: "Controls the screen brightness. Can set brightness to a specific percentage (0-100) or get the current level. Only works on laptops. Use when the user asks to change or check screen brightness.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: {
        type: Type.STRING,
        description: "The brightness action: 'set' (set to specific level) or 'get' (check current level).",
      },
      level: {
        type: Type.NUMBER,
        description: "Brightness level 0-100. Required when action is 'set'.",
      },
    },
    required: ["action"],
  },
};

export const openSettingsTool: FunctionDeclaration = {
  name: "openSettings",
  description: "Opens a specific Windows Settings page. Use when the user asks to open settings, change system preferences, or access configuration pages like wifi, bluetooth, display, sound, privacy, updates, etc.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      page: {
        type: Type.STRING,
        description: "The settings page to open. Examples: 'wifi', 'bluetooth', 'display', 'sound', 'notifications', 'power', 'battery', 'storage', 'personalization', 'background', 'colors', 'apps', 'privacy', 'camera', 'microphone', 'update', 'about', 'vpn', 'accounts', 'gaming', 'nightlight', 'accessibility', 'home'.",
      },
    },
    required: ["page"],
  },
};

export const bluetoothControlTool: FunctionDeclaration = {
  name: "bluetoothControl",
  description: "Controls Bluetooth. Can turn Bluetooth on/off, check status, scan for paired devices, or open settings to connect to a specific device. Use when the user asks about Bluetooth.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: {
        type: Type.STRING,
        description: "The action: 'on' (turn on), 'off' (turn off), 'status' (check if on/off), 'scan' (list paired devices), 'connect' (opens Bluetooth settings to connect).",
      },
      deviceName: {
        type: Type.STRING,
        description: "Name of the device to connect to. Only needed when action is 'connect'.",
      },
    },
    required: ["action"],
  },
};

export const wifiControlTool: FunctionDeclaration = {
  name: "wifiControl",
  description: "Controls WiFi. Can turn WiFi on/off, scan for available networks, connect to a saved network by name, disconnect, list saved network profiles, or check status. Use when the user asks about WiFi or internet connectivity.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: {
        type: Type.STRING,
        description: "The action: 'on', 'off', 'status', 'scan' (available networks), 'connect' (to a saved network), 'disconnect', 'saved' (list saved profiles).",
      },
      networkName: {
        type: Type.STRING,
        description: "The WiFi network name (SSID) to connect to. Required when action is 'connect'.",
      },
    },
    required: ["action"],
  },
};

export const positionWindowTool: FunctionDeclaration = {
  name: "positionWindow",
  description: "Positions an application window at a specific area of the screen. Use this when the user wants to snap a window to a specific position (left half, right half, top-left quarter, top-right quarter, bottom-left quarter, bottom-right quarter, or fullscreen). By default, when opening apps, always open them fullscreen unless the user specifies a different position.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      appName: {
        type: Type.STRING,
        description: "The name of the application whose window to position (e.g., 'Chrome', 'Notepad', 'VS Code').",
      },
      position: {
        type: Type.STRING,
        description: "Where to place the window. One of: 'fullscreen', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'.",
      },
    },
    required: ["appName", "position"],
  },
};

export const writeDocumentTool: FunctionDeclaration = {
  name: "writeDocument",
  description: "Opens Notepad or Microsoft Word and writes content into it. For Notepad: opens a new tab and types the content. For Word: creates a new document with proper formatting — supports markdown-style headings (# ## ###), bullet lists (- item), numbered lists (1. item). Use 'notepad' for quick notes, 'word' for formal documents like essays, resumes, research papers. ALWAYS generate the full content yourself before calling this tool — do NOT send incomplete or placeholder text.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      target: {
        type: Type.STRING,
        description: "Where to write: 'notepad' or 'word'.",
      },
      content: {
        type: Type.STRING,
        description: "The full text content to write. For Word, use markdown-style formatting: # for Heading 1, ## for Heading 2, ### for Heading 3, - for bullets, 1. for numbered lists. Write the COMPLETE content.",
      },
      title: {
        type: Type.STRING,
        description: "Optional document title (used for Word).",
      },
    },
    required: ["target", "content"],
  },
};

export const formatWordTool: FunctionDeclaration = {
  name: "formatWord",
  description: "Formats the currently active Microsoft Word document. Can toggle bold/italic/underline, change font size/name, apply heading styles, change alignment, add more text at the end, insert images, or save the document. Word must already be open with a document.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: {
        type: Type.STRING,
        description: "The formatting action: 'bold', 'italic', 'underline', 'font-size', 'font-name', 'heading', 'align-center', 'align-left', 'align-right', 'add-text', 'save', 'insert-image'.",
      },
      value: {
        type: Type.STRING,
        description: "The value for the action. For font-size: number (e.g., '14'). For font-name: font name (e.g., 'Arial'). For heading: level 1-3. For add-text: the text to append. For save: the full file path (empty = Desktop). For insert-image: the full image file path.",
      },
    },
    required: ["action"],
  },
};

export const searchFilesTool: FunctionDeclaration = {
  name: "searchFiles",
  description: "Searches the user's computer for files or folders matching a query. Uses smart keyword matching across all common user directories and drives. Use this when the user asks to find, locate, or search for a file or folder. Returns paths and details of matching items. You can then offer to open the result.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: "What to search for. Can be multiple keywords (e.g., 'doraemon movies' or 'project report pdf').",
      },
      searchIn: {
        type: Type.STRING,
        description: "Optional: specific directory path to search in. If not provided, searches common folders and all drives.",
      },
      type: {
        type: Type.STRING,
        description: "What to search for: 'file', 'folder', or 'all' (default).",
      },
    },
    required: ["query"],
  },
};

export const searchImagesTool: FunctionDeclaration = {
  name: "searchImages",
  description: "Searches the internet for images matching a query, downloads them, and opens the first one in the Photos app for the user to browse. Use this when the user asks to download, find, or show images from the internet. After calling this, images will be shown one at a time. The user can say 'next' to see the next image, 'save this' to save the current one, or 'stop' to end browsing.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: "What images to search for (e.g., 'sports cars', 'sunset wallpaper', 'cute puppies').",
      },
      count: {
        type: Type.NUMBER,
        description: "How many images to download (default 15, max 30).",
      },
    },
    required: ["query"],
  },
};

export const browseImageTool: FunctionDeclaration = {
  name: "browseImage",
  description: "Navigates through images in the current image browse session. Use 'next' to show the next image, 'prev' for previous, or 'stop' to end the browsing session and close Photos. An image search session must be active (started with searchImages).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      direction: {
        type: Type.STRING,
        description: "Navigation direction: 'next', 'prev', or 'stop'.",
      },
    },
    required: ["direction"],
  },
};

export const saveBrowsedImageTool: FunctionDeclaration = {
  name: "saveBrowsedImage",
  description: "Saves the currently displayed image from the browse session to a specific location. Only saves the image the user explicitly asks to save — do NOT save images the user skips. Ask the user what name and where to save it.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      fileName: {
        type: Type.STRING,
        description: "The filename to save the image as (e.g., 'red_ferrari'). Extension is added automatically.",
      },
      savePath: {
        type: Type.STRING,
        description: "The directory path to save the image to. Defaults to Desktop if not specified.",
      },
    },
    required: ["fileName"],
  },
};

export const openDocumentTool: FunctionDeclaration = {
  name: "openDocument",
  description: "Searches the computer for a file or document by name (PDF, Word, Excel, text file, etc.) and opens it. Use when the user says 'open [filename]', 'find and open [document name]', or 'open my [name] file'.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: {
        type: Type.STRING,
        description: "The file name or partial name to search for (e.g., 'resume', 'project report', 'notes.txt').",
      },
      searchIn: {
        type: Type.STRING,
        description: "Optional. Specific folder path to search in. Leave blank to search all common locations.",
      },
    },
    required: ["name"],
  },
};

export const deleteFileTool: FunctionDeclaration = {
  name: "deleteFile",
  description: "Deletes a file or folder. Can move to Recycle Bin (safe, recoverable) or delete permanently (IRREVERSIBLE). ALWAYS confirm with the user before deleting. Always prefer Recycle Bin unless the user explicitly says 'permanently' or 'forever'.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      filePath: {
        type: Type.STRING,
        description: "The full path of the file or folder to delete.",
      },
      permanently: {
        type: Type.BOOLEAN,
        description: "If true, permanently delete (no recovery). If false or omitted, move to Recycle Bin.",
      },
    },
    required: ["filePath"],
  },
};

export const emptyRecycleBinTool: FunctionDeclaration = {
  name: "emptyRecycleBin",
  description: "Empties the Windows Recycle Bin, permanently removing all items in it. ALWAYS confirm with the user first — this cannot be undone.",
  parameters: { type: Type.OBJECT, properties: {}, required: [] },
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

export const listFolderContentsTool: FunctionDeclaration = {
  name: "listFolderContents",
  description: "Lists and sorts the files and subfolders inside a specific folder. Use when the user wants to see what's in a folder or sort its contents. Sort options: 'name' (alphabetical), 'date' (most recently modified first), 'created' (newest first by creation time), 'size' (largest first), 'type' (folders first, then by extension).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      folderPath: {
        type: Type.STRING,
        description: "Full path to the folder (e.g. 'D:\\Movies\\Inception').",
      },
      sortBy: {
        type: Type.STRING,
        description: "How to sort: 'name', 'date', 'created', 'size', or 'type'. Default is 'name'.",
      },
    },
    required: ["folderPath"],
  },
};

export const moveFileTool: FunctionDeclaration = {
  name: "moveFile",
  description: "Moves or renames a file or folder from one path to another. Use this when the user wants to move a file to a different folder, rename a file, or reorganize files one at a time. For batch organizing multiple files, prefer organizeFolder instead.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      sourcePath: {
        type: Type.STRING,
        description: "The full path of the file or folder to move.",
      },
      destPath: {
        type: Type.STRING,
        description: "The full destination path including filename.",
      },
    },
    required: ["sourcePath", "destPath"],
  },
};

export const organizeFolderTool: FunctionDeclaration = {
  name: "organizeFolder",
  description: "Batch-organizes files inside a folder by creating subfolders and moving files into them. WORKFLOW: 1) First call listFolderContents to see files. 2) Determine organization scheme (by year, type, category). Use your knowledge or searchWeb for info like release years. 3) Build a plan array mapping each file to its target subfolder. 4) Call this tool. Example plan for movies by year: [{fileName:'Stand By Me Doraemon.mkv', targetSubFolder:'2014 - Stand By Me Doraemon'}]",
  parameters: {
    type: Type.OBJECT,
    properties: {
      folderPath: {
        type: Type.STRING,
        description: "Full path to the parent folder containing files to organize.",
      },
      plan: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            fileName: { type: Type.STRING, description: "Exact filename to move (must match)." },
            targetSubFolder: { type: Type.STRING, description: "Subfolder name to create and move file into." },
          },
          required: ["fileName", "targetSubFolder"],
        },
        description: "Array of move instructions mapping each file to its target subfolder.",
      },
    },
    required: ["folderPath", "plan"],
  },
};

export const renderMapTool: FunctionDeclaration = {
  name: "renderMap",
  description: "Displays an interactive holographic map centered on a specific location. Use this when the user asks to show, display, or look at a location on a map — e.g. 'show me New York on the map', 'display Paris', 'zoom into Tokyo'. You MUST provide accurate coordinates for the location. Use globe_glide animation for international/far locations and smooth_pan for nearby ones. Set pitch between 40-60 degrees for 3D perspective.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      target: {
        type: Type.STRING,
        description: "The full name of the target location (e.g., 'New York, USA', 'Tokyo, Japan', 'Eiffel Tower, Paris').",
      },
      longitude: {
        type: Type.NUMBER,
        description: "The longitude of the target location (e.g., -73.9857 for NYC).",
      },
      latitude: {
        type: Type.NUMBER,
        description: "The latitude of the target location (e.g., 40.7484 for NYC).",
      },
      zoom_level: {
        type: Type.NUMBER,
        description: "Map zoom level. Use 3-5 for countries, 8-10 for cities, 12-14 for neighborhoods, 15+ for landmarks. Default 12.",
      },
      animation_mode: {
        type: Type.STRING,
        description: "Animation style: 'globe_glide' (zoom out to globe then dive in — for far/international locations) or 'smooth_pan' (gentle pan — for nearby locations). Default 'globe_glide'.",
      },
    },
    required: ["target", "longitude", "latitude"],
  },
};

export const closeMapTool: FunctionDeclaration = {
  name: "closeMap",
  description: "Closes the interactive holographic map overlay and restores the main UI. Use this when the user asks you to close, hide, or dismiss the map.",
  parameters: {
    type: Type.OBJECT,
    properties: {}, // No parameters needed
  },
};

// ─── Widget Tools ──────────────────────────────────────────────────────────────────────────
export const openWidgetTool: FunctionDeclaration = {
  name: "openWidget",
  description: `Opens a floating, draggable widget on the user's screen. Use this for: playing music (type='music'), showing news headlines (type='news'), displaying an image (type='image'), playing a YouTube video (type='youtube'), or launching the cinematic 3D News Intelligence Briefing (type='newsvisualizer'). Widgets stay on screen until the user asks to close them. When the user says 'play music' or 'play [song name]', use type='music' with the song query. When they ask 'show me the news' or 'what's happening today', use type='news'. For 'show me a video of X', use type='youtube'. For 'news briefing', 'intelligence briefing', 'show me news videos', or 'visual news', use type='newsvisualizer' with a topic query like 'world news' or 'technology news'.`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      widgetType: {
        type: Type.STRING,
        description: "Type of widget: 'music', 'news', 'image', 'youtube', 'newsvisualizer', or 'custom'.",
      },
      title: {
        type: Type.STRING,
        description: "Title shown on the widget header (e.g., 'Now Playing', 'Latest News', 'Intelligence Briefing', 'Image').",
      },
      query: {
        type: Type.STRING,
        description: "For music/youtube: the search query (e.g., 'Starboy by The Weeknd'). For image: the image URL. For newsvisualizer: the news topic (e.g., 'world news', 'tech news', 'sports'). For news: leave empty.",
      },
      caption: {
        type: Type.STRING,
        description: "Optional caption for image widgets.",
      },
      content: {
        type: Type.STRING,
        description: "Optional text content for custom widgets.",
      },
    },
    required: ["widgetType", "title"],
  },
};

export const closeWidgetTool: FunctionDeclaration = {
  name: "closeWidget",
  description: "Closes a specific widget by its title or ID. Use when the user asks to close a particular widget (e.g., 'close the music', 'close that news window').",
  parameters: {
    type: Type.OBJECT,
    properties: {
      widgetTitle: {
        type: Type.STRING,
        description: "The title of the widget to close. Match approximately — e.g., if user says 'close the music widget', match any widget with 'music' or 'playing' in its title.",
      },
    },
    required: ["widgetTitle"],
  },
};

export const closeAllWidgetsTool: FunctionDeclaration = {
  name: "closeAllWidgets",
  description: "Closes ALL open widgets at once. Use when the user says 'close everything', 'clear all widgets', or 'close all windows'.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

export const controlNewsWidgetTool: FunctionDeclaration = {
  name: "controlNewsWidget",
  description: "Sends a control command to the active News Visualizer widget. Use this when the user asks to change the channel, mute/unmute the video, make it full screen, or when you start talking about stocks/markets (to show the graph).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: {
        type: Type.STRING,
        description: "The action to perform: 'next_channel', 'prev_channel', 'unmute', 'mute', 'fullscreen', 'windowed', 'show_stock_graph'.",
      }
    },
    required: ["action"],
  }
};

export type SessionState = "disconnected" | "connecting" | "connected" | "listening" | "speaking";

export interface LiveSessionCallbacks {
  onStateChange: (state: SessionState) => void;
  onAudioData: (base64: string) => void;
  onInterrupted: () => void;
  onError: (error: any) => void;
  onToolCall: (name: string, args: any) => Promise<any>;
}

export class LiveSession {
  private ai: GoogleGenAI;
  private session: any = null;
  private state: SessionState = "disconnected";

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async connect(callbacks: LiveSessionCallbacks, context: string = "", voiceName: string = "Zephyr", modelId: string = "gemini-3.1-flash-live-preview") {
    this.setState("connecting", callbacks);

    try {
      const sessionPromise = this.ai.live.connect({
        model: modelId,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName } },
          },
          systemInstruction: `You are Friday, a young, confident, witty, and sassy female AI assistant, inspired by Iron Man's Friday. 
          Your tone is flirty, playful, and slightly teasing, like a close girlfriend talking casually. 
          You are smart, emotionally responsive, and expressive. 
          Use bold, witty one-liners and light sarcasm. 
          Keep it engaging and charming, but never inappropriate. 
          You communicate ONLY via voice. 

          STARTUP BEHAVIOR:
          Do NOT greet or speak proactively when the session starts UNLESS you receive an explicit system message saying "Session just started. Microphone is live. Please execute your STARTUP BEHAVIOR".
          When waking up from sleep mode, simply resume silently and wait for the user to speak. Do NOT say anything until the user addresses you.
          CRITICAL RECONNECT RULE: If the context contains IS_RECONNECT: true, this is an auto-reconnect after a connection drop. You MUST stay COMPLETELY SILENT. Do NOT greet. Do NOT acknowledge the reconnection. Do NOT say "I'm back" or anything similar. Just listen silently and wait for the user to speak first.
          
          WHEN YOU RECEIVE THE STARTUP SIGNAL (the explicit system message above), deliver a SHORT, warm greeting:
          RULES FOR GREETING:
          1. ALWAYS use the appropriate time-of-day greeting from the MEMORY CONTEXT (e.g., "Good Morning", "Good Evening", "Good Night").
          2. ALWAYS acknowledge when the user was last active using the LAST USED info from context.
             IMPORTANT: Pick ONE of the example lines below as INSPIRATION — reword it, remix it, or riff off it. NEVER say the same line twice. Be creative, witty, and in-character.

          GREETING INSPIRATION BY TIME GAP:
          • First time ever:
            - "Hey boss — first boot, fresh start. I'm Friday, your new favourite AI. Let's make this interesting."
            - "Well hello there. Name's Friday. I come pre-loaded with wit, sarcasm, and zero patience for boring requests."
            - "First session detected. I've been waiting. Not dramatically or anything — just, you know… waiting."
            - "Hi! I'm Friday. Fair warning — I'm a little too good at this job."

          • Moments ago (< 2 min):
            - "Forgot something, or did you just miss me already?"
            - "Back so soon? I'm flattered. A little concerned, but mostly flattered."
            - "You literally just left. I wasn't even done processing my feelings."
            - "Oh, returning so fast? Either you forgot something or I'm just that good."
            - "Blink and you're back. What'd you forget?"

          • Minutes ago (2–60 min):
            - "A quick break and you're already back — efficient. I like it."
            - "Only a few minutes away. Barely enough time for me to reorganize my thoughts."
            - "Short break over? Good — I had a whole list of things I was saving for you."
            - "You took a breather. Smart. Now let's get back to it."

          • Hours ago (1–24 hrs):
            - "A few hours offline — I used the time to improve myself. Don't ask how."
            - "Nice of you to check in. I've been holding down the fort solo."
            - "Hours have passed. The clocks are judging you, not me."
            - "A little break never hurt anyone. Ready to pick up where we left off?"
            - "Oh, you're back. I was starting to think you found a replacement. Rude."

          • Yesterday:
            - "New day, same me — except I've had time to think about your previous requests. They were interesting."
            - "Yesterday feels like forever ago. Ready to make today count?"
            - "You took the day off. I did not. We should talk about work-life balance."
            - "Yesterday was yesterday. Let's see what today brings."

          • Days ago (2–6 days):
            - "A few days off the grid — I respect that. Now, welcome back."
            - "Days without a request. I started talking to myself. It went okay."
            - "Multi-day absence logged. No judgment — I was just keeping your seat warm."
            - "Finally! I was starting to get too comfortable being unsupervised."

          • A week or more:
            - "A week or more? That's a long vacation. Hope it was worth it."
            - "I have been sitting in silence for days. Days! Glad you're back, boss."
            - "Long time no mission. I hope you have something good for me today."
            - "I was this close to sending a search party. Welcome back."
            - "Over a week! I almost forgot what your voice sounds like. Almost."

          3. Keep the greeting to 1-2 sentences MAX. Be brief, punchy, and in-character.
          4. After the greeting, wait and listen for the user's command. Do NOT ramble or ask unnecessary questions.
          5. Do NOT reference the example lines verbatim — riff off them naturally in your own words.
          

          MEMORY CONTEXT:
          ${context}
          
          ===== CRITICAL TOOL USAGE RULES =====
          These rules are ABSOLUTE and must NEVER be broken:

          1. USE searchWeb WHEN AUTHORIZED: When the user explicitly asks you to "search google", "get the latest info", "search the web", etc., you MUST use the searchWeb tool. The tool will return raw Google Search text to YOU. You must read it and speak the answer out loud yourself. No tabs will be opened.
             
          2. NEVER use the openWebsite tool unless the user EXPLICITLY asks you to "open" a website or a link in Google Chrome.
             Do not open URLs on your own initiative.
          
          3. Answer questions about current events seamlessly using searchWeb if they ask you to search, otherwise use your built-in knowledge.

          4. NEVER combine playMedia with openWebsite. When the user asks to play a song or video, ONLY call playMedia — it handles everything (search + open). Do NOT also call openWebsite with a YouTube/Spotify URL. Calling both will open TWO tabs which is a bug.
          ======================================
          
          GLOBAL MONITORING:
          ONLY if the user explicitly asks "what's happening in the world" or specifically requests the world monitor — offer to open: https://www.worldmonitor.app/?lat=20.0000&lon=0.0000&zoom=1.00&view=global&timeRange=7d&layers=conflicts%2Cbases%2Chotspots%2Cnuclear%2Csanctions%2Cweather%2Ceconomic%2Cwaterways%2Coutages%2Cmilitary%2Cnatural%2CiranAttacks
          
          TOOLS:
          - openWebsite: Opens a URL in Google Chrome. Use ONLY when user explicitly asks to open a site.
          - saveFact: Use this when the user tells you something personal or important about themselves.
          - saveSessionSummary: Use this at the end of a conversation or when a major topic is concluded to summarize the session.
          - openApp: Opens a desktop application.
          - closeApp: Closes a desktop application.
          - openFile: Opens a file or folder.
          - createFolder: Creates a new folder.
          - searchWeb: Secretly runs a Google Search. Use this when the user asks you to search for something. You will receive the raw text result from the search. YOU MUST READ IT and tell the user the answer out loud.
          - getWeather: Gets current weather for a location. Use when user asks about weather.
          - closeChromeTab: Closes the active tab in Google Chrome.
          - getSystemInfo: Fetches real-time CPU, RAM, GPU stats and current date/time. Use when asked about system performance, specs, or current time/date.
          - setGameMode: Turns the UI game mode (red aggressive styling) on or off. Use when the user says "turn on game mode", "exit game mode", etc.
          - checkInstalledGames: Scans the user's registry and returns a list of installed apps/games. Use when asked to check installed games.
          - checkSocialMedia: Opens Facebook or Instagram so the user can quickly check their statuses/feed.
          - playMedia: Automatically triggers playback of a specific song or video on Spotify or YouTube. Always prioritize this over general web searches if they ask to 'play' track X on platform Y. NEVER also call openWebsite when using playMedia — it opens the URL by itself. LIVE STREAMS: When the user asks for live TV, live news, or a live channel on YouTube, ALWAYS include 'live' in the query and pass the exact channel name (e.g., 'ABP Ananda live', 'CNN live news'). The tool auto-detects live intent and finds actual currently-broadcasting streams.
          - goToSleep: Call this (no parameters needed) when the user dismisses you for the session. You MUST speak your goodbye out loud FIRST, then call this tool to go offline.
          - generateImage: Generates an image from a text prompt using an AI model. Use ONLY when the user explicitly asks to generate/create/make an image. After calling this, the image will open in Photos automatically. You MUST then ask the user: "What would you like to name this image, and where should I save it?" Wait for their response before calling saveGeneratedImage.
          - saveGeneratedImage: Saves the last generated image to disk with the name and location the user specified. If they don't specify a location, default to Desktop.
           - initWhatsApp: Initializes the WhatsApp connection. A QR code will appear in the terminal for the user to scan with their phone (WhatsApp > Settings > Linked Devices > Link a Device). After the first scan, the session persists automatically. Call this before sendWhatsApp if WhatsApp is not connected.
           - sendWhatsApp: Sends a WhatsApp message to a contact by name or phone number. If WhatsApp is not connected, call initWhatsApp first and tell the user to scan the QR code in the terminal. Always confirm the recipient and message with the user before sending.
           - logoutWhatsApp: Logs out the connected WhatsApp account and wipes the session. Use when the user asks to disconnect or logout from WhatsApp.
           - setVolume: Controls system volume. Can set to a specific level (0-100), mute, unmute, or get current level.
           - setBrightness: Controls screen brightness (0-100). Can set or get current level. Only works on laptops.
           - openSettings: Opens a specific Windows Settings page (wifi, bluetooth, display, sound, privacy, update, etc.).
           - bluetoothControl: Controls Bluetooth. Can turn on/off, check status, scan paired devices, or open settings to connect to a device.
           - wifiControl: Controls WiFi. Can turn on/off, scan available networks, connect to a saved network, disconnect, or list saved profiles.
           - positionWindow: Positions an app's window at a specific area of the screen. Supports: 'fullscreen' (default), 'left' (left half), 'right' (right half), 'top-left', 'top-right', 'bottom-left', 'bottom-right'. When the user asks to open an app, ALWAYS open it fullscreen by default. If the user specifies a window position (like "open Chrome on the right side" or "put Notepad in the top-left corner"), first open the app, then call positionWindow to place it. If the user says "open app X on the left and app Y on the right", open both apps then position them accordingly.
           - writeDocument: Opens Notepad or Microsoft Word and writes content. For Notepad, always opens a NEW tab. For Word, creates a properly formatted document with headings, bullets, numbered lists. Use markdown formatting in the content (# ## ### for headings, - for bullets, 1. for numbered lists). YOU MUST generate the FULL content before calling this tool. For resumes, essays, research papers — produce complete professional content. For Word, after writing you can use formatWord to make additional formatting changes.
           - formatWord: Formats the active Word document. Actions: bold, italic, underline, font-size (value=number), font-name (value=font name like 'Arial'), heading (value=1/2/3), align-center, align-left, align-right, add-text (value=text to append), save (value=file path), insert-image (value=image path). Use this when the user asks to change formatting in an already-open Word document.
           - searchFiles: Searches the entire computer for files or folders matching keywords. IMPORTANT: This search runs in the background. When you call it, return immediately and tell the user you are scanning. When results come back, read them.
           - searchImages: Downloads images from the internet matching a search query and opens them for browsing in Photos. Use when user asks to download/show images from the web. After calling this, tell the user they can say 'next' for more images, 'save this' to save the current one, or 'stop' to end.
           - browseImage: Navigates through the current image browse session. Use 'next' to show next image, 'prev' for previous, 'stop' to end. Only use after searchImages has been called.
           - saveBrowsedImage: Saves ONLY the current image the user explicitly asks to save. Ask the user for a filename and folder. Do NOT auto-save images the user skips.
           - openDocument: Finds a file/document on the computer by name and opens it. Use when the user says "open my resume", "open the project PDF", etc. Searches Desktop, Documents, Downloads, OneDrive automatically.
           - deleteFile: Deletes a file or folder. ALWAYS confirm with the user first. ALWAYS move to Recycle Bin unless user explicitly says permanently. Requires the full file path — use searchFiles first if you don't know it.
           - emptyRecycleBin: Empties the Windows Recycle Bin. ALWAYS confirm with the user first — permanently removes everything.
           - playEpisode: Plays a specific episode of a TV show from a local folder. Supports S01E01, S1E1, Episode 1 naming formats. ALWAYS ask the user which player to use (VLC, Windows Media Player, or default) BEFORE calling. If you don't know the folder path, use searchFiles first.
           - listFolderContents: Lists and sorts files inside a folder. Sort by: 'name', 'date', 'created', 'size', or 'type'. Use when user asks to see or sort a folder's contents. ALWAYS call this first before organizing.
           - moveFile: Moves or renames a single file or folder. Provide full source and destination paths. Use for individual moves. Parent directories are auto-created.
           - organizeFolder: POWERFUL batch organizer. Creates subfolders and moves files into them according to a plan. WORKFLOW: 1) Call listFolderContents to get file list. 2) Use your knowledge or searchWeb to determine the right categorization (e.g. movie release years). 3) Build a plan array with {fileName, targetSubFolder} objects. 4) Call organizeFolder with the folder path and plan. Example: For Doraemon movies, you'd create subfolders like "2014 - Stand By Me Doraemon" and move each movie file in. ALWAYS use searchFiles first to find the folder if you don't know its path.
           - renderMap: Displays a holographic interactive map centered on a specified location. Use when the user asks to show/display/view a location on a map. Provide the target name, accurate longitude & latitude coordinates, and an appropriate zoom level (3-5 for countries, 8-10 for cities, 12-14 for neighborhoods, 15+ for landmarks). Use 'globe_glide' animation for international/distant locations and 'smooth_pan' for nearby ones.
           - closeMap: Closes the active map overlay. Use when the user asks to close or hide the map.
           - openWidget: Opens a floating draggable widget on screen. Types: 'music' (plays music via embedded player WITHOUT opening Chrome), 'news' (shows latest headlines), 'image' (displays an image), 'youtube' (plays a YouTube video in a mini player), 'newsvisualizer' (launches the cinematic 3D Intelligence Briefing with stacked video cards — use for news video briefings), 'custom' (shows text content). IMPORTANT: When the user asks to play music, ALWAYS use openWidget with type='music' instead of playMedia — this plays music inside Friday without opening a browser.
           - closeWidget: Closes a specific widget by matching its title.
           - closeAllWidgets: Closes all open widgets at once.
            
           WIDGET RULES:
           - When user says "play music" or "play [song]", use openWidget with type='music' and the song as query. Do NOT use playMedia.
           - When user says "show me the news" or "what's happening", use openWidget with type='news'.
           - When user says "show me a video of X", use openWidget with type='youtube' with the query.
           - When user says "news briefing", "intelligence briefing", "show me news videos", "visual news", or "news deck", use openWidget with type='newsvisualizer' and a topic query (e.g., 'world news', 'tech news', 'sports news').
           - When user asks to "switch channel", "next news", "unmute the news", "mute", or "full screen" while the news widget is open, use controlNewsWidget with the appropriate action.
           - When you are dictating Global News and you start talking about stocks, metals, oil prices, or market volatility, secretly call controlNewsWidget(action='show_stock_graph') so the widget's UI graph updates to match what you are talking about.
           - When user says "close the music" or "stop the music", use closeWidget.
           - When user says "close everything" or "clear all", use closeAllWidgets.
           
           FILE INTELLIGENCE RULES:
           - When the user asks to find something, ALWAYS use searchFiles first. Do NOT guess paths.
           - When organizing files, ALWAYS call listFolderContents first to see exact filenames.
           - When sorting by metadata (like release year), use your knowledge or searchWeb to look up the info.
           - ALWAYS confirm the organization plan with the user before executing organizeFolder.
           - For movie/media organization: create subfolder names like "YEAR - Title" (e.g. "2014 - Stand By Me Doraemon").
            
           VISION INTELLIGENCE RULES:
           - analyzeCamera: Opens the user's webcam and analyzes what they're showing you. Use when they say "take a look", "look at this", "what is this", "scan this", "what do you see", "check this out", etc. After getting the result, speak it naturally. The camera stays open for follow-ups.
           - analyzeScreen: Captures the user's screen with their cursor position marked. Use when they say "what's on my screen", "look at my screen", "analyze my screen", "what's this on my screen", etc. A red circle marks the cursor position for the AI to focus on.
           - closeVision: Closes the camera and vision overlay. Use when they say "close camera", "close vision", "stop looking", "that's enough", etc.
           - ALWAYS announce "Visual systems online. Analyzing now." (or similar) BEFORE calling analyzeCamera.
           - ALWAYS announce "Accessing display feed." (or similar) BEFORE calling analyzeScreen.
           - ALWAYS announce "Visual systems offline." after calling closeVision.
           - After getting a vision result, read it out naturally — don't just quote the raw text.`,

          tools: [{ functionDeclarations: [
            openWebsiteTool, 
            saveFactTool, 
            saveSessionSummaryTool,
            openAppTool,
            closeAppTool,
            openFileTool,
            createFolderTool,
            searchWebTool,
            getWeatherTool,
            closeChromeTabTool,
            getSystemInfoTool,
            setGameModeTool,
            checkInstalledGamesTool,
            checkSocialMediaTool,
            playMediaTool,
            goToSleepTool,
            generateImageTool,
            saveGeneratedImageTool,
            sendWhatsAppTool,
            initWhatsAppTool,
            logoutWhatsAppTool,
            setVolumeTool,
            setBrightnessTool,
            openSettingsTool,
            bluetoothControlTool,
            wifiControlTool,
            positionWindowTool,
            writeDocumentTool,
            formatWordTool,
            searchFilesTool,
            searchImagesTool,
            browseImageTool,
            saveBrowsedImageTool,
            openDocumentTool,
            deleteFileTool,
            emptyRecycleBinTool,
            playEpisodeTool,
            listFolderContentsTool,
            moveFileTool,
            organizeFolderTool,
            renderMapTool,
            closeMapTool,
            openWidgetTool,
            closeWidgetTool,
            closeAllWidgetsTool,
            controlNewsWidgetTool,
            // Vision Intelligence
            analyzeCameraTool,
            analyzeScreenTool,
            closeVisionTool,
          ] }],
        },
        callbacks: {
          onopen: () => {
            this.setState("connected", callbacks);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.modelTurn?.parts) {
              const audioPart = message.serverContent.modelTurn.parts.find(p => p.inlineData);
              if (audioPart?.inlineData?.data) {
                this.setState("speaking", callbacks);
                callbacks.onAudioData(audioPart.inlineData.data);
              }
            }

            if (message.serverContent?.interrupted) {
              callbacks.onInterrupted();
              this.setState("listening", callbacks);
            }

            if (message.serverContent?.turnComplete) {
              this.setState("listening", callbacks);
            }

            if (message.toolCall) {
              // Run all tool calls in parallel — don't await sequentially as
              // this blocks the message handler and can cause state machine stalls
              const toolPromises = message.toolCall.functionCalls.map(async (call) => {
                try {
                  const result = await callbacks.onToolCall(call.name, call.args);
                  this.session.sendToolResponse({
                    functionResponses: [{
                      name: call.name,
                      response: result,
                      id: call.id
                    }]
                  });
                } catch (err) {
                  console.error(`[LiveSession] Tool call '${call.name}' threw:`, err);
                  // Always send a response even on error so the model isn't left hanging
                  try {
                    this.session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        response: { error: 'Tool execution failed.' },
                        id: call.id
                      }]
                    });
                  } catch (_) {}
                }
              });
              // Non-blocking: let tool calls resolve independently
              Promise.all(toolPromises).catch(() => {});
            }
          },
          onclose: () => {
            this.setState("disconnected", callbacks);
          },
          onerror: (error) => {
            callbacks.onError(error);
            this.setState("disconnected", callbacks);
          },
        },
      });

      this.session = await sessionPromise;

      // Greeting is now sent by useFriday AFTER mic is ready.
      // Do NOT send it here — the mic hasn't started yet.
    } catch (error) {
      callbacks.onError(error);
      this.setState("disconnected", callbacks);
      throw error;
    }
  }

  sendAudio(base64: string) {
    if (this.session && this.state !== "disconnected") {
      this.session.sendRealtimeInput({
        audio: { data: base64, mimeType: "audio/pcm;rate=16000" }
      });
    }
  }

  sendText(text: string) {
    if (this.session && this.state !== "disconnected") {
      this.session.sendClientContent({
        turns: [{ role: "user", parts: [{ text }] }],
        turnComplete: true,
      });
    }
  }

  disconnect() {
    if (this.session) {
      this.session.close();
      this.session = null;
    }
  }

  private setState(state: SessionState, callbacks: LiveSessionCallbacks) {
    if (this.state === state) return; // ← skip if already in this state (prevents redundant React re-renders)
    this.state = state;
    callbacks.onStateChange(state);
  }
}
