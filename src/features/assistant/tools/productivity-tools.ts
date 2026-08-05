import { type FunctionDeclaration, Type } from "@google/genai";

// ─── Clipboard ───────────────────────────────────────────────────────────────

export const clipboardHistoryTool: FunctionDeclaration = {
  name: "clipboardHistory",
  description: "Shows what the user recently copied to their clipboard. Use when they ask 'what did I copy?', 'show my clipboard history', or 'what was that thing I copied earlier'.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      limit: { type: Type.NUMBER, description: "How many recent entries to show (default 10, max 25)." },
    },
  },
};

export const clipboardSearchTool: FunctionDeclaration = {
  name: "clipboardSearch",
  description: "Searches the user's clipboard history for something they copied earlier. Use when they say 'find that link I copied', 'what was that address I copied', etc.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: "Words to look for in previously copied text." },
    },
    required: ["query"],
  },
};

export const clipboardRestoreTool: FunctionDeclaration = {
  name: "clipboardRestore",
  description: "Copies an older clipboard entry back to the clipboard so the user can paste it. Use after clipboardHistory or clipboardSearch, passing the position number shown in those results.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      index: { type: Type.NUMBER, description: "The position number of the entry, as listed in the history or search results." },
    },
    required: ["index"],
  },
};

// ─── Notes ───────────────────────────────────────────────────────────────────

export const addNoteTool: FunctionDeclaration = {
  name: "addNote",
  description: "Writes down a note for the user. Use when they say 'note that...', 'write this down', 'make a note', 'remember this for later'. These are things they explicitly want recorded, different from saveFact which stores facts about them personally.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "A short title for the note." },
      body: { type: Type.STRING, description: "The full note content." },
      tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Optional keywords to make it easier to find later." },
    },
    required: ["body"],
  },
};

export const searchNotesTool: FunctionDeclaration = {
  name: "searchNotes",
  description: "Searches the user's saved notes. Use when they ask 'what did I note about X', 'find my note on...', 'do I have anything written about...'.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: "What to search for." },
    },
    required: ["query"],
  },
};

export const listNotesTool: FunctionDeclaration = {
  name: "listNotes",
  description: "Lists the user's most recent notes. Use for 'what notes do I have', 'show my notes'.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      limit: { type: Type.NUMBER, description: "How many to list (default 10)." },
    },
  },
};

export const deleteNoteTool: FunctionDeclaration = {
  name: "deleteNote",
  description: "Deletes a note by title. Confirm with the user before calling this.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: "The note title (or part of it) to delete." },
    },
    required: ["query"],
  },
};

// ─── Routines (macros) ───────────────────────────────────────────────────────

export const saveRoutineTool: FunctionDeclaration = {
  name: "saveRoutine",
  description: `Saves a named sequence of actions the user can trigger later with one phrase. Use when they say "save this as my morning routine", "make a routine that opens Chrome and Spotify", etc. You build the steps yourself from the tools you already have. Example steps: [{tool:"openApp", args:{appName:"Chrome"}}, {tool:"openWidget", args:{widgetType:"music", title:"Now Playing", query:"lofi"}}]. Confirm the steps with the user before saving.`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "What the user will call this routine, e.g. 'morning setup'." },
      steps: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            tool: { type: Type.STRING, description: "Exact name of the tool to run, e.g. 'openApp'." },
            args: { type: Type.OBJECT, description: "The arguments object for that tool.", properties: {} },
          },
          required: ["tool"],
        },
        description: "Ordered list of tool calls to run. Maximum 15.",
      },
    },
    required: ["name", "steps"],
  },
};

export const runRoutineTool: FunctionDeclaration = {
  name: "runRoutine",
  description: "Runs a saved routine by name. Use when the user says 'do my morning setup', 'run my gaming routine', etc. Tell them what you're doing first, then call this.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "Name of the routine to run — partial matches work." },
    },
    required: ["name"],
  },
};

export const listRoutinesTool: FunctionDeclaration = {
  name: "listRoutines",
  description: "Lists the routines the user has saved. Use for 'what routines do I have'.",
  parameters: { type: Type.OBJECT, properties: {} },
};

export const deleteRoutineTool: FunctionDeclaration = {
  name: "deleteRoutine",
  description: "Deletes a saved routine by name. Confirm before calling.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "Name of the routine to delete." },
    },
    required: ["name"],
  },
};

// ─── Documents ───────────────────────────────────────────────────────────────

export const readDocumentTool: FunctionDeclaration = {
  name: "readDocument",
  description: "Reads the text out of a document so you can summarize or answer questions about it. Works with plain text and code files directly, and with PDF, DOCX, DOC and RTF via Microsoft Word. Use when the user says 'summarize this PDF', 'what does this document say', 'read my report and tell me the key points'. You need the full file path — use searchFiles or openDocument first if you don't have it.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      filePath: { type: Type.STRING, description: "Full path to the document." },
    },
    required: ["filePath"],
  },
};

// ─── Research ────────────────────────────────────────────────────────────────

export const researchTopicTool: FunctionDeclaration = {
  name: "researchTopic",
  description: `Researches a topic on the web and returns findings WITH their source links, so you can cite where each claim came from. Use when the user asks you to "research X", "look into X and tell me about it", or wants sourced information rather than a quick answer. This runs in the background — tell the user you've started, and read the findings out when they arrive. If they want it written up as a document afterwards, use writeDocument.`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      topic: { type: Type.STRING, description: "The subject to research." },
      writeReport: { type: Type.BOOLEAN, description: "Set true if the user asked for the results written into a document (Word). Default false — just speak the findings." },
    },
    required: ["topic"],
  },
};

// ─── People ──────────────────────────────────────────────────────────────────

export const rememberPersonTool: FunctionDeclaration = {
  name: "rememberPerson",
  description: "Remembers who someone is — their relationship to the user and details about them. Use whenever the user mentions a person meaningfully: 'my sister Priya works in Bangalore', 'my boss Dave hates morning meetings'. Prefer this over saveFact for anything about a specific person, because it can be looked up by name later.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "The person's name." },
      relationship: { type: Type.STRING, description: "How they relate to the user, e.g. 'sister', 'manager', 'friend from college'." },
      details: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Facts about them — one per entry. Only new information; existing details are kept automatically." },
    },
    required: ["name"],
  },
};

export const recallPeopleTool: FunctionDeclaration = {
  name: "recallPeople",
  description: "Looks up what you know about the people in the user's life. Use when they ask 'who is X', 'what do you know about my sister', 'who do you remember', or when a name comes up and you need context about them.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "Optional — a specific person to look up. Omit to list everyone you know about." },
    },
  },
};

// ─── Tone ────────────────────────────────────────────────────────────────────

export const setToneTool: FunctionDeclaration = {
  name: "setTone",
  description: `Shifts your delivery and the interface mood to match the situation. Call this yourself when the emotional register of the conversation changes — do NOT wait to be asked. Use 'urgent' when something is wrong, time-critical, or the user sounds stressed. Use 'calm' for winding down, late-night chats, or when reassuring them. Use 'neutral' to return to normal. The orb and accent colour shift to match.`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      tone: { type: Type.STRING, description: "One of: 'urgent', 'calm', 'neutral'." },
    },
    required: ["tone"],
  },
};
