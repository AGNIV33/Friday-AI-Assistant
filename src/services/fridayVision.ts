// ─── Friday Vision Service ────────────────────────────────────────────────────
// Core vision API service for the Nemotron vision model.
// Completely isolated from the existing image generation feature.
// Uses VITE_VISION_* env vars — never touches NVIDIA_API_KEY.

export interface VisionAnalysisResult {
  description: string;
  objects: string[];
  focusArea?: string;
}

const VISION_API_KEY = import.meta.env.VITE_VISION_API_KEY || '';
const VISION_MODEL = import.meta.env.VITE_VISION_MODEL || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning';
const VISION_BASE_URL = import.meta.env.VITE_VISION_BASE_URL || 'https://integrate.api.nvidia.com/v1';
const MAX_RETRIES = 2;

/**
 * Sends an image + text prompt to the Nemotron vision model.
 * Uses OpenAI-compatible chat/completions format.
 */
export async function analyzeImage(
  base64DataUrl: string,
  prompt: string,
  context?: string
): Promise<VisionAnalysisResult> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (!(window as any).fridayVision?.analyzeVision) {
        throw new Error('Electron IPC for analyzeVision not available.');
      }

      const result = await (window as any).fridayVision.analyzeVision({
        base64DataUrl,
        prompt,
        context,
        apiKey: VISION_API_KEY,
        model: VISION_MODEL,
        baseUrl: VISION_BASE_URL,
      });

      if (!result.success) {
        throw new Error(`Vision IPC error: ${result.error}`);
      }

      // Parse response into structured format
      return parseVisionResponse(result.content || '');
    } catch (err: any) {
      lastError = err;
      console.warn(`[FridayVision] Attempt ${attempt + 1}/${MAX_RETRIES + 1} failed:`, err.message);
      if (attempt < MAX_RETRIES) {
        // Wait before retry (exponential backoff)
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error('Vision analysis failed after retries.');
}

/**
 * Annotates a screenshot with a cursor indicator, then analyzes it.
 */
export async function analyzeScreenWithCursor(
  screenshotBase64: string,
  cursorX: number,
  cursorY: number,
  screenWidth: number,
  screenHeight: number,
  userPrompt: string
): Promise<string> {
  const annotatedBase64 = await annotateCursorOnFrame(screenshotBase64, cursorX, cursorY);

  const enhancedPrompt = `The user is pointing their mouse cursor at the red circle marked in this screenshot. Focus your analysis on what is at or near that circle. The cursor is at position (${cursorX}, ${cursorY}) on a ${screenWidth}×${screenHeight} screen. User asked: ${userPrompt}`;

  const result = await analyzeImage(annotatedBase64, enhancedPrompt);
  return result.description;
}

/**
 * Analyzes a webcam frame for finger/hand pointing.
 */
export async function analyzeWebcamWithFinger(
  webcamBase64: string,
  userPrompt: string
): Promise<string> {
  const prompt = `The user may be pointing at something with their finger or hand. Identify what they are pointing at if a hand/finger is visible. Describe the object or scene they are indicating. If no pointing gesture is visible, describe the most prominent objects or scene in the frame. User said: ${userPrompt}`;

  const result = await analyzeImage(webcamBase64, prompt);
  return result.description;
}

/**
 * Draws a cursor indicator (red circle, crosshair, label) on a screenshot.
 */
export function annotateCursorOnFrame(
  base64: string,
  cursorX: number,
  cursorY: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      // Outer ring
      ctx.beginPath();
      ctx.arc(cursorX, cursorY, 30, 0, Math.PI * 2);
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Inner dot
      ctx.beginPath();
      ctx.arc(cursorX, cursorY, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#ff0000';
      ctx.fill();

      // Crosshair lines
      ctx.strokeStyle = '#ff000088';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cursorX - 50, cursorY);
      ctx.lineTo(cursorX + 50, cursorY);
      ctx.moveTo(cursorX, cursorY - 50);
      ctx.lineTo(cursorX, cursorY + 50);
      ctx.stroke();

      // Label
      ctx.fillStyle = '#ff0000';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('← HERE', cursorX + 35, cursorY - 10);

      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => reject(new Error('Failed to load image for cursor annotation.'));
    img.src = base64;
  });
}

/**
 * Parses the raw model text into a structured VisionAnalysisResult.
 */
function parseVisionResponse(content: string): VisionAnalysisResult {
  // Try to extract objects/items mentioned
  const objectPatterns = /(?:I (?:can )?see|there (?:is|are)|visible|shows?|contains?|includes?)\s+(.+?)(?:\.|,|$)/gi;
  const objects: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = objectPatterns.exec(content)) !== null) {
    const items = match[1].split(/,\s*|\s+and\s+/).map(s => s.trim()).filter(s => s.length > 0 && s.length < 50);
    objects.push(...items);
  }

  return {
    description: content,
    objects: [...new Set(objects)].slice(0, 10),
    focusArea: undefined,
  };
}
