import type { MapCommand } from "@/features/map/MapView";
import type { ToolRegistry } from "./types";

export const mapHandlers: ToolRegistry = {
  renderMap: {
    handler: ({ args, setMapCommand, addToast }) => {
      const cmd: MapCommand = {
        action: 'RENDER_MAP',
        speech_confirmation: `Displaying the map of ${args.target}.`,
        telemetry: {
          target: args.target,
          coordinates: [args.longitude, args.latitude],
          zoom_level: args.zoom_level || 12,
          pitch: 50,
          bearing: -15,
        },
        render_settings: {
          animation_mode: args.animation_mode || 'globe_glide',
          theme: 'tactical_blue_hologram',
        },
      };
      setMapCommand(cmd);
      addToast?.(`Geospatial Module: Displaying ${args.target}`, "info");
      return { success: true, message: `Map of ${args.target} is now being rendered on screen. The user can see an interactive holographic map.` };
    },
  },

  closeMap: {
    handler: ({ setMapCommand, addToast }) => {
      setMapCommand(null);
      addToast?.(`Geospatial Module: Map dismissed.`, "info");
      return { success: true, message: "The map has been closed and the main UI is restored." };
    },
  },
};
