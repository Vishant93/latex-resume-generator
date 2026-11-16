export interface ResumeSourceRange {
  start: number
  end: number
}

export interface ResumeBullet {
  id: string
  text: string
  raw: string
  source: ResumeSourceRange
}

export interface ExperienceEntry {
  company: string
  position: string
  startDate: string
  endDate: string
  location: string
  bullets: ResumeBullet[]
  source?: ResumeSourceRange
}

export interface ResumeDocument {
  experience: ExperienceEntry[]
}

export function parseResumeDocument(texContent: string): ResumeDocument {
  const cleaned = stripLatexComments(texContent)
  const experienceBlock = extractExperienceSection(cleaned)
  let bulletIdCounter = 1
  const createBulletId = () => `exp-${String(bulletIdCounter++).padStart(3, '0')}`
  const experience = extractExperienceEntries(experienceBlock, createBulletId)

  return { experience }
}

export function parseExperienceBullets(texContent: string): string[] {
  const document = parseResumeDocument(texContent)
  return document.experience.flatMap((entry) => entry.bullets.map((bullet) => bullet.text))
}

function stripLatexComments(texContent: string): string {
  return texContent.replace(/(^|[^\\])%.*$/gm, '$1')
}

function extractExperienceSection(texContent: string): string {
  const experienceMatch = texContent.match(
    /\\section\s*\{[^}]*experience[^}]*\}([\s\S]*?)(?=\\section\s*\{|\\end\s*\{document\}|$)/i,
  )

  if (experienceMatch) {
    return experienceMatch[1]
  }

  return texContent
}

function extractExperienceEntries(
  experienceBlock: string,
  createBulletId: () => string,
): ExperienceEntry[] {
  const entries: ExperienceEntry[] = []

  const headingMatches = [...experienceBlock.matchAll(/\\resumeSubheading\s*\{([^}]*)\}\s*\{([^}]*)\}\s*\{([^}]*)\}\s*\{([^}]*)\}/g)]

  if (headingMatches.length > 0) {
    headingMatches.forEach((match, index) => {
      const startIndex = match.index ?? 0
      const nextStart = headingMatches[index + 1]?.index ?? experienceBlock.length
      const content = experienceBlock.slice(startIndex + match[0].length, nextStart)
      const [company, location, dateRange, positionRaw] = match.slice(1)
      const { startDate, endDate } = parseDateRange(dateRange)
      const position = normalizeLatexText(positionRaw) || inferPositionFromContent(content)

      entries.push({
        company: normalizeLatexText(company),
        position,
        startDate,
        endDate,
        location: normalizeLatexText(location),
        bullets: extractBullets(content, startIndex + match[0].length, createBulletId),
        source: {
          start: startIndex,
          end: nextStart,
        },
      })
    })

    return entries
  }

  const environmentPattern = /\\begin\s*\{rSubsection\}\s*((?:\s*\{[^{}]*\}){4})([\s\S]*?)\\end\s*\{rSubsection\}/g
  const envMatches = [...experienceBlock.matchAll(environmentPattern)]

  if (envMatches.length > 0) {
    envMatches.forEach((match) => {
      const startIndex = match.index ?? 0
      const headerArgs = extractTopLevelArguments(match[1])
      const content = match[2] ?? ''
      const [company, location, dateRange, positionRaw] = headerArgs
      const { startDate, endDate } = parseDateRange(dateRange ?? '')
      const position = normalizeLatexText(positionRaw ?? '') || inferPositionFromContent(content)

      entries.push({
        company: normalizeLatexText(company ?? ''),
        position,
        startDate,
        endDate,
        location: normalizeLatexText(location ?? ''),
        bullets: extractBullets(content, startIndex + match[0].indexOf(match[2]), createBulletId),
        source: {
          start: startIndex,
          end: startIndex + match[0].length,
        },
      })
    })

    return entries
  }

  const fallbackBullets = extractBullets(experienceBlock, 0, createBulletId)

  if (fallbackBullets.length > 0) {
    return [
      {
        company: 'Unknown company',
        position: 'Unknown position',
        startDate: '',
        endDate: '',
        location: '',
        bullets: fallbackBullets,
      },
    ]
  }

  return []
}

function extractBullets(
  text: string,
  offset: number,
  createBulletId: () => string,
): ResumeBullet[] {
  const bulletMap = new Map<string, ResumeBullet>()

  const addBullet = (entry: { text: string; raw: string; start: number; end: number }) => {
    const normalizedText = normalizeLatexText(entry.text)
    if (!normalizedText || normalizedText.length <= 2) {
      return
    }

    const dedupeKey = `${normalizedText}::${entry.start}`
    if (bulletMap.has(dedupeKey)) {
      return
    }

    bulletMap.set(dedupeKey, {
      id: createBulletId(),
      text: normalizedText,
      raw: entry.raw,
      source: {
        start: offset + entry.start,
        end: offset + entry.end,
      },
    })
  }

  for (const command of extractCommandBodies(text, 'resumeItem')) {
    addBullet(command)
  }

  for (const command of extractCommandBodies(text, 'resumeSubItem')) {
    addBullet(command)
  }

  for (const item of extractItemBodies(text)) {
    addBullet(item)
  }

  return [...bulletMap.values()]
}

