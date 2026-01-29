import { runAutomation } from './automation'
import type {
  AutomationResultMessage,
  CancelAutomationMessage,
  RunAutomationMessage,
} from '../shared/messaging'

const LOG_PREFIX = '[HiBob Helper]'
let running = false
let cancelRequested = false

const getStoredTimes = () =>
  new Promise<{ clockIn: string; clockOut: string }>((resolve) => {
    chrome.storage.sync.get(
      {
        hibobHelperClockIn: '09:00',
        hibobHelperClockOut: '17:00',
      },
      (result) => {
        const values = result as Record<string, unknown>
        resolve({
          clockIn: (values.hibobHelperClockIn as string) ?? '09:00',
          clockOut: (values.hibobHelperClockOut as string) ?? '17:00',
        })
      }
    )
  })

const getStoredSettings = () =>
  new Promise<{ randomizeEnabled: boolean; randomizeMinutes: number }>((resolve) => {
    chrome.storage.sync.get(
      {
        hibobHelperRandomizeEnabled: false,
        hibobHelperRandomizeMinutes: 15,
      },
      (result) => {
        const values = result as Record<string, unknown>
        const enabled = values.hibobHelperRandomizeEnabled
        const minutes = values.hibobHelperRandomizeMinutes
        const parsedMinutes =
          typeof minutes === 'number' ? minutes : Number.parseInt(String(minutes ?? ''), 10)
        resolve({
          randomizeEnabled: typeof enabled === 'boolean' ? enabled : Boolean(enabled ?? false),
          randomizeMinutes: Number.isFinite(parsedMinutes) ? parsedMinutes : 15,
        })
      }
    )
  })

const isValidTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value)

declare global {
  interface Window {
    __hibobHelperInjected?: boolean
  }
}

