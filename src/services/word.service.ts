
import { Injectable } from '@angular/core';

export const FONT_MAP_PT: Record<string, number> = {
  '二号': 22,
  '小二': 18,
  '三号': 16,
  '小三': 15,
  '四号': 14,
  '小四': 12,
  '五号': 10.5,
  '小五': 9
};

export interface ThesisConfig {
  margins: { top: number; bottom: number; left: number; right: number };
  fonts: { cn: string; en: string };
  title: { size: string; bold: boolean; center: boolean };
  abstract: { size: string; titleBold: boolean };
  body: { size: string; bold: boolean; lineSpacing: number };
  references: { titleSize: string; titleBold: boolean; contentSize: string };
}

export interface ThesisContent {
  title: string;
  abstract: string;
  keywords: string;
  body: string;
  refs: string;
}

@Injectable({
  providedIn: 'root'
})
export class WordService {

  // Regex to identify headings: "1.", "1.1", "一、"
  readonly HEADING_REGEX = /^\s*(\d+(\.\d+)*|[一二三四五六七八九十]+)[.、\s]/;

  constructor() { }

  /**
   * Generates and downloads the DOCX file based on strict configuration
   */
  async generateStrictDoc(content: ThesisContent, config: ThesisConfig) {
    const docx = (window as any).docx;
    const saveAs = (window as any).saveAs;

    if (!docx || !saveAs) {
      throw new Error('Required libraries (docx, FileSaver) not loaded.');
    }

    const { Document, Packer, Paragraph, TextRun, AlignmentType, PageBreak } = docx;

    // --- Helpers ---
    const cmToTwip = (cm: number) => Math.round(cm * 567);
    const getHalfPoints = (name: string) => (FONT_MAP_PT[name] || 12) * 2;
    const lineSpacingRule = Math.round(240 * config.body.lineSpacing);

    /**
     * Splits text into English/Number and Chinese segments to strictly apply fonts.
     * This is more reliable than using composite fonts in a single run.
     */
    const createSmartRuns = (text: string, sizeHalfPts: number, isBold: boolean) => {
      if (!text) return [];
      
      // Split by non-ASCII characters (Chinese, full-width punctuation, etc.)
      const parts = text.split(/([^\x00-\x7f]+)/);

      return parts.map(part => {
        if (!part) return null;

        const isChinese = /[^\x00-\x7f]/.test(part);
        const selectedFont = isChinese ? config.fonts.cn : config.fonts.en;

        return new TextRun({
          text: part,
          bold: isBold,
          size: sizeHalfPts,
          font: {
            name: selectedFont,
            // Explicitly force the mapped font families
            eastAsia: isChinese ? selectedFont : undefined,
            ascii: !isChinese ? selectedFont : undefined,
            hAnsi: !isChinese ? selectedFont : undefined,
            hint: isChinese ? 'eastAsia' : undefined 
          }
        });
      }).filter(Boolean);
    };

    const children: any[] = [];

    // 1. Title
    children.push(new Paragraph({
      alignment: config.title.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { line: lineSpacingRule, after: lineSpacingRule }, // Add some space after title
      children: createSmartRuns(content.title, getHalfPoints(config.title.size), config.title.bold),
    }));

    // 2. Abstract
    if (content.abstract) {
      // "摘要：" Title part
      const abstractTitleRuns = createSmartRuns("摘要：", getHalfPoints(config.abstract.size), config.abstract.titleBold);
      // Abstract body part
      const abstractBodyRuns = createSmartRuns(content.abstract, getHalfPoints(config.abstract.size), false);

      children.push(new Paragraph({
        spacing: { line: lineSpacingRule },
        children: [...abstractTitleRuns, ...abstractBodyRuns],
      }));
    }

    // 3. Keywords
    if (content.keywords) {
       // "关键词：" Title part
      const keywordTitleRuns = createSmartRuns("关键词：", getHalfPoints(config.abstract.size), config.abstract.titleBold);
      const keywordBodyRuns = createSmartRuns(content.keywords, getHalfPoints(config.abstract.size), false);

      children.push(new Paragraph({
        spacing: { line: lineSpacingRule, after: 240 },
        children: [...keywordTitleRuns, ...keywordBodyRuns],
      }));
    }

    // 4. Body (Smart Heading Detection)
    const paragraphs = content.body.split('\n').filter(p => p.trim() !== '');
    paragraphs.forEach(pText => {
      const isHeading = this.HEADING_REGEX.test(pText);
      const shouldBold = isHeading || config.body.bold;

      // Indentation Logic:
      // If it is a heading: Flush left (No indent)
      // If it is body text: Indent 2 chars (approx 480 twips)
      const firstLineIndent = isHeading ? 0 : 480;

      children.push(new Paragraph({
        spacing: { line: lineSpacingRule },
        indent: { firstLine: firstLineIndent }, 
        children: createSmartRuns(pText, getHalfPoints(config.body.size), shouldBold),
      }));
    });

    // 5. References
    if (content.refs.trim()) {
      // Page Break before references
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        pageBreakBefore: true,
        spacing: { line: lineSpacingRule, after: 240 },
        children: createSmartRuns("参考文献", getHalfPoints(config.references.titleSize), config.references.titleBold),
      }));

      const refList = content.refs.split('\n').filter(r => r.trim() !== '');
      refList.forEach(r => {
        children.push(new Paragraph({
          spacing: { line: lineSpacingRule },
          children: createSmartRuns(r, getHalfPoints(config.references.contentSize), false),
        }));
      });
    }

    // --- Build Document ---
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: {
              top: cmToTwip(config.margins.top),
              bottom: cmToTwip(config.margins.bottom),
              left: cmToTwip(config.margins.left),
              right: cmToTwip(config.margins.right),
            }
          }
        },
        children: children,
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, "formatted_thesis.docx");
  }
}
