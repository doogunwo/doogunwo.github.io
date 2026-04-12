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

리눅스는 기본적으로 인터럽트 중심으로 동작한다.
그런데 흥미롭게도 고성능 시스템 소프트웨어는 종종 인터럽트 대신 폴링이나 하이브리드 구조를 선택한다.
이유는 단순하다. 초고속 I/O 환경에서는 인터럽트 처리 자체의 오버헤드와 CPU를 반복적으로 깨우는 비용이 무시하기 어려워지기 때문이다.
대표적으로 DPDK, SPDK, 그리고 일부 io_uring 모드는 이러한 폴링 친화적 모델을 활용한다.

### 인터럽트

기본적으로 리눅스는 인터럽트(Interrupt)를 활용한다.

우선 인터럽트의 큰 분류는 다음과 같다.
- 하드웨어 인터럽트
- 예외(Exception)
- NMI(Non-Maskable Interrupt)

하드웨어 인터럽트는 디스크, NIC, 키보드, 타이머 같은 장치가 CPU에 보내는 신호이다. 
x86에서는 APIC 계열이 라우팅을 담당하고, Linux는 이를 generic IRQ 계층이 처리한다.

예외는 CPU가 명령을 실행하다가 직접 감지하는 사건이다. 
Intel SDM은 예외와 인터럽트를 같은 벡터 체계 안에서 다루지만, 발생 원인과 복귀 의미는 다르다.

NMI는 일반 인터럽트처럼 쉽게 마스킹되지 않는 특별한 경로이다. 

### 인터럽트 동작 순서

x86/Linux를 기준으로 매우 단순화한 인터럽트는 다음과 같이 동작한다.

1. 장치가 인터럽트를 발생시킴
2. 인터럽트 컨트롤러가 특정 CPU로 라우팅
3. CPU가 현재 문맥 일부를 저장하고 IDT를 통해 핸들러 진입
4. Linux의 low-level entry 코드가 공통 IRQ 진입 처리
5. generic IRQ layer가 해당 IRQ의 flow handler와 드라이버 ISR을 호출
6. 빠르게 끝날 일만 처리하고, 나머지는 thread/softirq/NAPI/workqueue 같은 지연 처리로 넘김
7. 인터럽트 종료(EOI 등) 후 원래 실행 흐름으로 복귀

### 인터럽트 구조

인터럽트는 두 가지 계층으로 구성된다. 
인터럽트가 들어오자마자 실행되는 계층은 상반부(top half, hardirq)에 해당된다.
여기서는 장치가 내 인터럽트인지 확인하고, 장치 상태 레지스터 확인한다.
다음 인터럽트 원인 ack/mask을 찾고 최소한의 completion/RX/TX bookkeeping을 수행한 뒤
나머지 일은 나중으로 미룬다.

이 경로는 매우 짧아야 하며 길어지면 지연이 발생하게 된다.

### Linux generic IRQ 계층

이 계층은 드라이버가 “이 장치가 어떤 물리적 인터럽트 컨트롤러에 연결됐는지”를 몰라도 되도록 추상화를 제공한다.
드라이버는 request/enable/disable/free 같은 공통 API를 사용한다.

또 Linux는 IRQ 특성에 따라 서로 다른 flow handler를 둔다.

- handle_level_irq()
- handle_edge_irq()
- handle_fasteoi_irq()

구분이 필요한 이유는 하드웨어의 인터럽트 선 성격이 다르기 때문이다.

edge-triggered냐, level-triggered냐에 따라 마스킹/EOI/재진입 처리 방식이 다르다.

- Edge-triggered
신호의 “변화 순간”을 이벤트로 본다. 

- Level-triggered
신호가 특정 레벨을 유지하는 동안 pending 상태를 유지한다.

### IRQ affinity가 성능에 미치는 영향

고성능 환경에서 인터럽트는 어느 CPU에 오느냐가 성능에 직결된다.
IRQ affinity를 잘못 잡으면 캐시 지역성이 깨지고, NUMA 비용 증가한다.

그래서 멀티큐 장치에서는 큐와 IRQ 벡터를 맞추고 해당 큐를 주로 처리하는 CPU에 핀, 스레드도 최대한 같은 NUMA/CPU 근처에 배치한다.

### 인터럽트가 성능을 저하시킬까?

이벤트가 아주 자주 올 때, 실제 일보다 인터럽트 처리 자체에 CPU를 더 많이 사용할 수 있기 때문에
문제라고 볼 수 있다.

또한 인터럽트율이 너무 높아지면 패킷을 실제로 처리하는 스레드가 일을 못 하고, 시스템이 인터럽트 처리만 하다가 backlog가 차서 패킷을 버리게 된다
처리마다 인터럽트를 깨우고 재우는 과정은 아주 비효율적이기 때문에 한 번 깨우고 배치 처리하는 방식의 시스템도 선호한다고 한다. 

### 기술사 기출 문제

이 주제는 실제로 "운영체제에서 I/O 디바이스를 위한 Polling 방식과 인터럽트 방식을 설명하고 장단점을 비교하시오"라는 문제로
기술사 기출 문제이다. 

즉 I/O 디바이스 관점에서 폴링과 인터럽트 비교는 아주 중요한 주제다.
다시 돌아와서 이번에는 폴링에 대해서 살펴본다.

### 폴링

