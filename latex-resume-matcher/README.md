# LaTeX Resume Matcher

A React and Express application that extracts experience bullets from a LaTeX resume and creates a tailored `.tex` copy for a pasted job description.

## Features

- Parses `resumeItem`, `resumeSubItem`, and standard `\item` bullets
- Optionally tailors bullets with a local Ollama model
- Falls back to conservative local rewriting when Ollama is unavailable
- Generates timestamped LaTeX output and a `latest-tailored.tex` copy
- Compiles a PDF when `pdflatex` or `latexmk` is available
- Provides direct `.tex` and `.pdf` downloads

## Run locally

```sh
pnpm install
pnpm dev
```

Open `http://localhost:5173`. The API runs on `http://localhost:3001`.

## Optional Ollama integration

Install and run Ollama, then configure:

```sh
export OLLAMA_MODEL=llama3.1
export OLLAMA_BASE_URL=http://localhost:11434
pnpm dev
```

If Ollama is unavailable or returns an invalid response, the app uses its local fallback without changing unrelated resume sections.

## Optional PDF generation

Install a LaTeX distribution containing `pdflatex` (for example, TeX Live). The server detects it through `PATH` or common Linux installation directories.

## Commands

```sh
pnpm build
pnpm lint
pnpm test
pnpm dev
```

Generated files are written to `output/` and are available through `/api/download` once generated.
