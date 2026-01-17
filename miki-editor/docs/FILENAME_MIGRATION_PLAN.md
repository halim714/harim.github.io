# 파일명 규칙 마이그레이션 계획서

## 개요

**목표**: Git 히스토리 보존과 사용자 친화성을 동시에 달성하는 파일명 체계 구축

**현재**: `{slug}.md`  
**변경**: `{YYYYMMDD}-{slug}-{uuid8}.md`

---

## 1. 배경 및 동기

### 현재 문제점

1. **Git 히스토리 단절**: 제목 변경 시 파일명이 바뀌어 히스토리가 끊김
2. **내용 대폭 수정 시 위험**: Git이 "새 파일"로 인식할 가능성
3. **로컬 내보내기 시 불명확**: 파일명만으로 언제 작성했는지 알 수 없음

### 해결 방향

- **UUID**: Git 히스토리 추적의 앵커 역할 (불변)
- **날짜**: 시간적 맥락 제공, 파일 정렬 용이 (불변)
- **Slug**: 인간 가독성 (가변, 제목 따라 변경)

---

## 2. 핵심 원칙

1. **기존 문서 호환성**: 이미 저장된 문서가 깨지지 않아야 함
2. **점진적 마이그레이션**: 새 문서부터 적용, 기존 문서는 수정 시 변환
3. **사용자 무인식**: 에디터에서는 제목만 표시
4. **Git 히스토리 보존**: UUID로 추적 연속성 확보

---

## 3. 파일명 패턴 정의

### 패턴

```
{YYYYMMDD}-{truncated-slug}-{uuid8}.md
```

### 구성 요소

| 구성 | 규칙 | 가변성 | 예시 |
|------|------|--------|------|
| `YYYYMMDD` | 최초 생성일 | 불변 | `20240116` |
| `slug` | 현재 제목의 slugify | 가변 | `나의-생각` |
| `uuid8` | docId 앞 8자리 | 불변 | `a1b2c3d4` |

### 제한 사항

- **Slug 최대 길이**: 40자 (한글 기준, URL 인코딩 고려)
- **총 파일명 길이**: 약 61자 (Windows/Git 호환)

### 생성 예시

```
제목: "인공지능 시대에 신뢰를 구축하는 방법"
docId: a1b2c3d4-e5f6-7890-abcd-1234567890ef
생성일: 2024-01-16

→ 파일명: 20240116-인공지능-시대에-신뢰를-구축하는-a1b2c3d4.md
          (40자 초과 시 단어 경계에서 절삭)
```

---

## 4. 레이어별 표시 규칙

| 레이어 | 표시 내용 | 데이터 출처 |
|--------|-----------|-------------|
| GitHub 저장소 | `20240116-나의-생각-a1b2c3d4.md` | 파일명 |
| 에디터 문서 목록 | "나의 생각" | Front Matter `title` |
| 에디터 편집 화면 | "나의 생각" | Front Matter `title` |
| 블로그 URL | `/posts/my-thoughts/` | Front Matter `permalink` |
| 로컬 내보내기 | `20240116-나의-생각-a1b2c3d4.md` | 파일명 |

---

## 5. Front Matter 스키마

### 필수 필드

```yaml
---
docId: a1b2c3d4-e5f6-7890-abcd-1234567890ef
title: 나의 생각
createdAt: 2024-01-16T10:30:00Z
updatedAt: 2024-01-16T14:00:00Z
---
```

### 선택 필드 (향후 확장)

```yaml
---
slug: my-thoughts           # 커스텀 URL slug
permalink: /posts/my-thoughts/  # 블로그 URL 오버라이드
tags: [철학, 성장]
status: draft | published
---
```

---

## 6. 마이그레이션 시나리오

### 시나리오 A: 새 문서 생성

1. 사용자가 "새 글" 클릭
2. UUID 생성 → `a1b2c3d4-...`
3. 오늘 날짜 → `20240116`
4. 초기 제목 → "새 메모" → slug: `새-메모`
5. **파일명**: `20240116-새-메모-a1b2c3d4.md`

### 시나리오 B: 기존 문서 수정 (구 패턴)

1. 기존 파일: `my-old-post.md`
2. 수정 후 저장 시:
   - Front Matter `createdAt` 추출 → `20230501`
   - docId 확인/생성 → `b2c3d4e5-...`
   - 현재 제목 slug화
3. **새 파일명**: `20230501-my-old-post-b2c3d4e5.md`
4. 구 파일 삭제

### 시나리오 C: 제목 변경

1. 기존: `20240116-처음-생각-a1b2c3d4.md`
2. 제목을 "발전된 생각"으로 변경
3. **새 파일명**: `20240116-발전된-생각-a1b2c3d4.md`
4. 구 파일 삭제
5. Git: UUID 동일 + 내용 유사 → rename으로 인식

---

## 7. 영향 범위

### 변경 필요

| 파일 | 변경 내용 |
|------|-----------|
| `src/utils/slugify.js` | 파일명 생성 함수 추가 |
| `src/utils/storage-client.js` | `_savePostToGitHub`에 새 패턴 적용 |
| `src/components/Editor.jsx` | 초기 파일명 설정 로직 |

### 변경 불필요

