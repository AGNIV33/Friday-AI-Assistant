import type { ToolRegistry } from "./types";

export const visionHandlers: ToolRegistry = {
  analyzeCamera: {
    handler: async ({ args, vision }) => {
      try {
        const result = await vision.triggerCameraAnalysis(args.userPrompt || '');
        return { success: true, description: result, message: `Vision analysis complete. Here is what I see: ${result}. Read this result naturally to the user.` };
      } catch (err: any) {
        return { error: `Camera analysis failed: ${err.message}` };
      }
    },
  },

  analyzeScreen: {
    handler: async ({ args, vision }) => {
      try {
        const result = await vision.triggerScreenAnalysis(args.userPrompt || '');
        return { success: true, description: result, message: `Screen analysis complete. Here is what I see: ${result}. Read this result naturally to the user.` };
      } catch (err: any) {
        return { error: `Screen analysis failed: ${err.message}` };
      }
    },
  },

  closeVision: {
    handler: ({ vision }) => {
      vision.closeVision();
      return { success: true, message: "Visual systems have been shut down." };
    },
  },
};
