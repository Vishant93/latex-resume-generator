---
name: resume-tailoring-safety
description: "Use when tailoring, rewriting, comparing, repairing, or compiling a LaTeX resume. Preserve source facts and metrics, PDF formatting, and original LaTeX structure."
argument-hint: "Describe the resume tailoring or PDF repair task"
user-invocable: true
disable-model-invocation: false
---

# Resume Tailoring Safety

## When to Use

Use this workflow for resume text rewriting, LaTeX/PDF generation, PDF comparison, compile failures, formatting regressions, or restoring a user-provided resume.

## Core Rules

1. The user's original PDF and uploaded `.tex` source are the factual baseline.
2. Never invent jobs, employers, technologies, tools, outcomes, metrics, dates, locations, or qualifications.
3. Preserve every number and unit, especially percentages, GB/MB values, response-time values, and incident reductions.
4. Preserve or improve existing `\textbf`, `\textit`, `\emph`, and `\href` markup. Never emit placeholder strings such as `__LATEX_FORMAT_*__`.
5. Never append keywords or phrases such as `emphasizing`, `emphasizing the`, or keyword lists.
6. Never reorder bullet content merely to match a job description.
7. If a rewrite cannot be validated against the source, leave the original bullet unchanged.
8. Do not remove comments or unrelated resume sections unless the user explicitly requests it.

## Required Procedure

1. Read the resume source and identify the trusted reference.
   - Prefer `~/Downloads/Resume.pdf` when it exists.
   - Also inspect generated `.tex` files under `output/`.
2. Extract the original PDF text before making changes.
   - `pdftotext -layout ~/Downloads/Resume.pdf /tmp/reference-resume.txt`
3. Compare the current output with the reference.
   - Compare factual claims, dates, metrics, percentages, technologies, and formatting.
4. Make the smallest possible change.
   - Prefer exact restoration over AI paraphrasing.
   - Rewrite only supplied experience bullets.
5. Escape LaTeX safely.
   - Percent signs must be written as `\%` in LaTeX source.
   - Preserve ampersands with `\&`.
   - Preserve supported formatting commands while escaping replacement text.
6. Validate list structure.
   - Every `resumeSubHeadingListStart` needs one matching end.
   - Every `resumeItemListStart` needs one matching end.
   - Never generate duplicate list closers.
7. Compile and compare.
   - Run `pdflatex -interaction=nonstopmode -halt-on-error -output-directory=output <tex-file>`.
   - Extract text with `pdftotext -layout`.
   - Confirm all reference metrics appear exactly in the PDF.
8. If the PDF cannot be compared safely, report that and stop rather than guessing.

## Fallback Behavior

When Ollama or another model is unavailable, invalid, or unable to preserve facts:

- Keep every original bullet unchanged.
- Keep the original LaTeX formatting.
- Generate the PDF and clearly report that tailoring was not performed.

## Output Checklist

Before finishing, verify:

- No invented Vite, server, load-time, or other unrelated content.
- No `__LATEX_FORMAT_*__` placeholders.
- No `emphasizing` suffixes.
- No removed `%` signs or changed metrics.
- Bold and italic fragments remain bold or italic when present in the source.
- PDF text matches the original factual baseline.
- Tests and build pass.
