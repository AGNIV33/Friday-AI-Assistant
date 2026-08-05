import type { ToolRegistry } from "./types";

export const reminderHandlers: ToolRegistry = {
  setReminder: {
    requiresElectron: true,
    handler: async ({ args, electronAPI }) => {
      const minutes = Number(args.minutesFromNow);
      if (!Number.isFinite(minutes) || minutes <= 0) {
        return { error: 'A reminder needs a positive number of minutes from now.' };
      }

      const runAt = Date.now() + minutes * 60 * 1000;
      const label = args.label || 'Reminder';
      const repeat = args.repeat || null;

      const res = await electronAPI!.schedulerAdd({
        label,
        // This text is the instruction Friday receives when the job fires —
        // it is not read out verbatim.
        text: `[REMINDER] It's time for: "${label}". Tell the user in character, briefly and naturally. This is a reminder they asked you to set.`,
        runAt,
        repeat,
        intervalMs: repeat === 'interval' ? (Number(args.intervalMinutes) || 0) * 60 * 1000 : 0,
        priority: 'normal',
      });

      if (!res.success) {
        return { error: res.error || 'Failed to set the reminder.' };
      }

      const when = new Date(runAt).toLocaleString('en-IN', {
        hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short', hour12: true,
      });
      return {
        success: true,
        message: `Reminder "${label}" set for ${when}${repeat ? ` (repeating ${repeat})` : ''}. Confirm this to the user briefly.`,
      };
    },
  },

  listReminders: {
    requiresElectron: true,
    handler: async ({ electronAPI }) => {
      const res = await electronAPI!.schedulerList();
      const jobs = res.jobs || [];
      if (!jobs.length) {
        return { success: true, message: 'There are no reminders scheduled. Tell the user their schedule is clear.' };
      }
      const list = jobs.map(j => {
        const when = new Date(j.nextRun).toLocaleString('en-IN', {
          hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short', hour12: true,
        });
        return `"${j.label}" at ${when}${j.repeat ? ` (repeating ${j.repeat})` : ''}`;
      }).join('; ');
      return { success: true, count: jobs.length, message: `Scheduled reminders: ${list}. Read these to the user naturally.` };
    },
  },

  cancelReminder: {
    requiresElectron: true,
    handler: async ({ args, electronAPI }) => {
      const res = await electronAPI!.schedulerCancel(args.label || '');
      if (res.success) {
        return { success: true, message: `Cancelled ${res.removed} reminder(s) matching "${args.label}". Confirm briefly.` };
      }
      return { error: res.error || `No reminder matching "${args.label}" was found.` };
    },
  },
};
