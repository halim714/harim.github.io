---
layout: default
title: "태그"
permalink: /tags/
---

<div class="note-container">
  <div class="note-header">
    <h1 class="note-title">태그 목록</h1>
  </div>

  <div class="note-content">
    <div class="tag-cloud">
      {% assign tags = site.notes | map: "tags" | uniq | sort %}
      {% for tag in tags %}
        <a href="#{{ tag | slugify }}" class="note-tag">#{{ tag }}</a>
      {% endfor %}
    </div>

    <div class="tag-sections">
      {% for tag in tags %}
        <div class="tag-section" id="{{ tag | slugify }}">
          <h2>#{{ tag }}</h2>
          <ul>
            {% for note in site.notes %}
              {% if note.tags contains tag %}
                <li><a href="{{ note.url | relative_url }}">{{ note.title }}</a></li>
              {% endif %}
            {% endfor %}
          </ul>
        </div>
      {% endfor %}
    </div>
  </div>
</div>

<style>
  .tag-cloud {
    margin: 2rem 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  
  .tag-section {
    margin-bottom: 3rem;
  }
  
  .tag-section h2 {
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 0.5rem;
  }
</style>
