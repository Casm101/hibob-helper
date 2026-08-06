# Inline controls (the floating buttons)

Besides the popup, the extension draws its own small control bar directly on the HiBob attendance page, so you can start a run without opening the popup at all.

Code: `buildInlineUi` in `src/content/index.ts`. The bar is plain DOM and CSS injected by the content script — no React here.

## What you see

A pill floating at the bottom-center of the page with three buttons:

| Button | What it does |
| --- | --- |
| **Automate Entries** | Starts a run using your **stored** times and settings (the same ones the popup saves). |
| **🎲** | Toggles the [random time offsets](random-offsets.md) feature on or off. |
| **☕** | Toggles the [break splitting](break-splitting.md) feature on or off. |

Each button shows a small tooltip after hovering for a third of a second. The toggle buttons show their state by turning dark (light mode) or pink (dark mode). The whole bar follows your system's light/dark theme.

While a run is active, the buttons are replaced by a progress card — a bar, a `completed/total` counter, a "Saved X of Y rows" line — and a red **Cancel** button.

## When the bar is visible

The content script loads on every `app.hibob.com` page, but the bar only shows itself on the attendance page (`/attendance/my-attendance`). HiBob is a single-page app, so normal navigation does not reload the page; the script watches for URL changes three ways:

- the `popstate` event (browser back/forward),
- the `hashchange` event,
- a 500 ms polling interval as a catch-all, because HiBob's own route changes bypass the first two.

On every URL change it shows or hides the bar to match. The bar (and its polling) exists on all HiBob pages, just hidden outside attendance.

## How a run starts from here

Unlike the popup, the inline bar lives *inside* the content script, so it skips the whole message relay and calls the automation directly:

1. Read the stored times and settings from `chrome.storage.sync`.
2. If a stored time is invalid, log a warning to the browser console and reset the bar. **Nothing visible tells you why the run did not start** — see [Known issues](../known-issues.md#silent-failure-when-starting-from-the-inline-button).
3. Otherwise switch to the running state and call the same `startAutomation` function the message handler uses. The run's progress callback updates the inline progress card directly.
4. When the run ends (finished or cancelled), the bar resets to idle. Per-row results are not displayed here — only the popup shows the "rows need attention" list.

The engine allows only one run at a time. If a run is already active (started from either place), a second start is answered with an "Automation already running." error.

## How the toggles work

The 🎲 and ☕ buttons flip `randomizeEnabled` / `breakEnabled` in storage, keeping all other settings as they are — with one quirk: if the stored randomize window is `0`, toggling rewrites it to the default `15` minutes.

The bar also listens to `chrome.storage.onChanged`, so flipping a toggle in the popup's settings view updates the on-page buttons instantly, and the other way round.
