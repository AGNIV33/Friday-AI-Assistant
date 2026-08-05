import type { ToolRegistry } from "./types";

export const filesHandlers: ToolRegistry = {
  openFile: {
    requiresElectron: true,
    handler: async ({ args, electronAPI }) => {
      const res = await electronAPI!.openFile(args.filePath);
      return res.success ? { success: true } : { error: res.error };
    },
  },

  createFolder: {
    requiresElectron: true,
    handler: async ({ args, electronAPI }) => {
      const res = await electronAPI!.createFolder(args.folderName, args.folderPath);
      return res.success ? { success: true, path: res.path } : { error: res.error };
    },
  },

  searchFiles: {
    requiresElectron: true,
    handler: ({ args, electronAPI, setProgressTask, sendText }) => {
      // ── Non-blocking: return immediately, inject results when done ──
      const query = args.query || '';
      setProgressTask({ active: true, label: `Scanning system for "${query}"…`, type: 'search' });
      // Fire search in background — do NOT await here
      electronAPI!.searchFiles(query, args.searchIn, args.type).then((res: any) => {
        setProgressTask(null);
        let followUp = '';
        if (res.success && res.results?.length > 0) {
          const summary = res.results.slice(0, 10).map((r: any, i: number) =>
            `${i + 1}. ${r.Name} (${r.IsDir ? 'Folder' : 'File'}) — ${r.Path}`
          ).join('\n');
          followUp = `[BACKGROUND SEARCH COMPLETE] File search for "${query}" finished. Found ${res.results.length} result(s):\n${summary}\nRead the results naturally to the user and offer to open the best match.`;
        } else {
          followUp = `[BACKGROUND SEARCH COMPLETE] File search for "${query}" finished. No matching files or folders were found. Inform the user politely.`;
        }
        sendText(followUp);
      }).catch(() => {
        setProgressTask(null);
        sendText(`[BACKGROUND SEARCH COMPLETE] The file search for "${query}" encountered an error. Inform the user.`);
      });
      // Return immediately so the model can speak right away
      return {
        success: true,
        status: 'searching_in_background',
        message: `File search started in the background for "${query}". This may take up to a minute. Immediately tell the user something like: "I'm on it boss! I've started scanning your entire system for ${query}. I'll report back the moment I find something — in the meantime, what else can I help you with?" Then listen for their next command.`
      };
    },
  },

  searchImages: {
    requiresElectron: true,
    handler: async ({ args, electronAPI, setProgressTask }) => {
      const q = args.query || '';
      setProgressTask({ active: true, label: `Fetching "${q}" images…`, type: 'search' });
      const res = await electronAPI!.searchImages(q, args.count);
      setProgressTask(null);
      if (res.success) {
        return { success: true, message: res.message, totalImages: res.totalImages };
      }
      return { error: res.error || 'Image search failed.' };
    },
  },

  browseImage: {
    requiresElectron: true,
    handler: async ({ args, electronAPI }) => {
      const res = await electronAPI!.browseImage(args.direction);
      if (res.success) {
        return { success: true, message: res.message };
      }
      return { error: res.error || 'Failed to browse images.' };
    },
  },

  saveBrowsedImage: {
    requiresElectron: true,
    handler: async ({ args, electronAPI }) => {
      const res = await electronAPI!.saveBrowsedImage(args.fileName, args.savePath);
      if (res.success) {
        return { success: true, message: res.message, savedPath: res.savedPath };
      }
      return { error: res.error || 'Failed to save image.' };
    },
  },

  openDocument: {
    requiresElectron: true,
    handler: async ({ args, electronAPI, setProgressTask }) => {
      setProgressTask({ active: true, label: `Finding "${args.name}"…`, type: 'search' });
      const res = await electronAPI!.openDocument(args.name, args.searchIn);
      setProgressTask(null);
      if (res.success) return { success: true, message: res.message };
      return { error: res.error || 'Could not find document.' };
    },
  },

  deleteFile: {
    requiresElectron: true,
    handler: async ({ args, electronAPI, setProgressTask }) => {
      setProgressTask({ active: true, label: `Deleting file…`, type: 'general' });
      const res = await electronAPI!.deleteFile(args.filePath, args.permanently);
      setProgressTask(null);
      if (res.success) return { success: true, message: res.message };
      return { error: res.error || 'Failed to delete file.' };
    },
  },

  emptyRecycleBin: {
    requiresElectron: true,
    handler: async ({ electronAPI, setProgressTask }) => {
      setProgressTask({ active: true, label: `Emptying Recycle Bin…`, type: 'general' });
      const res = await electronAPI!.emptyRecycleBin();
      setProgressTask(null);
      if (res.success) return { success: true, message: res.message };
      return { error: res.error || 'Failed to empty recycle bin.' };
    },
  },

  listFolderContents: {
    requiresElectron: true,
    handler: async ({ args, electronAPI, setProgressTask }) => {
      setProgressTask({ active: true, label: `Listing folder…`, type: 'search' });
      const res = await electronAPI!.listFolderContents(args.folderPath, args.sortBy);
      setProgressTask(null);
      if (res.success) {
        // Summarize if it's too long
        const items = res.items || [];
        const summary = items.slice(0, 50).map((i: any) =>
          `- ${i.Name} (${i.IsDir ? 'Folder' : i.Ext || 'File'})`
        ).join('\n');
        return { success: true, message: res.message, items: summary };
      }
      return { error: res.error || 'Failed to list folder.' };
    },
  },

  moveFile: {
    requiresElectron: true,
    handler: async ({ args, electronAPI, setProgressTask }) => {
      setProgressTask({ active: true, label: `Moving file…`, type: 'general' });
      const res = await electronAPI!.moveFile(args.sourcePath, args.destPath);
      setProgressTask(null);
      if (res.success) return { success: true, message: res.message };
      return { error: res.error || 'Failed to move file.' };
    },
  },

  organizeFolder: {
    requiresElectron: true,
    handler: async ({ args, electronAPI, setProgressTask }) => {
      const planCount = args.plan?.length || 0;
      setProgressTask({ active: true, label: `Organizing ${planCount} files…`, type: 'general' });
      const res = await electronAPI!.organizeFolder(args.folderPath, args.plan);
      setProgressTask(null);
      if (res.success) {
        return {
          success: true,
          message: res.message,
          totalMoved: res.totalMoved,
          totalFailed: res.totalFailed,
          results: res.results,
        };
      }
      return { error: res.error || 'Failed to organize folder.' };
    },
  },
};
