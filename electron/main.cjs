const { app, BrowserWindow, ipcMain, shell, Tray, nativeImage } = require('electron');
const path = require('path');
const isDev = !app.isPackaged;
const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');
const https = require('https');

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
    const indexFile = path.join(CACHE_PATH, 'index');
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
// Force dedicated GPU (GTX 1650) and enable all hardware-acceleration paths.
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

// ─── WhatsApp Service (whatsapp-web.js) — LAZY LOADED for fast startup ──────
// whatsapp-web.js pulls in puppeteer-core which is heavy.
// We defer the require() until the user actually requests WhatsApp.
let Client, LocalAuth, QRCode;
let whatsappModulesLoaded = false;

function ensureWhatsAppModules() {
  if (!whatsappModulesLoaded) {
    const wwjs = require('whatsapp-web.js');
    Client = wwjs.Client;
    LocalAuth = wwjs.LocalAuth;
    QRCode = require('qrcode');
    whatsappModulesLoaded = true;
    console.log('[Friday] WhatsApp modules loaded on demand.');
  }
}

let whatsappClient = null;
let whatsappState = 'disconnected'; // disconnected | connecting | qr_pending | connected | failed
let whatsappQR = null;
let whatsappInfo = null;

function getChromePath() {
  const possiblePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    // Edge as fallback
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function initWhatsApp() {
  if (whatsappClient) {
    // Already initialised or connecting
    if (whatsappState === 'connected') {
      return Promise.resolve({ success: true, status: 'already_connected' });
    }
    if (whatsappState === 'qr_pending') {
      return Promise.resolve({ success: true, status: 'qr_pending', message: 'QR code is displayed in the terminal. Please scan it with your WhatsApp app.' });
    }
    if (whatsappState === 'connecting') {
      return Promise.resolve({ success: true, status: 'connecting', message: 'WhatsApp is already in the process of initializing.' });
    }
  }

  return new Promise((resolve) => {
    ensureWhatsAppModules();
    const chromePath = getChromePath();
    if (!chromePath) {
      whatsappState = 'failed';
      resolve({ success: false, error: 'Could not find Chrome or Edge on your system.' });
      return;
    }

    console.log('[Friday WhatsApp] Initializing with Chrome:', chromePath);
    whatsappState = 'connecting';

    const sessionDir = path.join(app.getPath('userData'), 'whatsapp-session');
    if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

    whatsappClient = new Client({
      authStrategy: new LocalAuth({ dataPath: sessionDir }),
      authTimeoutMs: 300000, // 5 minutes to scan QR
      qrMaxRetries: 5,       // Show QR up to 5 times before giving up
      puppeteer: {
        executablePath: chromePath,
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-software-rasterizer',
        ],
      },
    });

    whatsappClient.on('qr', async (qr) => {
      whatsappQR = qr;
      whatsappState = 'qr_pending';
      console.log('[Friday WhatsApp] QR code received. Generating image...');

      try {
        // Save QR as a PNG image and open in Photos
        const qrDir = path.join(os.tmpdir(), 'friday-whatsapp');
        if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir, { recursive: true });
        const qrPath = path.join(qrDir, 'whatsapp_qr.png');

        await QRCode.toFile(qrPath, qr, {
          type: 'png',
          width: 512,
          margin: 2,
          color: { dark: '#000000', light: '#FFFFFF' },
        });

        console.log(`[Friday WhatsApp] QR code saved to: ${qrPath}`);
        console.log('[Friday WhatsApp] Opening in Photos app...');
        console.log('[Friday WhatsApp] Scan with WhatsApp > Settings > Linked Devices > Link a Device');

        // Open in default image viewer (Photos on Windows)
        if (process.platform === 'win32') {
          exec(`start "" "${qrPath}"`);
        } else {
          shell.openPath(qrPath).catch(() => {});
        }
      } catch (err) {
        console.error('[Friday WhatsApp] Failed to generate QR image:', err.message);
      }
    });

    whatsappClient.on('ready', () => {
      whatsappState = 'connected';
      whatsappQR = null;
      whatsappInfo = whatsappClient.info;
      console.log('[Friday WhatsApp] ✓ Connected successfully as', whatsappClient.info?.pushname || 'Unknown');

      // Auto-close Photos app showing the QR code & delete temp QR file
      try {
        const qrDir = path.join(os.tmpdir(), 'friday-whatsapp');
        const qrPath = path.join(qrDir, 'whatsapp_qr.png');
        // Kill ALL possible photo viewer processes on Windows
        const photoProcesses = [
          'Microsoft.Photos.exe',
          'PhotosApp.exe',
          'dllhost.exe',         // Windows Photo Viewer host
          'Photos.exe',
        ];
        for (const proc of photoProcesses) {
          exec(`taskkill /F /IM "${proc}" 2>nul`, () => {});
        }
        // Also kill by window title as a fallback
        exec('powershell -NoProfile -Command "Get-Process | Where-Object { $_.MainWindowTitle -match \'(?i)whatsapp_qr|Photos|Photo Viewer\' } | Stop-Process -Force -ErrorAction SilentlyContinue"', () => {});
        // Small delay then delete temp file
        setTimeout(() => {
          try { if (fs.existsSync(qrPath)) fs.unlinkSync(qrPath); } catch (_) {}
        }, 1500);
      } catch (_) {}
    });

    whatsappClient.on('authenticated', () => {
      console.log('[Friday WhatsApp] ✓ Authenticated (session restored)');
    });

    whatsappClient.on('auth_failure', (msg) => {
      whatsappState = 'failed';
      whatsappClient = null;
      console.error('[Friday WhatsApp] Authentication failed:', msg);
    });

    whatsappClient.on('disconnected', (reason) => {
      whatsappState = 'disconnected';
      whatsappClient = null;
      console.log('[Friday WhatsApp] Disconnected:', reason);
    });

    whatsappClient.initialize()
      .then(() => {
        resolve({ success: true, status: whatsappState, message: whatsappState === 'qr_pending' ? 'QR code displayed in terminal. Please scan it with WhatsApp.' : 'Initializing...' });
      })
      .catch((err) => {
        console.error('[Friday WhatsApp] Init error:', err.message);
        whatsappState = 'failed';
        
        // Self-Healing: If we hit a zombie lock, aggressively kill the ghost Chromium so next time succeeds.
        if (err.message.includes('already running') || err.message.includes('EBUSY')) {
          console.log('[Friday WhatsApp] Detecting zombie browser lock. Executing auto-cleanup...');
          const killCmd = `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | Where-Object CommandLine -match 'whatsapp-session' | Invoke-CimMethod -MethodName Terminate"`;
          exec(killCmd, () => {
            console.log('[Friday WhatsApp] Zombie lock cleared. Ready for next init.');
          });
          resolve({ success: false, error: 'Cleared a frozen background state. Please try connecting to WhatsApp again now.' });
          whatsappClient = null;
          return;
        }

        resolve({ success: false, error: err.message });
      });
  });
}

// IPC: Initialize WhatsApp
ipcMain.handle('whatsapp-init', async () => {
  return await initWhatsApp();
});

// IPC: Get WhatsApp connection status
ipcMain.handle('whatsapp-status', async () => {
  return {
    success: true,
    status: whatsappState,
    user: whatsappInfo?.pushname || null,
    phone: whatsappInfo?.wid?.user || null,
  };
});

// IPC: Logout WhatsApp (fully disconnect and wipe session)
ipcMain.handle('whatsapp-logout', async () => {
  if (!whatsappClient) {
    whatsappState = 'disconnected';
    return { success: true, message: 'WhatsApp was not connected.' };
  }

  try {
    console.log('[Friday WhatsApp] Logging out...');
    await whatsappClient.logout();
    console.log('[Friday WhatsApp] ✓ Logged out successfully.');
  } catch (err) {
    console.warn('[Friday WhatsApp] Logout error (forcing cleanup):', err.message);
    // Force-close the browser even if logout call failed
    try {
      if (whatsappClient.pupBrowser) await whatsappClient.pupBrowser.close();
    } catch (_) {}
  }

  whatsappClient = null;
  whatsappState = 'disconnected';
  whatsappInfo = null;
  whatsappQR = null;

  // Clean up saved session data so next connect requires a fresh QR scan
  const sessionDir = path.join(app.getPath('userData'), 'whatsapp-session');
  try {
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
      console.log('[Friday WhatsApp] Session data wiped.');
    }
  } catch (err) {
    console.warn('[Friday WhatsApp] Could not delete session folder:', err.message);
  }

  return { success: true, message: 'WhatsApp has been logged out and session data cleared.' };
});

// IPC: Send a WhatsApp message
ipcMain.handle('whatsapp-send', async (event, { contactNameOrNumber, message }) => {
  if (!whatsappClient || whatsappState !== 'connected') {
    return { success: false, error: 'WhatsApp is not connected. Please initialize it first and scan the QR code.' };
  }

  // Safety check: ensure Puppeteer hasn't silently crashed in the background
  if (!whatsappClient.pupPage || whatsappClient.pupPage.isClosed()) {
    console.error('[Friday WhatsApp] Background page crashed or closed. Cleaning up...');
    try {
      if (whatsappClient.pupBrowser) await whatsappClient.pupBrowser.close();
    } catch (_) {}
    whatsappState = 'failed';
    whatsappClient = null;
    return { success: false, error: 'WhatsApp background process unexpectedly closed. Please call initWhatsApp to re-initialize the connection.' };
  }

  try {
    let chatId = null;

    // Check if it's a phone number (starts with + or is all digits)
    const cleanNumber = contactNameOrNumber.replace(/[\s\-\(\)]/g, '');
    if (/^\+?\d{10,15}$/.test(cleanNumber)) {
      // It's a phone number — format for WhatsApp (country code + number @c.us)
      const number = cleanNumber.startsWith('+') ? cleanNumber.slice(1) : cleanNumber;
      chatId = `${number}@c.us`;

      // Verify the number exists on WhatsApp
      const isRegistered = await whatsappClient.isRegisteredUser(chatId);
      if (!isRegistered) {
        return { success: false, error: `The number ${contactNameOrNumber} is not registered on WhatsApp.` };
      }
    } else {
      // It's a contact name — search contacts
      const contacts = await whatsappClient.getContacts();
      const searchName = contactNameOrNumber.toLowerCase().trim();

      // Try exact match first, then partial/fuzzy
      let match = contacts.find(c => c.name && c.name.toLowerCase() === searchName);
      if (!match) {
        match = contacts.find(c => c.pushname && c.pushname.toLowerCase() === searchName);
      }
      if (!match) {
        // Partial match
        match = contacts.find(c =>
          (c.name && c.name.toLowerCase().includes(searchName)) ||
          (c.pushname && c.pushname.toLowerCase().includes(searchName))
        );
      }
      if (!match) {
        // Even fuzzier — check if search term words appear in contact name
        const searchWords = searchName.split(/\s+/);
        match = contacts.find(c => {
          const fullName = (c.name || c.pushname || '').toLowerCase();
          return searchWords.every(w => fullName.includes(w));
        });
      }

      if (!match) {
        // Return top 5 similar contacts for the user
        const suggestions = contacts
          .filter(c => c.name || c.pushname)
          .filter(c => {
            const name = (c.name || c.pushname || '').toLowerCase();
            return searchName.split(/\s+/).some(w => name.includes(w));
          })
          .slice(0, 5)
          .map(c => c.name || c.pushname);

        return {
          success: false,
          error: `Could not find a contact named "${contactNameOrNumber}".`,
          suggestions: suggestions.length > 0 ? suggestions : undefined,
        };
      }

      chatId = match.id._serialized;
      console.log(`[Friday WhatsApp] Matched contact: "${match.name || match.pushname}" (${chatId})`);
    }

    // Send the message
    await whatsappClient.sendMessage(chatId, message);
    console.log(`[Friday WhatsApp] ✓ Message sent to ${contactNameOrNumber}`);
    return { success: true, message: `Message sent to ${contactNameOrNumber} successfully.` };

  } catch (err) {
    console.error('[Friday WhatsApp] Send error:', err.message);
    if (err.message.includes('evaluate') || err.message.includes('Target closed') || err.message.includes('Session closed')) {
      console.error('[Friday WhatsApp] Session corrupted, cleaning up browser memory...');
      try {
        if (whatsappClient && whatsappClient.pupBrowser) await whatsappClient.pupBrowser.close();
      } catch (_) {}
      whatsappState = 'failed'; // Mark as failed so it can be re-initialized
      whatsappClient = null;
      return { success: false, error: 'WhatsApp web session crashed. Please ask the user to re-initialize the connection by calling initWhatsApp' };
    }
    return { success: false, error: `Failed to send message: ${err.message}` };
  }
});

// ─── System Controls (Volume, Brightness, Settings) ─────────────────────────

// Volume control via Windows Core Audio API (each action uses Base64-encoded PowerShell)

