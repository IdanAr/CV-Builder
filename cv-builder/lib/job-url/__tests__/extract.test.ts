import { describe, it, expect } from 'vitest'
import { extractJobDescription, htmlToText, decodeEntities } from '../extract'

const longPara = 'You will design and run data pipelines that feed every report the company relies on. '.repeat(5)

describe('extractJobDescription', () => {
  it('prefers a schema.org JobPosting and returns its title and company', () => {
    const html = `<html><head>
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"JobPosting",
        "title":"Senior Data Engineer","hiringOrganization":{"@type":"Organization","name":"Acme &amp; Co"},
        "description":"<p>About the role</p><ul><li>Python</li><li>AWS &amp; Snowflake</li></ul>"}</script>
      </head><body><nav>Jobs Home About</nav><main>Unrelated page text</main></body></html>`
    const job = extractJobDescription(html)
    expect(job.source).toBe('structured')
    expect(job.title).toBe('Senior Data Engineer')
    expect(job.company).toBe('Acme & Co')
    expect(job.text).toBe('About the role\n\n• Python\n• AWS & Snowflake')
  })

  it('finds a JobPosting inside @graph and accepts @type arrays and a string organisation', () => {
    const html = `<script type="application/ld+json">{"@graph":[{"@type":"WebPage"},
      {"@type":["JobPosting"],"title":"Analyst","hiringOrganization":"Northwind","description":"Own the dashboards."}]}</script>`
    const job = extractJobDescription(html)
    expect(job).toMatchObject({ source: 'structured', title: 'Analyst', company: 'Northwind', text: 'Own the dashboards.' })
  })

  it('decodes a double-encoded description before stripping tags', () => {
    const html = `<script type="application/ld+json">{"@type":"JobPosting","description":"&lt;p&gt;Build things&lt;/p&gt;"}</script>`
    expect(extractJobDescription(html).text).toBe('Build things')
  })

  it('skips malformed JSON-LD and falls back to the page', () => {
    const html = `<script type="application/ld+json">{not json</script><title>Data Engineer - Acme</title><body><main><h1>Data Engineer</h1><p>${longPara}</p></main></body>`
    const job = extractJobDescription(html)
    expect(job.source).toBe('page')
    expect(job.title).toBe('Data Engineer - Acme')
    expect(job.text.startsWith('Data Engineer\n')).toBe(true)
  })

  it('drops navigation, headers, footers, scripts and styles from the page text', () => {
    const html = `<body><header>Sign in</header><nav>Careers Blog</nav><script>track()</script><style>p{}</style>
      <div><h2>The role</h2><p>${longPara}</p></div><footer>© Acme</footer></body>`
    const text = extractJobDescription(html).text
    expect(text).toContain('The role')
    for (const junk of ['Sign in', 'Careers Blog', 'track()', 'p{}', '© Acme']) expect(text).not.toContain(junk)
  })

  it('uses the whole body when <main> is too short to be the posting', () => {
    const html = `<body><main>Apply now</main><div><p>${longPara}</p></div></body>`
    expect(extractJobDescription(html).text).toContain('design and run data pipelines')
  })

  it('caps the text at 10,000 characters', () => {
    const html = `<script type="application/ld+json">{"@type":"JobPosting","description":"${'a'.repeat(12_000)}"}</script>`
    expect(extractJobDescription(html).text).toHaveLength(10_000)
  })
})

describe('htmlToText / decodeEntities', () => {
  it('turns breaks and blocks into lines and collapses runs of blank lines', () => {
    expect(htmlToText('<p>One</p><p></p><p></p><div>Two<br>Three</div>')).toBe('One\n\nTwo\nThree')
  })

  it('decodes named and numeric entities and leaves unknown ones alone', () => {
    expect(decodeEntities('&lt;b&gt; &#8364;5 &#x2022; &rsquo; &bogus;')).toBe("<b> €5 • ' &bogus;")
  })
})
