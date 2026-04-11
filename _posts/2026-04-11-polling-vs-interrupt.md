---
title: "인터럽트 vs 폴링"
layout: post
categories:
  - writing
  - study
tags:
  - 운영체제
thumbnail: /assets/thumbnail/vs.png
---

리눅스의  고성능 시스템 소프트웨어는 왜 폴링을 사용할까?

폴링을 사용하는 고성능 시스템 소프트웨어는 대표적으로 DPDK, DPDK를 기반으로 한 SPDK 그리고 io-uring이 있다. 

기본적으로 리눅스는 인터럽트(Interrupt)를 활용한다.

