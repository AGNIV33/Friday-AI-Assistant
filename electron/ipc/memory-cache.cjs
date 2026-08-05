const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// ─── Conversation Cache (Local Persistent Memory) ──────────────────────────
// Stores full conversation history locally so Friday can recall past sessions
// even after the server is closed and restarted days later.
const CACHE_DIR = path.join(__dirname, '..', '..', '.friday-data', 'cache');
const SESSIONS_DIR = path.join(CACHE_DIR, 'sessions');
const INDEX_FILE = path.join(CACHE_DIR, 'index.json');

// Ensure directories exist
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });

let currentCacheSession = null;

function loadCacheIndex() {
  try {
    if (fs.existsSync(INDEX_FILE)) {
      return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
    }
  } catch (_) {}
  return { sessions: [], frequency: {}, topics: {} };
}

function saveCacheIndex(index) {
  try {
    fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[Friday Cache] Failed to save index:', e.message);
  }
}

// IPC: Start a new cache session
ipcMain.handle('cache-start-session', () => {
  const now = new Date();
  const id = now.toISOString().slice(0, 16).replace(/[T:]/g, '-');
  currentCacheSession = {
    id,
    startedAt: now.toISOString(),
    turns: [],
    toolsUsed: [],
    topics: [],
  };
  console.log(`[Friday Cache] Session started: ${id}`);
  return { success: true, sessionId: id };
});

// IPC: Save a conversation turn to current session
ipcMain.handle('cache-save-turn', (event, { role, text, toolName, toolArgs, toolResult }) => {
  if (!currentCacheSession) return { success: false };

  const turn = {
    role,
    text: (text || '').slice(0, 1000),
    ts: new Date().toISOString(),
  };

  if (toolName) {
    turn.toolName = toolName;
    turn.toolArgs = toolArgs;
    turn.toolResult = typeof toolResult === 'string'
      ? toolResult.slice(0, 500)
      : JSON.stringify(toolResult || {}).slice(0, 500);
    if (!currentCacheSession.toolsUsed.includes(toolName)) {
      currentCacheSession.toolsUsed.push(toolName);
    }
  }

  currentCacheSession.turns.push(turn);

  // Auto-save every 10 turns for crash resilience
  if (currentCacheSession.turns.length % 10 === 0) {
    try {
      const sessionPath = path.join(SESSIONS_DIR, `${currentCacheSession.id}.json`);
      fs.writeFileSync(sessionPath, JSON.stringify(currentCacheSession, null, 2));
    } catch (_) {}
  }

  return { success: true };
});

// IPC: Record a real summary/topics for the CURRENT session.
// Called by the saveSessionSummary tool. Without this, every session in the
// index ended up with the same "Session ended by user disconnect." placeholder
// and an empty topics map, which made the whole index useless for recall.
ipcMain.handle('cache-set-session-summary', (event, { summary, topics }) => {
  if (!currentCacheSession) return { success: false };
  if (summary) currentCacheSession.pendingSummary = summary;
  if (Array.isArray(topics) && topics.length) {
    currentCacheSession.pendingTopics = topics;
  }
  return { success: true };
});

