---
layout: default
title: Home
---

<h1>Posts</h1>
<ul>
  {% for post in site.posts %}
    <li>
      <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
      <span>{{ post.date | date: "%Y-%m-%d" }}</span>
    </li>
  {% endfor %}
  {% if site.posts == empty %}
    <li>아직 글이 없습니다. 에디터에서 게시를 수행하세요.</li>
  {% endif %}
</ul>


