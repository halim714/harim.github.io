import React, { useState, useCallback, useEffect, forwardRef, useImperativeHandle, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { createLogger } from './utils/logger';

import DocumentSummaryManager from './utils/DocumentSummaryManager';
import DocumentSearchManager from './utils/DocumentSearchManager';
import './styles/AiPanel.css';

const logger = createLogger('AiPanel');

// 환경 변수 처리 - Jest 호환성을 위해 기본값 사용
const API_TYPE = 'claude';
const API_KEY = '';
const SERVER_URL = 'http://localhost:3001';

// API 설정
const CLAUDE_API_KEY = process.env.VITE_CLAUDE_API_KEY || ''; // 환경변수에서 API 키 가져오기
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-3-5-haiku-20241022';
const CUSTOM_API_ENDPOINT = 'http://localhost:3100/api/ai/command';
const CUSTOM_API_KEY = 'dev_key';

// 문서 요약 관리 인스턴스 생성
const documentSummaryManager = new DocumentSummaryManager();
const documentSearchManager = new DocumentSearchManager(); // 문서 검색 매니저 인스턴스 추가

// Claude API 응답을 Miki 포맷으로 변환하는 함수
const transformClaudeResponse = (claudeResponse) => {
  try {
    if (!claudeResponse || !claudeResponse.content || claudeResponse.content.length === 0) {
      logger.error('Claude API 응답 형식 오류:', claudeResponse);
      return JSON.stringify({
        isSuggestion: false,
        isCommand: false,
        action: "display_text",
        commandType: "error",
        displayText: "Claude API 응답 형식이 올바르지 않습니다."
      });
    }

    // Claude 응답에서 텍스트 추출
    const textContent = claudeResponse.content
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join('\n');

    logger.info('추출된 텍스트 내용:', textContent);

    // JSON 블록 추출 (```json ... ``` 형식)
    const jsonMatch = textContent.match(/```json\s*([\s\S]*?)\s*```/);
    
    if (jsonMatch && jsonMatch[1]) {
      try {
        // 🎯 핵심 수정: 최소한의 정리만 수행 (과도한 이스케이프 제거)
        let cleanJson = jsonMatch[1]
          .trim()
          .replace(/^```json\s*/, '')    // 시작 백틱 제거
          .replace(/\s*```$/, '');       // 끝 백틱 제거
        
        // Claude가 이미 유효한 JSON을 제공하므로 추가 처리 없이 바로 파싱
        const jsonObj = JSON.parse(cleanJson);
        logger.info('✅ JSON 파싱 성공:', jsonObj);
        return JSON.stringify(jsonObj);
        
      } catch (parseError) {
        logger.error('JSON 파싱 실패:', parseError.message);
        logger.info('파싱 실패한 JSON 내용:', jsonMatch[1]);
        
        // 파싱 실패 시 정규식으로 핵심 정보 추출
        const displayTextMatch = textContent.match(/"displayText":\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
        if (displayTextMatch) {
          const extractedText = displayTextMatch[1]
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r') 
            .replace(/\\t/g, '\t')
            .replace(/\\"/g, '"');
          
          logger.info('정규식으로 displayText 추출 성공:', extractedText.substring(0, 50) + '...');
          return JSON.stringify({
            isSuggestion: false,
            isCommand: false,
            action: "display_text",
            commandType: "info",
            displayText: extractedText
          });
        }
        
        // displayText 추출도 실패하면 원본 텍스트 반환
        return JSON.stringify({
          isSuggestion: false,
          isCommand: false,
          action: "display_text",
          commandType: "info",
          displayText: "AI 응답을 처리할 수 없습니다: " + parseError.message
        });
      }
    }
    
    // JSON 형식이 없으면 일반 텍스트로 처리
    logger.info('JSON 형식을 찾을 수 없어 텍스트 응답으로 처리합니다.');
    return JSON.stringify({
      isSuggestion: false,
      isCommand: false,
      action: "display_text",
      commandType: "info",
      displayText: textContent
    });
    
  } catch (error) {
    logger.error('Claude 응답 변환 오류:', error, '원본 응답:', claudeResponse);
    return JSON.stringify({
      isSuggestion: false,
      isCommand: false,
      action: "display_text",
      commandType: "error",
      displayText: "AI 응답 처리 중 오류가 발생했습니다. 다시 시도해주세요."
    });
  }
};

// AI API와 통신하여 응답을 받아오는 함수
const getAiResponse = async (requestData, editorContext, isProactiveSuggestionCheck = false) => {
  const { fullContent, selection } = editorContext;
  const { text: userCommand, type: commandTypeSource, commandContext: inEditorCommandContext } = requestData || {};
  
  // 🎯 Phase 2: 간소화된 디버깅 로그
  console.log('🤖 [AI] 요청 처리 시작:', {
    command: userCommand,
    hasContent: !!fullContent,
    contentLength: fullContent?.length || 0,
    isProactive: isProactiveSuggestionCheck
  });
  
  // 환경 변수 디버깅 로그 추가
  logger.info('API 환경 설정:', {
    API_TYPE,
    CLAUDE_API_KEY: CLAUDE_API_KEY ? '설정됨' : '설정되지 않음',
    CLAUDE_API_URL,
    CLAUDE_MODEL
  });
  
  // 개발 모드나 시뮬레이션 모드에서는 가짜 응답 반환 - 조건 수정
  // const useSimulation = true; // 문제 해결을 위해 항상 시뮬레이션 모드 사용
  const useSimulation = false; // 백엔드 프록시 서버를 통해 실제 Claude API 호출
  
  if (useSimulation) {
    logger.info('시뮬레이션 응답을 사용합니다. 명령:', userCommand);
    return await simulateAiResponse(requestData, editorContext, isProactiveSuggestionCheck);
  }
  
  // Claude API를 사용하는 경우
  if (API_TYPE === 'claude' && CLAUDE_API_KEY) {
    try {
      logger.info('Claude API로 요청 전송 중...');
      
      // 선제적 제안 체크 시 복잡한 작업은 건너뛰기
      if (isProactiveSuggestionCheck && (!fullContent || fullContent.length < 10)) {
        logger.info('선제적 제안 체크: 컨텍스트가 충분하지 않아 건너뜁니다.');
        return null;
      }
      
      // 문서 요약 처리 (토큰 최적화)
      let contextDescription = "";
      let documentSummary = null;
      
      if (fullContent) {
        // 🔧 DocumentSummaryManager 우회 - 실제 문서 내용 직접 전달
        console.log('📄 [CONTENT] 문서 내용 직접 전달 (DocumentSummaryManager 우회)');
        
        // 실제 문서 내용을 Claude에게 직접 전달
        contextDescription += `현재 문서 내용:\n\`\`\`\n${fullContent}\n\`\`\`\n\n`;
        contextDescription += `문서 길이: ${fullContent.length}자\n\n`;
      } else {
        contextDescription += "현재 에디터에 문서가 열려있지 않습니다.\n\n";
      }
      
      // 선택 영역 정보 추가
      if (selection && selection.text) {
        const selectionPreview = selection.text.length > 100 
          ? selection.text.substring(0, 100) + "..." 
          : selection.text;
        contextDescription += "현재 선택된 텍스트: \"" + selectionPreview + "\"\n\n";
      } else if (selection && selection.cursor) {
        contextDescription += "커서 위치: " + (selection.cursor[0]+1) + "번째 줄, " + selection.cursor[1] + "번째 문자\n\n";
      }
      
      // 명령 정보
      const commandInfo = (userCommand || '(선제적 제안 요청)');
      const commandSource = (commandTypeSource || '직접 입력');
      
      // 선제적 제안 정보
      const proactiveInfo = isProactiveSuggestionCheck
        ? "이것은 선제적 제안 요청입니다. 문서 컨텍스트를 보고 도움이 될만한 제안이 있으면 제안하고, 없으면 null로 응답하세요."
        : "";
      
      // 컨텍스트 압축 (토큰 절약)
      const contextSummary = contextDescription.length > 2000 
        ? contextDescription.substring(0, 2000) + "..."
        : contextDescription;
      
      // 🎯 Phase 2: 최종 컨텍스트 요약 로그
      console.log('📤 [AI] Claude API 요청:', {
        promptLength: contextSummary.length,
        wasCompressed: contextDescription.length > 2000,
        hasContent: contextSummary.includes('현재 문서 내용:')
      });
      
      // 전체 프롬프트 구성 (80% 토큰 절약)
      const prompt = `Miki AI: 글쓰기&문서관리 동료

"${commandInfo}"
${contextSummary}

${proactiveInfo}

수정 요청시 → JSON 제안
대화시 → 마크다운 답변

지원되는 액션 타입:
- display_text: 텍스트 표시
- insert_content: 텍스트 삽입
- replace_content: 내용 교체
- clear_document: 문서 지우기
- formatting: 서식 변경
- highlight: 강조 표시
- note: 메모 추가

JSON: \`{"isSuggestion":true,"displayText":"...","actions":[{"actionType":"insert_content","content":"..."}]}\``;
      
      // Claude API 요청 구성 (토큰 절약을 위한 max_tokens 조정)
      const claudeRequest = {
        model: CLAUDE_MODEL,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt
              }
            ]
          }
        ],
        max_tokens: 1000, // 2000 → 1000으로 50% 절약
        temperature: 0.1,
      };

      logger.info('Claude API 요청 데이터:', JSON.stringify(claudeRequest, null, 2));

      // 백엔드 API 엔드포인트
      const backendUrl = 'http://localhost:3003/api/claude';
      logger.info('백엔드 API 요청 URL:', backendUrl);

      // 백엔드 프록시 서버를 통해 API 호출
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(claudeRequest),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        logger.error("Claude API 응답 오류:", response.status, errorText);
        throw new Error(`Claude API 응답 오류: ${response.status}, ${errorText}`);
      }
      
      const responseData = await response.json();
      logger.info('Claude 응답 수신 완료:', JSON.stringify(responseData, null, 2));
      
      // Claude 응답을 Miki 포맷으로 변환
      return transformClaudeResponse(responseData);
      
    } catch (error) {
      logger.error('Claude API 통신 오류:', error);
      
      // 오류 발생 시 시뮬레이션으로 폴백
      logger.info('API 오류 발생, 시뮬레이션 응답으로 폴백');
      return await simulateAiResponse(requestData, editorContext, isProactiveSuggestionCheck);
    }
  }
  
  // Claude API 설정이 없는 경우 시뮬레이션으로 대체
  if (!CLAUDE_API_KEY) {
    logger.info('Claude API 키가 설정되지 않았습니다. 환경 변수에 API 키를 설정하거나 코드에 직접 입력하세요.');
    // 사용자에게 알림 표시
    return JSON.stringify({
      isSuggestion: false,
      isCommand: false,
      action: "display_text",
      commandType: "error",
      displayText: "Claude API 키가 설정되지 않았습니다. Miki Editor를 사용하려면 Claude API 키를 설정해주세요. AiPanel.jsx 파일의 CLAUDE_API_KEY 변수에 API 키를 직접 입력할 수 있습니다."
    });
  }
  
  logger.info('Claude API 설정 확인 필요, 시뮬레이션 사용');
  return await simulateAiResponse(requestData, editorContext, isProactiveSuggestionCheck);
};

