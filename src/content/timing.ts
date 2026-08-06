// Centralized timing configuration for the automation engine.
//
// All timeouts, poll intervals, settle delays and loop caps live here so their
// intent is visible and tuning is a single-file edit. Values match the
// originals that were previously inlined across automation.ts / dom.ts.

export const TIMING = {
  /** Default wait budget for waitForCondition when no timeout is passed. */
  defaultWaitTimeoutMs: 15000,
  /** Fallback poll interval backing the MutationObserver. */
  pollIntervalMs: 200,
  /** Max time to wait for a save to confirm (sidebar closes or toast shows). */
  saveCompletionTimeoutMs: 20000,
  /** Max time to wait for the add-entry button to appear. */
  addEntryTimeoutMs: 15000,
  /** Max time to wait for a time-entry's inputs to render. */
  entryInputsTimeoutMs: 8000,
  /** Max time to wait for the "missing clock in/out" validation to clear. */
  timeValidationTimeoutMs: 4000,
  /** Max time to wait for a row's warning badge to clear after saving. */
  badgeClearTimeoutMs: 8000,
  /** Settle delay after scrolling a row into view before clicking it. */
  postScrollSettleMs: 250,
  /** Settle delay after finishing a row before starting the next. */
  interRowSettleMs: 400,
  /** Safety cap on the number of rows processed in one run. */
  maxRowIterations: 50,
  /** Max attempts per row (initial + retries) for transient, pre-save failures. */
  maxRowAttempts: 2,
} as const

/** Minutes in a day minus one (23:59), used to clamp time math. */
export const MINUTES_IN_DAY = 1439
