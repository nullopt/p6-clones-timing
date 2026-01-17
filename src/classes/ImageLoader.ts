import * as a1lib from "alt1/base";
import type { LoadedImage } from "../types";
import { IMAGE_SIZE } from "../constants";

// ============================================================================
// IMAGE LOADER
// ============================================================================

export class ImageLoader {
    private images: Map<string, LoadedImage> = new Map();
    private loadPromises: Promise<void>[] = [];

    constructor(private targetSize: number = IMAGE_SIZE) { }

    loadAll(config: Record<string, string>, onLog: (msg: string) => void): void {
        for (const [key, url] of Object.entries(config)) {
            const promise = this.loadImage(url, key, onLog);
            this.loadPromises.push(promise);
        }
    }

    private loadImage(url: string, key: string, onLog: (msg: string) => void): Promise<void> {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                // use uniform size for all images
                canvas.width = this.targetSize;
                canvas.height = this.targetSize;
                const ctx = canvas.getContext("2d");
                if (ctx) {
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = "high";
                    // scale image to fit within target size while maintaining aspect ratio
                    const scale = Math.min(this.targetSize / img.width, this.targetSize / img.height);
                    const scaledWidth = img.width * scale;
                    const scaledHeight = img.height * scale;
                    // center the image in the canvas
                    const offsetX = (this.targetSize - scaledWidth) / 2;
                    const offsetY = (this.targetSize - scaledHeight) / 2;
                    ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);
                    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    this.images.set(key, {
                        str: a1lib.encodeImageString(data),
                        width: this.targetSize,
                        height: this.targetSize
                    });
                    onLog(`Loaded ${key}: ${this.targetSize}x${this.targetSize}`);
                }
                resolve();
            };
            img.onerror = () => resolve();
            img.src = url;
        });
    }

    get(key: string): LoadedImage | undefined {
        return this.images.get(key);
    }

    getMultiple(keys: string[]): LoadedImage[] {
        return keys.map(k => this.get(k)).filter((img): img is LoadedImage => !!img);
    }
}
