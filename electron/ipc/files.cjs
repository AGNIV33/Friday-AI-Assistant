const { ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');

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

    const homeDir = os.homedir();
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

