import { useState, type ChangeEvent, type FormEvent } from 'react'
import { parseExperienceBullets } from './lib/latexParser'
import './App.css'

function App() {
  const [texFile, setTexFile] = useState<File | null>(null)
  const [jobDescription, setJobDescription] = useState('')
  const [experienceBullets, setExperienceBullets] = useState<string[]>([])
  const [parseError, setParseError] = useState('')

  const handleTexFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]

    if (!file) {
      setTexFile(null)
      setExperienceBullets([])
      setParseError('')
      return
    }

    if (!file.name.toLowerCase().endsWith('.tex')) {
      setTexFile(null)
      setExperienceBullets([])
      setParseError('Please upload a .tex file.')
      return
    }

    try {
      const content = await file.text()
      const bullets = parseExperienceBullets(content)

      setTexFile(file)
      setExperienceBullets(bullets)
      setParseError(bullets.length === 0 ? 'No experience bullets were found in that LaTeX resume.' : '')
    } catch (error) {
      console.error('Failed to parse .tex file', error)
      setTexFile(file)
      setExperienceBullets([])
      setParseError('The file could not be parsed as LaTeX.')
    }
  }

  const handleJobDescriptionChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setJobDescription(e.target.value)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    console.log('Uploaded .tex file:', texFile)
    console.log('Experience bullets:', experienceBullets)
    console.log('Job Description:', jobDescription)
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
        <button type="submit" className="submit-button">
          Match Resume
        </button>
      </form>
    </div>
  )
}

export default App
