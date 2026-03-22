---
title: 홈
layout: default
permalink: /
---

<section class="hero">
  <div class="hero-avatar" aria-hidden="true">
    <img src="{{ '/image.png' | relative_url }}" alt="">
  </div>
  <h1 class="hero-name" lang="en">doogunwo</h1>
  <p class="hero-role" lang="en">system programmer</p>
</section>

<section class="feed">
  <div class="section-heading">
    <h2 lang="en">Latest</h2>
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