ipcMain.handle('system-volume', async (event, { action, level }) => {
  return new Promise((resolve) => {
    let psScript = '';
    switch (action) {
      case 'set': {
        const vol = Math.max(0, Math.min(100, Number(level) || 0)) / 100;
        psScript = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
  int f(); int g(); int h(); int i();
  int SetMasterVolumeLevelScalar(float fLevel, System.Guid pguidEventContext);
  int j();
  int GetMasterVolumeLevelScalar(out float pfLevel);
  int k();
  int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, System.Guid pguidEventContext);
  int GetMute(out bool pbMute);
}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice {
  int Activate(ref System.Guid id, int clsCtx, int activationParams, out IAudioEndpointVolume aev);
}
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator {
  int f();
  int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
}
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorComObject { }
public class Audio {
  static IAudioEndpointVolume Vol() {
    var enumerator = new MMDeviceEnumeratorComObject() as IMMDeviceEnumerator;
    IMMDevice dev = null;
    Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(0, 1, out dev));
    IAudioEndpointVolume epv = null;
    var epvid = typeof(IAudioEndpointVolume).GUID;
    Marshal.ThrowExceptionForHR(dev.Activate(ref epvid, 23, 0, out epv));
    return epv;
  }
  public static float Volume {
    get { float v = -1; Marshal.ThrowExceptionForHR(Vol().GetMasterVolumeLevelScalar(out v)); return v; }
    set { Marshal.ThrowExceptionForHR(Vol().SetMasterVolumeLevelScalar(value, System.Guid.Empty)); }
  }
  public static bool Mute {
    get { bool mute; Marshal.ThrowExceptionForHR(Vol().GetMute(out mute)); return mute; }
    set { Marshal.ThrowExceptionForHR(Vol().SetMute(value, System.Guid.Empty)); }
  }
}
'@
[Audio]::Volume = ${vol}
Write-Output "Volume set to ${Math.round(vol * 100)}%"
`;
        break;
      }
      case 'get':
        psScript = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
  int f(); int g(); int h(); int i();
  int SetMasterVolumeLevelScalar(float fLevel, System.Guid pguidEventContext);
  int j();
  int GetMasterVolumeLevelScalar(out float pfLevel);
  int k();
  int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, System.Guid pguidEventContext);
  int GetMute(out bool pbMute);
}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice {
  int Activate(ref System.Guid id, int clsCtx, int activationParams, out IAudioEndpointVolume aev);
}
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator {
  int f();
  int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
}
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorComObject { }
public class Audio {
  static IAudioEndpointVolume Vol() {
    var enumerator = new MMDeviceEnumeratorComObject() as IMMDeviceEnumerator;
    IMMDevice dev = null;
    Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(0, 1, out dev));
    IAudioEndpointVolume epv = null;
    var epvid = typeof(IAudioEndpointVolume).GUID;
    Marshal.ThrowExceptionForHR(dev.Activate(ref epvid, 23, 0, out epv));
    return epv;
  }
  public static float Volume {
    get { float v = -1; Marshal.ThrowExceptionForHR(Vol().GetMasterVolumeLevelScalar(out v)); return v; }
    set { Marshal.ThrowExceptionForHR(Vol().SetMasterVolumeLevelScalar(value, System.Guid.Empty)); }
  }
  public static bool Mute {
    get { bool mute; Marshal.ThrowExceptionForHR(Vol().GetMute(out mute)); return mute; }
    set { Marshal.ThrowExceptionForHR(Vol().SetMute(value, System.Guid.Empty)); }
  }
}
'@
Write-Output ([Math]::Round([Audio]::Volume * 100))
`;
        break;
      case 'mute':
        psScript = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
  int f(); int g(); int h(); int i();
  int SetMasterVolumeLevelScalar(float fLevel, System.Guid pguidEventContext);
  int j();
  int GetMasterVolumeLevelScalar(out float pfLevel);
  int k();
  int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, System.Guid pguidEventContext);
  int GetMute(out bool pbMute);
}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice {
  int Activate(ref System.Guid id, int clsCtx, int activationParams, out IAudioEndpointVolume aev);
}
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator {
  int f();
  int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
}
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorComObject { }
public class Audio {
  static IAudioEndpointVolume Vol() {
    var enumerator = new MMDeviceEnumeratorComObject() as IMMDeviceEnumerator;
    IMMDevice dev = null;
    Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(0, 1, out dev));
    IAudioEndpointVolume epv = null;
    var epvid = typeof(IAudioEndpointVolume).GUID;
    Marshal.ThrowExceptionForHR(dev.Activate(ref epvid, 23, 0, out epv));
    return epv;
  }
  public static float Volume {
    get { float v = -1; Marshal.ThrowExceptionForHR(Vol().GetMasterVolumeLevelScalar(out v)); return v; }
    set { Marshal.ThrowExceptionForHR(Vol().SetMasterVolumeLevelScalar(value, System.Guid.Empty)); }
  }
  public static bool Mute {
    get { bool mute; Marshal.ThrowExceptionForHR(Vol().GetMute(out mute)); return mute; }
    set { Marshal.ThrowExceptionForHR(Vol().SetMute(value, System.Guid.Empty)); }
  }
}
'@
[Audio]::Mute = $true
Write-Output "Muted"
`;
        break;
      case 'unmute':
        psScript = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
  int f(); int g(); int h(); int i();
  int SetMasterVolumeLevelScalar(float fLevel, System.Guid pguidEventContext);
  int j();
  int GetMasterVolumeLevelScalar(out float pfLevel);
  int k();
  int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, System.Guid pguidEventContext);
  int GetMute(out bool pbMute);
}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice {
  int Activate(ref System.Guid id, int clsCtx, int activationParams, out IAudioEndpointVolume aev);
}
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator {
  int f();
  int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
}
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorComObject { }
public class Audio {
  static IAudioEndpointVolume Vol() {
    var enumerator = new MMDeviceEnumeratorComObject() as IMMDeviceEnumerator;
    IMMDevice dev = null;
    Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(0, 1, out dev));
    IAudioEndpointVolume epv = null;
    var epvid = typeof(IAudioEndpointVolume).GUID;
    Marshal.ThrowExceptionForHR(dev.Activate(ref epvid, 23, 0, out epv));
    return epv;
  }
  public static float Volume {
    get { float v = -1; Marshal.ThrowExceptionForHR(Vol().GetMasterVolumeLevelScalar(out v)); return v; }
    set { Marshal.ThrowExceptionForHR(Vol().SetMasterVolumeLevelScalar(value, System.Guid.Empty)); }
  }
  public static bool Mute {
    get { bool mute; Marshal.ThrowExceptionForHR(Vol().GetMute(out mute)); return mute; }
    set { Marshal.ThrowExceptionForHR(Vol().SetMute(value, System.Guid.Empty)); }
  }
}
'@
[Audio]::Mute = $false
Write-Output "Unmuted"
`;
        break;
      default:
        resolve({ success: false, error: `Unknown volume action: ${action}` });
        return;
    }
    // Use Base64-encoded command to avoid all shell escaping issues
    const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
    exec(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`, { timeout: 15000 }, (error, stdout) => {
      resolve(error ? { success: false, error: error.message } : { success: true, result: stdout.trim() });
    });
  });
});

// Brightness control via WMI (laptops only)
ipcMain.handle('system-brightness', async (event, { action, level }) => {
  return new Promise((resolve) => {
    let psCommand = '';
    switch (action) {
      case 'set':
        const b = Math.max(0, Math.min(100, parseInt(level)));
        psCommand = `(Get-WmiObject -Namespace root/wmi -Class WmiMonitorBrightnessMethods).WmiSetBrightness(0, ${b}); Write-Output "Brightness set to ${b}%"`;
        break;
      case 'get':
        psCommand = `(Get-WmiObject -Namespace root/wmi -Class WmiMonitorBrightness).CurrentBrightness`;
        break;
      default:
        resolve({ success: false, error: `Unknown brightness action: ${action}` });
        return;
    }
    exec(`powershell -NoProfile -Command "${psCommand}"`, { timeout: 10000 }, (error, stdout) => {
      if (error && (error.message.includes('Not supported') || error.message.includes('WmiMonitorBrightness'))) {
        resolve({ success: false, error: 'Brightness control not available on this device (typically laptops only).' });
      } else {
        resolve(error ? { success: false, error: error.message } : { success: true, result: stdout.trim() });
      }
    });
  });
});

// Open Windows Settings pages
ipcMain.handle('open-settings', async (event, page) => {
  const settingsMap = {
    'home': 'ms-settings:', 'wifi': 'ms-settings:network-wifi', 'network': 'ms-settings:network-status',
    'bluetooth': 'ms-settings:bluetooth', 'display': 'ms-settings:display', 'sound': 'ms-settings:sound',
    'notifications': 'ms-settings:notifications', 'power': 'ms-settings:powersleep', 'battery': 'ms-settings:batterysaver',
    'storage': 'ms-settings:storagesense', 'personalization': 'ms-settings:personalization',
    'background': 'ms-settings:personalization-background', 'colors': 'ms-settings:personalization-colors',
    'lockscreen': 'ms-settings:lockscreen', 'themes': 'ms-settings:themes', 'apps': 'ms-settings:appsfeatures',
    'defaultapps': 'ms-settings:defaultapps', 'datetime': 'ms-settings:dateandtime', 'language': 'ms-settings:regionlanguage',
    'keyboard': 'ms-settings:keyboard', 'mouse': 'ms-settings:mousetouchpad', 'touchpad': 'ms-settings:devices-touchpad',
    'printers': 'ms-settings:printers', 'privacy': 'ms-settings:privacy', 'camera': 'ms-settings:privacy-webcam',
    'microphone': 'ms-settings:privacy-microphone', 'update': 'ms-settings:windowsupdate', 'about': 'ms-settings:about',
    'vpn': 'ms-settings:network-vpn', 'proxy': 'ms-settings:network-proxy', 'accounts': 'ms-settings:yourinfo',
    'signin': 'ms-settings:signinoptions', 'gaming': 'ms-settings:gaming-gamebar', 'accessibility': 'ms-settings:easeofaccess',
    'nightlight': 'ms-settings:nightlight',
  };
  const key = page.toLowerCase().trim().replace(/\s+/g, '');
  const uri = settingsMap[key] || `ms-settings:${key}`;
  return new Promise((resolve) => {
    exec(`start "" "${uri}"`, (error) => {
      resolve(error ? { success: false, error: error.message } : { success: true, message: `Opened ${page} settings.` });
    });
  });
});

// ─── Bluetooth & WiFi Control ───────────────────────────────────────────────

// Helper: Run complex PowerShell via Base64 encoding (avoids escaping nightmares)
function runPS(script, timeout = 15000) {
  return new Promise((resolve) => {
    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    exec(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`, { timeout }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: (stderr || error.message).trim() });
      } else {
        resolve({ success: true, result: stdout.trim() });
      }
    });
  });
}

// Windows Radio API helper (for Bluetooth & WiFi on/off without admin)
const RADIO_HELPER = `
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
Function Await($WinRtTask, $ResultType) {
  $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
  $netTask = $asTask.Invoke($null, @($WinRtTask))
  $netTask.Wait(-1) | Out-Null
  $netTask.Result
}
[Windows.Devices.Radios.Radio,Windows.System.Devices,ContentType=WindowsRuntime] | Out-Null
$radios = Await ([Windows.Devices.Radios.Radio]::GetRadiosAsync()) ([System.Collections.Generic.IReadOnlyList[Windows.Devices.Radios.Radio]])
`;

// Bluetooth Control
ipcMain.handle('bluetooth-control', async (event, { action, deviceName }) => {
  switch (action) {
    case 'on':
      return runPS(`${RADIO_HELPER}
$bt = $radios | Where-Object { $_.Kind -eq 'Bluetooth' }
if ($bt) { Await ($bt.SetStateAsync([Windows.Devices.Radios.RadioState]::On)) ([Windows.Devices.Radios.RadioAccessStatus]) | Out-Null; Write-Output 'Bluetooth turned on' }
else { Write-Output 'No Bluetooth radio found' }`);
    case 'off':
      return runPS(`${RADIO_HELPER}
$bt = $radios | Where-Object { $_.Kind -eq 'Bluetooth' }
if ($bt) { Await ($bt.SetStateAsync([Windows.Devices.Radios.RadioState]::Off)) ([Windows.Devices.Radios.RadioAccessStatus]) | Out-Null; Write-Output 'Bluetooth turned off' }
else { Write-Output 'No Bluetooth radio found' }`);
    case 'status':
      return runPS(`${RADIO_HELPER}
$bt = $radios | Where-Object { $_.Kind -eq 'Bluetooth' }
if ($bt) { Write-Output "Bluetooth is $($bt.State)" } else { Write-Output 'No Bluetooth radio found' }`);
    case 'scan':
      return runPS(`Get-PnpDevice -Class Bluetooth -PresentOnly -ErrorAction SilentlyContinue | Where-Object { $_.FriendlyName -and $_.Class -eq 'Bluetooth' } | Select-Object FriendlyName, Status, InstanceId | ConvertTo-Json -Compress`, 20000);
    case 'connect':
      // Programmatic BT device connection is extremely device-specific on Windows.
      // The most reliable approach is to open Bluetooth settings for the user.
      exec(`start "" "ms-settings:bluetooth"`, () => {});
      return { success: true, message: `Opened Bluetooth settings. Please select "${deviceName || 'the device'}" to connect. Tell me once it's done.` };
    default:
      return { success: false, error: `Unknown bluetooth action: ${action}` };
  }
});

// WiFi Control
ipcMain.handle('wifi-control', async (event, { action, networkName, password }) => {
  switch (action) {
    case 'on':
      return runPS(`${RADIO_HELPER}
$wifi = $radios | Where-Object { $_.Kind -eq 'WiFi' }
if ($wifi) { Await ($wifi.SetStateAsync([Windows.Devices.Radios.RadioState]::On)) ([Windows.Devices.Radios.RadioAccessStatus]) | Out-Null; Write-Output 'WiFi turned on' }
else { Write-Output 'No WiFi radio found' }`);
    case 'off':
      return runPS(`${RADIO_HELPER}
$wifi = $radios | Where-Object { $_.Kind -eq 'WiFi' }
if ($wifi) { Await ($wifi.SetStateAsync([Windows.Devices.Radios.RadioState]::Off)) ([Windows.Devices.Radios.RadioAccessStatus]) | Out-Null; Write-Output 'WiFi turned off' }
else { Write-Output 'No WiFi radio found' }`);
    case 'status':
      return runPS(`netsh interface show interface "Wi-Fi"`);
    case 'scan':
      return runPS(`$networks = netsh wlan show networks mode=bssid
$results = @()
$current = @{}
foreach ($line in $networks) {
  if ($line -match '^SSID \\d+ : (.+)') { if ($current.SSID) { $results += $current }; $current = @{ SSID = $Matches[1].Trim() } }
  elseif ($line -match 'Signal\\s+: (.+)') { $current.Signal = $Matches[1].Trim() }
  elseif ($line -match 'Authentication\\s+: (.+)') { $current.Auth = $Matches[1].Trim() }
}
if ($current.SSID) { $results += $current }
$results | ConvertTo-Json -Compress`, 15000);
    case 'connect':
      if (!networkName) return { success: false, error: 'Network name is required.' };
      return runPS(`netsh wlan connect name="${networkName}"
if ($LASTEXITCODE -eq 0) { Write-Output "Connected to ${networkName}" }
else { Write-Output "Could not connect to ${networkName}. Make sure the network profile exists." }`);
    case 'disconnect':
      return runPS(`netsh wlan disconnect; Write-Output "WiFi disconnected"`);
    case 'saved':
      return runPS(`(netsh wlan show profiles) -match 'All User Profile' | ForEach-Object { ($_ -split ':',2)[1].Trim() }`);
    default:
      return { success: false, error: `Unknown wifi action: ${action}` };
  }
});

