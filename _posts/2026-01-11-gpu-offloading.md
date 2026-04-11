---
title: "GPU 메모리 부족을 해결하는 오프로딩 기술의 진화"
layout: post
categories:
  - writing
  - llm
tags:
  - 논문리뷰
thumbnail: https://velog.velcdn.com/images/doogunwo/post/2bd304f3-4814-46f5-a893-4550e6c8610c/image.png
---
GPU 메모리(VRAM) 부족은 모든 AI 엔지니어의 영원한 숙제이다. 모델은 점점 커지고 있으며, 이로 인해 고비용의 인프라가 없다면 실습조차 어려운 환경이다.

이번 글에서는 속도와 메모리 사이의 trade-off를 다루는 논문들을 정리한다. 아래 논문들을 바탕으로 내용을 구성했다.

* ZeRO-Offload: Democratizing Billion-Scale Model Training
* FlexGen: High-Throughput Generative Inference of Large Language Models with a Single GPU
* PowerInfer: Fast Large Language Model Serving with a
Consumer-grade GPU

### 이기종(Heterogeneous) 학습 방식

우선, ZeRO-Offload는 데이터와 연산을 CPU로 오프로딩했다. 이를 통해 대규모 학습을 수행할 수 있으며, 단일 NVIDIA V100 GPU에서 100억(10B) 파라미터 모델에 대해 40 TFlops/GPU를 달성했다.

기존의 이기종(Heterogeneous) 학습 방식은 단순히 CPU를 저장소로만 썼던 것과 달리, ZeRO-Offload는 다음과 같은 새로운 접근을 시도했다.

이때 발생하는 지연 시간은 One-step delayed parameter update 기법으로 완화한다. CPU에서 옵티마이저가 도는 동안 GPU가 다음 스텝의 연산을 미리 수행하도록 하여 통신/연산 오버헤드를 숨긴다.
하지만 저자는 연산 집약적인 구성 요소를 CPU로 오프로딩하는 것을 반드시 피하도록 연구를 진행했다. 원칙은 딥러닝(DL) 학습의 반복(Iteration) 당 연산 복잡도는 일반적으로 O(MB)로 주어지는데, 여기서 M 은 모델 크기이고 B 는 유효 배치 크기(Effective batch size)이다.

CPU 연산이 성능 병목(Bottleneck)이 되는 것을 방지하기 위해, O(M B)보다 낮은 연산 복잡도를 가진 연산들만 CPU로 오프로딩하는 것을 원칙으로 수행했다.

O(M B)의 연산 복잡도를 가지는 순전파(Forward propagation)와 역전파(Backward propagation)는 반드시 GPU에서 수행되어야 하며, Norm 계산과 가중치 업데이트 같은 O(M)의 복잡도를 가지는 연산들은 CPU로 오프로딩하도록 했다.
CPU가 O(M)이라 가볍다고 해도, GPU보다는 느리지 않다. 따라서 ZeRO-Offload 팀은 PyTorch의 기본 Adam Optimizer를 쓰지 않고, 직접 튜닝한 고성능 CPU Adam을 구현했다. 또한 CPU의 성능을 극한으로 끌어올리기 위해 하드웨어 레벨의 최적화를 수행했다.

* SIMD: AVX512 같은 벡터 명령어를 사용하여 한 번의 클럭 사이클에 여러 데이터를 동시에 처리
* Loop Unrolling: 반복문의 제어 오버헤드를 줄이고, 명령어 수준 병렬성(ILP)을 높여 메모리 대역폭을 최대한 활용했다.
* MP Multithreading:OpenMP를 활용해 CPU의 모든 코어와 스레드가 놀지 않고 병렬로 연산하도록 만들었다.

