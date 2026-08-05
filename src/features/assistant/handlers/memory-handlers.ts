import { memoryService } from "@/services/firebase";
import type { ToolRegistry } from "./types";

export const memoryHandlers: ToolRegistry = {
  saveFact: {
    handler: async ({ args, uid }) => {
      await memoryService.saveFact(uid, args.fact);
      return { success: true, message: "Fact saved to memory." };
    },
  },

  saveSessionSummary: {
    handler: async ({ args, uid, electronAPI }) => {
      await memoryService.saveSummary(uid, args.summary);
      // Also record it on the local session so the on-disk index gets a real
      // summary instead of the "Session ended by user disconnect." placeholder
      // that every past session was stamped with.
      try {
        electronAPI?.cacheSetSessionSummary?.(args.summary, args.topics || []);
      } catch (_) {}
      return { success: true, message: "Session summary saved." };
    },
  },
};