| 파일 | 이유 |
|------|------|
| `src/services/github.js` | 파일명을 받아서 처리할 뿐 |
| `src/services/publish.js` | 파일명 그대로 사용 |
| UI 컴포넌트들 | `title` 표시만 함 |

---

## 8. 구현 순서

| 순서 | 작업 | 위험도 | 예상 시간 |
|------|------|--------|-----------|
| 1 | `slugify.js`에 `generateFilename()` 함수 추가 | 🟢 낮음 | 30분 |
| 2 | `_savePostToGitHub`에 새 패턴 적용 | 🟡 중간 | 1시간 |
| 3 | 마이그레이션 로직 (구→신 패턴 감지/변환) | 🟡 중간 | 1시간 |
| 4 | `getPostList` 파일명 파싱 호환성 확보 | 🟢 낮음 | 30분 |
| 5 | 테스트 및 검증 | 🟢 낮음 | 1시간 |

---

## 9. 검증 체크리스트

### 기능 테스트

- [ ] 새 문서 생성 → 새 패턴 파일명 생성됨
- [ ] 기존 문서 열기 → 정상 로드
- [ ] 기존 문서 저장 → 새 패턴으로 마이그레이션
- [ ] 제목 변경 → 파일명 slug 업데이트, 구 파일 삭제
- [ ] 에디터 목록 → 제목만 표시 (파일명 안 보임)
- [ ] 동기화 → SHA 정상 추적

### 호환성 테스트

- [ ] 구 패턴 파일 인식
- [ ] 혼합 상태 (구+신 패턴) 정상 작동
- [ ] Windows 경로 길이 (200자 이내)
- [ ] Git rename 감지 (`git log --follow` 테스트)

---

## 10. 롤백 계획

### 코드 롤백

```bash
git reset --hard {이전커밋}
git push origin main --force
```

### 데이터 복구

1. 새 패턴 파일에서 Front Matter `title` 추출
2. 구 패턴으로 rename: `{slug}.md`
3. Front Matter는 보존되어 있으므로 데이터 손실 없음

---

## 11. 예상 효과

| 항목 | Before | After |
|------|--------|-------|
| Git 히스토리 | 제목 변경 시 단절 위험 | UUID로 영구 연결 |
| 로컬 내보내기 | slug만으로 불명확 | 날짜+제목+ID로 명확 |
| 파일 정렬 | 무작위 | 날짜순 자동 정렬 |
| 에디터 표시 | 제목 (변경 없음) | 제목 (변경 없음) |
| 신뢰의 맥락 | 히스토리 단절 가능 | 변화 과정 완전 추적 |

---

## 12. 관련 문서

- [LAYOUT_IMPROVEMENT_PLAN.md](./LAYOUT_IMPROVEMENT_PLAN.md) - 에디터 레이아웃 개선 계획
- 향후: 자동 저장 최적화 계획

## 13. 레이어 분리 원칙 (핵심)

### 세 개의 독립된 계층

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (에디터)                                           │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 📄 나의 생각        ◀── Front Matter `title`       │    │
│  │ 📄 오늘의 일기      ◀── Front Matter `title`       │    │
│  └─────────────────────────────────────────────────────┘    │
│  사용자는 파일명을 절대 보지 않음                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  GitHub 저장소 (Storage)                                     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 20240117-나의-생각-a1b2c3d4.md                      │    │
│  │ 20240117-오늘의-일기-b2c3d4e5.md                    │    │
│  └─────────────────────────────────────────────────────┘    │
│  파일명 = 날짜 + 현재제목 + UUID8                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  IndexedDB (Local Cache)                                     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Primary Key: docId (UUID)                           │    │
│  │ filename: 참조용 (가변)                             │    │
│  └─────────────────────────────────────────────────────┘    │
│  docId는 불변, filename은 title 변경 시 함께 업데이트      │
└─────────────────────────────────────────────────────────────┘
```

### 핵심 원칙

| 계층 | 사용하는 키 | 표시 내용 | 변경 필요? |
|------|------------|-----------|-----------|
| **Frontend** | docId (내부) | `title` (표시) | ❌ 없음 |
| **GitHub** | 파일명 | 파일명 | ✅ 패턴 변경 |
| **IndexedDB** | docId | - | ❌ 없음 |

**사용자 직관성**: Frontend는 항상 `title`만 표시 (변경 없음)
**Git 히스토리**: 파일명에 UUID8 포함으로 추적 가능

---

## 14. 식별된 문제점 및 해결안

### 문제 1: `getPost`의 Hybrid Identity 의존성

**현상**: `post.filename || id`로 인해 UUID가 직접 파일명으로 사용될 위험

**해결안**:
```javascript
// 변경 전
const filename = post.filename || id;

// 변경 후
if (!post || !post.filename) {
  throw new Error(`문서를 목록에서 찾을 수 없습니다: ${id}`);
}
const filename = post.filename;
```

**원칙**: `filename`은 반드시 `getPostList`에서 파싱된 값만 사용. UUID 직접 폴백 금지.

---

### 문제 2: 제목 변경 시 파일명 동기화

**현상**: 제목 변경 시 파일명도 변경 → 삭제 + 생성 필요

**해결안**: 캐시된 SHA 활용으로 효율화
```javascript
// 1. UUID로 기존 문서 찾기 (파일명 아님!)
const existingPost = postList.find(p => p.id === docId);