// 기존 시뮬레이션 코드 유지
const simulateAiResponse = async (requestData, editorContext, isProactiveSuggestionCheck = false) => {
  const { fullContent, selection } = editorContext;
  const { text: userCommand, type: commandTypeSource, commandContext: inEditorCommandContext } = requestData || {};

  let contextSummary = "";
  if (fullContent) {
    contextSummary += `Document is ${fullContent.length} chars long.`;
  }
  if (selection && selection.text) {
    contextSummary += ` Selected: "${selection.text.substring(0, 50)}...".`;
  } else if (selection && selection.cursor) {
    contextSummary += ` Cursor at line ${selection.cursor[0]}, char ${selection.cursor[1]}.`;
  }
  if (inEditorCommandContext && inEditorCommandContext.fullLineText) {
    contextSummary += ` Command issued on line ${inEditorCommandContext.lineNumber}: "${inEditorCommandContext.fullLineText.trim()}".`;
  }

  logger.info(`시뮬레이션 AI: 명령 "${userCommand}" (유형: ${commandTypeSource}, 선제적 체크: ${isProactiveSuggestionCheck}). 컨텍스트: ${contextSummary}`);
  
  // 선제적 체크가 아닌 경우 더 긴 지연 시간으로 실제 API 호출 시뮬레이션
  await new Promise(resolve => setTimeout(resolve, isProactiveSuggestionCheck ? 700 : 1300));

  // 명령이 없으면 기본 응답
  if (!userCommand && isProactiveSuggestionCheck) {
    logger.info('선제적 제안 체크이지만 제안할 내용 없음');
    return null;
  }

  const lowerCommand = userCommand ? userCommand.toLowerCase() : "";
  const suggestionId = `sugg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // 일반 텍스트 응답 명령 처리
  if (lowerCommand.startsWith('안녕') || 
      lowerCommand.includes('반가워') || 
      lowerCommand.includes('hello') || 
      lowerCommand.includes('hi')) {
    return JSON.stringify({
      isSuggestion: false,
      isCommand: false,
      action: "display_text",
      commandType: "info",
      displayText: `안녕하세요! Miki Editor의 AI 어시스턴트입니다. 무엇을 도와드릴까요?`
    });
  }
  
  // 에디터 명령어가 아닌 일반 질문으로 보이는 경우
  if (lowerCommand.endsWith('?') || 
      lowerCommand.endsWith('을까요') || 
      lowerCommand.endsWith('일까요') || 
      lowerCommand.endsWith('인가요') ||
      lowerCommand.startsWith('왜') ||
      lowerCommand.startsWith('어떻게') ||
      lowerCommand.startsWith('무엇')) {
    return JSON.stringify({
      isSuggestion: false,
      isCommand: false,
      action: "display_text",
      commandType: "info",
      displayText: `질문하신 "${userCommand}"에 관해서는, 에디터 기능이 아니라 일반적인 정보를 요청하신 것 같습니다. 저는 현재 에디터 내용을 수정하고 관리하는 기능에 중점을 두고 있습니다. 마크다운 형식 지정이나 문서 구조화에 관한 도움이 필요하시면 말씀해주세요.`
    });
  }

  const getTargetRange = () => {
    if (selection && selection.range && selection.text) return selection.range;
    if (inEditorCommandContext && typeof inEditorCommandContext.lineNumber === 'number') {
        const lineText = inEditorCommandContext.fullLineText;
        // For Toast UI, line numbers are 1-based, array indices are 0-based for range.
        // Assuming lineNumber is 1-based from editor, convert to 0-based for range.
        const zeroBasedLine = inEditorCommandContext.lineNumber -1; 
        return { 
            from: [zeroBasedLine, 0], 
            to: [zeroBasedLine, lineText ? lineText.length : 0]
        };
    }
    return selection?.range || null; // [[line, char], [line, char]]
  };
  const targetRange = getTargetRange();
  const targetTextForCommand = selection?.text || (inEditorCommandContext?.fullLineText ? inEditorCommandContext.fullLineText.trim() : "");

  // Helper to create the 'actions' part of the suggestion, or a direct command if needed.
  const createAction = (actionType, commandType, content = null, customRange = null, additionalProps = {}) => {
    return {
      actionId: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      actionType: actionType,
      commandType: commandType,
      range: customRange || targetRange,
      content: content,
      targetText: targetTextForCommand,
      ...additionalProps
    };
  };

  // Helper to create the full suggestion JSON
  const createSuggestionResponse = (suggestionType, displayText, actions, userCmd = userCommand, src = commandTypeSource) => {
    return JSON.stringify({
      isSuggestion: true,
      suggestionId: suggestionId,
      suggestionType: suggestionType,
      displayText: displayText,
      userCommand: userCmd,
      source: src || (inEditorCommandContext ? "user_command_editor" : "user_command_panel"),
      actions: Array.isArray(actions) ? actions : [actions],
      confidenceScore: 0.9
    });
  };

  // --- Proactive Suggestion Logic (isProactiveSuggestionCheck = true) ---
  if (isProactiveSuggestionCheck) {
    const lines = fullContent ? fullContent.split('\n') : [];
    if (lines.length > 15 && !fullContent.match(/^#\s.+/m) && !fullContent.match(/^title:/im)) {
      return createSuggestionResponse(
        "proactive_add_title",
        "This document is getting quite long. Would you like me to suggest a title based on the content?",
        createAction("generate_title", "title_generation", "suggest a title for this document", null, { targetText: fullContent }),
        null, // No user command for proactive
        "proactive_ai_pattern_analysis"
      );
    }
    if (fullContent && fullContent.split('\n').length > 20 && !fullContent.toLowerCase().includes("table of contents") && fullContent.match(/^(##|###)\s.+/gm)) {
      return createSuggestionResponse(
        "proactive_add_toc",
        "I see several headings. Would you like to add a Table of Contents?",
        createAction("create_toc", "toc", fullContent),
        null,
        "proactive_ai_pattern_analysis"
      );
    }
    const simpleListItems = lines.filter(line => line.trim().startsWith("- ") && !line.trim().startsWith("- ["));
    if (simpleListItems.length >= 3) {
      return createSuggestionResponse(
        "proactive_convert_to_checklist",
        "I see a list here. Would you like to convert it to a checklist (task list)?",
        createAction("convert_list", "taskList", null, "current_list_range"), // Placeholder for actual range detection
        null,
        "proactive_ai_pattern_analysis"
      );
    }
    const longParagraphs = lines.filter(line => line.length > 300 && !line.match(/^#+\s/));
    if (longParagraphs.length > 0) {
        return createSuggestionResponse(
            "proactive_add_subheadings",
            "Some paragraphs seem quite long. Would you like me to try and add subheadings to break them up?",
            createAction("generate_subheadings", "subheading_suggestion", fullContent),
            null,
            "proactive_ai_pattern_analysis"
        );
    }
    return null; // No proactive suggestion
  }

  // --- User Command Processing Logic (all become suggestions now) ---
  if (lowerCommand.includes("bold")) {
    return createSuggestionResponse("format_bold", `Format "${targetTextForCommand || 'selection'}" as bold?`, createAction("apply_style", "bold"));
  } else if (lowerCommand.includes("italic")) {
    return createSuggestionResponse("format_italic", `Format "${targetTextForCommand || 'selection'}" as italic?`, createAction("apply_style", "italic"));
  } else if (lowerCommand.includes("strike")) {
    return createSuggestionResponse("format_strike", `Format "${targetTextForCommand || 'selection'}" with strikethrough?`, createAction("apply_style", "strike"));
  } else if (lowerCommand.includes("inline code")) {
    return createSuggestionResponse("format_inline_code", `Format "${targetTextForCommand || 'selection'}" as inline code?`, createAction("apply_style", "code"));
  }

  if (lowerCommand.startsWith("insert ")) {
    const contentToInsert = userCommand.substring("insert ".length).trim();
    return createSuggestionResponse("insert_text", `Insert "${contentToInsert.substring(0,30)}..."?`, createAction("insert_content", "text", contentToInsert));
  }
  if (lowerCommand.startsWith("replace this with ") || lowerCommand.startsWith("replace selection with ")) {
    const contentToReplaceWith = userCommand.substring(userCommand.indexOf(" with ") + " with ".length).trim();
    return createSuggestionResponse("replace_text", `Replace "${targetTextForCommand || 'selection'}" with "${contentToReplaceWith.substring(0,30)}..."?`, createAction("replace_content", "text", contentToReplaceWith, targetRange));
  }
  if (lowerCommand.startsWith("change this line to ")) {
    const newLineContent = userCommand.substring("change this line to ".length).trim();
    if (inEditorCommandContext && typeof inEditorCommandContext.lineNumber === 'number'){
        return createSuggestionResponse("replace_line_text", `Change line ${inEditorCommandContext.lineNumber} to "${newLineContent.substring(0,30)}..."?`, createAction("replace_line", "text", newLineContent, null, { lineNumber: inEditorCommandContext.lineNumber }));
    }
  }

  const headingMatch = lowerCommand.match(/(?:make this|create|set as) (heading|h)(\d)(?:\s*:\s*(.*))?/i);
  if (headingMatch) {
    const level = parseInt(headingMatch[2], 10);
    const headingText = headingMatch[3] ? headingMatch[3].trim() : (targetTextForCommand || "New Heading");
    if (level >= 1 && level <= 6) {
      const headingContent = `${"#".repeat(level)} ${headingText}`;
      let actionType = "insert_content";
      let displayText = `Insert H${level}: "${headingText}"?`;
      if (targetRange && targetRange.from[0] === targetRange.to[0] && targetTextForCommand) {
         actionType = "replace_line";
         displayText = `Change line to H${level}: "${headingText}"?`;
         return createSuggestionResponse(`format_heading_${level}`, displayText, createAction(actionType, `h${level}`, headingContent, null, { lineNumber: targetRange.from[0] }));
      } else {
         return createSuggestionResponse(`create_heading_${level}`, displayText, createAction(actionType, `h${level}`, headingContent));
      }
    }
  }

  const linkMatch = lowerCommand.match(/(?:link this to|create link to|make this a link to) (https?:\/\/[^\s]+)(?: with text (.*))?/i);
  const internalLinkMatch = lowerCommand.match(/(?:link this to note|create internal link to) ([\w\s-]+)(?: with text (.*))?/i);
  if (linkMatch) {
    const url = linkMatch[1];
    const linkText = linkMatch[2] || targetTextForCommand || "link";
    return createSuggestionResponse("create_external_link", `Create link to ${url} with text "${linkText}"?`, createAction("create_link", "external", url, null, { linkText: linkText }));
  } else if (internalLinkMatch) {
    const noteName = internalLinkMatch[1];
    const linkText = internalLinkMatch[2] || targetTextForCommand || noteName;
    return createSuggestionResponse("create_internal_link", `Create internal link to note "${noteName}" with text "${linkText}"?`, createAction("create_link", "internal", slugify(noteName) + ".md", null, { linkText: linkText, noteSlug: noteName }));
  }

  const listMatch = lowerCommand.match(/(?:create|make) (an? )?(ordered|numbered|bullet|unordered|task|check) list(?: with items:? (.*))?/i);
  if (listMatch) {
    let listTypeCmd = "ul";
    if (listMatch[2].includes("order") || listMatch[2].includes("number")) listTypeCmd = "ol";
    if (listMatch[2].includes("task") || listMatch[2].includes("check")) listTypeCmd = "taskList";
    let items = listMatch[3] ? listMatch[3].split(/, | and /).map(item => item.trim()) : ["Item 1", "Item 2"];
    if (targetTextForCommand && targetTextForCommand.includes('\n')) {
        items = targetTextForCommand.split('\n').map(s => s.trim()).filter(s => s);
    } else if (targetTextForCommand && !listMatch[3]) {
        items = [targetTextForCommand.trim()];
    }
    return createSuggestionResponse(`create_list_${listTypeCmd}`, `Create ${listMatch[2]} list with items: ${items.join(', ').substring(0,50)}...?`, createAction("create_list", listTypeCmd, items));
  }
  if (lowerCommand === "convert current list to checklist") {
    return createSuggestionResponse("convert_to_checklist", "Convert current list to checklist?", createAction("convert_list", "taskList", null, targetRange || "current_list_range"));
  }

  const tableMatch = lowerCommand.match(/(?:create|make) a table(?: with (\d+) columns? and (\d+) rows?)?(?: with headers:? (.*))?/i);
  if (tableMatch) {
    const cols = tableMatch[1] ? parseInt(tableMatch[1], 10) : (tableMatch[3] ? tableMatch[3].split(/, | and /).length : 2);
    const rows = tableMatch[2] ? parseInt(tableMatch[2], 10) : 2;
    const headers = tableMatch[3] ? tableMatch[3].split(/, | and /).map(h => h.trim()) : Array(cols).fill(null).map((_, i) => `Header ${i + 1}`);
    return createSuggestionResponse("create_table", `Create a table with ${cols} cols, ${rows} rows, and headers: ${headers.join(', ')}?`, createAction("create_table", "table", { rows: rows, cols: Math.max(cols, headers.length), headers: headers }));
  }

  const codeBlockMatch = lowerCommand.match(/(?:create|make) a (javascript|python|java|c\+\+|c#|ruby|php|go|rust|css|html|shell|bash|text)? code block(?: with content:? ([\s\S]*))?/i);
  if (codeBlockMatch) {
    const language = codeBlockMatch[1] || "";
    const codeContent = codeBlockMatch[2] || targetTextForCommand || "// your code here";
    return createSuggestionResponse("insert_code_block", `Insert ${language || 'plain text'} code block?`, createAction("insert_code_block", language || "plaintext", codeContent));
  }
  
  if (lowerCommand.includes("make this a quote") || lowerCommand.includes("blockquote")) {
    return createSuggestionResponse("format_quote", `Format "${targetTextForCommand || 'selection'}" as a quote?`, createAction("apply_style", "quote"));
  }

  const footnoteMatch = lowerCommand.match(/(?:add|create|insert) footnote(?: with text:? (.*))?/i);
  if (footnoteMatch) {
    const footnoteText = footnoteMatch[1] || "Your footnote here";
    const refText = targetTextForCommand || "reference";
    return createSuggestionResponse("insert_footnote", `Insert footnote for "${refText}" with text "${footnoteText.substring(0,30)}..."?`, createAction("insert_footnote", "footnote", footnoteText, null, { refText: refText }));
  }

  if (lowerCommand.includes("create table of contents") || lowerCommand.includes("add toc")) {
    return createSuggestionResponse("create_toc_suggestion", "Create a Table of Contents for this document?", createAction("create_toc", "toc", fullContent));
  }
  
  // Fallback for unhandled commands - now also a suggestion, but maybe a less confident one or just info.
  // For now, let's make it a non-actionable info display via the old mechanism if no clear suggestion can be made.
  return JSON.stringify({
    isSuggestion: false, // This is not a suggestion to act upon, but info to display
    isCommand: false,    // And not a direct command either
    action: "display_text", // Tells AiPanel to just display this message
    commandType: "info",
    displayText: `I received your command: "${userCommand}". I'm not sure how to turn that into a specific suggestion right now. How can I help you with Markdown formatting or content generation?`,
    targetText: userCommand
  });
};

