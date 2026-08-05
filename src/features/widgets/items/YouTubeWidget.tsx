/**
 * YouTubeWidget — Compact YouTube video player embedded inside Friday.
 * Similar to picture-in-picture but within the app window.
 */
import React, { useState, useEffect } from 'react';
import { Play, Loader2 } from 'lucide-react';

interface YouTubeWidgetProps {
  query?: string;
  videoId?: string;
  accentColor?: string;
}

export default function YouTubeWidget({ query, videoId: initialVideoId, accentColor = '#00f2ff' }: YouTubeWidgetProps) {
  const [videoId, setVideoId] = useState<string | null>(initialVideoId || null);
  const [loading, setLoading] = useState(!initialVideoId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialVideoId || !query) return;
    let cancelled = false;

    (async () => {
      try {
        if (window.electronAPI?.searchYoutubeEmbed) {
          const res = await window.electronAPI.searchYoutubeEmbed(query);
          if (!cancelled && res.success) {
            setVideoId(res.videoId);
          } else if (!cancelled) {
            setError(res.error || 'Video not found');
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [query, initialVideoId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 180, gap: 12 }}>
        <Loader2 style={{ width: 28, height: 28, color: accentColor, animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: "'JetBrains Mono', monospace" }}>
          Loading video...
        </span>
      </div>
    );
  }

  if (error || !videoId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 120, gap: 8 }}>
        <Play style={{ width: 24, height: 24, color: 'rgba(255,255,255,0.2)' }} />
        <span style={{ fontSize: 11, color: 'rgba(255,60,60,0.6)' }}>{error || 'Video not found'}</span>
      </div>
    );
  }

  return (
    <div style={{
      borderRadius: 10,
      overflow: 'hidden',
      background: '#000',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <iframe
        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
        width="100%"
        height="200"
        style={{ border: 'none', display: 'block' }}
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
