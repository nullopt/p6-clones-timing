import type { CombatStyle, PluginSettings, SettingsElements } from "../types";
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from "../constants";

// ============================================================================
// SETTINGS MANAGER
// ============================================================================

export class SettingsManager {
    private settings: PluginSettings = { ...DEFAULT_SETTINGS };

    constructor(private elements: SettingsElements) { }

    load(): void {
        try {
            const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                this.settings = { ...DEFAULT_SETTINGS, ...parsed };
            }
        } catch (error) {
            console.error("Failed to load settings:", error);
        }
        this.applyToUI();
    }

    save(): void {
        try {
            localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
        } catch (error) {
            console.error("Failed to save settings:", error);
        }
    }

    get current(): PluginSettings {
        return this.settings;
    }

    update<K extends keyof PluginSettings>(key: K, value: PluginSettings[K]): void {
        this.settings[key] = value;
        this.save();

        if (key === "debugMode") {
            this.elements.output?.classList.toggle("hidden", !value);
        }
    }

    private applyToUI(): void {
        const { useTicks, showImage, showProgressBar, compensateForPing, debugMode, combatStyle, output } = this.elements;

        if (useTicks) useTicks.checked = this.settings.useTicks;
        if (showImage) showImage.checked = this.settings.showImage;
        if (showProgressBar) showProgressBar.checked = this.settings.showProgressBar;
        if (compensateForPing) compensateForPing.checked = this.settings.compensateForPing;
        if (debugMode) debugMode.checked = this.settings.debugMode;

        combatStyle?.forEach(radio => {
            radio.checked = radio.value === this.settings.combatStyle;
        });

        // offset sliders are applied later via applyOffsetSlidersToUI() after max values are set
        // but we can still apply scale since it has a fixed range
        this.applyOffsetSlidersToUI();

        output?.classList.toggle("hidden", !this.settings.debugMode);
    }

    private updateOffsetXDisplay(): void {
        const el = document.getElementById("offset-x-value");
        if (el) {
            el.textContent = this.settings.overlayOffsetX.toString();
        }
    }

    private updateOffsetYDisplay(): void {
        const el = document.getElementById("offset-y-value");
        if (el) {
            el.textContent = this.settings.overlayOffsetY.toString();
        }
    }

    private updateScaleDisplay(): void {
        const scaleValueEl = document.getElementById("scale-value");
        if (scaleValueEl) {
            scaleValueEl.textContent = `${Math.round(this.settings.overlayScale * 100)}%`;
        }
    }

    updateSliderMaxValues(maxX: number, maxY: number): void {
        const { overlayOffsetX, overlayOffsetY } = this.elements;
        if (overlayOffsetX) {
            overlayOffsetX.max = maxX.toString();
        }
        if (overlayOffsetY) {
            overlayOffsetY.max = maxY.toString();
        }
        // re-apply slider values after max is set (in case they were clamped before)
        this.applyOffsetSlidersToUI();
    }

    private applyOffsetSlidersToUI(): void {
        const { overlayOffsetX, overlayOffsetY, overlayScale } = this.elements;
        if (overlayOffsetX) {
            overlayOffsetX.value = this.settings.overlayOffsetX.toString();
            this.updateOffsetXDisplay();
        }
        if (overlayOffsetY) {
            overlayOffsetY.value = this.settings.overlayOffsetY.toString();
            this.updateOffsetYDisplay();
        }
        if (overlayScale) {
            overlayScale.value = (this.settings.overlayScale * 100).toString();
            this.updateScaleDisplay();
        }
    }

    initializeDefaultPosition(centerX: number, centerY: number): void {
        // only set defaults if position hasn't been initialized yet
        if (!this.settings.positionInitialized) {
            this.settings.overlayOffsetX = centerX;
            this.settings.overlayOffsetY = centerY;
            this.settings.positionInitialized = true;
            this.save();
            this.applyOffsetSlidersToUI();
        }
    }

    private onOverlayChange: (() => void) | null = null;

    setupListeners(onLog: (msg: string) => void, onOverlayChange?: () => void): void {
        this.onOverlayChange = onOverlayChange || null;
        const { useTicks, showImage, showProgressBar, compensateForPing, debugMode, combatStyle, overlayOffsetX, overlayOffsetY, overlayScale } = this.elements;

        useTicks?.addEventListener("change", () => {
            this.update("useTicks", useTicks.checked);
            onLog(`Display mode: ${useTicks.checked ? "ticks" : "seconds"}`);
        });

        showImage?.addEventListener("change", () => {
            this.update("showImage", showImage.checked);
            onLog(`Show image: ${showImage.checked}`);
        });

        showProgressBar?.addEventListener("change", () => {
            this.update("showProgressBar", showProgressBar.checked);
            onLog(`Show progress bar: ${showProgressBar.checked}`);
        });

        compensateForPing?.addEventListener("change", () => {
            this.update("compensateForPing", compensateForPing.checked);
            onLog(`Compensate for ping: ${compensateForPing.checked}`);
        });

        debugMode?.addEventListener("change", () => {
            this.update("debugMode", debugMode.checked);
        });

        combatStyle?.forEach(radio => {
            radio.addEventListener("change", () => {
                this.update("combatStyle", radio.value as CombatStyle);
                onLog(`Combat style: ${radio.value}`);
            });
        });

        overlayOffsetX?.addEventListener("input", () => {
            const value = parseInt(overlayOffsetX.value, 10) || 0;
            this.update("overlayOffsetX", value);
            this.updateOffsetXDisplay();
            this.onOverlayChange?.();
        });

        overlayOffsetY?.addEventListener("input", () => {
            const value = parseInt(overlayOffsetY.value, 10) || 0;
            this.update("overlayOffsetY", value);
            this.updateOffsetYDisplay();
            this.onOverlayChange?.();
        });

        overlayScale?.addEventListener("input", () => {
            const value = parseInt(overlayScale.value, 10) / 100;
            this.update("overlayScale", value);
            this.updateScaleDisplay();
            this.onOverlayChange?.();
        });
    }
}
