import * as a1lib from "alt1/base";
import ChatBoxReader from "alt1/chatbox";
import "./style.css";

// static file imports for webpack
import "./index.html";
import "./appconfig.json";

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
// TYPES
// ============================================================================

type CombatStyle = "magic" | "necro";

interface PluginSettings {
    useTicks: boolean;
    showImage: boolean;
    showProgressBar: boolean;
    debugMode: boolean;
    combatStyle: CombatStyle;
}

interface LoadedImage {
    str: string;
    width: number;
    height: number;
}

interface TimerStep {
    imageKeys: string[];
    durationMs: number;
}

interface OverlayPosition {
    centerX: number;
    centerY: number;
    barLeft: number;
    barRight: number;
    barCenterY: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CLONE_TRIGGERS = ["SUBJUGATED", "MORTAL!"];
const SETTINGS_STORAGE_KEY = "p6clones-settings";

// timing
const TICK_MS = 600;
const PROGRESS_REFRESH_RATE = 50;

// overlay styling
const BAR_WIDTH = 120;
const BAR_HEIGHT = 8;
const BAR_Y_OFFSET = 50;
const TEXT_FONT_SIZE = 40;
const IMAGE_GAP = 20;
const MULTI_IMAGE_GAP = 8;
const FINAL_MESSAGE_DURATION = 1500;

const NAME_RGB = [69, 131, 145];
const TEXT_RGB = [153, 255, 153];
const WHITE_RGB = [255, 255, 255];
const PUB_BLUE = [127, 169, 255];

// image configuration
const IMAGE_SIZE = 64; // uniform size for all images (width and height)
const IMAGE_CONFIG: Record<string, string> = {
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

// timer sequences - easy to modify or add new combat styles
const TIMER_SEQUENCES: Record<CombatStyle, TimerStep[]> = {
    magic: [
        { imageKeys: ["magic"], durationMs: 6000 },
        { imageKeys: ["omni"], durationMs: 1800 },
        { imageKeys: ["nami"], durationMs: 1800 },
    ],
    necro: [
        { imageKeys: ["invoke"], durationMs: 2400 },
        { imageKeys: ["threads"], durationMs: 1800 },
        { imageKeys: ["bloat"], durationMs: 1800 },
        { imageKeys: ["volley"], durationMs: 1800 },
        { imageKeys: ["t90", "eof"], durationMs: 1800 },
    ]
};

const DEFAULT_SETTINGS: PluginSettings = {
    useTicks: false,
    showImage: true,
    showProgressBar: true,
    debugMode: false,
    combatStyle: "magic"
};

// ============================================================================
// OVERLAY GROUPS
// ============================================================================

const OVERLAY_GROUPS = {
    TEXT: "clonetimer-text",
    BAR: "clonetimer-bar",
    FINAL: "clonetimer-final"
} as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getProgressColor(progress: number): number {
    if (progress > 0.5) return a1lib.mixColor(0, 255, 0);  // green
    if (progress > 0.2) return a1lib.mixColor(255, 255, 0); // yellow
    return a1lib.mixColor(255, 0, 0);  // red
}

function formatTime(ms: number, useTicks: boolean): string {
    const seconds = ms / 1000;
    return useTicks ? seconds.toFixed(1) : Math.ceil(seconds).toString();
}

// ============================================================================
// IMAGE LOADER
// ============================================================================

class ImageLoader {
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

// ============================================================================
// OVERLAY RENDERER
// ============================================================================

class OverlayRenderer {
    constructor(
        private imageLoader: ImageLoader,
        private settings: () => PluginSettings
    ) { }

    getPosition(): OverlayPosition {
        const centerX = Math.floor(alt1.rsWidth / 2) + alt1.rsX;
        const centerY = Math.floor(alt1.rsHeight / 5) + alt1.rsY;
        const barY = centerY + BAR_Y_OFFSET;

        return {
            centerX,
            centerY,
            barLeft: Math.round(centerX - BAR_WIDTH / 2),
            barRight: Math.round(centerX - BAR_WIDTH / 2) + BAR_WIDTH,
            barCenterY: barY + Math.round(BAR_HEIGHT / 2)
        };
    }

    drawImages(images: LoadedImage[], pos: OverlayPosition, duration: number): void {
        if (!this.settings().showImage || images.length === 0) return;

        if (images.length === 1) {
            const img = images[0];
            alt1.overLayImage(
                Math.round(pos.centerX - img.width / 2),
                Math.round(pos.centerY - img.height - IMAGE_GAP),
                img.str,
                Math.round(img.width),
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
                    Math.round(pos.centerY - img.height - IMAGE_GAP),
                    img.str,
                    Math.round(img.width),
                    duration
                );
                xPos += img.width + MULTI_IMAGE_GAP;
            }
        }
    }

    drawText(text: string, color: number, pos: OverlayPosition, duration: number): void {
        const yPos = this.settings().showImage ? pos.centerY + IMAGE_GAP : pos.centerY;
        alt1.overLayTextEx(
            text,
            color,
            TEXT_FONT_SIZE,
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

        // background
        alt1.overLayLine(
            a1lib.mixColor(50, 50, 50),
            BAR_HEIGHT,
            pos.barLeft, pos.barCenterY,
            pos.barRight, pos.barCenterY,
            duration
        );

        // foreground
        const filledWidth = Math.round(BAR_WIDTH * progress);
        if (filledWidth > 0) {
            alt1.overLayLine(
                color,
                BAR_HEIGHT,
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

        const yPos = this.settings().showImage ? pos.centerY + IMAGE_GAP : pos.centerY;
        alt1.overLayTextEx(
            "NOW!",
            a1lib.mixColor(255, 0, 0),
            TEXT_FONT_SIZE + 10,
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
}

// ============================================================================
// TIMER CONTROLLER
// ============================================================================

class TimerController {
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
        const startTime = Date.now();
        const textRefreshRate = this.settings().useTicks ? TICK_MS : 1000;

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

// ============================================================================
// SETTINGS MANAGER
// ============================================================================

class SettingsManager {
    private settings: PluginSettings = { ...DEFAULT_SETTINGS };

    constructor(private elements: {
        useTicks: HTMLInputElement | null;
        showImage: HTMLInputElement | null;
        showProgressBar: HTMLInputElement | null;
        debugMode: HTMLInputElement | null;
        combatStyle: NodeListOf<HTMLInputElement> | null;
        output: HTMLElement | null;
    }) { }

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
        const { useTicks, showImage, showProgressBar, debugMode, combatStyle, output } = this.elements;

        if (useTicks) useTicks.checked = this.settings.useTicks;
        if (showImage) showImage.checked = this.settings.showImage;
        if (showProgressBar) showProgressBar.checked = this.settings.showProgressBar;
        if (debugMode) debugMode.checked = this.settings.debugMode;

        combatStyle?.forEach(radio => {
            radio.checked = radio.value === this.settings.combatStyle;
        });

        output?.classList.toggle("hidden", !this.settings.debugMode);
    }

    setupListeners(onLog: (msg: string) => void): void {
        const { useTicks, showImage, showProgressBar, debugMode, combatStyle } = this.elements;

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

        debugMode?.addEventListener("change", () => {
            this.update("debugMode", debugMode.checked);
        });

        combatStyle?.forEach(radio => {
            radio.addEventListener("change", () => {
                this.update("combatStyle", radio.value as CombatStyle);
                onLog(`Combat style: ${radio.value}`);
            });
        });
    }
}

// ============================================================================
// MAIN PLUGIN CLASS
// ============================================================================

class P6ClonesTimingPlugin {
    private chatReader: ChatBoxReader;
    private chatInterval: number | null = null;
    private lastChatLines: string[] = [];
    private findAttempts = 0;

    private imageLoader: ImageLoader;
    private settings: SettingsManager;
    private renderer: OverlayRenderer;
    private timer: TimerController;

    private statusElement: HTMLElement | null;
    private outputElement: HTMLElement | null;

    constructor() {
        // initialize alt1
        a1lib.identifyApp("./appconfig.json");

        // get DOM elements
        this.statusElement = document.getElementById("alt1-status");
        this.outputElement = document.getElementById("output");

        // initialize components
        this.imageLoader = new ImageLoader();
        this.settings = new SettingsManager({
            useTicks: document.getElementById("use-ticks") as HTMLInputElement,
            showImage: document.getElementById("show-image") as HTMLInputElement,
            showProgressBar: document.getElementById("show-progress-bar") as HTMLInputElement,
            debugMode: document.getElementById("debug-mode") as HTMLInputElement,
            combatStyle: document.querySelectorAll("input[name=\"combat-style\"]"),
            output: this.outputElement
        });
        this.renderer = new OverlayRenderer(this.imageLoader, () => this.settings.current);
        this.timer = new TimerController(
            this.renderer,
            this.imageLoader,
            () => this.settings.current,
            () => this.log("⏱️ Timer sequence complete!")
        );
        this.chatReader = new ChatBoxReader();

        // add NPC dialogue colors to the reader
        this.chatReader.readargs.colors.push(
            a1lib.mixColor(NAME_RGB[0], NAME_RGB[1], NAME_RGB[2]),   // NPC name cyan
            a1lib.mixColor(TEXT_RGB[0], TEXT_RGB[1], TEXT_RGB[2]),   // NPC text green
            a1lib.mixColor(WHITE_RGB[0], WHITE_RGB[1], WHITE_RGB[2]), // white text
            a1lib.mixColor(PUB_BLUE[0], PUB_BLUE[1], PUB_BLUE[2])    // public chat blue
        );

        this.init();
    }

    private init(): void {
        this.settings.load();
        this.settings.setupListeners((msg) => this.log(msg));
        this.imageLoader.loadAll(IMAGE_CONFIG, (msg) => this.log(msg));
        this.checkAlt1Status();
        this.log("Plugin initialized");

        if (a1lib.hasAlt1) {
            this.startChatReading();
        }
    }

    private checkAlt1Status(): void {
        if (!this.statusElement) return;

        if (a1lib.hasAlt1) {
            this.statusElement.textContent = "✓ Alt1 detected - Ready";
            this.statusElement.className = "connected";

            if (!alt1.permissionPixel) {
                this.log("Requesting screen capture permission...");
                alt1.identifyAppUrl("./appconfig.json");
            }
        } else {
            this.statusElement.textContent = "⚠ Alt1 not detected - Running in browser mode";
            this.statusElement.className = "disconnected";
            this.log("Running in browser mode.");
        }
    }

    private startChatReading(): void {
        this.log("Starting chatbox reader...");
        this.log(`RS Linked: ${alt1.rsLinked}, Permission: ${alt1.permissionPixel}`);

        this.chatInterval = window.setInterval(() => {
            this.readChatbox();
        }, TICK_MS);
    }

    private readChatbox(): void {
        if (!a1lib.hasAlt1 || !alt1.permissionPixel) return;

        if (!alt1.rsLinked) {
            if (this.findAttempts % 10 === 0) {
                this.log("Waiting for RuneScape to be linked...");
            }
            this.findAttempts++;
            return;
        }

        try {
            const img = a1lib.captureHoldFullRs();
            if (!img) {
                if (this.findAttempts % 10 === 0) {
                    this.log("Failed to capture screen");
                }
                this.findAttempts++;
                return;
            }

            if (!this.chatReader.pos) {
                this.findChatbox(img);
                return;
            }

            this.processChatLines(img);
        } catch (error) {
            console.error("Error reading chatbox:", error);
        }
    }

    private findChatbox(img: a1lib.ImgRefBind): void {
        if (this.findAttempts % 5 === 0) {
            this.log(`Searching for chatbox... (attempt ${this.findAttempts + 1})`);
        }

        this.chatReader.find(img);

        if (this.chatReader.pos) {
            this.log("Chatbox found!");
            const mainbox = (this.chatReader.pos as any).mainbox;
            if (mainbox?.rect) {
                const { x, y, width, height } = mainbox.rect;
                this.log(`Chatbox at: x=${x}, y=${y}, w=${width}, h=${height}`);
                alt1.overLayRect(a1lib.mixColor(0, 255, 0), x, y, width, height, 2000, 2);
            }
        } else {
            this.findAttempts++;
        }
    }

    private processChatLines(img: a1lib.ImgRefBind): void {
        const chatLines = this.chatReader.read(img);
        if (!chatLines?.length) return;

        const newLines: string[] = [];

        for (const line of chatLines) {
            if (line.fragments.length === 0) continue;

            // filter out undefined/null fragment text before joining
            const text = line.fragments
                .map(f => f.text ?? "")
                .filter(t => t.length > 0)
                .join("");

            // debug: log raw fragment data if we have fragments but no text
            if (!text.trim() && this.settings.current.debugMode) {
                const fragmentDebug = line.fragments.map(f => ({
                    text: f.text,
                    color: f.color
                }));
                console.log("[Chat Debug] Empty text from fragments:", JSON.stringify(fragmentDebug));
            }

            if (!text.trim()) continue;

            if (!this.lastChatLines.includes(text)) {
                console.log("[Chat]", text);
                this.log(`[Chat] ${text}`);
                newLines.push(text);

                this.lastChatLines.push(text);
                if (this.lastChatLines.length > 50) {
                    this.lastChatLines.shift();
                }
            }
        }

        // check new lines for any trigger (only fire once)
        if (newLines.length > 0) {
            const triggered = newLines.some(line =>
                CLONE_TRIGGERS.some(trigger => line.toUpperCase().includes(trigger))
            );
            if (triggered) {
                this.log("⚔️ CLONE TRIGGER DETECTED!");
                this.startTimer();
            }
        }
    }

    private startTimer(): void {
        if (this.timer.active) {
            this.log("Timer already active, resetting...");
        }

        const sequence = TIMER_SEQUENCES[this.settings.current.combatStyle];
        this.timer.start(sequence);
    }

    private log(message: string): void {
        console.log(`[P6ClonesTimingPlugin] ${message}`);

        if (this.settings.current.debugMode && this.outputElement) {
            const timestamp = new Date().toLocaleTimeString();
            const entry = document.createElement("div");
            entry.textContent = `[${timestamp}] ${message}`;

            this.outputElement.appendChild(entry);
            this.outputElement.scrollTop = this.outputElement.scrollHeight;

            while (this.outputElement.children.length > 50) {
                this.outputElement.removeChild(this.outputElement.firstChild!);
            }
        }
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener("DOMContentLoaded", () => {
    new P6ClonesTimingPlugin();
});
