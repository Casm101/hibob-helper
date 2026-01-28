import { isSupportedUrl } from '../shared/config'
import type {
  AutomationResultMessage,
  CancelAutomationMessage,
  RunAutomationMessage,
} from '../shared/messaging'

const queryActiveTab = () =>
  new Promise<chrome.tabs.Tab | undefined>((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs[0])
    })
  })

const sendMessageToTab = (
  tabId: number,
  message: RunAutomationMessage | CancelAutomationMessage
) =>
  new Promise<{ response?: AutomationResultMessage; error?: string }>((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ error: chrome.runtime.lastError.message })
        return
      }
      resolve({ response })
    })
  })

const injectContentScript = (tabId: number) =>
  new Promise<void>((resolve, reject) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        files: ['contentScript.js'],
      },
      () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }
        resolve()
      }
    )
  })

const handleRunAutomation = async (
  message: RunAutomationMessage
): Promise<AutomationResultMessage> => {
  const activeTab = await queryActiveTab()
  if (!activeTab?.id || !isSupportedUrl(activeTab.url)) {
    return {
      type: 'AUTOMATION_RESULT',
      requestId: message.requestId,
      success: false,
      error: 'Site not supported. Open the target page and try again.',
    }
  }

  const firstAttempt = await sendMessageToTab(activeTab.id, message)
  if (!firstAttempt.response && firstAttempt.error?.includes('Receiving end')) {
    try {
      await injectContentScript(activeTab.id)
    } catch (error) {
      return {
        type: 'AUTOMATION_RESULT',
        requestId: message.requestId,
        success: false,
        error: error instanceof Error ? error.message : 'Failed to inject content script.',
      }
    }

    const secondAttempt = await sendMessageToTab(activeTab.id, message)
    if (secondAttempt.response) return secondAttempt.response

    return {
      type: 'AUTOMATION_RESULT',
      requestId: message.requestId,
      success: false,
      error: secondAttempt.error ?? 'Unable to reach the content script.',
    }
  }

  if (!firstAttempt.response) {
    return {
      type: 'AUTOMATION_RESULT',
      requestId: message.requestId,
      success: false,
      error: firstAttempt.error ?? 'Unable to reach the content script.',
    }
  }

  return firstAttempt.response
}

const handleCancelAutomation = async (
  message: CancelAutomationMessage
): Promise<AutomationResultMessage> => {
  const activeTab = await queryActiveTab()
  if (!activeTab?.id || !isSupportedUrl(activeTab.url)) {
    return {
      type: 'AUTOMATION_RESULT',
      requestId: message.requestId,
      success: false,
      error: 'Site not supported. Open the target page and try again.',
    }
  }

  const result = await sendMessageToTab(activeTab.id, message)
  if (result.response) return result.response

  return {
    type: 'AUTOMATION_RESULT',
    requestId: message.requestId,
    success: false,
    error: result.error ?? 'Unable to reach the content script.',
  }
}

chrome.runtime.onMessage.addListener(
  (message: RunAutomationMessage | CancelAutomationMessage, _sender, sendResponse) => {
    if (!message) return

    if (message.type === 'RUN_AUTOMATION') {
      handleRunAutomation(message).then(sendResponse)
      return true
    }

    if (message.type === 'CANCEL_AUTOMATION') {
      handleCancelAutomation(message).then(sendResponse)
      return true
    }
  }
)
