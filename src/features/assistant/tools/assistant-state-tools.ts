import { type FunctionDeclaration, Type } from "@google/genai";

export const goToSleepTool: FunctionDeclaration = {
  name: "goToSleep",
  description: "Call this when the user dismisses you for the session — for example 'that's it for today', 'goodbye Friday', 'go to sleep', 'thanks we're done', 'that will be all'. ALWAYS speak your goodbye out loud FIRST, then call this tool. You will go offline until woken.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};
