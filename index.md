---
title: 홈
layout: default
permalink: /
---

<section class="feed">
  <div class="section-heading">
    <h2>최신 글</h2>
  </div>

  {% for post in site.posts %}
    <article class="post-card" data-tags="{% for tag in post.tags %}{{ tag | slugify }}{% unless forloop.last %},{% endunless %}{% endfor %}">
      <h3><a href="{{ post.url | relative_url }}">{{ post.title }}</a></h3>
      <div class="post-card__meta">
        <time datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date: "%Y.%m.%d" }}</time>
        {% if post.tags and post.tags.size > 0 %}
          <span class="post-card__tags">
            {% for tag in post.tags %}
              <a class="tag-pill" href="{{ '/' | relative_url }}?tag={{ tag | slugify }}">{{ tag }}</a>{% unless forloop.last %} {% endunless %}
            {% endfor %}
          </span>
        {% endif %}
      </div>
    </article>
  {% endfor %}
</section>
