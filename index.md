---

layout: default

title: Home

---



<h1>Posts</h1>

<ul>

&nbsp; {% for post in site.posts %}

&nbsp;   <li>

&nbsp;     <a href="{{ post.url | relative\_url }}">{{ post.title }}</a>

&nbsp;     <span>{{ post.date | date: "%Y-%m-%d" }}</span>

&nbsp;   </li>

&nbsp; {% endfor %}

</ul>

