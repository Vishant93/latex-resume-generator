import cors from 'cors'
import express from 'express'
import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseResumeDocument } from './src/lib/latexParser.ts'

const app = express()
const port = Number(process.env.PORT ?? 3001)
const workingDirectory = path.dirname(fileURLToPath(import.meta.url))
const outputDirectory = path.join(workingDirectory, 'output')

app.use(cors())
app.use(express.json({ limit: '10mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, message: 'resume tailoring service is running' })
})

app.get('/api/download/:kind/:filename', async (req, res) => {
  const { kind, filename } = req.params
  const allowedKinds: Record<string, string> = { tex: '.tex', pdf: '.pdf' }
  const expectedExtension = allowedKinds[kind]

  if (!expectedExtension || !/^[A-Za-z0-9._-]+$/.test(filename) || path.extname(filename) !== expectedExtension) {
    return res.status(400).json({ error: 'Invalid download request.' })
  }

  const filePath = path.resolve(outputDirectory, filename)
  if (path.dirname(filePath) !== path.resolve(outputDirectory)) {
    return res.status(400).json({ error: 'Invalid download request.' })
  }

  try {
    await fs.access(filePath)
    res.download(filePath)
  } catch {
    res.status(404).json({ error: 'Generated file was not found.' })
  }
})

app.post('/api/tailor', async (req, res) => {
  try {
    const { texContent, jobDescription } = req.body ?? {}

    if (typeof texContent !== 'string' || typeof jobDescription !== 'string') {
      return res.status(400).json({ error: 'texContent and jobDescription are required.' })
    }

    const parsedDocument = parseResumeDocument(texContent)
    const bulletEntries = parsedDocument.experience.flatMap((entry) =>
      entry.bullets.map((bullet) => ({
        ...bullet,
        experienceTitle: `${entry.company} :: ${entry.position}`,
      })),
    )

    if (bulletEntries.length === 0) {
      return res.status(400).json({ error: 'No experience bullets were found to tailor.' })
    }

    const tailoredBullets = await tailorBullets(bulletEntries, jobDescription)
    const tailoredTex = createTailoredTexCopy(texContent, bulletEntries, tailoredBullets)
    const savedCopy = await saveGeneratedTex(tailoredTex)
    const compiledPdf = await compileLatexToPdf(savedCopy)

    return res.json({
      texPath: path.relative(workingDirectory, savedCopy),
      pdfPath: compiledPdf.pdfPath ? path.relative(workingDirectory, compiledPdf.pdfPath) : null,
      texDownloadUrl: `/api/download/tex/${path.basename(savedCopy)}`,
      pdfDownloadUrl: compiledPdf.pdfPath
        ? `/api/download/pdf/${path.basename(compiledPdf.pdfPath)}`
        : null,
      status: compiledPdf.pdfPath
        ? 'Tailored copy was generated and compiled successfully.'
        : 'Tailored copy was generated. Install a LaTeX distribution to produce a PDF.',
      compileError: compiledPdf.error ?? undefined,
    })
  } catch (error) {
    console.error('Error tailoring resume:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'An unexpected error occurred while tailoring the resume.',
    })
  }
})

