---
layout: default
title: "계층 구조"
permalink: /hierarchy/
---

<div class="note-container">
  <div class="note-header">
    <h1 class="note-title">문서 계층 구조</h1>
  </div>

  <div class="note-content">
    <div class="hierarchy-description">
      <p>제텔카스텐 위키의 문서들은 계층 구조로 조직화될 수 있습니다. 각 문서는 상위 문서(부모)를 가질 수 있으며, 이를 통해 지식을 체계적으로 구조화할 수 있습니다.</p>
    </div>

    <div class="hierarchy-tree">
      <h2>문서 계층도</h2>
      <ul class="tree">
        {% assign root_notes = "" | split: "" %}
        {% for note_item in site.notes %}
          {% unless note_item.parent and note_item.parent != "" %}
            {% assign root_notes = root_notes | push: note_item %}
          {% endunless %}
        {% endfor %}
        {% for note in root_notes %}
          <li>
            <a href="{{ note.url | relative_url }}">{{ note.title }}</a>
            {% assign children = site.notes | where: "parent", note.slug %}
            {% if children.size > 0 %}
              <ul>
                {% for child in children %}
                  <li>
                    <a href="{{ child.url | relative_url }}">{{ child.title }}</a>
                    {% assign grandchildren = site.notes | where: "parent", child.slug %}
                    {% if grandchildren.size > 0 %}
                      <ul>
                        {% for grandchild in grandchildren %}
                          <li>
                            <a href="{{ grandchild.url | relative_url }}">{{ grandchild.title }}</a>
                          </li>
                        {% endfor %}
                      </ul>
                    {% endif %}
                  </li>
                {% endfor %}
              </ul>
            {% endif %}
          </li>
        {% endfor %}
      </ul>
    </div>

    <div class="hierarchy-usage">
      <h2>계층 구조 사용 방법</h2>
      
      <h3>1. 문서에 부모 설정하기</h3>
      <p>문서의 Front Matter에 <code>parent</code> 속성을 추가하여 상위 문서를 지정할 수 있습니다:</p>
      <div class="code-example">
        <pre>
---
layout: note
title: "하위 개념 노트"
date: 2025-04-18
tags: [예시, 계층구조]
parent: 상위-개념-노트
---
        </pre>
      </div>
      
      <h3>2. 계층 구조 탐색</h3>
      <p>문서 페이지에서는 상위 문서 링크가 표시되며, 이 페이지에서는 전체 계층 구조를 트리 형태로 확인할 수 있습니다.</p>
      
      <h3>3. 브레드크럼(Breadcrumb) 네비게이션</h3>
      <p>문서 페이지에서는 현재 문서의 위치를 보여주는 브레드크럼 네비게이션이 표시됩니다:</p>
      <div class="breadcrumb-example">
        <div class="breadcrumb">
          <a href="#">홈</a> &gt; <a href="#">상위 개념</a> &gt; <span>현재 문서</span>
        </div>
      </div>
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
  
  .breadcrumb-example {
    margin: 1rem 0;
  }
  
  .breadcrumb {
    padding: 0.5rem 1rem;
    background-color: #f1f8ff;
    border-radius: 3px;
  }
  
  .tree {
    margin: 1rem 0;
    padding-left: 1.5rem;
  }
  
  .tree ul {
    padding-left: 1.5rem;
  }
  
  .tree li {
    margin: 0.5rem 0;
  }
</style>

