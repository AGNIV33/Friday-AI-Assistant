const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const { exec } = require('child_process');

// ─── YouTube Data API key ────────────────────────────────────────────────────
// Read from .env (loaded by main.cjs before this module is required).
// Without it, the YouTube-backed features degrade with a clear message instead
// of firing off requests that would fail with an opaque 400.
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';

function requireYoutubeKey() {
  return YOUTUBE_API_KEY
    ? null
    : { success: false, error: 'No YouTube API key configured. Add YOUTUBE_API_KEY to your .env file and restart Friday.' };
}

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
  try {
    if (platform.toLowerCase() === "youtube") {
      const missingKey = requireYoutubeKey();
      if (missingKey) return missingKey;
      const liveKeywords = /\b(live|livestream|live\s*stream|24\/7|news\s*live|live\s*news|live\s*tv)\b/i;
      const isLiveIntent = liveKeywords.test(query);
      let videoId = null;
      let matchTitle = '';

      // Step 1: If live intent detected, search for currently broadcasting live streams first
      if (isLiveIntent) {
        try {
          const liveUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&eventType=live&maxResults=3&relevanceLanguage=en&order=relevance&key=${YOUTUBE_API_KEY}`;
          console.log(`[Friday PlayMedia] Searching YouTube LIVE for: "${query}"`);
          const liveRes = await fetch(liveUrl);
          if (liveRes.ok) {
            const liveData = await liveRes.json();
            if (liveData.items && liveData.items.length > 0) {
              videoId = liveData.items[0].id?.videoId;
              matchTitle = liveData.items[0].snippet?.title || '';
              console.log(`[Friday PlayMedia] ✓ Found LIVE stream: ${videoId} — "${matchTitle}"`);
            } else {
              console.log(`[Friday PlayMedia] No live streams found, falling back to regular search`);
            }
          }
        } catch (liveErr) {
          console.warn('[Friday PlayMedia] Live search failed, trying regular:', liveErr.message);
        }
      }

      // Step 2: If no live result (or not a live query), do a regular API search
      if (!videoId) {
        try {
          const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=1&order=relevance&key=${YOUTUBE_API_KEY}`;
          console.log(`[Friday PlayMedia] Searching YouTube for: "${query}"`);
          const searchRes = await fetch(searchUrl);
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            if (searchData.items && searchData.items.length > 0) {
              videoId = searchData.items[0].id?.videoId;
              matchTitle = searchData.items[0].snippet?.title || '';
              console.log(`[Friday PlayMedia] ✓ Found video: ${videoId} — "${matchTitle}"`);
            }
          }
        } catch (apiErr) {
          console.warn('[Friday PlayMedia] API search failed, trying HTML fallback:', apiErr.message);
        }
      }

      // Step 3: Last resort — HTML scraping fallback (in case API quota is exhausted)
      if (!videoId) {
        try {
          console.log(`[Friday PlayMedia] API returned no results, falling back to HTML scrape`);
          const response = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`);
          const text = await response.text();
          const match = text.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
          if (match && match[1]) {
            videoId = match[1];
            console.log(`[Friday PlayMedia] ✓ Fallback found video: ${videoId}`);
          }
        } catch (scrapeErr) {
          console.error('[Friday PlayMedia] HTML scrape also failed:', scrapeErr.message);
        }
      }

      if (videoId) {
        // Open YouTube directly. If the user installed the YouTube Windows App, it intercepts this natively!
        shell.openExternal(`https://www.youtube.com/watch?v=${videoId}`);
        return { success: true, videoId, title: matchTitle };
      }
      return { success: false, error: "Could not find a matching video on YouTube." };

    } else if (platform.toLowerCase() === "spotify") {
      // Open Spotify Desktop straight to the search results
      const spotifyUrl = `spotify:search:${encodeURIComponent(query)}`;
      await shell.openExternal(spotifyUrl);

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
      return { success: true };

    } else {
      return { success: false, error: "Unsupported media platform." };
    }
  } catch (e) {
    console.error('[Friday PlayMedia] Error:', e.message);
    return { success: false, error: e.message };
  }
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
        // Collect the page text AND the result links. `data` is unchanged for
        // existing callers; `sources` is additive and powers cited research.
        const result = await searchWin.webContents.executeJavaScript(`
          (() => {
            const anchors = Array.from(document.querySelectorAll('a[href^="http"]'));
            const seen = new Set();
            const sources = [];
            for (const a of anchors) {
              const href = a.href;
              // Skip Google's own chrome (account links, image search, cached, etc.)
              if (/google\\.|gstatic\\.|youtube\\.com\\/redirect|webcache/.test(href)) continue;
              const h3 = a.querySelector('h3');
              const title = (h3 ? h3.innerText : '').trim();
              if (!title) continue;
              let domain = '';
              try { domain = new URL(href).hostname.replace(/^www\\./, ''); } catch (e) { continue; }
              if (seen.has(href)) continue;
              seen.add(href);
              sources.push({ title: title.substring(0, 150), url: href, domain });
              if (sources.length >= 8) break;
            }

            document.querySelectorAll('script, style, svg, img').forEach(e => e.remove());
            const main = document.querySelector('#main') || document.querySelector('#search') || document.body;
            let content = main.innerText || "";
            return {
              text: content.replace(/\\s+/g, ' ').trim().substring(0, 4000),
              sources,
            };
          })();
        `);
        searchWin.destroy();
        resolve({ success: true, data: result.text, sources: result.sources || [] });
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

