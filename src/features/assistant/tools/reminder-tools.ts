import { type FunctionDeclaration, Type } from "@google/genai";

export const setReminderTool: FunctionDeclaration = {
  name: "setReminder",
  description: `Sets a reminder or alarm that will make you speak up at a future time, even if the user is doing something else. Use when the user says things like "remind me in 20 minutes to...", "wake me at 7am", "every weekday at 9 tell me to...", "set an alarm for 6:30". IMPORTANT: You must resolve the time yourself into an absolute delay. Use the CURRENT DATE & TIME from your context to work out how many minutes from now the reminder should fire.`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      label: {
        type: Type.STRING,
        description: "Short name for the reminder, in the user's own words (e.g. 'take the pizza out', 'stand-up meeting').",
      },
      minutesFromNow: {
        type: Type.NUMBER,
        description: "How many minutes from RIGHT NOW the reminder should fire. Calculate this yourself from the current time in your context. For 'in 20 minutes' pass 20. For 'at 7am tomorrow' work out the total minutes until then.",
      },
      repeat: {
        type: Type.STRING,
        description: "Optional recurrence: 'daily', 'weekly', or 'interval'. Omit entirely for a one-time reminder.",
      },
      intervalMinutes: {
        type: Type.NUMBER,
        description: "Only used when repeat is 'interval' — how many minutes between repeats.",
      },
    },
    required: ["label", "minutesFromNow"],
  },
};

export const listRemindersTool: FunctionDeclaration = {
  name: "listReminders",
  description: "Lists the user's currently scheduled reminders and alarms. Use when they ask 'what reminders do I have', 'what's scheduled', or 'do I have any alarms set'.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

export const cancelReminderTool: FunctionDeclaration = {
  name: "cancelReminder",
  description: "Cancels a scheduled reminder or alarm by its label. Use when the user says 'cancel the pizza reminder', 'delete my 7am alarm', or 'forget that reminder'. Match on the words the user used — partial matches work.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      label: {
        type: Type.STRING,
        description: "The label (or part of it) identifying which reminder to cancel.",
      },
    },
    required: ["label"],
  },
};
