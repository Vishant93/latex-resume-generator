import { parseResume, analyzeJobDescription } from './resumeParser';

export async function analyzeResume(filePath: string, jobDescriptionPath: string): Promise<{ resumeContent: string[], jobKeywords: string[] }> {
  const resume = await parseResume(filePath);
  const jobAnalysis = await analyzeJobDescription(jobDescriptionPath);
  return { resumeContent: resume.experience, jobKeywords: jobAnalysis.keywords };
}