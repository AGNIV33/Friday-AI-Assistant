// ─── Routines (macro recorder) ────────────────────────────────────────────────
// A routine is a saved, named sequence of tool calls — "my morning setup" might
// be openApp(Chrome) → openApp(Spotify) → openWidget(news).
//
// This module only STORES routines. Replaying them happens in the renderer,
// where the tool dispatcher lives (see routine-handlers.ts).

const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', '..', '.friday-data');
const ROUTINES_FILE = path.join(DATA_DIR, 'routines.json');

const MAX_STEPS = 15;

let routines = [];

function ensureDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (_) {}
}

function load() {
  try {
    if (fs.existsSync(ROUTINES_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(ROUTINES_FILE, 'utf-8'));
      if (Array.isArray(parsed.routines)) return parsed.routines;
    }
  } catch (_) {}
  return [];
}

function save() {
  try {
    ensureDir();
    fs.writeFileSync(ROUTINES_FILE, JSON.stringify({ routines }, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[Routines] Save failed:', e.message);
  }
}

routines = load();

ipcMain.handle('routine-save', (event, { name, steps }) => {
  const label = (name || '').trim();
  if (!label) return { success: false, error: 'A routine needs a name.' };
  if (!Array.isArray(steps) || !steps.length) {
    return { success: false, error: 'A routine needs at least one step.' };
  }
  if (steps.length > MAX_STEPS) {
    return { success: false, error: `Routines are limited to ${MAX_STEPS} steps.` };
  }

  const clean = steps
    .filter(s => s && typeof s.tool === 'string')
    .map(s => ({ tool: s.tool, args: s.args || {} }));

  if (!clean.length) {
    return { success: false, error: 'No valid steps were provided.' };
  }

  // Replace an existing routine with the same name (case-insensitive).
  routines = routines.filter(r => r.name.toLowerCase() !== label.toLowerCase());
  routines.push({ name: label, steps: clean, createdAt: new Date().toISOString() });
  save();
  return { success: true, name: label, stepCount: clean.length };
});

ipcMain.handle('routine-list', () => ({
  success: true,
  routines: routines.map(r => ({
    name: r.name,
    stepCount: r.steps.length,
    steps: r.steps.map(s => s.tool),
  })),
}));

ipcMain.handle('routine-get', (event, { name }) => {
  const q = (name || '').toLowerCase().trim();
  // Exact match first, then partial — the model rarely repeats the name exactly.
  const found =
    routines.find(r => r.name.toLowerCase() === q) ||
    routines.find(r => r.name.toLowerCase().includes(q));
  return found
    ? { success: true, routine: found }
    : { success: false, error: `No routine named "${name}" was found.` };
});

ipcMain.handle('routine-delete', (event, { name }) => {
  const q = (name || '').toLowerCase().trim();
  const before = routines.length;
  routines = routines.filter(r => !r.name.toLowerCase().includes(q));
  const removed = before - routines.length;
  if (removed) save();
  return removed
    ? { success: true, removed }
    : { success: false, error: `No routine matching "${name}" was found.` };
});
