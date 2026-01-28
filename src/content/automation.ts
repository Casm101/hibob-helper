import {
  clickElement,
  commitInputValue,
  findButtonByText,
  hasRedIndicator,
  isElementVisible,
  sleep,
  waitForCondition,
} from './dom'

const LOG_PREFIX = '[HiBob Helper]'

// Heuristic selectors for the red warning badge in the attendance table.
const warningSelectors = [
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
].join(',')

const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim()

const isDataRow = (row: Element) => {
  if (!(row instanceof HTMLElement)) return false
  if (row.classList.contains('row-summary') || row.classList.contains('is-summary')) return false
  return !!row.querySelector('[role="gridcell"]')
}

const getTableRows = () => {
  const pinnedRows = Array.from(
    document.querySelectorAll('.ag-pinned-left-cols-container [role="row"].ag-row')
  ).filter(isDataRow)
  if (pinnedRows.length) return pinnedRows

  const rows = Array.from(document.querySelectorAll('table tbody tr'))
  if (rows.length) return rows

  return Array.from(document.querySelectorAll('[role="row"]')).filter((row) => {
    return row.querySelector('[role="gridcell"]')
  })
}

const extractRowLabel = (row: Element) => {
  const dateCell = row.querySelector('[col-id*="date"] .ag-cell-value')
  const dateText = dateCell?.textContent?.trim()
  if (dateText) return dateText

  const cells = Array.from(row.querySelectorAll('td, [role="gridcell"]'))
  const texts = cells
    .map((cell) => cell.textContent?.trim() ?? '')
    .filter(Boolean)
    .filter((text) => text !== '1' && text !== '!')

  return texts[0] ?? row.textContent?.trim() ?? ''
}

const isWarningRow = (row: Element) => {
  if (row.querySelector(warningSelectors)) return true
  return hasRedIndicator(row)
}

const getWarningRowIds = () => {
  return getTableRows()
    .filter(isWarningRow)
    .map((row) => row.getAttribute('row-id'))
    .filter((rowId): rowId is string => Boolean(rowId))
}

const findRowById = (rowId: string) => {
  return (
    document.querySelector<HTMLElement>(
      `.ag-pinned-left-cols-container [role="row"][row-id="${CSS.escape(rowId)}"]`
    ) ??
    document.querySelector<HTMLElement>(
      `.ag-center-cols-container [role="row"][row-id="${CSS.escape(rowId)}"]`
    )
  )
}

const getClickTarget = (row: Element) => {
  const rowId = row.getAttribute('row-id')
  if (rowId) {
    const centerRow = document.querySelector<HTMLElement>(
      `.ag-center-cols-container [role="row"][row-id="${CSS.escape(rowId)}"]`
    )
    if (centerRow) return centerRow
  }
  return row as HTMLElement
}

// Sidebar has inconsistent markup; scan common containers and pick a visible one.
const findSidebar = () => {
  const selectors = [
    '.rpp-panel-content',
    'app-attendance-entries-panel',
    'app-attendance-entry-form',
    'aside',
    '[role="dialog"]',
    '[data-qa*="sidebar" i]',
    '[class*="Sidebar"]',
    '[class*="side-panel"]',
    '[class*="sidepanel"]',
  ].join(',')

  const candidates = Array.from(document.querySelectorAll<HTMLElement>(selectors))

  return candidates.find((candidate) => isElementVisible(candidate)) ?? null
}

const waitForSidebar = async (rowLabel: string, previousSnapshot: string) => {
  const normalizedLabel = normalize(rowLabel)
  const normalizedPrevious = normalize(previousSnapshot)
  return waitForCondition(() => {
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
  })
}

const waitForEntryForm = async (sidebar: HTMLElement) =>
  waitForCondition(() => {
    const clockIn = findTimePickerInputs(sidebar, 'Clock in')
    const clockOut = findTimePickerInputs(sidebar, 'Clock out')
    if (clockIn && clockOut) return { clockIn, clockOut }
    return null
  }, { root: sidebar })

const findAddEntryButton = (sidebar: HTMLElement) => {
  return (
    sidebar.querySelector<HTMLElement>('#empty-state-action-btn') ??
    sidebar.querySelector<HTMLElement>('[data-testid="empty-state-action-btn"]') ??
    sidebar.querySelector<HTMLElement>('.add-entry-btn-side-panel button') ??
    sidebar.querySelector<HTMLElement>('[data-icon-before="time-add"]') ??
    findButtonByText(sidebar, ['add entry', 'add'])
  )
}

const findTimePickerInputs = (container: ParentNode, labelText: string) => {
  const normalizedLabel = normalize(labelText)
  const labels = Array.from(container.querySelectorAll('label'))

  const resolveInputs = (root: ParentNode | null) => {
    if (!root) return null
    const hours = root.querySelector<HTMLInputElement>('input.btmpckr-input-hours')
    const minutes = root.querySelector<HTMLInputElement>('input.btmpckr-input-minutes')
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
      label.closest('b-timepicker') ??
      label.parentElement?.closest('b-timepicker') ??
      label.parentElement
    const inputs = resolveInputs(timepickerRoot)
    if (inputs) return inputs
  }

  const timePickers = Array.from(container.querySelectorAll('b-timepicker'))
  for (const picker of timePickers) {
    const label = picker.querySelector('label')
    const labelValue = normalize(label?.textContent ?? '')
    if (!labelValue.includes(normalizedLabel)) continue
    const inputs = resolveInputs(picker)
    if (inputs) return inputs
  }

  return null
}

