# SPEC_xss_security — 외부 입력 → 안전 렌더

> **도메인**: xss_security — 외부 입력 → 안전 렌더
> **코드 클러스터** (graphify graph.json): Phase 1 (모듈 흩어짐)
> **관련 파일**: vercel.json (CSP), src/utils/sanitize.js (DOMPurify), src/components/IsolatedPreview.jsx (iframe sandbox)
> **관련 Phase**: Phase 1
> **상태**: 🟡 골격만 — 인수조건 미작성

---

## 1. 입력 (Input)

<!-- grilled 2026-05-21: 사용자 발화 → 코드 사실 대조 → 두 흐름 분리 확정 -->

**1.1 입력 분기 — sanitize 강도가 다른 두 흐름**

| 흐름 | 원천 | 경로 | 보호 강도 | 인접 SPEC |
|---|---|---|---|---|
| **A — 위키 렌더링** | `graph.jsonl` 트리플 → `tripleParser` → 마크다운 페이지 (AI 생성, 구조 보장) | marked → `sanitizeHtml` → `IsolatedPreview` (iframe sandbox + blob URL) | iframe 격리 + DOMPurify + CSP | `SPEC_wiki_render` |
| **B — 메모 큐레이션** (현 구현: `MemoCard.jsx:124`) | Apple/Samsung Notes 추출 평문 (로컬 추출 = 외부 입력 아님) | `<p>{memo.body}</p>` JSX 텍스트 보간 (200자 truncate) | **React 자동 escape** (DOMPurify 불필요) | `SPEC_curation` |

근거: 흐름 B에서 iframe + marked를 쓰면 (a) 입력이 마크다운이 아니므로 렌더링 결과가 원문과 달라질 수 있음, (b) 큐레이션 화면(빠르게 읽고 선택/제외 판단)에 성능·복잡도 과잉.

**1.2 [삭제 — `xssStore` 존재 안 함, 자의 채움]**

**1.3 렌더링 이벤트** (흐름 A 한정)

- `IsolatedPreview` useEffect 의존성(`html`, `title`, `onError`) 변경 시 blob URL 재생성/이전 URL revoke

## 2. 출력 (Output)

<!-- grilled 2026-05-21: 흐름 A/B 출력 분리 + 메인 페이지 CSP 정책 명시 -->
<!-- grilled 2026-05-21: allow-same-origin 단독 위험 없음 + 스크립트 차단은 CSP 아닌 sandbox 책임 확정 -->

| 흐름 | 출력 |
|---|---|
| **A — 위키 렌더링** | `sandbox="allow-same-origin"` iframe + blob URL. `allow-scripts` / `allow-forms` / `allow-popups` 허용 안 함. `allow-same-origin` 단독은 JavaScript 실행 권한 부여 안 함 — 위험 조합은 `allow-same-origin` + `allow-scripts` 동시 허용 시이며 현재 구현은 `allow-scripts` 제외로 차단. 스크립트 실행 차단은 CSP가 아닌 iframe sandbox가 보장. 앱 CSP `frame-src 'self' blob:`으로 blob iframe 로딩 허용. |
| **B — 메모 큐레이션** | `<p>` 텍스트 노드 — React escape된 plain text. 메인 페이지 CSP 적용 |

**메인 페이지 CSP** (`vercel.json`):
- 현 상태: `script-src 'self' 'unsafe-inline' 'unsafe-eval'` — `unsafe-eval` 허용 중
- 원인: Toast UI Editor 3.x (CodeMirror 5 번들)의 `new Function()` 사용으로 인한 강제. Meki 자체 코드는 `eval()`/`new Function` 0건
- 목표: Toast UI Editor 교체 후 `unsafe-eval` 제거
- 단기 위협 모델: `unsafe-eval` 악용이 실제 XSS 경로가 되려면 (1) DOMPurify 우회 + (2) IsolatedPreview 우회 + (3) 메인 페이지 직접 주입 — 3단계 모두 필요. 현 보호 계층으로 충분히 차단됨

## 3. 인수조건 (Acceptance Criteria)

<!-- grilled 2026-05-21: 코드 사실 대조 후 사용자 발화로 확정 -->
<!-- grilled 2026-05-21: AC3 — blob:은 "넣기" 위해, sandbox는 "실행 차단" 위해 분리. unsafe-eval은 §2 Toast UI 맥락 -->

LLM은 아래 인수조건이 완벽히 참(True)임을 검증할 수 있도록 코드를 작성해야 한다.

