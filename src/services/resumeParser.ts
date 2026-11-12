import path from 'path';
import fs from 'fs/promises';
import { parse } from 'latex-compiler';

export async function parseResume(filePath: string): Promise<{ experience: string[] }> {
  const content = await fs.readFile(filePath, 'utf-8');
  const { document } = await parse(content);

  // Extract experience section
  const experienceSections = document.sections
    .filter(section => section.title.toLowerCase().includes('experience'))
    .flatMap(section => section.paragraphs);

  return {
    experience: experienceSections.map(p => p.text).filter(text => text.trim() !== '')
  };
}

export async function analyzeJobDescription(filePath: string): Promise<{ keywords: string[] }> {
  const content = await fs.readFile(filePath, 'utf-8');
  // Implement your keyword extraction logic here
  // For now, we'll use a simple keyword matcher
  const keywords = content.match(/\textbf{([^}]*)}/g)?.map(k => k.slice(8, -1)) || [];
  return { keywords };
}