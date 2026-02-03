/**
 * AI Service - 첨부 파일 자동 분석
 * 
 * OpenRouter API를 통해 Qwen (Standard) 및 Claude (Premium) 모델 사용
 */

export const AI_MODELS = {
    BASE: {
        id: 'qwen/qwen-2.5-72b-instruct',
        name: 'Qwen 72B',
        provider: 'openrouter',
        maxTokens: 4000
    },
    PREMIUM: {
        id: 'anthropic/claude-3.5-sonnet',
        name: 'Claude 3.5 Sonnet',
        provider: 'openrouter',
        maxTokens: 8000
    }
};

// OpenRouter API 키 (환경변수 또는 사용자 설정에서 가져옴)
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '';

export class AiService {
    /**
     * 파일을 분석하여 메타데이터를 반환합니다.
     * @param {File} file - 분석할 파일 객체
     * @param {'BASE'|'PREMIUM'} tier - 사용할 모델 티어
     * @returns {Promise<{type: string, title: string, description: string, model: string}>}
     */
    static async analyzeAttachment(file, tier = 'BASE') {
        const model = AI_MODELS[tier];
        console.log(`[AI Service] Analyzing ${file.name} using ${model.name}...`);

        // API 키가 없으면 Mock으로 폴백
        if (!OPENROUTER_API_KEY) {
            console.warn('[AI Service] No API key found, using mock analysis');
            return this._mockAnalysis(file, model);
        }

        try {
            // 실제 API 호출
            return await this._callRealAPI(file, model);
        } catch (error) {
            console.error('[AI Service] Real API failed, falling back to mock:', error);
            return this._mockAnalysis(file, model);
        }
    }

    /**
     * 실제 API 호출 (OpenRouter)
     * @private
     */
    static async _callRealAPI(file, model) {
        // 1. 파일 내용 추출
        const fileContent = await this._extractFileContent(file);

        // 2. AI 프롬프트 구성
        const prompt = this._buildAnalysisPrompt(file, fileContent);

        // 3. OpenRouter API 호출
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': window.location.origin,
                'X-Title': 'Miki Editor'
            },
            body: JSON.stringify({
                model: model.id,
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert file analyzer. Analyze the given file and return ONLY a JSON object with type, title, and description fields. No additional text.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: model.maxTokens,
                temperature: 0.3,
                response_format: { type: 'json_object' }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const aiResponse = data.choices[0]?.message?.content;

        if (!aiResponse) {
            throw new Error('No response from AI');
        }

        // 4. 응답 파싱
        const parsed = JSON.parse(aiResponse);

        return {
            type: parsed.type || 'file',
            title: parsed.title || file.name,
            description: parsed.description || 'AI 분석 완료',
            model: model.name
        };
    }

    /**
     * 파일 내용 추출
     * @private
     */
    static async _extractFileContent(file) {
        const extension = file.name.split('.').pop().toLowerCase();
        const mimeType = file.type;

        // 텍스트 파일인 경우 내용 읽기
        if (mimeType.startsWith('text/') || ['txt', 'md', 'json', 'csv'].includes(extension)) {
            return await file.text();
        }

        // 이미지 파일인 경우 Base64로 변환 (Premium 모델용)
        if (mimeType.startsWith('image/')) {
            return await this._fileToBase64(file);
        }

        // PDF나 기타 바이너리 파일은 메타데이터만 반환
        return null;
    }

    /**
     * AI 분석 프롬프트 생성
     * @private
     */
    static _buildAnalysisPrompt(file, content) {
        const extension = file.name.split('.').pop().toLowerCase();
        const mimeType = file.type;

        let prompt = `Analyze this file and return a JSON object with these fields:
- type: one of [image, document, book, movie, link, audio, file]
- title: a concise, descriptive title (max 50 chars)
- description: a brief summary (max 150 chars)

File info:
- Name: ${file.name}
- Type: ${mimeType}
- Size: ${(file.size / 1024).toFixed(2)} KB
`;

        if (content) {
            if (mimeType.startsWith('image/')) {
                prompt += `\nThis is an image file. Analyze the visual content if possible.`;
            } else if (content.length > 0) {
                const preview = content.substring(0, 2000); // 처음 2000자만 전송
                prompt += `\nContent preview:\n${preview}`;
            }
        }

        return prompt;
    }

    /**
     * File을 Base64로 변환
     * @private
     */
    static async _fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * Mock 분석 (실제 API 연동 전 테스트용 또는 폴백)
     * @private
     */
    static async _mockAnalysis(file, model) {
        // 2.5초 지연 (AI 분석 시뮬레이션)
        await new Promise(resolve => setTimeout(resolve, 2500));

        const extension = file.name.split('.').pop().toLowerCase();
        const mimeType = file.type;

        // 파일 타입 자동 판단 로직
        let type = 'file';
        let title = file.name.replace(`.${extension}`, '');
        let description = 'AI가 파일을 분석했습니다.';

        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension) || mimeType.startsWith('image/')) {
            type = 'image';
            description = '이미지 콘텐츠에 대한 자동 생성 설명입니다.';
        } else if (extension === 'pdf' || mimeType === 'application/pdf') {
            type = 'document';
            description = 'PDF 문서의 핵심 내용을 추출한 요약입니다.';
        } else if (['mp4', 'mov', 'avi', 'mkv'].includes(extension) || mimeType.startsWith('video/')) {
            type = 'movie';
            description = '영상 콘텐츠에 대한 분석 결과입니다.';
        } else if (['mp3', 'wav', 'flac', 'm4a'].includes(extension) || mimeType.startsWith('audio/')) {
            type = 'audio';
            description = '오디오 파일에 대한 분석 결과입니다.';
        }

        return {
            type,
            title,
            description,
            model: `${model.name} (Mock)`
        };
    }

    /**
     * 텍스트 정제 (RAG 준비용)
     * @param {string} text - 정제할 텍스트
     * @returns {Promise<string>} - 정제된 텍스트
     */
    static async refineText(text) {
        // TODO: 텍스트 정제 로직 구현
        console.log('[AI Service] Text refinement not implemented yet');
        return text;
    }
}
