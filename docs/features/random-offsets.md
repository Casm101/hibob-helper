# Random time offsets

An optional feature that nudges your clock-in and clock-out by a few random minutes, so a month of automated entries does not read as a perfectly identical 09:00–17:00 every single day.

## What it does

With the feature on and a window of, say, 15 minutes, each day gets one random offset between −15 and +15 minutes, and **both** times shift by that same amount:

| Day | Offset | Entry written |
| --- | --- | --- |
| Monday | +7 | 09:07 – 17:07 |
| Tuesday | −12 | 08:48 – 16:48 |
| Wednesday | 0 | 09:00 – 17:00 |

Because both ends move together, the length of the workday stays exactly the same — only its position shifts.

## Where to control it

- **Popup → settings view**: the "Randomise clock in/out" toggle and the "Randomization window (minutes)" number.
- **On the page**: the 🎲 button toggles it on/off (using the stored window value).

The setting is stored in `chrome.storage.sync`, so both places always agree. Default: off, with a 15-minute window.

## How it works

Code: `getRandomOffset` and `applyOffset` in `src/content/time.ts`, used by `resolveTimes` in `src/content/steps.ts`.

1. When a row is about to be processed, `resolveTimes` asks for one offset: a random whole number of minutes from 0 up to the window size, then a random sign (+ or −).
2. `applyOffset` converts each time to minutes-since-midnight, adds the offset, and converts back.
3. The result is clamped to the day: nothing goes below `00:00` or above `23:59`.

A fresh offset is drawn **per row**, so every day in a run gets a different shift.

The random source is injectable (it defaults to `Math.random`), which is how the unit tests in `src/content/time.test.ts` and `src/content/steps.test.ts` pin down exact expected values.

## Things to be aware of

- **Midnight clamping**: for shifts that start or end very close to midnight, the clamp can swallow part of the offset — then only one end moves and the day's length changes. An extreme case: clock-in `00:05` with offset −15 becomes `00:00`. Details in [Known issues](../known-issues.md#midnight-clamping-distorts-edge-case-shifts).
- **No upper limit**: the popup accepts any window size (there is no maximum), so a large number like 480 gives offsets of up to ±8 hours. The field's spinner stops at 0 on the low end, but typing is free.
- **Break interaction**: with [break splitting](break-splitting.md) on, the offset moves clock-in and the final clock-out, but the break itself stays at its configured time.
- The offset is drawn in the browser with `Math.random` — good enough for variety, but the values are not cryptographically random, and a fixed window (always ±15) is itself a recognizable pattern.
