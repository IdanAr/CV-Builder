'use client'

/**
 * Last-resort boundary for failures in the root layout itself, which the
 * per-segment `error.tsx` boundaries sit below and therefore cannot catch.
 *
 * Next.js replaces the whole document with this component, so it must render
 * its own <html> and <body>. That also means `globals.css` and the app's fonts
 * are not guaranteed to apply here — styling is kept inline and minimal so this
 * page stays legible no matter what failed above it.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          backgroundColor: '#F6F7F9',
          color: '#14161B',
          fontFamily: 'system-ui, Arial, Helvetica, sans-serif',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '28rem' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 500, margin: 0 }}>
            CV Builder ran into a problem
          </h1>
          <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#424855' }}>
            The app failed to start. Your saved CVs and applications are unaffected.
          </p>
          {error.digest && (
            <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#424855' }}>
              Reference: <span style={{ fontFamily: 'monospace' }}>{error.digest}</span>
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '1.5rem',
              minHeight: '44px',
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: '#FFFFFF',
              backgroundColor: '#2457F5',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
