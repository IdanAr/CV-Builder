// Server-side fetch of a user-supplied job posting URL.
//
// Fetching an arbitrary URL on the user's behalf is an SSRF vector: without
// guards, "https://169.254.169.254/latest/meta-data" or "http://localhost:27017"
// would be read from inside our own network. So, for the first request and for
// every redirect:
//   - only http/https on the default ports;
//   - the hostname is resolved by a custom `lookup` passed to the socket, and
//     the connection is refused if ANY resolved address is private, loopback,
//     link-local, multicast or otherwise reserved. Checking inside `lookup`
//     (rather than resolving first and fetching by name afterwards) means the
//     address we vet is the address we connect to, so DNS rebinding between a
//     check and the request cannot slip a private address through;
//   - IP-literal hosts never reach `lookup`, so they are vetted up front.
// Responses are capped in size and time, and only HTML or plain text is read.
import http from 'node:http'
import https from 'node:https'
import dns from 'node:dns'
import net from 'node:net'
import zlib from 'node:zlib'
import type { Readable } from 'node:stream'

export class JobUrlError extends Error {
  constructor(message: string, readonly status: number = 422) {
    super(message)
    this.name = 'JobUrlError'
  }
}

const MAX_BYTES = 2_000_000
const TIMEOUT_MS = 10_000
const MAX_REDIRECTS = 4

const BLOCKED = new net.BlockList()
for (const [addr, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) BLOCKED.addSubnet(addr, prefix, 'ipv4')
for (const [addr, prefix] of [
  ['::', 128], ['::1', 128], ['64:ff9b::', 96], ['100::', 64], ['2001:db8::', 32],
  ['fc00::', 7], ['fe80::', 10], ['ff00::', 8],
] as const) BLOCKED.addSubnet(addr, prefix, 'ipv6')

/** IPv4 written inside an IPv6 address (`::ffff:127.0.0.1`, `::ffff:7f00:1`), if any. */
function embeddedIpv4(ip: string): string | null {
  const lower = ip.toLowerCase()
  const dotted = lower.match(/^(?:0*:)*:ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (dotted) return dotted[1]
  const hex = lower.match(/^(?:0*:)*:ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
  if (hex) {
    const hi = parseInt(hex[1], 16)
    const lo = parseInt(hex[2], 16)
    return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`
  }
  return null
}

/** True for any address a user-supplied URL must never make us connect to. */
export function isBlockedAddress(ip: string): boolean {
  const family = net.isIP(ip)
  if (family === 0) return true
  if (family === 4) return BLOCKED.check(ip, 'ipv4')
  const v4 = embeddedIpv4(ip)
  if (v4) return BLOCKED.check(v4, 'ipv4')
  return BLOCKED.check(ip, 'ipv6')
}

/** Parses and vets a URL's scheme, port and (for IP literals) address. */
export function validateJobUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    throw new JobUrlError('Enter a full link, starting with https://', 400)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new JobUrlError('Only http and https links can be imported.', 400)
  }
  if (url.port && url.port !== '80' && url.port !== '443') {
    throw new JobUrlError('That link uses an unusual port and cannot be imported.', 400)
  }
  if (url.username || url.password) {
    throw new JobUrlError('Links with a username or password cannot be imported.', 400)
  }
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (net.isIP(host) !== 0 && isBlockedAddress(host)) {
    throw new JobUrlError('That address is not a public website.', 400)
  }
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) {
    throw new JobUrlError('That address is not a public website.', 400)
  }
  return url
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void

function guardedLookup(hostname: string, options: dns.LookupOptions, callback: LookupCallback): void {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, '')
    const list = addresses as dns.LookupAddress[]
    if (list.length === 0 || list.some((a) => isBlockedAddress(a.address))) {
      const blocked = new Error('blocked address') as NodeJS.ErrnoException
      blocked.code = 'EBLOCKED'
      return callback(blocked, '')
    }
    if (options.all) return callback(null, list)
    callback(null, list[0].address, list[0].family)
  })
}

interface RawResponse {
  status: number
  headers: http.IncomingHttpHeaders
  body: Readable
}

function request(url: URL, signal: AbortSignal): Promise<RawResponse> {
  const lib = url.protocol === 'https:' ? https : http
  return new Promise((resolve, reject) => {
    const req = lib.request(url, {
      method: 'GET',
      lookup: guardedLookup as unknown as typeof dns.lookup,
      signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CVitae/1.0; job description import)',
        Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en,*;q=0.5',
      },
    }, (res) => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: res }))
    req.on('error', reject)
    req.end()
  })
}

function decode(body: Readable, encoding: string | undefined): Readable {
  switch ((encoding ?? '').toLowerCase()) {
    case 'gzip': return body.pipe(zlib.createGunzip())
    case 'deflate': return body.pipe(zlib.createInflate())
    case 'br': return body.pipe(zlib.createBrotliDecompress())
    default: return body
  }
}

async function readCapped(stream: Readable): Promise<string> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of stream) {
    total += (chunk as Buffer).length
    if (total > MAX_BYTES) {
      stream.destroy()
      throw new JobUrlError('That page is too large to import. Paste the job description instead.')
    }
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

export interface FetchedPage {
  finalUrl: string
  html: string
}

export async function fetchPublicPage(raw: string): Promise<FetchedPage> {
  let url = validateJobUrl(raw)
  const signal = AbortSignal.timeout(TIMEOUT_MS)
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let res: RawResponse
    try {
      res = await request(url, signal)
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'EBLOCKED') throw new JobUrlError('That address is not a public website.', 400)
      if ((err as Error).name === 'TimeoutError' || (err as Error).name === 'AbortError') {
        throw new JobUrlError('That page took too long to answer. Paste the job description instead.')
      }
      throw new JobUrlError("Couldn't reach that page. Check the link, or paste the job description instead.")
    }

    if (res.status >= 300 && res.status < 400 && res.headers.location) {
      res.body.resume()
      url = validateJobUrl(new URL(res.headers.location, url).toString())
      continue
    }
    if (res.status === 401 || res.status === 403) {
      res.body.resume()
      throw new JobUrlError('That site does not allow importing (it may need you to sign in). Paste the job description instead.')
    }
    if (res.status < 200 || res.status >= 300) {
      res.body.resume()
      throw new JobUrlError(`That page answered with an error (${res.status}). Check the link, or paste the job description instead.`)
    }
    const type = String(res.headers['content-type'] ?? '').toLowerCase()
    if (type && !/text\/html|application\/xhtml|text\/plain/.test(type)) {
      res.body.resume()
      throw new JobUrlError('That link is not a web page. Paste the job description instead.')
    }
    const html = await readCapped(decode(res.body, res.headers['content-encoding'] as string | undefined))
    return { finalUrl: url.toString(), html }
  }
  throw new JobUrlError('That link redirects too many times. Paste the job description instead.')
}
