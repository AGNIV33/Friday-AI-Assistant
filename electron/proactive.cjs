// ─── Proactive Event Bus (main → renderer) ────────────────────────────────────
// The rest of the IPC surface is request/response (renderer calls, main answers).
// This is the one channel that goes the other way: it lets the main process
// (schedulers, monitors) tell the renderer something happened, so Friday can
// speak without being asked.
//
// The renderer decides whether/when to actually voice it — see useProactive.ts.
// This module only delivers; it does not gate on user settings.

let mainWindow = null;

/** Called by window.cjs once the BrowserWindow exists. */
function setMainWindow(win) {
  mainWindow = win;
}

/**
 * @param {object} event
 * @param {string} event.kind      Stable id for de-duplication, e.g. 'system-health'
 * @param {'critical'|'normal'|'low'} event.priority
 * @param {string} event.text      Instruction for the model, not literal speech
 * @param {object} [event.data]    Optional structured payload for the renderer
 */
function emitProactive(event) {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  try {
    mainWindow.webContents.send('friday:proactive', {
      kind: event.kind,
      priority: event.priority || 'normal',
      text: event.text,
      data: event.data || null,
      at: new Date().toISOString(),
    });
    return true;
  } catch (e) {
    console.warn('[Proactive] Failed to emit event:', e.message);
    return false;
  }
}

module.exports = { setMainWindow, emitProactive };
