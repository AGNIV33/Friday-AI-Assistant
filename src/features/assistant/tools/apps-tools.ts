import { type FunctionDeclaration, Type } from "@google/genai";

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