let mainWindow = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,          // no white flash on startup
    backgroundColor: '#050505',
    title: 'Friday AI Assistant',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      // Prevent Chromium from throttling timers/RAF when the window is
      // in the background or not focused — keeps the orb loop alive.
      backgroundThrottling: false,
    },
    frame: true,
    autoHideMenuBar: true,
    // Paint even while hidden so first-show is instant
    paintWhenInitiallyHidden: true,
  });

  mainWindow = win;

  // Show window only after the page has finished painting — open FULLSCREEN
  win.once('ready-to-show', () => {
    win.maximize();       // ← open fullscreen on startup
    win.show();
    // Boost renderer process priority (Windows only)
    try {
      win.webContents.setFrameRate(60);
    } catch (_) {}
  });

  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../dist/index.html')}`;

  win.loadURL(startUrl);

  // if (isDev) {
  //   win.webContents.openDevTools();
  // }
}

// ─── Sleep / Wake Window Control ──────────────────────────────────────────────
// Renderer tells main process to minimize (sleep) or restore (wake)
ipcMain.handle('friday-minimize', () => {
  if (mainWindow) {
    mainWindow.minimize();
    return { success: true };
  }
  return { success: false, error: 'No window' };
});

ipcMain.handle('friday-restore', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.maximize();
    mainWindow.focus();
    return { success: true };
  }
  return { success: false, error: 'No window' };
});

// IPC Handlers for Friday's System Tools
ipcMain.handle('open-app', async (event, appName) => {
  return new Promise((resolve) => {
    const name = appName.toLowerCase().trim();

    // Map common friendly names to Windows executables
    const appMap = {
      'notepad': 'notepad.exe',
      'calculator': 'calc.exe',
      'calc': 'calc.exe',
      'paint': 'mspaint.exe',
      'cmd': 'cmd.exe',
      'command prompt': 'cmd.exe',
      'terminal': 'wt.exe',
      'windows terminal': 'wt.exe',
      'powershell': 'powershell.exe',
      'file explorer': 'explorer.exe',
      'explorer': 'explorer.exe',
      'task manager': 'taskmgr.exe',
      'settings': 'ms-settings:',
      'control panel': 'control.exe',
      'snipping tool': 'snippingtool.exe',
      'snip': 'snippingtool.exe',
      'chrome': 'chrome',
      'google chrome': 'chrome',
      'firefox': 'firefox',
      'edge': 'msedge',
      'microsoft edge': 'msedge',
      'brave': 'brave',
      'spotify': 'spotify',
      'discord': 'discord',
      'slack': 'slack',
      'vscode': 'code',
      'visual studio code': 'code',
      'vs code': 'code',
      'word': 'winword',
      'excel': 'excel',
      'powerpoint': 'powerpnt',
      'outlook': 'outlook',
      'teams': 'msteams',
      'microsoft teams': 'msteams',
      'vlc': 'vlc',
      'obs': 'obs64',
      'steam': 'steam',
    };

    // UWP / Microsoft Store apps (launched via shell:AppsFolder)
    const uwpMap = {
      'netflix': '4DF9E0F8.Netflix_mcm4njqhnhss8!Netflix.App',
      'xbox': 'Microsoft.GamingApp_8wekyb3d8bbwe!Microsoft.Xbox.App',
      'xbox game bar': 'Microsoft.XboxGamingOverlay_8wekyb3d8bbwe!App',
      'photos': 'Microsoft.Windows.Photos_8wekyb3d8bbwe!App',
      'microsoft photos': 'Microsoft.Windows.Photos_8wekyb3d8bbwe!App',
      'camera': 'Microsoft.WindowsCamera_8wekyb3d8bbwe!App',
      'mail': 'microsoft.windowscommunicationsapps_8wekyb3d8bbwe!microsoft.windowslive.mail',
      'calendar': 'microsoft.windowscommunicationsapps_8wekyb3d8bbwe!microsoft.windowslive.calendar',
      'maps': 'Microsoft.WindowsMaps_8wekyb3d8bbwe!App',
      'weather': 'Microsoft.BingWeather_8wekyb3d8bbwe!App',
      'clock': 'Microsoft.WindowsAlarms_8wekyb3d8bbwe!App',
      'alarms': 'Microsoft.WindowsAlarms_8wekyb3d8bbwe!App',
      'store': 'Microsoft.WindowsStore_8wekyb3d8bbwe!App',
      'microsoft store': 'Microsoft.WindowsStore_8wekyb3d8bbwe!App',
      'movies & tv': 'Microsoft.ZuneVideo_8wekyb3d8bbwe!Microsoft.ZuneVideo',
      'groove music': 'Microsoft.ZuneMusic_8wekyb3d8bbwe!Microsoft.ZuneMusic',
      'your phone': 'Microsoft.YourPhone_8wekyb3d8bbwe!App',
      'phone link': 'Microsoft.YourPhone_8wekyb3d8bbwe!App',
      'clipchamp': 'Clipchamp.Clipchamp_yxz26nhyzhsrt!App',
      'snipping tool': 'Microsoft.ScreenSketch_8wekyb3d8bbwe!App',
    };

    // Check UWP map first
    if (uwpMap[name]) {
      exec(`start shell:AppsFolder\\${uwpMap[name]}`, (error) => {
        if (!error) {
          resolve({ success: true });
          return;
        }
        // UWP ID might differ on this system, try searching installed packages
        exec(`powershell -Command "$pkg = Get-AppxPackage | Where-Object { $_.Name -like '*${appName}*' } | Select-Object -First 1; if($pkg) { Start-Process ('shell:AppsFolder\\' + $pkg.PackageFamilyName + '!App') } else { throw 'not found' }"`, (error2) => {
          resolve(error2 ? { success: false, error: `'${appName}' is not installed from the Microsoft Store.` } : { success: true });
        });
      });
      return;
    }

    const executable = appMap[name] || appName;

    // For ms-settings: URIs and .exe system apps, `start` is safe and won't show error popups
    if (executable.startsWith('ms-') || executable.endsWith('.exe')) {
      exec(`start "" "${executable}"`, (error) => {
        resolve(error ? { success: false, error: error.message } : { success: true });
      });
      return;
    }

    // For everything else (steam, chrome, spotify, discord, etc.) use the silent
    // PowerShell Get-StartApps lookup. This avoids the Windows "cannot find" GUI popup
    // that `start "" "appname"` triggers for non-system apps.
    const searchName = appMap[name] ? appName : executable; // Use the friendly name for searching
    const searchCmd = `$app = Get-StartApps | Where-Object { $_.Name -match '(?i)${searchName}' } | Select-Object -First 1; if ($app) { Start-Process ('shell:AppsFolder\\' + $app.AppID) } else { exit 1 }`;
      
    exec(searchCmd, { shell: 'powershell.exe' }, (error2) => {
      if (!error2) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: `Could not find '${appName}' on your system.` });
      }
    });
  });
});

ipcMain.handle('close-app', async (event, appName) => {
  return new Promise((resolve) => {
    const name = appName.toLowerCase().trim();

    // Comprehensive map of friendly names to actual Windows process names (without .exe)
    const processMap = {
      // Browsers
      'chrome': 'chrome', 'google chrome': 'chrome',
      'firefox': 'firefox', 'mozilla firefox': 'firefox',
      'edge': 'msedge', 'microsoft edge': 'msedge',
      'brave': 'brave', 'opera': 'opera', 'vivaldi': 'vivaldi',
      'arc': 'Arc',
      // System utilities
      'notepad': 'notepad', 'notepad++': 'notepad++',
      'calculator': 'CalculatorApp', 'calc': 'CalculatorApp',
      'paint': 'mspaint', 'ms paint': 'mspaint',
      'snipping tool': 'SnippingTool', 'snip': 'SnippingTool',
      'cmd': 'cmd', 'command prompt': 'cmd',
      'terminal': 'WindowsTerminal', 'windows terminal': 'WindowsTerminal',
      'powershell': 'powershell',
      'file explorer': 'explorer', 'explorer': 'explorer',
      'task manager': 'Taskmgr',
      'control panel': 'control',
      // Media & Communication
      'spotify': 'Spotify', 'discord': 'Discord', 'slack': 'slack',
      'zoom': 'Zoom', 'telegram': 'Telegram', 'skype': 'Skype',
      'whatsapp': 'WhatsApp',
      // Dev tools
      'vscode': 'Code', 'visual studio code': 'Code', 'vs code': 'Code',
      'visual studio': 'devenv', 'android studio': 'studio64',
      'intellij': 'idea64', 'pycharm': 'pycharm64', 'webstorm': 'webstorm64',
      'sublime': 'sublime_text', 'sublime text': 'sublime_text',
      'atom': 'atom',
      // Office
      'word': 'WINWORD', 'microsoft word': 'WINWORD',
      'excel': 'EXCEL', 'microsoft excel': 'EXCEL',
      'powerpoint': 'POWERPNT', 'microsoft powerpoint': 'POWERPNT',
      'outlook': 'OUTLOOK', 'microsoft outlook': 'OUTLOOK',
      'onenote': 'onenote', 'access': 'MSACCESS',
      'teams': 'ms-teams', 'microsoft teams': 'ms-teams',
      // Media players
      'vlc': 'vlc', 'vlc media player': 'vlc',
      'obs': 'obs64', 'obs studio': 'obs64',
      'foobar': 'foobar2000', 'winamp': 'winamp',
      'itunes': 'iTunes',
      // Gaming
      'steam': 'steam', 'epic games': 'EpicGamesLauncher', 'epic': 'EpicGamesLauncher',
      'origin': 'Origin', 'ea app': 'EADesktop', 'ea desktop': 'EADesktop',
      'ubisoft': 'upc', 'ubisoft connect': 'upc', 'uplay': 'upc',
      'gog': 'GalaxyClient', 'gog galaxy': 'GalaxyClient',
      'battle.net': 'Battle.net', 'battlenet': 'Battle.net',
      'riot': 'RiotClientServices', 'riot client': 'RiotClientServices',
      'valorant': 'VALORANT-Win64-Shipping',
      // Other
      'photos': 'Microsoft.Photos', 'camera': 'WindowsCamera',
      'xbox': 'XboxApp', 'xbox game bar': 'GameBar',
      'postman': 'Postman',
      'figma': 'Figma',
      'notion': 'Notion',
      'gimp': 'gimp-2.10', 'photoshop': 'Photoshop',
      'blender': 'blender', 'premiere': 'Adobe Premiere Pro',
      'after effects': 'AfterFX',
    };

    const processName = processMap[name] || appName;

    if (process.platform === 'win32') {
      // Build a robust PowerShell script and encode it as Base64 to avoid
      // all shell-escaping headaches with double-quotes, regex, and special chars.
      const psScript = `
$targetName = '${processName.replace(/'/g, "''")}'
$friendlyName = '${appName.replace(/'/g, "''")}'
$closed = $false

# ── Strategy 1: Exact taskkill (fastest, most reliable) ──
$tkResult = & taskkill /F /IM "$targetName.exe" 2>&1
if ($LASTEXITCODE -eq 0) { $closed = $true }

# ── Strategy 2: Get-Process exact name match ──
if (-not $closed) {
  $procs = Get-Process -Name $targetName -ErrorAction SilentlyContinue
  if ($procs) {
    $procs | Stop-Process -Force -ErrorAction SilentlyContinue
    $closed = $true
  }
}

# ── Strategy 3: Wildcard taskkill (handles names like "Spotify.exe", "Discord.exe") ──
if (-not $closed) {
  $tkResult2 = & taskkill /F /IM "*$targetName*" 2>&1
  if ($LASTEXITCODE -eq 0) { $closed = $true }
}

# ── Strategy 4: Partial process-name match via Get-Process ──
if (-not $closed) {
  $escaped = [Regex]::Escape($targetName)
  $procs = Get-Process | Where-Object { $_.ProcessName -match $escaped -and $_.Id -ne $PID }
  if ($procs) {
    $procs | Stop-Process -Force -ErrorAction SilentlyContinue
    $closed = $true
  }
}

# ── Strategy 5: Match by window title (useful when process name differs) ──
if (-not $closed) {
  $escaped2 = [Regex]::Escape($friendlyName)
  $procs = Get-Process | Where-Object { $_.MainWindowTitle -and $_.MainWindowTitle -match $escaped2 }
  if ($procs) {
    $procs | Stop-Process -Force -ErrorAction SilentlyContinue
    $closed = $true
  }
}

# ── Strategy 6: Try the friendly name directly with taskkill ──
if (-not $closed -and $friendlyName -ne $targetName) {
  $tkResult3 = & taskkill /F /IM "$friendlyName.exe" 2>&1
  if ($LASTEXITCODE -eq 0) { $closed = $true }
}

if ($closed) { Write-Output 'CLOSED' } else { Write-Output 'NOT_FOUND' }
`;

      // Encode as UTF-16LE Base64 for -EncodedCommand (avoids all quoting issues)
      const encodedCmd = Buffer.from(psScript, 'utf16le').toString('base64');

      exec(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodedCmd}`, { timeout: 15000 }, (error, stdout, stderr) => {
        const output = (stdout || '').trim();
        if (output === 'CLOSED') {
          console.log(`[Friday] Successfully closed: ${appName}`);
          resolve({ success: true });
        } else {
          console.warn(`[Friday] Could not close '${appName}'. stdout: ${output}, stderr: ${(stderr || '').trim()}`);
          resolve({ success: false, error: `Could not find or close '${appName}'. Make sure it's currently running.` });
        }
      });
    } else {
      exec(`pkill -f "${appName}"`, (error) => {
        resolve(error ? { success: false, error: error.message } : { success: true });
      });
    }
  });
});

