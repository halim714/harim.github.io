// src/utils/verify-setup.js
import { AuthService } from '../services/auth';
import { GitHubService } from '../services/github';

/**
 * 이중 저장소 구조 검증
 */
export async function verifyDualRepoStructure() {
    const token = AuthService.getToken();
    if (!token) {
        return { success: false, error: '로그인이 필요합니다.' };
    }

    const github = new GitHubService(token);
    await github.setUsername();
    const username = github.username;

    const results = {
        privateRepo: { exists: false, structure: false },
        publicRepo: { exists: false, structure: false },
        errors: []
    };

    try {
        // 1. miki-data 확인
        console.log('🔍 프라이빗 저장소 확인 중...');
        const dataRepoExists = await github.checkRepoExists('miki-data');
        results.privateRepo.exists = dataRepoExists;

        if (dataRepoExists) {
            // posts 폴더 확인
            try {
                const files = await github.getFiles('miki-data', 'miki-editor/posts');
                results.privateRepo.structure = Array.isArray(files);
                console.log('✅ 프라이빗 저장소 구조 확인 완료');
            } catch (error) {
                results.errors.push('프라이빗 저장소에 posts 폴더가 없습니다');
            }
        } else {
            results.errors.push('miki-data 저장소가 존재하지 않습니다');
        }

        // 2. username.github.io 확인
        console.log('🔍 퍼블릭 저장소 확인 중...');
        const pagesRepoName = `${username}.github.io`;
        const pagesRepoExists = await github.checkRepoExists(pagesRepoName);
        results.publicRepo.exists = pagesRepoExists;

        if (pagesRepoExists) {
            // Jekyll 구조 확인 (_posts, _config.yml)
            try {
                const configExists = await github.getFile(pagesRepoName, '_config.yml');
                results.publicRepo.structure = !!configExists;
                console.log('✅ 퍼블릭 저장소 Jekyll 구조 확인 완료');
            } catch (error) {
                results.errors.push('퍼블릭 저장소에 Jekyll 설정이 없습니다');
            }
        } else {
            results.errors.push(`${pagesRepoName} 저장소가 존재하지 않습니다`);
        }

        const allGood =
            results.privateRepo.exists &&
            results.privateRepo.structure &&
            results.publicRepo.exists &&
            results.publicRepo.structure;

        return {
            success: allGood,
            results,
            username,
            pagesUrl: `https://${username}.github.io`
        };

    } catch (error) {
        console.error('검증 실패:', error);
        return {
            success: false,
            error: error.message,
            results
        };
    }
}
