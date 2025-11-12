// DocumentSummaryManager.js
// 문서를 마크다운으로 변환하고 섹션별로 요약하는 클래스

/**
 * 문서 요약 관리 클래스
 * Claude API를 사용하여 문서 요약 생성 및 관리
 */

// API 타입 설정 - 브라우저 호환성을 위해 기본값 사용
const API_TYPE = (typeof process !== 'undefined' && process.env?.VITE_AI_API_TYPE) || 'claude';

/**
 * 문서 요약 및 변환을 처리하는 클래스
 * AI 처리를 위한 토큰 최적화와 문맥 관리를 담당
 */
class DocumentSummaryManager {
  constructor() {
    this.summaries = new Map(); // 문서 ID 또는 경로를 키로, 요약 정보를 값으로 저장
    this.maxSectionLength = 1000; // 섹션당 최대 문자 수 (약 250 토큰)
    this.maxSummaryLength = 150; // 요약당 최대 문자 수 (약 40 토큰)
  }

  /**
   * 문서를 섹션으로 분할하고 요약 생성
   * @param {string} documentId - 문서 식별자
   * @param {string} content - 마크다운 형식의 문서 내용
   * @returns {Object} - 섹션 및 요약 정보를 포함한 객체
   */
  processDocument(documentId, content) {
    if (!content) return null;

    // 문서를 헤딩을 기준으로 섹션으로 분할
    const sections = this._splitIntoSections(content);
    
    // 각 섹션에 대한 요약 생성
    const processedSections = sections.map(section => {
      const summary = this._generateSummary(section.content);
      return {
        ...section,
        summary: summary
      };
    });

    // 문서 전체 요약 생성
    const documentSummary = this._generateDocumentSummary(processedSections);
    
    // 결과 객체 생성 및 캐시 저장
    const result = {
      id: documentId,
      summary: documentSummary,
      sections: processedSections,
      lastUpdated: new Date().toISOString()
    };
    
    this.summaries.set(documentId, result);
    return result;
  }

