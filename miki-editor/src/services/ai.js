/**
 * AI Service - 첨부 파일 자동 분석
 * 
 * 현재: Mock 구현 (2.5초 지연 후 가짜 메타데이터 반환)
 * TODO: OpenRouter/Anthropic API 연동
 */

export const AI_MODELS = {
    BASE: {
        id: 'qwen/qwen-2.5-72b-instruct',
        name: 'Qwen 72B',
        provider: 'openrouter'
    },
    PREMIUM: {
        id: 'anthropic/claude-3.5-sonnet',
        name: 'Claude 3.5 Sonnet',
        provider: 'anthropic'
    }
};

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

        // TODO: 실제 API 호출 구현
        // 현재는 Mock 데이터 반환 (개발/테스트용)
        return this._mockAnalysis(file, model);
    }

    /**
     * Mock 분석 (실제 API 연동 전 테스트용)
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
            model: model.name
        };
    }

    /**
     * 실제 API 호출 (향후 구현)
     * @private
     */
    static async _callRealAPI(file, model) {
        // TODO: OpenRouter 또는 Anthropic API 호출
        // 1. 파일 내용 추출 (텍스트/이미지 등)
        // 2. AI 프롬프트 구성
        // 3. API 호출 및 응답 파싱
        throw new Error('Real API not implemented yet');
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