ipcMain.handle('open-file', async (event, filePath) => {
  try {
    await shell.openPath(filePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('create-folder', async (event, { folderName, folderPath }) => {
  const fullPath = path.join(folderPath || app.getPath('desktop'), folderName);
  try {
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      return { success: true, path: fullPath };
    }
    return { success: false, error: 'Folder already exists' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('close-chrome-tab', async () => {
  return new Promise((resolve) => {
    let command = '';
    if (process.platform === 'darwin') {
      command = `osascript -e 'tell application "Google Chrome" to close active tab of front window'`;
    } else if (process.platform === 'win32') {
      // Windows: Use PowerShell to send Ctrl+W to Chrome
      command = `powershell -command "$wshell = New-Object -ComObject wscript.shell; if($wshell.AppActivate('Google Chrome')) { Sleep 1; $wshell.SendKeys('^w') }"`;
    } else {
      resolve({ success: false, error: 'Platform not supported for this action' });
      return;
    }

    exec(command, (error) => {
      if (error) {
        resolve({ success: false, error: error.message });
      } else {
        resolve({ success: true });
      }
    });
  });
});

// System Info: CPU, RAM, GPU, Date/Time
ipcMain.handle('get-system-info', async () => {
  return new Promise((resolve) => {
    // --- CPU ---
    const cpus = os.cpus();
    const cpuModel = cpus[0]?.model || 'Unknown CPU';
    const cpuCores = cpus.length;

    // Compute CPU usage over a 100ms sample
    function getCpuUsage() {
      return new Promise((res) => {
        const startMeasure = cpus.map(cpu => ({ ...cpu.times }));
        setTimeout(() => {
          const endCpus = os.cpus();
          let totalIdle = 0, totalTick = 0;
          endCpus.forEach((cpu, i) => {
            const startTimes = startMeasure[i];
            for (const type in cpu.times) {
              totalTick += cpu.times[type] - (startTimes[type] || 0);
            }
            totalIdle += cpu.times.idle - (startTimes.idle || 0);
          });
          const usage = totalTick === 0 ? 0 : ((totalTick - totalIdle) / totalTick * 100).toFixed(1);
          res(Number(usage));
        }, 100);
      });
    }

    // --- RAM ---
    const totalRam = os.totalmem();
    const freeRam = os.freemem();
    const usedRam = totalRam - freeRam;
    const ramUsagePercent = ((usedRam / totalRam) * 100).toFixed(1);

    // --- GPU (Windows WMI) ---
    const gpuCmd = `powershell -NoProfile -Command "Get-WmiObject Win32_VideoController | Select-Object -First 1 -ExpandProperty Name"`;

    // --- Date/Time ---
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    Promise.all([getCpuUsage()]).then(([cpuUsage]) => {
      exec(gpuCmd, (gpuErr, gpuStdout) => {
        const gpuName = gpuErr ? 'Unknown GPU' : (gpuStdout.trim() || 'Unknown GPU');
        resolve({
          success: true,
          cpu: {
            model: cpuModel,
            cores: cpuCores,
            usagePercent: cpuUsage,
          },
          ram: {
            totalGB: (totalRam / 1024 ** 3).toFixed(2),
            usedGB: (usedRam / 1024 ** 3).toFixed(2),
            freeGB: (freeRam / 1024 ** 3).toFixed(2),
            usagePercent: Number(ramUsagePercent),
          },
          gpu: {
            name: gpuName,
          },
          dateTime: {
            date: dateStr,
            time: timeStr,
            timezone,
            iso: now.toISOString(),
          },
          platform: process.platform,
          hostname: os.hostname(),
          arch: os.arch(),
        });
      });
    });
  });
});

// ─── Comprehensive Game Scanner ─────────────────────────────────────────────
// Scans Steam, Epic Games, GOG, EA/Origin, Ubisoft Connect, Xbox/UWP, and
// general registry entries with intelligent game identification.

function parseVdfValue(content, key) {
  // Simple VDF key-value parser: finds "key" "value" patterns
  const regex = new RegExp(`"${key}"\\s+"([^"]*)"`, 'i');
  const match = content.match(regex);
  return match ? match[1] : null;
}

async function scanSteamGames() {
  const games = [];
  try {
    // Find Steam install locations from libraryfolders.vdf
    const defaultSteamPaths = [
      path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Steam'),
      path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Steam'),
      'D:\\Steam', 'E:\\Steam', 'D:\\SteamLibrary', 'E:\\SteamLibrary',
    ];

    const libraryPaths = [];

    // Dynamically retrieve the actual Steam installation path from the Windows Registry
    const getRegistrySteamPath = () => new Promise(resolve => {
        exec(`powershell -NoProfile -Command "(Get-ItemProperty -Path 'HKCU:\\Software\\Valve\\Steam' -Name 'SteamPath' -ErrorAction SilentlyContinue).SteamPath"`, (err, stdout) => {
            if (!err && stdout.trim()) resolve(path.normalize(stdout.trim()));
            else resolve(null);
        });
    });
    
    const steamPathReg = await getRegistrySteamPath();
    if (steamPathReg && !defaultSteamPaths.includes(steamPathReg)) {
        defaultSteamPaths.unshift(steamPathReg);
    }

    for (const steamPath of defaultSteamPaths) {
      const vdfPath = path.join(steamPath, 'steamapps', 'libraryfolders.vdf');
      if (fs.existsSync(vdfPath)) {
        try {
          const vdfContent = fs.readFileSync(vdfPath, 'utf8');
          // Extract all "path" values from libraryfolders.vdf
          const pathMatches = vdfContent.matchAll(/"path"\s+"([^"]+)"/gi);
          for (const m of pathMatches) {
            libraryPaths.push(m[1].replace(/\\\\/g, '\\'));
          }
        } catch (_) {}
        // Also add the Steam root path itself
        if (!libraryPaths.includes(steamPath)) {
          libraryPaths.push(steamPath);
        }
        break; // Found Steam, no need to check other default paths
      }
    }

    // Scan each library path for appmanifest_*.acf files
    for (const libPath of libraryPaths) {
      const steamappsDir = path.join(libPath, 'steamapps');
      if (!fs.existsSync(steamappsDir)) continue;

      try {
        const files = fs.readdirSync(steamappsDir);
        for (const file of files) {
          if (file.startsWith('appmanifest_') && file.endsWith('.acf')) {
            try {
              const acfContent = fs.readFileSync(path.join(steamappsDir, file), 'utf8');
              const name = parseVdfValue(acfContent, 'name');
              const installDir = parseVdfValue(acfContent, 'installdir');
              const appId = parseVdfValue(acfContent, 'appid');

              if (name && name !== 'Steamworks Common Redistributables' && !name.includes('Proton') && !name.includes('Steam Linux Runtime')) {
                games.push({
                  name: name,
                  platform: 'Steam',
                  installPath: installDir ? path.join(steamappsDir, 'common', installDir) : '',
                  appId: appId || '',
                });
              }
            } catch (_) {}
          }
        }
      } catch (_) {}
    }
  } catch (_) {}
  return games;
}

async function scanEpicGames() {
  const games = [];
  try {
    const manifestDir = path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests');
    if (fs.existsSync(manifestDir)) {
      const files = fs.readdirSync(manifestDir);
      for (const file of files) {
        if (file.endsWith('.item')) {
          try {
            const content = fs.readFileSync(path.join(manifestDir, file), 'utf8');
            const manifest = JSON.parse(content);
            if (manifest.DisplayName && manifest.InstallLocation) {
              games.push({
                name: manifest.DisplayName,
                platform: 'Epic Games',
                installPath: manifest.InstallLocation,
                appId: manifest.AppName || '',
              });
            }
          } catch (_) {}
        }
      }
    }
  } catch (_) {}
  return games;
}

async function scanGogGames() {
  return new Promise((resolve) => {
    const psCommand = `
      $gogPaths = @(
        "HKLM:\\SOFTWARE\\WOW6432Node\\GOG.com\\Games\\*",
        "HKLM:\\SOFTWARE\\GOG.com\\Games\\*"
      )
      Get-ItemProperty $gogPaths -ErrorAction SilentlyContinue |
        Where-Object { $_.gameName } |
        ForEach-Object {
          [PSCustomObject]@{ name=$_.gameName; path=$_.path; id=$_.gameID } | ConvertTo-Json -Compress
        }
    `.replace(/\n/g, ' ');

    exec(`powershell -NoProfile -Command "${psCommand}"`, { maxBuffer: 1024 * 1024 }, (error, stdout) => {
      const games = [];
      if (!error && stdout.trim()) {
        for (const line of stdout.trim().split('\n')) {
          try {
            const obj = JSON.parse(line.trim());
            if (obj.name) {
              games.push({ name: obj.name, platform: 'GOG', installPath: obj.path || '', appId: obj.id || '' });
            }
          } catch (_) {}
        }
      }
      resolve(games);
    });
  });
}

async function scanEaGames() {
  return new Promise((resolve) => {
    const psCommand = `
      $eaPaths = @(
        "HKLM:\\SOFTWARE\\WOW6432Node\\Electronic Arts\\*",
        "HKLM:\\SOFTWARE\\Electronic Arts\\*",
        "HKLM:\\SOFTWARE\\WOW6432Node\\EA Games\\*",
        "HKLM:\\SOFTWARE\\EA Games\\*"
      )
      Get-ChildItem $eaPaths -ErrorAction SilentlyContinue |
        Get-ItemProperty -ErrorAction SilentlyContinue |
        Where-Object { $_.DisplayName -or $_.PSChildName } |
        ForEach-Object {
          $n = if($_.DisplayName) { $_.DisplayName } else { $_.PSChildName }
          $p = if($_.InstallDir) { $_.InstallDir } elseif($_.Install Dir) { $_.'Install Dir' } else { '' }
          [PSCustomObject]@{ name=$n; path=$p } | ConvertTo-Json -Compress
        }
    `.replace(/\n/g, ' ');

    exec(`powershell -NoProfile -Command "${psCommand}"`, { maxBuffer: 1024 * 1024 }, (error, stdout) => {
      const games = [];
      if (!error && stdout.trim()) {
        for (const line of stdout.trim().split('\n')) {
          try {
            const obj = JSON.parse(line.trim());
            if (obj.name) {
              games.push({ name: obj.name, platform: 'EA / Origin', installPath: obj.path || '', appId: '' });
            }
          } catch (_) {}
        }
      }
      resolve(games);
    });
  });
}

async function scanUbisoftGames() {
  return new Promise((resolve) => {
    const psCommand = `
      $ubiPaths = @(
        "HKLM:\\SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher\\Installs\\*",
        "HKLM:\\SOFTWARE\\Ubisoft\\Launcher\\Installs\\*"
      )
      Get-ItemProperty $ubiPaths -ErrorAction SilentlyContinue |
        Where-Object { $_.InstallDir } |
        ForEach-Object {
          $dir = $_.InstallDir
          $gameName = Split-Path $dir -Leaf
          [PSCustomObject]@{ name=$gameName; path=$dir; id=$_.PSChildName } | ConvertTo-Json -Compress
        }
    `.replace(/\n/g, ' ');

    exec(`powershell -NoProfile -Command "${psCommand}"`, { maxBuffer: 1024 * 1024 }, (error, stdout) => {
      const games = [];
      if (!error && stdout.trim()) {
        for (const line of stdout.trim().split('\n')) {
          try {
            const obj = JSON.parse(line.trim());
            if (obj.name) {
              games.push({ name: obj.name, platform: 'Ubisoft Connect', installPath: obj.path || '', appId: obj.id || '' });
            }
          } catch (_) {}
        }
      }
      resolve(games);
    });
  });
}

async function scanXboxGames() {
  return new Promise((resolve) => {
    // Get Microsoft Store / Xbox games via AppxPackage — filter for known game categories
    const psCommand = `
      Get-AppxPackage |
        Where-Object {
          $_.SignatureKind -eq 'Store' -and
          $_.IsFramework -eq $false -and
          $_.NonRemovable -eq $false -and
          ($_.Name -notmatch '(?i)Microsoft\\.(NET|VCLibs|UI\\.Xaml|Services|Windows|HEIFImageExtension|HEVCVideoExtension|WebMediaExtensions|WebpImageExtension|VP9VideoExtensions|ScreenSketch|DesktopAppInstaller|StorePurchaseApp|SecHealthUI|GetHelp|Getstarted|MixedReality|People|Wallet|549981C3F5F10|BingWeather|BingNews|ZuneMusic|ZuneVideo|WindowsMaps|WindowsAlarms|WindowsCamera|WindowsSoundRecorder|WindowsFeedbackHub|YourPhone|Todos|PowerAutomateDesktop|Clipchamp|Paint|Photos|Notepad|Terminal|Xbox\\.TCUI|XboxSpeech|XboxIdentity|XboxGameOverlay|Gaming)' -and
            $_.Name -notmatch '(?i)^(AD2F1837|9NBLGGH|ROBLOXCORPORATION\\.ROBLOX)' -and
            $_.Name -notmatch '(?i)Extension|Libs|Runtime|Framework')
        } |
        ForEach-Object {
          $manifest = Get-AppxPackageManifest $_ -ErrorAction SilentlyContinue
          $displayName = $manifest.Package.Properties.DisplayName
          if ($displayName -and $displayName -notmatch '^ms-resource:') {
            [PSCustomObject]@{ name=$displayName; packageName=$_.Name; path=$_.InstallLocation } | ConvertTo-Json -Compress
          }
        }
    `.replace(/\n/g, ' ');

    exec(`powershell -NoProfile -Command "${psCommand}"`, { maxBuffer: 1024 * 1024 * 2, timeout: 30000 }, (error, stdout) => {
      const games = [];
      if (!error && stdout.trim()) {
        for (const line of stdout.trim().split('\n')) {
          try {
            const obj = JSON.parse(line.trim());
            if (obj.name) {
              games.push({ name: obj.name, platform: 'Xbox / MS Store', installPath: obj.path || '', appId: obj.packageName || '' });
            }
          } catch (_) {}
        }
      }
      resolve(games);
    });
  });
}

async function scanRegistryGames() {
  return new Promise((resolve) => {
    // Scan uninstall registry for anything that looks like a game
    // Uses publisher and name heuristics to identify games
    const psCommand = `
      $regPaths = @(
        "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",
        "HKLM:\\SOFTWARE\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",
        "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*"
      )

      $gamePublishers = @(
        'Valve', 'Steam', 'Epic Games', 'Riot Games', 'Blizzard', 'Activision',
        'Electronic Arts', 'EA ', 'Ubisoft', 'Rockstar', 'Take-Two', '2K Games',
        'Bethesda', 'SEGA', 'Capcom', 'Square Enix', 'Bandai Namco', 'Warner Bros',
        'CD Projekt', 'Paradox', 'THQ', 'Deep Silver', 'Devolver', 'Team17',
        'Supergiant', 'Mojang', 'miHoYo', 'HoYoverse', 'Gaijin', 'Wargaming',
        'Digital Extremes', 'Grinding Gear', 'Respawn', 'BioWare', 'FromSoftware',
        'Techland', 'Klei', 'Re-Logic', 'ConcernedApe', 'Hello Games',
        'Larian', 'Obsidian', 'inXile', 'Fatshark', 'Coffee Stain',
        'GSC Game World', 'Crytek', 'id Software', 'MachineGames',
        'Bungie', 'NetEase Games', 'Tencent', 'Nexon', 'NCSoft',
        'Smilegate', 'Pearl Abyss', 'Krafton', 'InnerSloth'
      )

      $gameKeywords = @(
        'Game', 'game', 'Play', 'Launcher', 'Edition', 'Deluxe', 'GOTY',
        'Remastered', 'Remake', 'Definitive', 'Ultimate', 'Standard',
        'Chapter', 'Episode', 'Season', 'DLC', 'Expansion'
      )

      $systemExclusions = @(
        'Microsoft Visual C++', 'Microsoft .NET', '.NET Runtime', '.NET SDK',
        'Windows Driver', 'Windows SDK', 'NVIDIA PhysX', 'NVIDIA Graphics',
        'AMD ', 'Intel(R)', 'Realtek', 'Synaptics', 'Update for',
        'Security Update', 'Hotfix', 'Service Pack', 'Redistributable',
        'Runtime', 'Tools for', 'SDK', 'Debug', 'Python', 'Node.js',
        'Java ', 'Adobe', 'Microsoft Office', 'Microsoft 365', 'LibreOffice',
        'Google Chrome', 'Mozilla Firefox', 'Microsoft Edge', 'Brave',
        'Visual Studio', 'Git', 'CMake', 'Notepad', 'WinRAR', '7-Zip',
        'VLC media', 'OBS Studio', 'Discord', 'Spotify', 'Zoom', 'Slack',
        'Microsoft Teams', 'PowerShell', 'Windows Terminal', 'curl'
      )

      Get-ItemProperty $regPaths -ErrorAction SilentlyContinue |
        Where-Object { $_.DisplayName -and $_.SystemComponent -ne 1 } |
        ForEach-Object {
          $name = $_.DisplayName
          $publisher = $_.Publisher
          $installLoc = $_.InstallLocation

          $skip = $false
          foreach ($ex in $systemExclusions) {
            if ($name -like "*$ex*") { $skip = $true; break }
          }
          if ($skip) { return }

          $isGamePublisher = $false
          if ($publisher) {
            foreach ($gp in $gamePublishers) {
              if ($publisher -like "*$gp*") { $isGamePublisher = $true; break }
            }
          }

          $hasGameKeyword = $false
          foreach ($kw in $gameKeywords) {
            if ($name -like "*$kw*") { $hasGameKeyword = $true; break }
          }

          $inGameDir = $false
          if ($installLoc) {
            $inGameDir = $installLoc -match '(?i)(steam|epic|gog|origin|ubisoft|riot|games|game)'
          }

          if ($isGamePublisher -or $hasGameKeyword -or $inGameDir) {
            [PSCustomObject]@{ name=$name; publisher=$publisher; path=$installLoc } | ConvertTo-Json -Compress
          }
        }
    `.replace(/\n/g, ' ');

    exec(`powershell -NoProfile -Command "${psCommand}"`, { maxBuffer: 1024 * 1024 * 5, timeout: 30000 }, (error, stdout) => {
      const games = [];
      if (!error && stdout.trim()) {
        for (const line of stdout.trim().split('\n')) {
          try {
            const obj = JSON.parse(line.trim());
            if (obj.name) {
              games.push({
                name: obj.name,
                platform: obj.publisher ? `Detected (${obj.publisher})` : 'Detected (Registry)',
                installPath: obj.path || '',
                appId: '',
              });
            }
          } catch (_) {}
        }
      }
      resolve(games);
    });
  });
}

ipcMain.handle('get-installed-apps', async () => {
  try {
    console.log('[Friday Game Scanner] Starting comprehensive system scan...');

    // Run all scanners in parallel for speed
    const [steam, epic, gog, ea, ubisoft, xbox, registry] = await Promise.all([
      scanSteamGames(),
      scanEpicGames(),
      scanGogGames(),
      scanEaGames(),
      scanUbisoftGames(),
      scanXboxGames(),
      scanRegistryGames(),
    ]);

    // Merge all results, deduplicating by name (case-insensitive)
    const seen = new Set();
    const allGames = [];

    // Priority order: launcher-specific scanners first, then registry fallback
    const sources = [
      ...steam, ...epic, ...gog, ...ea, ...ubisoft, ...xbox, ...registry
    ];

    for (const game of sources) {
      const key = game.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!seen.has(key)) {
        seen.add(key);
        allGames.push(game);
      }
    }

    // Sort alphabetically
    allGames.sort((a, b) => a.name.localeCompare(b.name));

    console.log(`[Friday Game Scanner] Found ${allGames.length} games across all sources.`);
    console.log(`  Steam: ${steam.length} | Epic: ${epic.length} | GOG: ${gog.length} | EA: ${ea.length} | Ubisoft: ${ubisoft.length} | Xbox: ${xbox.length} | Registry: ${registry.length}`);

    return {
      success: true,
      totalFound: allGames.length,
      games: allGames,
      breakdown: {
        steam: steam.length,
        epic: epic.length,
        gog: gog.length,
        ea: ea.length,
        ubisoft: ubisoft.length,
        xbox: xbox.length,
        registry: registry.length,
      },
    };
  } catch (err) {
    console.error('[Friday Game Scanner] Error:', err);
    return { success: false, error: `Game scan failed: ${err.message}` };
  }
});

ipcMain.handle('check-social', async (event, platform) => {
  return new Promise((resolve) => {
    let url = "";
    const plt = platform.toLowerCase();
    
    // Direct feed/stories links
    if (plt === "instagram") {
      url = "https://www.instagram.com/";
    } else if (plt === "facebook") {
      url = "https://www.facebook.com/";
    } else {
      resolve({ success: false, error: "Unsupported platform." });
      return;
    }

    shell.openExternal(url)
      .then(() => resolve({ success: true }))
      .catch((error) => resolve({ success: false, error: error.message }));
  });
});

ipcMain.handle('play-media', async (event, { platform, query }) => {
  return new Promise(async (resolve) => {
    try {
      if (platform.toLowerCase() === "youtube") {
        // Invisible fetch to grab the top YouTube video ID without a developer API key
        const response = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`);
        const text = await response.text();
        const match = text.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
        
        if (match && match[1]) {
          // Open YouTube directly. If the user installed the YouTube Windows App, it intercepts this natively!
          shell.openExternal(`https://www.youtube.com/watch?v=${match[1]}`);
          resolve({ success: true });
        } else {
          resolve({ success: false, error: "Could not find a valid video ID." });
        }

      } else if (platform.toLowerCase() === "spotify") {
        // Open Spotify Desktop straight to the search results
        const spotifyUrl = `spotify:search:${encodeURIComponent(query)}`;
        shell.openExternal(spotifyUrl).then(() => {
          
          if (process.platform === 'win32') {
            // Attempt to hit 'Tab' x2 and 'Enter' to focus the top result and play it in Spotify UX
            let psScript = `$wshell = New-Object -ComObject wscript.shell; `;
            psScript += `if($wshell.AppActivate('Spotify')) { `;
            psScript += `Start-Sleep -Seconds 2; `;
            psScript += `$wshell.SendKeys('{TAB}'); Start-Sleep -Milliseconds 300; `;
            psScript += `$wshell.SendKeys('{TAB}'); Start-Sleep -Milliseconds 300; `;
            psScript += `$wshell.SendKeys('~'); `;
            psScript += `}`;
            
            const base64ps = Buffer.from(psScript, 'utf16le').toString('base64');
            exec(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${base64ps}`);
          }
          resolve({ success: true });
        });

      } else {
        resolve({ success: false, error: "Unsupported media platform." });
      }
    } catch (e) {
      resolve({ success: false, error: e.message });
    }
  });
});

ipcMain.handle('search-google', async (event, query) => {
  return new Promise((resolve) => {
    const searchWin = new BrowserWindow({
      show: false,
      skipTaskbar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        partition: 'memory:search'
      }
    });

    searchWin.loadURL(`https://www.google.com/search?q=${encodeURIComponent(query)}`);

    searchWin.webContents.on('did-finish-load', async () => {
      try {
        const text = await searchWin.webContents.executeJavaScript(`
          (() => {
            document.querySelectorAll('script, style, svg, img').forEach(e => e.remove());
            const main = document.querySelector('#main') || document.querySelector('#search') || document.body;
            let content = main.innerText || "";
            return content.replace(/\\s+/g, ' ').trim().substring(0, 4000);
          })();
        `);
        searchWin.destroy();
        resolve({ success: true, data: text });
      } catch (e) {
        searchWin.destroy();
        resolve({ success: false, error: e.message });
      }
    });

    setTimeout(() => {
      if (!searchWin.isDestroyed()) {
        searchWin.destroy();
        resolve({ success: false, error: "Search timed out" });
      }
    }, 10000);
  });
});

ipcMain.handle('open-in-chrome', async (event, url) => {
  return new Promise((resolve) => {
    let command = '';
    if (process.platform === 'win32') {
      command = `start chrome "${url}"`;
    } else if (process.platform === 'darwin') {
      command = `open -n -a "Google Chrome" "${url}"`;
    } else {
      command = `google-chrome "${url}"`;
    }
    
    exec(command, (error) => {
      if (error) {
        // Fallback to default browser if chrome isn't found
        shell.openExternal(url)
          .then(() => resolve({ success: true }))
          .catch((err) => resolve({ success: false, error: err.message }));
      } else {
        resolve({ success: true });
      }
    });
  });
});

// ─── Image Generation (NVIDIA flux.2-klein-4b) ──────────────────────────────
let lastGeneratedImagePath = null;

ipcMain.handle('generate-image', async (event, prompt) => {
  return new Promise((resolve) => {
    const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || '';

    const payload = JSON.stringify({
      prompt: prompt.substring(0, 800),
      height: 1024,
      width: 1024,
      cfg_scale: 1,
      samples: 1,
      seed: 0,
      steps: 4
    });

    const options = {
      hostname: 'ai.api.nvidia.com',
      path: '/v1/genai/black-forest-labs/flux.2-klein-4b',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NVIDIA_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);

          // The API returns base64 image data in the artifacts array
          let base64Image = null;
          let finishReason = null;
          
          if (json.artifacts && json.artifacts.length > 0) {
            base64Image = json.artifacts[0].base64;
            finishReason = json.artifacts[0].finishReason;
          } else if (json.data && json.data.length > 0) {
            base64Image = json.data[0].b64_json;
          }

          if (finishReason === 'CONTENT_FILTERED' || base64Image === "") {
            console.error('[Friday Image Gen] Prompt was filtered by NVIDIA safety filters.');
            resolve({ success: false, error: 'The prompt violated safety/content policies and was filtered by the AI.' });
            return;
          }

          if (!base64Image) {
            console.error('[Friday Image Gen] No image data in response:', JSON.stringify(json).substring(0, 500));
            resolve({ success: false, error: 'No image data received from the API.' });
            return;
          }

          // Save to a temp directory
          const tempDir = path.join(os.tmpdir(), 'friday-images');
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }

          const timestamp = Date.now();
          const tempPath = path.join(tempDir, `friday_generated_${timestamp}.jpeg`);
          const imageBuffer = Buffer.from(base64Image, 'base64');
          fs.writeFileSync(tempPath, imageBuffer);

          lastGeneratedImagePath = tempPath;
          console.log(`[Friday Image Gen] Image saved to: ${tempPath}`);

          // Open in Windows Photos app
          if (process.platform === 'win32') {
            exec(`start "" "${tempPath}"`, (err) => {
              if (err) console.warn('[Friday Image Gen] Could not open in Photos:', err.message);
            });
          } else {
            shell.openPath(tempPath).catch(() => {});
          }

          resolve({ success: true, tempPath: tempPath });
        } catch (parseErr) {
          console.error('[Friday Image Gen] Parse error:', parseErr.message);
          resolve({ success: false, error: 'Failed to parse image generation response.' });
        }
      });
    });

    req.on('error', (err) => {
      console.error('[Friday Image Gen] Request error:', err.message);
      resolve({ success: false, error: `Image generation request failed: ${err.message}` });
    });

    req.setTimeout(60000, () => {
      req.destroy();
      resolve({ success: false, error: 'Image generation timed out after 60 seconds.' });
    });

    req.write(payload);
    req.end();
  });
});

ipcMain.handle('save-generated-image', async (event, { fileName, savePath }) => {
  try {
    if (!lastGeneratedImagePath || !fs.existsSync(lastGeneratedImagePath)) {
      return { success: false, error: 'No recently generated image found to save.' };
    }

    // Default save location is Desktop if no path provided
    const targetDir = savePath || app.getPath('desktop');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Ensure the file name ends with .png
    const safeName = fileName.endsWith('.png') ? fileName : `${fileName}.png`;
    const targetPath = path.join(targetDir, safeName);

    fs.copyFileSync(lastGeneratedImagePath, targetPath);
    console.log(`[Friday Image Gen] Image saved to: ${targetPath}`);

    return { success: true, savedPath: targetPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ─── Document Writing (Notepad + Word) ──────────────────────────────────────

ipcMain.handle('write-document', async (event, { target, content, title }) => {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve({ success: false, error: 'Document writing is only supported on Windows.' });
      return;
    }

    if (target === 'notepad') {
      // Open a NEW Notepad tab/window, then type the content via SendKeys
      const safeTxt = content.replace(/'/g, "''").replace(/`/g, "``");
      const psScript = `
# Open Notepad (new window)
Start-Process notepad.exe
Start-Sleep -Milliseconds 800

$wshell = New-Object -ComObject wscript.shell
if ($wshell.AppActivate('Notepad')) {
  Start-Sleep -Milliseconds 300
  # Ctrl+N for new tab (modern Notepad on Win11)
  $wshell.SendKeys('^n')
  Start-Sleep -Milliseconds 400

  # Type content line by line to preserve formatting
  $lines = @'
${safeTxt}
'@ -split '\\r?\\n'

  foreach ($line in $lines) {
    # Escape SendKeys special chars: +^%~(){}[]
    $escaped = $line -replace '([+^%~(){}\\[\\]])', '{$1}'
    $wshell.SendKeys($escaped)
    $wshell.SendKeys('{ENTER}')
    Start-Sleep -Milliseconds 20
  }
  Write-Output 'WRITTEN'
} else {
  Write-Output 'ACTIVATE_FAILED'
}
`;
      const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
      exec(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`, { timeout: 30000 }, (error, stdout) => {
        const output = (stdout || '').trim();
        if (output === 'WRITTEN') {
          resolve({ success: true, message: 'Content written to Notepad.' });
        } else {
          resolve({ success: false, error: error ? error.message : 'Failed to write to Notepad.' });
        }
      });
    } else if (target === 'word') {
      // Use Word COM automation via PowerShell
      const safeContent = content.replace(/'/g, "''");
      const safeTitle = (title || 'Document').replace(/'/g, "''");
      const psScript = `
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $true
  $doc = $word.Documents.Add()

  $selection = $word.Selection

  # Set default font
  $selection.Font.Name = 'Calibri'
  $selection.Font.Size = 11

  # Write content — interpret basic markdown-style formatting
  $lines = @'
${safeContent}
'@ -split '\\r?\\n'

  foreach ($line in $lines) {
    # Heading detection
    if ($line -match '^### (.+)') {
      $selection.Style = 'Heading 3'
      $selection.TypeText($Matches[1])
      $selection.TypeParagraph()
    } elseif ($line -match '^## (.+)') {
      $selection.Style = 'Heading 2'
      $selection.TypeText($Matches[1])
      $selection.TypeParagraph()
    } elseif ($line -match '^# (.+)') {
      $selection.Style = 'Heading 1'
      $selection.TypeText($Matches[1])
      $selection.TypeParagraph()
    } elseif ($line -match '^[-*] (.+)') {
      $selection.Style = 'List Bullet'
      $selection.TypeText($Matches[1])
      $selection.TypeParagraph()
    } elseif ($line -match '^\\d+\\. (.+)') {
      $selection.Style = 'List Number'
      $selection.TypeText($Matches[1])
      $selection.TypeParagraph()
    } elseif ($line.Trim() -eq '---') {
      # Horizontal rule — insert a border
      $selection.TypeParagraph()
    } else {
      $selection.Style = 'Normal'
      $selection.TypeText($line)
      $selection.TypeParagraph()
    }
  }

  # Move cursor to top
  $selection.HomeKey(6) | Out-Null

  Write-Output 'WRITTEN'
} catch {
  Write-Output "ERROR: $($_.Exception.Message)"
}
`;
      const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
      exec(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`, { timeout: 60000 }, (error, stdout) => {
        const output = (stdout || '').trim();
        if (output === 'WRITTEN') {
          resolve({ success: true, message: `Document created in Word.` });
        } else if (output.startsWith('ERROR:')) {
          resolve({ success: false, error: output.replace('ERROR: ', '') });
        } else {
          resolve({ success: false, error: error ? error.message : 'Microsoft Word may not be installed.' });
        }
      });
    } else {
      resolve({ success: false, error: `Unknown target: ${target}. Use 'notepad' or 'word'.` });
    }
  });
});

// Format active Word document (bold, italic, font, style changes, add content, etc.)
ipcMain.handle('format-word', async (event, { action, value }) => {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve({ success: false, error: 'Word formatting only supported on Windows.' });
      return;
    }

    let psScript = '';
    const safeValue = (value || '').replace(/'/g, "''");

    switch (action) {
      case 'bold':
        psScript = `try { $word = [Runtime.InteropServices.Marshal]::GetActiveObject('Word.Application'); $word.Selection.Font.Bold = -1 * ($word.Selection.Font.Bold + 1); Write-Output 'Toggled bold' } catch { Write-Output "ERROR: $($_.Exception.Message)" }`; break;
      case 'italic':
        psScript = `try { $word = [Runtime.InteropServices.Marshal]::GetActiveObject('Word.Application'); $word.Selection.Font.Italic = -1 * ($word.Selection.Font.Italic + 1); Write-Output 'Toggled italic' } catch { Write-Output "ERROR: $($_.Exception.Message)" }`; break;
      case 'underline':
        psScript = `try { $word = [Runtime.InteropServices.Marshal]::GetActiveObject('Word.Application'); $word.Selection.Font.Underline = 1 - $word.Selection.Font.Underline; Write-Output 'Toggled underline' } catch { Write-Output "ERROR: $($_.Exception.Message)" }`; break;
      case 'font-size':
        psScript = `try { $word = [Runtime.InteropServices.Marshal]::GetActiveObject('Word.Application'); $word.Selection.Font.Size = ${parseInt(value) || 12}; Write-Output 'Font size set to ${value}' } catch { Write-Output "ERROR: $($_.Exception.Message)" }`; break;
      case 'font-name':
        psScript = `try { $word = [Runtime.InteropServices.Marshal]::GetActiveObject('Word.Application'); $word.Selection.Font.Name = '${safeValue}'; Write-Output 'Font changed to ${safeValue}' } catch { Write-Output "ERROR: $($_.Exception.Message)" }`; break;
      case 'heading':
        psScript = `try { $word = [Runtime.InteropServices.Marshal]::GetActiveObject('Word.Application'); $word.Selection.Style = 'Heading ${parseInt(value) || 1}'; Write-Output 'Applied Heading ${value}' } catch { Write-Output "ERROR: $($_.Exception.Message)" }`; break;
      case 'align-center':
        psScript = `try { $word = [Runtime.InteropServices.Marshal]::GetActiveObject('Word.Application'); $word.Selection.ParagraphFormat.Alignment = 1; Write-Output 'Centered' } catch { Write-Output "ERROR: $($_.Exception.Message)" }`; break;
      case 'align-left':
        psScript = `try { $word = [Runtime.InteropServices.Marshal]::GetActiveObject('Word.Application'); $word.Selection.ParagraphFormat.Alignment = 0; Write-Output 'Left aligned' } catch { Write-Output "ERROR: $($_.Exception.Message)" }`; break;
      case 'align-right':
        psScript = `try { $word = [Runtime.InteropServices.Marshal]::GetActiveObject('Word.Application'); $word.Selection.ParagraphFormat.Alignment = 2; Write-Output 'Right aligned' } catch { Write-Output "ERROR: $($_.Exception.Message)" }`; break;
      case 'add-text':
        psScript = `
try {
  $word = [Runtime.InteropServices.Marshal]::GetActiveObject('Word.Application')
  $sel = $word.Selection
  $sel.EndKey(6) | Out-Null
  $sel.TypeParagraph()
  $sel.TypeText('${safeValue}')
  Write-Output 'Text added'
} catch { Write-Output "ERROR: $($_.Exception.Message)" }`;
        break;
      case 'save':
        psScript = `
try {
  $word = [Runtime.InteropServices.Marshal]::GetActiveObject('Word.Application')
  $doc = $word.ActiveDocument
  $savePath = '${safeValue}'
  if ($savePath -eq '') { $savePath = [Environment]::GetFolderPath('Desktop') + '\\Friday_Document.docx' }
  $doc.SaveAs2($savePath)
  Write-Output "Saved to $savePath"
} catch { Write-Output "ERROR: $($_.Exception.Message)" }`;
        break;
      case 'insert-image':
        psScript = `
try {
  $word = [Runtime.InteropServices.Marshal]::GetActiveObject('Word.Application')
  $sel = $word.Selection
  $sel.EndKey(6) | Out-Null
  $sel.TypeParagraph()
  
  # Ensure path is absolute
  $imgPath = '${safeValue}'
  if (-not [System.IO.Path]::IsPathRooted($imgPath)) {
    $imgPath = Join-Path (Get-Location) $imgPath
  }
  
  if (-not (Test-Path $imgPath)) {
    Write-Output "ERROR: Image file not found at $imgPath"
    exit
  }

  $shape = $sel.InlineShapes.AddPicture($imgPath, $false, $true)
  if ($shape) {
    Write-Output 'Image inserted'
  } else {
    Write-Output 'ERROR: Failed to insert image. AddPicture returned null.'
  }
} catch {
  Write-Output "ERROR: $($_.Exception.Message)"
}`;
        break;
      default:
        resolve({ success: false, error: `Unknown Word format action: ${action}` });
        return;
    }

    const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
    exec(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`, { timeout: 15000 }, (error, stdout) => {
      resolve(error ? { success: false, error: error.message } : { success: true, result: stdout.trim() });
    });
  });
});

// ─── All Apps (Categorized) ─────────────────────────────────────────────────

ipcMain.handle('get-all-apps', async () => {
  return new Promise((resolve) => {
    const psScript = `
Get-StartApps | ForEach-Object {
  [PSCustomObject]@{ Name = $_.Name; AppID = $_.AppID } | ConvertTo-Json -Compress
}
`;
    const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
    exec(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`, { maxBuffer: 1024 * 1024 * 5, timeout: 20000 }, (error, stdout) => {
      if (error) {
        resolve({ success: false, error: error.message });
        return;
      }

      const apps = [];
      for (const line of (stdout || '').trim().split('\n')) {
        try {
          const obj = JSON.parse(line.trim());
          if (obj.Name) apps.push({ name: obj.Name, appId: obj.AppID || '' });
        } catch (_) {}
      }

      // Categorize apps
      const categories = {
        'Social Media': /instagram|facebook|whatsapp|telegram|snapchat|twitter|tiktok|messenger|signal|wechat|discord|slack|teams|skype|zoom/i,
        'Games': /game|steam|epic|riot|valorant|minecraft|roblox|fortnite|genshin|xbox|gog|battle\.net|ea app|ubisoft|origin/i,
        'Development': /visual studio|code|android studio|intellij|pycharm|webstorm|sublime|atom|git|docker|postman|terminal|powershell|cmd|node|python|wsl/i,
        'Media': /spotify|vlc|itunes|groove|movies|photos|camera|obs|audacity|premiere|after effects|davinci|clipchamp|paint|gimp|photoshop|blender|foobar|winamp/i,
        'Office': /word|excel|powerpoint|outlook|onenote|access|publisher|teams|libreoffice|notion|evernote|todoist|calendar|mail/i,
        'Browsers': /chrome|firefox|edge|brave|opera|vivaldi|arc|safari/i,
        'System': /settings|control panel|task manager|file explorer|registry|device manager|disk|defender|security|update|backup|recovery|clock|calculator|notepad|snipping|store/i,
      };

      const categorized = {};
      for (const cat of Object.keys(categories)) categorized[cat] = [];
      categorized['Other'] = [];

      for (const app of apps) {
        let matched = false;
        for (const [cat, regex] of Object.entries(categories)) {
          if (regex.test(app.name)) {
            categorized[cat].push(app);
            matched = true;
            break;
          }
        }
        if (!matched) categorized['Other'].push(app);
      }

      resolve({ success: true, totalApps: apps.length, categories: categorized });
    });
  });
});

// ─── Smart File/Folder Search ───────────────────────────────────────────────

// Track active background searches so Friday can report results later
const activeSearches = new Map();
let searchIdCounter = 0;

ipcMain.handle('search-files', async (event, { query, searchIn, type }) => {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve({ success: false, error: 'File search only supported on Windows.' });
      return;
    }

    const homeDir = os.homedir(); // e.g. C:\Users\AGNIV
    const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);
    const searchType = type || 'all'; // 'file', 'folder', 'all'

    // Build concrete search paths — resolved in Node so they are plain strings in PowerShell
    const defaultPaths = searchIn
      ? [searchIn]
      : [
          `${homeDir}\\Desktop`,
          `${homeDir}\\Documents`,
          `${homeDir}\\Downloads`,
          `${homeDir}\\Videos`,
          `${homeDir}\\Music`,
          `${homeDir}\\Pictures`,
          `${homeDir}\\OneDrive`,
          `C:\\`,
          `D:\\`,
          `E:\\`,
          `F:\\`,
        ].filter(p => {
          try { return fs.existsSync(p); } catch { return false; }
        });

    const typeFilter = searchType === 'folder' ? '-Directory' : searchType === 'file' ? '-File' : '';

    // Build a safe PowerShell array of quoted literal paths
    const psPathsArray = defaultPaths
      .map(p => `'${p.replace(/'/g, "''")}'`)
      .join(',');

    const termsArray = searchTerms
      .map(t => `'${t.replace(/'/g, "''")}'`)
      .join(',');

    const psScript = `
$results = @()
$terms = @(${termsArray})
$paths = @(${psPathsArray})

foreach ($searchPath in $paths) {
  if (-not (Test-Path $searchPath -ErrorAction SilentlyContinue)) { continue }
  try {
    $items = Get-ChildItem -Path $searchPath -Recurse ${typeFilter} -ErrorAction SilentlyContinue -Depth 7 |
      Where-Object {
        $name = $_.Name.ToLower()
        $fullPath = $_.FullName.ToLower()
        $allMatch = $true
        foreach ($term in $terms) {
          # Each term must appear somewhere in either the filename or the full path
          if ($name -notlike "*$term*" -and $fullPath -notlike "*$term*") {
            $allMatch = $false
            break
          }
        }
        $allMatch
      } |
      Select-Object -First 25
    foreach ($item in $items) {
      $results += [PSCustomObject]@{
        Name     = $item.Name
        Path     = $item.FullName
        IsDir    = $item.PSIsContainer
        Size     = if ($item.PSIsContainer) { 0 } else { $item.Length }
        Modified = $item.LastWriteTime.ToString('yyyy-MM-dd HH:mm')
      }
    }
  } catch {}
  if ($results.Count -ge 30) { break }
}

if ($results.Count -eq 0) {
  Write-Output 'NO_RESULTS'
} else {
  $results | Select-Object -First 30 | ForEach-Object { $_ | ConvertTo-Json -Compress }
}
`;

    const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
    exec(
      `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`,
      { maxBuffer: 1024 * 1024 * 5, timeout: 60000 },
      (error, stdout) => {
        const output = (stdout || '').trim();

        if (error && !output) {
          resolve({ success: false, error: error.message });
          return;
        }

        if (output === 'NO_RESULTS' || !output) {
          resolve({ success: true, results: [], message: `No files or folders matching "${query}" found.` });
          return;
        }

        const results = [];
        for (const line of output.split('\n')) {
          try { results.push(JSON.parse(line.trim())); } catch (_) {}
        }

        resolve({ success: true, results, message: `Found ${results.length} result(s) for "${query}".` });
      }
    );
  });
});

