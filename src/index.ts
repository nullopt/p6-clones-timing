import "./style.css";

// static file imports for webpack
import "./index.html";
import "./appconfig.json";

import { P6ClonesTimingPlugin } from "./classes";

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener("DOMContentLoaded", () => {
    new P6ClonesTimingPlugin();
});
