# Known issues, bugs and weak points

Everything questionable found during a deep review of the codebase (version 1.2.0, August 2026). Grouped into three levels:

- **Bugs** — confirmed wrong behavior you can trigger today.
- **Weak points** — things that work now but are fragile, misleading, or fail badly in edge cases.
- **Design limitations** — deliberate trade-offs and boundaries worth knowing about.

Each entry says where the problem lives and what would fix it.

---

## Bugs

### Empty break start slips through the popup path

**Where:** `resolveTimes` in `src/content/steps.ts`, `handleRun` in `src/popup/App.tsx`.

If you enable the break but clear the "Break start" field, the popup happily starts a run — the Run button only validates the main clock-in/out times. The engine's fallback `options.breakStart ?? '12:00'` does not catch an empty string (`''` is not null/undefined, so `??` keeps it). Verified result: the first entry becomes `09:00 → 00:00` (an empty time parses as midnight) and the second `00:30 → 17:30`.

Runs started from the inline button are safe, because the storage reader replaces an empty break start with the default.

**Fix:** treat a blank break start as invalid in `canRun`, and/or change the fallback to also catch empty strings (`options.breakStart?.trim() ? ... : '12:00'`).

### The break window is never validated

**Where:** `resolveTimes` in `src/content/steps.ts`.

Nothing checks that the break falls inside the workday. A break start of 18:00 on a 09:00–17:00 day produces a first entry of `09:00 → 18:00` and a second of `18:30 → 17:30` — an entry that ends before it starts. Verified by test. HiBob will likely reject it, turning the row into a slow `save-timeout` failure.

**Fix:** validate `clockIn < breakStart` and `breakStart + duration < clockOut` before running, and refuse or fall back to a single entry otherwise.

### A success toast is assumed on any "attendance" text

**Where:** `waitForSaveCompletion` in `src/content/steps.ts`.

After clicking Save, the engine treats the save as confirmed if *any* toast/alert on the page matches `/updated|saved|attendance/i`. An **error** toast such as "Attendance entry overlaps an existing entry" also matches — the row would be reported as `saved` even though HiBob rejected it. The later badge check (`verifyRowCleared`) would notice the warning badge is still there, but it only logs a console warning and does not change the result.

**Fix:** exclude toasts containing error words (error, failed, invalid, overlap…), or better, key success off the side panel closing only.

### Rows without a `row-id` can never be processed

**Where:** `getTableRows` / `getWarningRowIds` in `src/content/steps.ts`.

`getTableRows` has fallbacks for non-ag-grid markup (`table tbody tr`, generic `[role="row"]`). But `getWarningRowIds` then keeps only rows that have a `row-id` attribute — which those fallback rows don't have. So if HiBob ever moved away from ag-grid, the fallbacks would *find* the rows and then silently drop every one of them: total = 0, "nothing to do". The fallback paths are effectively dead code that gives false confidence.

**Fix:** either remove the fallbacks or give fallback rows a synthetic id (e.g. their index) and a matching lookup path.

### The "add" button match is too loose

**Where:** `findAddEntryButton` in `src/content/steps.ts` and `findButtonByText` in `src/content/dom.ts`.

When no known selector matches, the engine falls back to clicking the first visible button in the panel whose text or aria-label *contains* "add entry" or just "add". Substring matching means a button labeled "Address", "Add filter" or "Advanced" ("add" is inside "**Add**ress" and "adv" is not, but "add filter" is) can be clicked instead. It is scoped to the side panel, which limits the blast radius, but the wrong click can put the panel in an unexpected state.

**Fix:** match whole words, prefer exact matches first, and drop the bare "add" alias.

---

## Weak points

### Warning detection can false-positive

**Where:** `isWarningRow` in `src/content/steps.ts`, `hasRedIndicator` in `src/content/dom.ts`.

A row counts as "needs fixing" if it contains anything matching a broad selector list (`.error`, `.alert`, attributes containing "warning"…) **or** any element whose text is exactly `!` or `1`, **or** any element colored red-ish. A cell legitimately displaying the number 1, a red "rejected" label, or a red holiday highlight all qualify. When that happens the automation opens the row's panel — and because it writes into the *first existing entry*, it can overwrite times that were already recorded there (see next item).

**Fix:** tighten the heuristics (drop the bare `1` text check, require the indicator inside the alert-icons cell), and log which rule matched to aid debugging.

### Existing entries are overwritten, not completed

**Where:** `ensureEntry` / `fillTimes` in `src/content/steps.ts`.

If the panel already contains an entry — for example, a day where you clocked in for real but forgot to clock out — the engine does not fill just the missing part. It writes your default clock-in **and** clock-out into that first entry, replacing the genuine clock-in you recorded. There is no "only fill empty inputs" mode.

**Fix:** check each input's current value and only write into empty ones (or make that a setting).

### Progress total is a snapshot

**Where:** `runAutomation` in `src/content/automation.ts`.

The `total` is counted once at the start, but ag-grid creates row DOM lazily while the engine scrolls, so new flagged rows join the queue mid-run. `completed` then overshoots `total` — the popup can read "7/5". The bars clamp at 100% so it is cosmetic, but the numbers are untrustworthy on long lists.

**Fix:** recompute the total as `processedRowIds.size + pending.length` on every progress tick.

### Runs longer than a few minutes can outlive their messengers

**Where:** the popup → background → content relay (`src/background/index.ts`).

