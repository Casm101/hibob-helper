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

export type AutomationProgressMessage = {
  type: 'AUTOMATION_PROGRESS'
  requestId: string
  total: number
  completed: number
  saved?: number
}

export type ExtensionMessage =
  | RunAutomationMessage
  | AutomationResultMessage
  | AutomationProgressMessage