const slugify = (str) =>
  str.toLowerCase()
     .trim()
     .replace(/[\s\W-]+/g, '-')
     .replace(/^-+|-+$/g, '');

// AI 응답 스키마 및 검증 시스템 (Phase 2)
const AI_RESPONSE_SCHEMA = {
  required: ['isSuggestion', 'displayText'],
  optional: ['actions', 'confidence', 'reasoning', 'metadata'],
  actionSchema: {
    required: ['actionType', 'content'],
    optional: ['actionId', 'range', 'metadata'],
    validActionTypes: [
      'display_text',
      'insert_content',
      'insert_markdown_link',
      'restore_document',
      'format_bold',
      'format_italic',
      'replace_content',
      'replace_line',
      'apply_style',
      'create_table',
      'create_list',
      'insert_code_block',
      'highlight',
      'note',
      'formatting',
      'clear_document',
      'create_heading'
    ]
  }
};

// AI 응답 검증 및 표준화 클래스
class AiResponseValidator {
  static validateAndNormalize(response) {
    const issues = [];
    let normalizedResponse = { ...response };
    
    // 필수 필드 검증
    AI_RESPONSE_SCHEMA.required.forEach(field => {
      if (!normalizedResponse[field]) {
        issues.push({
          type: 'MISSING_REQUIRED_FIELD',
          field: field,
          severity: 'HIGH',
          message: `필수 필드 '${field}'가 누락됨`
        });
      }
    });
    
    // actions 배열 검증 및 정규화
    if (normalizedResponse.actions && Array.isArray(normalizedResponse.actions)) {
      normalizedResponse.actions = normalizedResponse.actions.map((action, index) => {
        return this.normalizeAction(action, index, issues);
      });
    }
    
    // 메타데이터 추가
    normalizedResponse.metadata = {
      ...normalizedResponse.metadata,
      validatedAt: new Date().toISOString(),
      schemaVersion: '1.0',
      issuesFound: issues.length
    };
    
    if (issues.length > 0) {
      logger.warn('🔍 [SCHEMA] AI 응답 검증 이슈 발견:', issues);
    } else {
      logger.info('✅ [SCHEMA] AI 응답 스키마 검증 통과');
    }
    
    return { normalizedResponse, issues };
  }
  
