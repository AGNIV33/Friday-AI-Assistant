import { type FunctionDeclaration, Type } from "@google/genai";

export const writeDocumentTool: FunctionDeclaration = {
  name: "writeDocument",
  description: "Opens Notepad or Microsoft Word and writes content into it. For Notepad: opens a new tab and types the content. For Word: creates a new document with proper formatting — supports markdown-style headings (# ## ###), bullet lists (- item), numbered lists (1. item). Use 'notepad' for quick notes, 'word' for formal documents like essays, resumes, research papers. ALWAYS generate the full content yourself before calling this tool — do NOT send incomplete or placeholder text.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      target: {
        type: Type.STRING,
        description: "Where to write: 'notepad' or 'word'.",
      },
      content: {
        type: Type.STRING,
        description: "The full text content to write. For Word, use markdown-style formatting: # for Heading 1, ## for Heading 2, ### for Heading 3, - for bullets, 1. for numbered lists. Write the COMPLETE content.",
      },
      title: {
        type: Type.STRING,
        description: "Optional document title (used for Word).",
      },
    },
    required: ["target", "content"],
  },
};

export const formatWordTool: FunctionDeclaration = {
  name: "formatWord",
  description: "Formats the currently active Microsoft Word document. Can toggle bold/italic/underline, change font size/name, apply heading styles, change alignment, add more text at the end, insert images, or save the document. Word must already be open with a document.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: {
        type: Type.STRING,
        description: "The formatting action: 'bold', 'italic', 'underline', 'font-size', 'font-name', 'heading', 'align-center', 'align-left', 'align-right', 'add-text', 'save', 'insert-image'.",
      },
      value: {
        type: Type.STRING,
        description: "The value for the action. For font-size: number (e.g., '14'). For font-name: font name (e.g., 'Arial'). For heading: level 1-3. For add-text: the text to append. For save: the full file path (empty = Desktop). For insert-image: the full image file path.",
      },
    },
    required: ["action"],
  },
};
