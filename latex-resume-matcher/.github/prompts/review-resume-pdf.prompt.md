---
description: "Compare a generated resume PDF against the user's original Resume.pdf and repair factual or formatting regressions"
name: "Review and Repair Resume PDF"
argument-hint: "Optional: name of the generated PDF or generated LaTeX file"
agent: "agent"
---

Review the generated resume against `~/Downloads/Resume.pdf`.

Follow the `resume-tailoring-safety` workflow.

Required actions:

1. Extract text from the original PDF and the generated PDF.
2. Compare jobs, companies, dates, technologies, metrics, percentages, and bullet structure.
3. Restore exact original facts and formatting wherever generation introduced invented or corrupted content.
4. Remove placeholder strings and `emphasizing` keyword suffixes.
5. Preserve or restore `\textbf`, `\textit`, `\emph`, and existing LaTeX markup.
6. Compile the `.tex` file again and extract the final PDF text.
7. Report exactly what changed and verify the PDF is factually equivalent to `Resume.pdf`.

Do not invent resume content. If a rewrite cannot be safely validated against the original PDF, preserve the original bullet unchanged.
