# Settings and storage

Where your times and preferences live, and how the popup and the on-page buttons stay in sync.

## What is stored

Everything is kept in `chrome.storage.sync`, which means Chrome syncs it across your signed-in browsers automatically. Code: `src/shared/storage.ts`.

| Key | Default | Set from | Meaning |
| --- | --- | --- | --- |
| `hibobHelperClockIn` | `09:00` | Popup main view | Default clock-in time. |
| `hibobHelperClockOut` | `17:00` | Popup main view | Default clock-out time. |
| `hibobHelperRandomizeEnabled` | `false` | Popup settings / 🎲 button | Random offsets on/off. |
| `hibobHelperRandomizeMinutes` | `15` | Popup settings | Size of the random window, in minutes. |
| `hibobHelperBreakEnabled` | `false` | Popup settings / ☕ button | Break splitting on/off. |
| `hibobHelperBreakStart` | `12:00` | Popup settings | When the break starts. |
| `hibobHelperBreakDurationMinutes` | `30` | Popup settings | How long the break lasts. |

Nothing else is stored, and nothing is ever sent outside the browser.

## Who reads what

There are two paths from settings to a run, and they are subtly different:

- **Runs started from the popup** send the popup's *live field values* inside the `RUN_AUTOMATION` message. Storage is bypassed for that run (though the same values were also just saved to storage by the auto-save effect).
- **Runs started from the inline button** read from *storage* at click time.

This matters because the storage reader sanitizes values (see below) but the popup path does not — which is how an empty break-start field can reach the engine unsanitized. See [Known issues](../known-issues.md#empty-break-start-slips-through-the-popup-path).

## Sanitization on read

`getStoredSettings` never trusts what it reads. For each value it:

- accepts booleans as-is, otherwise coerces truthiness;
- parses numbers from strings when needed, falling back to the default if the result is not a finite number;
- replaces an empty or non-string break start with the default `12:00`.

So even corrupted or hand-edited storage produces a usable settings object.

## When writes happen

The popup saves on **every change** — each keystroke in a number field, each toggle flip — through two React effects in `src/popup/App.tsx`. Guard flags make sure the initial load from storage does not immediately write the defaults back over your data.

The inline 🎲 / ☕ buttons write the full settings object with the one flag flipped. Quirk: if the stored randomize window is `0`, the toggle rewrites it to `15`.

Chrome enforces quotas on `storage.sync` (roughly 120 writes per minute). None of the write calls check for errors, so hitting the quota fails silently. See [Known issues](../known-issues.md#every-keystroke-is-a-storage-write).

## How the two UIs stay in sync

- The popup reads storage once, when it opens.
- The inline bar reads storage when it is built, and also subscribes to `chrome.storage.onChanged`: whenever any of the setting keys changes — from the popup, from another tab, even from another synced computer — it re-reads and repaints its toggle buttons.

One gap: the sync is one-directional in practice. The popup does **not** listen for changes, so if you keep it open while flipping the on-page 🎲 button, the popup's settings view will show stale values until reopened.
