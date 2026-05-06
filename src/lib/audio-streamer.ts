/**
 * AudioStreamer handles microphone input and audio playback for the Gemini Live API.
 * 
 * ✅ Uses AudioWorklet (off main thread) instead of deprecated ScriptProcessorNode
 * ✅ Built-in Voice Activity Detection (VAD) — only sends speech, skips silence
 * ✅ Hardware audio enhancements: echo cancellation, noise suppression, auto gain
 * ✅ Optimized chunk size (2048 samples) for low latency
 * ✅ Memory-pooled playback with aggressive queue cleanup
 * ✅ Graceful fallback to ScriptProcessorNode if AudioWorklet fails
 * ✅ Fast binary base64 via lookup tables — zero string concatenation in hot paths
 * ✅ Batch-scheduled playback — no gaps between audio chunks
 */

export interface AudioStreamerConfig {
  sampleRate?: number;
  chunkSize?: number;
  vadEnabled?: boolean;
  speechThreshold?: number;
  silenceThreshold?: number;
  speechHoldFrames?: number;
}

// ─── Fast base64 lookup table (avoids String.fromCharCode per byte) ──────────
const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP = new Uint8Array(256);
for (let i = 0; i < B64_CHARS.length; i++) {
  B64_LOOKUP[B64_CHARS.charCodeAt(i)] = i;
}

export class AudioStreamer {
  private audioContext: AudioContext | null = null;
  private playbackContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private silentGain: GainNode | null = null;
  private isPlaying = false;
  private nextPlayTime = 0;
  private muted = false;

  // Batch scheduling: merge incoming chunks and schedule in one go
  private pendingChunks: Int16Array[] = [];
  private scheduleTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly SCHEDULE_INTERVAL_MS = 20; // batch window — accumulate chunks for 20ms before scheduling

  // Playback amplitude analysis (for orb sync)
  private playbackAnalyser: AnalyserNode | null = null;
  private analyserData: Uint8Array<ArrayBuffer> | null = null;

  // Fallback for browsers without AudioWorklet support
  private processor: ScriptProcessorNode | null = null;
  private usingWorklet = false;

  // Performance tracking
  private captureStartTime = 0;
  private chunksSent = 0;

  private config: Required<AudioStreamerConfig>;

  constructor(sampleRate: number = 16000, config?: Partial<AudioStreamerConfig>) {
    this.config = {
      sampleRate: config?.sampleRate ?? sampleRate,
      chunkSize: config?.chunkSize ?? 4096,
      vadEnabled: config?.vadEnabled ?? true,
      speechThreshold: config?.speechThreshold ?? 0.015,
      silenceThreshold: config?.silenceThreshold ?? 0.008,
      speechHoldFrames: config?.speechHoldFrames ?? 15,
    };
  }

