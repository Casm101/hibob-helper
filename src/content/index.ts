import { runAutomation } from './automation'
import type {
  AutomationResultMessage,
  CancelAutomationMessage,
  RunAutomationMessage,
} from '../shared/messaging'

declare global {
  interface Window {
    __hibobHelperInjected?: boolean
  }
}

const LOG_PREFIX = '[HiBob Helper]'
let running = false
let cancelRequested = false

if (!window.__hibobHelperInjected) {
  window.__hibobHelperInjected = true

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
      cancelRequested = false
      runAutomation(
        message.payload.clockIn,
        message.payload.clockOut,
        message.requestId,
        () => cancelRequested
      )
        .then((result) => {
          const response: AutomationResultMessage = {
            type: 'AUTOMATION_RESULT',
            requestId: message.requestId,
            success: !result.cancelled,
            processed: result.processed,
            cancelled: result.cancelled,
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
          cancelRequested = false
        })

      return true
    }
  )
}
