const { app, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');

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

