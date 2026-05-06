# Graph Report - .  (2026-05-06)

## Corpus Check
- Corpus is ~36,186 words - fits in a single context window. You may not need a graph.

## Summary
- 143 nodes · 220 edges · 12 communities detected
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Orb Visual Primitives|Orb Visual Primitives]]
- [[_COMMUNITY_Live Session Management|Live Session Management]]
- [[_COMMUNITY_Audio Streaming Utils|Audio Streaming Utils]]
- [[_COMMUNITY_Friday Orb Component|Friday Orb Component]]
- [[_COMMUNITY_Audio Capture Worklet|Audio Capture Worklet]]
- [[_COMMUNITY_Performance Tracking|Performance Tracking]]
- [[_COMMUNITY_Core Application Structure|Core Application Structure]]
- [[_COMMUNITY_App Browser Logic|App Browser Logic]]
- [[_COMMUNITY_Wake Word Detection|Wake Word Detection]]
- [[_COMMUNITY_Settings State Hook|Settings State Hook]]
- [[_COMMUNITY_Application Entry point|Application Entry point]]
- [[_COMMUNITY_Friday AI Concepts|Friday AI Concepts]]

## God Nodes (most connected - your core abstractions)
1. `rgba()` - 22 edges
2. `drawGlow()` - 22 edges
3. `stateColor()` - 21 edges
4. `AudioStreamer` - 19 edges
5. `AudioCaptureProcessor` - 9 edges
6. `PerformanceTracker` - 8 edges
7. `LiveSession` - 8 edges
8. `renderOrbStyle()` - 6 edges
9. `useFriday Hook` - 6 edges
10. `polygon()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `renderOrbStyle()` --calls--> `renderStaticOrb()`  [INFERRED]
  src\components\orbRenderers.ts → src\components\staticOrbRenderers.ts
- `AudioCaptureProcessor Worklet` --references--> `AudioStreamer Class`  [EXTRACTED]
  public/audio-capture-processor.js → src/lib/audio-streamer.ts
- `MapView Component` --references--> `useFriday Hook`  [INFERRED]
  src/components/MapView.tsx → src/lib/useFriday.ts
- `useFriday Hook` --rationale_for--> `LiveSession class`  [INFERRED]
  src/lib/useFriday.ts → src/lib/live-session.ts
- `Memory Service` --calls--> `useFriday Hook`  [EXTRACTED]
  src/lib/firebase.ts → src/lib/useFriday.ts

## Hyperedges (group relationships)
- **Core Voice-to-Voice Loop** — audiostreamer_ts_audiostreamer, livesession_ts_livesession, fridayorb_tsx_fridayorb [INFERRED 0.95]
- **Long-term Memory & Persona** — firebase_ts_memoryservice, usesettings_ts_usesettings, livesession_ts_livesession [INFERRED 0.85]
- **Desktop Intelligence & Automation** — usefriday_ts_usefriday, livesession_ts_livesession, mapview_tsx_mapview [INFERRED 0.75]

## Communities

### Community 0 - "Orb Visual Primitives"
Cohesion: 0.26
Nodes (24): drawAtom(), drawCrescent(), drawCrosshair(), drawDiamond(), drawDotGrid(), drawDoubleRing(), drawEye(), drawGlow() (+16 more)

### Community 1 - "Live Session Management"
Cohesion: 0.11
Nodes (4): LiveSession, useFriday(), useSettings(), useToast()

### Community 2 - "Audio Streaming Utils"
Cohesion: 0.15
Nodes (1): AudioStreamer

### Community 3 - "Friday Orb Component"
Cohesion: 0.23
Nodes (10): drawParticleCloud(), drawPulseRings(), drawWaveform(), ensureCloudPts(), lerp(), lerpC(), posCol(), renderOrbStyle() (+2 more)

### Community 4 - "Audio Capture Worklet"
Cohesion: 0.36
Nodes (1): AudioCaptureProcessor

### Community 5 - "Performance Tracking"
Cohesion: 0.31
Nodes (1): PerformanceTracker

### Community 6 - "Core Application Structure"
Cohesion: 0.25
Nodes (9): App Main Component, AudioCaptureProcessor Worklet, AudioStreamer Class, Memory Service, FridayOrb Visualizer, LiveSession class, MapView Component, Performance Tracker (+1 more)

### Community 7 - "App Browser Logic"
Cohesion: 0.47
Nodes (3): handleAddApp(), handleRemoveCustomApp(), saveCustomApps()

### Community 9 - "Wake Word Detection"
Cohesion: 0.5
Nodes (1): WakeDetectorProcessor

### Community 16 - "Settings State Hook"
Cohesion: 1.0
Nodes (1): useSettings Hook

### Community 17 - "Application Entry point"
Cohesion: 1.0
Nodes (1): React Root Entry

### Community 18 - "Friday AI Concepts"
Cohesion: 1.0
Nodes (1): Friday AI Concept

## Knowledge Gaps
- **8 isolated node(s):** `AudioCaptureProcessor Worklet`, `Memory Service`, `useSettings Hook`, `MapView Component`, `React Root Entry` (+3 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Audio Streaming Utils`** (19 nodes): `AudioStreamer`, `.arrayBufferToBase64()`, `.base64ToArrayBuffer()`, `.constructor()`, `.dispose()`, `.ensurePlaybackContext()`, `.floatToPcm16()`, `.flushPlaybackQueue()`, `.getPlaybackAmplitude()`, `.isMuted()`, `.pcm16ToFloat32()`, `.playAudioChunk()`, `.setMuted()`, `.start()`, `.startWithScriptProcessor()`, `.startWithWorklet()`, `.stop()`, `.stopPlayback()`, `audio-streamer.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Audio Capture Worklet`** (10 nodes): `AudioCaptureProcessor`, `.accumulateAndSend()`, `.base64Encode()`, `.constructor()`, `.floatToPcm16Base64()`, `.flushBuffer()`, `.getRMS()`, `.process()`, `.sendChunk()`, `audio-capture-processor.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Performance Tracking`** (9 nodes): `PerformanceTracker`, `.clear()`, `.end()`, `.getAverage()`, `.getSummary()`, `.measure()`, `.printSummary()`, `.start()`, `perf.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Wake Word Detection`** (4 nodes): `wake-detector-processor.js`, `WakeDetectorProcessor`, `.constructor()`, `.process()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Settings State Hook`** (1 nodes): `useSettings Hook`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Application Entry point`** (1 nodes): `React Root Entry`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Friday AI Concepts`** (1 nodes): `Friday AI Concept`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AudioStreamer` connect `Audio Streaming Utils` to `Live Session Management`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Why does `renderStaticOrb()` connect `Friday Orb Component` to `Orb Visual Primitives`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **What connects `AudioCaptureProcessor Worklet`, `Memory Service`, `useSettings Hook` to the rest of the system?**
  _8 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Live Session Management` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._