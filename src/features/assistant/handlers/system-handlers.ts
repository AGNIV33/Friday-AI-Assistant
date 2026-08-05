import type { ToolRegistry } from "./types";

export const systemHandlers: ToolRegistry = {
  setVolume: {
    requiresElectron: true,
    handler: async ({ args, electronAPI }) => {
      const res = await electronAPI!.systemVolume(args.action, args.level);
      if (res.success) {
        return { success: true, result: res.result };
      }
      return { error: res.error || 'Failed to control volume.' };
    },
  },

  setBrightness: {
    requiresElectron: true,
    handler: async ({ args, electronAPI }) => {
      const res = await electronAPI!.systemBrightness(args.action, args.level);
      if (res.success) {
        return { success: true, result: res.result };
      }
      return { error: res.error || 'Failed to control brightness.' };
    },
  },

  openSettings: {
    requiresElectron: true,
    handler: async ({ args, electronAPI }) => {
      const res = await electronAPI!.openSettings(args.page);
      if (res.success) {
        return { success: true, message: res.message };
      }
      return { error: res.error || 'Failed to open settings.' };
    },
  },

  bluetoothControl: {
    requiresElectron: true,
    handler: async ({ args, electronAPI }) => {
      const res = await electronAPI!.bluetoothControl(args.action, args.deviceName);
      if (res.success) {
        return { success: true, result: res.result, message: res.message };
      }
      return { error: res.error || 'Failed to control Bluetooth.' };
    },
  },

  wifiControl: {
    requiresElectron: true,
    handler: async ({ args, electronAPI }) => {
      const res = await electronAPI!.wifiControl(args.action, args.networkName);
      if (res.success) {
        return { success: true, result: res.result, message: res.message };
      }
      return { error: res.error || 'Failed to control WiFi.' };
    },
  },
};
