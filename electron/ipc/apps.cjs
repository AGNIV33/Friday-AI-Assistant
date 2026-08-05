const { app, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');

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

