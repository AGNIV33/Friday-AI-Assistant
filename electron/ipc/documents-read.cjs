// ─── Document Text Extraction ─────────────────────────────────────────────────
// Pulls readable text out of a file so the model can summarize it.
//
// Deliberately dependency-free. Plain-text formats are read directly; Office
// and PDF files go through Word's COM automation, which this app already uses
// for document writing. That avoids adding a PDF parsing library — at the cost
// of requiring Microsoft Word for those formats, which is checked and reported
// clearly rather than failing mysteriously.

const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

// Cap what goes back to the model — a 300-page PDF would blow the context window.
const MAX_CHARS = 24000;

const PLAIN_TEXT_EXT = new Set([
  '.txt', '.md', '.markdown', '.json', '.csv', '.log', '.xml', '.yml', '.yaml',
  '.html', '.htm', '.css', '.js', '.ts', '.tsx', '.jsx', '.py', '.java', '.c',
  '.cpp', '.h', '.cs', '.go', '.rs', '.rb', '.php', '.sh', '.sql', '.ini', '.cfg',
]);

const WORD_EXT = new Set(['.pdf', '.docx', '.doc', '.rtf', '.odt']);

function truncate(text) {
  const clean = (text || '').replace(/\r\n/g, '\n').trim();
  return clean.length > MAX_CHARS
    ? { text: clean.slice(0, MAX_CHARS), truncated: true, originalChars: clean.length }
    : { text: clean, truncated: false, originalChars: clean.length };
}

/** Extract via Word COM. Word can open PDFs and convert them to text. */
function extractViaWord(filePath) {
  return new Promise((resolve) => {
    const escaped = filePath.replace(/'/g, "''");
    const ps = `
$ErrorActionPreference = 'Stop'
try {
  $word = New-Object -ComObject Word.Application
} catch {
  Write-Output 'FRIDAY_NO_WORD'
  exit
}
$word.Visible = $false
$word.DisplayAlerts = 0
try {
  # ConfirmConversions=$false stops the "convert PDF?" prompt from blocking us
  $doc = $word.Documents.Open('${escaped}', $false, $true)
  $text = $doc.Content.Text
  $doc.Close($false)
  $word.Quit()
  Write-Output 'FRIDAY_OK'
  Write-Output $text
} catch {
  try { $word.Quit() } catch {}
  Write-Output 'FRIDAY_ERR'
  Write-Output $_.Exception.Message
}`;
    const encoded = Buffer.from(ps, 'utf16le').toString('base64');
    exec(
      `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`,
      { timeout: 90000, maxBuffer: 20 * 1024 * 1024 },
      (error, stdout) => {
        if (error) return resolve({ success: false, error: `Could not read the document: ${error.message}` });
        const out = (stdout || '').trim();
        if (out.startsWith('FRIDAY_NO_WORD')) {
          return resolve({
            success: false,
            error: 'Reading PDF and Word files needs Microsoft Word installed, which was not found on this machine. Plain text files (.txt, .md, .csv, code files) work without it.',
          });
        }
        if (out.startsWith('FRIDAY_ERR')) {
          return resolve({ success: false, error: `Word could not open the file: ${out.replace('FRIDAY_ERR', '').trim().slice(0, 200)}` });
        }
        resolve({ success: true, raw: out.replace('FRIDAY_OK', '') });
      }
    );
  });
}

ipcMain.handle('read-document-text', async (event, { filePath }) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return { success: false, error: `No file found at "${filePath}". Use searchFiles first to locate it.` };
    }

    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      return { success: false, error: 'That path is a folder, not a document.' };
    }

    const ext = path.extname(filePath).toLowerCase();
    const name = path.basename(filePath);

    if (PLAIN_TEXT_EXT.has(ext)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const { text, truncated, originalChars } = truncate(raw);
      return { success: true, fileName: name, format: 'text', text, truncated, originalChars };
    }

    if (WORD_EXT.has(ext)) {
      const res = await extractViaWord(filePath);
      if (!res.success) return res;
      const { text, truncated, originalChars } = truncate(res.raw);
      if (!text) {
        return { success: false, error: 'That document appears to contain no readable text (it may be a scanned image).' };
      }
      return { success: true, fileName: name, format: ext.slice(1), text, truncated, originalChars };
    }

    return {
      success: false,
      error: `"${ext}" files can't be read as text. Supported: plain text and code files, plus PDF, DOCX, DOC and RTF via Word.`,
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
