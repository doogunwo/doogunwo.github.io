---
layout: default
title: Archive
permalink: /archive/
---

<section class="page-header">
  <p class="eyebrow">Hierarchy</p>
  <h1>Archive</h1>
  <p>연도별로 쌓인 글을 따라가며 흐름을 볼 수 있는 구조입니다.</p>
</section>

<section class="archive-listing">
  {% assign top_groups = site.posts | group_by_exp: "post", "post.categories[0] | default: 'writing'" %}
  {% for group in top_groups %}
    <article class="archive-group" id="{{ group.name | slugify }}">
      <h2>{{ group.name | capitalize }}</h2>

      {% assign child_groups = group.items | group_by_exp: "post", "post.categories[1] | default: 'general'" %}
      {% for child in child_groups %}
        <div class="archive-subgroup" id="{{ child.name | slugify }}">
          <h3>{{ child.name | capitalize }}</h3>
          <ul class="archive-list">
            {% for post in child.items %}
              <li>
                <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
                <span>{{ post.date | date: "%m.%d" }}</span>
              </li>
            {% endfor %}
          </ul>
        </div>
      {% endfor %}
    </article>
  {% endfor %}
</section>
