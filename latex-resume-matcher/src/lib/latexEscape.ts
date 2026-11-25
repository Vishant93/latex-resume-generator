export function escapeLatexText(value: string): string {
  let escaped = ''

  for (const character of value) {
    switch (character) {
      case '\\': escaped += '\\textbackslash{}'; break
      case '&': escaped += '\\&'; break
      case '%': escaped += '\\%'; break
      case '$': escaped += '\\$'; break
      case '#': escaped += '\\#'; break
      case '_': escaped += '\\_'; break
      case '{': escaped += '\\{' ; break
      case '}': escaped += '\\}'; break
      case '~': escaped += '\\textasciitilde{}'; break
      case '^': escaped += '\\textasciicircum{}'; break
      default: escaped += character
    }
  }

  return escaped.replace(/\s+/g, ' ').trim()
}

export function escapeLatexWithFormatting(value: string): string {
  const protectedCommands: string[] = []
  const protectedValue = value.replace(/\\(textbf|textit|emph)\{([^{}]+)\}/g, (_match, commandName: string, content: string) => {
    const index = protectedCommands.push(`\\${commandName}{${escapeLatexText(content)}}`) - 1
    return `LATEXFORMATPLACEHOLDER${index}END`
  })

  let escaped = escapeLatexText(protectedValue)
  protectedCommands.forEach((command, index) => {
    escaped = escaped.replace(`LATEXFORMATPLACEHOLDER${index}END`, command)
  })

  return escaped
}