// Open a found file/folder from search results
ipcMain.handle('open-search-result', async (event, resultPath) => {
  try {
    await shell.openPath(resultPath);
    return { success: true, message: `Opened: ${resultPath}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ─── Image Search & Browse ──────────────────────────────────────────────────

let imageBrowseSession = {
  active: false,
  images: [],     // Array of { url, localPath }
  currentIndex: 0,
  tempDir: '',
  query: '',
};

ipcMain.handle('search-images', async (event, { query, count }) => {
  try {
    const maxImages = Math.min(count || 10, 25);

    // Create temp directory for this browse session
    const tempDir = path.join(os.tmpdir(), 'friday-image-browse');
    if (fs.existsSync(tempDir)) {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
    }
    fs.mkdirSync(tempDir, { recursive: true });

    // Scrape Bing Images for image URLs (no API key needed)
    const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&first=1&count=${maxImages}&qft=+filterui:photo-photo`;

    // Use a hidden BrowserWindow to scrape
    const scrapeWin = new BrowserWindow({
      show: false,
      skipTaskbar: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    });

    return await new Promise((resolve) => {
      let resolved = false;

      scrapeWin.loadURL(searchUrl);

      scrapeWin.webContents.on('did-finish-load', async () => {
        if (resolved) return;
        try {
          const imageUrls = await scrapeWin.webContents.executeJavaScript(`
            (() => {
              const urls = [];
              document.querySelectorAll('a.iusc').forEach(a => {
                try {
                  const m = JSON.parse(a.getAttribute('m') || '{}');
                  if (m.murl && m.murl.startsWith('http')) urls.push(m.murl);
                } catch(_) {}
              });
              if (urls.length === 0) {
                document.querySelectorAll('.mimg, img.mimg').forEach(img => {
                  const src = img.getAttribute('src2') || img.getAttribute('src') || '';
                  if (src.startsWith('http') && !src.includes('bing.com')) urls.push(src);
                });
              }
              return urls.slice(0, ${maxImages});
            })();
          `);

          scrapeWin.destroy();

          if (!imageUrls || imageUrls.length === 0) {
            resolved = true;
            resolve({ success: false, error: 'Could not find any images for that query.' });
            return;
          }

          console.log(`[Friday Images] Found ${imageUrls.length} image URLs for "${query}"`);

          // Download ALL images in parallel using fetch (handles redirects automatically)
          const downloadImage = async (url, index) => {
            try {
              // Validate URL first
              new URL(url);
              const controller = new AbortController();
              const timer = setTimeout(() => controller.abort(), 6000);
              const response = await fetch(url, {
                signal: controller.signal,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
              });
              clearTimeout(timer);
              if (!response.ok) return null;
              const buffer = Buffer.from(await response.arrayBuffer());
              if (buffer.length < 1000) return null; // Skip tiny/broken images
              const ext = url.match(/\.(jpg|jpeg|png|gif|webp|bmp)/i)?.[0] || '.jpg';
              const localPath = path.join(tempDir, `image_${String(index).padStart(3, '0')}${ext}`);
              fs.writeFileSync(localPath, buffer);
              return { url, localPath, index };
            } catch (_) {
              return null;
            }
          };

          // Fire all downloads at once (much faster than batching)
          const results = await Promise.all(
            imageUrls.map((url, i) => downloadImage(url, i))
          );
          const downloaded = results.filter(Boolean);

          if (downloaded.length === 0) {
            resolved = true;
            resolve({ success: false, error: 'Failed to download any images.' });
            return;
          }

          downloaded.sort((a, b) => a.index - b.index);

          imageBrowseSession = {
            active: true,
            images: downloaded,
            currentIndex: 0,
            tempDir,
            query,
          };

          // Open the first image (kill existing photos first)
          exec('powershell -NoProfile -Command "Get-Process | Where-Object { $_.MainWindowTitle -match \'(?i)photo|image_\' } | Stop-Process -Force -ErrorAction SilentlyContinue"', () => {
            exec(`start "" "${downloaded[0].localPath}"`, () => {});
          });

          console.log(`[Friday Images] Downloaded ${downloaded.length} images, opened first.`);
          resolved = true;
          resolve({
            success: true,
            totalImages: downloaded.length,
            currentIndex: 0,
            message: `Found and downloaded ${downloaded.length} images of "${query}". Showing image 1 of ${downloaded.length}. Tell me to show the next image, or say "save this" to save the current one.`
          });

        } catch (err) {
          if (!scrapeWin.isDestroyed()) scrapeWin.destroy();
          if (!resolved) {
            resolved = true;
            resolve({ success: false, error: `Image search failed: ${err.message}` });
          }
        }
      });

      setTimeout(() => {
        if (!resolved) {
          if (!scrapeWin.isDestroyed()) scrapeWin.destroy();
          resolved = true;
          resolve({ success: false, error: 'Image search timed out.' });
        }
      }, 20000);
    });

  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Navigate to next/prev image in browse session
ipcMain.handle('browse-image', async (event, { direction }) => {
  if (!imageBrowseSession.active || imageBrowseSession.images.length === 0) {
    return { success: false, error: 'No active image browse session. Use searchImages first.' };
  }

  const total = imageBrowseSession.images.length;
  if (direction === 'next') {
    imageBrowseSession.currentIndex = Math.min(imageBrowseSession.currentIndex + 1, total - 1);
  } else if (direction === 'prev') {
    imageBrowseSession.currentIndex = Math.max(imageBrowseSession.currentIndex - 1, 0);
  } else if (direction === 'stop') {
    // Close Photos and end session
    exec('powershell -NoProfile -Command "Get-Process | Where-Object { $_.MainWindowTitle -match \'(?i)photo|image_\' } | Stop-Process -Force -ErrorAction SilentlyContinue"', () => {});
    imageBrowseSession.active = false;
    return { success: true, message: 'Stopped image browsing.' };
  }

  const current = imageBrowseSession.images[imageBrowseSession.currentIndex];
  // Close existing Photos instances before opening the new one
  exec('powershell -NoProfile -Command "Get-Process | Where-Object { $_.MainWindowTitle -match \'(?i)photo|image_\' } | Stop-Process -Force -ErrorAction SilentlyContinue"', () => {
    exec(`start "" "${current.localPath}"`, () => {});
  });

  return {
    success: true,
    currentIndex: imageBrowseSession.currentIndex,
    total,
    message: `Showing image ${imageBrowseSession.currentIndex + 1} of ${total}.${imageBrowseSession.currentIndex >= total - 1 ? ' This is the last image.' : ''}`
  };
});

// Save the currently browsed image
ipcMain.handle('save-browsed-image', async (event, { fileName, savePath }) => {
  if (!imageBrowseSession.active || imageBrowseSession.images.length === 0) {
    return { success: false, error: 'No active image browse session.' };
  }

  try {
    const current = imageBrowseSession.images[imageBrowseSession.currentIndex];
    const targetDir = savePath || app.getPath('desktop');
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    const ext = path.extname(current.localPath) || '.jpg';
    const safeName = fileName.endsWith(ext) ? fileName : `${fileName}${ext}`;
    const targetPath = path.join(targetDir, safeName);

    fs.copyFileSync(current.localPath, targetPath);
    console.log(`[Friday Images] Saved image to: ${targetPath}`);
    return { success: true, savedPath: targetPath, message: `Image saved to ${targetPath}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ─── Window Positioning ──────────────────────────────────────────────────────
// Positions an app's window at a specific area of the screen.
// Supported positions: fullscreen, left, right, top-left, top-right, bottom-left, bottom-right

ipcMain.handle('position-window', async (event, { appName, position }) => {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve({ success: false, error: 'Window positioning is only supported on Windows.' });
      return;
    }

    // Map friendly names to actual process names (reuse from close-app logic)
    const processMap = {
      'chrome': 'chrome', 'google chrome': 'chrome',
      'firefox': 'firefox', 'edge': 'msedge', 'microsoft edge': 'msedge',
      'brave': 'brave', 'notepad': 'notepad', 'notepad++': 'notepad++',
      'calculator': 'CalculatorApp', 'calc': 'CalculatorApp',
      'paint': 'mspaint', 'cmd': 'cmd', 'command prompt': 'cmd',
      'terminal': 'WindowsTerminal', 'windows terminal': 'WindowsTerminal',
      'powershell': 'powershell', 'file explorer': 'explorer', 'explorer': 'explorer',
      'spotify': 'Spotify', 'discord': 'Discord', 'slack': 'slack',
      'vscode': 'Code', 'visual studio code': 'Code', 'vs code': 'Code',
      'word': 'WINWORD', 'excel': 'EXCEL', 'powerpoint': 'POWERPNT',
      'outlook': 'OUTLOOK', 'teams': 'ms-teams', 'vlc': 'vlc',
      'obs': 'obs64', 'steam': 'steam',
    };

    const name = appName.toLowerCase().trim();
    const processName = processMap[name] || appName;
    const pos = (position || 'fullscreen').toLowerCase().trim();

    // Build PowerShell script to find the window and move/resize it
    const psScript = `
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class WinAPI {
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern int GetSystemMetrics(int nIndex);
}
'@

$targetName = '${processName.replace(/'/g, "''")}'
$friendlyName = '${appName.replace(/'/g, "''")}'

# Find the process window
$proc = Get-Process | Where-Object {
  ($_.ProcessName -match [Regex]::Escape($targetName) -or $_.MainWindowTitle -match [Regex]::Escape($friendlyName)) -and $_.MainWindowHandle -ne [IntPtr]::Zero
} | Select-Object -First 1

if (-not $proc) {
  Write-Output 'NOT_FOUND'
  exit
}

$hWnd = $proc.MainWindowHandle

# Get screen dimensions
$screenW = [WinAPI]::GetSystemMetrics(0)  # SM_CXSCREEN
$screenH = [WinAPI]::GetSystemMetrics(1)  # SM_CYSCREEN

# Restore window first (in case it's maximized/minimized) — SW_RESTORE = 9
[WinAPI]::ShowWindow($hWnd, 9) | Out-Null
Start-Sleep -Milliseconds 200

$position = '${pos}'

switch ($position) {
  'fullscreen' {
    # Maximize — SW_MAXIMIZE = 3
    [WinAPI]::ShowWindow($hWnd, 3) | Out-Null
  }
  'left' {
    [WinAPI]::MoveWindow($hWnd, 0, 0, [int]($screenW / 2), $screenH, $true) | Out-Null
  }
  'right' {
    [WinAPI]::MoveWindow($hWnd, [int]($screenW / 2), 0, [int]($screenW / 2), $screenH, $true) | Out-Null
  }
  'top-left' {
    [WinAPI]::MoveWindow($hWnd, 0, 0, [int]($screenW / 2), [int]($screenH / 2), $true) | Out-Null
  }
  'top-right' {
    [WinAPI]::MoveWindow($hWnd, [int]($screenW / 2), 0, [int]($screenW / 2), [int]($screenH / 2), $true) | Out-Null
  }
  'bottom-left' {
    [WinAPI]::MoveWindow($hWnd, 0, [int]($screenH / 2), [int]($screenW / 2), [int]($screenH / 2), $true) | Out-Null
  }
  'bottom-right' {
    [WinAPI]::MoveWindow($hWnd, [int]($screenW / 2), [int]($screenH / 2), [int]($screenW / 2), [int]($screenH / 2), $true) | Out-Null
  }
  default {
    # Default to fullscreen
    [WinAPI]::ShowWindow($hWnd, 3) | Out-Null
  }
}

[WinAPI]::SetForegroundWindow($hWnd) | Out-Null
Write-Output 'POSITIONED'
`;

    const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
    exec(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`, { timeout: 15000 }, (error, stdout) => {
      const output = (stdout || '').trim();
      if (output === 'POSITIONED') {
        console.log(`[Friday] Positioned ${appName} to ${pos}`);
        resolve({ success: true, message: `Positioned ${appName} to ${pos}.` });
      } else if (output === 'NOT_FOUND') {
        resolve({ success: false, error: `Could not find a window for '${appName}'. Make sure it's running.` });
      } else {
        resolve({ success: false, error: error ? error.message : `Failed to position window: ${output}` });
      }
    });
  });
});

