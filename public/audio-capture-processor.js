/**
 * AudioWorklet processor for capturing microphone PCM16 audio.
 * Runs off the main thread for ~50-100ms latency reduction vs ScriptProcessorNode.
 *
 * Includes built-in Voice Activity Detection (VAD):
 * - Only forwards audio frames that contain actual speech
 * - Skips silence to save bandwidth and reduce API processing
 *
 * ✅ Fast base64 encoding via char array — no string concatenation in hot path
 */

// Pre-computed base64 lookup for the worklet scope
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();

    // VAD configuration (can be overridden via processorOptions)
    const opts = options?.processorOptions || {};
    this.vadEnabled = opts.vadEnabled !== false; // default: true
    this.speechThreshold = opts.speechThreshold || 0.015; // RMS threshold for speech
    this.silenceThreshold = opts.silenceThreshold || 0.008; // RMS threshold for silence
    this.speechHoldFrames = opts.speechHoldFrames || 15; // frames to hold after speech stops (~200ms at 128 samples/frame)
    this.prefixFrames = opts.prefixFrames || 4; // frames to include before speech starts

    // VAD state
    this.isSpeaking = false;
    this.silenceCounter = 0;
    this.prefixBuffer = []; // circular buffer of recent frames for prefix

    // Accumulator for chunking (collect ~2048 samples before sending)
    this.chunkSize = opts.chunkSize || 2048;
    this.buffer = new Float32Array(this.chunkSize);
    this.bufferOffset = 0;
  }

  /**
   * Calculate RMS (Root Mean Square) energy of audio frame.
   */
  getRMS(samples) {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    return Math.sqrt(sum / samples.length);
  }

  /**
   * Convert Float32 samples to PCM16 Int16Array, then to base64.
   * Uses fast char-array base64 encoding — no string concatenation.
   */
  floatToPcm16Base64(float32) {
    const pcm16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    const bytes = new Uint8Array(pcm16.buffer);
    return this.base64Encode(bytes);
  }

  /**
   * Fast base64 encode using pre-allocated char array.
   * Avoids string concatenation entirely for maximum worklet performance.
   */
  base64Encode(bytes) {
    const len = bytes.length;
    const outLen = Math.ceil(len / 3) * 4;
    const result = new Array(outLen);
    let idx = 0;

    for (let i = 0; i < len; i += 3) {
      const a = bytes[i];
      const b = (i + 1 < len) ? bytes[i + 1] : 0;
      const c = (i + 2 < len) ? bytes[i + 2] : 0;
      const triplet = (a << 16) | (b << 8) | c;

      result[idx++] = B64[(triplet >> 18) & 0x3F];
      result[idx++] = B64[(triplet >> 12) & 0x3F];
      result[idx++] = (i + 1 < len) ? B64[(triplet >> 6) & 0x3F] : '=';
      result[idx++] = (i + 2 < len) ? B64[triplet & 0x3F] : '=';
    }

    return result.join('');
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) return true;

    const samples = input[0]; // mono channel

    if (this.vadEnabled) {
      const rms = this.getRMS(samples);

      if (!this.isSpeaking) {
        // Store in prefix buffer (circular)
        this.prefixBuffer.push(new Float32Array(samples));
        if (this.prefixBuffer.length > this.prefixFrames) {
          this.prefixBuffer.shift();
        }

        if (rms > this.speechThreshold) {
          // Speech detected — flush prefix buffer first
          this.isSpeaking = true;
          this.silenceCounter = 0;

          // Send prefix frames
          for (const frame of this.prefixBuffer) {
            this.accumulateAndSend(frame);
          }
          this.prefixBuffer = [];

          // Send current frame
          this.accumulateAndSend(samples);
        }
        // If below threshold, skip this frame (silence)
      } else {
        // Currently speaking
        this.accumulateAndSend(samples);

        if (rms < this.silenceThreshold) {
          this.silenceCounter++;
          if (this.silenceCounter >= this.speechHoldFrames) {
            this.isSpeaking = false;
            this.silenceCounter = 0;
            // Flush any remaining buffered audio
            this.flushBuffer();
          }
        } else {
          this.silenceCounter = 0;
        }
      }
    } else {
      // VAD disabled — send everything
      this.accumulateAndSend(samples);
    }

    return true; // keep processor alive
  }

  accumulateAndSend(samples) {
    for (let i = 0; i < samples.length; i++) {
      this.buffer[this.bufferOffset++] = samples[i];

      if (this.bufferOffset >= this.chunkSize) {
        this.sendChunk(this.buffer);
        this.buffer = new Float32Array(this.chunkSize);
        this.bufferOffset = 0;
      }
    }
  }

  flushBuffer() {
    if (this.bufferOffset > 0) {
      const partial = this.buffer.slice(0, this.bufferOffset);
      this.sendChunk(partial);
      this.buffer = new Float32Array(this.chunkSize);
      this.bufferOffset = 0;
    }
  }

  sendChunk(float32) {
    const base64 = this.floatToPcm16Base64(float32);
    this.port.postMessage({ type: 'audio', data: base64 });
  }
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor);