- [ ] **인수조건 1 (iframe 격리)**: 흐름 A의 `IsolatedPreview`는 `sandbox="allow-same-origin"`만 허용한다. `allow-scripts` / `allow-forms` / `allow-popups`는 의도적으로 제외 — JavaScript 실행 및 폼 제출/팝업 완전 차단.
- [ ] **인수조건 2-A (HTML 렌더링 경로)**: HTML 렌더링 경로는 `sanitizeHtml()` (DOMPurify 화이트리스트)를 통과해야 한다.
- [ ] **인수조건 2-B (메모 큐레이션 렌더링)**: `MemoCard`는 현재 plain text only 렌더링 경계다. raw memo 제목/본문을 HTML, 마크다운, 링크, 이미지, HTML highlight 등으로 해석하는 rich preview 변경은 금지한다. rich preview가 필요한 경우, 구현 전에 `SPEC_xss_security`의 AC2-B와 FM-3을 먼저 갱신하고 sanitizer/렌더링 경로를 새로 정의해야 한다. SPEC 갱신 전까지 해당 구현은 AC2-B 위반으로 간주한다.
- [ ] **인수조건 2-C (dangerouslySetInnerHTML 정책)**: `dangerouslySetInnerHTML`은 `sanitizeHtml()`을 거친 HTML에만 허용한다. raw memo 데이터를 `dangerouslySetInnerHTML`에 직접 전달 금지.
- [ ] **인수조건 3 (CSP)**: `vercel.json`의 `Content-Security-Policy` 헤더는 `frame-src 'self' blob:`을 포함해야 한다. `blob:`은 IsolatedPreview가 생성한 blob URL을 iframe에 **로딩**시키기 위해 필요하다 (`URL.createObjectURL` → `<iframe src>`). iframe 내부에서 JavaScript가 **실행되지 않도록** 막는 핵심 장치는 sandbox(`allow-scripts` 제외)이며, 부모 페이지 CSP의 `script-src 'unsafe-eval'`은 본 AC의 검증 대상이 아니다 — 이는 메인 앱 Toast UI Editor 이슈로 §2에서 별도 추적한다.

## 4. 실패 모드 (Failure Modes)

<!-- grilled 2026-05-21: 실패 모드 = 에이전트 구현 루프 보장 장치로 재정의. 각 FM은 검출/진단/수정/재검증 4요소 필수 -->
<!-- grilled 2026-05-21: FM-3 검출 grep을 marked/ReactMarkdown/linkify/html-react-parser까지 확장 (rich preview 라이브러리 우회 차단) -->

각 실패 모드는 에이전트 구현 루프가 자율 재시도 가능하도록 **검출 / 진단 / 수정 / 재검증** 4요소를 명시한다.

### FM-1: AC1 위반 (sandbox 약화)
- **검출**: `grep -n 'sandbox=' miki-editor/src/components/IsolatedPreview.jsx` → `"allow-same-origin"` 외 값이 잡히면 실패
- **진단**: `allow-scripts` / `allow-forms` / `allow-popups` 중 하나 이상이 추가됨 → AC1 위반
- **수정**: `IsolatedPreview.jsx`의 iframe sandbox 속성을 정확히 `sandbox="allow-same-origin"`으로 복구
- **재검증**: `cd miki-editor && npx jest src/components/__tests__/IsolatedPreview.test.jsx` (파일 전체 — sandbox / sanitize / XSS 시나리오 통합)

### FM-2: AC2-A / 2-C 위반 (HTML 렌더 경로에서 sanitize 누락)
- **허용 패턴 명시**: `dangerouslySetInnerHTML={{ __html: sanitizeHtml(...) }}` — `dangerouslySetInnerHTML`이 있는 같은 라인에 항상 `sanitizeHtml(` 호출이 존재해야 한다 (example/test 파일은 검증 대상 외).
- **검출**:
  ```bash
  grep -rn 'dangerouslySetInnerHTML' miki-editor/src \
    --include='*.jsx' \
    --exclude='*.example.jsx' \
    --exclude='*.test.jsx' \
    | grep -v 'sanitizeHtml(' \
    | wc -l
  # 0 expected
  ```
- **진단**: sanitize 누락 호출 발견 → AC2-A 또는 AC2-C 위반
- **수정**: 해당 호출을 `dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}` 패턴으로 일관화
- **재검증**: `cd miki-editor && npm run build && npx jest src/__tests__/shallow-boot.test.jsx` + 동일 grep 재실행으로 누락 0건 확인

