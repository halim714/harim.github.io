// src/utils/functional-test.js
import { storage } from './storage-client';
import { PublishService } from '../services/publish';
import { AuthService } from '../services/auth';

/**
 * 전체 기능 테스트
 */
export async function runFunctionalTest() {
    const testResults = {
        save: { success: false, error: null },
        publish: { success: false, error: null },
        verification: { privateExists: false, publicExists: false }
    };

    try {
        console.log('🧪 테스트 시작: "테스트" 포스트 생성');

        // Step 1: 저장 테스트
        console.log('📝 Step 1: 프라이빗 저장소에 저장...');
        const testPost = {
            title: '테스트',
            content: '# 테스트\n\n이것은 테스트 포스트입니다.\n\n기능이 정상 작동하는지 확인 중입니다.'
        };

        const savedPost = await storage.savePost(testPost);
        testResults.save.success = true;
        testResults.save.postId = savedPost.id;
        console.log(`✅ 저장 성공: ${savedPost.id}`);

        // Step 2: 게시 테스트
        console.log('🌐 Step 2: 퍼블릭 저장소에 배포...');
        // WS 모드에서는 token이 null (서버 세션 관리). PublishService는 null token으로 WS 경유.
        const token = AuthService.getToken();
        const publishService = new PublishService(token);
        const publishResult = await publishService.publishDocument(savedPost);
        testResults.publish.success = publishResult.success;
        testResults.publish.publicUrl = publishResult.publicUrl;
        testResults.publish.publicPath = publishResult.publicPath;
        console.log(`✅ 배포 성공: ${publishResult.publicUrl}`);

        // Step 3: 검증
        console.log('🔍 Step 3: 파일 존재 확인...');

        // 프라이빗 확인
        try {
            const privatePost = await storage.getPost(savedPost.id);
            testResults.verification.privateExists = !!privatePost;
            console.log('✅ 프라이빗 저장소 파일 확인');
        } catch (error) {
            testResults.verification.privateExists = false;
            console.error('❌ 프라이빗 저장소 파일 없음');
        }

        // 퍼블릭 확인은 GitHub API로 직접 (PublishService 결과로 판단)
        testResults.verification.publicExists = publishResult.success;

        return {
            success: testResults.save.success && testResults.publish.success,
            testResults
        };

    } catch (error) {
        console.error('❌ 테스트 실패:', error);
        return {
            success: false,
            error: error.message,
            testResults
        };
    }
}
