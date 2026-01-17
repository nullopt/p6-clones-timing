import * as a1lib from "alt1/base";
import type { LoadedImage, OverlayPosition, PluginSettings } from "../types";
import {
    BAR_HEIGHT,
    BAR_WIDTH,
    BAR_Y_OFFSET,
    FINAL_MESSAGE_DURATION,
    IMAGE_GAP,
    MULTI_IMAGE_GAP,
    OVERLAY_GROUPS,
    TEXT_FONT_SIZE,
    TIMER_SEQUENCES
} from "../constants";
import { formatTime, getProgressColor } from "../utils";
import { ImageLoader } from "./ImageLoader";

// ============================================================================
// OVERLAY RENDERER
// ============================================================================

export class OverlayRenderer {
    constructor(
        private imageLoader: ImageLoader,
        private settings: () => PluginSettings
    ) { }

    getPosition(): OverlayPosition {
        const { overlayOffsetX, overlayOffsetY, overlayScale } = this.settings();
        const scaledBarWidth = Math.round(BAR_WIDTH * overlayScale);
        const scaledBarHeight = Math.round(BAR_HEIGHT * overlayScale);
        // bar offset only scales down, not up (since images can't scale)
        const scaledBarYOffset = Math.round(BAR_Y_OFFSET * Math.min(1, overlayScale));

        // overlayOffsetX/Y are absolute positions on the RS screen
        const centerX = alt1.rsX + overlayOffsetX;
        const centerY = alt1.rsY + overlayOffsetY;
        const barY = centerY + scaledBarYOffset;

        return {
            centerX,
            centerY,
            barLeft: Math.round(centerX - scaledBarWidth / 2),
            barRight: Math.round(centerX - scaledBarWidth / 2) + scaledBarWidth,
            barCenterY: barY + Math.round(scaledBarHeight / 2)
        };
    }

    private getScaledImageGap(): number {
        // gaps only scale down, not up (since images can't scale)
        const scale = Math.min(1, this.settings().overlayScale);
        return Math.round(IMAGE_GAP * scale);
    }

    private getScaledBarHeight(): number {
        return Math.round(BAR_HEIGHT * this.settings().overlayScale);
    }

    private getScaledTextSize(): number {
        return Math.round(TEXT_FONT_SIZE * this.settings().overlayScale);
    }

    drawImages(images: LoadedImage[], pos: OverlayPosition, duration: number): void {
        if (!this.settings().showImage || images.length === 0) return;

        // note: Alt1's overLayImage doesn't support scaling - width must match original image data
        const scaledGap = this.getScaledImageGap();

        if (images.length === 1) {
            const img = images[0];
            alt1.overLayImage(
                Math.round(pos.centerX - img.width / 2),
                Math.round(pos.centerY - img.height - scaledGap),
                img.str,
                img.width,
                duration
            );
        } else {
            // multiple images side by side
            const totalWidth = images.reduce((sum, img) => sum + img.width, 0) +
                (images.length - 1) * MULTI_IMAGE_GAP;
            let xPos = Math.round(pos.centerX - totalWidth / 2);

            for (const img of images) {
                alt1.overLayImage(
                    xPos,
                    Math.round(pos.centerY - img.height - scaledGap),
                    img.str,
                    img.width,
                    duration
                );
                xPos += img.width + MULTI_IMAGE_GAP;
            }
        }
    }

    drawText(text: string, color: number, pos: OverlayPosition, duration: number): void {
        const scaledGap = this.getScaledImageGap();
        const yPos = this.settings().showImage ? pos.centerY + scaledGap : pos.centerY;
        alt1.overLayTextEx(
            text,
            color,
            this.getScaledTextSize(),
            pos.centerX,
            yPos,
            duration,
            "Arial",
            true,
            true
        );
    }

