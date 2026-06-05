// ─── Screen Capture Service ───────────────────────────────────────────────────
// Handles screen capture and cursor position for vision analysis.
// Uses Electron IPC (fridayVision bridge) with browser API fallback.

declare global {
  interface Window {
    fridayVision?: {
      captureScreen: () => Promise<string>;
      getCursorPosition: () => Promise<{ x: number; y: number }>;
    };
  }
}

export interface ScreenCaptureResult {
  base64: string;
  width: number;
  height: number;
}

export interface ScreenWithCursorResult extends ScreenCaptureResult {
  cursorX: number;
  cursorY: number;
}

/**
 * Captures the current screen as a base64 JPEG data URL.
 * Tries Electron IPC first, falls back to getDisplayMedia for browser mode.
 */
export async function captureScreen(): Promise<ScreenCaptureResult> {
  // Electron path — use desktopCapturer via IPC
  if (window.fridayVision?.captureScreen) {
    try {
      const base64 = await window.fridayVision.captureScreen();
      // Extract dimensions from the data URL by loading it into an Image
      const dims = await getImageDimensions(base64);
      return { base64, width: dims.width, height: dims.height };
    } catch (err) {
      console.warn('[ScreenCapture] Electron IPC failed, trying getDisplayMedia:', err);
    }
  }

  // Browser fallback — getDisplayMedia
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
  try {
    const track = stream.getVideoTracks()[0];
    const settings = track.getSettings();
    const width = settings.width || 1920;
    const height = settings.height || 1080;

    // Capture one frame via canvas
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    await video.play();

    // Wait for video to have a valid frame
    await new Promise<void>(resolve => {
      if (video.readyState >= 2) return resolve();
      video.onloadeddata = () => resolve();
    });

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0, width, height);

    const base64 = canvas.toDataURL('image/jpeg', 0.9);
    return { base64, width, height };
  } finally {
    // Always stop the stream immediately
    stream.getTracks().forEach(t => t.stop());
  }
}

/**
 * Gets the current cursor position in screen pixels.
 */
export async function getCursorPosition(): Promise<{ x: number; y: number }> {
  if (window.fridayVision?.getCursorPosition) {
    return window.fridayVision.getCursorPosition();
  }
  // Fallback: return center of screen (browser can't get global cursor position)
  return { x: window.screen.width / 2, y: window.screen.height / 2 };
}

/**
 * Captures the screen and cursor position together.
 */
export async function captureScreenWithCursor(): Promise<ScreenWithCursorResult> {
  const [capture, cursor] = await Promise.all([
    captureScreen(),
    getCursorPosition(),
  ]);

  return {
    ...capture,
    cursorX: cursor.x,
    cursorY: cursor.y,
  };
}

/**
 * Helper to get image dimensions from a data URL.
 */
function getImageDimensions(base64: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => reject(new Error('Failed to load image for dimension extraction'));
    img.src = base64;
  });
}
