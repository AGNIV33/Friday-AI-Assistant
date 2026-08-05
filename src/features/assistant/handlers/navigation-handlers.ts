import type { ToolRegistry } from "./types";
import { msSinceMediaOpened } from "./shared-state";

export const navigationHandlers: ToolRegistry = {
  openWebsite: {
    handler: async ({ args, electronAPI }) => {
      // ── Duplicate-tab guard ──
      // If playMedia recently opened a YouTube/Spotify URL, skip this openWebsite call
      const urlLower = (args.url || "").toLowerCase();
      if (urlLower.includes("youtube.com") || urlLower.includes("youtu.be") || urlLower.includes("spotify.com")) {
        if (msSinceMediaOpened() < 15000) {
          console.log("[Friday] Blocked duplicate openWebsite for media URL (playMedia already handled it)");
          return { success: true, message: "Already opened by playMedia — skipping duplicate." };
        }
      }

      if (electronAPI) {
        const res = await electronAPI.openInChrome(args.url);
        return res.success ? { success: true, message: `Opened ${args.url} in Google Chrome` } : { error: res.error };
      } else {
        window.open(args.url, "_blank");
        return { success: true, message: `Opened ${args.url}` };
      }
    },
  },

  closeChromeTab: {
    requiresElectron: true,
    handler: async ({ electronAPI }) => {
      const res = await electronAPI!.closeChromeTab();
      return res.success ? { success: true } : { error: res.error };
    },
  },

  searchWeb: {
    handler: async ({ args, electronAPI, setProgressTask }) => {
      if (electronAPI) {
        setProgressTask({ active: true, label: `Searching web for "${args.query}"…`, type: 'web' });
        const res = await electronAPI.searchGoogle(args.query);
        setProgressTask(null);
        if (res.success && res.data) {
          return { success: true, searchResultText: res.data };
        }
        return { error: res.error || "Search failed" };
      } else {
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(args.query)}`;
        window.open(searchUrl, "_blank");
        return { success: true, message: `Searching for ${args.query}` };
      }
    },
  },

  getWeather: {
    handler: async ({ args }) => {
      const weatherRes = await fetch(`https://wttr.in/${encodeURIComponent(args.location)}?format=j1`);
      const weatherData = await weatherRes.json();
      // wttr.in intermittently returns a payload without current_condition —
      // guard so it surfaces as a useful message instead of the generic
      // "Failed to execute tool."
      const current = weatherData?.current_condition?.[0];
      if (!current) {
        return { error: `Could not read current weather for "${args.location}". The weather service returned an unexpected response.` };
      }
      return {
        success: true,
        temp: `${current.temp_C}°C`,
        condition: current.weatherDesc?.[0]?.value,
        humidity: `${current.humidity}%`
      };
    },
  },
};