// ─── Open Document by Name ────────────────────────────────────────────────────
// Searches user folders for a file matching the given name, then opens it.
ipcMain.handle('open-document', async (event, { name, searchIn }) => {
  const homeDir = os.homedir();
  const searchPaths = searchIn
    ? [searchIn]
    : [
        path.join(homeDir, 'Documents'),
        path.join(homeDir, 'Desktop'),
        path.join(homeDir, 'Downloads'),
        path.join(homeDir, 'OneDrive'),
        path.join(homeDir, 'Videos'),
        path.join(homeDir, 'Pictures'),
        'D:\\', 'E:\\', 'F:\\',
      ].filter(p => { try { return fs.existsSync(p); } catch { return false; } });

  const safeName = name.replace(/'/g, "''");
  const psPathsArray = searchPaths.map(p => `'${p.replace(/'/g, "''")}'`).join(',');

  const psScript = `
$searchName = '${safeName}'
$paths = @(${psPathsArray})
$found = $null

foreach ($searchPath in $paths) {
  if (-not (Test-Path $searchPath -ErrorAction SilentlyContinue)) { continue }
  try {
    $match = Get-ChildItem -Path $searchPath -Recurse -File -ErrorAction SilentlyContinue -Depth 8 |
      Where-Object { $_.Name -like "*$searchName*" } |
      Select-Object -First 1
    if ($match) { $found = $match.FullName; break }
  } catch {}
}

if ($found) {
  Write-Output "FOUND:$found"
} else {
  Write-Output 'NOT_FOUND'
}
`;

  return new Promise((resolve) => {
    const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
    exec(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`,
      { timeout: 45000 },
      async (error, stdout) => {
        const output = (stdout || '').trim();
        if (output.startsWith('FOUND:')) {
          const filePath = output.slice(6).trim();
          console.log(`[Friday] Opening document: ${filePath}`);
          try {
            await shell.openPath(filePath);
            resolve({ success: true, filePath, message: `Opened: ${path.basename(filePath)}` });
          } catch (err) {
            resolve({ success: false, error: err.message });
          }
        } else {
          resolve({ success: false, error: `Could not find a file named "${name}" on this system.` });
        }
      });
  });
});

// ─── Delete File / Folder ─────────────────────────────────────────────────────
ipcMain.handle('delete-file', async (event, { filePath, permanently }) => {
  if (!filePath) return { success: false, error: 'No file path provided.' };

  if (!fs.existsSync(filePath)) {
    return { success: false, error: `File or folder not found: ${filePath}` };
  }

  return new Promise((resolve) => {
    if (permanently) {
      // Permanent delete
      try {
        fs.rmSync(filePath, { recursive: true, force: true });
        console.log(`[Friday] Permanently deleted: ${filePath}`);
        resolve({ success: true, message: `Permanently deleted: ${path.basename(filePath)}` });
      } catch (err) {
        resolve({ success: false, error: err.message });
      }
    } else {
      // Move to Recycle Bin via PowerShell Shell.Application
      const safePath = filePath.replace(/'/g, "''");
      const psScript = `
Add-Type -AssemblyName Microsoft.VisualBasic
[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile('${safePath}', 'OnlyErrorDialogs', 'SendToRecycleBin')
Write-Output 'RECYCLED'
`;
      const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
      exec(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`,
        { timeout: 15000 },
        (error, stdout) => {
          const output = (stdout || '').trim();
          if (output === 'RECYCLED' || !error) {
            console.log(`[Friday] Moved to Recycle Bin: ${filePath}`);
            resolve({ success: true, message: `Moved to Recycle Bin: ${path.basename(filePath)}` });
          } else {
            resolve({ success: false, error: error?.message || 'Failed to move to Recycle Bin.' });
          }
        });
    }
  });
});

// ─── Empty Recycle Bin ────────────────────────────────────────────────────────
ipcMain.handle('empty-recycle-bin', async () => {
  return new Promise((resolve) => {
    const psScript = `Clear-RecycleBin -Force -ErrorAction SilentlyContinue; Write-Output 'CLEARED'`;
    const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
    exec(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`,
      { timeout: 20000 },
      (error, stdout) => {
        const output = (stdout || '').trim();
        if (output === 'CLEARED' || !error) {
          resolve({ success: true, message: 'Recycle Bin emptied successfully.' });
        } else {
          resolve({ success: false, error: error?.message || 'Failed to empty Recycle Bin.' });
        }
      });
  });
});

// ─── Find & Play Episode ──────────────────────────────────────────────────────
// Searches folderPath for a video matching S{season}E{episode}, plays in chosen player.
ipcMain.handle('find-play-episode', async (event, { folderPath, season, episode, player }) => {
  if (!folderPath || !fs.existsSync(folderPath)) {
    return { success: false, error: `Folder not found: ${folderPath}` };
  }

  const VIDEO_EXTS = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.ts'];

  // Build regex patterns for various episode naming schemes
  const s = String(season || 1).padStart(2, '0');
  const e = String(episode || 1).padStart(2, '0');
  const singleS = String(season || 1);
  const singleE = String(episode || 1);

  const patterns = [
    new RegExp(`[Ss]${s}[Ee]${e}`, 'i'),
    new RegExp(`[Ss]${singleS}[Ee]${singleE}[^0-9]`, 'i'),
    new RegExp(`${singleS}x${singleE}[^0-9]`, 'i'),
    new RegExp(`[Ee]pisode[\\s._-]*${singleE}[^0-9]`, 'i'),
    new RegExp(`[Ee]p[\\s._-]*${singleE}[^0-9]`, 'i'),
  ];

  let foundFile = null;

  try {
    // Recursive search through the folder
    const findVideo = (dir, depth = 0) => {
      if (depth > 5 || foundFile) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      // Sort to process season-named folders first
      entries.sort((a, b) => a.name.localeCompare(b.name));
      for (const entry of entries) {
        if (foundFile) break;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          findVideo(fullPath, depth + 1);
        } else if (VIDEO_EXTS.includes(path.extname(entry.name).toLowerCase())) {
          for (const pat of patterns) {
            if (pat.test(entry.name)) {
              foundFile = fullPath;
              break;
            }
          }
        }
      }
    };
    findVideo(folderPath);
  } catch (err) {
    return { success: false, error: err.message };
  }

  if (!foundFile) {
    return {
      success: false,
      error: `Could not find Season ${season} Episode ${episode} in "${folderPath}". Make sure files are named with patterns like S01E01 or S1E1.`,
    };
  }

  // Launch in chosen player
  const playerName = (player || 'vlc').toLowerCase();
  let launchCmd = '';

  if (playerName.includes('vlc')) {
    launchCmd = `start "" "vlc" "${foundFile}"`;
  } else if (playerName.includes('media') || playerName.includes('wmp') || playerName.includes('windows')) {
    launchCmd = `start wmplayer "${foundFile}"`;
  } else if (playerName.includes('mpv')) {
    launchCmd = `start "" mpv "${foundFile}"`;
  } else {
    // Default: system default player
    launchCmd = `start "" "${foundFile}"`;
  }

  return new Promise((resolve) => {
    exec(launchCmd, (error) => {
      if (error) {
        // Fallback to shell default
        shell.openPath(foundFile).then(() => {
          resolve({ success: true, filePath: foundFile, message: `Playing: ${path.basename(foundFile)}` });
        }).catch(err => resolve({ success: false, error: err.message }));
      } else {
        console.log(`[Friday] Playing episode: ${foundFile} in ${playerName}`);
        resolve({ success: true, filePath: foundFile, message: `Playing in ${playerName}: ${path.basename(foundFile)}` });
      }
    });
  });
});

// ─── List Folder Contents (sorted) ───────────────────────────────────────────
ipcMain.handle('list-folder-contents', async (event, { folderPath, sortBy }) => {
  if (!folderPath || !fs.existsSync(folderPath)) {
    return { success: false, error: `Folder not found: ${folderPath}` };
  }

  const sortByLower = (sortBy || 'name').toLowerCase();
  const safePath = folderPath.replace(/'/g, "''");

  const psScript = `
$items = Get-ChildItem -Path '${safePath}' -ErrorAction SilentlyContinue

$sorted = switch ('${sortByLower}') {
  'name'        { $items | Sort-Object Name }
  'alphabetical'{ $items | Sort-Object Name }
  'date'        { $items | Sort-Object LastWriteTime -Descending }
  'modified'    { $items | Sort-Object LastWriteTime -Descending }
  'created'     { $items | Sort-Object CreationTime -Descending }
  'size'        { $items | Sort-Object Length -Descending }
  'type'        { $items | Sort-Object @{E={if($_.PSIsContainer){'0_folder'}else{$_.Extension}}} }
  default       { $items | Sort-Object Name }
}

$sorted | ForEach-Object {
  [PSCustomObject]@{
    Name     = $_.Name
    IsDir    = $_.PSIsContainer
    Size     = if ($_.PSIsContainer) { 0 } else { $_.Length }
    Modified = $_.LastWriteTime.ToString('yyyy-MM-dd HH:mm')
    Created  = $_.CreationTime.ToString('yyyy-MM-dd HH:mm')
    Ext      = $_.Extension
  } | ConvertTo-Json -Compress
}
`;

  return new Promise((resolve) => {
    const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
    exec(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`,
      { maxBuffer: 1024 * 1024 * 2, timeout: 20000 },
      (error, stdout) => {
        if (error && !stdout) {
          resolve({ success: false, error: error.message });
          return;
        }
        const items = [];
        for (const line of (stdout || '').trim().split('\n')) {
          try { items.push(JSON.parse(line.trim())); } catch (_) {}
        }
        resolve({
          success: true,
          totalItems: items.length,
          sortedBy: sortByLower,
          items,
          message: `Found ${items.length} items in "${path.basename(folderPath)}", sorted by ${sortByLower}.`,
        });
      });
  });
});

// ─── Move / Rename File ─────────────────────────────────────────────────────
ipcMain.handle('move-file', async (event, { sourcePath, destPath }) => {
  try {
    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: `Source not found: ${sourcePath}` };
    }
    // Ensure destination directory exists
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.renameSync(sourcePath, destPath);
    return { success: true, message: `Moved "${path.basename(sourcePath)}" to "${destPath}"` };
  } catch (err) {
    // renameSync fails across drives — fall back to copy + delete
    try {
      const stat = fs.statSync(sourcePath);
      if (stat.isDirectory()) {
        // Recursive copy for directories
        fs.cpSync(sourcePath, destPath, { recursive: true });
        fs.rmSync(sourcePath, { recursive: true, force: true });
      } else {
        fs.copyFileSync(sourcePath, destPath);
        fs.unlinkSync(sourcePath);
      }
      return { success: true, message: `Moved "${path.basename(sourcePath)}" to "${destPath}"` };
    } catch (err2) {
      return { success: false, error: `Move failed: ${err2.message}` };
    }
  }
});

