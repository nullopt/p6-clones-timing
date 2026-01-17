import type { OverlayPosition, PluginSettings, TimerStep } from "../types";
import { OVERLAY_GROUPS, PROGRESS_REFRESH_RATE, TICK_MS } from "../constants";
import { formatTime, getProgressColor } from "../utils";
import { ImageLoader } from "./ImageLoader";
import { OverlayRenderer } from "./OverlayRenderer";

// ============================================================================
// TIMER CONTROLLER
// ============================================================================

export class TimerController {
    private textInterval: number | null = null;
    private progressInterval: number | null = null;
    private isActive = false;

    constructor(
        private renderer: OverlayRenderer,
        private imageLoader: ImageLoader,
        private settings: () => PluginSettings,
        private onComplete: () => void
    ) { }

    get active(): boolean {
        return this.isActive;
    }

    start(steps: TimerStep[]): void {
        this.stop();
        this.isActive = true;

        const pos = this.renderer.getPosition();
        const settings = this.settings();
        // ticks update every 600ms, seconds mode updates every 1s
        const textRefreshRate = settings.useTicks ? TICK_MS : 16;

        // adjust start time for ping compensation
        let pingOffset = 0;
        if (settings.compensateForPing && typeof alt1 !== "undefined" && alt1.rsPing > 0) {
            pingOffset = alt1.rsPing;
        }
        const startTime = Date.now() - pingOffset;

        // calculate cumulative end times for each step
        const stepEndTimes: number[] = [];
        let cumulative = 0;
        for (const step of steps) {
            cumulative += step.durationMs;
            stepEndTimes.push(cumulative);
        }

        // get current step info based on elapsed time
        const getCurrentStep = (elapsed: number) => {
            for (let i = 0; i < steps.length; i++) {
                if (elapsed < stepEndTimes[i]) {
                    const stepStart = i === 0 ? 0 : stepEndTimes[i - 1];
                    const timeInStep = elapsed - stepStart;
                    const remainingMs = steps[i].durationMs - timeInStep;
                    return { step: steps[i], remainingMs, index: i };
                }
            }
            return null;
        };

        // draw text/image overlay
        const drawTextOverlay = (): boolean => {
            const elapsed = Date.now() - startTime;
            const current = getCurrentStep(elapsed);

            if (!current) return false;

            const progress = current.remainingMs / current.step.durationMs;
            const color = getProgressColor(progress);
            const images = this.imageLoader.getMultiple(current.step.imageKeys);

            alt1.overLaySetGroup(OVERLAY_GROUPS.TEXT);
            alt1.overLayClearGroup(OVERLAY_GROUPS.TEXT);

            this.renderer.drawImages(images, pos, textRefreshRate + 100);
            this.renderer.drawText(
                `${formatTime(current.remainingMs, this.settings().useTicks)}s`,
                color,
                pos,
                textRefreshRate + 100
            );

            return true;
        };

        // draw progress bar (smooth updates)
        const drawProgressBar = (): boolean => {
            const elapsed = Date.now() - startTime;
            const current = getCurrentStep(elapsed);

            alt1.overLaySetGroup(OVERLAY_GROUPS.BAR);
            alt1.overLayClearGroup(OVERLAY_GROUPS.BAR);

            if (!current) {
                this.finish(steps[steps.length - 1].imageKeys, pos);
                return false;
            }

            const progress = current.remainingMs / current.step.durationMs;
            const color = getProgressColor(progress);
            this.renderer.drawProgressBar(progress, color, pos, PROGRESS_REFRESH_RATE + 50);

            return true;
        };

        // initial draw
        drawTextOverlay();

        // start intervals
        this.textInterval = window.setInterval(() => {
            if (!drawTextOverlay()) {
                this.clearInterval("text");
            }
        }, textRefreshRate);

        this.progressInterval = window.setInterval(() => {
            if (!drawProgressBar()) {
                this.clearInterval("progress");
            }
        }, PROGRESS_REFRESH_RATE);
    }

    private finish(lastImageKeys: string[], pos: OverlayPosition): void {
        this.renderer.clearAll();
        this.renderer.drawFinalMessage(lastImageKeys, pos);
        this.isActive = false;
        this.onComplete();
    }

    stop(): void {
        this.clearInterval("text");
        this.clearInterval("progress");
        this.renderer.clearAll();
        this.isActive = false;
    }

    private clearInterval(type: "text" | "progress"): void {
        if (type === "text" && this.textInterval !== null) {
            window.clearInterval(this.textInterval);
            this.textInterval = null;
        }
        if (type === "progress" && this.progressInterval !== null) {
            window.clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }
}
