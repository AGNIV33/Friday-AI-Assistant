const { ipcMain } = require('electron');
const { exec } = require('child_process');

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

