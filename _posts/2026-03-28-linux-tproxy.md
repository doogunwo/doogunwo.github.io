---
title: "Linux TPROXY "
layout: post
categories:
  - writing
  - Network
tags:
  - 운영체제
thumbnail: /assets/images/tp.png
---
TPROXY(Transparent Proxy)는 리눅스 커널에서 제공하는 투명 프록시 기술이다.
이런 TP(TPROXY)가 등장한 이유는 기존의 기존 NAT/REDIRECT 방식으로는 투명 프록시를 구현하기 어려웠기 때문이다.

### 투명 프록시(Transparent Proxy)가 왜 필요할까?
먼저 투명 프록시는 네트워크 중간 장비가 트래픽을 가로채 대신 처리한다. 
사용자는 그냥 원래 서버에 접속한다고 생각하지만, 
실제로는 중간의 프록시가 그 연결을 먼저 받아서 검사, 제어, 전달, 최적화를 수행한다.

### 그러면 일반적인 프록시가 존재하는지?
당연히 투명 프록시와 다르게 일반 프록시도 존재한다. 
간단한 차이는 일반 프록시는 목적지 IP를 프록시 서버의 IP로 변환하지만
TProxy는 패킷의 IP 헤더(Source/Destination IP)를 전혀 수정하지 않는다.

일반 프록시는 DNAT (REDIRECT) 기반으로 만들어진다.
DNAT 기반은 TP와 비교하면 네트워크 스택에서 차이가 존재한다.

![](https://img1.daumcdn.net/thumb/R1280x0/?scode=mtistory2&fname=https%3A%2F%2Fblog.kakaocdn.net%2Fdna%2FrakN7%2FbtsCpNWoRJJ%2FAAAAAAAAAAAAAAAAAAAAAMXa8OZrQGL3Xs9ZzkllGsI7FlOrBCb2YVj7AMoGyiMW%2Fimg.png%3Fcredential%3DyqXZFxpELC7KVnFOS48ylbz2pIh7yKj8%26expires%3D1774969199%26allow_ip%3D%26allow_referer%3D%26signature%3DSJgo%252FJgHTodyHM181ItFCqWd7ew%253D)
*그림1. NAT가 패킷의 IP 주소를 바꾸는 단계*

이 그림은 NAT(Network Address Translation)가 패킷의 IP 주소를 어떻게 바꾸는지를 단계별로 보여주는 구조이다. 
이 과정에서 두 가지 유형이 있다. 

- 패킷의 출발지 주소를 변경하는 NAT(SNAT)
- 패킷의 목적지 주소를 변경하는 NAT(DNAT)

NAT 장비가 패킷 헤더를 양방향으로 계속 수정하고 있는 모습을 확인할 수 있다. 이런 구조에서는 
서버가 실제 클라이언트를 모른다. 고로 NAT 장비가 어떤 요청이 누구의 것이였는지 매핑 테이블로 관리해야 한다.

그럼 NAT기반 투명 프록시에는 병목이 존재할지 의문이 존재한다.
어떤 이유로 TPROXY를 개발하게 되었을까?

가장 먼저 [리눅스 커널 문서](https://docs.kernel.org/networking/tproxy.html)에서는
iptables의 REDIRECT 타겟을 활용한 방법에서 심각한 한계가 있다고 언급한다.

가장 큰 문제점 중 하나는 패킷의 목적지 주소를 변경하는 방식으로 패킷을 수정한다는 점이다.
결국 프록시가 원래 목적지(original destination)를 나중에 따로 조회해야 하는데, 그 조회 방식이 타이밍에 민감해서 안전하게 믿기 어렵다.

- 1.클라이언트가 원래 서버 A:80으로 접속
- 2. iptables REDIRECT가 목적지를 프록시 127.0.0.1:8080 같은 데로 바꿈
- 3. 프록시는 연결을 받음
- 4. 프록시는 “이 연결 원래 어디 가던 거였지?”를 커널 상태에서 다시 찾음

3번과 4번 사이에서 커널과 연결 상태가 기대한 그대로 항상 남아있다고 보기 어렵다.


![그림2. 병목 지점](/assets/images/보틀넥.jpeg)
*그림2. 병목 지점*

위 이미지는 NAT 기반 프록시의 병목을 보여준다. 우선 패킷 경로 자체가 길다.
패킷이 NIC에서 들어와 netfilter를 지나고, conntrack/NAT 상태를 확인한 뒤, 로컬 프록시 소켓으로 전달되고, 유저스페이스 프록시가 다시 업스트림 연결을 만들어 내보낸다.

즉 한 번의 통과 패킷 처리가 아니라 커널 상태 처리 + 프록시 처리가 붙는다.
하지만 곰곰히 생각해보면 TPROXY도 결국 프록시로 구현될 경우, 
커널 → 소켓 → 유저스페이스 프록시 → 업스트림 소켓 경로를 거친다. 

프록시라는 본질적인 비용은 동일하다. 하지만 NAT는 주소 변경과 NAT 상태 관리라는 과정이 추가된다.
NAT/REDIRECT 계층의 문제를 줄이는 것이 핵심이라고 할 수 있다.

### NAT/REDIRECT 계층의 문제?
낮은 확장성과 새로운 연결 세션 관리의 복잡성이 가장 큰 요인이다.

먼저 예시를 들면 패킷이 올때마다 기존 연결을 찾거나 새롭게 만든다. 이후 그 상태를 계속 참조한다.
flow 수가 많거나 새 연결 생성률이 높으면 flow 유지에 대해서 비용이 발생하게 된다.

다음은 flow에 대한 새로운 목적지 주소를 변경해해주는 작업이다. 고성능 프록시를 목표로 하는
환경에서 매 패킷마다 작업을 1가지 더 한다는 것은 전체적인 처리량을 저하시킨다.

이 부분이 REDIRECT의 근본 한계에 해당하며 동시에 기존 목적지를 어디로 가고 있던 패킷인지
다시 확인해야 하는 구조적 복잡성까지 포함된다.

최종적으로 멀티코어 확장 비용이다. NAT/transparent proxy는 보통 코어별 완전 독립 처리가 어렵다.
flow state, NAT mapping, 또는 후속 패킷 전달이 다른 코어와 얽히면 
inter-core queue, synchronization, cacheline bouncing 같은 비용이 생긴다.

NFOS 논문은 NAT의 확장성 병목을 구체적으로 코어 간 패킷 전달 큐 contention으로 지적한다.

