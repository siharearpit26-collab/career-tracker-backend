import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { logger } from '../utils/logger';

// Import pdf-parse core directly to avoid the debug auto-run in index.js
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse/lib/pdf-parse.js') as (buf: Buffer) => Promise<{ text: string; numpages: number }>;

export interface ParsedResume {
  preferredRoles: string[];
  skills: string[];
  experienceYears: number;
  preferredLocations: string[];
  preferredWorkArrangement: string[];
  salaryExpectation?: number;
  salaryCurrency: string;
  summary: string;
}

const RESUME_PROMPT = `Analyze this resume. Return ONLY JSON:
{
  "preferredRoles": ["max 3 job titles this person suits"],
  "skills": ["max 10 technical skills"],
  "experienceYears": number,
  "preferredLocations": ["max 3 cities from resume"],
  "preferredWorkArrangement": ["hybrid"],
  "salaryExpectation": null,
  "salaryCurrency": "INR",
  "summary": "1 sentence profile summary"
}
Rules: Extract skills, roles, experience years. Return ONLY JSON, no markdown.`;

export class ResumeParserService {
  /**
   * Parse a PDF resume file and extract structured data using Gemini AI.
   */
  async parseResume(filePath: string): Promise<ParsedResume | null> {
    if (!config.openai.apiKey) {
      logger.warn('Gemini API key not configured — resume parsing disabled');
      logger.warn('config.openai.apiKey value:', config.openai.apiKey ? 'SET' : 'EMPTY');
      return null;
    }

    try {
      // 1. Extract text from PDF
      logger.info(`Extracting text from PDF: ${filePath}`);
      const text = await this.extractTextFromPdf(filePath);
      logger.info(`PDF text extracted: ${text.length} chars`);

      if (!text || text.trim().length < 50) {
        logger.warn('Resume PDF has insufficient text content');
        return null;
      }

      // 2. Send to Gemini for analysis
      logger.info('Sending to Gemini for analysis...');
      const parsed = await this.analyzeWithGemini(text);
      return parsed;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Resume parsing failed: ${errMsg}`);
      return null;
    }
  }

  private async extractTextFromPdf(filePath: string): Promise<string> {
    const absolutePath = path.resolve(filePath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`);
    }

    const dataBuffer = fs.readFileSync(absolutePath);
    const data = await pdfParse(dataBuffer);

    return data.text;
  }

  private async analyzeWithGemini(resumeText: string): Promise<ParsedResume | null> {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(config.openai.apiKey);

    const model = genAI.getGenerativeModel({
      model: 'gemini-3.6-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0,
        maxOutputTokens: 2000,
      },
    });

    // Truncate resume text to avoid token limits
    const truncated = resumeText.slice(0, 3000);

    const prompt = `${RESUME_PROMPT}\n\n--- RESUME TEXT ---\n${truncated}`;
    const result = await model.generateContent(prompt);
    const content = result.response.text();

    if (!content) {
      throw new Error('Empty Gemini response');
    }

    const parsed = JSON.parse(content) as ParsedResume;

    // Validate essential fields
    if (!parsed.skills || !Array.isArray(parsed.skills)) {
      throw new Error('Invalid response: missing skills array');
    }

    // Sanitize
    parsed.skills = parsed.skills.slice(0, 20).map((s) => s.trim()).filter(Boolean);
    parsed.preferredRoles = (parsed.preferredRoles ?? []).slice(0, 5).map((r) => r.trim()).filter(Boolean);
    parsed.preferredLocations = (parsed.preferredLocations ?? []).slice(0, 5).map((l) => l.trim()).filter(Boolean);
    parsed.preferredWorkArrangement = (parsed.preferredWorkArrangement ?? ['hybrid']).filter(
      (a) => ['remote', 'hybrid', 'on-site', 'onsite'].includes(a.toLowerCase())
    );
    parsed.experienceYears = Math.max(0, Math.min(30, parsed.experienceYears ?? 0));
    parsed.salaryCurrency = parsed.salaryCurrency ?? 'INR';

    logger.info(`Resume parsed: ${parsed.skills.length} skills, ${parsed.experienceYears} years, roles: ${parsed.preferredRoles.join(', ')}`);

    return parsed;
  }
}

export const resumeParserService = new ResumeParserService();
