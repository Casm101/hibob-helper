export type AutomationPayload = {
  clockIn: string
  clockOut: string
  randomizeEnabled?: boolean
  randomizeMinutes?: number
}

export type RunAutomationMessage = {
  type: 'RUN_AUTOMATION'
  requestId: string
  payload: AutomationPayload
}

export type CancelAutomationMessage = {
  type: 'CANCEL_AUTOMATION'
  requestId: string
}

export type AutomationResultMessage = {
  type: 'AUTOMATION_RESULT'
  requestId: string
  success: boolean
  processed?: number
  cancelled?: boolean
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
  | CancelAutomationMessage
  | AutomationResultMessage
  | AutomationProgressMessage
