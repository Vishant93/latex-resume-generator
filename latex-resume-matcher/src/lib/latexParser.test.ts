import { describe, expect, it } from 'vitest'
import { parseResumeDocument } from './latexParser'

describe('parseResumeDocument', () => {
  it('parses resumeItem bullets', () => {
    const tex = String.raw`
      \section{Experience}
      \resumeSubheading{Acme}{Remote}{2024 -- Present}{Backend Engineer}
      \begin{itemize}
        \resumeItem{Built APIs for 50,000 customers}
      \end{itemize}
    `

    const document = parseResumeDocument(tex)
    expect(document.experience).toHaveLength(1)
    expect(document.experience[0].bullets[0].text).toBe('Built APIs for 50,000 customers')
  })

  it('parses plain itemize bullets', () => {
    const tex = String.raw`
      \section{Experience}
      \begin{itemize}
        \item Improved test coverage
        \item Reduced deployment time
      \end{itemize}
    `

    const document = parseResumeDocument(tex)
    expect(document.experience.flatMap((entry) => entry.bullets.map((bullet) => bullet.text)))
      .toEqual(['Improved test coverage', 'Reduced deployment time'])
  })

  it('removes comments and normalizes LaTeX formatting', () => {
    const tex = String.raw`
      \section{Experience}
      \resumeSubheading{Acme}{Remote}{2024}{Engineer}
      \resumeItem{Built \textbf{reliable} APIs % comment
      }
    `

    const document = parseResumeDocument(tex)
    expect(document.experience[0].bullets[0].text).toBe('Built reliable APIs')
  })

  it('preserves escaped percentages and removes formatting safely', () => {
    const tex = String.raw`
      \section{Experience}
      \resumeSubheading{Acme}{Remote}{2024}{Engineer}
      \resumeItem{Reduced costs by 93\% using \textbf{AWS S3}}
    `

    const document = parseResumeDocument(tex)
    expect(document.experience[0].bullets[0].text).toBe('Reduced costs by 93% using AWS S3')
  })
})
