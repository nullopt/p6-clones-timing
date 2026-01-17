// ============================================================================
// TYPES
// ============================================================================

export type CombatStyle = "magic" | "necro";

export interface PluginSettings {
    useTicks: boolean;
    showImage: boolean;
    showProgressBar: boolean;
    debugMode: boolean;
    combatStyle: CombatStyle;
    overlayOffsetX: number;
    overlayOffsetY: number;
    overlayScale: number;
    positionInitialized: boolean;
    compensateForPing: boolean;
}

export interface LoadedImage {
    str: string;
    width: number;
    height: number;
}

export interface TimerStep {
    imageKeys: string[];
    durationMs: number;
}

export interface OverlayPosition {
    centerX: number;
    centerY: number;
    barLeft: number;
    barRight: number;
    barCenterY: number;
}

export interface SettingsElements {
    useTicks: HTMLInputElement | null;
    showImage: HTMLInputElement | null;
    showProgressBar: HTMLInputElement | null;
    compensateForPing: HTMLInputElement | null;
    debugMode: HTMLInputElement | null;
    combatStyle: NodeListOf<HTMLInputElement> | null;
    overlayOffsetX: HTMLInputElement | null;
    overlayOffsetY: HTMLInputElement | null;
    overlayScale: HTMLInputElement | null;
    output: HTMLElement | null;
}
