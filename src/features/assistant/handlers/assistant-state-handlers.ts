import type { ToolRegistry } from "./types";

export const assistantStateHandlers: ToolRegistry = {
  goToSleep: {
    handler: ({ goSleep }) => {
      // Friday has already spoken her goodbye — now we disconnect after a short pause
      setTimeout(() => {
        goSleep();
      }, 1200);
      return { success: true, message: "Going to sleep. Wake listener will be activated." };
    },
  },
};
