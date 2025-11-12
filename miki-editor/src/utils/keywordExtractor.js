/**
 * 키워드 추출 유틸리티
 * 문서에서 의미 있는 키워드를 추출하는 기능을 제공합니다.
 * 한국어와 영어 모두 지원합니다.
 */

/**
 * 고도화된 키워드 추출 함수
 * @param {string} text - 원본 텍스트
 * @param {number} maxKeywords - 최대 키워드 수
 * @returns {Array} - 추출된 키워드 배열
 */
export function extractKeywords(text, maxKeywords = 10) {
  if (!text || typeof text !== 'string' || text.trim().length < 20) return [];
  
  // 1. 텍스트 전처리
  const cleanText = text
    .toLowerCase()
    .replace(/[^\w\s가-힣]/g, ' ')  // 특수문자 제거 (한글 포함)
    .replace(/\s+/g, ' ')
    .trim();
  
  // 2. 문장 분리 및 중요 문장 추출
  const sentences = cleanText.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const importantSentences = sentences.slice(0, Math.min(5, sentences.length));
  
  // 3. 불용어 필터링 (한국어/영어 공통 불용어)
  const stopwords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'else', 'when',
    'at', 'from', 'by', 'for', 'with', 'about', 'against', 'between', 'into',
    '이', '그', '저', '것', '이것', '저것', '그것', '이런', '그런', '저런',
    '는', '은', '이', '가', '을', '를', '에', '에서', '으로', '로', '와', '과'
  ]);
  
  // 4. 단어 빈도 계산 (TF)
  const wordFreq = {};
  const words = cleanText.split(/\s+/);
  
  words.forEach(word => {
    if (word.length > 1 && !stopwords.has(word)) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
  });
  
  // 5. 문서 내 위치 가중치 적용 (제목, 첫 문단 등)
  const titleWords = sentences[0]?.split(/\s+/) || [];
  titleWords.forEach(word => {
    if (wordFreq[word]) {
      wordFreq[word] *= 1.5;  // 제목에 있는 단어 가중치 증가
    }
  });
  
  importantSentences.forEach(sentence => {
    sentence.split(/\s+/).forEach(word => {
      if (wordFreq[word]) {
        wordFreq[word] *= 1.2;  // 첫 몇 문장에 있는 단어 가중치 증가
      }
    });
  });
  
  // 6. 복합 단어(명사구) 감지 및 가중치 부여
  const bigrams = [];
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i].length > 1 && words[i+1].length > 1) {
      const bigram = `${words[i]} ${words[i+1]}`;
      bigrams.push(bigram);
    }
  }
  
  bigrams.forEach(bigram => {
    const bigramCount = cleanText.split(bigram).length - 1;
    if (bigramCount > 1) {
      wordFreq[bigram] = bigramCount * 2;  // 복합 단어에 가중치 부여
    }
  });
  
  // 7. 결과 정렬 및 반환
  return Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(entry => entry[0]);
}

/**
 * 텍스트에서 주요 문장 추출
 * @param {string} text - 원본 텍스트
 * @param {number} maxSentences - 최대 문장 수
 * @returns {Array} - 추출된 중요 문장 배열
 */
export function extractImportantSentences(text, maxSentences = 3) {
  if (!text || typeof text !== 'string') return [];
  
  // 문장 분리
  const sentences = text
    .replace(/([.!?])\s+/g, "$1\n")
    .split("\n")
    .filter(s => s.trim().length > 20);  // 너무 짧은 문장 제외
  
  if (sentences.length <= maxSentences) {
    return sentences;
  }
  
  // 각 문장의 점수 계산
  const sentenceScores = sentences.map((sentence, index) => {
    // 1. 문장 위치 점수 (첫 문장과 마지막 문장 가중치)
    let positionScore = 0;
    if (index < sentences.length * 0.2) {  // 첫 20% 문장
      positionScore = 1 - (index / (sentences.length * 0.2));
    } else if (index > sentences.length * 0.8) {  // 마지막 20% 문장
      positionScore = (index - sentences.length * 0.8) / (sentences.length * 0.2);
    }
    
    // 2. 문장 길이 점수 (너무 짧거나 너무 긴 문장 패널티)
    const lengthScore = Math.min(1, Math.max(0, sentence.length / 150));
    
    // 3. 핵심 단어 포함 점수
    const keywords = extractKeywords(text, 10);
    let keywordScore = 0;
    keywords.forEach(keyword => {
      if (sentence.toLowerCase().includes(keyword)) {
        keywordScore += 0.1;  // 키워드당 가중치
      }
    });
    keywordScore = Math.min(1, keywordScore);  // 최대 1점
    
    // 종합 점수 계산 (각 요소에 가중치 적용)
    return {
      sentence,
      score: positionScore * 0.4 + lengthScore * 0.3 + keywordScore * 0.3
    };
  });
  
  // 점수 기준 정렬 및 상위 문장 반환
  return sentenceScores
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    .map(item => item.sentence);
}

export default {
  extractKeywords,
  extractImportantSentences
}; 