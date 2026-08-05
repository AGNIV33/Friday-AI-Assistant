// ─── Clipboard History ────────────────────────────────────────────────────────
// Polls the system clipboard and keeps a rolling history of what was copied,
// so the user can ask "what did I copy earlier?" and paste it back by voice.
//
// Everything stays on this machine — the history file lives in .friday-data
// alongside the conversation cache and is never uploaded.

const { ipcMain, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', '..', '.friday-data');
const HISTORY_FILE = path.join(DATA_DIR, 'clipboard-history.json');

const POLL_MS = 2000;
const MAX_ENTRIES = 100;
// Skip anything enormous — copying a whole file's contents shouldn't blow up
// the history file or the model's context later.
const MAX_ENTRY_CHARS = 5000;

let history = [];
let pollTimer = null;
let lastSeen = '';
let enabled = false;

function ensureDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (_) {}
}

function load() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
      if (Array.isArray(parsed.entries)) return parsed.entries;
    }
  } catch (_) {}
  return [];
}

let saveTimer = null;

/**
 * Debounced write.
 *
 * The history file can reach a few hundred KB, and copying anything triggers a
 * change — writing the whole file synchronously on every copy would mean a
 * blocking disk write in the middle of the user's typing. Batching means a
 * rapid burst of copies costs one write instead of a dozen.
 */
function save() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 3000);
}

function flush() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  try {
    ensureDir();
    fs.writeFileSync(HISTORY_FILE, JSON.stringify({ entries: history }), 'utf-8');
  } catch (e) {
    console.warn('[Clipboard] Save failed:', e.message);
  }
}

function poll() {
  try {
    const text = clipboard.readText();
    if (!text || text === lastSeen) return;
    lastSeen = text;

    const trimmed = text.length > MAX_ENTRY_CHARS ? text.slice(0, MAX_ENTRY_CHARS) + '…' : text;

    // Move an existing identical entry to the front rather than duplicating it.
    history = history.filter(e => e.text !== trimmed);
    history.unshift({ text: trimmed, at: new Date().toISOString() });
    if (history.length > MAX_ENTRIES) history = history.slice(0, MAX_ENTRIES);
    save();
  } catch (e) {
    console.warn('[Clipboard] Poll failed:', e.message);
  }
}

/**
 * The poll only exists while the feature is on. Previously the interval ran
 * regardless and returned early when disabled — a wakeup every 2 seconds, all
 * day, doing nothing. Since this is off by default, that was pure waste for
 * most users.
 */
function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function startPolling() {
  if (pollTimer) return;
  try { lastSeen = clipboard.readText() || ''; } catch (_) {}
  pollTimer = setInterval(poll, POLL_MS);
}

function start() {
  history = load();
  // Intentionally does NOT begin polling — the renderer enables it from
  // settings once it knows the user's preference.
}

ipcMain.handle('clipboard-set-enabled', (event, { enabled: on }) => {
  enabled = !!on;
  if (enabled) startPolling();
  else stopPolling();
  return { success: true, enabled };
});

ipcMain.handle('clipboard-history', (event, { limit } = {}) => {
  if (!enabled) {
    return { success: false, error: 'Clipboard history is turned off. The user can enable it in Settings under Proactive.' };
  }
  const n = Math.min(Number(limit) || 10, 25);
  return {
    success: true,
    total: history.length,
    entries: history.slice(0, n).map((e, i) => ({
      index: i + 1,
      // Keep what goes to the model short; the full text is still on disk.
      preview: e.text.length > 200 ? e.text.slice(0, 200) + '…' : e.text,
      at: e.at,
    })),
  };
});

ipcMain.handle('clipboard-search', (event, { query }) => {
  if (!enabled) {
    return { success: false, error: 'Clipboard history is turned off.' };
  }
  const q = (query || '').toLowerCase();
  if (!q) return { success: false, error: 'A search term is required.' };
  const matches = history
    .map((e, i) => ({ ...e, index: i + 1 }))
    .filter(e => e.text.toLowerCase().includes(q))
    .slice(0, 10)
    .map(e => ({
      index: e.index,
      preview: e.text.length > 200 ? e.text.slice(0, 200) + '…' : e.text,
      at: e.at,
    }));
  return { success: true, matches, count: matches.length };
});

ipcMain.handle('clipboard-restore', (event, { index }) => {
  if (!enabled) return { success: false, error: 'Clipboard history is turned off.' };
  const i = Number(index) - 1;
  if (!Number.isInteger(i) || i < 0 || i >= history.length) {
    return { success: false, error: `No clipboard entry at position ${index}.` };
  }
  try {
    clipboard.writeText(history[i].text);
    lastSeen = history[i].text;
    return { success: true, restored: history[i].text.slice(0, 120) };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('clipboard-clear', () => {
  history = [];
  save();
  return { success: true };
});

module.exports = { start, flush };
