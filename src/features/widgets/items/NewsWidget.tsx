/**
 * NewsWidget — Futuristic scrollable news headline cards.
 * Fetches from Google News RSS via IPC — no API key required.
 */
import React, { useState, useEffect } from 'react';
import { Newspaper, ExternalLink, Loader2 } from 'lucide-react';

interface NewsArticle {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

interface NewsWidgetProps {
  accentColor?: string;
}

function timeAgo(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch { return ''; }
}

export default function NewsWidget({ accentColor = '#00f2ff' }: NewsWidgetProps) {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (window.electronAPI?.fetchNews) {
          const res = await window.electronAPI.fetchNews();
          if (!cancelled && res.success) {
            setArticles(res.articles || []);
          } else if (!cancelled) {
            setError(res.error || 'Failed to fetch news');
          }
        } else {
          setError('News feed unavailable in browser mode');
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 12 }}>
        <Loader2 style={{ width: 28, height: 28, color: accentColor, animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: "'JetBrains Mono', monospace" }}>
          Fetching headlines...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 120, gap: 8 }}>
        <Newspaper style={{ width: 24, height: 24, color: 'rgba(255,255,255,0.2)' }} />
        <span style={{ fontSize: 11, color: 'rgba(255,60,60,0.6)' }}>{error}</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto' }}
      className="custom-scrollbar"
    >
      {articles.map((article, i) => (
        <div
          key={i}
          onClick={() => {
            if (window.electronAPI?.openInChrome && article.link) {
              window.electronAPI.openInChrome(article.link);
            }
          }}
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.04)',
            cursor: 'pointer',
            transition: 'background 200ms, border-color 200ms',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
            e.currentTarget.style.borderColor = `${accentColor}30`;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.025)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)';
          }}
        >
          <div style={{
            fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.75)',
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {article.title}
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            marginTop: 6, fontSize: 9, color: 'rgba(255,255,255,0.3)',
          }}>
            <span style={{
              padding: '1px 5px',
              borderRadius: 4,
              background: `${accentColor}12`,
              color: `${accentColor}90`,
              fontWeight: 600,
              letterSpacing: '0.04em',
            }}>
              {article.source || 'News'}
            </span>
            <span>{timeAgo(article.pubDate)}</span>
            <ExternalLink style={{ width: 9, height: 9, marginLeft: 'auto', opacity: 0.4 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
