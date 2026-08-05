import type { ToolRegistry } from "./types";

export const whatsappHandlers: ToolRegistry = {
  initWhatsApp: {
    requiresElectron: true,
    handler: async ({ electronAPI, addToast }) => {
      const res = await electronAPI!.whatsappInit();
      if (res.success) {
        if (res.status === 'connected') {
          addToast?.("WhatsApp connected successfully", "success");
        }
        return { success: true, status: res.status, message: res.message || 'WhatsApp initializing. If a QR code appeared in the terminal, tell the user to scan it with WhatsApp.' };
      }
      return { error: res.error || 'Failed to initialize WhatsApp.' };
    },
  },

  sendWhatsApp: {
    requiresElectron: true,
    handler: async ({ args, electronAPI }) => {
      // First check if WhatsApp is connected
      const statusRes = await electronAPI!.whatsappStatus();
      if (statusRes.status !== 'connected') {
        return { error: 'WhatsApp is not connected. Please call initWhatsApp first and ask the user to scan the QR code in the terminal.' };
      }
      const res = await electronAPI!.whatsappSend(args.contactNameOrNumber, args.message);
      if (res.success) {
        return { success: true, message: res.message };
      }
      return { error: res.error, suggestions: res.suggestions };
    },
  },

  logoutWhatsApp: {
    requiresElectron: true,
    handler: async ({ electronAPI, addToast }) => {
      const res = await electronAPI!.whatsappLogout();
      if (res.success) {
        addToast?.("WhatsApp disconnected", "info");
        return { success: true, message: res.message };
      }
      return { error: res.error || 'Failed to logout from WhatsApp.' };
    },
  },
};
