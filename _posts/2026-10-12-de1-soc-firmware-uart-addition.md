---
title: "De1-Soc 기반 펌웨어 실습 UART로 숫자 두 개를 보내고 더하기"
layout: post
categories:
  - writing
  - study
tags:
  - 펌웨어
  - ARM
  - 임베디드
description: "펌웨어가 무엇인지부터 쉽게 알아보고, DE1-SoC 보드에 C 프로그램을 올려 PC에서 보낸 숫자 두 개를 더하고 결과를 받는 과정."
thumbnail: /assets/images/2026-10-12/de1-soc/firmware-upload-success.png
toc_depth: 2
---

PC에서 숫자 두 개를 보내면, 작은 보드 안의 프로그램이 두 숫자를 더하고 답을 돌려준다. 이번에 해본 실습이다.

예를 들어 PC에서 `4`와 `3`을 보내면 보드가 `7`을 보낸다. 계산 자체는 간단하다. 이번에 배우고 싶었던 것은 **내가 작성한 C 코드가 보드 안에서 실행되고, PC와 데이터를 주고받는 과정**이었다.

[지난 실습]({% post_url 2026-10-11-de1-soc-firmware-practice %})에서는 보드에 부트로더를 올리고 `Bootloader ready`라는 문장을 받았다. 이번에는 별도의 펌웨어를 만들어 실행하고, 문자 두 개를 받아 더하는 데까지 진행했다.

펌웨어라는 말을 처음 듣는 사람도 이해할 수 있도록, 프로그램이 어디서 실행되는지부터 설명해보려고 한다.

<!--more-->

**펌웨어를 올리고 답을 받은 화면**

먼저 실제로 동작한 화면이다. 펌웨어를 보드에 올려 실행한 뒤, PC에서 숫자를 보내고 `7`을 받았다.

![펌웨어 업로드와 실행 후 UART로 보낸 두 숫자의 합 7을 받은 실제 터미널 화면]({{ '/assets/images/2026-10-12/de1-soc/firmware-upload-success.png' | relative_url }})

왼쪽 위는 보드가 보낸 문자를 보는 화면이다. `Hello Cortex-A9!`는 펌웨어의 시작 문장이고, 그 아래 `7`은 보드가 계산해서 보낸 답이다. 오른쪽 아래는 PC에서 숫자를 전송한 화면이다. 빨간 표시가 입력과 결과를 연결해준다.

오른쪽 위에는 실행을 확인하던 중의 오류 로그도 남아 있다. 이 사진에서 확인한 성공 결과는 **펌웨어가 시작 문장을 출력하고, 숫자 요청에 답을 돌려줬다는 것**이다.

## 펌웨어와 보드

### 펌웨어는 장치 안에서 실행되는 프로그램이다

PC에서는 프로그램을 실행해 계산하거나 파일을 연다. 다른 장치에도 프로그램이 들어 있다. 키보드는 눌린 키를 알아내서 PC에 알려주고, 세탁기는 버튼 입력에 따라 모터를 움직인다.

이렇게 **장치의 동작을 맡는 프로그램**을 펌웨어라고 부른다.

이번에 만든 펌웨어가 하는 일은 세 가지다.

1. PC가 보낸 숫자 두 개를 받는다.
2. 두 숫자를 더한다.
3. 계산한 답을 PC로 보낸다.

펌웨어라고 해서 반드시 복잡한 일을 해야 하는 것은 아니다. 처음에는 이 정도만 해도 프로그램 실행, 데이터 받기, 계산, 데이터 보내기를 모두 경험할 수 있다.

### PC와 보드의 역할

이번 실습에 사용하는 DE1-SoC는 프로그램을 올려 여러 동작을 시험해볼 수 있는 개발 보드다. 보드의 칩에는 ARM CPU와 FPGA가 함께 들어 있다. CPU는 프로그램의 명령을 실행하고, FPGA는 사용자가 원하는 디지털 회로를 구성할 수 있는 부분이다.

나는 ARM CPU가 들어 있는 **HPS** 부분을 사용했다. 이번 덧셈 프로그램에서는 FPGA 회로를 만들지 않았다.

아래는 이번 실습에 사용한 실제 보드 사진이다.

![USB 케이블을 연결하고 전원을 켠 실습용 Terasic DE1-SoC 보드]({{ '/assets/images/2026-10-12/de1-soc/de1-soc-board.png' | relative_url }})

보드에는 여러 단자와 버튼이 있지만, 이번에는 프로그램을 올리는 연결과 문자를 주고받는 연결부터 사용했다. 불이 켜진 사진만으로 펌웨어가 정상 동작한다고 판단하지는 않았다. 앞의 터미널에서 답을 받은 것으로 동작을 확인했다.

PC와 보드의 역할은 다음과 같다.

| 어디에서 | 하는 일 |
| --- | --- |
| 우분투 PC | C 코드를 작성하고, 보드에서 실행할 파일을 만들고, 숫자를 보낸다. |
| DE1-SoC 보드 | 받은 프로그램을 ARM CPU에서 실행하고, 숫자를 더해서 답을 보낸다. |

우분투는 PC에서 실행된다. 보드에서는 리눅스 같은 운영체제 없이 내가 만든 코드를 실행한다. 이런 방식을 **베어메탈**이라고 부른다. 여기서는 “운영체제의 도움 없이 내 코드가 보드의 장치를 직접 다룬다” 정도로 이해하면 된다.

프로그램은 보드 안의 RAM에 올렸다. RAM은 실행 중인 코드와 값을 두는 메모리다. 전원을 끄면 내용이 사라지므로, 이번 방식에서는 전원을 다시 켠 뒤 프로그램도 다시 올려야 한다.

![PC가 4와 3을 보내면 DE1-SoC의 펌웨어가 계산해서 7을 돌려주는 흐름]({{ '/assets/images/2026-10-12/de1-soc/uart-addition-flow.svg' | relative_url }})

