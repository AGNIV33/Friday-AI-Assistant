// ─── useVisionCommands Hook ───────────────────────────────────────────────────
// Manages vision state and actions for camera/screen analysis.
// Used by useFriday's tool call handler to execute vision operations.

import { useState, useRef, useCallback, type RefObject } from 'react';
import { CameraCapture } from '../services/cameraCapture';
import { captureScreenWithCursor } from '../services/screenCapture';
import { analyzeWebcamWithFinger, analyzeScreenWithCursor } from '../services/fridayVision';
import type { VisionMode } from '../components/VisionHUD';

export interface UseVisionCommandsReturn {
  isVisionActive: boolean;
  visionMode: VisionMode;
  currentResult: string | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  screenThumbnail: string | null;
  cursorPosition: { x: number; y: number } | null;
  screenDimensions: { width: number; height: number } | null;
  triggerCameraAnalysis: (userPrompt: string) => Promise<string>;
  triggerScreenAnalysis: (userPrompt: string) => Promise<string>;
  closeVision: () => void;
}

export function useVisionCommands(): UseVisionCommandsReturn {
  const [visionMode, setVisionMode] = useState<VisionMode>('idle');
  const [currentResult, setCurrentResult] = useState<string | null>(null);
  const [screenThumbnail, setScreenThumbnail] = useState<string | null>(null);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);
  const [screenDimensions, setScreenDimensions] = useState<{ width: number; height: number } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraRef = useRef<CameraCapture | null>(null);

  /**
   * Opens camera, scans, analyzes the webcam frame, and returns the result.
   */
  const triggerCameraAnalysis = useCallback(async (userPrompt: string): Promise<string> => {
    try {
      // Reset state
      setCurrentResult(null);
      setScreenThumbnail(null);
      setCursorPosition(null);
      setScreenDimensions(null);
      setVisionMode('scanning');

      // Open camera if not already open
      if (!cameraRef.current) {
        cameraRef.current = new CameraCapture();
      }

      if (!cameraRef.current.isOpen()) {
        const videoEl = await cameraRef.current.open();
        videoRef.current = videoEl;
      }

      // Wait for camera to stabilize (1.5s)
      await new Promise(resolve => setTimeout(resolve, 1500));

      setVisionMode('analyzing');

      // Capture frame and analyze
      const frame = cameraRef.current.captureFrame(0.85);
      const result = await analyzeWebcamWithFinger(frame, userPrompt);

      setCurrentResult(result);
      setVisionMode('result');

      // Keep camera open for follow-up questions
      return result;
    } catch (err: any) {
      console.error('[useVisionCommands] Camera analysis failed:', err);
      const errorMsg = `Vision analysis failed: ${err.message || 'Unknown error'}`;
      setCurrentResult(errorMsg);
      setVisionMode('result');
      return errorMsg;
    }
  }, []);

  /**
   * Captures the screen with cursor position, analyzes it, and returns the result.
   */
  const triggerScreenAnalysis = useCallback(async (userPrompt: string): Promise<string> => {
    try {
      // Reset state
      setCurrentResult(null);
      setVisionMode('screen');

      // Capture screen with cursor position
      const capture = await captureScreenWithCursor();

      setScreenThumbnail(capture.base64);
      setCursorPosition({ x: capture.cursorX, y: capture.cursorY });
      setScreenDimensions({ width: capture.width, height: capture.height });

      // Analyze with cursor annotation
      const result = await analyzeScreenWithCursor(
        capture.base64,
        capture.cursorX,
        capture.cursorY,
        capture.width,
        capture.height,
        userPrompt
      );

      setCurrentResult(result);
      setVisionMode('result');
      return result;
    } catch (err: any) {
      console.error('[useVisionCommands] Screen analysis failed:', err);
      const errorMsg = `Screen analysis failed: ${err.message || 'Unknown error'}`;
      setCurrentResult(errorMsg);
      setVisionMode('result');
      return errorMsg;
    }
  }, []);

  /**
   * Closes the camera, clears vision state.
   */
  const closeVision = useCallback(() => {
    if (cameraRef.current) {
      cameraRef.current.close();
      cameraRef.current = null;
    }
    videoRef.current = null;
    setVisionMode('idle');
    setCurrentResult(null);
    setScreenThumbnail(null);
    setCursorPosition(null);
    setScreenDimensions(null);
  }, []);

  const isVisionActive = visionMode !== 'idle';

  return {
    isVisionActive,
    visionMode,
    currentResult,
    videoRef,
    screenThumbnail,
    cursorPosition,
    screenDimensions,
    triggerCameraAnalysis,
    triggerScreenAnalysis,
    closeVision,
  };
}
