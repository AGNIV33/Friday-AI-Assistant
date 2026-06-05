/**
 * WidgetManager — Container that renders all active Friday widgets.
 * 
 * Each widget is wrapped in a WidgetShell (draggable, closeable).
 * Widget types: music, news, image, youtube, newsvisualizer, custom
 */
import React from 'react';
import WidgetShell from './widgets/WidgetShell';
import MusicWidget from './widgets/MusicWidget';
import NewsWidget from './widgets/NewsWidget';
import ImageWidget from './widgets/ImageWidget';
import YouTubeWidget from './widgets/YouTubeWidget';
import NewsVisualizer from './widgets/NewsVisualizer';

export interface WidgetData {
  id: string;
  type: 'music' | 'news' | 'image' | 'youtube' | 'newsvisualizer' | 'custom';
  title: string;
  data: Record<string, any>;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

interface WidgetManagerProps {
  widgets: WidgetData[];
  onCloseWidget: (id: string) => void;
  accentColor?: string;
}

const DEFAULT_SIZES: Record<string, { width: number; height: number }> = {
  music:          { width: 340, height: 300 },
  news:           { width: 360, height: 440 },
  image:          { width: 380, height: 340 },
  youtube:        { width: 420, height: 300 },
  newsvisualizer: { width: 960, height: 600 },
  custom:         { width: 340, height: 260 },
};

export default function WidgetManager({ widgets, onCloseWidget, accentColor = '#00f2ff' }: WidgetManagerProps) {
  const [fullscreenWidgets, setFullscreenWidgets] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    const handleControl = (e: any) => {
      const action = e.detail?.action;
      if (action === 'fullscreen' || action === 'windowed') {
        const nvWidget = widgets.find(w => w.type === 'newsvisualizer');
        if (nvWidget) {
          setFullscreenWidgets(prev => ({
            ...prev,
            [nvWidget.id]: action === 'fullscreen'
          }));
        }
      }
    };
    window.addEventListener('friday-news-control', handleControl);
    return () => window.removeEventListener('friday-news-control', handleControl);
  }, [widgets]);

  if (widgets.length === 0) return null;

  return (
    <>
      {widgets.map((w, i) => {
        const size = w.size || DEFAULT_SIZES[w.type] || DEFAULT_SIZES.custom;
        // Stagger widget positions so they don't stack directly on top of each other
        const defaultX = 60 + (i % 4) * 50;
        const defaultY = 80 + (i % 4) * 40;
        const pos = w.position || { x: defaultX, y: defaultY };

        return (
          <React.Fragment key={w.id}>
            <WidgetShell
              id={w.id}
              title={w.title}
              width={size.width}
              height={size.height}
              initialX={pos.x}
              initialY={pos.y}
              isFullScreen={fullscreenWidgets[w.id] || false}
              onClose={onCloseWidget}
              accentColor={accentColor}
            >
              {w.type === 'music' && (
                <MusicWidget query={w.data.query || ''} accentColor={accentColor} />
              )}
              {w.type === 'news' && (
                <NewsWidget accentColor={accentColor} />
              )}
              {w.type === 'image' && (
                <ImageWidget
                  src={w.data.src || w.data.url || ''}
                  caption={w.data.caption}
                  accentColor={accentColor}
                />
              )}
              {w.type === 'newsvisualizer' && (
                <NewsVisualizer
                  query={w.data.query || 'world news'}
                  initialResults={w.data.results}
                  accentColor={accentColor}
                />
              )}
              {w.type === 'youtube' && (
                <YouTubeWidget
                  query={w.data.query}
                  videoId={w.data.videoId}
                  accentColor={accentColor}
                />
              )}
              {w.type === 'custom' && (
                <div style={{
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.6)',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                }}>
                  {w.data.content || w.data.text || 'No content'}
                </div>
              )}
            </WidgetShell>
          </React.Fragment>
        );
      })}
    </>
  );
}