### 부트로더와 펌웨어의 역할

지난번에 만든 부트로더와 이번에 만든 펌웨어는 역할을 나누었다.

**부트로더는 통신할 준비를 한다.** 보드의 통신 장치를 사용할 수 있게 만들고, 통신 속도를 맞춘 뒤 `Bootloader ready`를 출력한다.

**이번 펌웨어는 이미 준비된 통신 장치를 사용한다.** `Hello Cortex-A9!`를 출력한 뒤 숫자를 기다리고, 두 숫자를 받으면 더한 값을 보낸다.

실행 순서는 다음과 같다.

```text
부트로더를 보드에 올린다.
    ↓
부트로더를 실행해서 통신 장치를 준비한다.
    ↓
펌웨어를 보드에 올리고 실행한다.
    ↓
PC에서 숫자를 보낸다.
    ↓
펌웨어가 계산해서 답을 보낸다.
```

현재는 **PC의 도구가 부트로더와 펌웨어를 각각 올리고 실행한다.** 부트로더가 펌웨어 파일을 받아서 실행하는 기능은 아직 만들지 않았다. 따라서 부트로더가 준비됐다는 문장만 보고 펌웨어까지 자동으로 실행됐다고 생각하면 안 된다.

또한 이번 펌웨어에는 통신 장치를 처음부터 준비하는 코드가 없다. 부트로더를 먼저 실행한 상태에서 펌웨어를 실행해야 한다.

### JTAG와 UART의 역할

보드에는 USB 케이블 두 개를 연결했다. 각각 쓰는 목적이 다르다.

| 연결 | 이번 실습에서 하는 일 |
| --- | --- |
| USB-Blaster II를 통한 JTAG | 프로그램을 보드 메모리에 올리고, CPU를 멈추거나 다시 실행한다. |
| USB-to-UART | 실행된 프로그램과 PC가 문자나 숫자를 주고받는다. |

JTAG는 칩을 검사하거나 프로그램의 실행을 살펴볼 때 사용하는 연결이다. 이번에는 프로그램을 올리는 데 사용했다.

UART는 데이터를 순서대로 주고받는 통신 장치다. 보드의 USB-to-UART 연결 덕분에 PC에서는 USB 케이블을 사용하지만, 보드의 C 코드에서는 UART를 다룬다.

내 우분투 PC에서는 UART 연결이 `/dev/ttyUSB0`라는 이름으로 나타났다. 아래 명령에서 이 이름이 나오면 **보드와 문자를 주고받는 통로**라고 생각하면 된다. 다른 PC에서는 번호가 달라질 수 있다.

즉, 이번 실습에서 프로그램 파일은 JTAG로 보냈고, `4`, `3`, `7` 같은 데이터는 UART로 보냈다.

## 프로젝트 구조

부트로더와 펌웨어는 별도 폴더에 두었다. 아래는 이번 실습과 관련된 파일들이다. `.elf`와 `.bin`은 코드를 작성하는 파일이 아니라 빌드해서 생기는 결과 파일이다.

```text
project/
├── bootloader/
│   ├── main.c              # 보드 준비 후 UART 시작 문장 출력
│   ├── board.c             # UART를 사용할 수 있도록 하드웨어 준비
│   ├── uart_iocsr.h        # 보드의 핀 설정에 필요한 값
│   ├── startup.S           # 부트로더의 C 코드 실행 전 준비
│   ├── linker.ld.S         # 부트로더 메모리 배치의 원본
│   ├── linker.ld           # 원본에서 생성한 메모리 배치 파일
│   ├── jtag.cfg            # OpenOCD가 보드에 연결할 때 쓰는 설정
│   ├── execute.sh          # 부트로더 빌드, JTAG 연결, UART 출력 보기
│   └── bootloader.elf      # 빌드한 부트로더
├── firmware/
│   ├── main.c              # 숫자 두 개를 받고 더해서 보내기
│   ├── startup.S           # 펌웨어의 C 코드 실행 전 준비
│   ├── linker.ld           # 펌웨어 메모리 배치
│   ├── firmware.elf        # 빌드한 펌웨어
│   └── firmware.bin        # ELF에서 뽑은 바이너리 파일
└── docs/
    └── Cyclone_V_HPS_Technical_Reference_Manual.pdf
```

`bootloader`는 통신을 시작할 준비를 맡고, `firmware`는 받은 요청을 처리한다. `docs`에는 주소와 설정 값을 확인할 때 읽은 하드웨어 설명서를 넣었다.

펌웨어에서 직접 준비한 파일은 세 개다.

| 파일 | 쉽게 설명한 역할 |
| --- | --- |
| `firmware/main.c` | 숫자를 받고 더해서 보내는 C 코드 |
| `firmware/startup.S` | C 코드가 실행되기 전에 필요한 준비 |
| `firmware/linker.ld` | 프로그램과 데이터를 메모리 어디에 둘지 정하는 파일 |

현재 `bootloader/execute.sh`는 부트로더를 빌드한다. 펌웨어는 뒤에 나오는 별도 명령으로 빌드했다. 따라서 부트로더 스크립트를 실행했다고 수정한 펌웨어도 다시 만들어지는 것은 아니다.

### 펌웨어를 놓을 위치 정하기

`startup.S`와 `linker.ld`는 부트로더에서 사용하던 파일을 복사해서 시작했다. 다만 펌웨어가 들어갈 시작 주소는 바꾸었다.

부트로더 코드는 `0xFFFF0000`부터, 펌웨어 코드는 `0xFFFF8000`부터 두었다. 이 숫자는 **메모리 안의 위치를 나타내는 주소**다. 두 프로그램을 같은 위치에 올리면 먼저 올린 프로그램이 덮어써질 수 있다.

펌웨어의 `linker.ld`에서 다음 부분을 설정했다.