![](https://velog.velcdn.com/images/doogunwo/post/2bd304f3-4814-46f5-a893-4550e6c8610c/image.png)

그림은 ZeRO-Offload 학습 과정의 워크플로우를 보여준다.
초기 N−1 단계까지는 학습 초기에 그라디언트가 급격하게 변하여 학습이 불안정해지는 것을 방지하기 위해 DPU 없이 학습을 진행한다.
N 단계부터는 GPU로부터 그라디언트(Gradients)를 가져오지만, CPU 옵티마이저 단계를 건너뛰며, GPU에 있는 FP16 파라미터 또한 업데이트하지 않는다.
N+1 부터는

* CPU: N 단계에서 얻은 그라디언트를 사용하여 파라미터 업데이트를 계산한다.
* GPU: 그동안 동시에(In parallel), N−1 단계에서 업데이트된 파라미터를 사용하여 순전파(Forward) 및 역전파(Backward) 패스를 계산한다.

이 단계 이후부터, (i+1)번째 단계의 모델은 i 번째 단계에서 업데이트된 파라미터 대신, (i−1)번째 단계의 그라디언트로 업데이트된 파라미터를 사용하여 학습하게 된다. 이를 통해 CPU 연산과 GPU 연산을 겹치게(Overlap) 만든다.
이를 통해 딥스피드팀은 딥러닝 학습 워크플로우에서 CPU와 최적화된 파이프라이닝으로 기존 문제인 GPU 메모리 부족 문제를 해결했다. 그러나 추론의 병목은 학습과 다르다. 추론(특히 LLM)은 생성 과정에서 기하급수적으로 늘어나는 KV-Cache(Key-Value Cache)가 메모리를 다 잡아먹는 것이 문제이다.

이제 호스트 DRAM을 활용해 KV Cache를 오프로딩하는 연구를 살펴본다. 먼저 LLM의 특성을 정리한다.

### LLM의 특성

LLM의 어텐션 레이어는 현재 토큰이 과거의 모든 토큰과 관계를 맺는다. 이러한 자기회귀(Autoregressive) 특성상, 토큰이 하나 생성될 때마다 과거 데이터(KV Cache)가 하나씩 늘어난다. 길이가 L 이면 메모리 사용량은 L 에 비례하여 선형적으로 계속 증가한다. 때문에 메모리를 얼마나 할당해야 할지 예측하기 어렵다. 또한 Q 벡터 하나를 처리하기 위해 거대한 K,V 행렬 전체를 GPU 메모리에서 읽어와야 한다. 연산량에 비해 메모리 이동량이 너무 많아 메모리 대역폭까지 병목이 되는 문제가 있다.

그렇다면 당연히, 모든 KV-Cache는 필연적으로 GPU 메모리에 위치하는 것이 가장 효과적이다. 하지만 GPU 메모리는 가장 비싼 자원 중 하나로, 모든 KV-Cache의 키-값을 GPU 메모리에 배치할 수 없는 한계가 있다.
FlexGen이라는 연구는 호스트 DRAM에 더해 NVMe까지 활용한다. 이 연구에서는 제한된 GPU 메모리 환경에서 LLM을 구동할 수 있는 고성능 생성 엔진인 FlexGen을 제안한다. GPU, CPU, 디스크(Disk)의 메모리와 연산 자원을 모두 통합(Aggregation)하는 구조를 띠고 있으며, FlexGen은 가중치(Weights)와 어텐션 캐시(Attention Cache)를 4비트로 압축하면서도 정확도 손실을 무시할 수 있는 수준으로 유지했다.

![](https://velog.velcdn.com/images/doogunwo/post/a702527c-a2fc-4fa2-846c-25d9aecd4483/image.png)

위 그림은 FlexGen에서 제시하는 Zig-zag 블록 스케줄 기법이다. Zig-Zag 스케줄링 기법은 가중치 로딩 오버헤드가 큰 'Row-wise' 방식과 KV Cache 누적으로 메모리가 초과되는 'Column-wise' 방식 사이의 절충안으로, 배치를 적절한 블록(Block) 단위로 묶어 순회하며 가중치 재사용을 극대화하면서도 메모리 오버플로우를 방지하는 전략이다. 또한 연산 위임(Computation Delegation)은 데이터 전송(I/O) 비용이 연산 비용을 압도하는 상황을 해결하기 위한 기법으로, 시퀀스 길이가 길어 호스트 DRAM에 저장된 거대한 KV 캐시를 GPU로 옮기는(PCIe 병목) 대신 크기가 작은 쿼리(Query) 벡터만 CPU로 보내 현지에서 연산(Compute-on-data)하게 함으로써 전체 시스템의 처리량을 높이는 데이터 지역성(Data Locality) 기반의 최적화다.

NVMe는 호스트 RAM이 부족할 때 활용한다. OPT-175B 모델의 가중치는 약 325GB이다. CPU DRAM이 256GB라면 나머지 70GB를 NVMe SSD에 저장하고, 추론이 진행되면서 해당 레이어가 필요할 때 SSD → CPU DRAM → GPU VRAM 순서로 로딩한다.

SSD 읽기 속도는 느리므로(수 GB/s), GPU가 연산하는 동안 백그라운드 스레드가 미리 다음 레이어를 SSD에서 DRAM으로 퍼올려 해결한다. 그리고 KV Cache가 폭발할 때, 현재 GPU가 연산하지 않는(Idle) 배치의 KV Cache를 전부 NVMe SSD로 Swap-out한다. 또한 단순히 SSD를 쓰면 시스템이 멈추기 때문에, 이를 숨기기 위해 3단계 파이프라인을 돌린다.

1. [GPU] 현재 레이어/배치 연산 중
2. [PCIe] CPU ↔ GPU 데이터 전송 중
3. [Disk I/O] SSD ↔ CPU 데이터 전송 중

이를 통해 FlexGen은 제한된 환경에서 LLM 추론을 수행할 수 있도록 했으나, 대신 실시간성을 포기했다.

### 실시간성까지 보장할 수 없을까?

이러한 오프로딩 연구의 흐름 속에서, 마지막으로 소개할 PowerInfer는 호스트 메모리를 사용하면서도 실시간성을 확보할 수 있는지에 대한 해답을 제시한다.

PowerInfer 설계의 핵심 원리는 LLM 추론 과정에 내재된 높은 지역성(High Locality)과 멱법칙(Power-law) 분포이다. 이는 "모든 뉴런이 매번 필요한 것은 아니며, 소수의 'Hot 뉴런'이 전체 연산의 대부분을 차지한다"는 발견에 기초한다.

이를 응용하여, Hot 뉴런은 빠른 접근을 위해 GPU에 미리 로딩(Preloaded)하고 Cold 뉴런은 CPU에서 연산함으로써 GPU 메모리 요구량과 CPU-GPU 간 데이터 전송을 줄인다.

여기서 확인할 수 있는 점은 호스트 디램을 활용한다고 해서 디램에 적재된 데이터를 GPU 메모리로 옮기는 동작을 유발하지 않는다는 점이다.
대부분의 연구는 호스트 DRAM에서 GPU 메모리로 데이터를 무작정 이동시키지 않는 방식으로 수렴한다.

### 결론

LLM 추론에서 호스트 디램을 활용하는 연구는 일종의 Near-Data Processing이다. 결국 PowerInfer의 사례와 앞서 살펴본 연구들은 데이터를 무작정 GPU로 가져오는 것이 아니라, 데이터가 있는 곳에서 연산을 수행하는 'Near-Data Processing(NDP)' 철학이 거대 모델 추론의 핵심 열쇠가 되고 있음을 보여준다.
