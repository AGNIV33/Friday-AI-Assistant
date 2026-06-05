// ─── Vision Tool Declarations ─────────────────────────────────────────────────
// Gemini Live API tool declarations for the vision module.
// These follow the exact same FunctionDeclaration pattern as all existing tools.

import { type FunctionDeclaration, Type } from "@google/genai";

export const analyzeCameraTool: FunctionDeclaration = {
  name: "analyzeCamera",
  description: `Opens the camera and analyzes what the user is showing or pointing at using AI vision. Use this when the user says things like: "take a look", "look at this", "what is this", "scan this", "analyze this", "what do you see", "have a look", "what's in front", "see this", "check this out". The camera will open, capture a frame, and the vision AI will describe what it sees. The camera stays open after analysis for follow-up questions.`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      userPrompt: {
        type: Type.STRING,
        description: "What the user said or asked about what they're showing. Pass the user's exact words or a summary of their request.",
      },
    },
    required: ["userPrompt"],
  },
};

export const analyzeScreenTool: FunctionDeclaration = {
  name: "analyzeScreen",
  description: `Captures the user's screen and analyzes what they're looking at, including where their cursor is pointing. A red circle will be drawn on the screenshot at the cursor position to help the vision AI focus. Use this when the user says things like: "what's on my screen", "what's this on my screen", "look at my screen", "what am I looking at", "analyze my screen", "what's here", "what is this on screen".`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      userPrompt: {
        type: Type.STRING,
        description: "What the user asked about their screen. Pass the user's exact words.",
      },
    },
    required: ["userPrompt"],
  },
};

export const closeVisionTool: FunctionDeclaration = {
  name: "closeVision",
  description: `Closes the vision camera and analysis overlay. Use when the user says: "close camera", "close vision", "stop looking", "that's enough", or wants to dismiss the vision interface.`,
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};
