import { useState, type ChangeEvent, type FormEvent } from 'react'
import { parseResumeDocument } from './lib/latexParser'
import './App.css'

type TailorResult = {
  texPath: string
  pdfPath: string | null
  texDownloadUrl: string
  pdfDownloadUrl: string | null
  status: string
  compileError?: string
}

function App() {
  const [texFile, setTexFile] = useState<File | null>(null)
  const [texContent, setTexContent] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [experienceBullets, setExperienceBullets] = useState<string[]>([])
  const [parseError, setParseError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [tailorResult, setTailorResult] = useState<TailorResult | null>(null)

  const handleTexFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]

    if (!file) {
      setTexFile(null)
      setTexContent('')
      setExperienceBullets([])
      setTailorResult(null)
      setParseError('')
      return
    }

    if (!file.name.toLowerCase().endsWith('.tex')) {
      setTexFile(null)
      setTexContent('')
      setExperienceBullets([])
      setTailorResult(null)
      setParseError('Please upload a .tex file.')
      return
    }

    try {
      const content = await file.text()
      const document = parseResumeDocument(content)
      const bullets = document.experience.flatMap((entry) => entry.bullets.map((bullet) => bullet.text))

      setTexFile(file)
      setTexContent(content)
      setExperienceBullets(bullets)
      setParseError(bullets.length === 0 ? 'No experience bullets were found in that LaTeX resume.' : '')
      setTailorResult(null)
    } catch (error) {
      console.error('Failed to parse .tex file', error)
      setTexFile(file)
      setTexContent('')
      setExperienceBullets([])
      setTailorResult(null)
      setParseError('The file could not be parsed as LaTeX.')
    }
  }

  const handleJobDescriptionChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setJobDescription(e.target.value)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!texContent || !jobDescription.trim()) {
      setParseError('Upload a .tex file and paste a job description before tailoring.')
      return
    }

    setIsSubmitting(true)
    setParseError('')

    try {
      const response = await fetch('/api/tailor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          texContent,
          jobDescription,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || 'The resume tailoring request failed.')
      }

      setTailorResult(data)
    } catch (error) {
      console.error('Failed to tailor resume', error)
      setParseError(error instanceof Error ? error.message : 'The resume could not be tailored.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="App">
      <h1>Resume Matcher App</h1>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="texFile">Upload .tex File</label>
          <input
            type="file"
            id="texFile"
            onChange={handleTexFileUpload}
            accept=".tex"
            required
          />
        </div>

        {texFile && (
          <div className="results-card">
            <h2>Experience bullets</h2>
            {experienceBullets.length > 0 ? (
              <ul className="bullet-list">
                {experienceBullets.map((bullet, index) => (
                  <li key={`${bullet}-${index}`}>{bullet}</li>
                ))}
              </ul>
            ) : (
              <p>No experience bullets found.</p>
            )}
          </div>
        )}

        {parseError && <p className="error-message">{parseError}</p>}

        <div className="form-group">
          <label htmlFor="jobDescription">Paste LinkedIn Job Description</label>
          <textarea
            id="jobDescription"
            value={jobDescription}
            onChange={handleJobDescriptionChange}
            rows={6}
            placeholder="Paste your job description here..."
            required
          ></textarea>
        </div>

        <button type="submit" className="submit-button" disabled={isSubmitting || !texFile || !jobDescription.trim()}>
          {isSubmitting ? 'Tailoring resume...' : 'Tailor Resume'}
        </button>
      </form>

      {tailorResult && (
        <div className="results-card">
          <h2>Tailored output</h2>
          <p>{tailorResult.status}</p>
          <div className="download-actions">
            <a className="download-link" href={tailorResult.texDownloadUrl} download>
              Download tailored LaTeX
            </a>
            {tailorResult.pdfDownloadUrl && (
              <a className="download-link" href={tailorResult.pdfDownloadUrl} download>
                Download PDF
              </a>
            )}
          </div>
          {tailorResult.compileError && <p className="error-message">{tailorResult.compileError}</p>}
        </div>
      )}
    </div>
  )
}

export default App
