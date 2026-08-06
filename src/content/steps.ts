import {
  clickElement,
  commitInputValue,
  findButtonByText,
  hasRedIndicator,
  isElementVisible,
  sleep,
  waitForCondition,
} from './dom'
import { SELECTORS } from './selectors'
import { TIMING } from './timing'
import { addMinutes, applyOffset, getRandomOffset, parseTime } from './time'

const LOG_PREFIX = '[HiBob Helper]'

// Heuristic selectors for the red warning badge in the attendance table.
const warningSelectors = SELECTORS.warning.join(',')

const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim()

const isCancelled = (error: unknown) =>
  error instanceof Error && error.message === 'Cancelled'

// ---------------------------------------------------------------------------
// Typed step failures (Task 8)
// ---------------------------------------------------------------------------

export type RowFailureReason =
  | 'row-not-found'
  | 'no-warning'
  | 'sidebar-timeout'
  | 'no-entry'
  | 'inputs-not-found'
  | 'save-not-found'
  | 'save-timeout'
  | 'unknown'

/** A recoverable, categorized per-row failure thrown by the step functions. */
export class RowError extends Error {
  reason: RowFailureReason
  retryable: boolean

  constructor(reason: RowFailureReason, message: string, retryable: boolean) {
    super(message)
    this.name = 'RowError'
    this.reason = reason
    this.retryable = retryable
  }
}

// ---------------------------------------------------------------------------
// DOM resolution helpers (moved verbatim from automation.ts; logic unchanged)
// ---------------------------------------------------------------------------

const isDataRow = (row: Element) => {
  if (!(row instanceof HTMLElement)) return false
  if (row.classList.contains('row-summary') || row.classList.contains('is-summary')) return false
  return !!row.querySelector(SELECTORS.grid.gridCell)
}

const getTableRows = () => {
  const pinnedRows = Array.from(
    document.querySelectorAll(`${SELECTORS.grid.pinnedRowContainer} ${SELECTORS.grid.row}`)
  ).filter(isDataRow)
  if (pinnedRows.length) return pinnedRows

  const rows = Array.from(document.querySelectorAll('table tbody tr'))
  if (rows.length) return rows

  return Array.from(document.querySelectorAll('[role="row"]')).filter((row) => {
    return row.querySelector(SELECTORS.grid.gridCell)
  })
}

export const extractRowLabel = (row: Element) => {
  const dateCell = row.querySelector(SELECTORS.grid.dateCell)
  const dateText = dateCell?.textContent?.trim()
  if (dateText) return dateText

  const cells = Array.from(row.querySelectorAll(`td, ${SELECTORS.grid.gridCell}`))
  const texts = cells
    .map((cell) => cell.textContent?.trim() ?? '')
    .filter(Boolean)
    .filter((text) => text !== '1' && text !== '!')

  return texts[0] ?? row.textContent?.trim() ?? ''
}

export const isWarningRow = (row: Element) => {
  if (row.querySelector(warningSelectors)) return true
  return hasRedIndicator(row)
}

export const getWarningRowIds = () => {
  return getTableRows()
    .filter(isWarningRow)
    .map((row) => row.getAttribute('row-id'))
    .filter((rowId): rowId is string => Boolean(rowId))
}

export const findRowById = (rowId: string) => {
  return (
    document.querySelector<HTMLElement>(
      `${SELECTORS.grid.pinnedRowContainer} [role="row"][row-id="${CSS.escape(rowId)}"]`
    ) ??
    document.querySelector<HTMLElement>(
      `${SELECTORS.grid.centerRowContainer} [role="row"][row-id="${CSS.escape(rowId)}"]`
    )
  )
}

const getClickTarget = (row: Element) => {
  const rowId = row.getAttribute('row-id')
  if (rowId) {
    const centerRow = document.querySelector<HTMLElement>(
      `${SELECTORS.grid.centerRowContainer} [role="row"][row-id="${CSS.escape(rowId)}"]`
    )
    if (centerRow) return centerRow
  }
  return row as HTMLElement
}

// Sidebar has inconsistent markup; scan common containers and pick a visible one.
export const findSidebar = () => {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(SELECTORS.sidebar.containers.join(','))
  )

  return candidates.find((candidate) => isElementVisible(candidate)) ?? null
}

