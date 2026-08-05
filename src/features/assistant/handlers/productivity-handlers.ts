import { memoryService } from "@/services/firebase";
import type { ToolRegistry } from "./types";

export const productivityHandlers: ToolRegistry = {
  // ─── Clipboard ─────────────────────────────────────────────────────────────

  clipboardHistory: {
    requiresElectron: true,
    handler: async ({ args, electronAPI }) => {
      const res = await electronAPI!.clipboardHistory(args.limit);
      if (!res.success) return { error: res.error };
      if (!res.entries?.length) {
        return { success: true, message: 'The clipboard history is empty. Tell the user nothing has been copied yet.' };
      }
      const list = res.entries.map(e => `${e.index}. ${e.preview}`).join('\n');
      return {
        success: true,
        total: res.total,
        message: `Recent clipboard entries:\n${list}\n\nSummarize these for the user. If they want one back, use clipboardRestore with its number.`,
      };
    },
  },

  clipboardSearch: {
    requiresElectron: true,
    handler: async ({ args, electronAPI }) => {
      const res = await electronAPI!.clipboardSearch(args.query);
      if (!res.success) return { error: res.error };
      if (!res.matches?.length) {
        return { success: true, message: `Nothing in the clipboard history matches "${args.query}". Tell the user.` };
      }
      const list = res.matches.map(m => `${m.index}. ${m.preview}`).join('\n');
      return { success: true, message: `Matches for "${args.query}":\n${list}\n\nRead the best match to the user and offer to copy it back.` };
    },
  },

  clipboardRestore: {
    requiresElectron: true,
    handler: async ({ args, electronAPI, addToast }) => {
      const res = await electronAPI!.clipboardRestore(Number(args.index));
      if (!res.success) return { error: res.error };
      addToast?.('Copied to clipboard', 'success');
      return { success: true, message: `Copied back to the clipboard. Tell the user it's ready to paste.` };
    },
  },

  // ─── Notes ─────────────────────────────────────────────────────────────────

  addNote: {
    requiresElectron: true,
    handler: async ({ args, electronAPI, addToast }) => {
      const res = await electronAPI!.noteAdd(args.title, args.body, args.tags);
      if (!res.success) return { error: res.error };
      addToast?.(`Note saved: ${res.title}`, 'success');
      return { success: true, message: `Note saved as "${res.title}". Confirm briefly.` };
    },
  },

  searchNotes: {
    requiresElectron: true,
    handler: async ({ args, electronAPI }) => {
      const res = await electronAPI!.noteSearch(args.query);
      if (!res.success) return { error: res.error };
      if (!res.notes?.length) {
        return { success: true, message: `No notes match "${args.query}". Tell the user.` };
      }
      const list = res.notes.map(n => `• ${n.title}: ${n.body}`).join('\n');
      return { success: true, message: `Matching notes:\n${list}\n\nRead the relevant parts to the user naturally.` };
    },
  },

  listNotes: {
    requiresElectron: true,
    handler: async ({ args, electronAPI }) => {
      const res = await electronAPI!.noteList(args.limit);
      if (!res.success) return { error: res.error };
      if (!res.notes?.length) {
        return { success: true, message: 'There are no saved notes yet.' };
      }
      const list = res.notes.map(n => `• ${n.title} (${new Date(n.at).toLocaleDateString('en-IN')})`).join('\n');
      return { success: true, message: `Saved notes (${res.total} total):\n${list}` };
    },
  },

  deleteNote: {
    requiresElectron: true,
    handler: async ({ args, electronAPI }) => {
      const res = await electronAPI!.noteDelete(args.query);
      return res.success
        ? { success: true, message: `Deleted ${res.removed} note(s). Confirm briefly.` }
        : { error: res.error };
    },
  },

  // ─── Routines ──────────────────────────────────────────────────────────────

  saveRoutine: {
    requiresElectron: true,
    handler: async ({ args, electronAPI, addToast }) => {
      const res = await electronAPI!.routineSave(args.name, args.steps);
      if (!res.success) return { error: res.error };
      addToast?.(`Routine saved: ${res.name}`, 'success');
      return { success: true, message: `Routine "${res.name}" saved with ${res.stepCount} step(s). Tell the user how to trigger it.` };
    },
  },

  runRoutine: {
    requiresElectron: true,
    handler: async ({ args, electronAPI, addToast, runTool }) => {
      const found = await electronAPI!.routineGet(args.name);
      if (!found.success || !found.routine) return { error: found.error };

      const routine = found.routine;
      addToast?.(`Running routine: ${routine.name}`, 'info');

      // Run steps in order, collecting outcomes. One failing step doesn't abort
      // the rest — a half-finished routine is more useful than none, and the
      // model reports exactly what did and didn't work.
      const results: string[] = [];
      for (const step of routine.steps) {
        try {
          const out = await runTool?.(step.tool, step.args || {});
          results.push(out?.error ? `${step.tool}: FAILED (${out.error})` : `${step.tool}: ok`);
        } catch (e: any) {
          results.push(`${step.tool}: FAILED (${e.message})`);
        }
      }

      const failed = results.filter(r => r.includes('FAILED'));
      return {
        success: true,
        message: `Routine "${routine.name}" finished. ${results.length - failed.length} of ${results.length} steps succeeded.\n${results.join('\n')}\n\nTell the user it's done. Only mention failures if there were any.`,
      };
    },
  },

  listRoutines: {
    requiresElectron: true,
    handler: async ({ electronAPI }) => {
      const res = await electronAPI!.routineList();
      if (!res.routines?.length) {
        return { success: true, message: 'No routines saved yet. Offer to create one.' };
      }
      const list = res.routines.map(r => `• ${r.name} (${r.stepCount} steps: ${r.steps.join(' → ')})`).join('\n');
      return { success: true, message: `Saved routines:\n${list}` };
    },
  },

  deleteRoutine: {
    requiresElectron: true,
    handler: async ({ args, electronAPI }) => {
      const res = await electronAPI!.routineDelete(args.name);
      return res.success
        ? { success: true, message: `Deleted ${res.removed} routine(s).` }
        : { error: res.error };
    },
  },

  // ─── Documents ─────────────────────────────────────────────────────────────

  readDocument: {
    requiresElectron: true,
    handler: async ({ args, electronAPI, setProgressTask }) => {
      setProgressTask({ active: true, label: 'Reading document…', type: 'search' });
      const res = await electronAPI!.readDocumentText(args.filePath);
      setProgressTask(null);
      if (!res.success) return { error: res.error };
      return {
        success: true,
        fileName: res.fileName,
        truncated: res.truncated,
        message: `Contents of "${res.fileName}"${res.truncated ? ` (first part only — the document is ${res.originalChars} characters)` : ''}:\n\n${res.text}\n\nSummarize this for the user based on what they asked. Don't read it out verbatim.`,
      };
    },
  },

  // ─── Research ──────────────────────────────────────────────────────────────

  researchTopic: {
    requiresElectron: true,
    handler: ({ args, electronAPI, setProgressTask, sendText, runTool }) => {
      const topic = args.topic || '';
      const wantsReport = !!args.writeReport;
      setProgressTask({ active: true, label: `Researching "${topic}"…`, type: 'web' });

      // Deferred: searching takes ~10s, so return immediately and inject the
      // findings once they land rather than blocking the conversation.
      electronAPI!.searchGoogle(topic).then(async (res: any) => {
        setProgressTask(null);

        if (!res.success || !res.data) {
          sendText(`[RESEARCH FAILED] The research on "${topic}" didn't return anything usable. Tell the user.`);
          return;
        }

        const sources = (res.sources || []).slice(0, 6);
        const sourceList = sources.length
          ? sources.map((s: any, i: number) => `[${i + 1}] ${s.title} — ${s.domain} (${s.url})`).join('\n')
          : 'No source links were captured.';

        if (wantsReport) {
          // Hand the findings back and let the model compose the document —
          // it writes far better prose than string concatenation would.
          sendText(
            `[RESEARCH COMPLETE] Findings on "${topic}":\n\n${res.data.slice(0, 3000)}\n\nSOURCES:\n${sourceList}\n\n` +
            `Now write this up as a document: call writeDocument with target='word', a clear title, and well-structured markdown ` +
            `(# heading, ## sections, - bullets). End with a "Sources" section listing the URLs above. ` +
            `Tell the user briefly what you found while you write it.`
          );
        } else {
          sendText(
            `[RESEARCH COMPLETE] Findings on "${topic}":\n\n${res.data.slice(0, 3000)}\n\nSOURCES:\n${sourceList}\n\n` +
            `Summarize the key points out loud in a few sentences. Mention which sources they came from by name ` +
            `(e.g. "according to Reuters") — do NOT read out raw URLs. Offer to write it up as a document if they want it saved.`
          );
        }
      }).catch(() => {
        setProgressTask(null);
        sendText(`[RESEARCH FAILED] Something went wrong researching "${topic}". Tell the user.`);
      });

      return {
        success: true,
        status: 'researching_in_background',
        message: `Research on "${topic}" has started in the background. Tell the user you're digging into it and will report back shortly, then keep listening.`,
      };
    },
  },

  // ─── People ────────────────────────────────────────────────────────────────

  rememberPerson: {
    handler: async ({ args, uid, addToast }) => {
      if (!args.name?.trim()) return { error: 'A name is required.' };
      try {
        await memoryService.savePerson(uid, {
          name: args.name,
          relationship: args.relationship,
          details: Array.isArray(args.details) ? args.details : (args.details ? [args.details] : []),
        });
        addToast?.(`Remembered: ${args.name}`, 'success');
        return { success: true, message: `Noted about ${args.name}. Acknowledge briefly and naturally — don't make a production of it.` };
      } catch (e: any) {
        return { error: 'Could not save that person to memory.' };
      }
    },
  },

  recallPeople: {
    handler: async ({ args, uid }) => {
      try {
        const people = (await memoryService.getPeople(uid)) || [];
        if (!people.length) {
          return { success: true, message: `You don't know about anyone in the user's life yet. Say so naturally.` };
        }

        const wanted = (args.name || '').toLowerCase().trim();
        const filtered = wanted
          ? people.filter((p: any) =>
              p.name?.toLowerCase().includes(wanted) ||
              p.relationship?.toLowerCase().includes(wanted))
          : people;

        if (!filtered.length) {
          return { success: true, message: `You don't have anything on "${args.name}". Tell the user and offer to remember them.` };
        }

        const list = filtered.slice(0, 15).map((p: any) =>
          `• ${p.name}${p.relationship ? ` (${p.relationship})` : ''}${p.details?.length ? `: ${p.details.join('; ')}` : ''}`
        ).join('\n');

        return { success: true, message: `What you know:\n${list}\n\nAnswer the user's question from this. Keep it conversational.` };
      } catch (e: any) {
        return { error: 'Could not read people from memory.' };
      }
    },
  },

  // ─── Tone ──────────────────────────────────────────────────────────────────

  setTone: {
    handler: ({ args, setTone }) => {
      const tone = ['urgent', 'calm', 'neutral'].includes(args.tone) ? args.tone : 'neutral';
      setTone?.(tone);
      const guidance: Record<string, string> = {
        urgent: 'Tone set to urgent. Be crisp, direct and fast. Drop the flirtation. Lead with what matters.',
        calm: 'Tone set to calm. Slow down, be warm and reassuring, softer delivery.',
        neutral: 'Tone back to normal. Return to your usual witty, playful Friday register.',
      };
      return { success: true, message: guidance[tone] };
    },
  },
};
