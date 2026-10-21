// vitest.setup.ts
import '@testing-library/jest-dom'

// jsdom replaces the global Uint8Array with its own realm's, so a Node Buffer
// is no longer `instanceof Uint8Array`. pdfkit (@react-pdf/renderer >= 4.9)
// tests exactly that before writing a stream, and otherwise writes the
// compressed bytes as a UTF-8 string, corrupting every flate stream. Production
// runs the Node build in Node, where this never happens; restore Node's class
// so the jsdom-environment PDF tests (preview parity and divider placement)
// read real PDFs.
if (!(Buffer.alloc(1) instanceof Uint8Array)) {
  globalThis.Uint8Array = Object.getPrototypeOf(Buffer.prototype).constructor
}
