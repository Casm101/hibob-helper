export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const isElementVisible = (element: Element | null): element is Element => {
  if (!element) return false
  const htmlElement = element as HTMLElement
  return !!(
    htmlElement.offsetWidth ||
    htmlElement.offsetHeight ||
    htmlElement.getClientRects().length
  )
}

export const clickElement = (element: Element) => {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
}

export const setInputValue = (input: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value'
  )?.set

  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

export const commitInputValue = (input: HTMLInputElement, value: string) => {
  clickElement(input)
  input.focus()
  input.dispatchEvent(new Event('focusin', { bubbles: true }))
  setInputValue(input, value)
  input.dispatchEvent(new Event('blur', { bubbles: true }))
  input.dispatchEvent(new Event('focusout', { bubbles: true }))
  input.blur()
}

export const waitForCondition = async <T>(
  condition: () => T | null | false,
  {
    timeout = 15000,
    interval = 200,
    root = document,
  }: { timeout?: number; interval?: number; root?: ParentNode } = {}
): Promise<T> => {
  const start = Date.now()

  return new Promise((resolve, reject) => {
    let settled = false

    const cleanup = (observer?: MutationObserver, intervalId?: number) => {
      settled = true
      if (observer) observer.disconnect()
      if (intervalId) window.clearInterval(intervalId)
    }

    const checkNow = () => {
      if (settled) return
      const result = condition()
      if (result) {
        cleanup(observer, intervalId)
        resolve(result)
      } else if (Date.now() - start >= timeout) {
        cleanup(observer, intervalId)
        reject(new Error('Timed out waiting for condition.'))
      }
    }

    const observer = new MutationObserver(checkNow)
    observer.observe(root, { childList: true, subtree: true, attributes: true })

    const intervalId = window.setInterval(checkNow, interval)
    checkNow()
  })
}

const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim()

export const findButtonByText = (
  container: ParentNode,
  textOptions: string[]
): HTMLElement | null => {
  const normalizedOptions = textOptions.map(normalize)
  const candidates = Array.from(
    container.querySelectorAll<HTMLElement>('button, [role="button"], a')
  )

  for (const element of candidates) {
    if (!isElementVisible(element)) continue
    const text = normalize(element.textContent ?? '')
    const aria = normalize(element.getAttribute('aria-label') ?? '')

    if (
      normalizedOptions.some(
        (option) => text.includes(option) || aria.includes(option)
      )
    ) {
      return element
    }
  }

  return null
}

export const findInputByLabel = (
  container: ParentNode,
  labelText: string
): HTMLInputElement | null => {
  const normalizedLabel = normalize(labelText)

  const labels = Array.from(container.querySelectorAll('label'))
  for (const label of labels) {
    const labelValue = normalize(label.textContent ?? '')
    if (!labelValue.includes(normalizedLabel)) continue

    const htmlFor = label.getAttribute('for')
    if (htmlFor) {
      const input = container.querySelector<HTMLInputElement>(`#${CSS.escape(htmlFor)}`)
      if (input) return input
    }

    const nestedInput = label.querySelector<HTMLInputElement>('input')
    if (nestedInput) return nestedInput

    const parentInput = label.parentElement?.querySelector<HTMLInputElement>('input')
    if (parentInput) return parentInput
  }

  const fallbackInputs = Array.from(container.querySelectorAll<HTMLInputElement>('input'))
  for (const input of fallbackInputs) {
    const name = normalize(input.name ?? '')
    const aria = normalize(input.getAttribute('aria-label') ?? '')
    const placeholder = normalize(input.placeholder ?? '')

    const compactLabel = normalizedLabel.replace(/\s+/g, '')
    if (
      [name, aria, placeholder].some(
        (value) => value.includes(compactLabel) || value.includes(normalizedLabel)
      )
    ) {
      return input
    }
  }

  return null
}

const parseColor = (value: string) => {
  if (!value || value === 'transparent') return null
  const rgbMatch = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i)
  if (rgbMatch) {
    return {
      r: Number(rgbMatch[1]),
      g: Number(rgbMatch[2]),
      b: Number(rgbMatch[3]),
    }
  }

  const hexMatch = value.replace('#', '')
  if ([3, 6].includes(hexMatch.length)) {
    const hex =
      hexMatch.length === 3
        ? hexMatch
            .split('')
            .map((char) => `${char}${char}`)
            .join('')
        : hexMatch
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    return { r, g, b }
  }

  return null
}

export const isRedish = (value: string) => {
  const color = parseColor(value)
  if (!color) return false
  return color.r > 180 && color.g < 100 && color.b < 100
}

export const hasRedIndicator = (row: Element) => {
  const candidates = Array.from(row.querySelectorAll<HTMLElement>('svg, span, i, div'))

  for (const element of candidates) {
    const text = normalize(element.textContent ?? '')
    if (text === '!' || text === '1') {
      return true
    }

    const styles = window.getComputedStyle(element)
    if (
      [styles.color, styles.backgroundColor, styles.fill, styles.stroke].some((color) =>
        isRedish(color)
      )
    ) {
      return true
    }
  }

  return false
}
