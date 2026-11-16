export function parseExperienceBullets(texContent: string): string[] {
  const cleaned = stripLatexComments(texContent)
  const experienceBlock = extractExperienceSection(cleaned)
  const bullets: string[] = []
  const seen = new Set<string>()

  const addBullet = (value: string) => {
    const cleanedValue = normalizeLatexText(value)
    if (!cleanedValue || cleanedValue.length <= 2) {
      return
    }

    if (!seen.has(cleanedValue)) {
      seen.add(cleanedValue)
      bullets.push(cleanedValue)
    }
  }

  for (const match of extractCommandBodies(experienceBlock, 'resumeItem')) {
    addBullet(match)
  }

  for (const match of extractCommandBodies(experienceBlock, 'resumeSubItem')) {
    addBullet(match)
  }

  for (const item of extractItemBodies(experienceBlock)) {
    addBullet(item)
  }

  return bullets
}

function stripLatexComments(texContent: string): string {
  return texContent.replace(/(^|[^\\])%.*$/gm, '$1')
}

function extractExperienceSection(texContent: string): string {
  const experienceMatch = texContent.match(
    /\\section\*?\s*\{[^}]*experience[^}]*\}([\s\S]*?)(?=\\section\*?\s*\{|\\end\s*\{document\}|$)/i,
  )

  if (experienceMatch) {
    return experienceMatch[1]
  }

  return texContent
}

function extractCommandBodies(text: string, commandName: string): string[] {
  const results: string[] = []
  const command = `\\${commandName}`
  let searchIndex = 0

  while (searchIndex < text.length) {
    const start = text.indexOf(command, searchIndex)
    if (start === -1) break

    let cursor = start + command.length
    while (cursor < text.length && /\s/.test(text[cursor])) {
      cursor += 1
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
      results.push(text.slice(cursor + 1, end))
    }

    searchIndex = cursor + 1
  }

  return results
}

function extractItemBodies(text: string): string[] {
  const results: string[] = []
  const itemRe = /\\item(?![A-Za-z])/g
  let searchIndex = 0

  while (searchIndex < text.length) {
    itemRe.lastIndex = searchIndex
    const itemMatch = itemRe.exec(text)
    if (!itemMatch) break

    let cursor = itemRe.lastIndex
    while (cursor < text.length && /\s/.test(text[cursor])) {
      cursor += 1
    }

    let value = ''
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
        value = text.slice(cursor + 1, end)
        searchIndex = end + 1
      } else {
        searchIndex = cursor + 1
      }
    } else {
      const rest = text.slice(cursor)
      const stop = rest.search(/\\item(?![A-Za-z])|\\end\s*\{|\\begin\s*\{|\\resume[A-Za-z]*/)
      const cutOff = stop === -1 ? text.length : cursor + stop
      value = text.slice(cursor, cutOff)
      searchIndex = cutOff
    }

    if (value.trim()) {
      results.push(value)
    }
  }

  return results
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
    .replace(/\\[~^]/g, ' ')
    .replace(/\\,/g, ' ')
    .replace(/\\-/g, '-')
    .replace(/\\\s+/g, ' ')
    .replace(/(?<!\\)\{+|(?<!\\)\}+|\[+|\]+|\(+|\)+/g, ' ')
    .replace(/(?<!\\)\$/g, ' ')
    .replace(/\\\\/g, ' ')
    .replace(/\\([&%$#_{}])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}
