/**
 * MusicWidget — Embedded YouTube audio/video player widget.
 * Plays music inside Friday without opening Chrome.
 */
import React, { useState, useEffect } from 'react';
import { Music, Loader2 } from 'lucide-react';

interface MusicWidgetProps {
  query: string;
  accentColor?: string;
}

export default function MusicWidget({ query, accentColor = '#00f2ff' }: MusicWidgetProps) {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (window.electronAPI?.searchYoutubeEmbed) {
          const res = await window.electronAPI.searchYoutubeEmbed(query);
          if (!cancelled && res.success) {
            setEmbedUrl(res.embedUrl);
          } else if (!cancelled) {
            setError(res.error || 'No results found');
          }
        } else {
          // Fallback: construct search embed (limited but works)
          setEmbedUrl(`https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(query)}&autoplay=1`);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [query]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 160, gap: 12 }}>
        <Loader2 style={{ width: 28, height: 28, color: accentColor, animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: "'JetBrains Mono', monospace" }}>
          Searching "{query}"...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 120, gap: 8 }}>
        <Music style={{ width: 24, height: 24, color: 'rgba(255,255,255,0.2)' }} />
        <span style={{ fontSize: 11, color: 'rgba(255,60,60,0.6)' }}>{error}</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Track info bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '6px 8px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 8,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: `linear-gradient(135deg, ${accentColor}30, ${accentColor}10)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Music style={{ width: 16, height: 16, color: accentColor }} />
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {query}
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
            YouTube • Now Playing
          </div>
        </div>
      </div>

      {/* Embedded YouTube player */}
      {embedUrl && (
        <div style={{
          borderRadius: 10,
          overflow: 'hidden',
          background: '#000',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <iframe
            src={embedUrl}
            width="100%"
            height="180"
            style={{ border: 'none', display: 'block' }}
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        </div>
      )}
    </div>
  );
}
