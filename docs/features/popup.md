# Popup

The popup is the small window that opens when you click the extension icon in Chrome's toolbar. It is a React app (`src/popup/App.tsx`) with two views: the main view and a settings view, switched with the gear / back button in the top-right corner.

## Main view

### Time fields

Two native time inputs ("Clock In Time", "Clock Out Time", `src/popup/components/TimeField.tsx`). Every change is validated against the 24-hour `HH:MM` format (`src/shared/validation.ts`) and saved to storage immediately — there is no Save button. The next run, and the on-page controls, use whatever is stored.

### The Run button

"Run Automation" is enabled only when all three are true:

1. The active tab is on `https://app.hibob.com/attendance/my-attendance` (checked once when the popup opens).
2. Both times are valid.
3. No run is currently in progress.

If the tab is wrong, a red notice says which page to open. If a time is invalid, an amber notice asks for `HH:MM`.

Pressing Run generates a unique request id, sends a `RUN_AUTOMATION` message (via the background worker — see [Architecture](../architecture.md)), and switches the status to "Running automation...". A Cancel button appears next to Run while it works.

### Progress

While running, the popup shows a progress bar fed by `AUTOMATION_PROGRESS` messages coming straight from the content script. Messages are matched against the current request id, so a run started from the on-page buttons does not move the popup's bar. The bar shows `completed/total` and a "Saved X of Y rows" line. See [Progress and cancellation](progress-and-cancellation.md).

### Status pill

A colored message box reflects the last known state:

| State | Color | Example message |
| --- | --- | --- |
| idle | grey | "Ready to fill missing attendance rows." |
| running | amber | "Running automation..." |
| success | green | "Automation complete. Updated 3 rows." |
| error | red | "Automation complete. Updated 2 rows. 1 failed." — or a transport error |
| cancelled | grey | "Automation cancelled. Updated 1 row." |

A finished run counts as an **error** (red) if any row failed, even when others saved fine.

### "Rows need attention"

If any rows failed or were skipped, a collapsible list appears under the status pill. Each line shows the row's label (usually its date) and a plain-English reason, translated from the engine's reason codes:

| Code | Shown as |
| --- | --- |
| `row-not-found` | Row disappeared |
| `no-warning` | No longer missing |
| `sidebar-timeout` | Panel didn't open |
| `no-entry` | Entry didn't appear |
| `inputs-not-found` | Time inputs missing |
| `save-not-found` | Save button missing |
| `save-timeout` | Save didn't confirm |
| `unknown` | Unexpected error |

## Settings view

Two option cards, both saved to storage on every change:

1. **Randomise clock in/out** — a toggle plus a "randomization window" number in minutes. See [Random time offsets](random-offsets.md).
2. **Enable break time** — a toggle plus a break start time and a break duration in minutes. See [Break splitting](break-splitting.md).

The number and time fields are disabled (greyed out) while their toggle is off, but keep their values.

Note: the Run button does **not** check the break fields — only the main clock-in/out times gate it. An empty break start with the break toggle on produces broken entries. See [Known issues](../known-issues.md#empty-break-start-slips-through-the-popup-path).

## How settings load and save

On open, the popup reads times and settings from `chrome.storage.sync` and fills its fields. Two `useEffect` hooks then write every subsequent change back to storage. Two guard flags (`hasLoadedTimes`, `hasLoadedSettings`) stop the initial load itself from triggering a write of the defaults over your stored values.

Because writes happen on every change, quickly editing fields produces many storage writes in a row; Chrome limits how many sync writes are allowed per minute. See [Known issues](../known-issues.md#every-keystroke-is-a-storage-write).
