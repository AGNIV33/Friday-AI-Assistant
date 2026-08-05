import { type FunctionDeclaration, Type } from "@google/genai";

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
