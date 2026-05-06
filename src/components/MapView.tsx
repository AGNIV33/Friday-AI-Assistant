import React, { useRef, useEffect, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Fix Mapbox worker loading in Vite
// @ts-ignore
import MapboxWorker from 'mapbox-gl/dist/mapbox-gl-csp-worker?worker';
(mapboxgl as any).workerClass = MapboxWorker;

// Free Mapbox public token for demo — user can replace in settings
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

export interface MapTelemetry {
  target: string;
  coordinates: [number, number]; // [lng, lat]
  zoom_level: number;
  pitch: number;
  bearing: number;
}

export interface MapCommand {
  action: 'RENDER_MAP';
  speech_confirmation: string;
  telemetry: MapTelemetry;
  render_settings: {
    animation_mode: 'globe_glide' | 'smooth_pan';
    theme: 'tactical_blue_hologram';
  };
}

interface MapViewProps {
  command: MapCommand | null;
  onClose: () => void;
  accentColor: string;
  accentRgb: string;
}

export default function MapView({ command, onClose, accentColor, accentRgb }: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentTarget, setCurrentTarget] = useState('');

  // Initialize map on first render
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    console.log('[Friday] Initializing Mapbox GL...', mapContainerRef.current);
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [0, 20],
      zoom: 1.5,
      pitch: 0,
      bearing: 0,
      projection: 'globe',
      antialias: true,
      fadeDuration: 0,
    });

    map.on('error', (e) => {
      console.error('[Friday] Mapbox Error:', e);
    });

    map.on('load', () => {
      console.log('[Friday] Mapbox style loaded successfully.');
      setIsLoaded(true);

      // Force a resize to ensure canvas paints fully
      setTimeout(() => map.resize(), 100);

      // Apply vibrant, colorful atmospheric fog
      map.setFog({
        color: 'rgb(186, 210, 235)', // Lower atmosphere
        'high-color': 'rgb(36, 92, 223)', // Upper atmosphere
        'horizon-blend': 0.02, // Atmosphere thickness
        'space-color': 'rgb(11, 11, 25)', // Deep space color
        'star-intensity': 0.8, // Brighter stars
      });
    });

    // Add navigation controls
    map.addControl(new mapboxgl.NavigationControl({
      visualizePitch: true,
    }), 'top-right');

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Fly to target when command changes
  useEffect(() => {
    if (!command || !mapRef.current || !isLoaded) return;

    const map = mapRef.current;
    const { telemetry, render_settings } = command;
    const [lng, lat] = telemetry.coordinates;

    setCurrentTarget(telemetry.target);

    if (render_settings.animation_mode === 'globe_glide') {
      // Globe glide: zoom out to planetary altitude, then dive in
      map.flyTo({
        center: [lng, lat],
        zoom: telemetry.zoom_level,
        pitch: telemetry.pitch,
        bearing: telemetry.bearing,
        duration: 4000,
        essential: true,
        curve: 1.8,
        speed: 0.5,
      });
    } else {
      // Smooth pan for nearby locations
      map.easeTo({
        center: [lng, lat],
        zoom: telemetry.zoom_level,
        pitch: telemetry.pitch,
        bearing: telemetry.bearing,
        duration: 2500,
        essential: true,
      });
    }

    // Add a pulsing marker at target
    const markerEl = document.createElement('div');
    markerEl.className = 'friday-map-marker';
    markerEl.innerHTML = `
      <div class="marker-pulse"></div>
      <div class="marker-dot"></div>
    `;

    // Remove previous markers
    document.querySelectorAll('.friday-map-marker').forEach(el => {
      el.closest('.mapboxgl-marker')?.remove();
    });

    new mapboxgl.Marker({ element: markerEl })
      .setLngLat([lng, lat])
      .addTo(map);

  }, [command, isLoaded]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!command) return null;

  return (
    <div className="fixed inset-0 z-40 bg-[#0b0b19]" style={{ animation: 'mapFadeIn 0.6s ease-out forwards' }}>
      {/* Holographic scanline overlay (slightly more transparent for the vibrant map) */}
      <div className="absolute inset-0 z-10 pointer-events-none friday-map-scanlines opacity-50" />

      {/* Map container */}
      <div
        ref={mapContainerRef}
        className="absolute inset-0"
        style={{ width: '100vw', height: '100vh' }}
      />

      {/* Top HUD bar */}
      <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
        <div className="flex items-center justify-between px-6 py-4">
          {/* Target info */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ background: accentColor, boxShadow: `0 0 8px ${accentColor}` }}
              />
              <span
                className="text-[10px] font-mono uppercase tracking-[0.3em]"
                style={{ color: `rgba(${accentRgb}, 0.6)` }}
              >
                Geospatial Intelligence
              </span>
            </div>
            <span
              className="text-lg font-light tracking-wider uppercase font-mono"
              style={{ color: accentColor, textShadow: `0 0 20px rgba(${accentRgb}, 0.4)` }}
            >
              {currentTarget || 'Initializing...'}
            </span>
          </div>

          {/* Telemetry readout */}
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: `rgba(${accentRgb}, 0.4)` }}>
                Coordinates
              </span>
              <span className="text-[11px] font-mono" style={{ color: `rgba(${accentRgb}, 0.7)` }}>
                {command.telemetry.coordinates[1].toFixed(4)}°N, {command.telemetry.coordinates[0].toFixed(4)}°E
              </span>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: `rgba(${accentRgb}, 0.4)` }}>
                Zoom
              </span>
              <span className="text-[11px] font-mono" style={{ color: `rgba(${accentRgb}, 0.7)` }}>
                {command.telemetry.zoom_level.toFixed(1)}x
              </span>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: `rgba(${accentRgb}, 0.4)` }}>
                Pitch / Bearing
              </span>
              <span className="text-[11px] font-mono" style={{ color: `rgba(${accentRgb}, 0.7)` }}>
                {command.telemetry.pitch}° / {command.telemetry.bearing}°
              </span>
            </div>
          </div>
        </div>

        {/* Holographic border line */}
        <div
          className="h-px w-full"
          style={{
            background: `linear-gradient(90deg, transparent 0%, rgba(${accentRgb}, 0.4) 20%, rgba(${accentRgb}, 0.6) 50%, rgba(${accentRgb}, 0.4) 80%, transparent 100%)`,
          }}
        />
      </div>

      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute top-5 right-6 z-30 flex items-center gap-2 px-4 py-2 rounded-full border pointer-events-auto cursor-pointer hover:scale-105 active:scale-95 transition-transform"
        style={{
          borderColor: `rgba(${accentRgb}, 0.3)`,
          background: `rgba(0, 0, 0, 0.6)`,
          backdropFilter: 'blur(12px)',
          color: `rgba(${accentRgb}, 0.8)`,
        }}
      >
        <span className="text-[10px] font-mono uppercase tracking-widest">Close Map</span>
        <span className="text-xs">✕</span>
      </button>

      {/* Bottom HUD */}
      <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none">
        <div
          className="h-px w-full"
          style={{
            background: `linear-gradient(90deg, transparent 0%, rgba(${accentRgb}, 0.3) 30%, rgba(${accentRgb}, 0.3) 70%, transparent 100%)`,
          }}
        />
        <div className="flex items-center justify-between px-6 py-3">
          <span className="text-[9px] font-mono uppercase tracking-[0.2em]" style={{ color: `rgba(${accentRgb}, 0.3)` }}>
            Friday Geospatial v1.0
          </span>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: `rgba(${accentRgb}, 0.5)` }} />
            <span className="text-[9px] font-mono uppercase tracking-[0.2em]" style={{ color: `rgba(${accentRgb}, 0.3)` }}>
              {command.render_settings.theme.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
      </div>

      {/* Corner brackets (holographic frame) */}
      <svg className="absolute top-3 left-3 z-20 pointer-events-none" width="40" height="40">
        <path d="M0 20 L0 2 Q0 0 2 0 L20 0" stroke={`rgba(${accentRgb}, 0.4)`} strokeWidth="1" fill="none" />
      </svg>
      <svg className="absolute top-3 right-3 z-20 pointer-events-none" width="40" height="40">
        <path d="M20 0 L38 0 Q40 0 40 2 L40 20" stroke={`rgba(${accentRgb}, 0.4)`} strokeWidth="1" fill="none" />
      </svg>
      <svg className="absolute bottom-3 left-3 z-20 pointer-events-none" width="40" height="40">
        <path d="M0 20 L0 38 Q0 40 2 40 L20 40" stroke={`rgba(${accentRgb}, 0.4)`} strokeWidth="1" fill="none" />
      </svg>
      <svg className="absolute bottom-3 right-3 z-20 pointer-events-none" width="40" height="40">
        <path d="M20 40 L38 40 Q40 40 40 38 L40 20" stroke={`rgba(${accentRgb}, 0.4)`} strokeWidth="1" fill="none" />
      </svg>
    </div>
  );
}
