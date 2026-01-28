export type AutomationPayload = {
  clockIn: string
  clockOut: string
}

export type RunAutomationMessage = {
  type: 'RUN_AUTOMATION'
  requestId: string
  payload: AutomationPayload
}

export type AutomationResultMessage = {
  type: 'AUTOMATION_RESULT'
  requestId: string
  success: boolean
  processed?: number
  error?: string
}

export type ExtensionMessage = RunAutomationMessage | AutomationResultMessage
