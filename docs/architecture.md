# Architecture

HiBob Helper is a Chrome extension (Manifest V3) that fills in missing attendance entries on HiBob's "My Attendance" page. This document explains how the pieces fit together.

## The three parts

Like most Chrome extensions, HiBob Helper is split into three programs that run in different places:

1. **The popup** (`src/popup/`) — the small React app that opens when you click the extension icon in the toolbar. This is where you set your default times and press "Run Automation".
2. **The background service worker** (`src/background/index.ts`) — a small script with no visible UI. It acts as a messenger between the popup and the page, because the popup cannot always talk to the page directly.
3. **The content script** (`src/content/`) — a script that Chrome injects into every `app.hibob.com` page. It does the real work: it reads the attendance table, clicks buttons, types times, and saves entries. It also draws the floating buttons at the bottom of the attendance page.

The three parts share a handful of common modules in `src/shared/`:

| Module | Purpose |
| --- | --- |
| `messaging.ts` | Type definitions for every message the parts send each other. |
| `storage.ts` | Reading and writing settings in `chrome.storage.sync`. |
| `config.ts` | The target URL (`https://app.hibob.com/attendance/my-attendance`) and the check for it. |
| `validation.ts` | The `HH:MM` time format check. |

## How a run flows through the system

When you press "Run Automation" in the popup:

```
Popup                     Background worker              Content script (on the page)
  |                             |                              |
  |-- RUN_AUTOMATION ---------->|                              |
  |                             |-- check active tab URL       |
  |                             |-- RUN_AUTOMATION ----------->|
  |                             |                              |-- run the automation loop
  |<------------- AUTOMATION_PROGRESS (repeated, direct) ------|
  |                             |                              |
  |                             |<-- AUTOMATION_RESULT --------|
  |<-- AUTOMATION_RESULT -------|                              |
```

Step by step:

1. The popup sends a `RUN_AUTOMATION` message with your times and options.
2. The background worker checks that the active tab is on the supported HiBob page. If not, it answers with an error and nothing happens.
3. The worker forwards the message to the content script in that tab.
4. If the content script does not answer ("Receiving end does not exist"), the worker injects `contentScript.js` into the tab with `chrome.scripting.executeScript` and tries once more. This covers the case where the extension was installed or updated after the page was already open.
5. The content script runs the automation (see [Attendance automation](features/attendance-automation.md)). While it runs, it sends `AUTOMATION_PROGRESS` messages, which the popup listens for directly.
6. When it finishes, the content script answers with an `AUTOMATION_RESULT` containing the per-row outcome, and the worker relays that back to the popup.

The floating on-page buttons skip this whole chain: they live inside the content script, so they call the automation directly as a function call. See [Inline controls](features/inline-controls.md).

### The double-injection guard

The content script can arrive on a page twice: once automatically via the manifest, and once via the worker's on-demand injection. To avoid running twice, it sets `window.__hibobHelperInjected = true` on first load and does nothing if that flag is already set (`src/content/index.ts`).

## Inside the content script

The content script is split into focused modules:

| Module | Role |
| --- | --- |
| `index.ts` | Entry point. Handles messages, guards against double injection, and builds the floating UI. |
| `automation.ts` | The orchestrator. Loops over the flagged rows and runs the pipeline on each one, with retries. |
| `steps.ts` | The per-row pipeline: open the side panel, make sure an entry exists, fill the times, save, verify. |
| `selectors.ts` | Every CSS selector used to find things in HiBob's page, in one file. When HiBob changes its UI, this is the file to fix. |
| `timing.ts` | Every timeout, delay, and safety cap, in one file. |
| `time.ts` | Pure time math (parsing "09:00", adding minutes, random offsets). No DOM access, fully unit-tested. |
| `dom.ts` | Generic DOM helpers: wait for a condition, click, set an input value, detect red warning colors. |

## The build system

Building the extension is a three-step command (`npm run build`):

1. `tsc -b` — type-checks everything.
2. `vite build` — builds the popup (`popup/index.html` + assets) and the background worker (`background.js`) as ES modules.
3. `vite build --config vite.content.config.ts` — builds the content script separately.

**Why the separate step?** The manifest injects `contentScript.js` as a *classic* script, not a module. Classic scripts cannot use `import` statements. But the content script shares code with the popup (`src/shared/*`), and a normal multi-entry Vite build would split that shared code into separate chunk files and make `contentScript.js` import them — which would break the moment Chrome injects it. The separate single-entry build bundles everything into one self-contained file instead. Do not merge these builds back together.

The final `dist/` folder is what you load as an unpacked extension:

```
dist/
├── manifest.json        (copied from public/)
├── icons/               (copied from public/)
├── background.js        (ES module — the manifest declares "type": "module")
├── contentScript.js     (one self-contained classic script)
├── popup/index.html
└── assets/              (popup JS/CSS, fonts, shared chunks)
```

## Testing

Unit tests run with Vitest in a simulated browser DOM (jsdom):

```sh
npm test
```

What is covered (36 tests):

- `src/content/time.test.ts` — all the time math, including clamping at midnight and the random offset.
- `src/content/steps.test.ts` — row detection, label extraction, entry/input lookup, and time resolution against HTML fixtures.
- `src/content/dom.test.ts` — input lookup by label and the "is this color red?" check.

What is *not* covered: anything that needs a real browser — clicking, scrolling, the save flow, the popup UI, and message passing. Those are verified manually on the live HiBob page. `src/test/setup.ts` adds a small `CSS.escape` polyfill because jsdom lacks it.

## Permissions the extension asks for

From `public/manifest.json`:

| Permission | Why |
| --- | --- |
| `activeTab` | To find the tab the automation should run in. |
| `scripting` | To inject the content script on demand if it is missing. |
| `storage` | To save your times and settings. |
| Host access to `https://app.hibob.com/*` | The content script only loads on HiBob pages. |

The extension sends no data anywhere. Everything it stores stays in your browser profile (and your Chrome sync, if enabled).
