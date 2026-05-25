# SPEC_vault_e2ee — AES-GCM 저장 암호화

> **도메인**: vault_e2ee — AES-GCM 저장 암호화
> **코드 클러스터** (graphify graph.json): C10
> **관련 파일**: src/utils/vault.js, src/stores/useVaultStore.js, src/utils/database.js (VaultKeyStore), src/components/VaultSetup.jsx
> **관련 Phase**: Phase 5
> **상태**: 🟡 골격만 — 인수조건 미작성

---

## 1. 입력 (Input)

- **유저 조작**: 금고(Vault) 잠금 해제 암호(Key) 입력, 민감 마크다운 노트 본문
- **원시 데이터**: 평문 문자열
- **API/이벤트**: PBKDF2 키 파생 이벤트, AES-GCM 256비트 암/복호화 트리거

## 2. 출력 (Output)

- **상태 변경**: Zustand `useVaultStore` 내 잠금 상태(isUnlocked) 및 금고 세션 키 갱신
- **데이터 영속화**: IndexedDB 캐시 스토리지(`database.js`) 및 GitHub 저장용 암호문 JSON 파일 형태 보존
- **UI 렌더링**: 금고 잠금/잠금해제 상태를 의미하는 UI 자물쇠 인디케이터 표시

## 3. 인수조건 (Acceptance Criteria)

LLM은 아래 인수조건이 완벽히 참(True)임을 검증할 수 있도록 코드를 작성해야 한다.
- [ ] **인수조건 1 (안전한 키 유도)**: 사용자의 마스터 패스워드는 PBKDF2를 통해 충분한 salt 및 반복 횟수를 거쳐 암호화 키로 파생되어야 한다.
- [ ] **인수조건 2 (AES-GCM 암호화)**: 영속 레이어에 쓰는 모든 비밀 노트는 로컬 클라이언트에서 AES-GCM 알고리즘으로 즉시 암호화되어 평문 유출이 없어야 한다.
- [ ] **인수조건 3 (메모리 격리)**: 금고가 다시 잠기거나 일정 시간 유휴 상태가 되면, 메모리 내 파생 키와 세션 토큰은 안전하게 소거(zeroed/nullified)되어야 한다.

## 4. 실패 모드 (Failure Modes)

- **패스워드 불일치**: 올바르지 않은 키 입력 시 복호화 실패(Integrity check fail) 경고를 노출하고 기존 암호문 원본 복구 보장.
- **키 유실 상태에서의 복구 불가**: 키 솔트나 데이터 손상 시 금고 복구가 불가능함을 안내하되, 덮어쓰기 저장 차단 정책 적용.

## 5. 검증 방법 (Verification)

개발 완료 후 아래 검증을 수행하여 인수를 확인한다.
- **자동화 테스트**: `cd miki-editor && npm test` (useVaultStore 테스트)
- **자기검증 시나리오**: 임의의 평문을 입력하고 저장 파일 내 실제 텍스트가 복독 불가능한 암호화 문자열로 저장되어 있는지 raw file 확인.

## 6. 참조 (References)

- **지식그래프 탐색**:
  - `graphify query "useVaultStore"` (useVaultStore Zustand 구조 및 바인딩 컴포넌트)
  - `graphify explain "VaultKeyStore"` (금고 키 유도 및 스토리지 노드 의존성)
- **설계 문서**: `ref-13-plan-vs-spec-hierarchy.md`, `ref-14-graphify-cluster-to-spec-mapping.md`

