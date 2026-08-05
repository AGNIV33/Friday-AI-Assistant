// ─── Scheduler (reminders, alarms, recurring jobs) ────────────────────────────
// Jobs persist to disk so they survive an app restart. A single interval ticks
// and fires anything due into the proactive bus.
//
// Timing is compared against ABSOLUTE timestamps rather than accumulated
// counters, so laptop sleep and clock changes can't cause drift. Jobs that came
// due while the app was closed are caught up on boot (subject to a staleness
// cutoff, so you don't get a burst of week-old reminders at once).

const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { emitProactive } = require('../proactive.cjs');

const DATA_DIR = path.join(__dirname, '..', '..', '.friday-data');
const JOBS_FILE = path.join(DATA_DIR, 'scheduler.json');

const TICK_MS = 20 * 1000;
// A one-shot job that came due while the app was closed still fires on boot,
// but only if it's less than this old — otherwise it's silently retired.
const STALE_CUTOFF_MS = 2 * 60 * 60 * 1000; // 2 hours

let jobs = [];
let tickTimer = null;

function ensureDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (_) {}
}

function loadJobs() {
  try {
    if (fs.existsSync(JOBS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(JOBS_FILE, 'utf-8'));
      if (Array.isArray(parsed.jobs)) return parsed.jobs;
    }
  } catch (e) {
    console.warn('[Scheduler] Could not read jobs file:', e.message);
  }
  return [];
}

function saveJobs() {
  try {
    ensureDir();
    fs.writeFileSync(JOBS_FILE, JSON.stringify({ jobs }, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[Scheduler] Could not save jobs:', e.message);
  }
}

/**
 * Next occurrence strictly after `from` for a recurring job.
 * Returns null for one-shot jobs (they're removed after firing).
 */
function computeNextRun(job, from) {
  if (job.repeat === 'interval' && job.intervalMs > 0) {
    // Advance in whole intervals until we're past `from` — this is what keeps
    // a laptop that slept for 3 hours from firing 36 backlogged 5-min jobs.
    let next = job.nextRun;
    while (next <= from) next += job.intervalMs;
    return next;
  }
  if (job.repeat === 'daily') {
    let next = job.nextRun;
    while (next <= from) next += 24 * 60 * 60 * 1000;
    return next;
  }
  if (job.repeat === 'weekly') {
    let next = job.nextRun;
    while (next <= from) next += 7 * 24 * 60 * 60 * 1000;
    return next;
  }
  return null;
}

function fireJob(job) {
  emitProactive({
    kind: `reminder:${job.id}`,
    priority: job.priority || 'normal',
    text: job.text,
    data: { jobId: job.id, label: job.label, repeat: job.repeat },
  });
}

function tick() {
  const now = Date.now();
  let changed = false;
  const remaining = [];

  for (const job of jobs) {
    if (job.nextRun > now) {
      remaining.push(job);
      continue;
    }

    const overdueBy = now - job.nextRun;
    const tooStale = !job.repeat && overdueBy > STALE_CUTOFF_MS;

    if (!tooStale) {
      fireJob(job);
    } else {
      console.log(`[Scheduler] Dropping stale one-shot job "${job.label}" (${Math.round(overdueBy / 60000)} min overdue)`);
    }

    const next = computeNextRun(job, now);
    if (next) {
      remaining.push({ ...job, nextRun: next, lastRun: now });
    }
    changed = true;
  }

  if (changed) {
    jobs = remaining;
    saveJobs();
  }
}

function start() {
  jobs = loadJobs();
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = setInterval(tick, TICK_MS);
  // Catch up anything that came due while the app was closed.
  tick();
  console.log(`[Scheduler] Started with ${jobs.length} job(s).`);
}

ipcMain.handle('scheduler-add', async (event, job) => {
  try {
    const id = `job-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const runAt = Number(job.runAt);
    if (!runAt || Number.isNaN(runAt)) {
      return { success: false, error: 'A valid absolute runAt timestamp is required.' };
    }
    const entry = {
      id,
      label: job.label || 'Reminder',
      text: job.text || `Remind the user: ${job.label || 'reminder'}`,
      nextRun: runAt,
      repeat: job.repeat || null,          // null | 'interval' | 'daily' | 'weekly'
      intervalMs: job.intervalMs || 0,
      priority: job.priority || 'normal',
      createdAt: Date.now(),
    };
    jobs.push(entry);
    saveJobs();
    return { success: true, id, scheduledFor: new Date(runAt).toISOString() };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('scheduler-list', async () => {
  return {
    success: true,
    jobs: jobs
      .slice()
      .sort((a, b) => a.nextRun - b.nextRun)
      .map(j => ({
        id: j.id,
        label: j.label,
        nextRun: new Date(j.nextRun).toISOString(),
        repeat: j.repeat,
      })),
  };
});

ipcMain.handle('scheduler-cancel', async (event, { id }) => {
  const before = jobs.length;
  // Allow cancelling by exact id or by a case-insensitive label match, since
  // the model is far more likely to know the label the user spoke.
  const needle = (id || '').toLowerCase();
  jobs = jobs.filter(j => j.id !== id && !j.label.toLowerCase().includes(needle));
  const removed = before - jobs.length;
  if (removed > 0) saveJobs();
  return removed > 0
    ? { success: true, removed }
    : { success: false, error: 'No matching reminder found.' };
});

module.exports = { start };