// ─── YouTube News Search (for News Visualizer) ────────────────────────────
// Uses YouTube Data API v3 with 1-hour caching to save quota
const youtubeNewsCache = new Map(); // key: query → { timestamp, results }
const YOUTUBE_CACHE_TTL = 60 * 60 * 1000; // 1 hour in ms

ipcMain.handle('search-youtube-news', async (event, { query }) => {
  try {
    const cacheKey = (query || 'trending').toLowerCase().trim();

    // ── Check cache first ──
    const cached = youtubeNewsCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < YOUTUBE_CACHE_TTL) {
      console.log(`[Friday News] Cache HIT for "${cacheKey}" (${Math.round((Date.now() - cached.timestamp) / 1000)}s old)`);
      return { success: true, results: cached.results, cached: true };
    }

    // Checked after the cache so previously fetched results still serve.
    const missingKey = requireYoutubeKey();
    if (missingKey) return missingKey;

    // ── Build search query prioritizing live streams ──
    const searchQuery = `${query} live stream news`;

    // Fetch live broadcasts only
    const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchQuery)}&type=video&eventType=live&maxResults=5&relevanceLanguage=en&key=${YOUTUBE_API_KEY}`;

    console.log(`[Friday News] Searching YouTube LIVE: "${searchQuery}"`);

    const response = await fetch(apiUrl);
    if (!response.ok) {
      const errText = await response.text();
      console.error('[Friday News] YouTube API error:', response.status, errText);
      return { success: false, error: `YouTube API error: ${response.status}` };
    }

    const data = await response.json();
    const results = (data.items || []).map(item => ({
      id: item.id?.videoId || '',
      title: item.snippet?.title || 'Untitled',
      description: item.snippet?.description || '',
      thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || '',
      channelTitle: item.snippet?.channelTitle || '',
      publishedAt: item.snippet?.publishedAt || '',
    }));

    // ── Store in cache ──
    youtubeNewsCache.set(cacheKey, { timestamp: Date.now(), results });
    console.log(`[Friday News] Cached ${results.length} results for "${cacheKey}"`);

    return { success: true, results, cached: false };
  } catch (e) {
    console.error('[Friday News] Search failed:', e.message);
    return { success: false, error: e.message };
  }
});

// ─── YouTube Embed URL (for Music/Video Widget) ───────────────────────────
// Returns a YouTube video ID for embedding without opening Chrome
// Uses YouTube Data API v3 with live stream detection, falls back to HTML scraping
ipcMain.handle('search-youtube-embed', async (event, { query }) => {
  try {
    const liveKeywords = /\b(live|livestream|live\s*stream|24\/7|news\s*live|live\s*news|live\s*tv)\b/i;
    const isLiveIntent = liveKeywords.test(query);
    let videoId = null;

    // Steps 1 and 2 need an API key; step 3 does not. Skipping them when the
    // key is absent means this handler still works via scraping.
    // Step 1: If live intent, search for live broadcasts first
    if (isLiveIntent && YOUTUBE_API_KEY) {
      try {
        const liveUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&eventType=live&maxResults=3&relevanceLanguage=en&order=relevance&key=${YOUTUBE_API_KEY}`;
        const liveRes = await fetch(liveUrl);
        if (liveRes.ok) {
          const liveData = await liveRes.json();
          if (liveData.items && liveData.items.length > 0) {
            videoId = liveData.items[0].id?.videoId;
            console.log(`[Friday Embed] ✓ Found LIVE stream: ${videoId}`);
          }
        }
      } catch (_) {}
    }

    // Step 2: Regular API search
    if (!videoId && YOUTUBE_API_KEY) {
      try {
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=1&order=relevance&key=${YOUTUBE_API_KEY}`;
        const searchRes = await fetch(searchUrl);
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          if (searchData.items && searchData.items.length > 0) {
            videoId = searchData.items[0].id?.videoId;
            console.log(`[Friday Embed] ✓ Found video: ${videoId}`);
          }
        }
      } catch (_) {}
    }

    // Step 3: HTML scraping fallback
    if (!videoId) {
      const response = await fetch(
        `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
      );
      const text = await response.text();
      const match = text.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
      if (match && match[1]) {
        videoId = match[1];
      }
    }

    if (videoId) {
      return { success: true, videoId, embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0` };
    }
    return { success: false, error: 'Could not find a video.' };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

