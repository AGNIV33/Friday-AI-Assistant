// ─── Personal Notes ───────────────────────────────────────────────────────────
// Voice-captured notes with keyword search. Distinct from the two memory
// systems: Firebase memory holds facts ABOUT the user; this holds things the
// user explicitly asked to write down.
//
// Local-only, stored in .friday-data/notes.json.

const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', '..', '.friday-data');
const NOTES_FILE = path.join(DATA_DIR, 'notes.json');

const MAX_NOTES = 500;
const MAX_NOTE_CHARS = 4000;

let notes = [];

function ensureDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (_) {}
}

function load() {
  try {
    if (fs.existsSync(NOTES_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(NOTES_FILE, 'utf-8'));
      if (Array.isArray(parsed.notes)) return parsed.notes;
    }
  } catch (_) {}
  return [];
}

function save() {
  try {
    ensureDir();
    fs.writeFileSync(NOTES_FILE, JSON.stringify({ notes }, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[Notes] Save failed:', e.message);
  }
}

notes = load();

/** Naive relevance: how many of the query's words appear in the note. */
function scoreNote(note, terms) {
  const hay = `${note.title} ${note.body} ${(note.tags || []).join(' ')}`.toLowerCase();
  let score = 0;
  for (const t of terms) {
    if (hay.includes(t)) score += 1;
    if (note.title.toLowerCase().includes(t)) score += 1; // title matches count double
  }
  return score;
}

ipcMain.handle('note-add', (event, { title, body, tags }) => {
  const text = (body || '').slice(0, MAX_NOTE_CHARS);
  if (!text.trim()) return { success: false, error: 'A note needs some content.' };

  const note = {
    id: `note-${Date.now()}`,
    title: (title || text.slice(0, 50)).trim(),
    body: text,
    tags: Array.isArray(tags) ? tags.map(t => String(t).toLowerCase().trim()).filter(Boolean) : [],
    at: new Date().toISOString(),
  };
  notes.unshift(note);
  if (notes.length > MAX_NOTES) notes = notes.slice(0, MAX_NOTES);
  save();
  return { success: true, id: note.id, title: note.title };
});

ipcMain.handle('note-search', (event, { query, limit }) => {
  const q = (query || '').toLowerCase().trim();
  if (!q) return { success: false, error: 'A search term is required.' };

  const terms = q.split(/\s+/).filter(Boolean);
  const scored = notes
    .map(n => ({ note: n, score: scoreNote(n, terms) }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(Number(limit) || 5, 10));

  return {
    success: true,
    count: scored.length,
    notes: scored.map(s => ({
      id: s.note.id,
      title: s.note.title,
      body: s.note.body.length > 500 ? s.note.body.slice(0, 500) + '…' : s.note.body,
      at: s.note.at,
    })),
  };
});

ipcMain.handle('note-list', (event, { limit } = {}) => {
  const n = Math.min(Number(limit) || 10, 25);
  return {
    success: true,
    total: notes.length,
    notes: notes.slice(0, n).map(x => ({
      id: x.id,
      title: x.title,
      at: x.at,
    })),
  };
});

ipcMain.handle('note-delete', (event, { query }) => {
  const q = (query || '').toLowerCase().trim();
  if (!q) return { success: false, error: 'Specify which note to delete.' };
  const before = notes.length;
  notes = notes.filter(n => n.id !== q && !n.title.toLowerCase().includes(q));
  const removed = before - notes.length;
  if (removed) save();
  return removed
    ? { success: true, removed }
    : { success: false, error: `No note matching "${query}" was found.` };
});