  static normalizeAction(action, index, issues) {
    let normalizedAction = { ...action };
    
    // 문자열 액션 변환 (Phase 1 호환성 레이어와 통합)
    if (typeof action === 'string') {
      normalizedAction = {
        actionType: 'insert_content',
        content: action,
        actionId: `auto_${Date.now()}_${index}`,
        metadata: { 
          source: 'string_conversion', 
          originalValue: action,
          convertedAt: new Date().toISOString()
        }
      };
      issues.push({
        type: 'ACTION_FORMAT_CONVERTED',
        index: index,
        severity: 'MEDIUM',
        message: `actions[${index}]를 문자열에서 객체로 변환함`
      });
    }
    
    // Claude가 'type' 필드를 사용하는 경우 'actionType'으로 정규화
    if (normalizedAction.type && !normalizedAction.actionType) {
      normalizedAction.actionType = normalizedAction.type;
      delete normalizedAction.type;
      issues.push({
        type: 'FIELD_NORMALIZED',
        index: index,
        severity: 'LOW',
        message: `actions[${index}]에서 'type' → 'actionType'으로 정규화`
      });
    }
    
    // actionType 검증
    if (!normalizedAction.actionType) {
      normalizedAction.actionType = 'insert_content';
      issues.push({
        type: 'MISSING_ACTION_TYPE',
        index: index,
        severity: 'HIGH',
        message: `actions[${index}]에 actionType이 없어 'insert_content'로 설정함`
      });
    }
    
    // 지원되지 않는 actionType을 insert_content로 매핑
    const actionTypeMapping = {
      'spelling': 'insert_content',
      'grammar': 'insert_content', 
      'punctuation': 'insert_content',
      'display_text': 'insert_content',
      'correction': 'replace_content',
      'text_replacement': 'replace_content'
    };
    
    if (actionTypeMapping[normalizedAction.actionType]) {
      const originalType = normalizedAction.actionType;
      normalizedAction.actionType = actionTypeMapping[originalType];
      issues.push({
        type: 'ACTION_TYPE_MAPPED',
        index: index,
        originalType: originalType,
        mappedType: normalizedAction.actionType,
        severity: 'MEDIUM',
        message: `actions[${index}] actionType '${originalType}' → '${normalizedAction.actionType}'로 매핑됨`
      });
    }
    
    // 유효한 actionType 검증
    if (!AI_RESPONSE_SCHEMA.actionSchema.validActionTypes.includes(normalizedAction.actionType)) {
      const originalType = normalizedAction.actionType;
      normalizedAction.actionType = 'insert_content';
      issues.push({
        type: 'INVALID_ACTION_TYPE',
        index: index,
        actionType: originalType,
        severity: 'HIGH',
        message: `지원되지 않는 actionType: ${originalType} → insert_content로 대체`
      });
    }
    
    // actionId 자동 생성
    if (!normalizedAction.actionId) {
      normalizedAction.actionId = `action_${Date.now()}_${index}`;
    }
    
    // content 기본값 설정 (다양한 소스에서 추출 시도)
    if (!normalizedAction.content) {
      // suggestions, corrections, correctedText 등에서 content 추출 시도
      if (normalizedAction.suggestions && Array.isArray(normalizedAction.suggestions) && normalizedAction.suggestions.length > 0) {
        normalizedAction.content = normalizedAction.suggestions.join('\n');
      } else if (normalizedAction.corrections && Array.isArray(normalizedAction.corrections) && normalizedAction.corrections.length > 0) {
        normalizedAction.content = normalizedAction.corrections.map(c => c.suggestion || c.original || '수정 내용').join('\n');
      } else if (normalizedAction.correctedText) {
        normalizedAction.content = normalizedAction.correctedText;
      } else {
        normalizedAction.content = '내용 없음';
        issues.push({
          type: 'MISSING_CONTENT',
          index: index,
          severity: 'MEDIUM',
          message: `actions[${index}]에 content가 없어 기본값으로 설정함`
        });
      }
    }
    
    return normalizedAction;
  }
  
