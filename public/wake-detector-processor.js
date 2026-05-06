/**
 * WakeDetectorProcessor — AudioWorklet for off-main-thread double-clap detection.
 *
 * Runs the peak-detection math entirely in the audio thread.
 * Only posts a 'wake' message to the main thread when a confirmed double-clap
 * is detected. This replaces the setInterval(…, 30) polling on the main thread,
 * allowing the browser tab to fully idle while Friday is sleeping.
 *
 * Algorithm:
 *   1. Compute peak absolute amplitude of each 128-sample frame.
 *   2. If peak > CLAP_THRESHOLD and cooldown has elapsed → register a clap event.
 *   3. If two claps land within CLAP_WINDOW_MS → post { type: 'wake' }.
 */

const CLAP_THRESHOLD = 0.55;       // normalised 0-1 (maps to 180/256 raw)
const CLAP_WINDOW_FRAMES  = 1500;  // ~1500ms at 16kHz / 128 samples ≈ 1500 frames
const COOLDOWN_FRAMES     = 20;    // ~160ms cooldown between consecutive claps

class WakeDetectorProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this._clapCount       = 0;
    this._firstClapFrame  = 0;
    this._lastClapFrame   = -COOLDOWN_FRAMES; // allow first clap immediately
    this._frameIndex      = 0;

    // Main thread can disable/enable detection via port messages
    this._active = true;
    this.port.onmessage = (e) => {
      if (e.data?.type === 'setActive') {
        this._active = e.data.value;
        if (!this._active) {
          // Reset state when deactivated
          this._clapCount = 0;
        }
      }
    };
  }

  process(inputs) {
    if (!this._active) return true;

    const input = inputs[0];
    if (!input || !input[0]) return true;

    const samples = input[0];
    this._frameIndex++;

    // Compute peak amplitude for this frame
    let peak = 0;
    for (let i = 0; i < samples.length; i++) {
      const abs = Math.abs(samples[i]);
      if (abs > peak) peak = abs;
    }

    const frame = this._frameIndex;
    const cooldownOk = (frame - this._lastClapFrame) >= COOLDOWN_FRAMES;

    if (peak > CLAP_THRESHOLD && cooldownOk) {
      this._lastClapFrame = frame;

      if (this._clapCount === 0) {
        // First clap
        this._clapCount = 1;
        this._firstClapFrame = frame;
      } else if ((frame - this._firstClapFrame) <= CLAP_WINDOW_FRAMES) {
        // Second clap within window — confirmed double-clap!
        this._clapCount = 0;
        this.port.postMessage({ type: 'wake' });
      } else {
        // Second clap came too late — treat as a new first clap
        this._clapCount = 1;
        this._firstClapFrame = frame;
      }
    }

    // Reset clap count if window expired without second clap
    if (this._clapCount === 1 && (frame - this._firstClapFrame) > CLAP_WINDOW_FRAMES) {
      this._clapCount = 0;
    }

    return true; // keep processor alive
  }
}

registerProcessor('wake-detector-processor', WakeDetectorProcessor);
