import type { CombatStyle, PluginSettings, TimerStep } from "./types";

// image imports
import magicIconUrl from "./icon.png";
import omniUrl from "./omni.png";
import namiUrl from "./nami.png";
import invokeUrl from "./invoke.png";
import threadsUrl from "./threads.png";
import volleyUrl from "./volley.png";
import t90Url from "./t90.png";
import eofUrl from "./eof.png";
import bloatUrl from "./bloat.png";

// ============================================================================
// TRIGGERS
// ============================================================================

export const CLONE_TRIGGERS = ["SUBJUGATED", "MORTAL!"];

// ============================================================================
// STORAGE
// ============================================================================

export const SETTINGS_STORAGE_KEY = "p6clones-settings";

// ============================================================================
// TIMING
// ============================================================================

export const TICK_MS = 600;
export const PROGRESS_REFRESH_RATE = 50;

// ============================================================================
// OVERLAY STYLING
// ============================================================================

export const BAR_WIDTH = 120;
export const BAR_HEIGHT = 8;
export const BAR_Y_OFFSET = 50;
export const TEXT_FONT_SIZE = 40;
export const IMAGE_GAP = 20;
export const MULTI_IMAGE_GAP = 8;
export const FINAL_MESSAGE_DURATION = 1500;

// ============================================================================
// CHAT COLORS (RGB)
// ============================================================================

export const NAME_RGB = [69, 131, 145];
export const TEXT_RGB = [153, 255, 153];
export const WHITE_RGB = [255, 255, 255];
export const PUB_BLUE = [127, 169, 255];

// ============================================================================
// IMAGE CONFIGURATION
// ============================================================================

export const IMAGE_SIZE = 64;

export const IMAGE_CONFIG: Record<string, string> = {
    magic: magicIconUrl,
    omni: omniUrl,
    nami: namiUrl,
    invoke: invokeUrl,
    threads: threadsUrl,
    volley: volleyUrl,
    t90: t90Url,
    eof: eofUrl,
    bloat: bloatUrl
};

// ============================================================================
// TIMER SEQUENCES
// ============================================================================

export const TIMER_SEQUENCES: Record<CombatStyle, TimerStep[]> = {
    magic: [
        { imageKeys: ["magic"], durationMs: 5400 },
        { imageKeys: ["omni"], durationMs: 1800 },
        { imageKeys: ["nami"], durationMs: 1800 },
    ],
    necro: [
        { imageKeys: ["invoke"], durationMs: 1800 },
        { imageKeys: ["threads"], durationMs: 1800 },
        { imageKeys: ["bloat"], durationMs: 1800 },
        { imageKeys: ["volley"], durationMs: 1800 },
        { imageKeys: ["t90", "eof"], durationMs: 1800 },
    ]
};

// ============================================================================
// DEFAULT SETTINGS
// ============================================================================

export const DEFAULT_SETTINGS: PluginSettings = {
    useTicks: false,
    showImage: true,
    showProgressBar: true,
    debugMode: false,
    combatStyle: "magic",
    overlayOffsetX: 0,
    overlayOffsetY: 0,
    overlayScale: 1.0,
    positionInitialized: false,
    compensateForPing: false
};

// ============================================================================
// OVERLAY GROUPS
// ============================================================================

export const OVERLAY_GROUPS = {
    TEXT: "clonetimer-text",
    BAR: "clonetimer-bar",
    FINAL: "clonetimer-final",
    DEBUG: "clonetimer-debug"
} as const;