```ld
ENTRY(_start)

MEMORY
{
    OCRAM (rwx) : ORIGIN = 0xFFFF8000, LENGTH = 28K
}

__stack_bottom = ORIGIN(OCRAM) + LENGTH(OCRAM);
__stack_top = 0xFFFFFFF8;
```

`ORIGIN`은 시작 주소이고, `LENGTH`는 사용할 수 있는 크기다. `OCRAM`은 이 보드의 칩 안에 있는 RAM이다. 이 설정 뒤에는 코드와 데이터를 배치하는 `SECTIONS` 부분도 필요하다. 전체 파일은 글 아래의 소스 묶음에 넣었다. 이 문법은 [GNU 링커 문서](https://sourceware.org/binutils/docs/ld/MEMORY.html)에서 확인할 수 있다.

여기서 정한 28 KB는 펌웨어를 배치할 범위다. 기존 부트로더 링커의 범위까지 자동으로 줄어드는 것은 아니므로, 나중에 부트로더 코드가 커지면 실제로 차지하는 영역이 펌웨어와 겹치지 않는지도 확인해야 한다.

`startup.S`는 다음 순서로 준비한 뒤 `main()`을 호출한다.

```text
함수 실행에 사용할 임시 저장 공간인 스택을 준비한다.
    ↓
초기값이 없는 전역변수를 0으로 채운다.
    ↓
main()을 실행한다.
```

이 준비를 거치도록 프로그램 시작 위치는 `main()`이 아니라 **`_start`**로 잡았다. 부트로더와 펌웨어는 차례로 실행하면서 같은 스택 공간을 사용한다. 두 프로그램을 동시에 실행하는 구조는 아니다.

## ELF와 BIN 만들기

### ELF 파일 빌드하기

CPU는 C 파일을 그대로 읽어서 실행하지 않는다. 사람이 작성한 C 코드를 CPU가 실행할 수 있는 명령으로 바꾸어야 한다. 이 과정을 **빌드**라고 한다.

입력 파일과 결과 파일을 나란히 보면 다음과 같다.

```text
main.c + startup.S + linker.ld
             ↓ 빌드
        firmware.elf
```

우분투 터미널에서 다음 명령을 실행했다. 첫 줄로 `firmware` 폴더에 들어가므로, 뒤의 파일 이름에는 다시 `firmware/`를 붙이지 않는다.

```bash
cd /home/doogunwo/project/firmware

arm-none-eabi-gcc -mcpu=cortex-a9 -marm -O0 -g \
  -ffreestanding -nostdlib -Wall -Wextra -Werror \
  -fno-unwind-tables -fno-asynchronous-unwind-tables \
  -T linker.ld startup.S main.c -o firmware.elf
```

`arm-none-eabi-gcc`는 ARM CPU에서 실행할 프로그램을 만드는 도구다. PC의 일반 프로그램을 만드는 `gcc`와 실행 대상이 다르다.

처음에는 명령 전체를 외우기보다 다음 부분부터 이해했다.

| 명령의 부분 | 의미 |
| --- | --- |
| `-mcpu=cortex-a9 -marm` | 이번 보드의 CPU에 맞는 ARM 명령을 만든다. |
| `-O0 -g` | 실행 과정을 살펴보기 쉽게 만들고, 소스 코드 위치 정보도 넣는다. |
| `-nostdlib` | 일반 프로그램에 자동으로 붙는 시작 코드와 표준 라이브러리를 사용하지 않는다. |
| `-T linker.ld` | 내가 작성한 메모리 배치 파일을 사용한다. |
| `-o firmware.elf` | 결과를 이 이름의 파일로 만든다. |

결과로 생긴 `firmware.elf`에는 실행할 코드뿐 아니라 코드의 위치와 함수 이름 같은 정보도 들어 있다. 그래서 실행 도구가 어느 주소에 올릴지 알 수 있고, 문제가 생겼을 때 C 코드의 어느 줄인지 확인하기도 좋다.

빌드 명령이 오류 없이 끝나면 파일이 생겼는지 확인한다.

```bash
ls -lh firmware.elf
arm-none-eabi-readelf -h firmware.elf
```

두 번째 명령은 ELF의 기본 정보를 보여준다. 이번 파일에서는 다음 시작 주소를 확인한다.

```text
Entry point address: 0xffff8000
```

C 코드를 수정한 뒤에는 이 빌드부터 다시 해야 한다. 소스만 고치고 기존 ELF를 올리면 보드에서는 이전 프로그램이 실행된다.

### BIN 바이너리 파일 만들기

ELF를 만든 다음 `firmware.bin`으로 변환했다. 이때는 C 코드를 다시 빌드하는 것이 아니라, 이미 만든 ELF에서 보드 메모리에 올릴 내용을 꺼낸다.

```text
firmware.elf
     ↓ 변환
firmware.bin
```

같은 `firmware` 폴더에서 실행한다.

```bash
arm-none-eabi-objcopy -O binary firmware.elf firmware.bin
ls -lh firmware.bin
```

`firmware.bin`은 메모리에 올릴 코드와 데이터를 단순한 바이트 형태로 뽑은 파일이다. 함수 이름이나 소스 코드 줄 정보는 빠진다. 변환 방식은 [GNU objcopy 문서](https://sourceware.org/binutils/docs/binutils/objcopy.html)에 설명되어 있다.

이번에 보드에 올린 파일은 **`firmware.elf`**였다. `firmware.bin`은 만들어두었지만, 이번 실행에서 UART로 전송하지는 않았다. 나중에 부트로더가 BIN을 받아 실행하게 하려면, 받을 크기와 저장 주소를 알려주는 방법도 만들어야 한다.

| 파일 | 이번 실습에서의 용도 |
| --- | --- |
| `firmware.elf` | GDB로 보드에 올리고 실행 위치와 함수 이름을 확인한다. |
| `firmware.bin` | 이후 부트로더로 전송할 파일 형태를 준비해둔다. |

## 코드 리뷰

### UART에서 문자 하나 받기

PC에서 숫자를 보내기 전에, 보드 쪽에서 문자를 받는 방법부터 이해해야 했다.

CPU는 UART의 정해진 주소를 읽거나 써서 통신 장치를 사용한다. 이때 상태나 데이터를 읽고 쓰는 작은 공간을 **레지스터**라고 부른다. 처음에는 “UART 장치의 상태를 확인하거나 문자를 넣고 꺼내는 곳”으로 생각했다.

이번에 사용한 주소는 다음과 같다.

```c
#define UART0_BASE 0xFFC02000u

#define UART_RBR 0x00u
#define UART_THR 0x00u
#define UART_LSR 0x14u
```

`UART0_BASE`는 UART0 장치의 시작 주소다. 뒤의 숫자는 그 시작 주소에서 얼마나 떨어진 곳인지를 나타낸다.

예를 들어 상태를 읽는 위치는 다음과 같다.

```text
UART0_BASE + UART_LSR
0xFFC02000 + 0x14 = 0xFFC02014
```

| 이름 | 하는 일 |
| --- | --- |
| `RBR` | 받은 문자 하나를 읽는다. |
| `THR` | 보낼 문자 하나를 쓴다. |
| `LSR` | 문자가 들어왔는지, 다음 문자를 보낼 수 있는지 확인한다. |

`RBR`은 Receiver Buffer Register, `THR`은 Transmit Holding Register, `LSR`은 Line Status Register를 줄인 이름이다. 매크로 이름은 내가 바꿀 수 있지만 주소 값은 하드웨어 문서에 맞춰야 한다. 실제 코드에서는 수신 위치를 `UART_RECEIVE_DATA`라고도 이름 붙였고, 값은 똑같이 `0x00u`를 사용했다.

RBR과 THR의 주소가 같은 것도 처음에는 헷갈렸다. 이번처럼 부트로더가 UART 설정을 마치고 `DLAB=0`으로 둔 상태에서는 **같은 주소를 읽으면 수신, 쓰면 송신**이 된다. `DLAB`은 UART 속도를 설정할 때 그 주소의 역할을 잠깐 바꾸는 설정이며, 지난 부트로더 코드에서 다루었다.

주소와 읽기·쓰기 역할은 [실습에서 사용한 Cyclone V HPS 매뉴얼](https://www.scs.stanford.edu/~zyedidia/docs/visionfive/cv_5_HPS_tech_ref.pdf)의 UART 장에서 확인했다. PDF 2920쪽은 주소표, 2922쪽은 수신·송신 데이터 설명이다.

#### 값 두 개를 받는다고 주소가 두 개 필요한 것은 아니다

처음에는 첫 번째 값을 `0x00`에서, 두 번째 값을 `0x08`에서 읽으면 되는 줄 알았다.

```c
/* 이 방식으로 두 문자를 구분할 수는 없다. */
#define UART_RECEIVE_DATA1 0x00u
#define UART_RECEIVE_DATA2 0x08u
```

하지만 UART는 첫 번째 숫자와 두 번째 숫자에 각각 다른 주소를 주는 장치가 아니다. `0x08`도 두 번째 문자의 주소가 아니다.

**같은 수신 위치에서 문자를 하나씩 꺼내고, 각각 C 변수에 저장해야 한다.**

```text
PC에서 '4'를 보낸다.
    → 수신 위치에서 읽어서 변수 a에 저장한다.

PC에서 '3'을 보낸다.
    → 같은 수신 위치에서 읽어서 변수 b에 저장한다.
```

두 값을 구분해 보관하는 것은 주소 두 개가 아니라 `a`, `b`라는 변수 두 개다.

#### 문자가 들어올 때까지 기다리기

UART 상태 값에서 **bit 0**이 1이면 받은 데이터가 있다는 뜻이다. bit는 값의 각 자리에 있는 0 또는 1이다. 아래 코드는 그중 첫 번째 자리만 확인한다.

```c
#define UART_LSR_DR (1u << 0)

char uart_getc(void)
{
    while (!(mmio_read(UART0_BASE + UART_LSR) & UART_LSR_DR)) {
    }

    return (char)mmio_read(UART0_BASE + UART_RBR);
}
```

순서는 간단하다. 문자가 없으면 상태를 계속 확인하고, 문자가 들어오면 수신 위치에서 읽어 반환한다. 반환한 문자를 저장하는 예는 다음과 같다.

```c
char c = uart_getc();
```

따라서 함수의 시작은 `void uart_getc(char c)`가 아니라 **`char uart_getc(void)`**다. `char`는 문자 하나를 돌려준다는 뜻이고, 괄호 안의 `void`는 호출할 때 넣어줄 값이 없다는 뜻이다.

상태는 반복할 때마다 다시 읽어야 한다. 문자가 없을 때 한 번 읽은 값을 변수에 저장하고 그 변수만 계속 확인하면, 나중에 문자가 들어와도 알아채지 못한다.

### 문자로 받은 숫자를 더하기

이번에는 입력을 단순하게 정했다. **0부터 9까지의 숫자 두 개**만 받는다. `34`를 보내면 `3`과 `4`를 더한다. 숫자 34 한 개로 해석하는 코드는 아니다.

UART로 들어온 `'3'`은 문자다. 계산하려면 숫자 `3`으로 바꿔야 한다.

```c
int a = uart_getc() - '0';
int b = uart_getc() - '0';
int sum = a + b;
```

문자 `'0'`부터 `'9'`까지의 값은 순서대로 붙어 있다. 그래서 받은 문자에서 `'0'`을 빼면 그 숫자가 된다.

```text
'3' - '0' = 3
'4' - '0' = 4
```

계산 결과를 보낼 때는 반대로 `'0'`을 더해서 문자로 바꾼다.

두 입력의 최대 합은 `9 + 9 = 18`이다. 따라서 합이 10 이상이면 먼저 `'1'`을 보내고, 마지막 자리를 이어서 보냈다.

```c
if (sum >= 10) {
    uart_putc('1');
}

uart_putc('0' + (sum % 10));
```

`% 10`은 10으로 나눈 나머지를 구한다. 예를 들어 17의 나머지는 7이므로, `'1'` 다음에 `'7'`을 보내면 화면에 `17`이 나온다.

입력에는 공백이나 엔터를 넣지 않았다. 현재 코드는 문자 두 개를 그대로 읽기 때문에, `3 4`를 보내면 첫 번째는 `'3'`, 두 번째는 공백이 된다. `12 34` 같은 입력이나 음수, 잘못된 문자를 처리하는 기능도 아직 없다.

### 덧셈 펌웨어 전체 코드

아래는 실행한 코드와 같은 동작을 하도록 이름과 줄 간격을 정리하고 주석을 붙인 `main.c`다. 실제 작업 파일에서는 수신 위치에 `UART_RECEIVE_DATA`라는 이름을 썼고, 아래에서는 하드웨어 문서와 같은 `UART_RBR`로 통일했다.

```c
#include <stdint.h>

#define UART0_BASE 0xFFC02000u
#define UART_RBR   0x00u
#define UART_THR   0x00u
#define UART_LSR   0x14u

#define UART_LSR_DR   (1u << 0)
#define UART_LSR_THRE (1u << 5)

static inline uint32_t mmio_read(uint32_t addr)
{
    return *(volatile uint32_t *)addr;
}

static inline void mmio_write(uint32_t addr, uint32_t value)
{
    *(volatile uint32_t *)addr = value;
}

char uart_getc(void)
{
    /* 받은 문자가 생길 때까지 상태를 계속 확인한다. */
    while (!(mmio_read(UART0_BASE + UART_LSR) & UART_LSR_DR)) {
    }

    return (char)mmio_read(UART0_BASE + UART_RBR);
}

void uart_putc(char c)
{
    /* 다음 문자를 보낼 수 있을 때까지 기다린다. */
    while (!(mmio_read(UART0_BASE + UART_LSR) & UART_LSR_THRE)) {
    }

    mmio_write(UART0_BASE + UART_THR, (uint32_t)(unsigned char)c);
}

void uart_puts(const char *str)
{
    while (*str) {
        if (*str == '\n') {
            uart_putc('\r');
        }
        uart_putc(*str++);
    }
}

int main(void)
{
    uart_puts("Hello Cortex-A9!\n");

    while (1) {
        int a = uart_getc() - '0';
        int b = uart_getc() - '0';
        int sum = a + b;

        if (sum >= 10) {
            uart_putc('1');
        }

        uart_putc('0' + (sum % 10));
        uart_puts("\n");
    }
}
```

결과의 줄바꿈은 `uart_puts("\n")`로 정리했다. 실습 중에는 `uart_putc('\n')`를 사용했지만, `uart_puts()`는 줄을 바꾸기 전에 `\r`도 보내서 다음 줄의 맨 앞으로 이동하게 해준다.

`mmio_read()`와 `mmio_write()`는 지정한 하드웨어 주소를 읽거나 쓰는 함수다. `uint32_t`는 32비트 크기의 부호 없는 정수이며, 여기서는 주소와 레지스터 값에 사용한다.

함수 안의 `volatile`은 코드 밖에서도 값이 바뀔 수 있다는 사실을 빌드 도구에 알려준다. UART 상태는 문자가 도착하면 바뀐다. 그래서 앞에서 읽은 값을 계속 재사용하지 않고, 그때마다 실제 주소에서 다시 읽어야 한다.

`while (1)`은 받기와 계산을 계속 반복하게 만든다. 한 번 답을 보낸 뒤에도 다음 문자 두 개를 기다린다.

### 함수별 확인

전체 코드를 다시 읽으면서 함수마다 맡은 일을 확인했다. 흐름은 **받기 두 번, 계산 한 번, 답 보내기**다.

#### 부트로더는 하드웨어 준비를 끝내고 기다린다

부트로더의 `main()`에서는 다음 순서로 호출한다.

```c
board_init();
uart_init();
uart_puts("Bootloader ready\r\n");
```

위 코드는 호출 순서만 뽑아낸 것이다. 실제 코드에서는 `board_init()`이 실패하면 다음 단계로 가지 않고 기다린다.

`board_init()`은 CPU와 클럭이 이번 실습에 맞는 상태인지 확인하고, UART 핀을 준비하고, UART가 동작할 수 있도록 리셋을 해제한다. `uart_init()`은 문자를 주고받는 형식과 속도를 설정한다. 이 준비를 먼저 끝냈기 때문에 이번 펌웨어에서는 계산에 필요한 코드에 집중할 수 있었다.

#### 주소를 읽고 쓰는 함수는 역할이 하나씩이다

`mmio_read()`는 주소를 받아 값을 읽고 반환한다. `mmio_write()`는 주소와 값을 받아 그 위치에 쓴다. UART 주소를 함수 안에 고정하지 않았기 때문에, 호출할 때 어떤 위치를 사용할지 정할 수 있다.

```c
uint32_t status = mmio_read(UART0_BASE + UART_LSR);
```

이 예시는 UART 상태를 한 번 읽는다. 하지만 문자가 올 때까지 기다리는 코드에서는 한 번 저장한 `status`만 계속 검사하면 안 된다. `while` 조건 안에서 `mmio_read()`를 반복 호출해야 새로 들어온 문자를 알아챌 수 있다.

#### uart_getc는 문자 하나를 반환한다

`uart_getc()`에는 입력 인자가 없다. 함수가 UART에서 직접 읽기 때문이다. 반환값은 받은 문자 하나다.

```c
char c = uart_getc();
```

확인하는 상태는 bit 0이다. 상태를 확인하는 주소와 실제 문자를 꺼내는 주소가 다르다는 것도 다시 확인했다. 받은 문자를 보관하는 것은 레지스터 주소를 바꾸는 일이 아니라, 반환값을 C 변수에 넣는 일이다.

#### uart_putc는 문자 하나를 보낸다

`uart_putc()`는 보낼 문자를 인자로 받는다. 다음 문자를 보낼 수 있는지 bit 5를 확인한 뒤 송신 위치에 쓴다.

```c
uart_putc('7');
```

상태를 읽는 식에서도 괄호 위치가 중요했다.

```c
/* 주소에 & 연산을 하고 나서 읽는 잘못된 식 */
mmio_read((UART0_BASE + UART_LSR) & UART_LSR_THRE);

/* 상태 값을 읽은 다음 필요한 bit를 확인하는 식 */
mmio_read(UART0_BASE + UART_LSR) & UART_LSR_THRE;
```

첫 식은 UART 상태 값이 아니라 주소 자체를 바꿔버린다. 두 번째처럼 **먼저 올바른 주소를 읽고, 읽은 값에서 필요한 자리를 확인해야 한다.**

#### uart_puts는 문자열을 한 글자씩 보낸다

`uart_puts()`는 `uart_putc()`를 반복 호출한다. 예를 들어 `uart_puts("Hi")`는 `'H'`와 `'i'`를 차례로 보내는 것과 같다.

문자열 끝까지 반복하고, 줄바꿈을 만나면 `\r`도 보낸다. `\n`은 다음 줄로 내려가고 `\r`은 줄의 맨 앞으로 이동하는 문자다.

#### main은 숫자 두 개와 계산을 맡는다

두 번 받은 문자를 숫자로 바꾸어 `a`, `b`에 넣고, 합을 `sum`에 저장한다.

```c
int a = uart_getc() - '0';
int b = uart_getc() - '0';
int sum = a + b;
```

입력이 `0~9` 두 개라는 조건에서 합은 `0~18`이다. 그래서 결과 출력도 그 범위에 맞게 작성했다. 세 자리 결과를 출력하거나 음수를 처리하는 일반적인 숫자 출력 함수는 아직 아니다.

문자가 오지 않으면 `uart_getc()` 안에서 계속 기다린다. 이번 연습은 단순하게 만들었지만, 다음에는 너무 오래 기다렸을 때 어떻게 처리할지도 정할 필요가 있다.

## 보드에서 실행하기

이제 실제로 사용한 명령을 정리한다. 지난번에 만든 부트로더와 JTAG 설정, 필요한 도구가 있는 환경에서 실행했다. 폴더 경로는 내 PC의 것이므로 자신의 환경에 맞게 바꿔야 한다.

처음에는 어느 화면에 무엇을 입력할지도 헷갈렸다. 그래서 터미널의 역할부터 나누었다.

| 터미널 | 역할 |
| --- | --- |
| 1 | OpenOCD를 실행해서 JTAG 연결을 열어둔다. |
| 2 | UART로 보드에서 오는 문자를 본다. |
| 3 | GDB로 프로그램을 올리고 CPU를 실행한다. |
| 4 | 파일을 빌드하고, UART로 숫자를 보낸다. |

### 1 JTAG 연결 열기

```bash
cd /home/doogunwo/project/bootloader
./execute.sh jtag
```

OpenOCD는 PC의 GDB와 보드를 연결해주는 프로그램이다. 다음 문장이 나오면 이 터미널은 계속 켜둔다.

```text
Listening on port 3333 for gdb connections
```

### 2 보드에서 오는 문자 보기

다른 터미널에서 실행한다.

```bash
cd /home/doogunwo/project/bootloader
sudo ./execute.sh uart
```

```text
UART 출력 대기: /dev/ttyUSB0, 57600 baud, 8N1 (종료: Ctrl+C)
```

`57600`은 통신 속도 설정이다. 보드 쪽과 같은 속도를 사용한다. `8N1`은 데이터 8비트를 사용하고, 데이터 오류를 확인하는 추가 비트는 넣지 않으며, 끝을 알리는 비트는 하나 쓰는 설정이다. 처음에는 **PC와 보드의 설정을 같게 맞춘다**는 점부터 기억하면 된다.

이 스크립트는 보드에서 오는 문자를 보여준다. **여기에 숫자를 입력하는 것만으로는 보드에 전송되지 않는다.** 전송할 때는 뒤에서 설명하는 별도의 명령을 사용한다.

### 3 부트로더 올리고 실행하기

세 번째 터미널에서 GDB를 실행한다. GDB는 프로그램을 중간에 멈추고 변수나 실행 위치를 살펴보는 도구다.

```bash
cd /home/doogunwo/project/bootloader
gdb-multiarch bootloader.elf
```

GDB 화면에서 아래 명령을 실행한다. `(gdb)`는 화면에 표시되는 안내 문구이므로 직접 입력하지 않는다.

```gdb
target remote 127.0.0.1:3333
monitor halt
load
set $cpsr = ($cpsr & ~0x20)
set $pc = &_start
continue
```

`load`가 파일을 보드에 전송한다. `set $pc`로 실행을 시작할 위치를 정하고, `continue`로 실행한다. `$cpsr`를 바꾸는 줄은 이번 시작 코드에 맞게 ARM 명령을 실행하는 상태로 만들기 위해 사용했다.

UART 터미널에 아래 문장이 나오면 부트로더 쪽 준비가 된 것이다.

```text
Bootloader ready
```

연결할 때 `Connection timed out`이 나오면 먼저 OpenOCD가 실행 중인지 확인한다. 내 환경에서는 OpenOCD가 꺼져 있어서 GDB가 연결하지 못했다. ELF를 열었다고 보드에 연결된 것은 아니다.

### 4 펌웨어 올리고 실행하기

네 번째 터미널에서 앞의 빌드 명령을 실행해 펌웨어 파일을 만든다. 그다음 GDB 터미널에서 `Ctrl+C`를 눌러 부트로더를 멈추고 펌웨어를 올린다.

```gdb
monitor halt
file /home/doogunwo/project/firmware/firmware.elf
load
```

파일을 바꿀지 묻는 확인 문구가 나오면 `y`를 입력한다. 실습 중 전송 결과는 다음과 같았다.

```text
Loading section .text, size 0x23c lma 0xffff8000
Loading section .rodata, size 0x12 lma 0xffff823c
Start address 0xffff8000, load size 590
```

`.text`는 실행할 명령을 놓는 부분이고, `.rodata`는 문자열처럼 바꾸지 않는 데이터를 놓는 부분이다. 시작 주소가 `0xffff8000`이므로 정한 위치에 올라간 것을 확인할 수 있다. 코드를 바꾸면 전송 크기도 달라지므로, 꼭 590바이트여야 성공하는 것은 아니다.

이번에는 뒤에서 설명할 실행 문제가 있어서 명령 캐시를 비우고 다시 실행했다. 캐시는 CPU가 빠르게 읽으려고 정보를 잠깐 보관하는 곳이다. 아래 명령은 보드가 멈춘 상태의 GDB에서 실행한다.

```gdb
monitor arm mcr 15 0 7 10 4 0
monitor arm mcr 15 0 7 5 0 0
monitor arm mcr 15 0 7 10 4 0
monitor arm mcr 15 0 7 5 4 0
set $pc = &_start
continue
```

첫 번째와 세 번째 명령은 앞선 메모리 처리가 끝날 때까지 기다리는 역할이다. 두 번째는 명령 캐시를 비우고, 네 번째는 이후 명령을 다시 읽도록 한다. 처음부터 숫자를 외우기보다 **새로 올린 명령을 다시 읽고, 시작 위치부터 실행한다**는 목적을 이해했다. 사용하는 명령은 [ARM 설명](https://documentation-service.arm.com/static/5e8e264088295d1e18d37ce8)과 [OpenOCD 명령 설명](https://openocd.org/doc/html/Architecture-and-Core-Commands.html)에 나와 있다.

UART 터미널에 다음 문장이 나왔다.

```text
Bootloader ready
Hello Cortex-A9!
```

이제 부트로더가 준비한 뒤 별도의 펌웨어를 실행해서 문자를 보낼 수 있다는 것을 확인했다.

### 5 PC에서 숫자 보내기

GDB에서 `continue`해서 프로그램이 실행 중인 상태로 두고, 네 번째 터미널에서 전송한다. 처음에는 한 글자씩 보내면 어디까지 받았는지 확인하기 쉽다.

```bash
printf '4' | sudo tee /dev/ttyUSB0 > /dev/null
```

한 글자만 보내면 답은 나오지 않는다. 펌웨어가 두 번째 문자를 기다리기 때문이다. 이어서 전송한다.

```bash
printf '3' | sudo tee /dev/ttyUSB0 > /dev/null
```

UART 터미널에 `7`이 나오면 `4 + 3`을 계산해서 돌려준 것이다.

```text
7
```

두 글자를 한 번에 보내는 예시는 다음과 같다. 입력은 공백이나 줄바꿈이 없는 `34`이며, 계산은 `3 + 4`가 된다.

```bash
printf '34' | sudo tee /dev/ttyUSB0 > /dev/null
```

`printf`가 보낼 문자를 만들고, `tee`가 UART 통로에 써준다. `> /dev/null`은 PC에 표시되는 복사본을 버리는 설정이므로 **전송 명령을 입력한 터미널에는 답이 나오지 않는다.** 답은 UART를 보고 있는 다른 터미널에 표시된다.

GDB에서 멈춰두면 펌웨어도 수신 처리를 진행하지 못한다. 전송하기 전에 `continue`해서 실행해두는 것이 중요하다.

## 문제 해결

처음부터 바로 동작한 것은 아니었다. 문자를 보내도 화면에 답이 나오지 않는 문제가 있었다.

### GDB 화면에 숫자를 입력했다

펌웨어를 실행한 뒤 GDB 화면에 `3 4`를 입력하려고 했다. 하지만 GDB는 CPU를 조작하는 화면이지, UART 입력 화면이 아니다.

숫자는 별도 터미널에서 `/dev/ttyUSB0`로 보내야 했다. 또한 이번에는 문자 하나씩 숫자로 읽으므로 가운데 공백도 필요하지 않았다.

### 올라간 코드와 실행 위치를 확인했다

출력이 없을 때는 GDB에서 `Ctrl+C`를 눌러 멈추고 다음 명령을 실행했다.

```gdb
bt
compare-sections
info registers pc sp cpsr
```

`bt`는 어느 함수에서 어떤 함수를 호출해서 지금 위치에 왔는지 보여준다. `compare-sections`는 보드 메모리의 코드와 데이터가 PC의 ELF와 같은지 비교한다.

이때 코드는 일치했다.

```text
Section .text, range 0xffff8000 -- 0xffff823c: matched.
Section .rodata, range 0xffff823c -- 0xffff824e: matched.
```

그런데 실행 위치는 `uart_puts()`로 표시됐고, 함수 호출 표시와 스택 위치가 현재 코드의 흐름과 맞지 않았다. 스택은 함수 실행에 필요한 값이나 돌아갈 위치 등을 잠깐 보관하는 곳이다.

```text
pc    0xffff8164 <uart_puts+56>
sp    0xfffffff0
cpsr  0x600001d3
```

`PC`는 실행 위치를 확인할 때 보는 값이고, `SP`는 스택 위치, `CPSR`은 CPU의 동작 상태를 나타낸다. 메모리에 코드가 제대로 올라간 것과 그 코드를 올바른 순서로 실행하는 것은 따로 확인해야 했다.

명령 캐시를 비우고 `_start`부터 다시 실행하자 수신 함수까지 정상적으로 도착했다.

```gdb
thbreak uart_getc
continue
```

`thbreak`는 지정한 곳에서 한 번 멈추게 하는 설정이다. 여기서는 CPU의 하드웨어 정지 기능을 사용했다.

```text
#0  uart_getc () at main.c:28
#1  0xffff81ac in main () at main.c:54
sp  0xffffffd8
```

`main()`에서 `uart_getc()`로 진행한 것을 확인할 수 있다. 이번에는 이 조작 뒤 실행 흐름이 정상으로 돌아왔다. 이전 명령이 캐시에 남았을 가능성이 있지만, 이 결과만으로 원인을 하나로 확정하지는 않았다.

표시되는 줄 번호와 주소는 그때 빌드한 코드의 것이다. 글의 코드처럼 주석이나 이름을 정리하면 줄 번호나 코드 위치도 달라질 수 있다.

### 수신 상태와 실제로 받은 문자를 봤다

UART의 수신 상태도 확인했다.

```gdb
x/1wx 0xffc02014
```

```text
0xffc02014: 0x00000063
```

`x/1wx`는 지정한 주소의 32비트 값 하나를 보는 명령이다. 여기서는 UART 상태를 읽었으므로 문자 자체를 읽은 것은 아니다.

`0x63`에서는 bit 0이 1이므로 수신 데이터가 있었다. bit 1도 1이었다. 이 값은 들어온 문자를 읽는 처리가 늦어서 데이터를 놓친 일이 있었다는 뜻이다.

이번 부트로더에서는 UART 안에 여러 문자를 줄 세워 보관하는 기능을 켜지 않았다. 앞의 문자를 읽기 전에 다음 문자가 들어오면 먼저 받은 문자가 덮어써질 수 있다. 특히 GDB로 CPU를 멈춘 채 숫자를 보내면 이런 일이 생기기 쉽다. UART의 동작 설명은 [HPS 매뉴얼 PDF 2922쪽과 2935쪽](https://www.scs.stanford.edu/~zyedidia/docs/visionfive/cv_5_HPS_tech_ref.pdf)에 있다.

수신 함수에서 멈춘 상태에서 다음 명령으로 함수를 끝까지 실행했다.

```gdb
finish
```

실제로 반환된 값은 다음과 같았다.

```text
Value returned is $1 = 52 '4'
```

`52`는 문자 `'4'`를 나타내는 값이다. 이것으로 UART 수신 함수가 실제 문자를 읽고 있다는 것을 확인했다.

이때 첫 번째 문자로 `'4'`를 읽은 상태였으므로, GDB에서 `continue`하고 PC에서 두 번째 문자 `'3'`만 보냈다. 그러자 `7`이 돌아왔다.

수신 데이터 주소를 GDB에서 직접 읽을 때도 알아둘 점이 있다.

```gdb
x/1wx 0xffc02000
```

이 명령은 화면에 값을 표시하는 것과 함께 UART에서 문자 하나를 꺼낸다. 꺼낸 문자는 이후 펌웨어가 다시 받지 못한다. 일반 메모리를 볼 때와 다르므로, 상태를 보는 주소와 데이터를 꺼내는 주소를 구분해야 했다.

## 실행 결과

실제 UART 화면은 다음과 같았다.

글 앞의 첫 번째 사진에서도 같은 시작 문장과 여러 번 받은 `7`을 볼 수 있다. 한 번 계산하고 끝나는 대신 다음 입력도 받아 다시 답하는 동작을 확인했다.

```text
doogunwo@home:~/project/bootloader$ sudo ./execute.sh uart
UART 출력 대기: /dev/ttyUSB0, 57600 baud, 8N1 (종료: Ctrl+C)
Bootloader ready
Hello Cortex-A9!
Hello Cortex-A9!
7
```

`Hello Cortex-A9!`가 두 번 나온 것은 확인하는 중에 펌웨어를 시작 위치부터 다시 실행했기 때문이다. 마지막의 `7`이 보드 안에서 계산해서 돌려준 답이다.

PC에서 보낸 문자가 보드의 C 함수 반환값이 되고, 정수로 바뀌어 계산에 쓰이고, 결과는 다시 문자가 되어 PC에 도착했다. 이 흐름을 직접 따라가니 UART 송수신과 C 코드의 계산이 어떻게 이어지는지 이해하기 쉬웠다.

### 다음에 만들어볼 것

지금 프로그램은 한 자리 숫자 두 개를 받는 작은 연습이다. 다음에는 `12 34`처럼 공백으로 구분한 숫자를 받아서 `46`을 돌려주고 싶다.

그러려면 문자를 하나씩 받은 뒤 공백이나 줄바꿈이 나올 때까지를 하나의 숫자로 읽는 처리가 필요하다. 숫자 아닌 문자가 들어오거나 입력이 중간에 끊긴 경우도 다뤄보고 싶다.

다른 목표는 부트로더가 UART로 `firmware.bin`을 받아서 직접 펌웨어를 실행하게 만드는 것이다. 이번에 성공한 숫자 송수신을 바탕으로 프로그램 파일을 보내는 과정까지 이어가려고 한다.

실습에 사용한 `main.c`, `startup.S`, `linker.ld`는 [펌웨어 소스 한 묶음]({{ '/assets/downloads/de1-soc-firmware-uart-addition.zip' | relative_url }})에서 받을 수 있다. ZIP에는 실습 당시 파일을 그대로 저장했으므로, 글에서 읽기 좋게 정리한 코드와 이름이나 줄바꿈 방식이 일부 다르다.