// 2. 현재 제목으로 새 파일명 생성
const newFilename = generateFilename(createdAt, title, docId);

// 3. 파일명 변경 여부 확인
const filenameChanged = existingPost?.filename !== newFilename;

// 4. 새 파일 저장
await github.createOrUpdateFile(..., newFilename + '.md', ...);

// 5. 파일명 변경 시 구 파일 삭제 (캐시된 SHA 사용)
if (filenameChanged && existingPost?.sha) {
  await github.deleteFile(..., existingPost.filename + '.md', existingPost.sha);
}
```

**효과**: 
- 사용자 기대 충족 (파일명 = 현재 제목)
- 불필요한 API 호출 제거 (SHA 캐시 활용)

---

### 문제 3: 파일명 파싱의 복잡성

**현상**: 슬러그에 하이픈이 포함되면 파싱 오류 가능

**해결안: UUID8 앵커 기반 정규식**
```javascript
// UUID8: 마지막 하이픈 뒤 8자리 hex로 고정
const FILENAME_PATTERN = /^(\d{8})-(.+)-([a-f0-9]{8})$/;

function parseFilename(filename) {
  const name = filename.replace('.md', '');
  const match = name.match(FILENAME_PATTERN);
  
  if (!match) {
    // 구 패턴 호환 (마이그레이션 전 파일)
    return { date: null, slug: name, uuid8: null, isLegacy: true };
  }
  
  return {
    date: match[1],      // 20240117
    slug: match[2],      // 나의-생각-그리고-더 (하이픈 포함 OK)
    uuid8: match[3],     // a1b2c3d4
    isLegacy: false
  };
}
```

---

### 문제 4: 제목 없는 문서의 초기 저장

**현상**: 빈 제목 → 자동저장 → 제목 입력 → 파일명 변경

**해결안**: 초기 저장 지연 또는 허용
- 옵션 A: 제목 없으면 GitHub 저장 스킵 (로컬만)
- 옵션 B: "새-메모"로 저장 후, 제목 변경 시 파일명도 변경 (일관성)

```javascript
// 옵션 A: 제목 없으면 저장 스킵
if (!post.title || post.title.trim().length < 2) {
  console.log('제목 미입력 - GitHub 저장 스킵');
  return this._saveToLocalOnly(post);
}

// 옵션 B: 그냥 저장 (파일명 변경은 자연스러운 동작)
// → 사용자 의도와 일치 (제목 바꾸면 파일명도 바뀜)
```

**권장**: 옵션 B (일관성 있는 동작)

---

### 문제 5: Permalink/URL 충돌

**현상**: 긴 파일명 → 긴 URL → SEO 악영향

**해결안**: Front Matter `permalink` 또는 `slug` 필드 사용

```yaml
---
title: 인공지능 시대에 신뢰를 구축하는 방법에 대한 생각
slug: ai-trust              # 짧은 슬러그
permalink: /posts/ai-trust/  # 깔끔한 URL
---
```

**Jekyll 설정** (`_config.yml`):
```yaml
defaults:
  - scope:
      type: "posts"
    values:
      permalink: /:slug/
```

---

### 문제 6: `skipShaLookup` 최적화

**현상**: 제목 변경 → 새 파일명 → 기존 문서인지 판정 어려움

**해결안**: UUID 기반 존재 확인

```javascript
// 변경 전 (파일명 기반)
const existingPost = postList.find(p => p.filename === currentSlug);

// 변경 후 (UUID 기반)
const existingPost = postList.find(p => p.id === docId);

// 정확한 isNewFile 판정
const isNewFile = !existingPost;
// - existingPost가 있으면 → 기존 문서 → SHA 체크 ON
// - existingPost가 없으면 → 진짜 신규 → SHA 체크 SKIP
```

**효과**: 제목 변경해도 UUID가 같으면 정확히 기존 문서로 인식

---

## 15. 수정된 구현 순서

| 순서 | 작업 | 변경 파일 | 위험도 |
|------|------|-----------|--------|
| 1 | `parseFilename()` 함수 추가 | slugify.js | 🟢 낮음 |
| 2 | `generateFilename()` 함수 추가 | slugify.js | 🟢 낮음 |
| 3 | `getPostList` 파싱 로직 호환성 확보 | storage-client.js | 🟡 중간 |
| 4 | `existingPost` 판정을 UUID 기반으로 변경 | storage-client.js | 🟡 중간 |
| 5 | `_savePostToGitHub` 새 파일명 패턴 적용 | storage-client.js | 🟡 중간 |
| 6 | `getPost` 폴백 로직 제거 | storage-client.js | 🟢 낮음 |
| 7 | 구 파일 삭제 로직 (캐시 SHA 활용) | storage-client.js | 🟡 중간 |
| 8 | 구 패턴 호환성 테스트 | - | 🟢 낮음 |

---

## 16. 최종 요약

### 달성 목표

| 목표 | 달성 방법 | 상태 |
|------|----------|------|
| **사용자 직관성** | Frontend는 `title`만 표시 (변경 없음) | ✅ |
| **Git 히스토리** | UUID8로 rename 추적 가능 | ✅ |
| **로컬 내보내기** | 파일명에 날짜+제목 포함 | ✅ |
| **제목 변경 반영** | 파일명 = 현재 제목 | ✅ |

### 트레이드오프

| 항목 | 비용 | 허용 여부 |
|------|------|----------|
| 제목 변경 시 API 2회 | 드물게 발생 | ✅ 허용 |
| 파일명 파싱 복잡도 | 정규식 1개 추가 | ✅ 허용 |

---

## 17. 구체적 구현 코드

### Step 1: `slugify.js` - 파일명 유틸리티 추가

**파일**: `src/utils/slugify.js`

```javascript
// ============================================
// 기존 코드 유지 (slugify, generateUniqueFilename)
// ============================================

