# Phase 10.6 PWA 실기기 검증 체크리스트

배포 후 실제 iOS/Android 기기에서 확인할 항목.

## 사전 조건

- [ ] miki-editor 프로덕션 배포 완료 (HTTPS 필수 — PWA는 HTTPS만)
- [ ] iOS 16.4+ 기기 (Web Push 지원)
- [ ] Android Chrome 105+ 기기

## iOS Safari 체크 (iPhone)

### 설치
- [ ] Safari로 사이트 접속
- [ ] 공유 버튼 → "홈 화면에 추가" 보임
- [ ] 추가 시 아이콘이 **"Meki"** 로 표시 (이전: "React App")
- [ ] 아이콘이 192px 로고로 깔끔하게 표시 (흐릿하지 않음)

### 실행
- [ ] 홈 아이콘 탭 → 풀스크린 standalone 모드
- [ ] 주소창/하단 네비게이션 바 없음
- [ ] 상단 노치/Dynamic Island 영역에 헤더가 가려지지 않음 (`safe-top` 동작)
- [ ] 하단 sticky 버튼이 홈 인디케이터에 가려지지 않음 (`safe-bottom` 동작)

### 큐레이션 스와이프
- [ ] `/curation` 접속
- [ ] 메모 카드 오른쪽 스와이프 → "✓ 추가" 표시 + 결정됨
- [ ] 메모 카드 왼쪽 스와이프 → "✕ 비공개" 표시 + 결정됨
- [ ] 카드 탭 → EditMemoModal 열림 (바텀 시트)
- [ ] 스와이프 중 페이지 세로 스크롤이 동시에 일어나지 않음 (touchAction 효과)
- [ ] 더블탭에 화면 확대 안 됨 (`maximum-scale=1` 효과)

### Reflection 스와이프
- [ ] `/reflection` 접속
- [ ] 카드 오른쪽 스와이프 → 수락
- [ ] 카드 왼쪽 스와이프 → 거절
- [ ] 카드 탭 → 인라인 수정 입력 표시

### 알림 (Phase 10.5 약속)
- [ ] 홈 화면 설치본에서 첫 실행 시 알림 권한 요청
- [ ] 권한 허용
- [ ] 큐레이션 알림 시간을 현재 시각 +2분으로 설정 (localStorage 직접 수정 OK)
- [ ] pending 메모 1개 이상 존재
- [ ] **2분 후 잠금화면에 "오늘의 큐레이션" 알림 도달** ← 핵심 검증
- [ ] 알림 탭 → `/curation` 자동 진입

### 오프라인
- [ ] 비행기 모드 켜기
- [ ] 앱 재실행 → 빈 화면 아니고 마지막 본 화면이 렌더링됨
- [ ] `/reflection` 접속 → 캐시된 reflection 카드 보임
- [ ] 비행기 모드 끄기 → GitHub 동기화 재개

## Android Chrome 체크

### 설치
- [ ] 사이트 접속 → "Add to Home Screen" 배너 자동 표시 또는 메뉴에서 설치
- [ ] 아이콘 "Meki"로 표시
- [ ] PWA 앱 서랍에 표시됨

### 실행
- [ ] standalone 풀스크린 모드
- [ ] 하단 제스처 바 영역 침범 안 함

### 알림
- [ ] 권한 허용
- [ ] 시각 설정 후 알림 도달
- [ ] 알림 탭 → `/curation` 진입

## 데스크탑 Chrome (회귀 테스트)

- [ ] `/curation` 정상 작동 (마우스 드래그로 스와이프)
- [ ] `/reflection` 정상 작동
- [ ] 알림 권한 요청 + 알림 동작

## 알려진 한계

- iOS 16.4 미만: Web Push 안 됨 → 알림은 OS에 도달하지 못함. 인앱 배지로만 표시.
- iOS PWA: 외부 OAuth 콜백 시 가끔 standalone에서 Safari로 새 창 열림 (Apple 버그) — Capacitor 전환 시 해결됨
- iOS PWA storage quota: ~50MB. 대량 메모 동기화 시 주의.

## 디버깅 팁

- **Safari 원격 디버그**: Mac Safari > 개발 > [iPhone 이름] > 페이지 선택
- **Chrome 원격 디버그**: `chrome://inspect` → USB Android 기기
- **Service Worker 상태**: Application 탭 > Service Workers
- **Manifest 검증**: Application 탭 > Manifest