폴링은 CPU가 장치의 상태 레지스터나 큐를 주기적으로 직접 확인한다. 
물론 이벤트가 없더라도 CPU가 반복적으로 확인하므로, 저부하 환경에서는 불필요한 CPU를 소모한다.
다만 여기서 궁금한 점이 인터럽트 비용이 어느정도 인지 의문이 생긴다.

ATC’19 AIOS 논문은 Optane급 초저지연 SSD에서 4KB read의 device time이 약 7.3 µs 라고 보고하고 있다.
lock layer만 약 15%, 즉 대략 1.1 µs 수준의 시간을 쓴다고 설명한다.
또 4KB random read/write에서는 커널 시간이 전체 I/O 지연의 최대 37.6%, 35.5% 까지 차지할 수 있다고 보고한다.

게다가 OSDI’21 Optimizing Storage Performance with Calibrated Interrupts 에서는 단일 코어 실험에서, 
배치 completion을 더 잘 다룬 방식이 평균 latency를 22 µs 수준으로 유지한 반면
adaptive delay가 들어간 방식은 29 µs 수준까지 증가한다고 한다. 
즉 인터럽트 설계 차이만으로도 대략 7 µs 내외의 지연 차이와 30%대 CPU 차이가 나올 수 있다는 의미이다.


### 실무적으로 많이 쓰는 해결책

- 가장 흔한 방법은 interrupt coalescing이다. NIC가 패킷이 올 때마다 바로 IRQ를 쏘지 않고, 일정 시간 동안 모아서
배치 처리를 수행한다. 저지연이면 coalescing을 줄이고, 처리량이면 coalescing을 키우는 식으로 설정한다.

- IRQ affinity를 통해 처리될 CPU와 실제 큐를 소비하는 CPU를 일치시시킨다. Linux는 /proc/irq/*/smp_affinity 와 default_smp_affinity 로 이를 조정할 수 있다.

- 스토리지 쪽은 Linux blk-mq가 이미 병렬 큐를 전제로 설계되었다. 단순히 폴링뿐만 아니라 소프트웨어 큐, 하드웨어 큐, CPU 코어를 병렬 구조로 맞춰야 한다.

### Polling 의 구현 방식

기본 개념 수준의 polling은 단순하다. 단순하게 while 문으로 무한루프를 돌아도 폴링이라고 할 수 있다.
Polling은 CPU가 장치 상태 레지스터나 큐를 주기적으로 확인하여 이벤트 발생 여부를 판단하는 방식으로, 
가장 기본적인 형태에서는 장치가 CPU를 깨우는 인터럽트 회로, 인터럽트 벡터, ISR, 우선순위 제어 없이도 동작할 수 있으므로 개념적으로는 구현이 단순하다.

다만 이는 전통적/기초적 polling 기준으로 고성능 폴링은 반드시 단순하다고 보기 어렵다.


### SPDK 리액터 폴링 구현 방식

SPDK는 DPDK를 스토리지에 적용한 것으로 
코어별 1개 이벤트 루프 + lockless event queue + thread poll를 가지고 있다.

event framework가 코어마다 1개 reactor thread 를 띄우고, reactor가 incoming event queue 와 poller 를 처리한다.

event는 cross-thread message passing 용도이며, 
poller는 등록된 thread에서 반복 실행되며, reactor가 이 둘을 섞어서 돌린다.

spdk/lib/event/reactor.c 를 살펴보면 #define SPDK_EVENT_BATCH_SIZE 라는 코드가 존재한다. 이를 통해
SPDK는 배치 기반 폴링을 수행한다고 볼 수 있다. 이 매크로 상수는 event_queue_run_batch라는 함수에서 사용된다.

해당 함수는 reactor의 event ring에서 이벤트를 최대 8개까지 한 번에 꺼내서 실행하고, 다 쓴 event 객체를 mempool에 반납하는 함수로서 
SPDK 리액터가 이벤트 큐를 배치 단위로 실행된다는 것을 보여준다.

### SPDK 쓰레드

SPDK 리액터는 구현을 최대한 단순하게 했다. 이벤트 루프를 단순하게 구현하였고, 나머지 필요한 동작은
SPDK 쓰레드에서 구현되었다. SPDK 쓰레드는 reactor 위에서 돌아가는 가벼운 논리 실행 단위를 의미한다.

SPDK thread는 poller, message, I/O channel 등이 귀속되는 논리 실행 컨텍스트다.
SPDK reactor의 메인 루프 자체는 비교적 단순하다. 대신 실제 복잡도는 spdk_thread, poller, scheduler, interrupt mode 전환 같은 주변 계층으로 분산되어 있다.
결론적으로 SPDK 쓰레드라는 건 말 그대로 쓰레드라기 보단 일종의 추상화에 가깝다.

### 폴링의 비효율성

폴링은 인터럽트 진입 비용을 줄이고 낮은 지연시간을 제공할 수 있지만, 이벤트 유무와 무관하게 CPU가 지속적으로 큐를 확인해야 한다는 구조적 한계를 가진다. SPDK 역시 reactor가 poll loop를 계속 돌며 이벤트와 completion을 확인하는 구조이므로, 특히 작은 I/O와 낮은 queue depth 환경에서는 CPU cycle 낭비가 커질 수 있다. 최근 SPDK+와 Aeolia 같은 연구는 바로 이 지점을 문제 삼으며, 무조건적인 polling보다 user interrupt나 동적 전환을 통해 성능과 자원 효율을 함께 확보하는 방향을 제시한다.


