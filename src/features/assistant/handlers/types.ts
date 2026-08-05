import type { Dispatch, SetStateAction } from "react";
import type { MapCommand } from "@/features/map/MapView";
import type { WidgetData } from "@/features/widgets/WidgetManager";

export type ElectronAPI = NonNullable<Window['electronAPI']>;

export type ProgressTask = {
  active: boolean;
  label: string;
  type: 'search' | 'generate' | 'write' | 'web' | 'news' | 'general';
} | null;

/**
 * Everything a tool handler is allowed to touch.
 *
 * All callbacks are ref-backed by useFriday — `connect` is a `useCallback(…, [])`,
 * so anything captured directly would go stale. Handlers must only use what's here.
 */
export interface ToolContext {
  args: any;

  /**
   * Present iff the running build is the desktop app.
   * Handlers declared `requiresElectron: true` may assume this is non-null —
   * the dispatcher checks before invoking them and returns the browser-mode
   * error otherwise.
   */
  electronAPI?: ElectronAPI;

  /** Firebase uid of the signed-in user. */
  uid: string;

  /** Inject a synthetic user turn — makes Friday speak. Used for deferred results. */
  sendText: (text: string) => void;

  addToast?: (msg: string, type: 'success' | 'error' | 'info' | 'warning', duration?: number) => void;
  setProgressTask: (task: ProgressTask) => void;
  setMapCommand: (cmd: MapCommand | null) => void;
  setIsGameMode: (enabled: boolean) => void;
  setIsGeneratingImage: (generating: boolean) => void;
  setWidgets: Dispatch<SetStateAction<WidgetData[]>>;
  openWidget: (widget: WidgetData) => void;
  closeAllWidgets: () => void;

  vision: any;
  goSleep: () => void;

  /** Adjusts the UI's urgency styling (orb + accent). */
  setTone?: (tone: 'neutral' | 'urgent' | 'calm') => void;

  /**
   * Runs another tool by name. Injected by the dispatcher, which is what keeps
   * this from being a circular import. Used by routines to replay a saved
   * sequence of tool calls.
   */
  runTool?: (name: string, args: any) => Promise<any>;
}

export type ToolHandler = (ctx: ToolContext) => Promise<any> | any;

export interface ToolDefinition {
  handler: ToolHandler;
  /**
   * Marks a tool as desktop-only. The dispatcher derives the browser-mode
   * rejection list from this flag, so it can never drift out of sync the way
   * the old hand-maintained name array did.
   */
  requiresElectron?: boolean;
}

export type ToolRegistry = Record<string, ToolDefinition>;