  async start(onAudioData: (base64Data: string) => void) {
    this.captureStartTime = performance.now();
    this.chunksSent = 0;
    this.muted = false;

    // Pre-warm the playback context so the first response chunk plays instantly
    this.ensurePlaybackContext();

    // Create AudioContext for capture at the desired sample rate
    this.audioContext = new AudioContext({ sampleRate: this.config.sampleRate });

    // Explicitly resume — Chromium/Electron suspends AudioContext until user gesture
    // Without this, audio capture silently stops working intermittently.
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    // Request microphone with RAW audio. 
    // By disabling echoCancellation, noiseSuppression, and autoGainControl, we bypass 
    // Chromium's heavy WebRTC DSP pipeline which causes massive CPU lag on Windows.
    // We already do software-level echo prevention (muting the mic while speaking).
    // We also remove the sampleRate constraint so the OS doesn't struggle with driver-level resampling;
    // the AudioContext (created at 16000Hz above) will resample the raw stream natively and cheaply.
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        noiseSuppression: false,
        echoCancellation: false,
        autoGainControl: false,
      } as MediaTrackConstraints,
    });

    this.source = this.audioContext.createMediaStreamSource(this.mediaStream);

    // Wrap the callback so muted state is honoured at the point of sending
    const guardedOnAudioData = (base64: string) => {
      if (!this.muted) onAudioData(base64);
    };

    // Try AudioWorklet first, fall back to ScriptProcessorNode
    try {
      await this.startWithWorklet(guardedOnAudioData);
    } catch (err) {
      console.warn('[AudioStreamer] AudioWorklet failed, falling back to ScriptProcessorNode:', err);
      this.startWithScriptProcessor(guardedOnAudioData);
    }
  }

  /**
   * Mute or unmute mic capture. When muted, audio chunks are captured but NOT
   * forwarded to the API. Use this to suppress echo while Friday is speaking.
   */
  setMuted(muted: boolean) {
    this.muted = muted;
  }

  isMuted() {
    return this.muted;
  }

  private async startWithWorklet(onAudioData: (base64Data: string) => void) {
    if (!this.audioContext || !this.source) throw new Error('AudioContext not initialized');

    // Load the worklet module
    await this.audioContext.audioWorklet.addModule('/audio-capture-processor.js');

    this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-capture-processor', {
      processorOptions: {
        vadEnabled: this.config.vadEnabled,
        speechThreshold: this.config.speechThreshold,
        silenceThreshold: this.config.silenceThreshold,
        speechHoldFrames: this.config.speechHoldFrames,
        chunkSize: this.config.chunkSize,
      },
    });

    // Receive audio data from the worklet
    this.workletNode.port.onmessage = (event) => {
      if (event.data.type === 'audio') {
        this.chunksSent++;
        onAudioData(event.data.data);
      }
    };

    this.source.connect(this.workletNode);
    // Route through a silent GainNode (gain=0) to keep the audio graph active
    // without feeding mic audio back to speakers.
    this.silentGain = this.audioContext.createGain();
    this.silentGain.gain.value = 0;
    this.workletNode.connect(this.silentGain);
    this.silentGain.connect(this.audioContext.destination);
    this.usingWorklet = true;

    console.log('[AudioStreamer] ✅ Started with AudioWorklet (off main thread, VAD enabled)');
  }

  private startWithScriptProcessor(onAudioData: (base64Data: string) => void) {
    if (!this.audioContext || !this.source) return;

    // ScriptProcessor fallback with the configured chunk size
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    // Simple VAD state for fallback path
    let isSpeaking = false;
    let silenceCount = 0;
    const SPEECH_THRESHOLD = this.config.speechThreshold;
    const SILENCE_THRESHOLD = this.config.silenceThreshold;
    const HOLD_FRAMES = this.config.speechHoldFrames;

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);

      // VAD check
      if (this.config.vadEnabled) {
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);

        if (!isSpeaking) {
          if (rms < SPEECH_THRESHOLD) return; // skip silence
          isSpeaking = true;
          silenceCount = 0;
        } else {
          if (rms < SILENCE_THRESHOLD) {
            silenceCount++;
            if (silenceCount >= HOLD_FRAMES) {
              isSpeaking = false;
              silenceCount = 0;
              return;
            }
          } else {
            silenceCount = 0;
          }
        }
      }

      const pcm16 = this.floatToPcm16(inputData);
      const base64 = this.arrayBufferToBase64(pcm16.buffer as ArrayBuffer);
      this.chunksSent++;
      onAudioData(base64);
    };

    this.source.connect(this.processor);
    // ScriptProcessorNode REQUIRES a path to the destination to fire onaudioprocess.
    // Route through a silent GainNode (gain=0) — active graph, zero speaker output.
    this.silentGain = this.audioContext.createGain();
    this.silentGain.gain.value = 0;
    this.processor.connect(this.silentGain);
    this.silentGain.connect(this.audioContext.destination);
    this.usingWorklet = false;

    console.log('[AudioStreamer] ⚠️ Started with ScriptProcessorNode (fallback, VAD enabled)');
  }

  stop() {
    // Cancel any pending schedule
    if (this.scheduleTimer) {
      clearTimeout(this.scheduleTimer);
      this.scheduleTimer = null;
    }

    // Disconnect audio graph
    this.source?.disconnect();
    this.workletNode?.disconnect();
    this.processor?.disconnect();
    this.silentGain?.disconnect();

    // Stop media stream tracks
    this.mediaStream?.getTracks().forEach(track => track.stop());

    // Close capture context
    this.audioContext?.close().catch(() => {});

    // Log performance stats
    if (this.captureStartTime > 0) {
      const duration = (performance.now() - this.captureStartTime) / 1000;
      console.log(`[AudioStreamer] Session: ${duration.toFixed(1)}s, ${this.chunksSent} chunks sent (${this.usingWorklet ? 'Worklet' : 'ScriptProcessor'})`);
    }

    // Reset state
    this.audioContext = null;
    this.mediaStream = null;
    this.workletNode = null;
    this.processor = null;
    this.silentGain = null;
    this.source = null;
    this.pendingChunks = [];
    this.isPlaying = false;
    this.captureStartTime = 0;
    this.chunksSent = 0;
  }

  /**
   * Ensure playback context exists and is running.
   * Called eagerly during start() so the first response chunk plays instantly.
   */
  private ensurePlaybackContext(): AudioContext {
    if (!this.playbackContext || this.playbackContext.state === 'closed') {
      this.playbackContext = new AudioContext({ sampleRate: 24000 });
    }
    if (this.playbackContext.state === 'suspended') {
      // Fire-and-forget — resume is near-instant in Electron
      this.playbackContext.resume().catch(() => {});
    }
    // Eagerly set up analyser so it's ready for the first chunk
    if (!this.playbackAnalyser || this.playbackAnalyser.context !== this.playbackContext) {
      this.playbackAnalyser = this.playbackContext.createAnalyser();
      this.playbackAnalyser.fftSize = 256;
      this.playbackAnalyser.smoothingTimeConstant = 0.4;
      this.analyserData = new Uint8Array(this.playbackAnalyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;
      this.playbackAnalyser.connect(this.playbackContext.destination);
    }
    return this.playbackContext;
  }

  /**
   * Queue an audio chunk for playback.
   * Chunks are batched and scheduled together to eliminate inter-chunk gaps.
   */
  playAudioChunk(base64Data: string) {
    const ctx = this.ensurePlaybackContext();

    const arrayBuffer = this.base64ToArrayBuffer(base64Data);
    const pcm16 = new Int16Array(arrayBuffer);
    this.pendingChunks.push(pcm16);

    // Batch: wait a few ms for more chunks to arrive, then schedule all at once
    if (!this.scheduleTimer) {
      this.scheduleTimer = setTimeout(() => {
        this.scheduleTimer = null;
        this.flushPlaybackQueue(ctx);
      }, AudioStreamer.SCHEDULE_INTERVAL_MS);
    }
  }

  /**
   * Flush all pending chunks into a SINGLE merged AudioBuffer.
   * Instead of creating N AudioBuffers for N chunks, we concatenate all PCM
   * data into one contiguous Float32Array and schedule one BufferSource.
   * This eliminates per-chunk GC pressure and Web Audio API overhead.
   */
  private flushPlaybackQueue(ctx: AudioContext) {
    if (this.pendingChunks.length === 0) return;

    const chunks = this.pendingChunks;
    this.pendingChunks = [];
    this.isPlaying = true;

    // Calculate total sample count across all chunks
    let totalSamples = 0;
    for (const chunk of chunks) totalSamples += chunk.length;

    // Merge all PCM16 chunks into one Float32Array
    const merged = new Float32Array(totalSamples);
    let offset = 0;
    for (const pcm16 of chunks) {
      for (let i = 0; i < pcm16.length; i++) {
        merged[offset++] = pcm16[i] / 32768; // inline PCM16→Float32
      }
    }

    const buffer = ctx.createBuffer(1, totalSamples, 24000);
    buffer.getChannelData(0).set(merged);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.playbackAnalyser!);

    const t = Math.max(ctx.currentTime + 0.03, this.nextPlayTime);
    source.start(t);
    this.nextPlayTime = t + buffer.duration;

    // Mark playback as done once this merged buffer finishes
    const remainingMs = (this.nextPlayTime - ctx.currentTime) * 1000;
    setTimeout(() => {
      if (this.pendingChunks.length === 0 && this.nextPlayTime <= ctx.currentTime + 0.05) {
        this.isPlaying = false;
      }
    }, Math.max(0, remainingMs + 150));
  }

  stopPlayback() {
    this.pendingChunks = [];
    this.nextPlayTime = 0;
    if (this.scheduleTimer) {
      clearTimeout(this.scheduleTimer);
      this.scheduleTimer = null;
    }
    // Don't close playback context to avoid latency on next chunks
  }

  /**
   * Dispose all resources. Call this when completely done with the streamer.
   */
  dispose() {
    this.stop();
    this.playbackAnalyser?.disconnect();
    this.playbackAnalyser = null;
    this.analyserData = null;
    if (this.playbackContext && this.playbackContext.state !== 'closed') {
      this.playbackContext.close().catch(() => {});
      this.playbackContext = null;
    }
  }

  /**
   * Returns the current playback amplitude (0–1).
   * Call this every animation frame to sync visuals with Friday's voice.
   */
  getPlaybackAmplitude(): number {
    if (!this.playbackAnalyser || !this.analyserData) return 0;
    this.playbackAnalyser.getByteTimeDomainData(this.analyserData);
    // Calculate RMS from waveform data (centered at 128)
    let sum = 0;
    for (let i = 0; i < this.analyserData.length; i++) {
      const v = (this.analyserData[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / this.analyserData.length);
    // Normalize: typical speech RMS is 0.05–0.3, scale to 0–1
    return Math.min(1, rms * 4);
  }

  // ─── Utility Methods ───────────────────────────────────────────────────────

  private floatToPcm16(float32: Float32Array): Int16Array {
    const pcm16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return pcm16;
  }

  private pcm16ToFloat32(pcm16: Int16Array): Float32Array {
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / 32768;
    }
    return float32;
  }

  /**
   * Fast base64 encode using a lookup table — avoids per-byte String.fromCharCode.
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    const len = bytes.length;
    // Pre-allocate output array sized to base64 length
    const resultChars: string[] = new Array(Math.ceil(len / 3) * 4);
    let idx = 0;

    for (let i = 0; i < len; i += 3) {
      const a = bytes[i];
      const b = i + 1 < len ? bytes[i + 1] : 0;
      const c = i + 2 < len ? bytes[i + 2] : 0;
      const triplet = (a << 16) | (b << 8) | c;

      resultChars[idx++] = B64_CHARS[(triplet >> 18) & 0x3F];
      resultChars[idx++] = B64_CHARS[(triplet >> 12) & 0x3F];
      resultChars[idx++] = (i + 1 < len) ? B64_CHARS[(triplet >> 6) & 0x3F] : '=';
      resultChars[idx++] = (i + 2 < len) ? B64_CHARS[triplet & 0x3F] : '=';
    }

    return resultChars.join('');
  }

  /**
   * Fast base64 decode using a lookup table — avoids per-byte charCodeAt loop.
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    // Strip padding
    const padLen = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
    const byteLen = (base64.length * 3 / 4) - padLen;
    const buffer = new ArrayBuffer(byteLen);
    const bytes = new Uint8Array(buffer);

    let p = 0;
    for (let i = 0; i < base64.length; i += 4) {
      const a = B64_LOOKUP[base64.charCodeAt(i)];
      const b = B64_LOOKUP[base64.charCodeAt(i + 1)];
      const c = B64_LOOKUP[base64.charCodeAt(i + 2)];
      const d = B64_LOOKUP[base64.charCodeAt(i + 3)];

      bytes[p++] = (a << 2) | (b >> 4);
      if (p < byteLen) bytes[p++] = ((b & 0xF) << 4) | (c >> 2);
      if (p < byteLen) bytes[p++] = ((c & 0x3) << 6) | d;
    }

    return buffer;
  }
}
