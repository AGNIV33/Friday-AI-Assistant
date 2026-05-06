/**
 * ImageWidget — Displays an image with optional caption inside a Friday widget.
 */
import React from 'react';
import { ImageIcon } from 'lucide-react';

interface ImageWidgetProps {
  src: string;
  caption?: string;
  accentColor?: string;
}

export default function ImageWidget({ src, caption, accentColor = '#00f2ff' }: ImageWidgetProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{
        borderRadius: 10,
        overflow: 'hidden',
        background: '#000',
        border: '1px solid rgba(255,255,255,0.06)',
        position: 'relative',
      }}>
        <img
          src={src}
          alt={caption || 'Image'}
          style={{
            width: '100%',
            maxHeight: 300,
            objectFit: 'contain',
            display: 'block',
          }}
          onError={(e) => {
            // Show fallback on load error
            (e.target as HTMLImageElement).style.display = 'none';
            const parent = (e.target as HTMLImageElement).parentElement;
            if (parent) {
              parent.innerHTML = `
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:120px;color:rgba(255,255,255,0.2)">
                  <span style="font-size:11px">Image failed to load</span>
                </div>
              `;
            }
          }}
        />
      </div>
      {caption && (
        <div style={{
          fontSize: 11,
          color: 'rgba(255,255,255,0.5)',
          textAlign: 'center',
          lineHeight: 1.4,
          padding: '0 4px',
        }}>
          {caption}
        </div>
      )}
    </div>
  );
}