// IPC: End session and persist
ipcMain.handle('cache-end-session', (event, { summary, topics }) => {
  if (!currentCacheSession) return { success: false };

  currentCacheSession.endedAt = new Date().toISOString();
  // Prefer a real summary/topics recorded during the session over the generic
  // disconnect placeholder the caller passes in.
  const pendingTopics = currentCacheSession.pendingTopics;
  const pendingSummary = currentCacheSession.pendingSummary;
  topics = (Array.isArray(pendingTopics) && pendingTopics.length) ? pendingTopics : (topics || []);
  currentCacheSession.topics = topics;
  currentCacheSession.summary = pendingSummary || summary || '';
  delete currentCacheSession.pendingSummary;
  delete currentCacheSession.pendingTopics;

  // Save session file
  try {
    const sessionPath = path.join(SESSIONS_DIR, `${currentCacheSession.id}.json`);
    fs.writeFileSync(sessionPath, JSON.stringify(currentCacheSession, null, 2));
    console.log(`[Friday Cache] Session saved: ${currentCacheSession.id}`);
  } catch (e) {
    console.warn('[Friday Cache] Failed to save session file:', e.message);
  }

  // Update index
  const index = loadCacheIndex();
  index.sessions.unshift({
    id: currentCacheSession.id,
    startedAt: currentCacheSession.startedAt,
    endedAt: currentCacheSession.endedAt,
    summary: currentCacheSession.summary,
    topics: currentCacheSession.topics,
    toolCount: currentCacheSession.turns.filter(t => t.toolName).length,
  });

  // Keep only last 200 sessions in index
  if (index.sessions.length > 200) index.sessions = index.sessions.slice(0, 200);

  // Update tool frequency
  for (const turn of currentCacheSession.turns) {
    if (turn.toolName) {
      index.frequency[turn.toolName] = (index.frequency[turn.toolName] || 0) + 1;
    }
  }

  // Update topic frequency
  for (const topic of (topics || [])) {
    const t = topic.toLowerCase().trim();
    if (t) index.topics[t] = (index.topics[t] || 0) + 1;
  }

  saveCacheIndex(index);
  currentCacheSession = null;

  return { success: true };
});

// IPC: Get conversation context for system prompt injection
ipcMain.handle('cache-get-context', () => {
  const index = loadCacheIndex();

  // Last 10 session summaries
  const recentSessions = index.sessions.slice(0, 10)
    .filter(s => s.summary)
    .map(s => `[${(s.startedAt || '').slice(0, 10)}] ${s.summary}`)
    .join('\n');

  // Top 10 most frequent tools
  const topTools = Object.entries(index.frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tool, count]) => `${tool}: ${count}x`)
    .join(', ');

  // Top topics
  const topTopics = Object.entries(index.topics)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([topic, count]) => `${topic} (${count}x)`)
    .join(', ');

  // Load last 3 full sessions for detailed recall
  const detailedHistory = [];
  for (const session of index.sessions.slice(0, 3)) {
    try {
      const sessionPath = path.join(SESSIONS_DIR, `${session.id}.json`);
      if (fs.existsSync(sessionPath)) {
        const data = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
        const toolTurns = data.turns.filter(t => t.toolName).slice(-15);
        detailedHistory.push({
          date: (session.startedAt || '').slice(0, 10),
          summary: session.summary,
          actions: toolTurns.map(t =>
            `${t.toolName}(${JSON.stringify(t.toolArgs || {}).slice(0, 80)})`
          ),
        });
      }
    } catch (_) {}
  }

  return {
    success: true,
    recentSessions,
    topTools,
    topTopics,
    detailedHistory: JSON.stringify(detailedHistory, null, 1),
    totalSessions: index.sessions.length,
  };
});

