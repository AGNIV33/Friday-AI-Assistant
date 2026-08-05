// ─── Background Monitors ──────────────────────────────────────────────────────
// Polls cheap system vitals and raises a proactive event on SUSTAINED threshold
// breaches.
//
// Two deliberate design choices:
//  1. Never call `get-system-info` here. That handler shells out to PowerShell
//     WMI for the GPU name on every invocation — spawning a process every 30s
//     would make the whole app feel heavy. We use pure `os.*` reads instead.
//  2. Hysteresis + cooldown. A single 100ms CPU spike is noise; only a breach
//     sustained across several consecutive samples is worth interrupting for,
//     and once announced it stays quiet for a cooldown period.

const { ipcMain } = require('electron');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { emitProactive } = require('./proactive.cjs');

const SAMPLE_MS = 30 * 1000;
const CONSECUTIVE_BREACHES_REQUIRED = 3;   // ~90s sustained before speaking
const COOLDOWN_MS = 30 * 60 * 1000;        // don't renag for 30 min

const DEFAULT_CONFIG = {
  enabled: false,      // opt-in; the renderer enables this from settings
  cpuPercent: 90,
  ramPercent: 90,
  diskFreeGB: 5,
};

let config = { ...DEFAULT_CONFIG };
let sampleTimer = null;
const breachCounts = { cpu: 0, ram: 0, disk: 0 };
const lastAnnounced = { cpu: 0, ram: 0, disk: 0 };

// CPU usage needs two samples to diff against.
let prevCpu = null;

function readCpuTimes() {
  const cpus = os.cpus();
  let idle = 0, total = 0;
  for (const cpu of cpus) {
    for (const type in cpu.times) total += cpu.times[type];
    idle += cpu.times.idle;
  }
  return { idle, total };
}

function cpuUsagePercent() {
  const current = readCpuTimes();
  if (!prevCpu) {
    prevCpu = current;
    return null; // need a baseline first
  }
  const idleDelta = current.idle - prevCpu.idle;
  const totalDelta = current.total - prevCpu.total;
  prevCpu = current;
  if (totalDelta <= 0) return null;
  return Number((100 - (idleDelta / totalDelta) * 100).toFixed(1));
}

function ramStats() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return {
    totalGB: Number((total / 1024 ** 3).toFixed(2)),
    usedGB: Number((used / 1024 ** 3).toFixed(2)),
    freeGB: Number((free / 1024 ** 3).toFixed(2)),
    usagePercent: Number(((used / total) * 100).toFixed(1)),
  };
}

/**
 * Free space on the volume holding the user's home directory.
 * `fs.statfs` exists on Node 18.15+/20+; if unavailable we return null and the
 * disk monitor simply stays quiet rather than guessing.
 */
function diskFreeGB() {
  return new Promise((resolve) => {
    try {
      if (typeof fs.statfs !== 'function') return resolve(null);
      fs.statfs(os.homedir(), (err, stats) => {
        if (err || !stats) return resolve(null);
        resolve(Number(((stats.bsize * stats.bfree) / 1024 ** 3).toFixed(2)));
      });
    } catch (_) {
      resolve(null);
    }
  });
}

async function collectVitals() {
  const [free] = await Promise.all([diskFreeGB()]);
  return {
    cpuPercent: cpuUsagePercent(),
    ram: ramStats(),
    diskFreeGB: free,
    uptimeHours: Number((os.uptime() / 3600).toFixed(1)),
  };
}

function considerBreach(key, isBreaching, buildEvent) {
  if (!isBreaching) {
    breachCounts[key] = 0;
    return;
  }
  breachCounts[key] += 1;
  if (breachCounts[key] < CONSECUTIVE_BREACHES_REQUIRED) return;

  const now = Date.now();
  if (now - lastAnnounced[key] < COOLDOWN_MS) return;

  lastAnnounced[key] = now;
  breachCounts[key] = 0;
  emitProactive(buildEvent());
}

async function sample() {
  if (!config.enabled) return;
  try {
    const v = await collectVitals();

    if (v.cpuPercent !== null) {
      considerBreach('cpu', v.cpuPercent >= config.cpuPercent, () => ({
        kind: 'system-health-cpu',
        priority: 'normal',
        text: `[SYSTEM EVENT] CPU usage has been sustained at ${v.cpuPercent}% for over a minute. Briefly and in character, warn the user their system is under heavy load and offer to check what's running. Keep it to one sentence.`,
        data: { metric: 'cpu', value: v.cpuPercent },
      }));
    }

    considerBreach('ram', v.ram.usagePercent >= config.ramPercent, () => ({
      kind: 'system-health-ram',
      priority: 'normal',
      text: `[SYSTEM EVENT] Memory usage is at ${v.ram.usagePercent}% (${v.ram.usedGB}GB of ${v.ram.totalGB}GB). Briefly and in character, warn the user memory is running high. Keep it to one sentence.`,
      data: { metric: 'ram', value: v.ram.usagePercent },
    }));

    if (v.diskFreeGB !== null) {
      considerBreach('disk', v.diskFreeGB <= config.diskFreeGB, () => ({
        kind: 'system-health-disk',
        priority: 'normal',
        text: `[SYSTEM EVENT] Only ${v.diskFreeGB}GB of disk space remains. Briefly and in character, warn the user they're running out of space and offer to help clear things out. Keep it to one sentence.`,
        data: { metric: 'disk', value: v.diskFreeGB },
      }));
    }
  } catch (e) {
    console.warn('[Monitors] Sample failed:', e.message);
  }
}

function start() {
  if (sampleTimer) clearInterval(sampleTimer);
  prevCpu = readCpuTimes(); // establish baseline
  sampleTimer = setInterval(sample, SAMPLE_MS);
  console.log('[Monitors] Started (disabled until enabled from settings).');
}

// Cheap vitals for on-demand use (daily briefing, watchdog) — no subprocess.
ipcMain.handle('get-system-vitals', async () => {
  try {
    const v = await collectVitals();
    return { success: true, ...v };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('set-monitor-config', async (event, incoming) => {
  config = { ...config, ...(incoming || {}) };
  if (!config.enabled) {
    breachCounts.cpu = breachCounts.ram = breachCounts.disk = 0;
  }
  return { success: true, config };
});

module.exports = { start };
