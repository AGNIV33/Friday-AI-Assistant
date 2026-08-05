import { googleApiFetch } from "@/services/firebase";
import type { ToolRegistry } from "./types";

const CAL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';

function fmtWhen(iso: string, allDay: boolean) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return allDay
    ? d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
    : d.toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
}

/** Gmail uses base64url; browsers only decode standard base64. */
function decodeBase64Url(data: string): string {
  try {
    const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(normalized);
    // Round-trip through UTF-8 so accented characters and emoji survive.
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch (_) {
    return '';
  }
}

/** Walks the MIME tree for the best readable body part. */
function extractBody(payload: any): string {
  if (!payload) return '';
  if (payload.body?.data) return decodeBase64Url(payload.body.data);

  const parts: any[] = payload.parts || [];
  const plain = parts.find(p => p.mimeType === 'text/plain' && p.body?.data);
  if (plain) return decodeBase64Url(plain.body.data);

  const html = parts.find(p => p.mimeType === 'text/html' && p.body?.data);
  if (html) {
    return decodeBase64Url(html.body.data)
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  for (const p of parts) {
    const nested = extractBody(p);
    if (nested) return nested;
  }
  return '';
}

export const googleHandlers: ToolRegistry = {
  // ─── Calendar ──────────────────────────────────────────────────────────────

  listCalendarEvents: {
    handler: async ({ args, setProgressTask }) => {
      const days = Math.min(Math.max(Number(args.daysAhead) || 7, 1), 60);
      const max = Math.min(Number(args.maxResults) || 10, 25);

      const timeMin = new Date().toISOString();
      const timeMax = new Date(Date.now() + days * 86400000).toISOString();
      const url = `${CAL}?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}` +
                  `&singleEvents=true&orderBy=startTime&maxResults=${max}`;

      setProgressTask({ active: true, label: 'Checking calendar…', type: 'general' });
      const res = await googleApiFetch(url);
      setProgressTask(null);

      if (!res.ok) return { error: res.error };

      const items = res.data.items || [];
      if (!items.length) {
        return { success: true, message: `Nothing on the calendar for the next ${days} day(s). Tell the user they're clear.` };
      }

      const list = items.map((e: any) => {
        const allDay = !!e.start?.date;
        const when = fmtWhen(e.start?.dateTime || e.start?.date, allDay);
        return `• ${e.summary || '(no title)'} — ${when}${allDay ? ' (all day)' : ''}${e.location ? ` @ ${e.location}` : ''} [id:${e.id}]`;
      }).join('\n');

      return {
        success: true,
        count: items.length,
        message: `Upcoming events:\n${list}\n\nRead these to the user naturally — say the times conversationally and do NOT read out the ids.`,
      };
    },
  },

  createCalendarEvent: {
    handler: async ({ args, addToast, setProgressTask }) => {
      const start = new Date(args.startISO);
      if (Number.isNaN(start.getTime())) {
        return { error: 'The start time was not a valid date. Recalculate it from the current date and time.' };
      }
      const mins = Math.min(Math.max(Number(args.durationMinutes) || 60, 5), 24 * 60);
      const end = new Date(start.getTime() + mins * 60000);

      setProgressTask({ active: true, label: 'Adding to calendar…', type: 'general' });
      const res = await googleApiFetch(CAL, {
        method: 'POST',
        body: JSON.stringify({
          summary: args.title,
          description: args.description || undefined,
          location: args.location || undefined,
          start: { dateTime: start.toISOString() },
          end: { dateTime: end.toISOString() },
        }),
      });
      setProgressTask(null);

      if (!res.ok) return { error: res.error };

      addToast?.(`Event added: ${args.title}`, 'success');
      return {
        success: true,
        message: `Created "${args.title}" for ${fmtWhen(start.toISOString(), false)} (${mins} min). Confirm the day and time back to the user so they can catch any mistake.`,
      };
    },
  },

  deleteCalendarEvent: {
    handler: async ({ args }) => {
      const res = await googleApiFetch(`${CAL}/${encodeURIComponent(args.eventId)}`, { method: 'DELETE' });
      // A successful DELETE returns 204 with no body, which our JSON parse
      // turns into an empty object — that's still success.
      if (!res.ok) return { error: res.error };
      return { success: true, message: 'Event cancelled. Confirm briefly.' };
    },
  },

  // ─── Gmail ─────────────────────────────────────────────────────────────────

  listEmails: {
    handler: async ({ args, setProgressTask }) => {
      const max = Math.min(Number(args.maxResults) || 8, 15);
      const q = args.query || 'is:unread in:inbox';

      setProgressTask({ active: true, label: 'Checking mail…', type: 'general' });
      const listRes = await googleApiFetch(`${GMAIL}/messages?maxResults=${max}&q=${encodeURIComponent(q)}`);

      if (!listRes.ok) {
        setProgressTask(null);
        return { error: listRes.error };
      }

      const ids = (listRes.data.messages || []).map((m: any) => m.id);
      if (!ids.length) {
        setProgressTask(null);
        return { success: true, message: `No messages match "${q}". Tell the user their inbox is clear.` };
      }

      // Metadata-only fetches, in parallel — full bodies would be far too much
      // context for a list view.
      const metas = await Promise.all(
        ids.map((id: string) =>
          googleApiFetch(`${GMAIL}/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`)
        )
      );
      setProgressTask(null);

      const rows = metas.filter(m => m.ok).map((m: any) => {
        const headers = m.data.payload?.headers || [];
        const get = (n: string) => headers.find((h: any) => h.name === n)?.value || '';
        const from = get('From').replace(/<.*>/, '').trim() || get('From');
        return `• ${from} — "${get('Subject') || '(no subject)'}" [id:${m.data.id}]\n   ${m.data.snippet || ''}`;
      });

      if (!rows.length) return { error: 'Could not read the message details.' };

      return {
        success: true,
        count: rows.length,
        message: `Messages:\n${rows.join('\n')}\n\nSummarize what's worth the user's attention — who wrote and what they want. Do NOT read out ids or every message verbatim. Offer to open or reply to anything important.`,
      };
    },
  },

  readEmail: {
    handler: async ({ args, setProgressTask }) => {
      setProgressTask({ active: true, label: 'Opening message…', type: 'general' });
      const res = await googleApiFetch(`${GMAIL}/messages/${encodeURIComponent(args.messageId)}?format=full`);
      setProgressTask(null);

      if (!res.ok) return { error: res.error };

      const headers = res.data.payload?.headers || [];
      const get = (n: string) => headers.find((h: any) => h.name === n)?.value || '';
      const body = extractBody(res.data.payload).slice(0, 6000);

      return {
        success: true,
        message: `From: ${get('From')}\nSubject: ${get('Subject')}\nDate: ${get('Date')}\n\n${body || '(no readable text — it may be image-only)'}\n\nSummarize this for the user in a few sentences. Only read it in full if they ask.`,
      };
    },
  },

  sendEmail: {
    handler: async ({ args, addToast, setProgressTask }) => {
      if (!args.to || !args.subject || !args.body) {
        return { error: 'Recipient, subject and body are all required.' };
      }

      // RFC 2822 message, base64url encoded as Gmail requires.
      const raw = [
        `To: ${args.to}`,
        `Subject: ${args.subject}`,
        'Content-Type: text/plain; charset="UTF-8"',
        '',
        args.body,
      ].join('\r\n');

      const encoded = btoa(unescape(encodeURIComponent(raw)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      setProgressTask({ active: true, label: 'Sending email…', type: 'general' });
      const res = await googleApiFetch(`${GMAIL}/messages/send`, {
        method: 'POST',
        body: JSON.stringify({ raw: encoded }),
      });
      setProgressTask(null);

      if (!res.ok) return { error: res.error };

      addToast?.(`Email sent to ${args.to}`, 'success');
      return { success: true, message: `Email sent to ${args.to}. Confirm briefly.` };
    },
  },
};
