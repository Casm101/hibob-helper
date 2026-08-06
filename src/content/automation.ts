import type { RowResult, RowResultStatus } from '../shared/messaging'
import { TIMING } from './timing'
import {
  createRowContext,
  ensureEntry,
  extractRowLabel,
  fillTimes,
  findRowById,
  getWarningRowIds,
  isWarningRow,
  openSidebar,
  resolveTimes,
  RowError,
  saveEntry,
  verifyRowCleared,
  type AutomationOptions,
} from './steps'

const LOG_PREFIX = '[HiBob Helper]'

const isCancelled = (error: unknown) =>
  error instanceof Error && error.message === 'Cancelled'

type RowOutcome =
  | { cancelled: true }
  | { cancelled?: false; status: RowResultStatus; reason?: string }

/**
 * Run the per-row pipeline with a bounded retry. Only pre-save (retryable)
 * failures are retried; a save that may already have submitted is never
 * retried, to avoid duplicate entries. The row is re-resolved before each
 * attempt because ag-grid virtualization recycles row nodes.
 */
const processRow = async (
  rowId: string,
  rowLabel: string,
  clockIn: string,
  clockOut: string,
  shouldCancel: () => boolean,
  options: AutomationOptions
): Promise<RowOutcome> => {
  const times = resolveTimes(clockIn, clockOut, options)
  let lastReason: string | undefined

  for (let attempt = 1; attempt <= TIMING.maxRowAttempts; attempt += 1) {
    if (shouldCancel()) return { cancelled: true }

    const row = findRowById(rowId)
    if (!row) return { status: 'skipped', reason: 'row-not-found' }
    if (!isWarningRow(row)) return { status: 'skipped', reason: 'no-warning' }

    const ctx = createRowContext(rowId, rowLabel, row, times, shouldCancel)

    try {
      await openSidebar(ctx)
      await ensureEntry(ctx)
      await fillTimes(ctx)
      await saveEntry(ctx)
      await verifyRowCleared(ctx)
      return { status: 'saved' }
    } catch (error) {
      if (isCancelled(error) || shouldCancel()) return { cancelled: true }

      if (error instanceof RowError) {
        lastReason = error.reason
        console.warn(`${LOG_PREFIX} ${error.message} (attempt ${attempt}/${TIMING.maxRowAttempts})`)
        if (!error.retryable) return { status: 'failed', reason: error.reason }
        // Retryable: fall through to the next attempt.
      } else {
        console.error(`${LOG_PREFIX} Unexpected error on ${rowLabel}.`, error)
        return { status: 'failed', reason: 'unknown' }
      }
    }
  }

  return { status: 'failed', reason: lastReason ?? 'unknown' }
}

export const runAutomation = async (
  clockIn: string,
  clockOut: string,
  requestId: string,
  shouldCancel: () => boolean,
  onProgress?: (progress: { total: number; completed: number; saved: number }) => void,
  options?: AutomationOptions
) => {
  const sendProgress = (completed: number, total: number, saved: number) => {
    chrome.runtime.sendMessage({
      type: 'AUTOMATION_PROGRESS',
      requestId,
      total,
      completed,
      saved,
    })
    onProgress?.({ total, completed, saved })
  }

  const processedRowIds = new Set<string>()
  const results: RowResult[] = []
  let processed = 0
  let iterations = 0
  const total = getWarningRowIds().length
  let completed = 0

  sendProgress(completed, total, processed)

  while (iterations < TIMING.maxRowIterations) {
    if (shouldCancel()) {
      console.info(`${LOG_PREFIX} Cancellation requested. Stopping.`)
      return { processed, cancelled: true, results }
    }

    const pendingRowIds = getWarningRowIds().filter((rowId) => !processedRowIds.has(rowId))
    if (pendingRowIds.length === 0) break

    console.info(`${LOG_PREFIX} Pending warning row(s): ${pendingRowIds.length}.`)

    const rowId = pendingRowIds[0]
    processedRowIds.add(rowId)
    iterations += 1
    completed += 1
    sendProgress(completed, total, processed)

    const row = findRowById(rowId)
    if (!row) {
      console.warn(`${LOG_PREFIX} Row not found for id ${rowId}. Skipping.`)
      results.push({ rowId, label: rowId, status: 'skipped', reason: 'row-not-found' })
      continue
    }

    // A row that no longer has a warning was likely handled elsewhere; skip
    // quietly without recording, matching the previous behavior.
    if (!isWarningRow(row)) {
      console.info(`${LOG_PREFIX} Row ${rowId} no longer has a warning. Skipping.`)
      continue
    }

    const rowLabel = extractRowLabel(row)
    const outcome = await processRow(rowId, rowLabel, clockIn, clockOut, shouldCancel, options ?? {})

    if (outcome.cancelled) {
      console.info(`${LOG_PREFIX} Cancellation requested. Stopping.`)
      return { processed, cancelled: true, results }
    }

    if (outcome.status === 'saved') {
      processed += 1
      sendProgress(completed, total, processed)
      console.info(`${LOG_PREFIX} Updated ${rowLabel}.`)
    }

    results.push({ rowId, label: rowLabel, status: outcome.status, reason: outcome.reason })
  }

  return { processed, cancelled: false, results }
}
