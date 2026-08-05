import { type FunctionDeclaration, Type } from "@google/genai";

// ─── Calendar ────────────────────────────────────────────────────────────────

export const listCalendarEventsTool: FunctionDeclaration = {
  name: "listCalendarEvents",
  description: "Reads the user's Google Calendar. Use for 'what's on my calendar', 'am I free tomorrow', 'what's my next meeting', 'what do I have this week'. Resolve the time range yourself from the current date in your context.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      daysAhead: { type: Type.NUMBER, description: "How many days forward to look. 1 = rest of today and tomorrow. Default 7." },
      maxResults: { type: Type.NUMBER, description: "Maximum events to return (default 10)." },
    },
  },
};

export const createCalendarEventTool: FunctionDeclaration = {
  name: "createCalendarEvent",
  description: "Creates an event in the user's Google Calendar. Use for 'schedule a meeting tomorrow at 3', 'put dentist on my calendar for Friday morning'. You must work out the absolute start time yourself from the current date and time in your context. ALWAYS confirm the details back to the user after creating it.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Event title." },
      startISO: { type: Type.STRING, description: "Start time as a full ISO 8601 string with timezone offset, e.g. '2026-08-06T15:00:00+05:30'. Calculate this from the current date/time in your context." },
      durationMinutes: { type: Type.NUMBER, description: "How long the event lasts (default 60)." },
      description: { type: Type.STRING, description: "Optional notes for the event." },
      location: { type: Type.STRING, description: "Optional location." },
    },
    required: ["title", "startISO"],
  },
};

export const deleteCalendarEventTool: FunctionDeclaration = {
  name: "deleteCalendarEvent",
  description: "Cancels a calendar event. Call listCalendarEvents first to find the event's id. ALWAYS confirm with the user before deleting.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      eventId: { type: Type.STRING, description: "The event id from listCalendarEvents." },
    },
    required: ["eventId"],
  },
};

// ─── Gmail ───────────────────────────────────────────────────────────────────

export const listEmailsTool: FunctionDeclaration = {
  name: "listEmails",
  description: "Reads the headlines of the user's recent Gmail messages. Use for 'check my email', 'any new mail', 'what's in my inbox', 'do I have anything from Dave'. Summarize what matters rather than reading every message.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: "Optional Gmail search, e.g. 'is:unread', 'from:dave', 'is:important newer_than:2d'. Defaults to unread mail in the inbox." },
      maxResults: { type: Type.NUMBER, description: "How many messages (default 8, max 15)." },
    },
  },
};

export const readEmailTool: FunctionDeclaration = {
  name: "readEmail",
  description: "Reads the full body of one email. Call listEmails first to get the message id.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      messageId: { type: Type.STRING, description: "The message id from listEmails." },
    },
    required: ["messageId"],
  },
};

export const sendEmailTool: FunctionDeclaration = {
  name: "sendEmail",
  description: "Sends an email from the user's Gmail account. CRITICAL: always read the recipient, subject and full body back to the user and get an explicit yes before calling this — a sent email cannot be taken back.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      to: { type: Type.STRING, description: "Recipient email address." },
      subject: { type: Type.STRING, description: "Subject line." },
      body: { type: Type.STRING, description: "The full message body. Write it out completely." },
    },
    required: ["to", "subject", "body"],
  },
};
