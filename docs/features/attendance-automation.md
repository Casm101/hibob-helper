# Attendance automation

This is the heart of the extension: the engine that finds attendance rows flagged as incomplete and fills them in for you.

## What it does

On HiBob's "My Attendance" page, days with missing entries show a red warning badge. The automation:

1. Finds every flagged row in the table.
2. Opens each row's entry panel, one row at a time.
3. Fills in your saved clock-in and clock-out times (adjusted by the optional [random offset](random-offsets.md) and [break](break-splitting.md) features).
4. Saves the entry and checks the warning badge went away.
5. Reports the outcome of every row back to you: **saved**, **failed**, or **skipped**.

## How it finds flagged rows

Code: `getWarningRowIds` and friends in `src/content/steps.ts`, selectors in `src/content/selectors.ts`.

HiBob's attendance table is built with ag-grid, a JavaScript grid library. Each row carries a unique `row-id` attribute. The engine collects the rows from the grid's pinned-left column container and keeps the ones that look flagged.

A row counts as "flagged" if either check passes:

- **Selector check** — the row contains an element matching a list of warning selectors (error icons, elements whose attributes contain "warning", "alert" or "missing", and legacy `.warning` / `.alert` / `.error` classes).
- **Red indicator check** (`hasRedIndicator` in `src/content/dom.ts`) — the row contains an element whose text is exactly `!` or `1`, or whose color is "red-ish" (red channel above 180, green and blue below 100).

Both checks are heuristics — educated guesses about what HiBob's warning badge looks like. They are deliberately broad so they survive small HiBob changes, but that also means they can occasionally match a row that is not actually missing an entry. See [Known issues](../known-issues.md#warning-detection-can-false-positive).

## The main loop

Code: `runAutomation` in `src/content/automation.ts`.

```
count the flagged rows  →  this becomes the progress "total"
repeat (at most 50 times):
    stop if cancel was requested
    pick the next flagged row not yet tried
    none left?  →  done
    process the row (see pipeline below)
    record the result and report progress
```

Details worth knowing:

- Each row id is only ever tried once per run, even if its warning is still there afterwards.
- The 50-iteration cap (`maxRowIterations` in `src/content/timing.ts`) is a safety net against infinite loops. Runs with more than 50 flagged rows stop silently at 50.
- The list of flagged rows is re-scanned on every pass, so rows that only appear after scrolling (ag-grid creates rows lazily) still get picked up — but they were not part of the original "total", so the progress numbers can drift. See [Known issues](../known-issues.md#progress-total-is-a-snapshot).

## The per-row pipeline

Code: the step functions in `src/content/steps.ts`, called in order by `processRow` in `src/content/automation.ts`.

Every row goes through five steps. Each step waits for the page to react (using a MutationObserver plus a 200 ms poll, wrapped in `waitForCondition` in `src/content/dom.ts`) and throws a typed `RowError` when it gives up.

| Step | What it does | Waits up to | On failure |
| --- | --- | --- | --- |
| 1. `openSidebar` | Scrolls the row into view, clicks it, waits for the entry side panel to open and show this row's date. | 15 s | `sidebar-timeout`, retryable |
| 2. `ensureEntry` | If the panel has no entry block yet, clicks "Add entry" and waits for one to appear. | 15 s | `no-entry`, retryable |
| 3. `fillTimes` | Finds the clock-in and clock-out hour/minute inputs and types the values. With a break enabled, also adds and fills a second entry. Then waits briefly for "missing clock in/out" validation text to clear. | 8 s per lookup | `inputs-not-found` / `no-entry`, retryable |
| 4. `saveEntry` | Clicks Save, then waits for the panel to close or a success toast to appear. | 20 s | `save-not-found` (retryable) or `save-timeout` (**not** retryable) |
| 5. `verifyRowCleared` | Waits for the row's warning badge to disappear, then pauses 400 ms before the next row. | 8 s | logs a warning but still counts the row as saved |

### How the time inputs are found

The panel's time pickers are `b-timepicker` custom elements with separate hour and minute inputs. The engine finds them by their **visible label text**: it looks for a `<label>` containing "Clock in" or "Clock out" and takes the inputs next to it. This means the automation only works when HiBob's interface language is English. See [Known issues](../known-issues.md#the-english-language-is-load-bearing).

### How values are typed

`commitInputValue` in `src/content/dom.ts` does not literally type. It clicks and focuses the input, sets its value through the native value setter (so React/Angular-style frameworks notice the change), and fires `input`, `change`, `blur` and `focusout` events — imitating what a real user's edit produces.

## Retries — and why saves are never retried

Code: `processRow` in `src/content/automation.ts`.

Each row gets up to **2 attempts** (`maxRowAttempts` in `src/content/timing.ts`). Before a retry, the row is looked up again by its `row-id` (ag-grid recycles DOM nodes, so the old reference may be stale) and re-checked for a warning.

Only failures from steps 1–3 are retried. A save that timed out (step 4) is **never retried**, on purpose: the click may already have gone through even though the confirmation never showed, and clicking Save again could create a duplicate entry. The row is reported as failed instead, and you can check it by hand. If the save actually did succeed, the row's warning will be gone on the next run and it will simply be skipped.

## Row outcomes

Every processed row ends in one of three states, reported in the result message (`RowResult` in `src/shared/messaging.ts`) and shown in the popup:

| Status | Reason codes | Meaning |
| --- | --- | --- |
| `saved` | — | The entry was filled and the save was confirmed. |
| `failed` | `sidebar-timeout`, `no-entry`, `inputs-not-found`, `save-not-found`, `save-timeout`, `unknown` | Something went wrong and retries (where allowed) did not help. |
| `skipped` | `row-not-found`, `no-warning` | The row vanished or its warning cleared before it was processed. Nothing was changed. |
