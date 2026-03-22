---
title: "Jekyll 로컬 세팅 메모"
layout: post
categories:
  - notes
  - setup
tags:
  - jekyll
  - bundle
  - local
---

GitHub Pages만 생각하고 시작하면 로컬 실행이 늦어진다. 그래서 가장 먼저 `Gemfile`부터 두는 편이 좋다.

<!--more-->

이 저장소처럼 `jekyll`과 `webrick`만 잡아두면 로컬에서 확인하는 흐름이 단순해진다. 이후에 페이지 구조나 CSS를 바꿔도, 먼저 `bundle exec jekyll serve`로 화면을 확인하는 습관을 유지할 수 있다.

## 체크리스트

- `Gemfile` 추가
- `bundle install`
- `bundle exec jekyll serve`

작은 블로그일수록 이 루틴이 중요하다. 배포 환경과 로컬 환경의 차이를 줄이는 게 유지보수의 시작이다.
