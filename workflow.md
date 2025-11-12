---
layout: default
title: "문서 생성 워크플로우"
---

<div class="note-container">
  <div class="note-header">
    <h1 class="note-title">문서 생성 및 편집 워크플로우</h1>
  </div>

  <div class="note-content">
    <h2>새 노트 생성 방법</h2>
    
    <h3>1. 로컬 환경에서 마크다운 파일 생성</h3>
    <p>제텔카스텐 위키에 새 노트를 추가하는 가장 기본적인 방법입니다.</p>
    
    <ol>
      <li><code>_notes</code> 디렉토리에 새 마크다운 파일을 생성합니다. 파일명은 <code>제목-slug.md</code> 형식을 권장합니다.</li>
      <li>파일 상단에 다음과 같은 Front Matter를 추가합니다:
<pre>
---
layout: note
title: "노트 제목"
date: YYYY-MM-DD
last_modified_at: YYYY-MM-DD
tags: [태그1, 태그2]
parent: 상위-문서-slug
---
</pre>
      </li>
      <li>Front Matter 아래에 마크다운 형식으로 노트 내용을 작성합니다.</li>
      <li>다른 노트와의 연결은 <code>[[노트-slug]]</code> 형식으로 작성합니다.</li>
      <li>변경사항을 저장하고 Git을 통해 커밋 및 푸시합니다.</li>
    </ol>
    
    <h3>2. GitHub 웹 인터페이스를 통한 생성</h3>
    <p>로컬 환경 설정 없이 GitHub 웹 인터페이스에서 직접 노트를 생성하고 편집할 수 있습니다.</p>
    
    <ol>
      <li>GitHub 저장소에 접속합니다.</li>
      <li><code>_notes</code> 디렉토리로 이동합니다.</li>
      <li>"Add file" 버튼을 클릭하고 "Create new file"을 선택합니다.</li>
      <li>파일명을 <code>제목-slug.md</code> 형식으로 입력합니다.</li>
      <li>위의 Front Matter 형식과 마크다운 내용을 작성합니다.</li>
      <li>"Commit new file" 버튼을 클릭하여 저장합니다.</li>
    </ol>
    
    <h3>3. 템플릿을 활용한 생성 (추천)</h3>
    <p>일관된 노트 형식을 유지하기 위해 템플릿을 활용하는 방법입니다.</p>
    
    <ol>
      <li><code>_templates</code> 디렉토리에서 적절한 템플릿을 선택합니다.</li>
      <li>템플릿 파일을 복사하여 <code>_notes</code> 디렉토리에 새 파일로 저장합니다.</li>
      <li>템플릿의 내용을 수정하여 새 노트를 작성합니다.</li>
      <li>변경사항을 저장하고 Git을 통해 커밋 및 푸시합니다.</li>
    </ol>
    
    <h2>노트 간 연결 방법</h2>
    
    <h3>직접 링크</h3>
    <p>다른 노트로의 링크는 <code>[[노트-slug]]</code> 형식으로 작성합니다. 이 형식은 자동으로 해당 노트의 URL로 변환됩니다.</p>
    <p>예: <code>이 개념에 대한 자세한 내용은 [[제텔카스텐-방법론]]을 참조하세요.</code></p>
    
    <h3>백링크</h3>
    <p>백링크는 자동으로 생성됩니다. 노트 A에서 노트 B로 링크하면, 노트 B의 하단에 노트 A가 백링크로 표시됩니다.</p>
    
    <h3>계층 구조</h3>
    <p>Front Matter의 <code>parent</code> 속성을 사용하여 노트 간 계층 구조를 설정할 수 있습니다.</p>
    <p>예: <code>parent: 상위-개념</code></p>
    
    <h2>태그 사용 방법</h2>
    <p>Front Matter의 <code>tags</code> 배열에 태그를 추가하여 노트를 분류할 수 있습니다.</p>
    <p>예: <code>tags: [개념, 방법론, 도구]</code></p>
    
    <h2>노트 편집 및 업데이트</h2>
    <ol>
      <li>편집할 노트 파일을 엽니다.</li>
      <li>내용을 수정합니다.</li>
      <li><code>last_modified_at</code> 값을 현재 날짜로 업데이트합니다.</li>
      <li>변경사항을 저장하고 Git을 통해 커밋 및 푸시합니다.</li>
    </ol>
    
    <h2>변경 이력 확인</h2>
    <p>각 노트의 변경 이력은 GitHub의 커밋 히스토리를 통해 확인할 수 있습니다.</p>
    <ol>
      <li>GitHub 저장소에서 해당 노트 파일로 이동합니다.</li>
      <li>"History" 버튼을 클릭하여 변경 이력을 확인합니다.</li>
      <li>특정 커밋을 클릭하여 상세 변경 내용을 확인할 수 있습니다.</li>
    </ol>
  </div>
</div>