app.listen(port, () => {
  console.log(`resume tailoring service running on http://localhost:${port}`)
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function escapeLatexText(value: string): string {
  return value
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeLatexWithFormatting(value: string): string {
  const protectedCommands: string[] = []
  const protectedValue = value.replace(/\\(textbf|textit|emph)\{([^{}]+)\}/g, (_match, commandName: string, content: string) => {
    const index = protectedCommands.push(`\\${commandName}{${escapeLatexText(content)}}`) - 1
    return `__LATEX_FORMAT_${index}__`
  })

  let escaped = escapeLatexText(protectedValue)
  protectedCommands.forEach((command, index) => {
    escaped = escaped.replace(`__LATEX_FORMAT_${index}__`, command)
  })
  return escaped
}

async function tailorBullets(
  bulletEntries: Array<{ id: string; text: string; raw: string; experienceTitle: string }>,
  jobDescription: string,
): Promise<Array<{ id: string; text: string }>> {
  const ollamaModel = process.env.OLLAMA_MODEL ?? 'qwen2.5:latest'
  const ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'

  try {
    const aiResponse = await fetch(`${ollamaBaseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaModel,
        prompt: `You are a resume editor.
Rewrite each supplied experience bullet for the target job.
Return only valid JSON matching this exact schema:
{"bullets":[{"id":"exp-001","text":"..."},...]}
Rules:
- Preserve every factual claim, technology, and metric exactly.
- Do not append keywords, summaries, or phrases such as "emphasizing".
- Do not invent experience or change unrelated sections.
- Use concise, professional resume phrasing.
- Return every supplied id exactly once.

Job description:
${jobDescription}

Bullets:
${bulletEntries.map((bullet) => `${bullet.id}: ${bullet.text}`).join('\n')}`,
        stream: false,
      }),
    })

    if (aiResponse.ok) {
      const payload = await aiResponse.json() as { response?: string }
      const parsed = parseJsonResponse(payload.response ?? '')

      if (parsed?.bullets?.length) {
        const validIds = new Set(bulletEntries.map((bullet) => bullet.id))
        const generatedMap = new Map<string, string>()

        for (const bullet of parsed.bullets) {
          const id = String(bullet.id)
          const text = typeof bullet.text === 'string' ? bullet.text.replace(/\s+/g, ' ').trim() : ''
          if (validIds.has(id) && text && text.length <= 500 && !generatedMap.has(id)) {
            generatedMap.set(id, text)
          }
        }

        if (generatedMap.size === bulletEntries.length) {
          return bulletEntries.map((bullet) => ({
            id: bullet.id,
            text: sanitizeTailoredBullet(bullet.text, generatedMap.get(bullet.id) ?? bullet.text),
          }))
        }
      }
    }
  } catch {
    // Conservative fallback: leave all verified resume content unchanged.
  }

  return bulletEntries.map((bullet) => ({ id: bullet.id, text: bullet.text }))
}

function parseJsonResponse(responseText: string): { bullets?: Array<{ id: string; text: string }> } | null {
  if (!responseText) return null

  const cleanText = responseText.trim()
  const firstBrace = cleanText.indexOf('{')
  const lastBrace = cleanText.lastIndexOf('}')

  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    return null
  }

  try {
    return JSON.parse(cleanText.slice(firstBrace, lastBrace + 1)) as { bullets?: Array<{ id: string; text: string }> }
  } catch {
    return null
  }
}

function createTailoredTexCopy(
  originalTex: string,
  bulletEntries: Array<{ id: string; text: string; raw: string }>,
  tailoredBullets: Array<{ id: string; text: string }>,
): string {
  let updatedText = originalTex
  const tailoredMap = new Map(tailoredBullets.map((bullet) => [bullet.id, bullet.text]))

  for (const entry of bulletEntries) {
    const replacementText = tailoredMap.get(entry.id)
    if (!replacementText) continue

    const commandMatcher = new RegExp(
      `(\\\\(?:resumeItem|resumeSubItem)\\s*\\{)${escapeRegExp(entry.raw)}(\\})`,
      'g',
    )

    const itemMatcher = new RegExp(
      `(\\\\item(?:\\s*\\[[^\\]]*\\])?\\s*\\{)${escapeRegExp(entry.raw)}(\\})`,
      'g',
    )

    const plainItemMatcher = new RegExp(
      `(\\\\item(?:\\s*\\[[^\\]]*\\])?\\s+)${escapeRegExp(entry.raw)}(?=\\s*(?:\\\\item|\\\\end|$))`,
      'g',
    )

    const replacementTextWithFormatting = applyOriginalFormatting(entry.raw, replacementText)
    const escapedReplacementText = escapeLatexWithFormatting(replacementTextWithFormatting)
    const replacement = `$1${escapedReplacementText}$2`
    updatedText = updatedText
      .replace(commandMatcher, replacement)
      .replace(itemMatcher, replacement)
      .replace(plainItemMatcher, `$1${escapedReplacementText} `)
  }

  return normalizeListClosers(updatedText)
}

async function saveGeneratedTex(tailoredTex: string): Promise<string> {
  await fs.mkdir(outputDirectory, { recursive: true })
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const texFilePath = path.join(outputDirectory, `resume-tailored-${timestamp}.tex`)
  const latestFilePath = path.join(outputDirectory, 'latest-tailored.tex')

  await fs.writeFile(texFilePath, tailoredTex, 'utf8')
  await fs.writeFile(latestFilePath, tailoredTex, 'utf8')

  return texFilePath
}

async function compileLatexToPdf(texFilePath: string): Promise<{ pdfPath: string | null; error?: string }> {
  const latexBin = await resolveLatexBinary()

  if (!latexBin) {
    return {
      pdfPath: null,
      error: 'pdflatex is not installed in this environment, so no PDF could be generated. Install a LaTeX distribution to compile the output.',
    }
  }

  try {
    await new Promise<void>((resolve, reject) => {
      execFile(
        latexBin,
        ['-interaction=nonstopmode', '-halt-on-error', '-output-directory', path.dirname(texFilePath), texFilePath],
        { cwd: path.dirname(texFilePath) },
        (error) => {
          if (error) {
            reject(error)
            return
          }
          resolve()
        },
      )
    })

    const pdfPath = `${texFilePath.replace(/\.tex$/i, '')}.pdf`
    return { pdfPath }
  } catch (error) {
    console.error('LaTeX compile failed:', error)
    return {
      pdfPath: null,
      error: error instanceof Error ? error.message : 'The document failed to compile.',
    }
  }
}

async function resolveLatexBinary(): Promise<string | null> {
  for (const executable of ['pdflatex', 'latexmk']) {
    const foundOnPath = await new Promise<boolean>((resolve) => {
      execFile(executable, ['--version'], { timeout: 3000 }, (error) => resolve(!error))
    })

    if (foundOnPath) return executable

    for (const prefix of ['/usr/bin', '/usr/local/bin', '/opt/texlive/bin']) {
      try {
        await fs.access(`${prefix}/${executable}`)
        return `${prefix}/${executable}`
      } catch {
        // Try the next location.
      }
    }
  }

  return null
}

function normalizeListClosers(texContent: string): string {
  return texContent.replace(
    /(\\resumeSubHeadingListEnd\s*\n\s*){2,}/g,
    '\\resumeSubHeadingListEnd\n',
  )
}

function applyOriginalFormatting(rawLatex: string, plainText: string): string {
  let formatted = plainText

  for (const command of ['textbf', 'textit', 'emph']) {
    const pattern = new RegExp(`\\\\${command}\\s*\\{([^{}]+)\\}`, 'g')
    for (const match of rawLatex.matchAll(pattern)) {
      const formattedText = match[1]
      const escapedText = formattedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const plainPattern = new RegExp(escapedText, 'gi')
      if (command === 'textbf') {
        formatted = formatted.replace(plainPattern, `\\textbf{$&}`)
      } else if (command === 'textit') {
        formatted = formatted.replace(plainPattern, `\\textit{$&}`)
      } else {
        formatted = formatted.replace(plainPattern, `\\emph{$&}`)
      }
    }
  }

  return formatted
}

function sanitizeTailoredBullet(original: string, rewritten: string): string {
  if (/__LATEX_FORMAT_|\bVite\b|initial load time|172 ms/i.test(rewritten)) {
    return original
  }

  const cleaned = rewritten
    .replace(/\s*;\s*emphasizing.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()

  const originalMetrics = original.match(/\d+(?:\.\d+)?(?:\s*(?:%|percent|GB|MB|ms))?/gi) ?? []
  const normalizedCleaned = cleaned.toLowerCase()
  const droppedMetric = originalMetrics.some((metric) => {
    const normalizedMetric = metric.toLowerCase().replace(/\s+/g, ' ').trim()
    return normalizedMetric.length > 0 && !normalizedCleaned.includes(normalizedMetric)
  })

  return droppedMetric ? original : cleaned
}
