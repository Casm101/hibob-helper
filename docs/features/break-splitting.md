# Break splitting

An optional feature that records each day as **two** entries with a gap between them — a lunch break — instead of one long block.

## What it does

With the break set to start at 12:00 and last 30 minutes, a 09:00–17:00 day is written as:

```
Entry 1:  09:00 – 12:00     (work before the break)
Entry 2:  12:30 – 17:30     (work after the break)
```

Two things to notice:

- The second entry starts when the break ends (break start + duration).
- The final clock-out is pushed **later** by the break duration (17:00 + 30 min = 17:30), so the total time worked stays the same as without a break — the break is added *on top of* the day, not carved out of it.

## Where to control it

- **Popup → settings view**: the "Enable break time" toggle, the "Break start" time, and the "Break duration" in minutes.
- **On the page**: the ☕ button toggles it on/off (using the stored start and duration).

Stored in `chrome.storage.sync`. Default: off, 12:00 start, 30 minutes.

## How it works

Code: `resolveTimes` in `src/content/steps.ts` computes the two time pairs; `fillTimes` in the same file writes them into the page.

1. `resolveTimes` produces a `first` pair (clock-in → break start) and a `second` pair (break end → clock-out + duration). If [random offsets](random-offsets.md) are also on, the offset is applied to clock-in and clock-out before the split; the break itself does not move.
2. `fillTimes` fills the first entry's inputs as usual.
3. It then clicks the side panel's "Add entry" button, waits for a second entry block to appear (up to 8 seconds), and fills that one with the second pair.
4. One Save click at the end saves both entries together.

If the second entry never appears or its inputs cannot be found, the row fails with `no-entry` or `inputs-not-found` and is retried once like any other pre-save failure (see [Attendance automation](attendance-automation.md) — retries).

## Things to be aware of

- **The break window is never validated.** Nothing checks that the break actually falls inside your workday. A break start before clock-in or after clock-out produces upside-down entries (for example first entry 09:00 → 08:00). See [Known issues](../known-issues.md#the-break-window-is-never-validated).
- **An empty break start slips through** when running from the popup, producing a first entry that ends at 00:00. See [Known issues](../known-issues.md#empty-break-start-slips-through-the-popup-path).
- **Late-day clamping**: all times are clamped to 23:59, so shifts ending near midnight get squashed (a 23:30 clock-out with a 60-minute break becomes 23:59, and the second entry may start and end at the same minute).
- The Run button in the popup does not require the break fields to be valid — only the main times gate it.
