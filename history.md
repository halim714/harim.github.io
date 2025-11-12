---
layout: default
title: "문서 히스토리"
permalink: /history/
---

<div class="note-container">
  <div class="note-header">
    <h1 class="note-title">문서 히스토리 기능</h1>
  </div>

  <div class="note-content">
    <h2>GitHub 커밋 히스토리를 활용한 문서 변경 이력 추적</h2>
    
    <p>제텔카스텐 위키는 GitHub의 강력한 버전 관리 기능을 활용하여 모든 문서의 변경 이력을 추적합니다. 이를 통해 언제, 누가, 어떤 내용을 변경했는지 정확히 파악할 수 있습니다.</p>
    
    <h3>문서 히스토리 확인 방법</h3>
    
    <h4>1. 문서 페이지에서 직접 확인</h4>
    <p>각 문서 페이지 하단에는 "히스토리 보기" 링크가 있습니다. 이 링크를 클릭하면 해당 문서의 GitHub 커밋 히스토리 페이지로 이동합니다.</p>
    
    <div class="code-example">
      <a href="https://github.com/username/zettelkasten-wiki/commits/main/_notes/sample-note.md" target="_blank" class="history-link">
        <span class="history-icon">📜</span> 이 문서의 히스토리 보기
      </a>
    </div>
    
    <h4>2. 저장소 전체 히스토리 확인</h4>
    <p>위키의 모든 변경 사항을 시간순으로 확인하려면 아래 링크를 이용하세요:</p>
    
    <div class="code-example">
      <a href="https://github.com/username/zettelkasten-wiki/commits/main" target="_blank" class="history-link">
        <span class="history-icon">📚</span> 전체 위키 히스토리 보기
      </a>
    </div>
    
    <h3>GitHub Blame 기능 활용</h3>
    <p>특정 문서의 각 줄이 언제, 누구에 의해 마지막으로 수정되었는지 확인하려면 GitHub의 Blame 기능을 활용할 수 있습니다.</p>
    
    <div class="code-example">
      <a href="https://github.com/username/zettelkasten-wiki/blame/main/_notes/sample-note.md" target="_blank" class="history-link">
        <span class="history-icon">🔍</span> 이 문서의 Blame 보기
      </a>
    </div>
    
    <h3>변경 사항 비교하기</h3>
    <p>두 버전 간의 차이점을 확인하려면:</p>
    <ol>
      <li>GitHub 커밋 히스토리 페이지에서 비교하려는 이전 버전을 찾습니다.</li>
      <li>해당 커밋을 클릭하여 상세 내용을 확인합니다.</li>
      <li>변경된 부분은 빨간색(삭제)과 녹색(추가)으로 표시됩니다.</li>
    </ol>
    
    <h2>최근 변경 문서 목록</h2>
    
    <div id="recent-changes">
      <h3>최근 수정된 문서</h3>
      <ul class="recent-notes">
        {% assign sorted_notes = site.notes | sort: 'last_modified_at' | reverse %}
        {% for note in sorted_notes limit:10 %}
          <li>
            <a href="{{ note.url | relative_url }}">{{ note.title }}</a>
            <span class="note-date">{{ note.last_modified_at | date: "%Y-%m-%d" }}</span>
          </li>
        {% endfor %}
      </ul>
    </div>
    
    <h2>Jekyll에서 문서 변경 이력 표시</h2>
    
    <p>각 문서 페이지에는 다음과 같은 정보가 자동으로 표시됩니다:</p>
    <ul>
      <li>최초 작성 일자</li>
      <li>마지막 수정 일자</li>
      <li>GitHub 히스토리 링크</li>
    </ul>
    
    <p>이 정보는 Front Matter의 <code>date</code>와 <code>last_modified_at</code> 속성을 기반으로 합니다.</p>
    
    <div class="code-example">
      <pre>
---
layout: note
title: "샘플 노트"
date: 2025-04-18
last_modified_at: 2025-04-18
tags: [샘플, 예시]
---
      </pre>
    </div>
    
    <h2>자동 수정 일자 업데이트</h2>
    
    <p>문서 편집 시 <code>last_modified_at</code> 값을 수동으로 업데이트해야 합니다. 그러나 GitHub Actions를 활용하여 이 과정을 자동화할 수도 있습니다.</p>
    
    <p>GitHub Actions 워크플로우 설정 예시:</p>
    
    <div class="code-example">
      <pre>
name: Update Last Modified Date

on:
  push:
    paths:
      - '_notes/**'

jobs:
  update-last-modified:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Update last_modified_at
        run: |
          # 변경된 파일 목록 가져오기
          git diff --name-only HEAD^ HEAD | grep '_notes/' | while read file; do
            # Front Matter의 last_modified_at 업데이트
            sed -i "s/last_modified_at: .*/last_modified_at: $(date +%Y-%m-%d)/" "$file"
          done
          
          # 변경사항 커밋
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add .
          git commit -m "Update last_modified_at" || echo "No changes to commit"
          git push
      </pre>
    </div>
  </div>
</div>

<style>
  .code-example {
    background-color: #f6f8fa;
    border-radius: 3px;
    padding: 1rem;
    margin: 1rem 0;
  }
  
  .history-link {
    display: inline-flex;
    align-items: center;
    padding: 0.5rem 1rem;
    background-color: #f1f8ff;
    border: 1px solid #c8e1ff;
    border-radius: 3px;
    color: #0366d6;
    text-decoration: none;
  }
  
  .history-link:hover {
    background-color: #dbedff;
    text-decoration: none;
  }
  
  .history-icon {
    margin-right: 0.5rem;
  }
</style>
