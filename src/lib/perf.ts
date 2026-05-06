/**
 * Performance monitoring utilities for Friday AI.
 * 
 * Tracks key metrics:
 * - Connection times
 * - Response latencies
 * - Audio chunk processing times
 * - UI render performance
 */

interface PerfEntry {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

class PerformanceTracker {
  private entries: PerfEntry[] = [];
  private activeTimers: Map<string, number> = new Map();
  private maxEntries = 200;

  /**
   * Start a named timer.
   */
  start(name: string): void {
    this.activeTimers.set(name, performance.now());
  }

  /**
   * End a named timer and record the duration.
   * Returns duration in ms, or -1 if timer wasn't started.
   */
  end(name: string, metadata?: Record<string, any>): number {
    const startTime = this.activeTimers.get(name);
    if (startTime === undefined) return -1;

    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);

    this.activeTimers.delete(name);

    const entry: PerfEntry = {
      name,
      startTime,
      endTime,
      duration,
      metadata,
    };

    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    // Log significant operations
    if (duration > 100) {
      console.log(`[Perf] ${name}: ${duration}ms`, metadata || '');
    }

    return duration;
  }

  /**
   * Measure an async operation.
   */
  async measure<T>(name: string, fn: () => Promise<T>, metadata?: Record<string, any>): Promise<T> {
    this.start(name);
    try {
      const result = await fn();
      this.end(name, { ...metadata, status: 'success' });
      return result;
    } catch (err) {
      this.end(name, { ...metadata, status: 'error', error: String(err) });
      throw err;
    }
  }

  /**
   * Get average duration for a named operation.
   */
  getAverage(name: string): number {
    const matching = this.entries.filter(e => e.name === name && e.duration !== undefined);
    if (matching.length === 0) return 0;
    return Math.round(matching.reduce((sum, e) => sum + (e.duration || 0), 0) / matching.length);
  }

  /**
   * Get a summary of all tracked operations.
   */
  getSummary(): Record<string, { count: number; avgMs: number; maxMs: number; minMs: number }> {
    const grouped: Record<string, number[]> = {};

    for (const entry of this.entries) {
      if (entry.duration === undefined) continue;
      if (!grouped[entry.name]) grouped[entry.name] = [];
      grouped[entry.name].push(entry.duration);
    }

    const summary: Record<string, { count: number; avgMs: number; maxMs: number; minMs: number }> = {};
    for (const [name, durations] of Object.entries(grouped)) {
      summary[name] = {
        count: durations.length,
        avgMs: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
        maxMs: Math.max(...durations),
        minMs: Math.min(...durations),
      };
    }

    return summary;
  }

  /**
   * Print a formatted summary to console.
   */
  printSummary(): void {
    const summary = this.getSummary();
    console.group('[Friday Performance Summary]');
    for (const [name, stats] of Object.entries(summary)) {
      console.log(`${name}: avg=${stats.avgMs}ms, min=${stats.minMs}ms, max=${stats.maxMs}ms (${stats.count} calls)`);
    }
    console.groupEnd();
  }

  /**
   * Clear all entries.
   */
  clear(): void {
    this.entries = [];
    this.activeTimers.clear();
  }
}

// Singleton instance
export const perf = new PerformanceTracker();

// Make it available in dev console
if (typeof window !== 'undefined') {
  (window as any).__fridayPerf = perf;
}