function extractCommandBodies(text: string, commandName: string): Array<{ text: string; raw: string; start: number; end: number }> {
  const results: Array<{ text: string; raw: string; start: number; end: number }> = []
  const command = `\\${commandName}`
  let searchIndex = 0

  while (searchIndex < text.length) {
    const start = text.indexOf(command, searchIndex)
    if (start === -1) break

    let cursor = start + command.length
    while (cursor < text.length && /\s/.test(text[cursor])) {
      cursor += 1
    }

    if (text[cursor] === '[') {
      cursor += 1
      while (cursor < text.length && text[cursor] !== ']') {
        cursor += 1
      }
      while (cursor < text.length && /\s/.test(text[cursor])) {
        cursor += 1
      }
    }

    if (text[cursor] !== '{') {
      searchIndex = start + command.length
      continue
    }

    let depth = 0
    let end = -1

    for (let i = cursor; i < text.length; i += 1) {
      const char = text[i]
      if (char === '{') {
        depth += 1
      } else if (char === '}') {
        depth -= 1
        if (depth === 0) {
          end = i
          break
        }
      }
    }

    if (end !== -1) {
      const innerStart = cursor + 1
      const raw = text.slice(innerStart, end)
      results.push({
        text: raw,
        raw,
        start: innerStart,
        end,
      })
    }

    searchIndex = cursor + 1
  }

  return results
}

function extractItemBodies(text: string): Array<{ text: string; raw: string; start: number; end: number }> {
  const results: Array<{ text: string; raw: string; start: number; end: number }> = []
  const command = '\\item'
  let searchIndex = 0

  while (searchIndex < text.length) {
    const start = text.indexOf(command, searchIndex)
    if (start === -1) break

    let cursor = start + command.length
    while (cursor < text.length && /\s/.test(text[cursor])) {
      cursor += 1
    }

    if (text[cursor] === '[') {
      cursor += 1
      while (cursor < text.length && text[cursor] !== ']') {
        cursor += 1
      }
      while (cursor < text.length && /\s/.test(text[cursor])) {
        cursor += 1
      }
    }

    let value = ''
    let valueStart = cursor
    let valueEnd = cursor

    if (text[cursor] === '{') {
      let depth = 0
      let end = -1

      for (let i = cursor; i < text.length; i += 1) {
        const char = text[i]
        if (char === '{') {
          depth += 1
        } else if (char === '}') {
          depth -= 1
          if (depth === 0) {
            end = i
            break
          }
        }
      }

      if (end !== -1) {
        valueStart = cursor + 1
        valueEnd = end
        value = text.slice(valueStart, valueEnd)
        searchIndex = end + 1
      } else {
        searchIndex = cursor + 1
      }
    } else {
      const nextItem = text.indexOf('\\item', start + command.length)
      const cutOff = nextItem === -1 ? text.length : nextItem
      valueStart = cursor
      valueEnd = cutOff
      value = text.slice(valueStart, valueEnd)
      searchIndex = cutOff
    }

    if (value.trim()) {
      results.push({
        text: value,
        raw: value,
        start: valueStart,
        end: valueEnd,
      })
    }
  }

  return results
}

function parseDateRange(dateRange: string): { startDate: string; endDate: string } {
  const cleaned = normalizeLatexText(dateRange)
  if (!cleaned) {
    return { startDate: '', endDate: '' }
  }

  const rangeMatch = cleaned.match(/^(.*?)(?:\s*(?:-|–|—|to)\s*)(.*)$/)
  if (rangeMatch) {
    const startDate = normalizeLatexText(rangeMatch[1])
    const endDate = normalizeLatexText(rangeMatch[2])
    if (startDate || endDate) {
      return { startDate: startDate || '', endDate: endDate || 'Present' }
    }
  }

  return { startDate: cleaned, endDate: 'Present' }
}

function inferPositionFromContent(text: string): string {
  const boldMatch = text.match(/\\textbf\s*(?:\[[^\]]*\])?\{([^{}]+)\}/)
  if (boldMatch) {
    return normalizeLatexText(boldMatch[1])
  }

  const titleMatch = text.match(/(?<!\\)(?:^|[^A-Za-z])([A-Z][A-Za-z0-9&/().,' -]{3,80})(?=\s*(?:\\resumeItem|\\item|\\end))/)
  if (titleMatch) {
    return normalizeLatexText(titleMatch[1])
  }

  return 'Unknown position'
}

function extractTopLevelArguments(text: string): string[] {
  const values: string[] = []
  let current = ''
  let depth = 0
  let captureStarted = false

  for (const char of text) {
    if (char === '{') {
      if (!captureStarted) {
        captureStarted = true
      }
      depth += 1
      if (depth > 0) {
        current += char
      }
    } else if (char === '}') {
      if (depth > 0) {
        depth -= 1
        if (depth > 0) {
          current += char
        } else {
          values.push(current.slice(1, -1))
          current = ''
          captureStarted = false
        }
      }
    } else if (captureStarted) {
      current += char
    }
  }

  return values
}

function normalizeLatexText(value: string): string {
  return value
    .replace(/\\textbf\s*(?:\[[^\]]*\])?\{([^{}]+)\}/g, '$1')
    .replace(/\\textit\s*(?:\[[^\]]*\])?\{([^{}]+)\}/g, '$1')
    .replace(/\\emph\s*(?:\[[^\]]*\])?\{([^{}]+)\}/g, '$1')
    .replace(/\\texttt\s*(?:\[[^\]]*\])?\{([^{}]+)\}/g, '$1')
    .replace(/\\href\s*(?:\[[^\]]*\])?\{([^{}]+)\}/g, '$1')
    .replace(/\\url\s*(?:\[[^\]]*\])?\{([^{}]+)\}/g, '$1')
    .replace(/\\(?:LaTeX|TeX)/g, 'LaTeX')
    .replace(/\\[A-Za-z]+/g, ' ')
    .replace(/\\[&%$#_{}]/g, ' ')
    .replace(/\\[~^]/g, ' ')
    .replace(/\\,/g, ' ')
    .replace(/\\-/g, '-')
    .replace(/\\\s+/g, ' ')
    .replace(/\{+|\}+|\[+|\]+/g, ' ')
    .replace(/\$/g, ' ')
    .replace(/\\\\/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