const parseTime = (value: string) => {
  const [hours = '00', minutes = '00'] = value.split(':')
  return {
    hours: hours.padStart(2, '0'),
    minutes: minutes.padStart(2, '0'),
  }
}

const hasMissingTimeErrors = (root: ParentNode) => {
  const text = normalize((root as HTMLElement).textContent ?? '')
  return text.includes('missing clock in') || text.includes('missing clock out')
}

const waitForSaveCompletion = async (sidebar: HTMLElement) => {
  const successToast = () => {
    const toastCandidates = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[role="alert"], [role="status"], .toast, [class*="toast"], [class*="Toast"]'
      )
    )

    return toastCandidates.some((toast) =>
      /updated|saved|attendance/i.test(toast.textContent ?? '')
    )
  }

  try {
    await waitForCondition(
      () => !document.body.contains(sidebar) || !isElementVisible(sidebar) || successToast(),
      { timeout: 20000 }
    )
    return true
  } catch {
    console.warn(`${LOG_PREFIX} Save completion timed out. Continuing...`)
    return false
  }
}

export const runAutomation = async (
  clockIn: string,
  clockOut: string,
  requestId: string
) => {
  const sendProgress = (completed: number, total: number, saved: number) => {
    chrome.runtime.sendMessage({
      type: 'AUTOMATION_PROGRESS',
      requestId,
      total,
      completed,
      saved,
    })
  }

  const processedRowIds = new Set<string>()
  let processed = 0
  let iterations = 0
  const total = getWarningRowIds().length
  let completed = 0

  sendProgress(completed, total, processed)

  while (iterations < 50) {
    const pendingRowIds = getWarningRowIds().filter(
      (rowId) => !processedRowIds.has(rowId)
    )

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
      continue
    }

    if (!isWarningRow(row)) {
      console.info(`${LOG_PREFIX} Row ${rowId} no longer has a warning. Skipping.`)
      continue
    }

    const rowLabel = extractRowLabel(row)

    try {
      const previousSnapshot = findSidebar()?.textContent ?? ''
      row.scrollIntoView({ block: 'center', behavior: 'smooth' })
      await sleep(250)

      const clickable = getClickTarget(row)
      clickElement(clickable)

      const sidebar = await waitForSidebar(rowLabel, previousSnapshot)
      const sidebarRoot =
        sidebar.closest<HTMLElement>(
          '#attendance-right-panel, [role="complementary"], sidebar'
        ) ?? sidebar

      let clockInInput = findTimePickerInputs(sidebarRoot, 'Clock in')
      let clockOutInput = findTimePickerInputs(sidebarRoot, 'Clock out')

      if (!clockInInput || !clockOutInput) {
        const addEntryButton = await waitForCondition(
          () => findAddEntryButton(sidebarRoot),
          { root: sidebarRoot, timeout: 15000 }
        )
        clickElement(addEntryButton)

        const formInputs = await waitForEntryForm(sidebarRoot)
        clockInInput = formInputs.clockIn
        clockOutInput = formInputs.clockOut
      }

      if (!clockInInput || !clockOutInput) {
        console.warn(`${LOG_PREFIX} Time inputs not found for ${rowLabel}.`)
        continue
      }

      const clockInParts = parseTime(clockIn)
      const clockOutParts = parseTime(clockOut)

      commitInputValue(clockInInput.hours, clockInParts.hours)
      commitInputValue(clockInInput.minutes, clockInParts.minutes)
      commitInputValue(clockOutInput.hours, clockOutParts.hours)
      commitInputValue(clockOutInput.minutes, clockOutParts.minutes)

      await waitForCondition(() => !hasMissingTimeErrors(sidebarRoot), {
        root: sidebarRoot,
        timeout: 4000,
      }).catch(() => {
        console.warn(`${LOG_PREFIX} Time validation still showing missing warnings.`)
      })

      const saveButton =
        sidebarRoot.querySelector<HTMLElement>('.save-btn-side-panel button') ??
        findButtonByText(sidebarRoot, ['save'])
      if (!saveButton) {
        console.warn(`${LOG_PREFIX} Save button not found for ${rowLabel}.`)
        continue
      }

      clickElement(saveButton)
      const saved = await waitForSaveCompletion(sidebarRoot)
      if (!saved) {
        console.warn(`${LOG_PREFIX} Save did not complete for ${rowLabel}.`)
        continue
      }

      processed += 1
      sendProgress(completed, total, processed)
      console.info(`${LOG_PREFIX} Updated ${rowLabel}.`)
      await waitForCondition(
        () => {
          const refreshedRow = findRowById(rowId)
          return refreshedRow ? !isWarningRow(refreshedRow) : true
        },
        { timeout: 8000 }
      ).catch(() => {
        console.warn(`${LOG_PREFIX} Warning badge did not clear for ${rowLabel}.`)
      })
      await sleep(400)
    } catch (error) {
      console.error(`${LOG_PREFIX} Failed on row ${rowLabel}.`, error)
    }
  }

  return processed
}
