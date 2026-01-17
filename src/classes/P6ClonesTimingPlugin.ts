import * as a1lib from "alt1/base";
import ChatBoxReader from "alt1/chatbox";
import {
    CLONE_TRIGGERS,
    IMAGE_CONFIG,
    NAME_RGB,
    PUB_BLUE,
    TEXT_RGB,
    TICK_MS,
    TIMER_SEQUENCES,
    WHITE_RGB
} from "../constants";
import { ImageLoader } from "./ImageLoader";
import { OverlayRenderer } from "./OverlayRenderer";
import { SettingsManager } from "./SettingsManager";
import { TimerController } from "./TimerController";

// ============================================================================
// MAIN PLUGIN CLASS
// ============================================================================

export class P6ClonesTimingPlugin {
    private chatReader: ChatBoxReader;
    private chatInterval: number | null = null;
    private lastChatLines: string[] = [];
    private findAttempts = 0;
    private slidersUpdated = false;
    private previewShowing = false;

    private imageLoader: ImageLoader;
    private settings: SettingsManager;
    private renderer: OverlayRenderer;
    private timer: TimerController;

    private outputElement: HTMLElement | null;

    constructor() {
        // initialize alt1
        a1lib.identifyApp("./appconfig.json");

        // get DOM elements
        this.outputElement = document.getElementById("output");

        // initialize components
        this.imageLoader = new ImageLoader();
        this.settings = new SettingsManager({
            useTicks: document.getElementById("use-ticks") as HTMLInputElement,
            showImage: document.getElementById("show-image") as HTMLInputElement,
            showProgressBar: document.getElementById("show-progress-bar") as HTMLInputElement,
            compensateForPing: document.getElementById("compensate-ping") as HTMLInputElement,
            debugMode: document.getElementById("debug-mode") as HTMLInputElement,
            combatStyle: document.querySelectorAll("input[name=\"combat-style\"]"),
            overlayOffsetX: document.getElementById("overlay-offset-x") as HTMLInputElement,
            overlayOffsetY: document.getElementById("overlay-offset-y") as HTMLInputElement,
            overlayScale: document.getElementById("overlay-scale") as HTMLInputElement,
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
        this.settings.setupListeners(
            (msg) => this.log(msg),
            () => this.onOverlaySettingsChange()
        );
        this.imageLoader.loadAll(IMAGE_CONFIG, (msg) => this.log(msg));
        this.checkAlt1Status();
        this.setupDebugButton();

        // try to initialize overlay settings immediately if RS is already linked
        // (will be retried in readChatbox if not ready yet)
        this.initializeOverlaySettings();

        this.hideLoadingOverlay();
        this.log("Plugin initialized");

        if (a1lib.hasAlt1) {
            this.startChatReading();
        }
    }

    private hideLoadingOverlay(): void {
        const overlay = document.getElementById("loading-overlay");
        if (overlay) {
            overlay.classList.add("hidden");
        }
    }

    private setupDebugButton(): void {
        const button = document.getElementById("show-overlay-position");
        if (!button) return;

        button.addEventListener("click", () => {
            if (!a1lib.hasAlt1) {
                this.log("Cannot show overlay position - Alt1 not detected");
                return;
            }

            if (!alt1.rsLinked) {
                this.log("Cannot show overlay position - RuneScape not linked");
                return;
            }

            this.previewShowing = !this.previewShowing;

            if (this.previewShowing) {
                this.log(`Showing overlay position at RS: ${alt1.rsWidth}x${alt1.rsHeight}`);
                this.renderer.drawDebugPreview();
                button.textContent = "Hide Overlay Position";
                button.classList.add("active");
            } else {
                this.log("Hiding overlay position");
                this.renderer.clearDebugPreview();
                button.textContent = "Show Overlay Position";
                button.classList.remove("active");
            }
        });
    }

    private onOverlaySettingsChange(): void {
        // live update the preview if it's currently showing
        if (this.previewShowing && a1lib.hasAlt1 && alt1.rsLinked) {
            this.renderer.drawDebugPreview();
        }
    }

    private checkAlt1Status(): void {
        if (a1lib.hasAlt1) {
            if (!alt1.permissionPixel) {
                this.log("Requesting screen capture permission...");
                alt1.identifyAppUrl("./appconfig.json");
            }
        } else {
            this.log("Running in browser mode.");
        }
    }

    private initializeOverlaySettings(): void {
        if (this.slidersUpdated || !alt1.rsWidth || !alt1.rsHeight) return;

        this.settings.updateSliderMaxValues(alt1.rsWidth, alt1.rsHeight);

        const centerX = Math.floor(alt1.rsWidth / 2);
        const centerY = Math.floor(alt1.rsHeight / 5);
        this.settings.initializeDefaultPosition(centerX, centerY);

        this.log(`Overlay settings initialized: screen=${alt1.rsWidth}x${alt1.rsHeight}, center=${centerX},${centerY}`);
        this.slidersUpdated = true;
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

        this.initializeOverlaySettings();

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

        const settings = this.settings.current;
        const sequence = TIMER_SEQUENCES[settings.combatStyle];

        if (settings.compensateForPing && typeof alt1 !== "undefined" && alt1.rsPing > 0) {
            this.log(`Starting timer with ping compensation: -${alt1.rsPing}ms`);
        }

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