// ─── Organize Folder (batch move files into subfolders) ─────────────────────
ipcMain.handle('organize-folder', async (event, { folderPath, plan }) => {
  // plan is an array of: { fileName, targetSubFolder }
  // e.g. [{ fileName: "movie.mkv", targetSubFolder: "2015 - Stand By Me Doraemon" }]
  try {
    if (!fs.existsSync(folderPath)) {
      return { success: false, error: `Folder not found: ${folderPath}` };
    }

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const item of plan) {
      const srcPath = path.join(folderPath, item.fileName);
      const subDir = path.join(folderPath, item.targetSubFolder);
      const destPath = path.join(subDir, item.fileName);

      if (!fs.existsSync(srcPath)) {
        results.push({ file: item.fileName, status: 'not_found' });
        failCount++;
        continue;
      }

      try {
        // Create subfolder if it doesn't exist
        if (!fs.existsSync(subDir)) {
          fs.mkdirSync(subDir, { recursive: true });
        }
        // Move the file
        fs.renameSync(srcPath, destPath);
        results.push({ file: item.fileName, status: 'moved', to: item.targetSubFolder });
        successCount++;
      } catch (moveErr) {
        // Fallback: copy + delete (for cross-drive)
        try {
          fs.copyFileSync(srcPath, destPath);
          fs.unlinkSync(srcPath);
          results.push({ file: item.fileName, status: 'moved', to: item.targetSubFolder });
          successCount++;
        } catch (e) {
          results.push({ file: item.fileName, status: 'error', error: e.message });
          failCount++;
        }
      }
    }

    return {
      success: true,
      message: `Organized ${successCount} files into subfolders. ${failCount > 0 ? `${failCount} files had issues.` : ''}`,
      results,
      totalMoved: successCount,
      totalFailed: failCount,
    };
  } catch (err) {
    return { success: false, error: `Organize failed: ${err.message}` };
  }
});

