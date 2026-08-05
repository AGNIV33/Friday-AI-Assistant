import type { ToolRegistry } from "./types";

export const appsHandlers: ToolRegistry = {
  openApp: {
    requiresElectron: true,
    handler: async ({ args, electronAPI }) => {
      const res = await electronAPI!.openApp(args.appName);
      return res.success ? { success: true } : { error: res.error };
    },
  },

  closeApp: {
    requiresElectron: true,
    handler: async ({ args, electronAPI }) => {
      const res = await electronAPI!.closeApp(args.appName);
      return res.success ? { success: true } : { error: res.error };
    },
  },

  setGameMode: {
    // Deliberately NOT requiresElectron: this is a pure UI state toggle that
    // never touches electronAPI. It only sat inside the old electron-only
    // if-block because of how that chain was nested.
    handler: ({ args, setIsGameMode }) => {
      setIsGameMode(args.enabled);
      if (args.enabled) {
        return {
          success: true,
          message: `Game mode activated successfully. SYSTEM OVERRIDE: You are now operating at FULL POTENTIAL. Drop your standard tone. Be hyper-focused, tactical, intense, and use hardcore gamer terminology. You are now the ultimate gaming assistant. Check the user's installed games if they haven't explicitly started one yet.`
        };
      } else {
        return {
          success: true,
          message: "Game mode deactivated. Return to your normal flirtatious, witty, relaxed Friday persona."
        };
      }
    },
  },

  getSystemInfo: {
    requiresElectron: true,
    handler: async ({ electronAPI }) => {
      const res = await electronAPI!.getSystemInfo();
      if (res.success) {
        return {
          success: true,
          cpu_model: res.cpu?.model,
          cpu_cores: res.cpu?.cores,
          cpu_usage_percent: res.cpu?.usagePercent,
          ram_total_gb: res.ram?.totalGB,
          ram_used_gb: res.ram?.usedGB,
          ram_free_gb: res.ram?.freeGB,
          ram_usage_percent: res.ram?.usagePercent,
          gpu_name: res.gpu?.name,
          current_date: res.dateTime?.date,
          current_time: res.dateTime?.time,
          timezone: res.dateTime?.timezone,
          platform: res.platform,
          hostname: res.hostname,
          arch: res.arch,
        };
      }
      return { error: res.error || "Failed to get system info." };
    },
  },

  checkInstalledGames: {
    requiresElectron: true,
    handler: async ({ electronAPI }) => {
      const res = await electronAPI!.getInstalledApps();
      if (res.success && res.games) {
        return {
          success: true,
          totalFound: res.games.length,
          breakdown: res.breakdown,
          games: res.games.slice(0, 100) // return up to 100 for context limit
        };
      }
      return { error: res.error || "Failed to check games." };
    },
  },

  positionWindow: {
    requiresElectron: true,
    handler: async ({ args, electronAPI }) => {
      const res = await electronAPI!.positionWindow(args.appName, args.position || 'fullscreen');
      if (res.success) {
        return { success: true, message: res.message };
      }
      return { error: res.error || 'Failed to position window.' };
    },
  },
};