// IPC: Get frequent actions for idle suggestion system
ipcMain.handle('cache-get-frequent', () => {
  const index = loadCacheIndex();

  const topTools = Object.entries(index.frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const topTopics = Object.entries(index.topics)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return { success: true, topTools, topTopics };
});

// ─── Pattern mining (time-of-day + recency) ──────────────────────────────────
// `cache-get-frequent` only knows lifetime totals, which makes suggestions like
// "you use searchWeb a lot" — true but useless. The per-turn timestamps needed
// for "you usually do X around now" have been written to sessions/*.json all
// along; nothing read them until this handler.

function timeBucket(hour) {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

const PATTERN_SESSION_LIMIT = 30;   // bound the I/O
const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
// Historical sessions don't change while the app runs, so the expensive part
// is worth reusing. Only the live session's turns are re-read each call.
const PATTERN_CACHE_TTL = 10 * 60 * 1000;
let patternHistoryCache = null;   // { at, sources }

/**
 * Reads recent session files ASYNCHRONOUSLY.
 *
 * This was originally sync, which meant up to 40 blocking readFileSync calls
 * on the main process — the same process that serves every IPC channel, so a
 * slow disk would stall the whole UI. fs.promises + a TTL cache keeps it off
 * the critical path.
 */
async function loadPatternHistory(index) {
  if (patternHistoryCache && Date.now() - patternHistoryCache.at < PATTERN_CACHE_TTL) {
    return patternHistoryCache.sources;
  }

  const ids = index.sessions.slice(0, PATTERN_SESSION_LIMIT).map(s => s.id);
  const results = await Promise.all(ids.map(async (id) => {
    try {
      const raw = await fs.promises.readFile(path.join(SESSIONS_DIR, `${id}.json`), 'utf-8');
      const data = JSON.parse(raw);
      return Array.isArray(data.turns) ? data.turns : null;
    } catch (_) {
      return null;   // missing or corrupt session files are skipped, not fatal
    }
  }));

  const sources = results.filter(Boolean);
  patternHistoryCache = { at: Date.now(), sources };
  return sources;
}

ipcMain.handle('cache-get-patterns', async () => {
  try {
    const index = loadCacheIndex();
    const now = Date.now();
    const currentBucket = timeBucket(new Date().getHours());

    const bucketCounts = {};   // tools used in the CURRENT time-of-day bucket
    const recentCounts = {};   // tools used in the last 7 days
    let sampleSize = 0;

    // Live session first so suggestions reflect what's happening right now;
    // it's read fresh every call rather than from the cache.
    const liveTurns = currentCacheSession ? currentCacheSession.turns : [];
    const sources = [liveTurns, ...(await loadPatternHistory(index))];

    for (const turns of sources) {
      for (const turn of turns) {
        if (!turn.toolName || !turn.ts) continue;
        const t = new Date(turn.ts);
        if (Number.isNaN(t.getTime())) continue;
        sampleSize++;

        if (timeBucket(t.getHours()) === currentBucket) {
          bucketCounts[turn.toolName] = (bucketCounts[turn.toolName] || 0) + 1;
        }
        if (now - t.getTime() <= RECENT_WINDOW_MS) {
          recentCounts[turn.toolName] = (recentCounts[turn.toolName] || 0) + 1;
        }
      }
    }

    const top = (obj, n) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);

    return {
      success: true,
      currentBucket,
      bucketTools: top(bucketCounts, 6),
      recentTools: top(recentCounts, 6),
      topTools: top(index.frequency || {}, 6),
      sampleSize,
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

/**
 * Flush the in-flight session to disk. Called on app quit — previously nothing
 * ran on close, so an unclean exit lost up to 9 buffered turns AND the entire
 * index entry for that session.
 */
function flushCurrentSession() {
  if (!currentCacheSession) return;
  try {
    currentCacheSession.endedAt = new Date().toISOString();
    if (!currentCacheSession.summary) {
      currentCacheSession.summary = currentCacheSession.pendingSummary || 'Session ended when the app closed.';
    }
    const sessionPath = path.join(SESSIONS_DIR, `${currentCacheSession.id}.json`);
    fs.writeFileSync(sessionPath, JSON.stringify(currentCacheSession, null, 2));

    const index = loadCacheIndex();
    // Don't double-add if this session is already indexed.
    if (!index.sessions.some(s => s.id === currentCacheSession.id)) {
      index.sessions.unshift({
        id: currentCacheSession.id,
        startedAt: currentCacheSession.startedAt,
        endedAt: currentCacheSession.endedAt,
        summary: currentCacheSession.summary,
        topics: currentCacheSession.topics || [],
        toolCount: currentCacheSession.turns.filter(t => t.toolName).length,
      });
      if (index.sessions.length > 200) index.sessions = index.sessions.slice(0, 200);
      for (const turn of currentCacheSession.turns) {
        if (turn.toolName) {
          index.frequency[turn.toolName] = (index.frequency[turn.toolName] || 0) + 1;
        }
      }
      saveCacheIndex(index);
    }
    console.log(`[Friday Cache] Flushed session on quit: ${currentCacheSession.id}`);
  } catch (e) {
    console.warn('[Friday Cache] Flush on quit failed:', e.message);
  }
  currentCacheSession = null;
}

module.exports = { flushCurrentSession };

