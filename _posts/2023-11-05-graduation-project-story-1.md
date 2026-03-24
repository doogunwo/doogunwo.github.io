---
title: "졸업작품 이야기1"
layout: post
categories:
  - writing
  - project
tags:
  - 졸업작품
---
이제 졸업을 앞두고 1학기 때 제출했던 캡스톤 디자인2 수업의 '얼굴 인식 시스템'을 기능, UI를 좀더 보완하여 제출하고자 했다.

본 주제는 '얼굴 인식 시스템'을 위해 '웹 앱'과 '머신 러닝'을 사용하여 클라이언트 카메라에 인식된 얼굴을 구분하여 버스 요금 결제를 제공하는 시스템이였다.

하지만 주제의 규모가 너무 방대하고 개발 가능한 인원이 나 혼자라 '얼굴 인식 시스템'까지만 완성되었다.

![](https://velog.velcdn.com/images/doogunwo/post/d516e916-1555-45b5-a474-18de4a1edf14/image.gif)

Nodejs를 메인서버로 두고 노드를 통해서 머신러닝 제어용 flask와 mysql 제어 등등... 통제하고 

flask로 node와 통신을 통해 머신 러닝 서버를 따로 두도록 했다.

사실 컴퓨터공학과 4학년이라면 이정도 웹 개발은 누구나 할 수 있다고 생각된다. 하지만 정말 어려웠던 것은 웹 앱 개발보다 머신러닝 모델 개발이였다. 

1달간 연구를 거쳐도 실제 서비스가 제공가능할 정도로 혹은 진짜 많이 타협해서 acc가 0.6이상정도가 나오는 성능은 제공할 수 없었다.

그래서 그냥 haar-cascade를 통해 "얼굴 구분"만이라도 되도록 구현했다.

Nodejs 
https://github.com/doogunwo/Tagober_server

Flask
https://github.com/doogunwo/TagoBer_Flask

![](https://velog.velcdn.com/images/doogunwo/post/97b9718e-a531-4115-9e2c-f77d7275d337/image.gif)

node로 로그인 후 -> 이미지 등록을 거치고 등록된 이미지의 path는 데이터베이스에 넣고 이미지는 로컬에 저장한 다음 플라스크에서 이미지 등록 요청마다 haar-cascade 재학습을 통해서 클라이언트 카메라에서 다음과 같이 얼굴은 인식 + 구분을 하긴했다!

졸업 작품을 하면서 느낀 것은 프로그램을 만드는 것은 어렵지 않다. 
하지만 서비스 수준의 완성도는 정말 어려운 것 같다.
