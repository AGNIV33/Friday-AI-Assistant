import { type FunctionDeclaration, Type } from "@google/genai";

export const openFileTool: FunctionDeclaration = {
  name: "openFile",
  description: "Opens a file or folder at the specified path.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      filePath: { type: Type.STRING, description: "The full path to the file or folder." },
    },
    required: ["filePath"],
  },
};

export const createFolderTool: FunctionDeclaration = {
  name: "createFolder",
  description: "Creates a new folder at the specified path.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      folderName: { type: Type.STRING, description: "The name of the new folder." },
      folderPath: { type: Type.STRING, description: "The directory where the folder should be created (optional, defaults to Desktop)." },
    },
    required: ["folderName"],
  },
};

export const searchFilesTool: FunctionDeclaration = {
  name: "searchFiles",
  description: "Searches the user's computer for files or folders matching a query. Uses smart keyword matching across all common user directories and drives. Use this when the user asks to find, locate, or search for a file or folder. Returns paths and details of matching items. You can then offer to open the result.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: "What to search for. Can be multiple keywords (e.g., 'doraemon movies' or 'project report pdf').",
      },
      searchIn: {
        type: Type.STRING,
        description: "Optional: specific directory path to search in. If not provided, searches common folders and all drives.",
      },
      type: {
        type: Type.STRING,
        description: "What to search for: 'file', 'folder', or 'all' (default).",
      },
    },
    required: ["query"],
  },
};

export const searchImagesTool: FunctionDeclaration = {
  name: "searchImages",
  description: "Searches the internet for images matching a query, downloads them, and opens the first one in the Photos app for the user to browse. Use this when the user asks to download, find, or show images from the internet. After calling this, images will be shown one at a time. The user can say 'next' to see the next image, 'save this' to save the current one, or 'stop' to end browsing.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: "What images to search for (e.g., 'sports cars', 'sunset wallpaper', 'cute puppies').",
      },
      count: {
        type: Type.NUMBER,
        description: "How many images to download (default 15, max 30).",
      },
    },
    required: ["query"],
  },
};

export const browseImageTool: FunctionDeclaration = {
  name: "browseImage",
  description: "Navigates through images in the current image browse session. Use 'next' to show the next image, 'prev' for previous, or 'stop' to end the browsing session and close Photos. An image search session must be active (started with searchImages).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      direction: {
        type: Type.STRING,
        description: "Navigation direction: 'next', 'prev', or 'stop'.",
      },
    },
    required: ["direction"],
  },
};

export const saveBrowsedImageTool: FunctionDeclaration = {
  name: "saveBrowsedImage",
  description: "Saves the currently displayed image from the browse session to a specific location. Only saves the image the user explicitly asks to save — do NOT save images the user skips. Ask the user what name and where to save it.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      fileName: {
        type: Type.STRING,
        description: "The filename to save the image as (e.g., 'red_ferrari'). Extension is added automatically.",
      },
      savePath: {
        type: Type.STRING,
        description: "The directory path to save the image to. Defaults to Desktop if not specified.",
      },
    },
    required: ["fileName"],
  },
};

export const openDocumentTool: FunctionDeclaration = {
  name: "openDocument",
  description: "Searches the computer for a file or document by name (PDF, Word, Excel, text file, etc.) and opens it. Use when the user says 'open [filename]', 'find and open [document name]', or 'open my [name] file'.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: {
        type: Type.STRING,
        description: "The file name or partial name to search for (e.g., 'resume', 'project report', 'notes.txt').",
      },
      searchIn: {
        type: Type.STRING,
        description: "Optional. Specific folder path to search in. Leave blank to search all common locations.",
      },
    },
    required: ["name"],
  },
};

export const deleteFileTool: FunctionDeclaration = {
  name: "deleteFile",
  description: "Deletes a file or folder. Can move to Recycle Bin (safe, recoverable) or delete permanently (IRREVERSIBLE). ALWAYS confirm with the user before deleting. Always prefer Recycle Bin unless the user explicitly says 'permanently' or 'forever'.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      filePath: {
        type: Type.STRING,
        description: "The full path of the file or folder to delete.",
      },
      permanently: {
        type: Type.BOOLEAN,
        description: "If true, permanently delete (no recovery). If false or omitted, move to Recycle Bin.",
      },
    },
    required: ["filePath"],
  },
};

export const emptyRecycleBinTool: FunctionDeclaration = {
  name: "emptyRecycleBin",
  description: "Empties the Windows Recycle Bin, permanently removing all items in it. ALWAYS confirm with the user first — this cannot be undone.",
  parameters: { type: Type.OBJECT, properties: {}, required: [] },
};

export const listFolderContentsTool: FunctionDeclaration = {
  name: "listFolderContents",
  description: "Lists and sorts the files and subfolders inside a specific folder. Use when the user wants to see what's in a folder or sort its contents. Sort options: 'name' (alphabetical), 'date' (most recently modified first), 'created' (newest first by creation time), 'size' (largest first), 'type' (folders first, then by extension).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      folderPath: {
        type: Type.STRING,
        description: "Full path to the folder (e.g. 'D:\\Movies\\Inception').",
      },
      sortBy: {
        type: Type.STRING,
        description: "How to sort: 'name', 'date', 'created', 'size', or 'type'. Default is 'name'.",
      },
    },
    required: ["folderPath"],
  },
};

export const moveFileTool: FunctionDeclaration = {
  name: "moveFile",
  description: "Moves or renames a file or folder from one path to another. Use this when the user wants to move a file to a different folder, rename a file, or reorganize files one at a time. For batch organizing multiple files, prefer organizeFolder instead.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      sourcePath: {
        type: Type.STRING,
        description: "The full path of the file or folder to move.",
      },
      destPath: {
        type: Type.STRING,
        description: "The full destination path including filename.",
      },
    },
    required: ["sourcePath", "destPath"],
  },
};

export const organizeFolderTool: FunctionDeclaration = {
  name: "organizeFolder",
  description: "Batch-organizes files inside a folder by creating subfolders and moving files into them. WORKFLOW: 1) First call listFolderContents to see files. 2) Determine organization scheme (by year, type, category). Use your knowledge or searchWeb for info like release years. 3) Build a plan array mapping each file to its target subfolder. 4) Call this tool. Example plan for movies by year: [{fileName:'Stand By Me Doraemon.mkv', targetSubFolder:'2014 - Stand By Me Doraemon'}]",
  parameters: {
    type: Type.OBJECT,
    properties: {
      folderPath: {
        type: Type.STRING,
        description: "Full path to the parent folder containing files to organize.",
      },
      plan: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            fileName: { type: Type.STRING, description: "Exact filename to move (must match)." },
            targetSubFolder: { type: Type.STRING, description: "Subfolder name to create and move file into." },
          },
          required: ["fileName", "targetSubFolder"],
        },
        description: "Array of move instructions mapping each file to its target subfolder.",
      },
    },
    required: ["folderPath", "plan"],
  },
};
