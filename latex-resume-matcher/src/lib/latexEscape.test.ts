import { describe, expect, it } from 'vitest'
import { escapeLatexText, escapeLatexWithFormatting } from './latexEscape'

describe('LaTeX text escaping', () => {
  it('uses intended command sequences without escaping generated braces', () => {
    expect(escapeLatexText('C:\\temp ~ value ^2')).toBe('C:\\textbackslash{}temp \\textasciitilde{} value \\textasciicircum{}2')
  })

  it('escapes braces and common LaTeX reserved characters', () => {
    expect(escapeLatexText('{cost $100 & 50%}')).toBe('\\{cost \\$100 \\& 50\\%\\}')
  })

  it('preserves textbf formatting while escaping its content', () => {
    expect(escapeLatexWithFormatting('Used \\textbf{AWS ~ } safely')).toBe('Used \\textbf{AWS \\textasciitilde{}} safely')
  })
})
