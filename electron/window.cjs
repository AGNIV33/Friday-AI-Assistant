const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const { setMainWindow } = require('./proactive.cjs');
const isDev = !app.isPackaged;

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
  // Hand the window to the proactive bus so main-process events can reach the UI
  setMainWindow(win);

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


module.exports = { createWindow };
