import { runAutomation } from './automation'
import type { AutomationResultMessage, RunAutomationMessage } from '../shared/messaging'

declare global {
  interface Window {
    __hibobHelperInjected?: boolean
  }
}

const LOG_PREFIX = '[HiBob Helper]'
let running = false

if (!window.__hibobHelperInjected) {
  window.__hibobHelperInjected = true

  chrome.runtime.onMessage.addListener(
    (message: RunAutomationMessage, _sender, sendResponse) => {
      if (!message || message.type !== 'RUN_AUTOMATION') return

      if (running) {
        const busyResponse: AutomationResultMessage = {
          type: 'AUTOMATION_RESULT',
          requestId: message.requestId,
          success: false,
          error: 'Automation already running.',
        }
        sendResponse(busyResponse)
        return
      }

      running = true
      runAutomation(message.payload.clockIn, message.payload.clockOut)
        .then((processed) => {
          const response: AutomationResultMessage = {
            type: 'AUTOMATION_RESULT',
            requestId: message.requestId,
            success: true,
            processed,
          }
          sendResponse(response)
        })
        .catch((error) => {
          console.error(`${LOG_PREFIX} Automation failed.`, error)
          const response: AutomationResultMessage = {
            type: 'AUTOMATION_RESULT',
            requestId: message.requestId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
          sendResponse(response)
        })
        .finally(() => {
          running = false
        })

      return true
    }
  )
}
