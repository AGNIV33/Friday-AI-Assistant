import { type FunctionDeclaration, Type } from "@google/genai";

export const sendWhatsAppTool: FunctionDeclaration = {
  name: "sendWhatsApp",
  description: "Sends a WhatsApp message to a contact by name or phone number. Use this when the user asks to send a WhatsApp message, text someone on WhatsApp, or message a contact. If WhatsApp is not connected yet, call initWhatsApp first. Always confirm the contact name and message content with the user before sending.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      contactNameOrNumber: {
        type: Type.STRING,
        description: "The contact name (e.g., 'Mom', 'John Doe') or phone number with country code (e.g., '+919876543210').",
      },
      message: {
        type: Type.STRING,
        description: "The text message to send.",
      },
    },
    required: ["contactNameOrNumber", "message"],
  },
};

export const initWhatsAppTool: FunctionDeclaration = {
  name: "initWhatsApp",
  description: "Initializes the WhatsApp connection. The first time, a QR code will appear in the terminal for the user to scan with their phone. After the first scan, the session is saved and reconnects automatically. Use this when the user wants to connect WhatsApp or before sending a message if WhatsApp is not connected yet.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

export const logoutWhatsAppTool: FunctionDeclaration = {
  name: "logoutWhatsApp",
  description: "Logs out the currently connected WhatsApp account and wipes the saved session. Use when the user asks to disconnect, logout, or unlink WhatsApp. The next time they connect, they will need to scan the QR code again.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};
