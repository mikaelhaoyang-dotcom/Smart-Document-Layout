
import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WordService, ThesisConfig, ThesisContent, FONT_MAP_PT } from './services/word.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
})
export class AppComponent {
  wordService = inject(WordService);

  // --- State ---
  activeTab = signal<'config' | 'content'>('config');

  // Config State
  config = signal<ThesisConfig>({
    margins: { top: 2.5, bottom: 2.5, left: 3.0, right: 2.0 },
    fonts: { cn: 'SimSun', en: 'Times New Roman' },
    title: { size: '小二', bold: true, center: true },
    abstract: { size: '小四', titleBold: true },
    body: { size: '小四', bold: false, lineSpacing: 1.5 },
    references: { titleSize: '小四', titleBold: true, contentSize: '小四' }
  });

  // Content State
  content = signal<ThesisContent>({
    title: '基于Web的自动化排版系统',
    abstract: '本文介绍了一种在线排版工具，能够自动生成符合学术规范的Word文档。能够严格控制字体、字号和间距。',
    keywords: '自动化; 排版; Angular; TypeScript',
    body: `1. 引言
传统的论文排版需要大量的手工调整，非常耗时。使用本工具，您可以专注于写作，格式问题交给我们。

2. 系统设计
这里演示第二段内容。可以看到，"2. 系统设计"这一行会自动加粗且顶格，而普通正文段落会首行缩进两字符。

2.1 字体处理
所有的中文都会自动应用配置的字体（如宋体），而数字如 123 和英文 Text 都会应用西文字体。

3. 结论
自动识别功能让排版更轻松。`,
    refs: `[1] 张三. 网页自动化技术[J]. 软件学报, 2024.
[2] Doe J. Web Document Generation[M]. IEEE Press, 2023.`
  });

  // --- Computed Helpers for Preview ---
  
  // Font styles string
  fontFamilyStyle = computed(() => {
    return `"${this.config().fonts.en}", "${this.config().fonts.cn}", serif`;
  });

  // Split body text into paragraphs for preview
  bodyParagraphs = computed(() => {
    return this.content().body.split('\n').filter(p => p.trim() !== '').map(text => {
      const isHeading = this.wordService.HEADING_REGEX.test(text);
      return { text, isHeading };
    });
  });

  refList = computed(() => {
    return this.content().refs.split('\n').filter(r => r.trim() !== '');
  });

  // Helper to get font size in PT
  getPt(sizeName: string): number {
    return FONT_MAP_PT[sizeName] || 12;
  }

  // --- Actions ---

  setActiveTab(tab: 'config' | 'content') {
    this.activeTab.set(tab);
  }

  async downloadDoc() {
    try {
      await this.wordService.generateStrictDoc(this.content(), this.config());
    } catch (e) {
      console.error(e);
      alert('生成文档时出错，请检查控制台。');
    }
  }

  // Helper for 2-way binding nested objects in signals (simple approach for this app)
  updateConfig(path: string, value: any) {
    this.config.update(c => {
      const newConfig = JSON.parse(JSON.stringify(c)); // Deep copy
      const parts = path.split('.');
      let current = newConfig;
      for (let i = 0; i < parts.length - 1; i++) {
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = value;
      return newConfig;
    });
  }

  updateContent(field: keyof ThesisContent, value: string) {
    this.content.update(c => ({ ...c, [field]: value }));
  }
}