const waitForSidebar = async (
  rowLabel: string,
  previousSnapshot: string,
  shouldCancel: () => boolean
) => {
  const normalizedLabel = normalize(rowLabel)
  const normalizedPrevious = normalize(previousSnapshot)
  return waitForCondition(
    () => {
      const sidebar = findSidebar()
      if (!sidebar) return false
      if (!normalizedLabel) return sidebar
      const sidebarText = normalize(sidebar.textContent ?? '')
      if (sidebarText.includes(normalizedLabel)) return sidebar
      if (
        normalizedPrevious &&
        sidebarText &&
        sidebarText !== normalizedPrevious &&
        (sidebarText.includes('entries') ||
          sidebarText.includes('add entry') ||
          sidebarText.includes('clock in'))
      ) {
        return sidebar
      }
      if (!normalizedPrevious && sidebarText) return sidebar
      return false
    },
    { shouldCancel }
  )
}

const findAddEntryButton = (sidebar: HTMLElement) => {
  for (const selector of SELECTORS.sidebar.addEntry) {
    const match = sidebar.querySelector<HTMLElement>(selector)
    if (match) return match
  }
  return findButtonByText(sidebar, ['add entry', 'add'])
}

const findSidePanelAddEntryButton = (sidebar: HTMLElement) => {
  for (const selector of SELECTORS.sidebar.sidePanelAddEntry) {
    const match = sidebar.querySelector<HTMLElement>(selector)
    if (match) return match
  }
  return findButtonByText(sidebar, ['add entry'])
}

const findTimePickerInputs = (container: ParentNode, labelText: string) => {
  const normalizedLabel = normalize(labelText)
  const labels = Array.from(container.querySelectorAll('label'))

  const resolveInputs = (root: ParentNode | null) => {
    if (!root) return null
    const hours = root.querySelector<HTMLInputElement>(SELECTORS.timepicker.hoursInput)
    const minutes = root.querySelector<HTMLInputElement>(SELECTORS.timepicker.minutesInput)
    if (hours && minutes) return { hours, minutes }
    return null
  }

  for (const label of labels) {
    const labelValue = normalize(label.textContent ?? '')
    if (!labelValue.includes(normalizedLabel)) continue

    const htmlFor = label.getAttribute('for')
    if (htmlFor) {
      const forTarget = container.querySelector(`#${CSS.escape(htmlFor)}`)
      const inputs = resolveInputs(forTarget)
      if (inputs) return inputs
    }

    const timepickerRoot =
      label.closest(SELECTORS.timepicker.root) ??
      label.parentElement?.closest(SELECTORS.timepicker.root) ??
      label.parentElement
    const inputs = resolveInputs(timepickerRoot)
    if (inputs) return inputs
  }

  const timePickers = Array.from(container.querySelectorAll(SELECTORS.timepicker.root))
  for (const picker of timePickers) {
    const label = picker.querySelector('label')
    const labelValue = normalize(label?.textContent ?? '')
    if (!labelValue.includes(normalizedLabel)) continue
    const inputs = resolveInputs(picker)
    if (inputs) return inputs
  }

  return null
}

export const getEntryBlocks = (container: ParentNode) => {
  const [primary, fallback] = SELECTORS.sidebar.entryBlocks
  const entries = Array.from(container.querySelectorAll<HTMLElement>(primary))
  if (entries.length) return entries
  return Array.from(container.querySelectorAll<HTMLElement>(fallback))
}

type TimeInputs = { hours: HTMLInputElement; minutes: HTMLInputElement }
export type EntryInputs = { clockIn: TimeInputs; clockOut: TimeInputs }

export const getEntryInputs = (entry: ParentNode): EntryInputs | null => {
  const clockIn = findTimePickerInputs(entry, 'Clock in')
  const clockOut = findTimePickerInputs(entry, 'Clock out')
  if (!clockIn || !clockOut) return null
  return { clockIn, clockOut }
}

const hasMissingTimeErrors = (root: ParentNode) => {
  const text = normalize((root as HTMLElement).textContent ?? '')
  return text.includes('missing clock in') || text.includes('missing clock out')
}

const waitForSaveCompletion = async (sidebar: HTMLElement, shouldCancel: () => boolean) => {
  const successToast = () => {
    const toastCandidates = Array.from(document.querySelectorAll<HTMLElement>(SELECTORS.toast))
    return toastCandidates.some((toast) => /updated|saved|attendance/i.test(toast.textContent ?? ''))
  }

  try {
    await waitForCondition(
      () => !document.body.contains(sidebar) || !isElementVisible(sidebar) || successToast(),
      { timeout: TIMING.saveCompletionTimeoutMs, shouldCancel }
    )
    return true
  } catch {
    console.warn(`${LOG_PREFIX} Save completion timed out. Continuing...`)
    return false
  }
}

