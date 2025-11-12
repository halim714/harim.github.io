---
layout: default
title: "검색"
permalink: /search/
---

<div class="note-container">
  <div class="note-header">
    <h1 class="note-title">검색</h1>
  </div>

  <div class="note-content">
    <div class="search-container">
      <div id="search-box">
        <!-- Google 프로그래머블 검색 엔진 검색 상자가 여기에 삽입됩니다 -->
        <script async src="https://cse.google.com/cse.js?cx=GOOGLE_SEARCH_ENGINE_ID"></script>
        <div class="gcse-search"></div>
      </div>
      
      <div class="search-instructions">
        <h3>검색 사용 방법</h3>
        <p>위 검색창에 키워드를 입력하여 위키 내 문서를 검색할 수 있습니다.</p>
        <p>검색 팁:</p>
        <ul>
          <li>정확한 구문 검색: 큰따옴표로 묶어 검색 (예: "제텔카스텐 방법론")</li>
          <li>특정 태그 검색: 태그 이름 앞에 # 기호 사용 (예: #방법론)</li>
          <li>복합 검색: AND, OR 연산자 사용 (예: 제텔카스텐 AND 노트)</li>
        </ul>
      </div>
    </div>
    
    <hr>
    
    <div class="local-search-container">
      <h2>로컬 검색 (JavaScript)</h2>
      <p>Google 검색 엔진이 작동하지 않는 경우를 대비한 대체 검색 방법입니다.</p>
      
      <div class="search-form">
        <input type="text" id="search-input" class="search-input" placeholder="검색어를 입력하세요...">
        <button id="search-button" class="search-button">검색</button>
      </div>
      
      <div id="search-results" class="search-results">
        <!-- 검색 결과가 여기에 표시됩니다 -->
      </div>
      
      <script>
        document.addEventListener('DOMContentLoaded', function() {
          // 검색 인덱스 데이터 로드
          let searchIndex = [];
          let searchData = {};
          
          fetch('/search-index.json')
            .then(response => response.json())
            .then(data => {
              searchData = data;
              searchIndex = Object.keys(data);
            })
            .catch(error => console.error('검색 인덱스를 로드하는 중 오류가 발생했습니다:', error));
          
          // 검색 함수
          function performSearch() {
            const query = document.getElementById('search-input').value.toLowerCase();
            const resultsContainer = document.getElementById('search-results');
            
            if (!query || query.length < 2) {
              resultsContainer.innerHTML = '<p>검색어는 2글자 이상이어야 합니다.</p>';
              return;
            }
            
            // 검색 결과 필터링
            const results = searchIndex.filter(key => {
              const item = searchData[key];
              return (
                item.title.toLowerCase().includes(query) ||
                item.content.toLowerCase().includes(query) ||
                (item.tags && item.tags.some(tag => tag.toLowerCase().includes(query)))
              );
            }).map(key => searchData[key]);
            
            // 결과 표시
            if (results.length === 0) {
              resultsContainer.innerHTML = '<p>검색 결과가 없습니다.</p>';
            } else {
              let html = '<ul>';
              results.forEach(result => {
                html += `
                  <li>
                    <div class="result-title"><a href="${result.url}">${result.title}</a></div>
                    <div class="result-snippet">${getSnippet(result.content, query)}</div>
                    ${result.tags ? `<div class="result-tags">태그: ${result.tags.join(', ')}</div>` : ''}
                  </li>
                `;
              });
              html += '</ul>';
              resultsContainer.innerHTML = html;
            }
          }
          
          // 검색어 주변 텍스트 추출 함수
          function getSnippet(content, query) {
            const index = content.toLowerCase().indexOf(query);
            if (index === -1) return content.substring(0, 150) + '...';
            
            const start = Math.max(0, index - 50);
            const end = Math.min(content.length, index + query.length + 50);
            let snippet = content.substring(start, end);
            
            if (start > 0) snippet = '...' + snippet;
            if (end < content.length) snippet += '...';
            
            return snippet;
          }
          
          // 이벤트 리스너 등록
          document.getElementById('search-button').addEventListener('click', performSearch);
          document.getElementById('search-input').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
              performSearch();
            }
          });
        });
      </script>
    </div>
  </div>
</div>
