import { useState, type ChangeEvent, type FormEvent } from 'react'
import './App.css'

function App() {
  const [texFile, setTexFile] = useState<File | null>(null)
  const [jobDescription, setJobDescription] = useState('')

  const handleTexFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type === 'application/x-tex') {
      setTexFile(file)
    }
  }

  const handleJobDescriptionChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setJobDescription(e.target.value)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    // TODO: Add logic to match resume to job description
    // For now, just log the data
    console.log('Uploaded .tex file:', texFile)
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