// ─── Conversation Cache (Local Persistent Memory) ──────────────────────────
// Stores full conversation history locally so Friday can recall past sessions
// even after the server is closed and restarted days later.
const CACHE_DIR = path.join(__dirname, '..', '.friday-data', 'cache');
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

// IPC: End session and persist
ipcMain.handle('cache-end-session', (event, { summary, topics }) => {
  if (!currentCacheSession) return { success: false };

  currentCacheSession.endedAt = new Date().toISOString();
  currentCacheSession.topics = topics || [];
  currentCacheSession.summary = summary || '';

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

// ─── News Headlines (for Widget) ───────────────────────────────────────────
// Fetches Google News RSS — no API key required
ipcMain.handle('fetch-news', async () => {
  return new Promise((resolve) => {
    const newsUrl = 'https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en';
    https.get(newsUrl, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const items = [];
          const itemRegex = /<item>([\s\S]*?)<\/item>/g;
          let m;
          while ((m = itemRegex.exec(data)) && items.length < 12) {
            const xml = m[1];
            const title = (xml.match(/<title>(.*?)<\/title>/) || [])[1]
              ?.replace(/<!\[CDATA\[(.*?)\]\]>/, '$1')
              ?.replace(/&amp;/g, '&')
              ?.replace(/&lt;/g, '<')
              ?.replace(/&gt;/g, '>') || '';
            const link = (xml.match(/<link>(.*?)<\/link>/) || [])[1] || '';
            const pubDate = (xml.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || '';
            const source = (xml.match(/<source.*?>(.*?)<\/source>/) || [])[1] || '';
            if (title) items.push({ title, link, pubDate, source });
          }
          resolve({ success: true, articles: items });
        } catch (err) {
          resolve({ success: false, error: 'Failed to parse news feed' });
        }
      });
    }).on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
});

// ─── YouTube Embed URL (for Music/Video Widget) ───────────────────────────
// Returns a YouTube video ID for embedding without opening Chrome
ipcMain.handle('search-youtube-embed', async (event, { query }) => {
  try {
    const response = await fetch(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
    );
    const text = await response.text();
    const match = text.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
    if (match && match[1]) {
      return { success: true, videoId: match[1], embedUrl: `https://www.youtube.com/embed/${match[1]}?autoplay=1&rel=0` };
    }
    return { success: false, error: 'Could not find a video.' };
  } catch (e) {
    return { success: false, error: e.message };
  }
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