  static generateQualityReport(response, issues) {
    // 심각도별 가중치
    const severityWeights = {
      'HIGH': 15,    // 고심각도: 15점 감점
      'MEDIUM': 8,   // 중심각도: 8점 감점
      'LOW': 3       // 저심각도: 3점 감점
    };
    
    // 이슈별 점수 계산
    let totalDeduction = 0;
    issues.forEach(issue => {
      const weight = severityWeights[issue.severity] || 10;
      totalDeduction += weight;
    });
    
    // 기본 점수 100에서 감점
    const qualityScore = Math.max(0, 100 - totalDeduction);
    
    // 보너스 점수: 성공적인 정규화나 매핑
    const bonusPoints = issues.filter(i => 
      i.type === 'FIELD_NORMALIZED' || i.type === 'ACTION_TYPE_MAPPED'
    ).length * 2;
    
    const finalScore = Math.min(100, qualityScore + bonusPoints);
    
    const report = {
      score: finalScore,
      grade: finalScore >= 90 ? 'A' : finalScore >= 75 ? 'B' : finalScore >= 60 ? 'C' : 'D',
      issues: issues,
      recommendations: this.generateRecommendations(issues),
      timestamp: new Date().toISOString(),
      breakdown: {
        totalDeduction,
        bonusPoints,
        baseScore: qualityScore
      }
    };
    
    logger.info(`📊 [QUALITY] AI 응답 품질 점수: ${finalScore}/100 (${report.grade}등급)`);
    if (issues.length > 0) {
      logger.info(`📊 [QUALITY] 점수 상세: 기본 ${qualityScore}점 - 감점 ${totalDeduction}점 + 보너스 ${bonusPoints}점`);
    }
    return report;
  }
  
  static generateRecommendations(issues) {
    const recommendations = [];
    
    if (issues.some(i => i.type === 'ACTION_FORMAT_CONVERTED')) {
      recommendations.push('프롬프트에서 actions 형식을 더 명확히 명시하세요.');
    }
    
    if (issues.some(i => i.type === 'INVALID_ACTION_TYPE')) {
      recommendations.push('지원되는 actionType 목록을 프롬프트에 포함하세요.');
    }
    
    if (issues.some(i => i.type === 'MISSING_CONTENT')) {
      recommendations.push('모든 action에 content 필드가 포함되도록 프롬프트를 개선하세요.');
    }
    
    return recommendations;
  }

  static analyzeUserIntent(userCommand) {
    if (!userCommand || typeof userCommand !== 'string') return false;
    
    const command = userCommand.toLowerCase().trim();
    
    // 🎯 액션성 키워드 패턴 정의
    const actionPatterns = [
      // 편집 관련
      /요약.*해.*줘?/,
      /수정.*해.*줘?/,
      /변경.*해.*줘?/,
      /고쳐.*줘?/,
      /바꿔.*줘?/,
      /교정.*해.*줘?/,
      /개선.*해.*줘?/,
      
      // 구조 변경
      /나눠.*줘?/,
      /분할.*해.*줘?/,
      /문단.*나누?/,
      /단락.*나누?/,
      
      // 추가/삽입
      /추가.*해.*줘?/,
      /넣어.*줘?/,
      /삽입.*해.*줘?/,
      /포함.*시켜.*줘?/,
      
      // 삭제/제거
      /삭제.*해.*줘?/,
      /지워.*줘?/,
      /제거.*해.*줘?/,
      /빼.*줘?/,
      
      // 형식 변경
      /형식.*바꿔.*줘?/,
      /스타일.*바꿔.*줘?/,
      /마크다운.*으?로/,
      /볼드.*로/,
      /이탤릭.*으?로/,
      
      // 에디터 직접 조작
      /에디터.*수정/,
      /직접.*수정/,
      /내용.*바꿔/,
      /텍스트.*변경/
    ];
    
    // 패턴 매칭 검사
    const hasActionPattern = actionPatterns.some(pattern => pattern.test(command));
    
    // 추가 휴리스틱: 명령형 어조 감지
    const hasImperativeForm = /해줘|줘|해|하자|바꿔|수정/.test(command);
    
    // 질문형은 액션이 아님 (우선순위 높음)
    const isQuestion = /\?$|왜|어떻게|무엇|언제|어디/.test(command);
    
    if (isQuestion) return false;
    
    return hasActionPattern || hasImperativeForm;
  }
  
  static extractActionKeywords(userCommand) {
    if (!userCommand || typeof userCommand !== 'string') return [];
    
    const command = userCommand.toLowerCase();
    const keywords = [];
    
    // 키워드 맵핑
    const keywordMap = {
      '요약': ['요약', '정리', '간추', '압축'],
      '수정': ['수정', '고치', '바꾸', '변경', '교정', '개선'],
      '나누기': ['나누', '분할', '나눠', '문단', '단락'],
      '추가': ['추가', '넣', '삽입', '포함'],
      '삭제': ['삭제', '지우', '제거', '빼'],
      '형식': ['형식', '스타일', '마크다운', '볼드', '이탤릭'],
      '편집': ['에디터', '직접', '내용', '텍스트']
    };
    
    // 각 카테고리별 키워드 검사
    for (const [category, words] of Object.entries(keywordMap)) {
      if (words.some(word => command.includes(word))) {
        keywords.push(category);
      }
    }
    
    return keywords;
  }
}

