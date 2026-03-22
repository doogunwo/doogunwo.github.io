---
title: 홈
layout: default
permalink: /
---

<section class="hero">
  <p class="eyebrow">Medium-inspired / sans-serif</p>
  <h1>생각을 쌓아두는 가장 단순한 형태의 블로그.</h1>
  <p>계층형 구조를 유지하면서, 읽기 편한 한 컬럼 중심 레이아웃으로 글과 노트를 축적합니다.</p>
</section>

<section class="feed">
  <div class="section-heading">
    <h2>Latest</h2>
    <a href="{{ '/archive/' | relative_url }}">전체 아카이브</a>
  </div>

  {% for post in site.posts limit: 6 %}
    <article class="post-card">
      <div class="post-card__meta">
        <time datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date: "%Y.%m.%d" }}</time>
        {% if post.categories and post.categories.size > 0 %}
          <span>{{ post.categories | join: " / " }}</span>
        {% endif %}
      </div>
      <h3><a href="{{ post.url | relative_url }}">{{ post.title }}</a></h3>
      <p>{{ post.excerpt | strip_html | strip_newlines | truncate: 140 }}</p>
    </article>
  {% endfor %}
</section>
