// jsdom does not implement the CSS interface, but the content script relies on
// CSS.escape when building attribute/id selectors. Provide a spec-compatible
// enough polyfill for tests.
const cssHost = globalThis as unknown as {
  CSS?: { escape?: (value: string) => string }
}

if (typeof cssHost.CSS === 'undefined') {
  cssHost.CSS = {}
}

if (typeof cssHost.CSS.escape !== 'function') {
  cssHost.CSS.escape = (value: string) =>
    String(value).replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`)
}
