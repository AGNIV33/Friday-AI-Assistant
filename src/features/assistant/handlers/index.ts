import { perf } from "../perf";
import type { ToolContext, ToolRegistry } from "./types";

import { visionHandlers } from "./vision-handlers";
import { assistantStateHandlers } from "./assistant-state-handlers";
import { mapHandlers } from "./map-handlers";
import { widgetHandlers } from "./widget-handlers";
import { navigationHandlers } from "./navigation-handlers";
import { memoryHandlers } from "./memory-handlers";
import { appsHandlers } from "./apps-handlers";
import { systemHandlers } from "./system-handlers";
import { filesHandlers } from "./files-handlers";
import { mediaHandlers } from "./media-handlers";
import { documentsHandlers } from "./documents-handlers";
import { socialHandlers } from "./social-handlers";
import { whatsappHandlers } from "./whatsapp-handlers";
import { reminderHandlers } from "./reminder-handlers";
import { productivityHandlers } from "./productivity-handlers";
import { googleHandlers } from "./google-handlers";

export type { ToolContext, ToolRegistry, ToolDefinition, ProgressTask, ElectronAPI } from "./types";

export const TOOL_REGISTRY: ToolRegistry = {
  ...visionHandlers,
  ...assistantStateHandlers,
  ...mapHandlers,
  ...widgetHandlers,
  ...navigationHandlers,
  ...memoryHandlers,
  ...appsHandlers,
  ...systemHandlers,
  ...filesHandlers,
  ...mediaHandlers,
  ...documentsHandlers,
  ...socialHandlers,
  ...whatsappHandlers,
  ...reminderHandlers,
  ...productivityHandlers,
  ...googleHandlers,
};

/**
 * Desktop-only tools, derived from the registry rather than hand-maintained.
 * The previous implementation duplicated these 33 names in a literal array;
 * forgetting to update it made a new tool silently return "Tool not found".
 */
export const ELECTRON_ONLY_TOOLS = Object.entries(TOOL_REGISTRY)
  .filter(([, def]) => def.requiresElectron)
  .map(([name]) => name);

/**
 * Single entry point for every tool call.
 *
 * Owns the cross-cutting concerns that were previously scattered or missing:
 * perf timing (which never closed on success paths before), cache logging
 * (which discarded results), and the browser-mode guard.
 */
export async function dispatchToolCall(
  name: string,
  ctx: Omit<ToolContext, 'args'> & { args: any },
  _depth = 0
): Promise<any> {
  const def = TOOL_REGISTRY[name];

  // Let handlers invoke other tools (routines replay a saved sequence).
  // Depth-capped so a routine that somehow references itself can't recurse away.
  if (!ctx.runTool) {
    ctx.runTool = (n: string, a: any) =>
      _depth >= 3
        ? Promise.resolve({ error: 'Nested tool depth exceeded.' })
        : dispatchToolCall(n, { ...ctx, args: a, runTool: undefined }, _depth + 1);
  }

  perf.start(`tool:${name}`);

  const finish = (result: any, status: string) => {
    perf.end(`tool:${name}`, { status });
    // Log the call *and its result* to the local cache. The result was
    // previously always written as null even though the format supports it.
    try {
      ctx.electronAPI?.cacheSaveTurn?.('tool', '', name, ctx.args, result);
    } catch (_) {}
    return result;
  };

  if (!def) {
    return finish({ error: "Tool not found" }, 'not_found');
  }

  if (def.requiresElectron && !ctx.electronAPI) {
    return finish({ error: "System tools are only available in the desktop application." }, 'no_electron');
  }

  try {
    const result = await def.handler(ctx as ToolContext);
    return finish(result, 'ok');
  } catch (err) {
    console.error(`Tool ${name} failed:`, err);
    return finish({ error: "Failed to execute tool." }, 'error');
  }
}