The final result travels back through a `sendResponse` callback held open for the whole run. A run over many rows takes minutes; Manifest V3 service workers can be shut down by Chrome, and the popup dies the moment you click away from it. In either case the run itself continues on the page (the content script is untouched), but the result has nowhere to go: the popup shows an error or simply shows a fresh idle state when reopened. Per-row results from that run are lost — only the on-page card shows anything, and only for inline-started runs.

**Fix:** persist the last run's result in `chrome.storage.session` from the content script, and have the popup read it on open instead of relying on a live callback.

### Silent failure when starting from the inline button

**Where:** `startInlineAutomation` in `src/content/index.ts`.

If the stored times are invalid, the inline run quits with only a console warning. To the user, the button flashes and nothing happens — no visible message says "fix your times in the popup".

**Fix:** show the reason in the inline card for a few seconds.

### Every keystroke is a storage write

**Where:** the save effects in `src/popup/App.tsx`, writers in `src/shared/storage.ts`.

The popup writes to `chrome.storage.sync` on each change of each field. Chrome's sync quota is ~120 writes/minute; enthusiastic editing (or the spinner arrows held down) can hit it. None of the `chrome.storage.sync.set` callbacks check `chrome.runtime.lastError`, so a rejected write is silently ignored — the UI shows a value that was never saved.

**Fix:** debounce writes (e.g. 500 ms) and log/report `lastError`.

### The English language is load-bearing

**Where:** `findTimePickerInputs`, `waitForSidebar`, `hasMissingTimeErrors` in `src/content/steps.ts`.

The clock-in/clock-out inputs are found by their **visible label text** ("Clock in", "Clock out"). That is the primary and only path — with HiBob set to any other interface language, every row fails with `inputs-not-found`. Panel detection ("entries", "add entry", "clock in") and validation detection ("missing clock in") also match English text.

**Fix:** prefer structural selectors (input order inside `b-timepicker` blocks) with the label text as fallback, or maintain a small translation table.

### A saved row is trusted even when its badge stays red

**Where:** `verifyRowCleared` in `src/content/steps.ts`.

After a confirmed save, the engine waits up to 8 seconds for the row's warning badge to disappear. If it never does, it logs a warning and **still reports the row as saved**. Combined with the [toast false positive](#a-success-toast-is-assumed-on-any-attendance-text), a rejected save can be presented as a success.

**Fix:** report a distinct outcome (e.g. `saved-unverified`) so the popup can flag it.

### The 50-row cap is silent

**Where:** `maxRowIterations` in `src/content/timing.ts`.

A run stops after 50 rows without saying it hit a limit. With a very backlogged attendance page, the result reads like a finished run. Re-running continues where it left off, but nothing tells you to.

**Fix:** report "stopped at the safety cap, N rows remain" in the result.

### Midnight clamping distorts edge-case shifts

**Where:** `toMinutes` / `fromMinutes` in `src/content/time.ts`.

All time math clamps to `00:00`–`23:59`. Near the edges this changes shift lengths: a −15 offset on a 00:05 clock-in becomes 00:00 (only −5 applied to one end), and break splitting near midnight can produce a second entry that starts and ends at 23:59. Overnight shifts (clock-out past midnight) are not representable at all.

**Fix:** validate that offsets/breaks fit the day before applying, and skip the feature for that row otherwise.

### Toggling 🎲 resurrects a zero window

**Where:** the inline toggle handlers in `src/content/index.ts` (`current.randomizeMinutes || 15`).

If you deliberately set the randomize window to 0 in the popup, using the on-page 🎲 toggle rewrites it to 15. Small, but it overrides an explicit user choice.

**Fix:** use `?? 15` semantics only for missing values, not falsy ones.

### Constant background polling on every HiBob tab

**Where:** `observeLocation` in `src/content/index.ts`.

The URL poll (every 500 ms, forever) and the injected style/DOM run on *all* `app.hibob.com` pages, not just attendance. Cost is tiny but it is permanent background work in every HiBob tab, and during automation waits a document-wide MutationObserver (with attribute observation on some waits) adds more churn on a page that mutates a lot.

**Fix:** hook `history.pushState`/`replaceState` instead of polling, and narrow observer scopes further.

---

## Design limitations

These are choices, not defects — but you should know them.

- **The whole extension is one HiBob update away from breaking.** Everything rests on HiBob's current DOM: ag-grid class names, the `b-timepicker` element, `.btmpckr-*` input classes, `.save-btn-side-panel`. That is inherent to UI automation. The mitigation is that all selectors live in one file (`src/content/selectors.ts`) with layered fallbacks, and typed failure reasons make breakage diagnosable from the popup.
- **Active tab only.** The background worker targets the active tab of the current window. You cannot run the automation in a background tab or another window, and switching tabs mid-run does not move it (the run keeps going in its own tab — but see the messenger-lifetime weak point above for what happens to the report).
- **One run at a time**, enforced by a simple flag inside one tab's content script. Two different HiBob tabs could each run their own automation; nothing coordinates across tabs.
- **Synthetic input events.** Values are set programmatically with `input`/`change`/`blur` events, not real key presses. HiBob's current form code accepts this; stricter input masking (keydown-based) would not be fooled.
- **Chrome only.** Manifest V3 with `chrome.*` APIs and `chrome.scripting`. Firefox/Safari would need an adaptation layer.
- **The tests stop at the DOM's edge.** Unit tests cover the time math and selector resolution against fixtures. Clicking, scrolling, saving, messaging, and the popup are only verified manually — a regression there will not fail CI.
- **The extension records your configured defaults, not your actual hours.** With the randomizer, it writes times that deliberately *look* organic. Whether automated attendance entries are acceptable is between you and your employer's policies; the tool does not check that what it writes is true. Treat the entries it creates as your own statements.