/**
 * 새 파일명 패턴 상수
 * 형식: YYYYMMDD-{slug}-{uuid8}.md
 */
const FILENAME_PATTERN = /^(\d{8})-(.+)-([a-f0-9]{8})$/;
const MAX_SLUG_LENGTH = 40;

/**
 * 날짜를 YYYYMMDD 형식으로 변환
 */
export function formatDateForFilename(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * 슬러그 길이 제한 (한글 40자 기준)
 */
export function truncateSlug(slug, maxLength = MAX_SLUG_LENGTH) {
  if (slug.length <= maxLength) return slug;
  
  // 단어 경계(하이픈)에서 자르기
  const truncated = slug.substring(0, maxLength);
  const lastHyphen = truncated.lastIndexOf('-');
  
  return lastHyphen > maxLength * 0.5 
    ? truncated.substring(0, lastHyphen) 
    : truncated;
}

/**
 * 새 파일명 생성
 * @param {string} createdAt - ISO 날짜 문자열
 * @param {string} title - 문서 제목
 * @param {string} docId - UUID (전체)
 * @returns {string} 파일명 (확장자 제외)
 */
export function generateFilename(createdAt, title, docId) {
  const date = formatDateForFilename(createdAt);
  const slug = truncateSlug(slugify(title));
  const uuid8 = docId.substring(0, 8).toLowerCase();
  
  return `${date}-${slug}-${uuid8}`;
}

/**
 * 파일명 파싱 (새 패턴 + 구 패턴 호환)
 * @param {string} filename - 파일명 (.md 포함 가능)
 * @returns {object} { date, slug, uuid8, isLegacy }
 */
export function parseFilename(filename) {
  const name = filename.replace(/\.md$/, '');
  const match = name.match(FILENAME_PATTERN);
  
  if (!match) {
    // 구 패턴: slug만 있는 경우 (마이그레이션 전 파일)
    return { 
      date: null, 
      slug: name, 
      uuid8: null, 
      isLegacy: true 
    };
  }
  
  return {
    date: match[1],      // 20240117
    slug: match[2],      // 나의-생각-그리고-더 (하이픈 포함 OK)
    uuid8: match[3],     // a1b2c3d4
    isLegacy: false
  };
}

/**
 * UUID8로 docId 찾기 (파일명에서 docId 추출 시 사용)
 * @param {string} uuid8 - 8자리 UUID
 * @param {Array} postList - 문서 목록
 * @returns {string|null} 전체 docId 또는 null
 */
export function findDocIdByUuid8(uuid8, postList) {
  const found = postList.find(p => p.id.toLowerCase().startsWith(uuid8.toLowerCase()));
  return found ? found.id : null;
}
```

---

### Step 2: `storage-client.js` - getPostList 파싱 개선

**위치**: `src/utils/storage-client.js` 약 75-96라인

```javascript
// 상단 import에 추가
import { 
  slugify, 
  generateUniqueFilename, 
  parseFilename, 
  generateFilename 
} from './slugify';

// getPostList 내부 map 함수 수정
githubPosts = files
  .filter(f => f.name.endsWith('.md'))
  .map(f => {
    const { data: frontMatter, content: body } = parseFrontMatter(f.text);
    const filename = f.name.replace('.md', '');
    
    // ✅ 새 파일명 파싱 (구 패턴 호환)
    const parsed = parseFilename(f.name);
    
    // docId 결정 우선순위:
    // 1. Front Matter의 docId
    // 2. 새 패턴의 uuid8로 매칭
    // 3. 구 패턴: 파일명 자체를 ID로 사용
    let docId = frontMatter.docId;
    if (!docId && parsed.uuid8) {
      // 새 패턴이지만 frontMatter에 docId가 없는 경우는 드묾
      // uuid8을 임시 ID로 사용 (나중에 전체 UUID로 업그레이드)
      docId = parsed.uuid8;
    }
    if (!docId) {
      docId = filename; // 구 패턴 폴백
    }

    return {
      id: docId,
      sha: f.sha,
      filename: filename,
      title: frontMatter.title || extractTitle(body) || filename.replace(/-/g, ' '),
      updatedAt: frontMatter.updatedAt || new Date().toISOString(),
      createdAt: frontMatter.createdAt || new Date().toISOString(),
      status: frontMatter.status || (frontMatter.published ? 'published' : 'draft'),
      size: f.text.length,
      preview: body.substring(0, 150) + (body.length > 150 ? '...' : ''),
      path: f.path,
      hasDocId: !!frontMatter.docId,
      isLegacyFilename: parsed.isLegacy, // 마이그레이션 필요 여부 표시
      source: 'github'
    };
  });

// ✅ Self-Healing: 동일 docId 중복 제거 (최신 updatedAt 기준)
githubPosts = Object.values(
  githubPosts.reduce((acc, post) => {
    if (!acc[post.id] || new Date(post.updatedAt) > new Date(acc[post.id].updatedAt)) {
      acc[post.id] = post;
    } else {
      console.warn(`⚠️ [Self-Healing] 중복 문서 발견, 최신 버전 유지: ${post.id}`);
    }
    return acc;
  }, {})
);
```

---

### Step 3: `storage-client.js` - getPost 폴백 제거

**위치**: `src/utils/storage-client.js` 약 181-185라인

```javascript
// 변경 전
const filename = post.filename || id;

// 변경 후
if (!post || !post.filename) {
  throw new Error(`문서를 목록에서 찾을 수 없습니다: ${id}`);
}
const filename = post.filename;
console.log(`Fetching post: docId=${id}, filename=${filename}`);
```

---

### Step 4: `storage-client.js` - _savePostToGitHub 전면 개편

**위치**: `src/utils/storage-client.js` 약 255-368라인

```javascript
// 🔒 Rename Lock (Race Condition 방지)
let renameInProgress = new Set();

async _savePostToGitHub(post) {
  const github = await getGithub();
  const docId = post.id;
  
  // 🔒 동일 문서에 대한 동시 Rename 방지
  if (renameInProgress.has(docId)) {
    console.log(`⏳ [SAVE] Rename 진행 중, 대기: ${docId}`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    return this._savePostToGitHub(post); // 재시도
  }

  console.log(`📝 [SAVE] docId 사용: ${docId}`);

  // ✅ 1. 제목 추출
  const title = post.title || extractTitle(post.content) || '새 메모';
  
  // ✅ 2. 기존 문서 확인 (UUID 기반)
  const postList = await this.getPostList();
  const existingPost = postList.find(p => p.id === docId);
  
  // ✅ 3. 파일명 결정 (새 패턴)
  const createdAt = existingPost?.createdAt || post.createdAt || new Date().toISOString();
  const newFilename = generateFilename(createdAt, title, docId);
  
  // ✅ 4. 파일명 변경 여부 확인
  const oldFilename = existingPost?.filename;
  const filenameChanged = oldFilename && oldFilename !== newFilename;
  
  if (filenameChanged) {
    console.log(`🔄 [SAVE] 파일명 변경: ${oldFilename}.md → ${newFilename}.md`);
    renameInProgress.add(docId); // Lock 설정
  } else if (!oldFilename) {
    console.log(`🆕 [SAVE] 새 파일명: ${newFilename}.md`);
  } else {
    console.log(`💾 [SAVE] 파일명 유지: ${newFilename}.md`);
  }

  // ✅ 5. Front Matter 구성
  const { data: newFrontMatter, content: body } = parseFrontMatter(post.content || '');
  const preservedFrontMatter = post.frontMatter || {};
  const now = new Date().toISOString();

  const updatedFrontMatter = {
    ...preservedFrontMatter,
    ...newFrontMatter,
    docId: docId,
    title: title,
    updatedAt: now,
    createdAt: preservedFrontMatter.createdAt || createdAt
  };

  const updatedContent = stringifyFrontMatter(updatedFrontMatter) + body;

  // ✅ 6. 새 파일 저장 (또는 덮어쓰기)
  const isNewFile = !existingPost;
  let newSha;
  
  try {
    newSha = await github.createOrUpdateFile(
      'miki-data',
      `miki-editor/posts/${newFilename}.md`,
      updatedContent,
      filenameChanged 
        ? `Rename: ${oldFilename} → ${newFilename} [${docId.substring(0, 8)}]`
        : `Save: ${title} [${docId.substring(0, 8)}]`,
      // 파일명 변경 시 새 경로에는 SHA가 없음
      filenameChanged ? undefined : (post.sha || existingPost?.sha),
      { skipShaLookup: isNewFile || filenameChanged }
    );
  } catch (error) {
    renameInProgress.delete(docId);
    throw error;
  }

  // ✅ 7. 파일명 변경 시 구 파일 삭제 (캐시된 SHA 사용)
  if (filenameChanged && existingPost?.sha) {
    try {
      await github.deleteFile(
        'miki-data',
        `miki-editor/posts/${oldFilename}.md`,
        `Delete old: ${oldFilename}.md [${docId.substring(0, 8)}]`,
        existingPost.sha // 캐시된 SHA 사용, 추가 GET 불필요
      );
      console.log(`✅ [SAVE] 구 파일 삭제 완료: ${oldFilename}.md`);
    } catch (e) {
      // 삭제 실패 시 재시도 큐에 추가 (선택적)
      console.warn(`⚠️ [SAVE] 구 파일 삭제 실패 (나중에 정리 필요): ${oldFilename}.md`, e);
    } finally {
      renameInProgress.delete(docId); // Lock 해제
    }
  } else {
    renameInProgress.delete(docId); // Lock 해제 (Rename 아닌 경우)
  }

  return {
    ...post,
    id: docId,
    filename: newFilename,
    title,
    sha: newSha,
    frontMatter: updatedFrontMatter,
    updatedAt: updatedFrontMatter.updatedAt,
    createdAt: updatedFrontMatter.createdAt,
    metadata: extractMetadata(updatedContent)
  };
}
```

---

### Step 5: 마이그레이션 트리거 (선택적)

기존 구 패턴 파일을 수정할 때 자동으로 새 패턴으로 변환됩니다.
별도의 일괄 마이그레이션 스크립트는 필요하지 않습니다.

```javascript
// 마이그레이션은 자동으로 발생:
// 1. 사용자가 구 패턴 문서 열기 (isLegacyFilename: true)
// 2. 문서 수정 후 저장
// 3. _savePostToGitHub에서 새 파일명 생성
// 4. 구 파일 삭제, 새 파일 생성
// 5. 다음 조회 시 새 패턴으로 인식
```

---

### 파일별 변경 요약

| 파일 | 변경 내용 | 라인 수정 범위 |
|------|----------|--------------|
| `slugify.js` | 4개 함수 추가 | 41-120 (신규) |
| `storage-client.js` | import 추가 | 6 |
| `storage-client.js` | getPostList 파싱 개선 + Self-Healing | 75-110 |
| `storage-client.js` | getPost 폴백 제거 | 181-185 |
| `storage-client.js` | _savePostToGitHub 전면 개편 | 255-368 |

---

## 18. 테스트 시나리오

### 시나리오 1: 신규 문서 생성

```
1. "새 글" 클릭
2. 제목: "테스트 문서" 입력
3. 예상 파일명: 20240117-테스트-문서-{uuid8}.md
4. 검증: GitHub에서 파일명 확인
```

### 시나리오 2: 제목 변경

```
1. 기존 문서 열기: "처음 생각"
2. 제목을 "발전된 생각"으로 변경
3. 저장 후 대기
4. 예상: 
   - 새 파일: 20240117-발전된-생각-{uuid8}.md
   - 구 파일: 삭제됨
5. 검증: git log --follow로 히스토리 연결 확인
```

### 시나리오 3: 구 패턴 마이그레이션

```
1. 구 패턴 파일 존재: my-old-post.md
2. 문서 열고 저장
3. 예상:
   - 새 파일: 20230501-my-old-post-{uuid8}.md
   - 구 파일: my-old-post.md 삭제
4. 검증: Front Matter에 docId 추가됨
```

### 시나리오 4: 중복 ID 처리

```
1. 동일 docId를 가진 파일이 2개 존재 (비정상 상태)
2. getPostList 호출
3. 예상: 최신 updatedAt 기준으로 1개만 반환
4. 검증: 콘솔에 Self-Healing 경고 표시
```

---

## 19. 비판적 검토 및 개선안

### 문제 1: getPost의 filename 요구 완화

**리스크**: 새 문서 생성 직후 네트워크 동기화 시차로 `getPostList`에 아직 인덱싱되지 않은 상태에서 `getPost` 호출 시 에러 발생

**해결책: Optimistic Filename Creation**

```javascript
// storage-client.js - getPost 수정
async getPost(id) {
  const github = await getGithub();
  const postList = await this.getPostList();
  const post = postList.find(p => p.id === id);

  // ✅ 신규 문서 대응: 목록에 없으면 예상 파일명 생성
  let filename;
  if (!post) {
    // 1순위: 로컬 캐시 확인 (IndexedDB)
    const localDoc = await db.documents.where('docId').equals(id).first();
    if (localDoc && localDoc.filename) {
      filename = localDoc.filename;
      console.log(`📦 [getPost] 로컬 캐시에서 filename 복구: ${filename}`);
    } else {
      // 2순위: createdAt 기반 예상 파일명 생성
      const now = new Date().toISOString();
      filename = generateFilename(now, '새 메모', id);
      console.log(`🔮 [getPost] 예상 filename 생성: ${filename}`);
    }
  } else {
    filename = post.filename;
  }

  console.log(`Fetching post: docId=${id}, filename=${filename}`);

  try {
    const file = await github.getFile('miki-data', `miki-editor/posts/${filename}.md`);
    // ... 기존 로직
  } catch (error) {
    if (error.status === 404) {
      throw new Error(`문서를 찾을 수 없습니다: ${id} (filename: ${filename})`);
    }
    throw error;
  }
}
```

**적용 범위**: `storage-client.js` 약 170-210라인

---

### 문제 2: Jekyll URL 자동화

**리스크**: 파일명이 길어지면서 블로그 URL도 `/2024/01/17/제목-uuid8.html` 처럼 지저분해짐

**해결책: Automatic Permalink Injection**

**Step A: Front Matter에 permalink 자동 주입**

```javascript
// storage-client.js - _savePostToGitHub 내부
const updatedFrontMatter = {
  ...preservedFrontMatter,
  ...newFrontMatter,
  docId: docId,
  title: title,
  updatedAt: now,
  createdAt: preservedFrontMatter.createdAt || createdAt,
  
  // ✅ permalink 자동 생성 (사용자가 직접 설정하지 않았다면)
  permalink: preservedFrontMatter.permalink || 
    newFrontMatter.permalink || 
    `/posts/${slugify(title)}/`,
    
  // ✅ slug 필드 추가 (Jekyll _config.yml에서 사용)
  slug: slugify(title)
};
```

**Step B: Jekyll 설정 업데이트**

파일: `miki-wiki/_config.yml` (publish 대상 저장소)

```yaml
# Permalink 설정
defaults:
  - scope:
      path: ""
      type: "posts"
    values:
      layout: "post"
      permalink: /:slug/  # Front Matter의 slug 필드 사용
```

**Step C: publish.js 검증 로직**

```javascript
// src/services/publish.js
async publishPost(post) {
  // Front Matter 검증
  const frontMatter = parseFrontMatter(post.content).data;

  if (!frontMatter.permalink && !frontMatter.slug) {
    console.warn(`⚠️ [Publish] permalink/slug 없음: ${post.filename}`);
    
    // 자동 생성
    frontMatter.slug = slugify(frontMatter.title || post.title);
    const updatedContent = stringifyFrontMatter(frontMatter) + parseFrontMatter(post.content).content;
    post.content = updatedContent;
  }

  // ... 기존 publish 로직
}
```

**적용 범위**: 
- `storage-client.js` 320-330라인
- `miki-wiki/_config.yml` (별도 파일)
- `publish.js` (검증 로직 추가)

---

### 문제 3: 중복 파일 Self-Cleaning

**리스크**: Rename 실패 시 GitHub에 중복 파일(Orphan)이 계속 쌓임

**해결책: Background Cleanup Queue**

```javascript
// storage-client.js 상단에 추가
/**
 * 백그라운드 파일 정리 큐
 * Rename 실패 등으로 남은 Orphan 파일 자동 삭제
 */
class CleanupQueue {
  constructor() {
    this.orphans = new Set();
    this.isProcessing = false;
  }

  add(filename, sha, reason = 'orphan') {
    this.orphans.add({ filename, sha, reason, addedAt: Date.now() });
    console.log(`🗑️ [Cleanup] 큐에 추가 (${reason}): ${filename}`);
  }

  async process() {
    if (this.isProcessing || this.orphans.size === 0) return;
    
    this.isProcessing = true;
    const github = await getGithub();

    for (const orphan of this.orphans) {
      try {
        await github.deleteFile(
          'miki-data',
          `miki-editor/posts/${orphan.filename}.md`,
          `Cleanup: remove ${orphan.reason} ${orphan.filename}`,
          orphan.sha
        );
        console.log(`✅ [Cleanup] 삭제 완료: ${orphan.filename}`);
        this.orphans.delete(orphan);
      } catch (e) {
        // 3회 재시도 후 포기
        const age = Date.now() - orphan.addedAt;
        if (age > 30000) { // 30초 경과
          console.error(`❌ [Cleanup] 삭제 포기: ${orphan.filename}`, e);
          this.orphans.delete(orphan);
        } else {
          console.warn(`⚠️ [Cleanup] 삭제 실패, 재시도: ${orphan.filename}`, e);
        }
      }
    }

    this.isProcessing = false;
  }
}

const cleanupQueue = new CleanupQueue();

// 주기적 실행 (10초마다)
if (typeof window !== 'undefined') {
  setInterval(() => cleanupQueue.process(), 10000);
}
```

**Self-Healing 로직과 통합:**

```javascript
// getPostList 내부
githubPosts = Object.values(
  githubPosts.reduce((acc, post) => {
    if (!acc[post.id]) {
      acc[post.id] = post;
    } else {
      // 중복 발견
      const existing = acc[post.id];
      const newer = new Date(post.updatedAt) > new Date(existing.updatedAt) ? post : existing;
      const older = newer === post ? existing : post;
      
      console.warn(`⚠️ [Self-Healing] 중복 문서 발견: ${post.id}`);
      console.warn(`  기존: ${existing.filename} (${existing.updatedAt})`);
      console.warn(`  신규: ${post.filename} (${post.updatedAt})`);
      console.warn(`  선택: ${newer.filename}`);
      
      // 오래된 버전을 Cleanup Queue에 추가
      cleanupQueue.add(older.filename, older.sha, 'duplicate');
      
      acc[post.id] = newer;
    }
    return acc;
  }, {})
);
```

**적용 범위**: `storage-client.js` 상단 + getPostList 내부

---

### 문제 4: 레거시 파일 강제 마이그레이션

**리스크**: UUID 없는 레거시 파일이 중복 인식될 수 있음

**해결책: Lazy Migration with UUID Injection**

```javascript
// storage-client.js - getPost 수정
async getPost(id) {
  // ... 기존 파일 가져오기 로직 ...

  const content = decodeContent(file.content);
  const { data: frontMatter, content: body } = parseFrontMatter(content);
  const metadata = extractMetadata(content);
  
  // ✅ 레거시 파일 감지 및 즉시 마이그레이션
  let needsMigration = false;
  if (!frontMatter.docId) {
    console.warn(`🔄 [Migration] 레거시 파일 감지: ${filename}`);
    needsMigration = true;
    
    // UUID 생성 및 주입
    frontMatter.docId = frontMatter.docId || generateDocumentId();
    frontMatter.title = frontMatter.title || extractTitle(body) || filename;
    frontMatter.createdAt = frontMatter.createdAt || new Date().toISOString();
    frontMatter.updatedAt = new Date().toISOString();
  }

  // 마이그레이션 필요 시 즉시 저장
  if (needsMigration) {
    const updatedContent = stringifyFrontMatter(frontMatter) + body;
    
    try {
      await github.createOrUpdateFile(
        'miki-data',
        `miki-editor/posts/${filename}.md`,
        updatedContent,
        `Migration: add docId to ${filename}`,
        file.sha
      );
      console.log(`✅ [Migration] UUID 주입 완료: ${frontMatter.docId}`);
    } catch (e) {
      console.error(`❌ [Migration] 실패: ${filename}`, e);
      // 실패해도 읽기는 계속 진행
    }
  }

  return {
    id: frontMatter.docId || id,
    filename: filename,
    title: frontMatter.title || metadata.title || id,
    content: body,
    frontMatter: frontMatter,
    sha: file.sha,
    metadata,
    updatedAt: frontMatter.updatedAt || new Date().toISOString(),
    wasMigrated: needsMigration // 디버깅용
  };
}
```

**적용 범위**: `storage-client.js` getPost 함수

---

### 문제 5: 시스템 파일 필터링 강화

**리스크**: `README.md`, `_config.yml` 등을 문서로 오인하여 마이그레이션 시도

**해결책: Strict Path and Extension Validation**

```javascript
// slugify.js - 새 함수 추가
/**
 * 문서 파일 여부 검증
 * @param {string} path - 파일 경로 (예: miki-editor/posts/test.md)
 * @param {string} filename - 파일명 (예: test.md)
 * @returns {boolean}
 */
export function isDocumentFile(path, filename) {
  // 1. 확장자 검증
  if (!filename.endsWith('.md')) return false;
  
  // 2. 시스템 파일 명시적 제외
  const systemFiles = [
    'README.md', 
    '_config.yml', 
    '.gitkeep', 
    '.gitignore',
    'index.md',
    'LICENSE.md',
    'CHANGELOG.md'
  ];
  if (systemFiles.includes(filename)) {
    console.log(`⏭️ [Filter] 시스템 파일 제외: ${filename}`);
    return false;
  }
  
  // 3. 폴더 경로 검증 (miki-editor/posts/ 내부만 허용)
  if (!path.startsWith('miki-editor/posts/')) {
    console.log(`⏭️ [Filter] 경로 제외: ${path}`);
    return false;
  }
  
  // 4. 숨김 파일 및 템플릿 파일 제외
  if (filename.startsWith('.') || filename.startsWith('_')) {
    console.log(`⏭️ [Filter] 숨김/템플릿 파일 제외: ${filename}`);
    return false;
  }
  
  return true;
}
```

**getPostList에 적용:**

```javascript
// storage-client.js
import { 
  slugify, 
  generateUniqueFilename, 
  parseFilename, 
  generateFilename,
  isDocumentFile  // ✅ 추가
} from './slugify';

// getPostList 내부
githubPosts = files
  .filter(f => {
    // ✅ 강화된 필터링
    const isValid = isDocumentFile(f.path, f.name);
    if (!isValid) {
      console.log(`⏭️ [getPostList] 비문서 파일 필터링: ${f.name}`);
    }
    return isValid;
  })
  .map(f => {
    // ... 기존 파싱 로직 ...
  });
```

**적용 범위**:
- `slugify.js` (새 함수 추가)
- `storage-client.js` import + getPostList 필터

---

## 20. 개선된 최종 구현 순서

| 순서 | 작업 | 변경 파일 | 목적 | 위험도 |
|------|------|-----------|------|--------|
| 0 | `isDocumentFile()` 함수 추가 | slugify.js | 문제 5 해결 | 🟢 낮음 |
| 1 | `CleanupQueue` 클래스 추가 | storage-client.js | 문제 3 해결 | 🟡 중간 |
| 2 | 기본 파일명 함수 추가 | slugify.js | 기본 기능 | 🟢 낮음 |
| 3 | `getPostList` 강화 필터링 | storage-client.js | 문제 5 해결 | 🟢 낮음 |
| 4 | `getPostList` Self-Healing + Cleanup 통합 | storage-client.js | 문제 3 해결 | 🟡 중간 |
| 5 | `getPost` Optimistic Filename | storage-client.js | 문제 1 해결 | 🟡 중간 |
| 6 | `getPost` Lazy Migration | storage-client.js | 문제 4 해결 | 🟡 중간 |
| 7 | `_savePostToGitHub` permalink 주입 | storage-client.js | 문제 2 해결 | 🟢 낮음 |
| 8 | `_savePostToGitHub` 전면 개편 | storage-client.js | 핵심 로직 | 🔴 높음 |
| 9 | Jekyll `_config.yml` 업데이트 | miki-wiki 저장소 | 문제 2 해결 | 🟢 낮음 |
| 10 | `publish.js` permalink 검증 | publish.js | 문제 2 보완 | 🟢 낮음 |

---

## 21. 안전장치 요약

| 문제 | 안전장치 | 복구 방법 |
|------|----------|----------|
| **1. filename 없음** | Optimistic Creation + IndexedDB 캐시 | 로컬 캐시 또는 예상 파일명 생성 |
| **2. 긴 URL** | permalink 자동 주입 | Jekyll에서 slug 필드 사용 |
| **3. 중복 파일** | CleanupQueue 백그라운드 삭제 | 10초마다 자동 정리 |
| **4. 레거시 파일** | Lazy Migration (읽을 때 UUID 주입) | 첫 조회 시 자동 마이그레이션 |
| **5. 시스템 파일** | isDocumentFile() 엄격 검증 | 경로 + 파일명 + 확장자 체크 |

---

**작성일**: 2026-01-16  
**수정일**: 2026-01-17  
**상태**: 개선안 확정, 구현 준비 완료



