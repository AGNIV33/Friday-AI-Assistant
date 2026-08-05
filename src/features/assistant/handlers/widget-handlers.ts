import type { ToolRegistry } from "./types";

export const widgetHandlers: ToolRegistry = {
  openWidget: {
    handler: async ({ args, electronAPI, openWidget, addToast }) => {
      const wType = (args.widgetType || 'custom') as 'music' | 'news' | 'image' | 'youtube' | 'newsvisualizer' | 'custom';
      const wId = `widget-${wType}-${Date.now()}`;
      const widgetData: any = {};

      if (wType === 'newsvisualizer') {
        widgetData.query = args.query || 'world news';
        try {
          // Guarded: the news visualizer is the one widget that needs a desktop
          // fetch before mounting. In browser mode we fall through to an error
          // rather than throwing on an undefined electronAPI.
          if (!electronAPI) {
            return { success: false, error: 'Live news feeds are only available in the desktop application.' };
          }
          const res = await electronAPI.searchYoutubeNews(widgetData.query);
          if (res.success && res.results) {
            widgetData.results = res.results;
            const widget = { id: wId, type: wType, title: args.title || 'Intelligence Briefing', data: widgetData };
            openWidget(widget);

            // Format the news for Friday to dictate
            const headlines = res.results.slice(0, 5).map((r: any, i: number) =>
              `[Live Stream ${i + 1}] Channel: ${r.channelTitle} - Title: ${r.title}`
            ).join('\n');

            return {
              success: true,
              message: `News Dashboard opened with LIVE global video streams. You MUST now ACT AS A NEWS ANCHOR and naturally dictate/read out what's happening to the user right now using these fetched streams (keep it engaging and continuous):\n\n${headlines}`
            };
          } else {
            return { success: false, error: 'Failed to fetch live news feeds.' };
          }
        } catch (e: any) {
          return { success: false, error: e.message };
        }
      }

      if (wType === 'music' || wType === 'youtube') {
        widgetData.query = args.query || '';
      } else if (wType === 'image') {
        widgetData.src = args.query || '';
        widgetData.caption = args.caption || '';
      } else if (wType === 'custom') {
        widgetData.content = args.content || args.query || '';
      }

      const widget = {
        id: wId,
        type: wType,
        title: args.title || wType.charAt(0).toUpperCase() + wType.slice(1),
        data: widgetData,
      };

      openWidget(widget);
      addToast?.(`Widget opened: ${widget.title}`, "info");
      return { success: true, message: `${widget.title} widget is now displayed on screen.` };
    },
  },

  closeWidget: {
    handler: ({ args, setWidgets, addToast }) => {
      const searchTitle = (args.widgetTitle || '').toLowerCase();
      setWidgets(prev => {
        const match = prev.find(w =>
          w.title.toLowerCase().includes(searchTitle) ||
          w.type.toLowerCase().includes(searchTitle)
        );
        if (match) {
          addToast?.(`Widget closed: ${match.title}`, "info");
          return prev.filter(w => w.id !== match.id);
        }
        return prev;
      });
      return { success: true, message: `Widget matching "${args.widgetTitle}" has been closed.` };
    },
  },

  closeAllWidgets: {
    handler: ({ closeAllWidgets, addToast }) => {
      closeAllWidgets();
      addToast?.("All widgets closed.", "info");
      return { success: true, message: "All widgets have been closed." };
    },
  },

  controlNewsWidget: {
    handler: ({ args }) => {
      const action = args.action;
      // Dispatch event to NewsVisualizer and WidgetShell
      window.dispatchEvent(new CustomEvent('friday-news-control', { detail: { action } }));
      return { success: true, message: `Control action '${action}' sent to News Visualizer.` };
    },
  },
};
