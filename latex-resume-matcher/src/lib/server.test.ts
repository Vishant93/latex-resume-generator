import { describe, expect, it } from 'vitest'
import { createTailoredTexCopy } from '../../server'

describe('createTailoredTexCopy', () => {
  it('preserves dollar-sign sequences in tailored bullet text', () => {
    const originalTex = String.raw`
\resumeItem{Generated revenue through platform growth}
`

    const output = createTailoredTexCopy(
      originalTex,
      [{ id: 'exp-001', text: 'Generated revenue through platform growth', raw: 'Generated revenue through platform growth' }],
      [{ id: 'exp-001', text: 'Generated $1M revenue and $2B in total platform value' }],
    )

    expect(output).toContain('\\$1M')
    expect(output).toContain('\\$2B')
  })
})
