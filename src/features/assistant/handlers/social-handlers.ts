import type { ToolRegistry } from "./types";

export const socialHandlers: ToolRegistry = {
  checkSocialMedia: {
    requiresElectron: true,
    handler: async ({ args, electronAPI }) => {
      const res = await electronAPI!.checkSocial(args.platform);
      return res.success ? { success: true, message: `Opened ${args.platform} status feed.` } : { error: res.error };
    },
  },
};
