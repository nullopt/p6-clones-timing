import * as a1lib from "alt1/base";

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function getProgressColor(progress: number): number {
    if (progress > 0.5) return a1lib.mixColor(0, 255, 0);  // green
    if (progress > 0.2) return a1lib.mixColor(255, 255, 0); // yellow
    return a1lib.mixColor(255, 0, 0);  // red
}

export function formatTime(ms: number, useTicks: boolean): string {
    if (useTicks) {
        // round down to nearest tick (600ms), then convert to seconds
        const ticks = Math.floor(ms / 600);
        const tickSeconds = ticks * 0.6;
        return tickSeconds.toFixed(1);
    }
    // show seconds with one decimal place
    const seconds = ms / 1000;
    return seconds.toFixed(1);
}
