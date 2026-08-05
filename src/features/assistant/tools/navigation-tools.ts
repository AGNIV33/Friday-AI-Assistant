import { type FunctionDeclaration, Type } from "@google/genai";

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

export const closeChromeTabTool: FunctionDeclaration = {
  name: "closeChromeTab",
  description: "Closes the active tab in Google Chrome.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
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
