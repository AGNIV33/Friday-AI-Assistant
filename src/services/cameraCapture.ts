// ─── Camera Capture Service ───────────────────────────────────────────────────
// Webcam management for vision analysis.
// Handles getUserMedia lifecycle, frame capture, and cleanup.

export class CameraCapture {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;

  /**
   * Opens the webcam and returns a video element ready for display.
   */
  async open(): Promise<HTMLVideoElement> {
    if (this.stream && this.videoElement) {
      return this.videoElement;
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720 },
      audio: false,
    });

    const video = document.createElement('video');
    video.srcObject = this.stream;
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;

    // Wait for video to be ready
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => {
        video.play().then(() => resolve()).catch(reject);
      };
      video.onerror = () => reject(new Error('Failed to initialize camera'));
    });

    this.videoElement = video;
    return video;
  }

  /**
   * Captures the current frame as a base64 JPEG data URL.
   */
  captureFrame(quality: number = 0.85): string {
    if (!this.videoElement || !this.stream) {
      throw new Error('Camera is not open. Call open() first.');
    }

    const canvas = document.createElement('canvas');
    canvas.width = this.videoElement.videoWidth || 1280;
    canvas.height = this.videoElement.videoHeight || 720;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(this.videoElement, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/jpeg', quality);
  }

  /**
   * Stops the camera and releases all resources.
   */
  close(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }
  }

  /**
   * Returns whether the camera is currently open.
   */
  isOpen(): boolean {
    return this.stream !== null && this.videoElement !== null;
  }
}
