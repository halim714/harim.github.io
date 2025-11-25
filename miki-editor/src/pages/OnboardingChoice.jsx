import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Zap } from 'lucide-react'; // 아이콘 라이브러리 사용 가정

export default function OnboardingChoice() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="p-8 text-center border-b border-gray-100">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Miki Editor 시작하기
          </h1>
          <p className="text-gray-600">
            데이터 관리 방식을 선택해주세요.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-0">
          {/* 자동 설정 */}
          <div className="p-8 hover:bg-blue-50 transition-colors border-r border-gray-100 flex flex-col">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-6 h-6 text-blue-600" />
                <h2 className="text-2xl font-bold text-gray-900">자동 설정</h2>
                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">권장</span>
              </div>

              <ul className="space-y-3 text-sm text-gray-700 mb-6">
                <li>✅ GitHub 로그인만 하면 끝</li>
                <li>✅ 3초 안에 시작</li>
                <li>⚠️ 서버에 토큰 저장 (암호화)</li>
              </ul>
            </div>

            <a href="http://localhost:3003/api/auth/github?mode=auto" className="w-full">
              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg">
                3초만에 시작하기
              </button>
            </a>
          </div>

          {/* 수동 설정 */}
          <div className="p-8 hover:bg-green-50 transition-colors flex flex-col">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-6 h-6 text-green-600" />
                <h2 className="text-2xl font-bold text-gray-900">수동 설정</h2>
                <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">Secure</span>
              </div>

              <ul className="space-y-3 text-sm text-gray-700 mb-6">
                <li>✅ 완전한 프라이버시 (Zero-Knowledge)</li>
                <li>✅ 서버 접근 원천 차단</li>
                <li>✅ 브라우저에만 토큰 저장</li>
              </ul>
            </div>

            <button
              onClick={() => navigate('/onboarding/manual')}
              className="w-full border-2 border-gray-200 hover:border-green-500 hover:text-green-600 font-bold py-3 px-4 rounded-lg"
              disabled // 임시 비활성화
            >
              가이드 보며 설정하기 (준비 중)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}