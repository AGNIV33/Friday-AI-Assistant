import type { ToolRegistry } from "./types";
import { markMediaOpened } from "./shared-state";

export const mediaHandlers: ToolRegistry = {
  playMedia: {
    requiresElectron: true,
    handler: async ({ args, electronAPI }) => {
      const res = await electronAPI!.playMedia(args.platform, args.query);
      if (res.success) {
        markMediaOpened(); // Mark timestamp to block duplicate openWebsite calls
      }
      return res.success ? { success: true, message: `Automated playback for ${args.query} on ${args.platform}.` } : { error: res.error };
    },
  },

  generateImage: {
    requiresElectron: true,
    handler: async ({ args, electronAPI, setIsGeneratingImage, setProgressTask }) => {
      setIsGeneratingImage(true);
      setProgressTask({ active: true, label: 'Generating image…', type: 'generate' });
      try {
        const res = await electronAPI!.generateImage(args.prompt);
        setIsGeneratingImage(false);
        setProgressTask(null);
        if (res.success) {
          return { success: true, message: `Image generated successfully and opened in the Photos app. The image is currently showing on screen. Now ask the user what they'd like to name it and where to save it.` };
        }
        return { error: res.error || "Image generation failed." };
      } catch (err: any) {
        setIsGeneratingImage(false);
        setProgressTask(null);
        return { error: err.message || "Image generation failed." };
      }
    },
  },

  saveGeneratedImage: {
    requiresElectron: true,
    handler: async ({ args, electronAPI }) => {
      const res = await electronAPI!.saveGeneratedImage(args.fileName, args.savePath || "");
      if (res.success) {
        return { success: true, message: `Image saved successfully to: ${res.savedPath}` };
      }
      return { error: res.error || "Failed to save image." };
    },
  },

  playEpisode: {
    requiresElectron: true,
    handler: async ({ args, electronAPI, setProgressTask }) => {
      setProgressTask({ active: true, label: `Searching for S${args.season}E${args.episode}…`, type: 'search' });
      const res = await electronAPI!.findAndPlayEpisode(args.folderPath, args.season, args.episode, args.player);
      setProgressTask(null);
      if (res.success) return { success: true, message: res.message };
      return { error: res.error || 'Failed to find/play episode.' };
    },
  },
};
