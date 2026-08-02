// Vercel Serverless Functions hard-cap the request body at 4.5 MB
// (platform-level, not configurable) and return a non-JSON 413 for
// anything over. That response bypasses our route handler entirely, so
// the client's `.json()` parse fails and falls back to a generic error.
// Cap well under that ceiling so oversized files are rejected by our own
// validation — with a real message — before they ever hit the platform.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024
export const MAX_UPLOAD_MB_LABEL = '4 MB'