const AiPanel = forwardRef(({ 
  currentDocumentId, // 새로 추가된 prop
  editorContext, 
  onApplyAiCommand, // 기존 prop 복원
  onStructuredCommand, 
  onDisplaySuggestion 
}, ref) => {
  const [promptInput, setPromptInput] = useState(''); 
  const [userInput, setUserInput] = useState('');
  const [userInputRows, setUserInputRows] = useState(3);
  const userInputRef = useRef(null);
  const [conversation, setConversation] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const conversationEndRef = useRef(null);
  const proactiveSuggestionTimeoutRef = useRef(null);
  const [relatedDocuments, setRelatedDocuments] = useState([]);
  const [showRelatedDocuments, setShowRelatedDocuments] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState([]);
  const [additionalContext, setAdditionalContext] = useState([]);
  const [expanded, setExpanded] = useState(true); // 패널 확장 상태 추가
  const [conversationRestored, setConversationRestored] = useState(false);
  
  // 패널 접기/펼치기 토글 함수
  const handleExpandToggle = () => {
    setExpanded(prev => !prev);
  };

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  // 문서 검색 기능
  const searchRelatedDocuments = useCallback(async (searchQuery) => {
    try {
      logger.info("AI 패널에서 관련 문서 검색 시작:", searchQuery);
      return await documentSearchManager.searchDocuments(searchQuery);
    } catch (error) {
      logger.error("AI 패널 문서 검색 오류:", error);
      return [];
    }
  }, []);

  // 프로액티브 제안 검사
  useEffect(() => {
    // 사용자가 질문 중일 때 관련 문서 검색 여부 확인
    if (!userInput || userInput.length < 3 || isLoading) return;
    
    // 디바운스 실행으로 너무 자주 체크하지 않도록 함
    const checkForProactiveSuggestions = async () => {
      // 현재 입력중인 질문이 문서 검색이나 요약에 관한 것인지 확인
      const isSearchQuery = /검색|찾아|유사한|관련된|문서/.test(userInput);
      
      if (isSearchQuery && conversation.length > 0) {
        logger.info("관련 문서 검색 쿼리 감지됨");
        
        try {
          const relatedDocs = await searchRelatedDocuments(userInput);
          
          if (relatedDocs.length > 0) {
            // 검색 결과가 있으면 상태 업데이트하여 UI에 표시
            setRelatedDocuments(relatedDocs);
            setShowRelatedDocuments(true);
          }
        } catch (err) {
          logger.error("프로액티브 검색 오류:", err);
        }
      }
    };

    // 디바운스 타이머 설정
    const timer = setTimeout(checkForProactiveSuggestions, 2000);
    return () => clearTimeout(timer);
  }, [editorContext, conversation, userInput, searchRelatedDocuments]);

  const handleInputChange = (event) => {
    setPromptInput(event.target.value);
  };

  const processUserRequestInternal = useCallback(async (requestData, currentEditorContext) => {
    const commandText = requestData.text;
    if (!commandText || !commandText.trim() || isLoading || !currentEditorContext) return;

    // Clear any existing UI suggestions in MikiEditor (MikiEditor will need a method for this)
    if (onDisplaySuggestion) onDisplaySuggestion(null); 

    // 🎯 문서별 독립적 대화: currentDocumentId 추가 (하위 호환성 보장)
    const userMessage = { 
      type: 'user', 
      text: commandText,
      ...(currentDocumentId && { documentId: currentDocumentId }) // currentDocumentId가 있을 때만 추가
    }; 
    setConversation(prev => [...prev, userMessage]);
    setIsLoading(true);
    setUserInput(''); // userInput 비우기

    // 로딩 메시지 추가 (documentId 포함)
    const loadingMessage = { 
      type: 'ai', 
      text: '명령을 처리 중입니다...', 
      isLoading: true,
      ...(currentDocumentId && { documentId: currentDocumentId })
    };
    setConversation(prev => [...prev, loadingMessage]);

    try {
      logger.info('AI에 요청 전송 중:', commandText);
      const rawAiResponse = await getAiResponse(requestData, currentEditorContext, false);
      logger.info("AI 원본 응답:", rawAiResponse); // 디버깅용 로그 추가
      
      // 로딩 메시지 제거
      setConversation(prev => prev.filter(msg => !msg.isLoading));
      
      let aiTextToDisplayInPanel = "";
      let parsedResponse = null;
      
      if (rawAiResponse) {
        try {
          // 원본 응답이 null인 경우 처리
          if (rawAiResponse === null) {
            aiTextToDisplayInPanel = "AI 응답이 없습니다. 다시 시도해주세요.";
          } else {
            // JSON 형식으로 응답이 왔는지 확인
            parsedResponse = JSON.parse(rawAiResponse);
            logger.info("파싱된 응답:", parsedResponse); // 파싱된 응답 로그
            
            // 🔧 Phase 2: AI 응답 검증 및 표준화 시스템 적용
            const validationResult = AiResponseValidator.validateAndNormalize(parsedResponse);
            parsedResponse = validationResult.normalizedResponse;
            
            // 🎯 Option B: 사용자 의도 재분석 시스템
            const isUserRequestingAction = AiResponseValidator.analyzeUserIntent(commandText);
            if (isUserRequestingAction && parsedResponse.displayText && !parsedResponse.isSuggestion) {
              logger.info('🔄 [INTENT] 액션성 명령어 감지 - isSuggestion 강제 활성화:', commandText);
              logger.info('🔍 [INTENT] 감지된 키워드:', AiResponseValidator.extractActionKeywords(commandText));
              
              parsedResponse.isSuggestion = true;
              parsedResponse.metadata = {
                ...parsedResponse.metadata,
                intentOverride: true,
                originalIntent: 'conversation',
                detectedIntent: 'action',
                triggerKeywords: AiResponseValidator.extractActionKeywords(commandText),
                overrideTimestamp: new Date().toISOString()
              };
              
              // 의도 재분석 통계 업데이트
              updateIntentAnalysisStats(commandText, true);
            } else if (isUserRequestingAction) {
              logger.info('✅ [INTENT] 액션성 명령어이지만 이미 isSuggestion: true');
              updateIntentAnalysisStats(commandText, false);
                } else {
              logger.info('💬 [INTENT] 일반 대화로 분류:', commandText);
            }
            
            // 품질 보고서 생성
            const qualityReport = AiResponseValidator.generateQualityReport(parsedResponse, validationResult.issues);
            
            // 품질 점수에 따른 처리 (D등급만 경고 표시)
            if (qualityReport.grade === 'D') {
              logger.error('❌ [QUALITY] AI 응답 품질이 낮습니다:', qualityReport);
              // D등급 응답에 대한 fallback 처리
              parsedResponse.displayText += `\n\n⚠️ 응답 품질: ${qualityReport.grade}등급 (${qualityReport.score}/100)`;
              if (qualityReport.recommendations.length > 0) {
                parsedResponse.displayText += `\n개선 권장사항: ${qualityReport.recommendations.join(', ')}`;
                }
              } else {
              // C등급 이상은 정상 처리 (로그만 표시)
              logger.info(`✅ [QUALITY] AI 응답 품질 양호: ${qualityReport.grade}등급 (${qualityReport.score}/100)`);
            }
            
            logger.info("✅ [SCHEMA] 검증 및 표준화 완료:", {
              originalIssues: validationResult.issues.length,
              qualityScore: qualityReport.score,
              finalActionsCount: parsedResponse.actions?.length || 0
            });
            
            // 🎯 AI 제안 처리 로직 (검증된 응답으로)
            if (parsedResponse && parsedResponse.isSuggestion && parsedResponse.displayText) {
              logger.info("💡 [SUGGESTION] 검증된 AI 제안:", parsedResponse);
              aiTextToDisplayInPanel = `💡 제안: ${parsedResponse.displayText}`;
              
              // onDisplaySuggestion 콜백이 있으면 제안을 표시합니다
              if (onDisplaySuggestion) {
                logger.info("🎨 [SUGGESTION] 에디터에 제안 표시:", parsedResponse);
                onDisplaySuggestion(parsedResponse);
              }
            } else {
              // 일반 텍스트 응답
              aiTextToDisplayInPanel = parsedResponse.displayText;
            }
          }
        } catch (e) {
          logger.error("AI 응답 파싱 오류:", e);
          // JSON 파싱 실패 시 원본 텍스트를 응답으로 사용
          if (typeof rawAiResponse === 'string') {
            aiTextToDisplayInPanel = rawAiResponse.substring(0, 500) + 
              (rawAiResponse.length > 500 ? '...' : '');
          } else {
            aiTextToDisplayInPanel = "AI 응답 처리 중 오류 발생. 다시 시도해주세요.";
          }
        }
      } else {
        aiTextToDisplayInPanel = "AI가 응답하지 않았습니다. 다시 시도해주세요.";
      }
      
      const aiMessage = { 
        type: 'ai', 
        text: aiTextToDisplayInPanel, 
        rawResponseForDebug: rawAiResponse,
        ...(currentDocumentId && { documentId: currentDocumentId })
      };
      setConversation(prev => [...prev.filter(msg => !msg.isLoading), aiMessage]);
    } catch (error) {
      logger.error("AI 응답 처리 오류:", error);
      
      // 로딩 메시지 제거
      setConversation(prev => prev.filter(msg => !msg.isLoading));
      
      const errorMessage = { 
        type: 'ai',
        text: '요청 처리 중 오류가 발생했습니다: ' + error.message,
        isError: true,
        ...(currentDocumentId && { documentId: currentDocumentId })
      };
      setConversation(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, onDisplaySuggestion, editorContext, onApplyAiCommand, onStructuredCommand]);

  useImperativeHandle(ref, () => ({
    triggerAiProcessing(commandData) {
      if (editorContext) { 
        processUserRequestInternal(commandData, editorContext);
      }
    },
    clearConversation() {
      setConversation([]);
      saveConversationToStorage([]);
    },
    // 대화 내용을 가져오는 메서드 추가
    getConversation() {
      return conversation;
    },
    // 저장된 대화 내용을 복원하는 메서드 추가
    setConversation(savedConversation) {
      if (Array.isArray(savedConversation)) {
        setConversation(savedConversation);
      }
    }
  }));

  // 컴포넌트 마운트 시 저장된 대화 복원 (기존 로직 확장)
  useEffect(() => {
    // 이미 복원했으면 중복 실행 방지
    if (conversationRestored && currentDocumentId === previousDocumentIdRef.current) {
      return;
    }
    
    try {
      // 현재 문서의 대화 복원 시도
      const storageKey = currentDocumentId 
        ? `miki_ai_conversations_${currentDocumentId}` 
        : 'miki_ai_conversations';
      
      const savedConversations = localStorage.getItem(storageKey);
      logger.info('대화 복원 시도:', { storageKey, hasData: !!savedConversations, currentDocumentId });
      
      if (savedConversations) {
        const parsed = JSON.parse(savedConversations);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // 대화 데이터 정제 후 복원
          const sanitizedConversations = sanitizeConversationData(parsed);
          setConversation(sanitizedConversations);
          setConversationRestored(true);
          logger.info('✅ 저장된 대화 복원 완료 (정제됨):', sanitizedConversations.length, '개의 메시지', `키: ${storageKey}`);
          logger.info('복원된 대화 내용:', sanitizedConversations.map((msg, i) => `${i+1}. [${msg.type}] ${msg.text.substring(0, 50)}...`));
          return;
        }
      }
      
      // 문서별 대화가 없고 currentDocumentId가 있다면 빈 대화로 시작
      if (currentDocumentId) {
        setConversation([]);
        setConversationRestored(true);
        logger.info('새 문서 대화 시작:', currentDocumentId);
      } else {
        // currentDocumentId가 없는 경우 기존 전역 대화 복원 (하위 호환성)
        const globalSaved = localStorage.getItem('miki_ai_conversations');
        if (globalSaved) {
          const parsed = JSON.parse(globalSaved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // 전역 대화도 정제 후 복원
            const sanitizedConversations = sanitizeConversationData(parsed);
            setConversation(sanitizedConversations);
            setConversationRestored(true);
            logger.info('전역 대화 복원 완료 (정제됨):', sanitizedConversations.length, '개의 메시지');
          }
        } else {
          setConversation([]);
          setConversationRestored(true);
        }
      }
    } catch (error) {
      logger.error('대화 복원 오류:', error);
      setConversation([]); // 오류 시 빈 대화로 시작
      setConversationRestored(true);
    }
  }, [currentDocumentId, conversationRestored]); // conversationRestored 의존성 추가

  // 이전 문서 ID 추적을 위한 ref
  const previousDocumentIdRef = useRef(currentDocumentId);
  
  // 문서 전환 시 이전 대화 저장 및 새 대화 복원
  useEffect(() => {
    const previousDocId = previousDocumentIdRef.current;
    
    // 이전 문서가 있고 현재 문서와 다르다면 이전 대화 저장
    if (previousDocId && previousDocId !== currentDocumentId && conversation.length > 0) {
      const previousStorageKey = `miki_ai_conversations_${previousDocId}`;
      try {
        const cleanConversations = conversation.filter(msg => 
          !msg.isLoading && !msg.isPendingCommand
        );
        if (cleanConversations.length > 0) {
          const trimmedConversations = cleanConversations.slice(-50);
          localStorage.setItem(previousStorageKey, JSON.stringify(trimmedConversations));
          logger.info('이전 문서 대화 저장:', previousDocId, trimmedConversations.length, '개의 메시지');
        }
      } catch (error) {
        logger.error('이전 문서 대화 저장 오류:', error);
      }
    }
    
    // 문서가 변경되었으면 복원 상태 리셋
    if (previousDocId !== currentDocumentId) {
      setConversationRestored(false);
      logger.info('문서 전환 감지:', previousDocId, '→', currentDocumentId, '- 대화 복원 상태 리셋');
    }
    
    // 현재 문서 ID 업데이트
    previousDocumentIdRef.current = currentDocumentId;
  }, [currentDocumentId, conversation]);

  // 대화 내용을 로컬 스토리지에 저장하는 함수 (문서별 저장으로 확장)
  const saveConversationToStorage = (conversations) => {
    try {
      if (Array.isArray(conversations) && conversations.length > 0) {
        // 문서별 저장 키 사용
        const storageKey = currentDocumentId 
          ? `miki_ai_conversations_${currentDocumentId}` 
          : 'miki_ai_conversations'; // 문서가 없으면 기존 키 사용
        
        // 임시 메시지 제거 (isLoading, isPendingCommand)
        const cleanConversations = conversations.filter(msg => 
          !msg.isLoading && !msg.isPendingCommand
        );
        
        if (cleanConversations.length > 0) {
          // 최근 50개 메시지만 저장 (메모리 절약)
          const trimmedConversations = cleanConversations.slice(-50);
          localStorage.setItem(storageKey, JSON.stringify(trimmedConversations));
          logger.info('대화 내용 저장 완료:', trimmedConversations.length, '개의 메시지', `키: ${storageKey}`);
        }
      } else {
        logger.info('저장할 대화 내용이 없음');
      }
    } catch (error) {
      logger.error('대화 내용 저장 오류:', error);
      
      // 저장소 공간 부족 시 응급 처리
      if (error.name === 'QuotaExceededError') {
        try {
          // 다른 AI 대화 중 일부 삭제
          const aiKeys = Object.keys(localStorage)
            .filter(key => key.startsWith('miki_ai_conversations_'))
            .filter(key => key !== `miki_ai_conversations_${currentDocumentId}`);
          
          // 가장 오래된 것부터 삭제
          aiKeys.slice(0, Math.max(1, Math.floor(aiKeys.length / 4)))
            .forEach(key => {
              localStorage.removeItem(key);
              logger.info('저장소 정리:', key, '삭제');
            });
          
          // 재시도
          const cleanConversations = conversations.filter(msg => 
            !msg.isLoading && !msg.isPendingCommand
          ).slice(-25); // 더 적게 저장
          
          const storageKey = currentDocumentId 
            ? `miki_ai_conversations_${currentDocumentId}` 
            : 'miki_ai_conversations';
          localStorage.setItem(storageKey, JSON.stringify(cleanConversations));
          logger.info('저장소 정리 후 저장 완료');
        } catch (retryError) {
          logger.error('저장소 정리 후에도 저장 실패:', retryError);
        }
      }
    }
  };

  // 관련 문서 사용 핸들러
  const handleUseRelatedDocument = useCallback((doc) => {
    // 선택한 문서 정보를 AI 컨텍스트에 추가
    const docInfo = {
      title: doc.title,
      content: doc.content || "내용이 없습니다.",
      path: doc.path
    };
    
    // 문서 내용을 AI 질문에 컨텍스트로 추가
    setAdditionalContext(prev => [...prev, docInfo]);
    
    // 선택한 문서를 UI에 표시
    setSelectedDocuments(prev => [...prev, docInfo]);
    
    // UI 상태 업데이트
    setShowRelatedDocuments(false);
    setRelatedDocuments([]);
    
    // 링크 생성 컴포넌트와 정보 공유 (향후 확장)
    if (editorContext && editorContext.onDocumentSelected) {
      editorContext.onDocumentSelected(docInfo);
    }
  }, [editorContext, setAdditionalContext]);

  // 대화 내용 변경 시 실시간 저장
  useEffect(() => {
    if (conversation.length > 0) {
      saveConversationToStorage(conversation);
    }
  }, [conversation]);

  // 컴포넌트 언마운트 시 상태 보존
  useEffect(() => {
    // 컴포넌트가 마운트될 때 한번 실행됨
    logger.info('AiPanel 컴포넌트 마운트됨');
    
    return () => {
      // 컴포넌트가 언마운트될 때 실행됨
      logger.info('AiPanel 컴포넌트 언마운트됨, 대화 내용 저장 시도');
      if (conversation.length > 0) {
        saveConversationToStorage(conversation);
      }
    };
  }, []); // conversation 의존성 제거하여 무한 루프 방지

  const handleSuggestionAction = (suggestion, accept) => {
    // This function is now primarily for proactive suggestions shown in AiPanel, if any.
    // Most suggestion interactions will happen in MikiEditor's UI.
    // setActiveSuggestion(null); // Assuming activeSuggestion state is still used for panel-specific suggestions
    if (accept && suggestion.command_on_accept && onApplyAiCommand) {
        const userMessage = {type: 'user', text: `(Accepted suggestion: ${suggestion.message})`};
        const aiMessage = {type: 'ai', text: `Okay, applying suggestion: ${suggestion.message}`};
        setConversation(prev => [...prev, userMessage, aiMessage]);
        onApplyAiCommand(suggestion.command_on_accept);
    } else if (!accept) {
        const userMessage = {type: 'user', text: `(Declined suggestion: ${suggestion.message})`};
        setConversation(prev => [...prev, userMessage]);
    }
  };

  // 사용자 입력 처리 함수
  const handleUserInputChange = (event) => {
    setUserInput(event.target.value);
  };

  // 키보드 입력 처리 함수
  const handleInputKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      
      if (!isLoading && userInput.trim()) {
        processUserRequestInternal({text: userInput.trim(), type: 'user_command_panel'}, editorContext);
      }
    }
  };

  // 대화 데이터 정제 함수 (JSON 문자열 문제 해결)
  const sanitizeConversationData = (conversations) => {
    if (!Array.isArray(conversations)) return [];
    
    return conversations.map(entry => {
      if (entry.type === 'ai' && entry.text) {
        let cleanText = entry.text;
        
        // JSON 문자열인지 확인하고 displayText 추출
        try {
          if (typeof cleanText === 'string' && (cleanText.startsWith('{') || cleanText.startsWith('['))) {
            const parsed = JSON.parse(cleanText);
            if (parsed.displayText) {
              cleanText = parsed.displayText;
              logger.info('대화 복원 시 JSON에서 displayText 추출:', cleanText.substring(0, 50) + '...');
            } else if (parsed.action === 'display_text' && parsed.displayText) {
              cleanText = parsed.displayText;
            } else if (typeof parsed === 'object') {
              // JSON 객체이지만 displayText가 없는 경우 원본 유지하되 로그 남김
              logger.warn('복원된 대화에 JSON 객체 발견, 원본 유지:', cleanText.substring(0, 100) + '...');
            }
          }
        } catch (e) {
          // JSON 파싱 실패 시 원본 텍스트 유지
          logger.info('대화 복원: JSON 파싱 실패, 원본 텍스트 유지');
        }
        
        // rawResponseForDebug 필드 제거 (UI에 불필요)
        const sanitizedEntry = {
          type: entry.type,
          text: cleanText,
          ...(entry.documentId && { documentId: entry.documentId }),
          ...(entry.isError && { isError: entry.isError })
        };
        
        return sanitizedEntry;
      }
      
      return entry; // user 메시지나 다른 타입은 그대로 유지
    });
  };

  // 의도 분석 통계 추적 함수
  const updateIntentAnalysisStats = useCallback((command, wasOverridden) => {
    try {
      const stats = JSON.parse(localStorage.getItem('miki_intent_analysis_stats') || '{}');
      const today = new Date().toISOString().split('T')[0];
      
      if (!stats[today]) {
        stats[today] = {
          totalAnalyzed: 0,
          totalOverridden: 0,
          commands: []
        };
      }
      
      stats[today].totalAnalyzed++;
      if (wasOverridden) {
        stats[today].totalOverridden++;
      }
      
      // 최근 명령어 기록 (최대 10개)
      stats[today].commands.push({
        command: command.substring(0, 50),
        wasOverridden,
        timestamp: new Date().toISOString()
      });
      
      if (stats[today].commands.length > 10) {
        stats[today].commands = stats[today].commands.slice(-10);
      }
      
      // 오래된 통계 정리 (7일 이상)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 7);
      const cutoffStr = cutoffDate.toISOString().split('T')[0];
      
      Object.keys(stats).forEach(date => {
        if (date < cutoffStr) {
          delete stats[date];
        }
      });
      
      localStorage.setItem('miki_intent_analysis_stats', JSON.stringify(stats));
      
      // 오늘의 통계 로그
      const todayStats = stats[today];
      const overrideRate = ((todayStats.totalOverridden / todayStats.totalAnalyzed) * 100).toFixed(1);
      logger.info(`📊 [INTENT-STATS] 오늘 분석: ${todayStats.totalAnalyzed}개, 재분류: ${todayStats.totalOverridden}개 (${overrideRate}%)`);
      
    } catch (error) {
      logger.error('의도 분석 통계 저장 오류:', error);
    }
  }, []);

  return (
    <div className={`ai-panel ${expanded ? 'expanded' : 'collapsed'}`}>
      {/* 패널 헤더 */}
      <div className="panel-header">
        <h3>AI 어시스턴트</h3>
        <div className="controls">
          <button onClick={handleExpandToggle}>
            {expanded ? '접기' : '펼치기'}
          </button>
        </div>
      </div>
      
      {/* 패널 내용 */}
      <div className="panel-content">
        {/* 대화 내역 */}
        <div className="conversation-history">
          {conversation.map((entry, index) => (
            <div key={index} className={`message ${entry.type}`}>
              <div className="message-header">{entry.type === 'user' ? '👤 사용자' : '🤖 AI'}</div>
              <div className="message-content">
                {entry.type === 'ai' ? (
                  <ReactMarkdown 
                    components={{
                      a: ({href, children}) => (
                        <a href={href} target="_blank" rel="noopener noreferrer">
                          {children}
                        </a>
                      ),
                      img: () => null // 이미지 비활성화로 보안 강화
                    }}
                  >
                    {entry.text}
                  </ReactMarkdown>
                ) : (
                  entry.text
                )}
              </div>
              
              {/* 액션 버튼들 표시 */}
              {entry.actionButtons && entry.actionButtons.length > 0 && (
                <div className="action-buttons">
                  {entry.actionButtons.map((button, btnIndex) => (
          <button 
                      key={btnIndex}
                      onClick={button.action}
                      className={button.label === '실행' ? 'accept-button' : 'cancel-button'}
          >
                      {button.label}
          </button>
                  ))}
        </div>
              )}
            </div>
          ))}
          <div ref={conversationEndRef}></div>
        </div>
        
        {/* 관련 문서 추천 영역 */}
        {showRelatedDocuments && relatedDocuments.length > 0 && (
          <div className="related-documents">
            <h4>관련 문서 추천</h4>
            <div className="documents-list">
              {relatedDocuments.map((doc, idx) => (
                <div key={idx} className="document-item" onClick={() => handleUseRelatedDocument(doc)}>
                  <div className="document-title">{doc.title}</div>
                  {doc.preview && <div className="document-preview">{doc.preview}</div>}
                  {doc.isSemanticMatch && <div className="match-type">AI 추천</div>}
                  </div>
              ))}
                </div>
          </div>
        )}
        
        {/* 선택된 문서 표시 영역 */}
        {selectedDocuments.length > 0 && (
          <div className="selected-documents">
            <h4>선택된 문서</h4>
            <div className="documents-list">
              {selectedDocuments.map((doc, idx) => (
                <div key={idx} className="document-item selected">
                  <div className="document-title">{doc.title}</div>
                  <button 
                    onClick={() => {
                      setSelectedDocuments(prev => prev.filter((_, i) => i !== idx));
                      setAdditionalContext(prev => prev.filter((_, i) => i !== idx));
                    }}
                    className="remove-button"
                  >
                    ✕
                  </button>
          </div>
        ))}
      </div>
          </div>
        )}
        
        {/* 입력 영역 */}
        <div className="input-area">
          <textarea 
            ref={userInputRef}
            value={userInput}
            onChange={handleUserInputChange}
            onKeyDown={handleInputKeyDown}
            placeholder="AI에게 질문하세요..."
            disabled={isLoading}
          />
            <button 
            onClick={() => !isLoading && userInput.trim() && processUserRequestInternal({text: userInput.trim(), type: 'user_command_panel'}, editorContext)}
            disabled={isLoading || !userInput.trim()}
            >
            {isLoading ? '처리 중...' : '전송'}
            </button>
        </div>
      </div>
    </div>
  );
});

export default AiPanel;
