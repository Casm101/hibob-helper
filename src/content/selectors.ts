// Centralized DOM selectors for the HiBob attendance SPA.
//
// These track HiBob's live DOM and are the most likely thing to break when
// HiBob ships a UI change. They are grouped by UI region so a single HiBob
// change maps to a single group here. The resolution/heuristic logic that
// consumes these lives in automation.ts / dom.ts — only the raw strings live
// here.

export const SELECTORS = {
  grid: {
    pinnedRowContainer: '.ag-pinned-left-cols-container',
    centerRowContainer: '.ag-center-cols-container',
    row: '[role="row"].ag-row',
    gridCell: '[role="gridcell"]',
    dateCell: '[col-id*="date"] .ag-cell-value',
  },
  // Heuristic, ordered fallback list for the red "missing entry" badge.
  warning: [
    '.alert-icons .b-icon-error',
    '.alert-icons .error-icon',
    '.alert-icons .alert-label',
    '[data-icon-before="error"]',
    '[data-qa*="warning" i]',
    '[data-qa*="alert" i]',
    '[data-qa*="missing" i]',
    '[aria-label*="warning" i]',
    '[aria-label*="missing" i]',
    '[title*="warning" i]',
    '[title*="missing" i]',
    '.warning',
    '.alert',
    '.error',
  ],
  sidebar: {
    // Candidate containers for the entry panel; first visible one wins.
    containers: [
      '.rpp-panel-content',
      'app-attendance-entries-panel',
      'app-attendance-entry-form',
      'aside',
      '[role="dialog"]',
      '[data-qa*="sidebar" i]',
      '[class*="Sidebar"]',
      '[class*="side-panel"]',
      '[class*="sidepanel"]',
    ],
    // Outer root the sidebar is nested within, used to scope waits.
    root: '#attendance-right-panel, [role="complementary"], sidebar',
    entryBlocks: ['app-attendance-entry', '.entry-panel'],
    // Add-entry buttons, ordered fallback (empty-state + populated states).
    addEntry: [
      '#empty-state-action-btn',
      '[data-testid="empty-state-action-btn"]',
      '.add-entry-btn-side-panel button',
      '[data-icon-before="time-add"]',
    ],
    sidePanelAddEntry: [
      '.add-entry-btn-side-panel button',
      '[data-icon-before="time-add"]',
    ],
    saveButton: '.save-btn-side-panel button',
  },
  timepicker: {
    root: 'b-timepicker',
    hoursInput: 'input.btmpckr-input-hours',
    minutesInput: 'input.btmpckr-input-minutes',
  },
  toast: '[role="alert"], [role="status"], .toast, [class*="toast"], [class*="Toast"]',
} as const
