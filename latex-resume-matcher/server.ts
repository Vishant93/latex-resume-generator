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

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json({ limit: '10mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, message: 'resume tailoring service is running' })
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
      status: compiledPdf.pdfPath
        ? 'Tailored copy was generated and compiled successfully.'
        : 'Tailored copy was generated. Install pdflatex to produce a PDF.',
      compileError: compiledPdf.error ?? undefined,
    })
  } catch (error) {
    console.error('Error tailoring resume:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'An unexpected error occurred while tailoring the resume.',
    })
  }
})

app.listen(port, '127.0.0.1', () => {
  console.log(`resume tailoring service running on http://localhost:${port}`)
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function escapeLatexText(value: string): string {
  const map: Record<string, string> = {
    '\\': '\\textbackslash{}',
    '&': '\\&',
    '%': '\\%',
    '$': '\\$',
    '#': '\\#',
    '_': '\\_',
    '{': '\\{',
    '}': '\\}',
    '~': '\\textasciitilde{}',
    '^': '\\textasciicircum{}',
  }

  return value.replace(/[\\&%$#_{}~^]/g, (character) => map[character]).replace(/\s+/g, ' ').trim()
}

function extractJobKeywords(jobDescription: string): string[] {
  const stopWords = new Set([
    'with', 'from', 'into', 'that', 'this', 'have', 'will', 'your', 'their', 'them', 'about', 'across',
    'through', 'using', 'team', 'teams', 'where', 'what', 'when', 'work', 'works', 'within', 'over',
    'after', 'before', 'being', 'skills', 'experience', 'job', 'description', 'linkedin', 'role', 'responsibilities',
    'develop', 'developed', 'build', 'building', 'support', 'supports', 'supporting', 'create', 'created',
    'also', 'like', 'such', 'must', 'able', 'including', 'company', 'companies', 'strong', 'desired', 'years',
  ])

  const tokens = jobDescription
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !stopWords.has(token))

  return [...new Set(tokens)].slice(0, 16)
}

function rewriteBulletForRole(original: string, keywords: string[]): string {
  const cleaned = original.replace(/\s+/g, ' ').trim()

  if (!cleaned) return cleaned

  const keywordText = keywords.length > 0 ? keywords.slice(0, 4).join(', ') : 'the role core objectives'
  const trimmed = cleaned.endsWith('.') ? cleaned.slice(0, -1) : cleaned

  return `${trimmed} aligned with ${keywordText}.`
}

async function tailorBullets(
  bulletEntries: Array<{ id: string; text: string; raw: string; experienceTitle: string }>,
  jobDescription: string,
): Promise<Array<{ id: string; text: string }>> {
  const ollamaModel = process.env.OLLAMA_MODEL ?? 'llama3.1'
  const ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'

  try {
    const aiResponse = await fetch(`${ollamaBaseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: ollamaModel,
        prompt: `You are a resume tailoring assistant.
Return only valid JSON with this schema:
{"bullets":[{"id":"exp-001","text":"..."},...]}
Keep the original accomplishment and improve phrasing for the job.
Do not invent experience that is not in the input.
Do not modify unrelated sections.

Job description:
${jobDescription}

Bullets:
${bulletEntries.map((bullet) => `${bullet.id}: ${bullet.text}`).join('\n')}`,
        stream: false,
      }),
    })

    if (aiResponse.ok) {
      const payload = await aiResponse.json() as { response?: string }
      const jsonText = payload.response ?? ''
      const parsed = parseJsonResponse(jsonText)

      if (parsed && parsed.bullets?.length) {
        return parsed.bullets.map((bullet) => ({
          id: String(bullet.id),
          text: String(bullet.text),
        }))
      }
    }
  } catch {
    // Fall through to heuristic tailoring below.
  }

  const keywords = extractJobKeywords(jobDescription)

  const scoredBullets = bulletEntries.map((entry) => {
    const normalized = entry.text.toLowerCase()
    const score = keywords.reduce((total, keyword) => {
      const keywordMatch = normalized.includes(keyword.toLowerCase()) ? 2 : 0
      return total + keywordMatch
    }, 0)

    return {
      id: entry.id,
      text: rewriteBulletForRole(entry.text, keywords),
      score,
    }
  })

  const fallbackMessages = scoredBullets.map((entry) => ({
    ...entry,
    score: entry.score + (entry.text.toLowerCase().includes('develop') ? 1 : 0),
  }))

  const sorted = [...fallbackMessages].sort((a, b) => b.score - a.score)
  const orderedBullets = sorted.map((entry) => ({ id: entry.id, text: entry.text }))

  const orderedMap = new Map(orderedBullets.map((entry) => [entry.id, entry.text]))
  return bulletEntries.map((entry) => ({
    id: entry.id,
    text: orderedMap.get(entry.id) ?? entry.text,
  }))
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

    const escaped = escapeLatexText(replacementText)
    updatedText = updatedText.replace(commandMatcher, (_m, open: string, close: string) => `${open}${escaped}${close}`)
  }

  return updatedText
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
        ['-no-shell-escape', '-interaction=nonstopmode', '-halt-on-error', '-output-directory', path.dirname(texFilePath), texFilePath],
        {
          cwd: path.dirname(texFilePath),
          timeout: 30_000,
          env: { ...process.env, openin_any: 'p' },
        },
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
  const candidates = ['pdflatex', 'latexmk']

  for (const executable of candidates) {
    try {
      await fs.access(`/usr/bin/${executable}`)
      return `/usr/bin/${executable}`
    } catch {
      // ignore and try the next candidate
    }
  }

  return null
}
