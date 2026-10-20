import { describe, expect, it } from 'vitest'
import { htmlToText } from '../html-to-text'

describe('htmlToText', () => {
  it('keeps paragraph and list breaks and decodes entities', () => {
    expect(htmlToText('<p>About&nbsp;us</p><ul><li>SQL &amp; Python</li><li>dbt</li></ul>')).toBe('About us\n- SQL & Python\n- dbt')
  })
})
