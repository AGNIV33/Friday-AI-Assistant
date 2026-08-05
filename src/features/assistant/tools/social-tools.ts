import { type FunctionDeclaration, Type } from "@google/genai";

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