### FM-3: AC2-B 위반 (MemoCard에서 HTML 렌더)
- **검출**: `grep -n 'dangerouslySetInnerHTML\|innerHTML\|marked\|ReactMarkdown\|react-markdown\|linkify\|html-react-parser' miki-editor/src/components/MemoCard.jsx` → 결과 0건이어야 통과
- **진단**: MemoCard가 raw memo를 HTML로 렌더 → AC2-B 위반 (React auto-escape 우회)
- **수정**: 해당 라인을 JSX 텍스트 보간(`<p>{memo.body}</p>`)으로 복구
- **재검증**: 동일 grep 0건 (테스트 부재는 본 SPEC 범위 외 — 회귀 방어 테스트는 별도 과제)

### FM-4: AC3 위반 (CSP frame-src에 blob: 누락)
- **검출**: `grep -o "frame-src [^;]*" miki-editor/vercel.json` → `'self' blob:`이 모두 포함되어야 통과
- **진단**: `blob:` 누락 시 IsolatedPreview iframe 로딩 실패 → 위키 렌더 전면 중단
- **수정**: `vercel.json`의 `Content-Security-Policy` 헤더 `frame-src`에 `'self' blob:` 복구
- **재검증**: 동일 grep 결과 일치 + 로컬 dev 서버에서 위키 페이지 1건 렌더 수동 확인

### FM-5: 에스컬레이션 조건
위 FM-1~4 중 어느 하나라도 **동일 수정을 3회 시도해도 재검증을 통과하지 못하면** 에이전트는 즉시 루프를 중단하고 사용자에게 보고한다 — 인수조건 자체가 코드 사실과 어긋났을 가능성 시사.

## 5. 검증 방법 (Verification)

<!-- grilled 2026-05-21: §4 루프 통과 후 단발 게이트 — 5.1 자동화 / 5.2 AC별 grep -->
<!-- grilled 2026-05-21: FM-2/§5.2 — 허용 패턴 명시(같은 라인 sanitizeHtml() + example/test 제외 + wc -l 0 비교) -->
<!-- grilled 2026-05-22: §5.3 수동 시나리오 삭제 — 자동화/grep 게이트와 truth condition 중복 + dev 서버 의존은 CLAUDE.md 금지 -->

§4 실패 모드 4가지를 모두 통과한 후 아래 게이트를 순서대로 실행하여 인수를 확인한다. 자동화 게이트(§5.1)와 grep 게이트(§5.2)가 모든 AC의 truth condition을 결정 가능하게 검증한다. 별도 수동 시나리오는 두지 않는다 — 동일한 truth condition을 사람 눈으로 다시 확인하는 것은 검증이 아니라 cargo cult이며, dev 서버 의존 시나리오는 CLAUDE.md 빌드 규칙(`❌ npm run dev`)과도 충돌한다.

### 5.1 자동화 게이트
```bash
cd miki-editor
npm run build                                                  # 빌드 무오류
npx jest src/components/__tests__/IsolatedPreview.test.jsx     # AC1 sandbox + XSS 시나리오 3종 (스크립트/onerror/javascript:)
npx jest src/__tests__/shallow-boot.test.jsx                   # 부팅 무결성 (WSOD 차단)
```

### 5.2 AC별 grep 게이트
§4 FM 검출 명령을 단발 실행으로 일괄 점검한다.

```bash
# AC1 — sandbox는 "allow-same-origin"만 허용
grep -n 'sandbox=' miki-editor/src/components/IsolatedPreview.jsx | grep -v '"allow-same-origin"' | wc -l   # 0 expected

# AC2-A / 2-C — 같은 라인에 sanitizeHtml( 호출 존재 (허용 패턴 명시)
grep -rn 'dangerouslySetInnerHTML' miki-editor/src \
  --include='*.jsx' \
  --exclude='*.example.jsx' \
  --exclude='*.test.jsx' \
  | grep -v 'sanitizeHtml(' \
  | wc -l   # 0 expected

# AC2-B — MemoCard는 plain text only (HTML/마크다운/링크/이미지/highlight 라이브러리 금지)
grep -n 'dangerouslySetInnerHTML\|innerHTML\|marked\|ReactMarkdown\|react-markdown\|linkify\|html-react-parser' \
  miki-editor/src/components/MemoCard.jsx | wc -l   # 0 expected

# AC3 — vercel.json CSP frame-src에 'self' blob: 포함
grep -o "frame-src [^;]*" miki-editor/vercel.json   # 'self' blob: 포함 확인
```


## 6. 참조 (References)

- **지식그래프 탐색**:
  - `graphify query "IsolatedPreview"` (IsolatedPreview 컴포넌트 구조 및 의존성)
  - `graphify explain "sanitize"` (DOMPurify sanitize 유틸 설명)
- **설계 문서**: `ref-13-plan-vs-spec-hierarchy.md`