// ---------------------------------------------------------------------------
// Pure time resolution (Task 4 boundary) — testable without a DOM
// ---------------------------------------------------------------------------

export type EntryTime = { clockIn: string; clockOut: string }
export type ResolvedTimes = { first: EntryTime; second?: EntryTime }

export type AutomationOptions = {
  randomizeEnabled?: boolean
  randomizeMinutes?: number
  breakEnabled?: boolean
  breakStart?: string
  breakDurationMinutes?: number
}

/**
 * Turn raw clock-in/out + options into the concrete time value(s) to write.
 * When a break is enabled this yields two entries (before/after break) with the
 * final clock-out pushed later by the break duration — matching the original
 * inline behavior. `random` is injectable for deterministic tests.
 */
export const resolveTimes = (
  clockIn: string,
  clockOut: string,
  options: AutomationOptions,
  random: () => number = Math.random
): ResolvedTimes => {
  const offset = options.randomizeEnabled ? getRandomOffset(options.randomizeMinutes ?? 0, random) : 0
  const clockInValue = applyOffset(clockIn, offset)
  const clockOutValue = applyOffset(clockOut, offset)

  if (options.breakEnabled) {
    const breakStart = options.breakStart ?? '12:00'
    const duration = Math.max(0, options.breakDurationMinutes ?? 0)
    return {
      first: { clockIn: clockInValue, clockOut: breakStart },
      second: {
        clockIn: addMinutes(breakStart, duration),
        clockOut: addMinutes(clockOutValue, duration),
      },
    }
  }

  return { first: { clockIn: clockInValue, clockOut: clockOutValue } }
}

// ---------------------------------------------------------------------------
// Per-row pipeline (Task 6). Each step mutates the shared RowContext and throws
// a RowError on failure.
// ---------------------------------------------------------------------------

export type RowContext = {
  rowId: string
  rowLabel: string
  row: HTMLElement
  times: ResolvedTimes
  shouldCancel: () => boolean
  sidebarRoot: HTMLElement | null
  entries: HTMLElement[]
}

export const createRowContext = (
  rowId: string,
  rowLabel: string,
  row: HTMLElement,
  times: ResolvedTimes,
  shouldCancel: () => boolean
): RowContext => ({
  rowId,
  rowLabel,
  row,
  times,
  shouldCancel,
  sidebarRoot: null,
  entries: [],
})

const waitForEntries = (root: HTMLElement, count: number, shouldCancel: () => boolean) =>
  waitForCondition(
    () => {
      const entries = getEntryBlocks(root)
      return entries.length >= count ? entries : null
    },
    { root, shouldCancel, observeAttributes: false }
  )

const writeEntry = (inputs: EntryInputs, time: EntryTime) => {
  const inParts = parseTime(time.clockIn)
  const outParts = parseTime(time.clockOut)
  commitInputValue(inputs.clockIn.hours, inParts.hours)
  commitInputValue(inputs.clockIn.minutes, inParts.minutes)
  commitInputValue(inputs.clockOut.hours, outParts.hours)
  commitInputValue(inputs.clockOut.minutes, outParts.minutes)
}

export const openSidebar = async (ctx: RowContext) => {
  const previousSnapshot = findSidebar()?.textContent ?? ''
  ctx.row.scrollIntoView({ block: 'center', behavior: 'smooth' })
  await sleep(TIMING.postScrollSettleMs)

  clickElement(getClickTarget(ctx.row))

  let sidebar: HTMLElement
  try {
    sidebar = await waitForSidebar(ctx.rowLabel, previousSnapshot, ctx.shouldCancel)
  } catch (error) {
    if (isCancelled(error)) throw error
    throw new RowError('sidebar-timeout', `Sidebar did not open for ${ctx.rowLabel}.`, true)
  }
  ctx.sidebarRoot = sidebar.closest<HTMLElement>(SELECTORS.sidebar.root) ?? sidebar
}