if (!window.__hibobHelperInjected) {
  window.__hibobHelperInjected = true

  const startAutomation = async (
    clockIn: string,
    clockOut: string,
    requestId: string,
    onProgress?: (progress: { total: number; completed: number; saved: number }) => void,
    options?: { randomizeEnabled?: boolean; randomizeMinutes?: number }
  ) => {
    if (running) {
      return {
        response: {
          type: 'AUTOMATION_RESULT',
          requestId,
          success: false,
          error: 'Automation already running.',
        } as AutomationResultMessage,
      }
    }

    running = true
    cancelRequested = false

    try {
      const result = await runAutomation(
        clockIn,
        clockOut,
        requestId,
        () => cancelRequested,
        onProgress,
        options
      )

      return {
        response: {
          type: 'AUTOMATION_RESULT',
          requestId,
          success: !result.cancelled,
          processed: result.processed,
          cancelled: result.cancelled,
        } as AutomationResultMessage,
      }
    } catch (error) {
      console.error(`${LOG_PREFIX} Automation failed.`, error)
      return {
        response: {
          type: 'AUTOMATION_RESULT',
          requestId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        } as AutomationResultMessage,
      }
    } finally {
      running = false
      cancelRequested = false
    }
  }

  const requestCancel = () => {
    if (running) cancelRequested = true
  }

  const buildInlineUi = () => {
    if (document.getElementById('hibob-helper-inline')) return

    const style = document.createElement('style')
    style.textContent = `
      #hibob-helper-inline {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 999999;
        font-family: 'Space Grotesk', sans-serif;
      }
      #hibob-helper-inline .hh-shell {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 0;
        border-radius: 16px;
        border: none;
        background: transparent;
        box-shadow: none;
        backdrop-filter: none;
      }
      #hibob-helper-inline[data-state='running'] .hh-shell {
        padding: 10px 12px;
        border: 1px solid rgba(255,255,255,0.6);
        background: linear-gradient(135deg, rgba(255,240,245,0.9), rgba(255,255,255,0.9));
        box-shadow: 0 18px 35px -20px rgba(15, 23, 42, 0.45);
        backdrop-filter: blur(12px);
      }
      @media (prefers-color-scheme: dark) {
        #hibob-helper-inline[data-state='running'] .hh-shell {
          border-color: rgba(255,255,255,0.1);
          background: linear-gradient(135deg, rgba(15,15,18,0.9), rgba(26,26,32,0.9));
          color: #f8fafc;
        }
      }
      #hibob-helper-inline .hh-action {
        border: none;
        background: #0f172a;
        color: #fff;
        padding: 8px 14px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }
      #hibob-helper-inline .hh-action:hover { transform: translateY(-1px); box-shadow: 0 6px 14px rgba(15,23,42,0.2); }
      @media (prefers-color-scheme: dark) {
        #hibob-helper-inline .hh-action { background: #f43f5e; color: #fff; }
      }
      #hibob-helper-inline .hh-action[disabled] { opacity: 0.6; cursor: not-allowed; transform: none; box-shadow: none; }
      #hibob-helper-inline .hh-progress { display: none; flex-direction: column; gap: 6px; min-width: 160px; }
      #hibob-helper-inline .hh-progress-header { display: flex; justify-content: space-between; font-size: 10px; text-transform: uppercase; letter-spacing: 0.2em; color: #64748b; font-weight: 600; }
      #hibob-helper-inline .hh-progress-bar { width: 100%; height: 6px; border-radius: 999px; background: rgba(148,163,184,0.3); overflow: hidden; }
      #hibob-helper-inline .hh-progress-bar span { display: block; height: 100%; width: 0%; background: #fb7185; transition: width 0.3s ease; }
      #hibob-helper-inline .hh-progress-footer { font-size: 11px; color: #64748b; }
      @media (prefers-color-scheme: dark) {
        #hibob-helper-inline .hh-progress-header, #hibob-helper-inline .hh-progress-footer { color: #94a3b8; }
        #hibob-helper-inline .hh-progress-bar { background: rgba(148,163,184,0.2); }
      }
      #hibob-helper-inline .hh-cancel { display: none; border: none; background: #ef4444; color: #fff; padding: 8px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; cursor: pointer; }
      #hibob-helper-inline[data-state='running'] .hh-progress { display: flex; }
      #hibob-helper-inline[data-state='running'] .hh-cancel { display: inline-flex; }
      #hibob-helper-inline[data-state='running'] .hh-action { display: none; }
    `
    document.head.appendChild(style)

    const container = document.createElement('div')
    container.id = 'hibob-helper-inline'
    container.dataset.state = 'idle'
    container.innerHTML = `
      <div class="hh-shell">
        <button class="hh-action" type="button">Automate Entries</button>
        <div class="hh-progress">
          <div class="hh-progress-header">
            <span>Progress</span>
            <span class="hh-progress-count">0/0</span>
          </div>
          <div class="hh-progress-bar"><span></span></div>
          <div class="hh-progress-footer">Saved 0 of 0 rows.</div>
        </div>
        <button class="hh-cancel" type="button">Cancel</button>
      </div>
    `
    document.body.appendChild(container)

    const actionButton = container.querySelector<HTMLButtonElement>('.hh-action')
    const cancelButton = container.querySelector<HTMLButtonElement>('.hh-cancel')
    const progressCount = container.querySelector<HTMLElement>('.hh-progress-count')
    const progressBar = container.querySelector<HTMLElement>('.hh-progress-bar span')
    const progressFooter = container.querySelector<HTMLElement>('.hh-progress-footer')

    const updateProgress = (progress: {
      total: number
      completed: number
      saved: number
    }) => {
      const percent = progress.total
        ? Math.min(100, Math.round((progress.completed / progress.total) * 100))
        : 0
      if (progressCount) {
        progressCount.textContent = `${progress.completed}/${progress.total || 0}`
      }
      if (progressBar) {
        progressBar.style.width = `${percent}%`
      }
      if (progressFooter) {
        progressFooter.textContent = `Saved ${progress.saved} of ${progress.total || 0} rows.`
      }
    }

    const resetUi = () => {
      container.dataset.state = 'idle'
      updateProgress({ total: 0, completed: 0, saved: 0 })
      if (actionButton) actionButton.disabled = false
    }

    const startInlineAutomation = async () => {
      if (!actionButton) return
      actionButton.disabled = true
      const times = await getStoredTimes()
      const settings = await getStoredSettings()
      if (!isValidTime(times.clockIn) || !isValidTime(times.clockOut)) {
        console.warn(`${LOG_PREFIX} Invalid stored times. Please update the popup.`)
        resetUi()
        return
      }

      const requestId = crypto.randomUUID()
      container.dataset.state = 'running'
      updateProgress({ total: 0, completed: 0, saved: 0 })

      const { response } = await startAutomation(
        times.clockIn,
        times.clockOut,
        requestId,
        updateProgress,
        settings
      )

      if (response?.cancelled) {
        console.info(`${LOG_PREFIX} Inline automation cancelled.`)
      }

      resetUi()
    }

    actionButton?.addEventListener('click', startInlineAutomation)
    cancelButton?.addEventListener('click', () => requestCancel())
  }

  buildInlineUi()

  chrome.runtime.onMessage.addListener(
    (
      message: RunAutomationMessage | CancelAutomationMessage,
      _sender,
      sendResponse
    ) => {
      if (!message) return

      if (message.type === 'CANCEL_AUTOMATION') {
        if (running) {
          cancelRequested = true
          const response: AutomationResultMessage = {
            type: 'AUTOMATION_RESULT',
            requestId: message.requestId,
            success: true,
            cancelled: true,
          }
          sendResponse(response)
          return
        }

        const response: AutomationResultMessage = {
          type: 'AUTOMATION_RESULT',
          requestId: message.requestId,
          success: false,
          error: 'No automation running.',
        }
        sendResponse(response)
        return
      }

      if (message.type !== 'RUN_AUTOMATION') return

      startAutomation(
        message.payload.clockIn,
        message.payload.clockOut,
        message.requestId,
        undefined,
        {
          randomizeEnabled: message.payload.randomizeEnabled,
          randomizeMinutes: message.payload.randomizeMinutes,
        }
      ).then(({ response }) => {
        sendResponse(response)
      })

      return true
    }
  )
}
