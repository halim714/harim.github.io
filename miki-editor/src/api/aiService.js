import { createLogger } from '../utils/logger';
const logger = createLogger('aiService');
// aiService.js - Claude API 연동 서비스

// API 키 환경 변수 또는 기본값 사용 (실제 배포 시에는 환경 변수 사용 권장)
// !!! 실제 API 키를 코드에 하드코딩하지 마세요. 이것은 테스트용입니다. !!!
const API_KEY = process.env.CLAUDE_API_KEY || '';

// 미키 에디터를 위한 Claude 프롬프트 템플릿
const SYSTEM_PROMPT = `당신은 미키 에디터(Miki Editor)의 AI 어시스턴트입니다.
사용자의 마크다운 문서 편집을 도와주는 역할을 합니다.
사용자의 명령을 이해하고 문서 편집 작업을 수행하거나 제안해야 합니다.

명령이 문서 편집 관련이면(예: "이 텍스트를 굵게 해줘", "표 만들어줘" 등), JSON 형식으로 응답하여 에디터가 처리할 수 있도록 합니다.
문서 내용에 대한 질문이면 일반 텍스트로 응답합니다.

응답 형식:
1. 편집 명령인 경우: 
\`\`\`json
{
  "isSuggestion": true,
  "suggestionId": "고유ID",
  "suggestionType": "user_command_transform",
  "displayText": "사용자에게 표시할 제안 메시지",
  "actions": [
    {
      "actionType": "작업유형(replace_content, apply_style 등)",
      "commandType": "명령유형(bold, list_ul 등)",
      "range": "selection",
      "content": "내용"
    }
  ]
}
\`\`\`

2. 일반 질문인 경우: 일반 텍스트로 응답`;

/**
 * Claude API에 메시지를 전송하고 응답을 받는 함수
 * @param {string} userPrompt - 사용자 입력 메시지
 * @param {Object} context - 에디터 컨텍스트 (현재 문서 내용, 선택 영역 등)
 * @returns {Promise<string>} - AI 응답
 */
export const sendMessageToClaude = async (userPrompt, context = {}) => {
  const { fullContent = '', selection = null } = context;
  
  try {
    // API 키가 설정되지 않은 경우 시뮬레이션 모드 사용
    if (!API_KEY) {
      logger.info('API 키가 설정되지 않아 시뮬레이션 모드로 응답합니다.');
      return simulateClaudeResponse(userPrompt, context);
    }
    
    // 컨텍스트 정보 포함한 프롬프트 구성
    let contextInfo = `현재 문서 내용:\n\`\`\`markdown\n${fullContent}\n\`\`\`\n\n`;
    
    if (selection && selection.text) {
      contextInfo += `선택된 텍스트: "${selection.text}"\n`;
      if (selection.range) {
        contextInfo += `선택 범위: ${JSON.stringify(selection.range)}\n`;
      }
    }
    
    // Claude API 요청 설정
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',  // Claude 3.5 Haiku 모델로 변경
        max_tokens: 4000,
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT
          },
          {
            role: 'user',
            content: `${contextInfo}\n\n사용자 명령/질문: ${userPrompt}`
          }
        ]
      })
    });

    // 응답 처리
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API 오류: ${response.status} - ${errorData.error?.message || '알 수 없는 오류'}`);
    }

    const data = await response.json();
    return data.content[0].text;
    
  } catch (error) {
    logger.error('Claude API 호출 중 오류 발생:', error);
    return `오류가 발생했습니다: ${error.message}. 잠시 후 다시 시도해주세요.`;
  }
};

/**
 * API 키가 없을 때 사용할 시뮬레이션 응답 생성기
 * @param {string} userPrompt - 사용자 입력 메시지
 * @param {Object} context - 에디터 컨텍스트
 * @returns {string} - 시뮬레이션된 AI 응답
 */
function simulateClaudeResponse(userPrompt, context) {
  const { selection } = context;
  const prompt = userPrompt.toLowerCase();
  
  // 굵게 만들기 명령 시뮬레이션
  if (prompt.includes('굵게') && selection && selection.text) {
    return `\`\`\`json
{
  "isSuggestion": true,
  "suggestionId": "sim-bold-${Date.now()}",
  "suggestionType": "user_command_transform",
  "displayText": "선택한 텍스트를 굵게 만들까요?",
  "actions": [
    {
      "actionType": "apply_style",
      "commandType": "bold",
      "range": "selection",
      "targetText": "${selection.text}"
    }
  ]
}
\`\`\``;
  }
  
  // 목록 만들기 명령 시뮬레이션
  if (prompt.includes('목록') || prompt.includes('리스트')) {
    return `\`\`\`json
{
  "isSuggestion": true,
  "suggestionId": "sim-list-${Date.now()}",
  "suggestionType": "user_command_transform",
  "displayText": "순서 없는 목록을 생성할까요?",
  "actions": [
    {
      "actionType": "create_element",
      "commandType": "list_ul",
      "range": "cursor",
      "content": {
        "items": ["첫 번째 항목", "두 번째 항목", "세 번째 항목"]
      }
    }
  ]
}
\`\`\``;
  }
  
  // 표 만들기 명령 시뮬레이션
  if (prompt.includes('표')) {
    return `\`\`\`json
{
  "isSuggestion": true,
  "suggestionId": "sim-table-${Date.now()}",
  "suggestionType": "clarification_needed",
  "displayText": "표를 만들려면 크기를 지정해 주세요.",
  "clarificationDetails": {
    "query": "몇 행 몇 열의 표를 만들까요?",
    "options": [
      { "label": "2x2 표", "value": "2x2" },
      { "label": "3x3 표", "value": "3x3" },
      { "label": "2x3 표", "value": "2x3" }
    ]
  }
}
\`\`\``;
  }
  
  // 일반 질문에 대한 응답
  return `안녕하세요! "${userPrompt}"에 대한 응답입니다. 현재 시뮬레이션 모드로 작동 중입니다. API 키를 설정하면 실제 Claude AI로 더 정확한 응답을 얻을 수 있습니다.`;
}

/**
 * AI 응답에서 JSON 부분을 추출하는 함수
 * @param {string} aiResponse - AI의 응답 텍스트
 * @returns {Object|null} - 파싱된 JSON 객체 또는 null
 */
export const extractJsonFromResponse = (aiResponse) => {
  try {
    // JSON 코드 블록 찾기
    const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
    const match = aiResponse.match(jsonRegex);
    
    if (match && match[1]) {
      // JSON 문자열에서 실제 JSON 객체 파싱
      return JSON.parse(match[1]);
    }
    
    // 전체 텍스트가 JSON인지 확인
    const trimmedResponse = aiResponse.trim();
    if (trimmedResponse.startsWith('{') && trimmedResponse.endsWith('}')) {
      return JSON.parse(trimmedResponse);
    }
    
    return null;
  } catch (error) {
    logger.error('JSON 파싱 오류:', error);
    return null;
  }
}; 