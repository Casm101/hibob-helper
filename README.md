# HiBob Helper Chrome Extension

Automates missing attendance entries on the HiBob “My attendance” page. The popup collects clock-in/clock-out times and triggers a content script that fills every row marked with a red warning indicator.

## Setup

```bash
npm install
```

## Configure the target URL

This extension is locked to a single target URL. Update both locations before building:

- `src/shared/config.ts` → `TARGET_URL`
- `public/manifest.json` → `host_permissions` and `content_scripts.matches`

Use the exact URL or URL prefix that matches your HiBob attendance page.

## Build

```bash
npm run build
```

The extension output will be in `dist/`.

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `dist` folder.

## Usage

1. Navigate to the HiBob attendance page (the exact target URL you configured).
2. Click the extension icon.
3. Enter “Clock In Time” and “Clock Out Time”.
4. Click **Run Automation**.

The script will open each flagged row, click **Add entry**, fill the times, and save.

## Notes

- Watch the DevTools console on the HiBob page for detailed logs.
- If the UI structure changes, adjust selectors in `src/content/automation.ts`.
