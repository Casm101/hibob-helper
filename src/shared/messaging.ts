export type AutomationPayload = {
  clockIn: string
  clockOut: string
  randomizeEnabled?: boolean
  randomizeMinutes?: number
  breakEnabled?: boolean
  breakStart?: string
  breakDurationMinutes?: number
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

export type RowResultStatus = 'saved' | 'failed' | 'skipped'

export type RowResult = {
  rowId: string
  label: string
  status: RowResultStatus
  reason?: string
}

export type AutomationResultMessage = {
  type: 'AUTOMATION_RESULT'
  requestId: string
  success: boolean
  processed?: number
  cancelled?: boolean
  error?: string
  results?: RowResult[]
  failed?: number
  skipped?: number
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