    drawProgressBar(progress: number, color: number, pos: OverlayPosition, duration: number): void {
        if (!this.settings().showProgressBar) return;

        const scaledBarHeight = this.getScaledBarHeight();
        const scaledBarWidth = Math.round(BAR_WIDTH * this.settings().overlayScale);

        // background
        alt1.overLayLine(
            a1lib.mixColor(50, 50, 50),
            scaledBarHeight,
            pos.barLeft, pos.barCenterY,
            pos.barRight, pos.barCenterY,
            duration
        );

        // foreground
        const filledWidth = Math.round(scaledBarWidth * progress);
        if (filledWidth > 0) {
            alt1.overLayLine(
                color,
                scaledBarHeight,
                pos.barLeft, pos.barCenterY,
                pos.barLeft + filledWidth, pos.barCenterY,
                duration
            );
        }
    }

    drawFinalMessage(imageKeys: string[], pos: OverlayPosition): void {
        alt1.overLaySetGroup(OVERLAY_GROUPS.FINAL);

        const images = this.imageLoader.getMultiple(imageKeys);
        this.drawImages(images, pos, FINAL_MESSAGE_DURATION);

        const scaledGap = this.getScaledImageGap();
        const yPos = this.settings().showImage ? pos.centerY + scaledGap : pos.centerY;
        alt1.overLayTextEx(
            "NOW!",
            a1lib.mixColor(255, 0, 0),
            Math.round(this.getScaledTextSize() + 10 * this.settings().overlayScale),
            pos.centerX,
            yPos,
            FINAL_MESSAGE_DURATION,
            "Arial",
            true,
            true
        );
    }

    clearAll(): void {
        alt1.overLayClearGroup(OVERLAY_GROUPS.TEXT);
        alt1.overLayClearGroup(OVERLAY_GROUPS.BAR);
    }

    drawDebugPreview(): void {
        const pos = this.getPosition();
        const duration = 86400000; // 24 hours - effectively persistent until cleared
        const settings = this.settings();

        // get the first step from the current combat style's sequence
        const sequence = TIMER_SEQUENCES[settings.combatStyle];
        const firstStep = sequence[0];
        const images = this.imageLoader.getMultiple(firstStep.imageKeys);

        // static progress at 100%
        const progress = 1.0;
        const color = getProgressColor(progress);

        alt1.overLaySetGroup(OVERLAY_GROUPS.DEBUG);
        alt1.overLayClearGroup(OVERLAY_GROUPS.DEBUG);

        // draw actual image(s) with scaling
        this.drawImagesForDebug(images, pos, duration);

        // draw static countdown text with scaling
        const timeText = `${formatTime(firstStep.durationMs, settings.useTicks)}s`;
        const scaledGap = this.getScaledImageGap();
        const yPos = settings.showImage ? pos.centerY + scaledGap : pos.centerY;
        alt1.overLayTextEx(
            timeText,
            color,
            this.getScaledTextSize(),
            pos.centerX,
            yPos,
            duration,
            "Arial",
            true,
            true
        );

        // draw static progress bar at 100% with scaling
        if (settings.showProgressBar) {
            const scaledBarHeight = this.getScaledBarHeight();

            // background
            alt1.overLayLine(
                a1lib.mixColor(50, 50, 50),
                scaledBarHeight,
                pos.barLeft, pos.barCenterY,
                pos.barRight, pos.barCenterY,
                duration
            );

            // foreground (full bar)
            alt1.overLayLine(
                color,
                scaledBarHeight,
                pos.barLeft, pos.barCenterY,
                pos.barRight, pos.barCenterY,
                duration
            );
        }
    }

    private drawImagesForDebug(images: import("../types").LoadedImage[], pos: OverlayPosition, duration: number): void {
        // reuse the main drawImages method - overlay group is already set by caller
        this.drawImages(images, pos, duration);
    }

    clearDebugPreview(): void {
        alt1.overLayClearGroup(OVERLAY_GROUPS.DEBUG);
    }
}
