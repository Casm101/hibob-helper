# Progress and cancellation

How the progress bars get their numbers, and what really happens when you press Cancel.

## Progress

### The three counters

Code: `runAutomation` in `src/content/automation.ts`.

| Counter | Meaning |
| --- | --- |
| `total` | How many flagged rows were visible when the run started. Counted **once**, at the start. |
| `completed` | How many rows have been picked up so far (whatever their outcome). |
| `saved` | How many rows were actually saved successfully. |

Every time a row is picked up or saved, the engine emits the three counters:

- as a `chrome.runtime` message (`AUTOMATION_PROGRESS`) — this is what the **popup** listens for, filtering by the request id of the run it started;
- through a direct callback — this is what the **inline progress card** uses for runs started on the page.

### Where you see it

- **Popup**: a bar (percent of `completed/total`), the `completed/total` counter, and "Saved X of Y rows."
- **Inline card**: the same three elements, styled for the page.

Because `total` is a one-time snapshot but ag-grid reveals rows lazily as the page scrolls, rows discovered mid-run make `completed` overshoot `total` — the counter can read "7/5". Both bars clamp at 100% so nothing overflows visually. See [Known issues](../known-issues.md#progress-total-is-a-snapshot).

## Cancellation

### How to cancel

- **Popup**: the Cancel button next to Run sends a `CANCEL_AUTOMATION` message through the background worker to the content script.
- **Inline card**: the red Cancel button sets the flag directly.

Both end up doing the same thing: setting a `cancelRequested` flag inside the content script (`src/content/index.ts`).

### What actually happens

Cancellation is **cooperative** — nothing is killed mid-action. The engine checks the flag:

- at the top of the main loop, before picking up each row;
- at the start of every retry attempt;
- inside every wait: `waitForCondition` (`src/content/dom.ts`) re-checks the flag on each DOM change and every 200 ms, and abandons the wait with a `Cancelled` error the moment it flips.

So after you press Cancel, the run stops within a fraction of a second — but whatever the current row already did stays done. In the worst case the engine had just clicked Save; that save may still go through on HiBob's side even though the run reports the row as not counted.

The cancel message is answered immediately with `success: true, cancelled: true` (or an error if no run was active). The *actual* run then ends on its own and delivers its final result — with `cancelled: true` and everything completed so far — to whoever started it. The popup shows "Automation cancelled. Updated N rows." and keeps the per-row list of anything that failed or was skipped before the cancel.

### One run at a time

A single `running` flag in the content script guards the engine. While it is set, any second start — from the popup or the page — is answered with an "Automation already running." error and changes nothing. The flag and the cancel flag are both cleared when the run ends, whatever way it ends.
