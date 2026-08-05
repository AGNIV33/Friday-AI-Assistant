const { ipcMain } = require('electron');

// ─── Vision IPC Handlers (screen capture + cursor position) ──────────────────
// These use Electron-only APIs (desktopCapturer, screen) for the Vision module.
// Completely isolated — does NOT touch the existing image generation handler.

const { desktopCapturer, screen } = require('electron');

ipcMain.handle('capture-screen', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 },
    });
    if (sources.length === 0) {
      return { error: 'No screen sources available.' };
    }
    // Return the primary screen's thumbnail as a data URL
    return sources[0].thumbnail.toDataURL();
  } catch (err) {
    console.error('[Friday Vision] Screen capture failed:', err.message);
    return { error: err.message };
  }
});

ipcMain.handle('get-cursor-position', () => {
  try {
    const point = screen.getCursorScreenPoint();
    return { x: point.x, y: point.y };
  } catch (err) {
    console.error('[Friday Vision] Cursor position failed:', err.message);
    return { x: 0, y: 0 };
  }
});

ipcMain.handle('analyze-vision', async (event, { base64DataUrl, prompt, context, apiKey, model, baseUrl }) => {
  try {
    const systemMessage = context
      ? `You are Friday's vision system — an advanced AI visual analysis module. Analyze the image provided. Additional context: ${context}`
      : 'You are Friday\'s vision system — an advanced AI visual analysis module. Analyze the image provided and describe what you see clearly and concisely.';

    const messages = [
      { role: 'system', content: systemMessage },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: base64DataUrl } },
          { type: 'text', text: prompt },
        ],
      },
    ];

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages,
        max_tokens: 1024,
        temperature: 0.6,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    return { success: true, content: data.choices?.[0]?.message?.content || '' };
  } catch (err) {
    console.error('[Friday Vision] Analysis failed:', err.message);
    return { success: false, error: err.message };
  }
});

