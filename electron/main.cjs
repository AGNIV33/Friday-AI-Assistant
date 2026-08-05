const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// ── Load .env file into process.env ───────────────────────────────
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

// ── Single-instance lock ───────────────────────────────────────────
// Prevents a second instance from fighting over the same cache files,
// which is the root cause of the "Unable to move the cache" 0x5 errors.
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log('[Friday] Another instance is already running. Quitting this one.');
  app.quit();
  process.exit(0);
}

// ── Project-local user-data path ──────────────────────────────────
// By default Electron uses C:\Users\<user>\AppData\Roaming\Electron which is
// shared between ALL Electron apps. This causes file-lock conflicts when a
// previous dev-mode process hasn't fully released the cache.
// Pointing to a specific, isolated folder in AppData guarantees no locks and prevents Vite from watching it.
const USER_DATA_PATH = path.join(app.getPath('appData'), 'friday-ai-dev-data');
if (!fs.existsSync(USER_DATA_PATH)) fs.mkdirSync(USER_DATA_PATH, { recursive: true });
app.setPath('userData', USER_DATA_PATH);
// Also explicitly point the disk cache to avoid any OS-level locking issues.
const CACHE_PATH = path.join(USER_DATA_PATH, 'cache');
app.commandLine.appendSwitch('disk-cache-dir', CACHE_PATH);

// ── Self-healing cache guard ──────────────────────────────────────────────────
// If a previous session crashed mid-write, Chromium leaves behind a partially
// written block_files / entry_impl structure that triggers:
//   "Failing CreateMapBlock" and "Failed to save user data"
// We detect a corrupt cache by probing for the sentinel "index" file.
// If the directory exists but the index is missing or zero-bytes → wipe and let
// Chromium recreate the cache from scratch.
(function purgeStaleCacheIfCorrupted() {
  try {
    if (!fs.existsSync(CACHE_PATH)) return; // nothing to check
    // Modern Chromium puts the cache inside a 'Cache_Data' subdirectory
    const indexFile = path.join(CACHE_PATH, 'Cache_Data', 'index');
    const corrupt =
      !fs.existsSync(indexFile) ||
      fs.statSync(indexFile).size === 0;
    if (corrupt) {
      console.log('[Friday] Corrupted disk cache detected — purging:', CACHE_PATH);
      fs.rmSync(CACHE_PATH, { recursive: true, force: true });
      console.log('[Friday] Cache purged. Chromium will recreate it on first run.');
    }
  } catch (e) {
    // Non-fatal: if we can't clean up just let Chromium handle it
    console.warn('[Friday] Cache integrity check failed (non-fatal):', e.message);
  }
})();

// ── GPU & Rendering Performance ──────────────────────────────────────────────
// Force dedicated GPU and enable all hardware-acceleration paths.
app.commandLine.appendSwitch('force_high_performance_gpu');
app.commandLine.appendSwitch('ignore-gpu-blocklist');              // never fall back to software
app.commandLine.appendSwitch('enable-gpu-rasterization');          // rasterise on GPU
app.commandLine.appendSwitch('enable-zero-copy');                  // DMA texture uploads
app.commandLine.appendSwitch('enable-accelerated-2d-canvas');      // Canvas2D on GPU
app.commandLine.appendSwitch('disable-frame-rate-limit');          // remove artificial fps cap
app.commandLine.appendSwitch('disable-software-rasterizer');       // never allow CPU fallback
// NOTE: disable-gpu-vsync REMOVED — causes "GPU state invalid" errors on Windows/D3D11
// NOTE: VaapiVideoDecoder REMOVED — Linux VA-API only, causes GPU errors on Windows
// OOP-Rasterization + GPU process compositing (Chromium M80+)
app.commandLine.appendSwitch('enable-features',
  'CanvasOopRasterization,UseSkiaRenderer,GpuMemoryBufferCompositorResources');
app.commandLine.appendSwitch('use-gl', 'angle');                   // ANGLE OpenGL backend
app.commandLine.appendSwitch('use-angle', 'd3d11');                // D3D11 via ANGLE on Windows

// ── Suppress noisy Chromium stderr ───────────────────────────────────────────
// `chunked_data_pipe_upload_data_stream.cc OnSizeReceived failed with Error: -2`
// These are harmless Chromium-internal errors caused by:
//   1. webkitSpeechRecognition streaming audio uploads being torn down when
//      the recognition session restarts (wake-word detector cycles).
//   2. Gemini Live WebSocket/streaming connections being closed during reconnects.
// Error -2 = ERR_FAILED in Chromium net — the aborted upload stream fails to
// report its final size. Completely benign; cannot be caught in JS.
//
// --disable-logging kills ALL Chromium C++ LOG() output across every subprocess
// (browser, renderer, network service, GPU). This is stronger than --log-level=3
// which only affects the browser process — chunked_data_pipe errors come from
// the network service subprocess.
// Our own console.log/warn/error are NOT affected (they use Node.js stdio).
app.commandLine.appendSwitch('disable-logging');
// Belt-and-suspenders: also set env var before any child process spawns
process.env.ELECTRON_ENABLE_LOGGING = '';
// Fallback: if Chromium still leaks some logs, at least keep them FATAL-only
app.commandLine.appendSwitch('log-level', '3');


// Global unhandled rejection handler to silently drop noisy `whatsapp-web.js` execution context crashes
process.on('unhandledRejection', (reason, promise) => {
  if (reason && reason.message && (
      reason.message.includes('Execution context was destroyed') || 
      reason.message.includes('EBUSY: resource busy or locked') ||
      reason.message.includes('ProtocolError: Could not load response body') ||
      reason.message.includes('auth timeout')
  )) {
    // Ignore routine Puppeteer/network noise from whatsapp-web.js
    return;
  }
  console.error('[Unhandled Rejection]', reason);
});


// ── Window management ──────────────────────────────────────────────
const { createWindow } = require('./window.cjs');

// ── IPC handler modules (each registers its own ipcMain.handle channels) ────
require('./ipc/whatsapp.cjs');
require('./ipc/system-controls.cjs');
require('./ipc/apps.cjs');
require('./ipc/files.cjs');
require('./ipc/media.cjs');
require('./ipc/documents.cjs');
const memoryCache = require('./ipc/memory-cache.cjs');
require('./ipc/vision.cjs');
require('./ipc/routines.cjs');
require('./ipc/notes.cjs');
require('./ipc/documents-read.cjs');
const clipboardHistory = require('./ipc/clipboard.cjs');

// ── Proactive subsystems (registers IPC on require; inert until started) ────
const scheduler = require('./ipc/scheduler.cjs');
const monitors = require('./monitors.cjs');

// Persist the in-flight conversation session on quit. Without this, closing the
// app discarded up to 9 buffered turns and the session's entire index entry.
app.on('before-quit', () => {
  try { memoryCache.flushCurrentSession(); } catch (_) {}
  // Clipboard writes are debounced, so anything copied in the last few seconds
  // is still only in memory — force it to disk before we exit.
  try { clipboardHistory.flush(); } catch (_) {}
});

// ─── Hardware Acceleration & Performance Optimization ─────────────────────────
// Force hardware acceleration to eliminate UI lag with CSS animations and Canvas
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('enable-features', 'CanvasOopRasterization,UseSkiaRenderer');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-frame-rate-limit');
app.commandLine.appendSwitch('disable-quic'); // Suppress noisy QUIC connection errors in console


app.whenReady().then(() => {
  createWindow();

  // Start after the window exists — both push events through the proactive bus,
  // which needs a live BrowserWindow to deliver to.
  scheduler.start();
  monitors.start();
  clipboardHistory.start();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
