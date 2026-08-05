import type { ToolRegistry } from "./types";

export const documentsHandlers: ToolRegistry = {
  writeDocument: {
    requiresElectron: true,
    handler: async ({ args, electronAPI, setProgressTask }) => {
      const appLabel = args.target === 'word' ? 'Microsoft Word' : 'Notepad';
      setProgressTask({ active: true, label: `Writing to ${appLabel}…`, type: 'write' });
      const res = await electronAPI!.writeDocument(args.target, args.content, args.title);
      setProgressTask(null);
      if (res.success) {
        return { success: true, message: res.message };
      }
      return { error: res.error || 'Failed to write document.' };
    },
  },

  formatWord: {
    requiresElectron: true,
    handler: async ({ args, electronAPI }) => {
      const res = await electronAPI!.formatWord(args.action, args.value);
      if (res.success) {
        return { success: true, result: res.result };
      }
      return { error: res.error || 'Failed to format Word document.' };
    },
  },
};
