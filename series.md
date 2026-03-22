---
layout: default
title: Series
permalink: /series/
---

<section class="page-header page-header--compact">
  <p class="eyebrow" lang="en">Series</p>
  <h1 lang="en">Read in order</h1>
  <p>단일 글을 넘어, 같은 주제의 흐름을 따라 읽을 수 있도록 묶은 페이지입니다.</p>
</section>

{% assign writing_posts = site.posts | where_exp: "post", "post.categories[0] == 'writing'" | sort: "date" %}
{% assign notes_posts = site.posts | where_exp: "post", "post.categories[0] == 'notes'" | sort: "date" %}

<section class="series-grid">
  {% if writing_posts.size > 0 %}
    <article class="series-card">
      <div class="series-card__header">
        <p class="eyebrow" lang="en">Writing path</p>
        <h2>블로그 구조와 글쓰기 시스템</h2>
      </div>
      <p>설계, 읽기 흐름, 폰트와 레이아웃 같은 블로그의 기본 결정을 순서대로 볼 수 있습니다.</p>
      <ol class="series-list">
        {% for post in writing_posts %}
          <li>
            <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
            <span>{{ post.date | date: "%Y.%m.%d" }}</span>
          </li>
        {% endfor %}
      </ol>
    </article>
  {% endif %}

  {% if notes_posts.size > 0 %}
    <article class="series-card">
      <div class="series-card__header">
        <p class="eyebrow" lang="en">Notes path</p>
        <h2>세팅과 실험 기록</h2>
      </div>
      <p>로컬 환경, 템플릿, 작은 실험을 모아서 블로그를 빠르게 확장할 수 있게 둡니다.</p>
      <ol class="series-list">
        {% for post in notes_posts %}
          <li>
            <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
            <span>{{ post.date | date: "%Y.%m.%d" }}</span>
          </li>
        {% endfor %}
      </ol>
    </article>
  {% endif %}
</section>
