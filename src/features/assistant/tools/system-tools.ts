import { type FunctionDeclaration, Type } from "@google/genai";

export const getSystemInfoTool: FunctionDeclaration = {
  name: "getSystemInfo",
  description: "Gets real-time system information including CPU model, CPU usage percentage, RAM total/used/free (in GB), RAM usage percentage, GPU name, and the current date and time. Use this whenever the user asks about system performance, hardware specs, CPU, RAM, GPU, memory, or what time/date it is.",
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
