---
title: "졸업작품 이야기1"
layout: post
categories:
  - writing
  - project
tags:
  - 졸업작품
thumbnail: https://velog.velcdn.com/images/doogunwo/post/d516e916-1555-45b5-a474-18de4a1edf14/image.gif
---
졸업을 앞두고 1학기 때 제출했던 캡스톤 디자인2 수업의 '얼굴 인식 시스템'을 기능과 UI 측면에서 보완해 다시 제출하고자 했다.

이 주제는 웹 앱과 머신 러닝을 사용해 클라이언트 카메라에 인식된 얼굴을 구분하고, 버스 요금 결제를 제공하는 시스템이었다.

하지만 주제의 규모가 크고 개발 인력이 한 명뿐이어서 얼굴 인식 시스템까지만 완성되었다.

![](https://velog.velcdn.com/images/doogunwo/post/d516e916-1555-45b5-a474-18de4a1edf14/image.gif)

Nodejs를 메인서버로 두고 노드를 통해서 머신러닝 제어용 flask와 mysql 제어 등등... 통제하고 

flask로 node와 통신을 통해 머신 러닝 서버를 따로 두도록 했다.

컴퓨터공학과 4학년 수준의 웹 개발 자체는 비교적 일반적이지만, 실제로 어려웠던 부분은 웹 앱 개발보다 머신러닝 모델 개발이었다. 

한 달간 연구를 진행했지만, 실제 서비스가 가능한 수준의 성능을 내기 어려웠다. 상당히 타협하더라도 ACC 0.6 이상을 확보하기 쉽지 않았다.

결국 haar-cascade를 통해 얼굴 구분만 가능하도록 구현했다.

Nodejs 
https://github.com/doogunwo/Tagober_server

Flask
https://github.com/doogunwo/TagoBer_Flask

Node로 로그인한 뒤 이미지 등록을 수행하고, 등록된 이미지 경로를 데이터베이스에 저장한 다음 이미지는 로컬에 보관했다. 이후 Flask에서 이미지 등록 요청마다 haar-cascade를 재학습해 클라이언트 카메라에서 얼굴 인식과 구분을 수행했다.

이 프로젝트를 통해 확인한 점은 프로그램 자체를 만드는 일보다 서비스 수준의 완성도를 맞추는 일이 훨씬 더 어렵다는 점이다.
