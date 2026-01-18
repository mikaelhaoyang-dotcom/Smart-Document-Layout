
import { Injectable } from '@angular/core';
import { GoogleGenAI, Type, SchemaType } from '@google/genai';

@Injectable({
  providedIn: 'root'
})
export class AiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env['API_KEY'] || '' });
  }

  async parseFormattingRules(userPrompt: string): Promise<any> {
    const prompt = `
      You are an expert document formatting assistant. Your goal is to parse a user's natural language formatting requirements for a Word document into a structured JSON configuration.

      Map Chinese font sizes to Point (pt) sizes roughly as follows:
      - 小二 (Xiao Er) -> 18
      - 二号 (Er Hao) -> 22
      - 小三 (Xiao San) -> 15
      - 三号 (San Hao) -> 16
      - 小四 (Xiao Si) -> 12
      - 四号 (Si Hao) -> 14
      - 五号 (Wu Hao) -> 10.5
      - 小五 (Xiao Wu) -> 9

      User Input: "${userPrompt}"

      Return a JSON object with this schema:
      {
        "page": {
          "margins": { "top": number, "bottom": number, "left": number, "right": number }, // in cm. Default 2.54 if not specified.
          "lineSpacing": number // e.g., 1.5, 1.0. Default 1.5.
        },
        "styles": {
          "title": { "fontSize": number, "fontFamily": string, "bold": boolean, "alignment": "center" | "left" | "right" },
          "abstractTitle": { "fontSize": number, "fontFamily": string, "bold": boolean, "alignment": "left" | "center" },
          "abstractBody": { "fontSize": number, "fontFamily": string, "bold": boolean, "alignment": "left" | "justified" },
          "keywordsTitle": { "fontSize": number, "fontFamily": string, "bold": boolean, "alignment": "left" },
          "keywordsBody": { "fontSize": number, "fontFamily": string, "bold": boolean, "alignment": "left" },
          "heading": { "fontSize": number, "fontFamily": string, "bold": boolean, "alignment": "left" },
          "body": { "fontSize": number, "fontFamily": string, "bold": boolean, "alignment": "justified" | "left" },
          "referenceTitle": { "fontSize": number, "fontFamily": string, "bold": boolean, "alignment": "center" | "left" },
          "referenceItem": { "fontSize": number, "fontFamily": string, "bold": boolean, "alignment": "left" }
        }
      }

      CRITICAL: For "fontFamily", if the user says "Songti", "宋体", or implies a standard Chinese font, YOU MUST RETURN "SimSun". Do not return "Songti" or "Chinese Song". Use "SimSun".
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        }
      });
      return JSON.parse(response.text);
    } catch (e) {
      console.error("AI Parse Rules Error", e);
      throw e;
    }
  }

  async analyzeDocumentStructure(fullText: string): Promise<any[]> {
    // We chunk text if it's absolutely massive, but 2.5-flash handles large context.
    // We'll strip empty lines to save tokens.
    const cleanText = fullText.replace(/\n\s*\n/g, '\n').substring(0, 100000); // Limit to ~100k chars for safety/speed

    const prompt = `
      Analyze the following text extracted from an academic document.
      Break it down into a linear sequence of structural segments.
      Identify the following types:
      - 'title' (The main document title, usually the first few lines)
      - 'abstract_title' (e.g. "摘要", "Abstract")
      - 'abstract_body' (The content of the abstract)
      - 'keywords_title' (e.g. "关键词", "Keywords")
      - 'keywords_body' (The keywords list)
      - 'heading' (Section headers. **IMPORTANT**: Lines starting with numbers like "1.", "1.1", "2.1.1", "一、", "（一）" or "[1]" are almost always headings. Treat them as 'heading' type.)
      - 'body' (Normal paragraph text)
      - 'reference_title' (e.g. "参考文献", "References")
      - 'reference_item' (Individual citation entries like [1]...)

      Return a JSON array of objects. Each object must have:
      {
        "type": string,
        "text": string
      }

      Text to analyze:
      ${cleanText}
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        }
      });
      return JSON.parse(response.text);
    } catch (e) {
      console.error("AI Structure Analysis Error", e);
      throw e;
    }
  }
}
