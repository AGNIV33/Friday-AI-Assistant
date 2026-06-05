/**
 * NewsVisualizer — Iron Man HUD Style Live News Dashboard
 *
 * Architecture:
 * - Left Pane: Muted YouTube Live Stream
 * - Right Pane: Line Chart & Terminal Dictation Logs
 * - Bottom Pane: Ticker and Channel List
 * - Top Pane: Stock Ticker
 */
import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Radio, Activity } from 'lucide-react';

interface NewsSegment {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt: string;
}

interface NewsVisualizerProps {
  query?: string;
  initialResults?: NewsSegment[];
  accentColor?: string;
}

export default function NewsVisualizer({ query = 'world news', initialResults, accentColor = '#00f2ff' }: NewsVisualizerProps) {
  const [segments, setSegments] = useState<NewsSegment[]>(initialResults || []);
  const [loading, setLoading] = useState(!initialResults);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [graphMode, setGraphMode] = useState<'normal' | 'stocks'>('normal');
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Fetch news if not provided
  useEffect(() => {
    let cancelled = false;
    if (initialResults && initialResults.length > 0) {
      setSegments(initialResults);
      setLoading(false);
      return;
    }
    
    (async () => {
      try {
        if (window.electronAPI?.searchYoutubeNews) {
          const res = await window.electronAPI.searchYoutubeNews(query);
          if (!cancelled && res.success && res.results?.length > 0) {
            setSegments(res.results);
          } else if (!cancelled) {
            setError(res.error || 'No live streams found.');
          }
        } else {
          setError('News API unavailable.');
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [query, initialResults]);

  // Handle external Friday control commands
  useEffect(() => {
    const handleControl = (e: any) => {
      const action = e.detail?.action;
      if (!action) return;

      switch (action) {
        case 'next_channel':
          setActiveIndex((prev) => (prev + 1) % segments.length);
          break;
        case 'prev_channel':
          setActiveIndex((prev) => (prev - 1 + segments.length) % segments.length);
          break;
        case 'unmute':
          if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'unMute', args: [] }), '*');
            iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [100] }), '*');
          }
          break;
        case 'mute':
          if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'mute', args: [] }), '*');
          }
          break;
        case 'show_stock_graph':
          setGraphMode('stocks');
          break;
      }
    };

    window.addEventListener('friday-news-control', handleControl);
    return () => window.removeEventListener('friday-news-control', handleControl);
  }, [segments.length]);

  // Cycle through live videos every 30 seconds
  useEffect(() => {
    if (segments.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % segments.length);
    }, 30000);
    return () => clearInterval(timer);
  }, [segments]);

  // Ensure iframe is muted
  useEffect(() => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      // The iframe handles mute via src params initially, but we can send a message to ensure it stays muted.
      iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'mute', args: [] }), '*');
    }
  }, [activeIndex]);

  if (loading) {
    return (
      <div className="hud-container flex flex-col items-center justify-center">
        <Loader2 className="animate-spin" style={{ color: accentColor, width: 32, height: 32 }} />
        <span className="mt-4 text-xs tracking-widest text-[rgba(255,255,255,0.7)] uppercase font-mono">Connecting to Live Global Feeds...</span>
      </div>
    );
  }

  if (error || segments.length === 0) {
    return (
      <div className="hud-container flex flex-col items-center justify-center text-center p-6">
        <Radio style={{ width: 28, height: 28, color: 'rgba(255,100,100,0.8)' }} className="mb-2" />
        <span className="text-xs text-white/50 uppercase tracking-widest">{error || 'No live feeds available'}</span>
      </div>
    );
  }

  const activeSegment = segments[activeIndex];

  // Dynamic graph data
  const normalPoints = "0,80 20,70 40,90 60,60 80,75 100,40 120,50 140,20 160,35 180,10 200,30";
  const stockPoints = "0,90 10,80 20,85 30,60 40,70 50,40 60,50 70,20 80,30 90,10 100,40 110,30 120,60 130,50 140,20 150,10 160,30 170,20 180,50 190,40 200,60";
  const points = graphMode === 'stocks' ? stockPoints : normalPoints;
  const graphColor = graphMode === 'stocks' ? '#00ff66' : '#ff3366';

  return (
    <div className="hud-container">
      {/* SCANLINES */}
      <div className="hud-scanlines" />

      {/* TOP TICKER */}
      <div className="hud-ticker">
        <div className="hud-ticker-inner">
          <span className="hud-ticker-item">DOW <span className="text-green-400">39,313.6 ▲ +0.32%</span></span>
          <span className="hud-ticker-item">NASDAQ <span className="text-green-400">16,384 ▲ +0.55%</span></span>
          <span className="hud-ticker-item">S&P 500 <span className="text-green-400">5,218.1 ▲ +0.48%</span></span>
          <span className="hud-ticker-item">BTC <span className="text-red-400">62,150.3 ▼ -0.31%</span></span>
          <span className="hud-ticker-item">GOLD <span className="text-green-400">2,380.7 ▲ +0.82%</span></span>
          <span className="hud-ticker-item text-white/40">FRIDAY // GLOBAL LIVE NEWS FEED // SYSTEM ONLINE</span>
        </div>
      </div>

      <div className="hud-main-grid">
        {/* LEFT PANE: VIDEO */}
        <div className="hud-video-pane">
          <div className="hud-video-corner top-left"></div>
          <div className="hud-video-corner top-right"></div>
          <div className="hud-video-corner bottom-left"></div>
          <div className="hud-video-corner bottom-right"></div>
          
          <iframe
            ref={iframeRef}
            src={`https://www.youtube.com/embed/${activeSegment?.id}?enablejsapi=1&autoplay=1&mute=1&rel=0&modestbranding=1&controls=0&showinfo=0`}
            className="hud-iframe"
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
          <div className="hud-video-overlay-text">
            <Radio className="hud-pulse" style={{ width: 10, height: 10, color: 'red', display: 'inline-block', marginRight: 6 }} />
            LIVE // {activeSegment?.channelTitle?.toUpperCase()}
          </div>
        </div>

        {/* RIGHT PANE: DATA & TERMINAL */}
        <div className="hud-right-pane">
          {/* GRAPH AREA */}
          <div className="hud-graph-box">
            <div className="hud-box-header">
              <Activity className="w-3 h-3 text-white/50" />
              <span>MARKET VOLATILITY // 24H</span>
            </div>
            <div className="hud-graph-content">
              <svg viewBox="0 0 200 100" preserveAspectRatio="none" className="w-full h-full">
                <defs>
                  <linearGradient id="graphGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={graphColor} stopOpacity="0.4" />
                    <stop offset="100%" stopColor={graphColor} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <polyline fill="url(#graphGradient)" stroke="none" points={`0,100 ${points} 200,100`} />
                <polyline fill="none" stroke={graphColor} strokeWidth="2" strokeLinejoin="round" points={points} />
              </svg>
            </div>
          </div>

          {/* TERMINAL AREA */}
          <div className="hud-terminal-box">
            <div className="hud-box-header">
              <span>FRIDAY // DICTATION LOGS</span>
            </div>
            <div className="hud-terminal-content">
              <div className="hud-term-line text-white/50">&gt; User connected.</div>
              <div className="hud-term-line text-white/50">&gt; Initiating Live Global Feeds...</div>
              <div className="hud-term-line text-white/50">&gt; Establishing secure connection.</div>
              <div className="hud-term-line mt-2 text-[#00f2ff] font-bold">
                [SYSTEM] Dictation mode active. Analyzing live broadcast audio...
              </div>
              <div className="hud-term-line mt-2">
                <span className="text-white/40">Current Feed:</span> <br/>
                <span className="text-white/90">{activeSegment.title}</span>
              </div>
              <div className="hud-term-line mt-2 text-white/60">
                {activeSegment.description || 'Live broadcast in progress...'}
              </div>
              <div className="hud-term-line mt-4">
                <span className="hud-cursor">█</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM PANE: CHANNELS LIST */}
      <div className="hud-bottom-pane">
        <div className="hud-bottom-header">GLOBAL LIVE STREAMS // ACTIVE</div>
        <div className="hud-bottom-list">
          {segments.map((seg, idx) => (
            <div key={seg.id} className={`hud-list-item ${idx === activeIndex ? 'active' : ''}`}>
              <span className="hud-list-bullet">{idx === activeIndex ? '▶' : '■'}</span>
              <span className="hud-list-channel">{seg.channelTitle}</span>
              <span className="hud-list-title">{seg.title}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
