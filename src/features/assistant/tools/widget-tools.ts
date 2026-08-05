import { type FunctionDeclaration, Type } from "@google/genai";

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