  /**
   * 문서를 헤딩을 기준으로 섹션으로 분할
   * @param {string} content - 마크다운 형식의 문서 내용
   * @returns {Array} - 섹션 객체 배열
   */
  _splitIntoSections(content) {
    // 헤딩 패턴 (# 제목, ## 제목 등)
    const headingPattern = /^(#{1,6})\s+(.+)$/gm;
    const lines = content.split('\n');
    const sections = [];
    
    let currentHeading = "문서";
    let currentLevel = 0;
    let currentContent = "";
    let sectionStart = 0;
    
    // 헤딩이 없는 시작 부분을 첫 번째 섹션으로 처리
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      
      if (headingMatch) {
        // 첫 번째 헤딩을 만났을 때 이전 내용이 있으면 섹션으로 추가
        if (currentContent.trim()) {
          sections.push({
            title: "소개",
            level: 0,
            content: currentContent.trim(),
            startLine: sectionStart,
            endLine: i - 1
          });
        }
        
        // 현재 헤딩 정보 업데이트
        currentHeading = headingMatch[2];
        currentLevel = headingMatch[1].length;
        currentContent = line;
        sectionStart = i;
      } else {
        // 헤딩이 아닌 일반 텍스트 줄 추가
        currentContent += "\n" + line;
      }
      
      // 다음 헤딩을 만나거나 문서 끝에 도달하면 섹션 추가
      const nextLine = i + 1 < lines.length ? lines[i + 1] : null;
      const isNextHeading = nextLine && nextLine.match(/^(#{1,6})\s+(.+)$/);
      
      if (isNextHeading || i === lines.length - 1) {
        if (currentContent.trim()) {
          sections.push({
            title: currentHeading,
            level: currentLevel,
            content: currentContent.trim(),
            startLine: sectionStart,
            endLine: i
          });
        }
        
        if (isNextHeading) {
          const nextHeadingMatch = nextLine.match(/^(#{1,6})\s+(.+)$/);
          currentHeading = nextHeadingMatch[2];
          currentLevel = nextHeadingMatch[1].length;
          currentContent = "";
          sectionStart = i + 1;
        }
      }
    }
    
    // 섹션이 없으면 전체 문서를 하나의 섹션으로 처리
    if (sections.length === 0 && content.trim()) {
      sections.push({
        title: "문서",
        level: 0,
        content: content.trim(),
        startLine: 0,
        endLine: lines.length - 1
      });
    }
    
    return sections;
  }
  
  /**
   * 섹션 내용에 대한 간단한 요약 생성 (실제로는 AI를 통해 요약할 수 있음)
   * @param {string} sectionContent - 섹션 내용
   * @returns {string} - 섹션 요약
   */
  _generateSummary(sectionContent) {
    // 간단한 요약 방식: 첫 번째 문장 또는 일정 길이 추출
    if (!sectionContent) return "";
    
    // 너무 긴 섹션은 일정 길이만 사용
    if (sectionContent.length > this.maxSectionLength) {
      sectionContent = sectionContent.substring(0, this.maxSectionLength) + "...";
    }
    
    // 첫 번째 문장 또는 첫 번째 줄을 요약으로 사용
    let summary = "";
    const firstSentenceMatch = sectionContent.match(/^.+?[.!?](?:\s|$)/);
    
    if (firstSentenceMatch) {
      summary = firstSentenceMatch[0].trim();
    } else {
      // 문장이 명확하지 않으면 첫 번째 줄 사용
      const firstLine = sectionContent.split('\n')[0].trim();
      summary = firstLine;
    }
    
    // 요약이 너무 길면 자르기
    if (summary.length > this.maxSummaryLength) {
      summary = summary.substring(0, this.maxSummaryLength) + "...";
    }
    
    return summary;
  }
  
  /**
   * 문서 전체 요약 생성
   * @param {Array} sections - 섹션 객체 배열
   * @returns {string} - 문서 전체 요약
   */
  _generateDocumentSummary(sections) {
    // 각 섹션의 제목을 모아서 문서 구조 요약 생성
    const titles = sections.map(section => {
      const indent = "  ".repeat(Math.max(0, section.level - 1));
      return `${indent}- ${section.title}`;
    });
    
    return "문서 구조:\n" + titles.join('\n');
  }
  
  /**
   * 저장된 문서 요약 가져오기
   * @param {string} documentId - 문서 식별자
   * @returns {Object|null} - 저장된 요약 객체 또는 null
   */
  getSummary(documentId) {
    return this.summaries.get(documentId) || null;
  }
  
  /**
   * 문서의 특정 부분 주변 컨텍스트 가져오기
   * @param {string} documentId - 문서 식별자
   * @param {number} lineNumber - 줄 번호
   * @param {number} contextLines - 앞뒤로 포함할 줄 수
   * @returns {Object|null} - 컨텍스트 정보 객체 또는 null
   */
  getContextAroundLine(documentId, lineNumber, contextLines = 5) {
    const summary = this.summaries.get(documentId);
    if (!summary) return null;
    
    // 해당 라인이 포함된 섹션 찾기
    const section = summary.sections.find(
      s => lineNumber >= s.startLine && lineNumber <= s.endLine
    );
    
    if (!section) return null;
    
    // 섹션 내용에서 주변 컨텍스트 추출
    const lines = section.content.split('\n');
    const lineIndex = lineNumber - section.startLine;
    
    const start = Math.max(0, lineIndex - contextLines);
    const end = Math.min(lines.length - 1, lineIndex + contextLines);
    
    const contextLines_code = lines.slice(start, end + 1);
    
    return {
      section: section.title,
      context: contextLines_code.join('\n'),
      startLine: section.startLine + start,
      endLine: section.startLine + end
    };
  }
  
  /**
   * 캐시된 모든 요약 정보 지우기
   */
  clearCache() {
    this.summaries.clear();
  }
}

export default DocumentSummaryManager; 