export const ensureEntry = async (ctx: RowContext) => {
  const root = ctx.sidebarRoot as HTMLElement

  let entries = getEntryBlocks(root)
  if (entries.length === 0) {
    let addEntryButton: HTMLElement
    try {
      addEntryButton = await waitForCondition(() => findAddEntryButton(root), {
        root,
        timeout: TIMING.addEntryTimeoutMs,
        shouldCancel: ctx.shouldCancel,
        observeAttributes: false,
      })
    } catch (error) {
      if (isCancelled(error)) throw error
      throw new RowError('no-entry', `Add-entry button not found for ${ctx.rowLabel}.`, true)
    }
    clickElement(addEntryButton)
    try {
      entries = await waitForEntries(root, 1, ctx.shouldCancel)
    } catch (error) {
      if (isCancelled(error)) throw error
      throw new RowError('no-entry', `Entry did not appear for ${ctx.rowLabel}.`, true)
    }
  }
  ctx.entries = entries
}

export const fillTimes = async (ctx: RowContext) => {
  const root = ctx.sidebarRoot as HTMLElement
  const firstEntry = ctx.entries[0]

  let firstInputs = getEntryInputs(firstEntry)
  if (!firstInputs) {
    try {
      firstInputs = await waitForCondition(() => getEntryInputs(firstEntry), {
        root: firstEntry,
        timeout: TIMING.entryInputsTimeoutMs,
        shouldCancel: ctx.shouldCancel,
        observeAttributes: false,
      })
    } catch (error) {
      if (isCancelled(error)) throw error
      throw new RowError('inputs-not-found', `Time inputs not found for ${ctx.rowLabel}.`, true)
    }
  }

  writeEntry(firstInputs, ctx.times.first)

  if (ctx.times.second) {
    let addButton: HTMLElement
    try {
      addButton = await waitForCondition(() => findSidePanelAddEntryButton(root), {
        root,
        timeout: TIMING.entryInputsTimeoutMs,
        shouldCancel: ctx.shouldCancel,
        observeAttributes: false,
      })
    } catch (error) {
      if (isCancelled(error)) throw error
      throw new RowError('no-entry', `Break add-entry button not found for ${ctx.rowLabel}.`, true)
    }
    clickElement(addButton)

    let updatedEntries: HTMLElement[]
    try {
      updatedEntries = await waitForEntries(root, 2, ctx.shouldCancel)
    } catch (error) {
      if (isCancelled(error)) throw error
      throw new RowError('no-entry', `Second entry did not appear for ${ctx.rowLabel}.`, true)
    }

    const secondEntry = updatedEntries[1]
    let secondInputs: EntryInputs
    try {
      secondInputs = await waitForCondition(() => getEntryInputs(secondEntry), {
        root: secondEntry,
        timeout: TIMING.entryInputsTimeoutMs,
        shouldCancel: ctx.shouldCancel,
        observeAttributes: false,
      })
    } catch (error) {
      if (isCancelled(error)) throw error
      throw new RowError('inputs-not-found', `Second entry inputs not found for ${ctx.rowLabel}.`, true)
    }

    writeEntry(secondInputs, ctx.times.second)
  }

  // Best-effort: wait for validation to clear before saving.
  await waitForCondition(() => !hasMissingTimeErrors(root), {
    root,
    timeout: TIMING.timeValidationTimeoutMs,
    shouldCancel: ctx.shouldCancel,
  }).catch((error) => {
    if (isCancelled(error)) throw error
    console.warn(`${LOG_PREFIX} Time validation still showing missing warnings.`)
  })
}

export const saveEntry = async (ctx: RowContext) => {
  const root = ctx.sidebarRoot as HTMLElement

  const saveButton =
    root.querySelector<HTMLElement>(SELECTORS.sidebar.saveButton) ?? findButtonByText(root, ['save'])
  if (!saveButton) {
    // Not yet submitted, safe to retry.
    throw new RowError('save-not-found', `Save button not found for ${ctx.rowLabel}.`, true)
  }

  clickElement(saveButton)

  const saved = await waitForSaveCompletion(root, ctx.shouldCancel)
  if (!saved) {
    // The click may already have submitted — do NOT retry (avoid double entries).
    throw new RowError('save-timeout', `Save did not complete for ${ctx.rowLabel}.`, false)
  }
}

export const verifyRowCleared = async (ctx: RowContext) => {
  await waitForCondition(
    () => {
      const refreshedRow = findRowById(ctx.rowId)
      return refreshedRow ? !isWarningRow(refreshedRow) : true
    },
    { timeout: TIMING.badgeClearTimeoutMs, shouldCancel: ctx.shouldCancel }
  ).catch((error) => {
    if (isCancelled(error)) throw error
    console.warn(`${LOG_PREFIX} Warning badge did not clear for ${ctx.rowLabel}.`)
  })
  await sleep(TIMING.interRowSettleMs)
}
