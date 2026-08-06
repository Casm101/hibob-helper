# HiBob Helper — Documentation

Welcome. This folder explains how the HiBob Attendance Helper extension works, feature by feature, in plain English.

**New to the project?** Read [Architecture](architecture.md) first. It explains the three parts of the extension and how they talk to each other. Everything else builds on that.

## Index

### Start here

| Document | What it covers |
| --- | --- |
| [Architecture](architecture.md) | The big picture: the popup, the background worker, the content script, how messages flow between them, how the project is built and tested. |

### Features

| Document | What it covers |
| --- | --- |
| [Attendance automation](features/attendance-automation.md) | The core engine. How the extension finds rows with missing entries, fills them in, saves them, and retries when something goes wrong. |
| [Popup](features/popup.md) | The window that opens when you click the extension icon. Time settings, the Run button, progress, results, and the settings page. |
| [Inline controls](features/inline-controls.md) | The floating buttons that appear at the bottom of the HiBob attendance page. |
| [Random time offsets](features/random-offsets.md) | The optional "🎲" feature that shifts your times by a few random minutes so entries don't all look identical. |
| [Break splitting](features/break-splitting.md) | The optional "☕" feature that splits each day into two entries around a break. |
| [Progress and cancellation](features/progress-and-cancellation.md) | How the progress bar gets its numbers, and what actually happens when you press Cancel. |
| [Settings and storage](features/settings-and-storage.md) | Where your times and preferences are saved, and how the popup and the on-page buttons stay in sync. |

### Health of the project

| Document | What it covers |
| --- | --- |
| [Known issues, bugs and weak points](known-issues.md) | Every confirmed bug, fragile spot, and design limitation found during a deep review of the codebase. Read this before relying on the extension or changing its code. |

## How these docs are written

- Each feature doc answers two questions: **what does it do** (for anyone) and **how does it work** (for developers).
- File paths like `src/content/steps.ts` point to the source code that implements what is being described.
- These docs describe the code as of version 1.2.0 on the `refactor/automation-stability` branch.
