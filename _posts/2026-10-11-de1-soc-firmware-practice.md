---
title: "De1-Soc 기반 펌웨어 실습"
layout: post
categories:
  - writing
  - study
tags:
  - 펌웨어
  - ARM
  - 임베디드
description: "DE1-SoC의 HPS ARM에서 베어메탈 부트로더를 만들고, 링커와 시작 코드, JTAG 업로드, 하드웨어 초기화를 거쳐 UART 출력을 확인한 학습 기록."
thumbnail: /assets/images/2026-10-11/de1-soc/uart-bootloader-ready.png
toc_depth: 2
---

펌웨어가 어떻게 실행되는지 기초부터 이해하고 싶어서 DE1-SoC로 실습을 시작했다. 목표는 직접 만든 부트로더를 보드에 올리고, 그 부트로더가 나중에 펌웨어를 받아 실행하도록 만드는 것이다. 최종적으로는 PC에서 간단한 요청을 보내고, 펌웨어가 처리한 결과를 돌려받는 구조를 생각하고 있다.

첫 실습에서는 HPS의 ARM CPU에서 리눅스 없이 코드를 실행하고, UART로 `Bootloader ready`를 출력하는 데까지 진행했다. PC에 연결된 USB 장치를 확인하는 것부터 시작해 메모리 맵, 링커 스크립트, 시작 코드, ELF, JTAG와 UART의 역할을 하나씩 구분했다.

결과는 다음과 같았다.

```text
root@home:/home/doogunwo/project/bootloader# sudo ./execute.sh uart
UART 출력 대기: /dev/ttyUSB0, 57600 baud, 8N1 (종료: Ctrl+C)
Bootloader ready
```

이 한 줄을 보기까지 필요한 준비가 생각보다 많았다. `main()` 앞에서 스택을 준비해야 했고, UART에 문자를 쓰기 전에는 리셋과 핀의 전기적 설정부터 처리해야 했다. 그 과정을 다시 따라갈 수 있도록 기록한다.

<!--more-->

## 보드와 통신

### DE1-SoC에서 사용할 부분

DE1-SoC는 Terasic의 개발 보드이며, Cyclone V SoC를 사용한다. 하나의 칩에 FPGA 영역과 ARM 기반 HPS가 함께 들어 있다. HPS는 Hard Processor System의 약자로, ARM CPU와 메모리 인터페이스, UART 같은 주변장치가 이미 하드웨어로 구현된 부분이다.

| 항목 | 보드 구성과 이번 실습에서의 사용 |
| --- | --- |
| SoC | Cyclone V SoC 5CSEMA5F31C6 |
| CPU | ARM Cortex-A9 두 개 중 CPU0 사용 |
| FPGA | 프로그래머가 디지털 회로를 구성할 수 있는 영역 |
| HPS 외부 메모리 | DDR3 1 GB가 있지만 이번 단계에서는 사용하지 않음 |
| 실행 메모리 | HPS 내부의 OCRAM 64 KB |
| 다운로드와 디버깅 | 보드의 USB-Blaster II를 통한 JTAG |
| 문자 출력 | USB-to-UART 포트와 HPS UART0 |

보드의 CPU, DDR3, USB-Blaster II와 USB-to-UART 구성은 [Terasic 공식 사양](https://www.terasic.com.tw/cgi-bin/page/archive.pl?CategoryNo=165&Language=Taiwan&No=836&PartNo=2)에서 확인할 수 있다.

이번에는 FPGA 안에 Nios II 같은 CPU를 구성하지 않았다. 이미 칩에 들어 있는 HPS의 Cortex-A9에서 ARM 코드를 실행했다. 따라서 주된 작업은 C와 시작 코드 작성, 메모리 배치, HPS 주변장치 설정이었다.

### 펌웨어와 베어메탈 그리고 부트로더

펌웨어는 장치의 동작을 제어하는 소프트웨어다. UART로 데이터를 받거나, 타이머를 설정하거나, GPIO의 출력을 바꾸는 코드가 여기에 해당한다. 배포된 장치에서는 플래시 같은 비휘발성 메모리에 저장되는 경우가 많지만, 개발 중에는 RAM에 올려 실행할 수도 있다.

베어메탈은 운영체제 없이 프로그램이 하드웨어를 직접 다루는 방식이다. 이번 실습에서 우분투는 **개발 PC의 운영체제**이고, **보드의 ARM에서는 리눅스를 실행하지 않았다.** PC에서 ARM용 프로그램을 빌드하고, 그 결과를 보드 RAM에 전송했다.

부트로더는 다음 프로그램을 실행하기 위한 준비를 하는 코드다. 어떤 하드웨어를 초기화하고, 프로그램을 어디에서 받아 어디에 놓고, 어떤 주소로 제어를 넘길지 정한다. 부트로더 자체도 펌웨어의 한 종류다.

내가 만들려는 전체 구조는 다음과 같다.

```text
PC
 ├─ JTAG로 부트로더를 보드 RAM에 올리고 실행
 └─ UART로 펌웨어와 요청 전송

보드의 부트로더
 ├─ 필요한 하드웨어 준비
 ├─ UART로 다음 펌웨어 수신       ← 이후에 구현할 부분
 └─ 펌웨어를 메모리에 배치하고 실행 ← 이후에 구현할 부분

실행된 펌웨어
 └─ PC 요청 처리 후 결과 응답     ← 이후에 구현할 부분
```

현재 만든 것은 이 구조의 첫 단계다. 부트로더의 시작 코드와 UART 초기화는 동작하지만, 다음 펌웨어를 수신하는 로더와 요청 처리 기능은 아직 구현하지 않았다.

### USB 케이블 두 개의 역할

처음에는 `lsusb`에 Altera 장치가 보이니 이 연결로 문자도 주고받을 수 있을 것이라고 생각했다. 그런데 보드의 USB-Blaster II와 USB-to-UART는 서로 다른 인터페이스였다.

| 연결 | 보드 쪽 단자 | 사용하는 목적 |
| --- | --- | --- |
| USB-Blaster II | 일반 USB Type-B | JTAG를 통한 RAM 다운로드, CPU 제어, 디버깅 |
| USB-to-UART | USB Mini-B | ARM 프로그램의 문자 송수신 |

USB-Blaster 케이블을 연결했을 때 처음 확인한 장치는 다음과 같았다.

```text
ID 09fb:6810 Altera
```

Mini-USB 케이블을 추가로 연결하자 다음 장치가 나타났다.

```text
ID 0403:6001 Future Technology Devices International, Ltd FT232 Serial (UART) IC
```

우분투에서는 UART 장치에 대응하는 `/dev/ttyUSB0`도 생성됐다. 이후 이 포트를 열어 보드가 보낸 문자를 읽었다. 이 이름은 내 PC에서 확인한 결과이며, 다른 직렬 장치가 연결돼 있으면 포트 번호가 달라질 수 있다.

JTAG 도구가 USB-Blaster II를 초기화한 뒤에는 Altera 장치가 `09fb:6010 Altera DE-SoC`로 보였다. 이번 환경에서 관찰한 초기화 전후의 식별자 변화다.

### JTAG와 UART를 구분하기

JTAG는 칩의 테스트와 디버깅에 사용하는 인터페이스다. 이 실습에서는 CPU를 멈추고, 메모리에 코드를 쓰고, 레지스터와 실행 위치를 확인하는 통로로 사용했다. C 코드를 실행 중인 CPU를 제어할 수 있으므로 프로그램이 아직 UART를 준비하지 못한 단계에서도 디버깅할 수 있었다.

PC에서 보드까지의 JTAG 경로는 다음과 같았다.

```text
GDB → OpenOCD → Quartus JTAG 서버 → USB-Blaster II → HPS ARM CPU0
```

UART는 문자나 바이트를 순서대로 송수신하는 직렬 통신 장치다. 이번에는 비동기 통신으로 사용하며, PC와 보드가 통신 속도와 문자 형식을 맞춘다. 보드의 USB-UART 변환 칩 덕분에 PC에서는 USB 케이블로 연결하지만, ARM 프로그램에서는 UART 레지스터를 다룬다.

```text
보드의 C 코드
  → UART0 송신 레지스터
  → UART TX 핀
  → USB-UART 변환 칩
  → PC의 /dev/ttyUSB0
  → 터미널 화면
```

따라서 `/dev/ttyUSB0`가 생겼다고 부트로더가 업로드된 것은 아니다. 이 포트는 문자가 오가는 통로다. 이번 실습의 부트로더 코드는 JTAG로 올렸고, 실행 결과는 UART로 확인했다.

## 메모리와 레지스터

### CPU 레지스터와 주변장치 레지스터

실습 중 가장 먼저 헷갈린 것은 레지스터의 종류였다. CPU의 `SP`를 찾다가 메모리 주소표의 `SPIS1`, `SPIM0`를 보게 됐는데, 이름이 비슷해도 다른 항목이었다.

CPU 내부에서 사용하는 기본 레지스터는 다음과 같다.

| 이름 | 역할 |
| --- | --- |
| `R0`부터 `R12` | 계산할 값이나 주소 저장 |
| `R13`, 즉 `SP` | 현재 스택 위치 |
| `R14`, 즉 `LR` | 함수 호출 후 돌아갈 주소 |
| `R15`, 즉 `PC` | 명령 실행 위치를 나타내는 레지스터 |
| `CPSR` | 실행 모드, ARM/Thumb 상태, 비교 플래그, 인터럽트 마스크 등 |
| `SPSR` | 예외 처리 모드에서 예외 이전의 CPU 상태를 보관 |

이들은 ARM 명령어로 접근하는 CPU 레지스터다. 예를 들어 `ldr sp, =__stack_top`은 링커가 정한 주소를 스택 포인터에 넣는다. `bl main`은 `main()`으로 분기하면서 복귀 주소를 LR에 남긴다. ARM 상태에서 PC를 일반 값으로 읽을 때는 명령 파이프라인에 따른 차이도 있으므로, 처음에는 실행 흐름을 추적하는 역할부터 이해했다.

반면 메모리 맵의 `SPIS1`은 SPI Slave 1, `SPIM0`는 SPI Master 0 통신 장치다. 이 이름은 스택 포인터 SP와 관계가 없다. CPU 레지스터 설명과 주변장치 주소표를 따로 읽어야 했다. Cortex-A9의 시스템 제어 레지스터는 [Arm 기술 매뉴얼](https://documentation-service.arm.com/static/5f0370fccafe527e86f5bfb2?token=)에서 확인할 수 있다.

### MMIO로 하드웨어에 접근하기

주변장치 레지스터는 정해진 메모리 주소로 접근한다. 이를 Memory-Mapped I/O, 줄여서 MMIO라고 한다. 일반 RAM에 값을 쓰는 형태의 명령을 사용하지만, 해당 주소에서는 UART나 리셋 컨트롤러 같은 하드웨어가 그 접근을 처리한다.

처음에는 다음 매크로로 접근했다.

```c
#define REG32(address) (*(volatile uint32_t *)(uintptr_t)(address))
```

이 매크로를 읽기 쉬운 함수 두 개로 풀어 `main.c`에서 사용했다.

```c
uint32_t reg_read(uint32_t address)
{
    volatile uint32_t *reg = (volatile uint32_t *)(uintptr_t)address;
    return *reg;
}

void reg_write(uint32_t address, uint32_t value)
{
    volatile uint32_t *reg = (volatile uint32_t *)(uintptr_t)address;
    *reg = value;
}
```

`address`는 접근할 주소 값이다. 이를 `volatile uint32_t *`로 바꾼 뒤 `*reg`로 읽거나 쓴다. `volatile`은 이 접근을 컴파일러가 생략하거나 값만 기억해 반복해서 사용하는 식으로 바꾸지 않도록 한다. CPU의 메모리 접근 완료와 순서가 필요한 지점은 별도의 장벽 명령으로 처리한다. `volatile` 하나가 모든 하드웨어 순서 문제를 해결하는 것은 아니다.

```c
reg_write(UART_LCR, 0x03u);          // 해당 주소에 설정값 쓰기
uint32_t status = reg_read(UART_LSR); // 해당 주소에서 상태 읽기
```

단순히 `#define UART0_BASE 0xFFC02000u`라고 적는 것은 주소에 이름을 붙이는 작업이다. 실제 하드웨어 접근은 `reg_read()`나 `reg_write()`를 호출할 때 발생한다.

### 메모리 맵과 OCRAM의 위치

주소를 임의로 정할 수는 없다. Cyclone V HPS 매뉴얼의 메모리 맵에서 해당 장치의 시작 주소와 크기를 찾아야 한다. 개별 레지스터는 보통 **장치 시작 주소에 레지스터 오프셋을 더한 주소**로 접근한다. [공식 HPS 주변장치 주소표](https://docs.altera.com/r/docs/683126/21.2/cyclone-v-hard-processor-system-technical-reference-manual/hps-peripheral-region-address-map?contentId=MOeaB5f2LZdV4Jgkc~UQqQ)

이번 실습에서 구분한 영역은 다음과 같다.

| 항목 | 주소 또는 범위 | 의미 |
| --- | --- | --- |
| Boot ROM | `0xFFFD0000`–`0xFFFDFFFF` | 제조사의 부팅 코드가 들어 있는 64 KB ROM |
| OCRAM | `0xFFFF0000`–`0xFFFFFFFF` | 사용자 코드와 데이터를 저장할 수 있는 내부 RAM 64 KB |
| UART0 | `0xFFC02000` | UART0 레지스터 시작 주소 |
| Clock Manager | `0xFFD04000` | 클럭 상태와 설정을 다루는 영역 |
| Reset Manager | `0xFFD05000` | 주변장치 등의 리셋을 다루는 영역 |
| System Manager | `0xFFD08000` | 핀 선택과 I/O freeze 등 보드 준비에 사용하는 영역 |
| Scan Manager | `0xFFF02000` | HPS I/O의 전기적 설정을 전송하는 영역 |

**`0xFFFF0000`은 부트로더 레지스터 주소가 아니라 OCRAM의 시작 주소다.** 여기에 부트로더를 올릴 수 있다는 뜻이다. C 코드에 이 주소를 매크로로 정의해도 코드가 자동으로 그 위치에 배치되지는 않는다. 코드 배치는 링커 스크립트가 정한다.

Boot ROM도 우리가 만든 부트로더를 저장하는 공간은 아니다. 전원 직후 제조사의 코드가 실행될 수 있는 ROM이며, 이번에는 JTAG로 사용자 코드를 OCRAM에 쓴 뒤 그 코드로 제어를 넘겼다. microSD에 부트로더를 설치해 자동 부팅하는 방식과는 다른 개발 흐름이다.

읽었던 2014년판 매뉴얼에서는 OCRAM과 Boot ROM의 정확한 범위가 PDF 745쪽, 본문 12-4에 나와 있었다. MPU 레지스터 상세 범위는 `0xFFFEC000`–`0xFFFEEFFF`, L2 캐시 제어 영역은 `0xFFFEF000`–`0xFFFEFFFF`여서 OCRAM과 겹치지 않았다. MPU 요약표의 8 KB와 상세표의 12 KB는 상세표가 예약 영역 4 KB까지 포함하는 차이도 있었다. 주소표는 시작 주소뿐 아니라 끝 주소와 예약 영역까지 함께 확인하는 편이 정확했다.

## 프로젝트 구조

### 소스 파일의 역할

실습 코드는 다음처럼 나누었다.

```text
bootloader/
├── main.c           UART 속도 설정과 문자 출력
├── board.c          CPU 상태 확인, 리셋, I/O 핀 준비
├── uart_iocsr.h      DE1-SoC의 I/O bank 7A 설정 데이터
├── startup.S        스택 준비, BSS 초기화, main 호출
├── linker.ld.S      메모리 배치 설정 원본
├── linker.ld        전처리기로 생성한 링커 파일
├── jtag.cfg         OpenOCD의 보드 연결 설정
├── execute.sh       링커 생성, 빌드, JTAG, UART 실행 명령
└── bootloader.elf   빌드 결과
```

초기화 코드 전체를 `main.c`에 넣었을 때는 학습하기에 너무 복잡했다. 부팅 상태 코드, 타임아웃 처리, FIFO 설정 같은 부분을 줄이고, 반드시 필요한 보드 준비는 `board.c`로 분리했다. `main.c`에서는 UART 레지스터를 읽고 쓰는 흐름에 집중했다.

`board.h`는 두지 않았다. `main.c`에서 다른 파일의 함수를 다음처럼 선언하고, 빌드할 때 `board.c`를 함께 연결했다.

```c
int board_init(void);
void board_delay(void);
```

필수 I/O 설정까지 삭제한 것은 아니다. 보드가 전원 직후 실제로 문자를 내보내려면 필요한 절차가 있어서, 그 부분은 별도 파일에 유지했다.

### 링커가 코드와 데이터를 배치하는 방법

C 소스를 컴파일하면 실행 코드와 데이터가 각각 섹션으로 나뉜다. 링커는 여러 파일의 섹션을 모아 최종 실행 파일에 배치한다. `linker.ld`는 이때 사용할 메모리와 배치 규칙을 알려준다. [GNU ld의 SECTIONS 설명](https://sourceware.org/binutils/docs/ld/SECTIONS.html)

| 섹션 | 들어가는 내용 | 예시 |
| --- | --- | --- |
| `.text` | 실행 명령어 | `main()`, `uart_init()`의 코드 |
| `.rodata` | 읽기 전용 데이터 | `"Bootloader ready"`, 고정 I/O 설정 테이블 |
| `.data` | 초기값이 있는 변경 가능한 전역변수 | 파일 범위의 `int count = 10;` |
| `.bss` | 초기값이 없거나 0으로 초기화되는 전역·정적 변수 | 파일 범위의 `int result;` |

RAM 64 KB 전부를 코드와 데이터에 배정하면 스택을 따로 확보하기 어렵다. 그래서 아래쪽 60 KB는 링커가 배치에 사용하고, 위쪽 4 KB는 스택 공간으로 남겼다.

```text
0xFFFF0000 ┌──────────────────────────────┐
           │ .text: 시작 코드와 C 코드     │
           │ .rodata: 문자열, 고정 테이블  │
           │ .data: 초기값 있는 변수      │
           │ .bss: 0으로 초기화할 변수    │
           │ 여유 공간                    │ 60 KB
0xFFFFF000 ├──────────────────────────────┤
           │ 스택 공간                    │  4 KB
           │ 아래쪽으로 성장              │
0xFFFFFFF8 │ 초기 SP                       │
0xFFFFFFFF └──────────────────────────────┘
```

초기 SP는 `0xFFFFFFF8`로 정했다. 8바이트 정렬된 값이며, RAM의 마지막 8바이트는 위쪽에 남긴다. `0x100000000`은 32비트 주소에 담을 수 없으므로 64 KB 영역의 끝 다음 주소를 그대로 SP에 넣지 않았다.

처음에는 GNU ld 문법이 낯설었다. 주소와 크기부터 익숙한 `#define`으로 적고, C 전처리기를 거쳐 최종 `.ld`를 생성하는 방식으로 정리했다. 다음은 사용한 `linker.ld.S`다.

```c
/* 이 파일을 수정하고 gcc -E -P -x c로 linker.ld를 생성한다. */
#define RAM_START  0xFFFF0000
#define RAM_SIZE   60K
#define STACK_TOP  0xFFFFFFF8

ENTRY(_start)

MEMORY
{
    OCRAM (rwx) : ORIGIN = RAM_START, LENGTH = RAM_SIZE
}

/* OCRAM의 위쪽 4 KB는 스택용으로 남겨둔다. 스택은 아래로 자란다. */
__stack_bottom = ORIGIN(OCRAM) + LENGTH(OCRAM);
__stack_top = STACK_TOP;

SECTIONS
{
    /* startup.S의 시작 코드를 맨 앞에 배치한다. */
    .text :
    {
        KEEP(*(.text.start))
        *(.text*)
    } > OCRAM

    /* 문자열과 고정 설정값 */
    .rodata :
    {
        *(.rodata*)
    } > OCRAM

    /* 초기값 있는 전역변수. JTAG가 초기값까지 RAM에 올린다. */
    .data :
    {
        *(.data*)
    } > OCRAM

    /* ELF에 초기값을 담지 않고, startup.S에서 이 범위를 0으로 만든다. */
    .bss (NOLOAD) :
    {
        . = ALIGN(4);
        __bss_start = .;
        *(.bss*)
        *(COMMON)
        . = ALIGN(4);
        __bss_end = .;
    } > OCRAM
}
```

각 부분은 다음 의미다.

- `ENTRY(_start)`는 ELF의 진입점으로 `_start` 심볼을 지정한다. 이것만으로 CPU가 실행되지는 않으며, 나중에 디버거가 실행 위치를 정한다.
- `MEMORY`는 사용할 메모리의 시작 주소와 크기를 알려준다. `(rwx)`는 링커의 영역 선택에 쓰는 속성이고, CPU의 MMU 권한을 설정하는 명령은 아니다.
- `KEEP(*(.text.start))`는 시작 코드를 먼저 모으고, 섹션 제거 옵션을 쓰더라도 보존하도록 지정한다.
- `*(.text*)`는 입력 파일들의 `.text`로 시작하는 섹션을 모은다. `> OCRAM`은 그 결과를 OCRAM 영역에 놓으라는 뜻이다.
- `__bss_start`, `__bss_end`, `__stack_top`은 시작 코드가 사용할 주소 심볼이다. 실제 변수에 값을 저장한 것이 아니라 링커가 주소에 이름을 붙인 것이다.
- `.bss (NOLOAD)`는 파일에서 초기값을 전송할 섹션으로 다루지 않는다. 프로그램이 사용할 공간과 초기화 경계는 링커가 잡고, 0을 쓰는 일은 시작 코드가 한다.

`MEMORY`와 영역 속성의 의미는 [GNU ld 문서](https://sourceware.org/binutils/docs/ld/MEMORY.html), 진입점은 [ENTRY 설명](https://sourceware.org/binutils/docs/ld/Entry-Point.html), `NOLOAD`는 [섹션 타입 설명](https://sourceware.org/binutils/docs/ld/Output-Section-Type.html)에서 확인했다.

생성 명령은 다음과 같다. 이후 명령은 모두 `~/project/bootloader` 폴더를 기준으로 실행했다.

```bash
cd ~/project/bootloader
gcc -E -P -x c linker.ld.S -o linker.ld
```

`-E`는 전처리만 수행하고, `-P`는 전처리 결과의 줄 번호 표시를 제거한다. `-x c`는 입력을 C 전처리 대상으로 해석하도록 한다. 여기서는 `RAM_START` 같은 매크로를 치환하는 것이므로 PC용 `gcc`를 사용해도 된다. ARM 실행 코드는 별도의 `arm-none-eabi-gcc`로 빌드한다.

이 과정이 C 함수에서 링커 스크립트로의 변환은 아니다. 매크로는 C 전처리기가 처리하고, `MEMORY`와 `SECTIONS`는 여전히 GNU ld 문법이다. 원본은 `linker.ld.S`이므로 메모리 설정을 바꿀 때도 원본을 수정하고 다시 생성한다.

### main 이전에 실행되는 startup.S

운영체제 위에서 C 프로그램을 만들 때는 보통 `main()`부터 생각한다. 이번에는 그 전에 사용할 스택과 전역변수 상태를 직접 준비해야 했다. `_start`가 그 일을 수행하는 시작점이다.

사용한 시작 코드는 다음과 같다.

```asm
.syntax unified
.cpu cortex-a9
.arm

/* linker.ld에서 이 영역을 OCRAM 맨 앞에 배치한다. */
.section .text.start, "ax", %progbits
.balign 4
.global _start
.type _start, %function

/*
 * JTAG가 ELF의 코드와 .data를 RAM에 올린 뒤 이 위치부터 실행한다.
 * CPU0의 privileged ARM 상태, MMU/D-cache가 꺼진 상태에서 진입한다.
 */
_start:
    cpsid if                  @ IRQ/FIQ 차단: 아직 예외 처리는 준비하지 않음
    cps #0x13                 @ Supervisor 모드로 전환
    ldr sp, =__stack_top       @ 링커가 정한 스택 위치 설정

    ldr r0, =__bss_start       @ 초기값 없는 전역변수 영역의 시작
    ldr r1, =__bss_end         @ 영역의 끝: 이 주소 직전까지만 초기화
    mov r2, #0                @ 메모리에 기록할 값

clear_bss:
    cmp r0, r1                @ 시작과 끝 비교
    bhs call_main             @ r0 >= r1이면 초기화 완료 (빈 영역도 처리)
    str r2, [r0], #4          @ 4바이트를 0으로 쓰고 다음 주소로 이동
    b clear_bss

call_main:
    bl main                   @ 스택과 전역변수 준비 후 C 코드 실행

halt:
    b halt                    @ main이 반환하면 여기서 계속 대기

.size _start, . - _start
.ltorg
```

먼저 `.arm`으로 ARM 명령어를 생성하도록 하고, `.text.start` 섹션에 시작 코드를 넣었다. 이 섹션 이름은 링커의 `KEEP(*(.text.start))`와 맞아야 한다.

`cpsid if`로 IRQ와 FIQ를 차단하고, `cps #0x13`으로 Supervisor 모드를 선택한다. 아직 인터럽트 핸들러와 예외 벡터를 마련하지 않았기 때문에 초기 단계에서는 IRQ/FIQ를 받지 않는 구성이다. 모든 종류의 예외를 처리할 수 있는 코드가 완성됐다는 뜻은 아니다.

다음으로 `ldr sp, =__stack_top`이 스택 위치를 설정한다. C 함수는 복귀 주소나 지역변수 등을 스택에 저장할 수 있다. 따라서 `main()`에 도착해서 스택을 설정하려 하면 이미 늦을 수 있다.

BSS 초기화에서는 시작 주소를 R0, 끝 주소를 R1에 넣고, R2에 0을 넣었다. `str r2, [r0], #4`는 현재 R0 주소에 4바이트의 0을 쓴 뒤 R0를 4 증가시킨다. `r0 >= r1`이 되면 초기화를 끝낸다. 링커에서 시작과 끝을 4바이트 정렬한 이유도 이 반복문과 맞추기 위해서다.

현재 프로그램은 BSS에 들어가는 전역·정적 변수가 없어서 `__bss_start`와 `__bss_end`가 같다. 실제로 메모리를 지우는 반복문은 실행되지 않고 바로 다음 단계로 간다. 이후 `int result;` 같은 변수를 추가하면 이 범위가 늘어나고 같은 코드가 초기화하게 된다.

마지막으로 `bl main`이 C 코드로 제어를 넘긴다. `main()`이 반환하면 `halt`에서 대기한다. 이번 프로그램의 `main()`도 끝에서 무한 반복하기 때문에 정상 경로에서는 돌아오지 않는다.

`.data`의 초기값은 ELF를 통해 JTAG가 RAM에 직접 올린다. 현재는 실행 주소와 로드 주소가 같은 RAM 배치이므로, ROM의 초기값을 RAM으로 복사하는 코드는 넣지 않았다. 플래시에서 부팅하도록 바꾸면 초기값의 저장 위치와 실행 위치를 다시 설계해야 한다.

## 하드웨어 초기화

### 초기화하는 장치와 설정

하드웨어 초기화라고 해서 보드의 모든 기능을 한꺼번에 설정한 것은 아니다. 내부 RAM에서 C 코드를 실행하고 UART로 출력하는 데 필요한 경로부터 준비했다.

```text
시작 코드에서 스택과 BSS 준비
  → CPU 실행 상태 확인
  → 클럭의 Safe Mode 확인
  → L4 watchdog 정지, UART0 리셋 유지
  → UART 핀의 I/O bank 설정
  → 핀 기능을 UART RX/TX로 선택하고 freeze 해제
  → UART0 리셋 해제
  → UART 문자 형식과 속도 설정
```

외부 DDR 초기화, PLL의 고속 동작 설정, CPU1 실행, MMU 페이지 테이블과 캐시 설정은 이번 단계에 포함하지 않았다. 이 프로그램은 **전원 직후의 알려진 상태에서 CPU0를 JTAG로 제어하는 실습**을 전제로 한다. 이미 리눅스 등이 하드웨어를 바꾼 상태에 같은 코드를 그대로 적용하는 용도는 아니다.

#### CPU 상태와 클럭 확인

`board_init()`은 IRQ/FIQ를 차단하고 CP15의 SCTLR을 읽는다.

```c
__asm__ volatile ("cpsid if" ::: "memory");
__asm__ volatile ("mrc p15, 0, %0, c1, c0, 0" : "=r" (cpu_control));

if ((cpu_control & 0x05u) != 0u || (REG32(CLOCK_CTRL) & 1u) == 0u) {
    return -1;
}
```

`0x05`는 SCTLR의 bit 0과 bit 2를 확인하기 위한 마스크다. bit 0은 MMU 활성화, bit 2는 데이터 캐시 활성화에 관련된다. 코드 중간에서 이를 강제로 끄는 대신, 기대한 시작 상태인지 확인하고 조건이 맞지 않으면 진행하지 않도록 했다. 이 코드는 명령어 캐시까지 모두 초기화하는 루틴은 아니다.

Clock Manager의 제어 레지스터는 `0xFFD04000`이고, bit 0으로 Safe Mode인지 확인한다. Safe Mode에서는 PLL과 프로그램 가능한 분주기의 설정 대신 기본 발진기 경로를 사용한다. 이번에는 이 상태를 유지했다. [Clock Manager Safe Mode의 레지스터 설명](https://docs.rtems.org/doxygen/5.1/alt__clkmgr_8h_source.html)

DE1-SoC의 OSC1 입력은 25 MHz다. 이 값은 [U-Boot의 DE1-SoC 클럭 설정](https://github.com/u-boot/u-boot/blob/master/board/terasic/de1-soc/qts/pll_config.h)에서도 확인할 수 있다. 그래서 이번 코드에서는 UART에 공급되는 `l4_sp_clk`를 25 MHz로 잡았다. UART가 항상 25 MHz라는 뜻은 아니며, PLL과 분주기 설정을 바꾸면 속도 계산도 바뀐다.

#### 리셋과 L4 watchdog

주변장치 리셋 레지스터 `PERMODRST`의 주소는 `0xFFD05014`다. UART0에 해당하는 bit 16은 1이면 리셋 유지, 0이면 리셋 해제다. L4 watchdog 0과 1에 해당하는 bit 6과 bit 7도 1로 두어 이번 실습 중에는 정지 상태를 유지했다.

```c
REG32(PERIPHERAL_RESET) |= (1u << 16) | (1u << 6) | (1u << 7);
board_delay();

uart_pins_init();

REG32(PERIPHERAL_RESET) &= ~(1u << 16);
board_delay();
```

UART를 리셋 상태로 둔 채 핀을 준비하고, 준비가 끝나면 UART 리셋만 해제하는 순서다. `|=`와 `&= ~`를 써서 지정한 비트만 바꾸고 다른 주변장치의 리셋 상태는 유지했다. 여기서 정지한 watchdog은 L4의 두 장치이며, 모든 종류의 watchdog을 다루는 초기화는 아니다.

#### UART 핀의 전기적 설정과 Scan Manager

UART 레지스터에 값을 쓰는 것만으로는 보드 밖으로 신호가 나가지 않을 수 있다. 전원 직후 HPS I/O에는 전기적 설정과 핀 기능 선택이 필요하다. UART가 있는 I/O bank 7A는 scan chain 2를 통해 설정한다.

이 설정은 드라이브 특성 등 핀의 하드웨어 구성을 담는다. 직접 임의의 값을 만들지 않고, [U-Boot의 DE1-SoC용 IOCSR 설정](https://github.com/u-boot/u-boot/blob/master/board/terasic/de1-soc/qts/iocsr_config.h)에서 scan chain 2의 데이터를 가져와 `uart_iocsr.h`에 저장했다. 원본은 BSD-3-Clause 라이선스이며, 출처와 라이선스 표시도 유지했다.

이 보드 설정의 scan chain 2는 955 bits다. 코드에서는 128 bits씩 나누어 전송하므로 128-bit 묶음 일곱 개와 마지막 59-bit 묶음으로 나뉜다. Scan Manager의 헤더에 실제 bit 수를 넣고, 데이터는 32-bit 레지스터 쓰기로 전달한다. 마지막 묶음도 전송 버퍼로는 두 개의 32-bit 값이 필요하지만, 설정 길이는 59 bits로 지정한다.

여기서 사용하는 Scan Manager는 **CPU가 HPS I/O 설정을 적용하는 하드웨어**다. PC에서 USB-Blaster로 ARM을 디버깅하는 외부 JTAG 연결과는 역할이 다르다. 관련 구조는 HPS 매뉴얼의 Scan Manager 장, 읽었던 PDF 405–412쪽에서 확인했다.

#### Freeze와 핀 기능 선택

설정 중 핀이 중간 상태의 신호를 출력하지 않도록 먼저 해당 bank를 freeze한다. 설정을 적용한 뒤 정해진 순서로 thaw하여 핀이 동작하도록 한다.

UART0 RX/TX에는 다음 두 레지스터를 사용했다.

```c
#define UART_RX_MUX 0xFFD08484u
#define UART_TX_MUX 0xFFD08488u

REG32(UART_RX_MUX) = 1u; // GPIO49 위치의 핀 → UART0 RX
REG32(UART_TX_MUX) = 1u; // GPIO50 위치의 핀 → UART0 TX
```

핀을 GPIO로 사용할지 UART로 사용할지 선택하는 설정이다. 핀 주소를 UART 장치 시작 주소와 혼동하지 않아야 한다. UART0 자체는 `0xFFC02000`에 있고, 핀 선택은 System Manager 영역에서 수행한다.

`IO_FREEZE`는 `0xFFD08048`의 VIO 제어 레지스터를 가리킨다. 코드에서는 먼저 slew, pullup, tristate에 관련된 비트를 정리하고, bus hold와 configuration을 freeze 상태로 둔다. 설정 후에는 configuration과 bus hold, pullup과 tristate, slew-rate 순서로 제어를 해제한다.

`board_delay()`는 `dsb sy`로 앞선 메모리 접근의 완료를 기다리고, `nop` 반복으로 설정 사이에 간격을 둔다. 이것은 현재 25 MHz의 단순한 초기 상태에서 사용하는 대기 코드다. 정확한 시간 측정이나 일반적인 타이머 기능을 구현한 것은 아니다.

### UART의 문자 형식과 통신 속도

보드 준비가 끝나면 `uart_init()`에서 UART 레지스터를 설정한다. 이번에 사용한 주소는 다음과 같다.

| 코드 이름 | 주소 | 역할 |
| --- | --- | --- |
| `UART_DATA` | `0xFFC02000` | 송수신 데이터 또는 속도 분주값 하위 바이트 |
| `UART_IER` | `0xFFC02004` | 인터럽트 설정 또는 속도 분주값 상위 바이트 |
| `UART_LCR` | `0xFFC0200C` | 문자 형식과 DLAB 설정 |
| `UART_LSR` | `0xFFC02014` | 송수신 상태 확인 |

같은 주소의 역할이 설정에 따라 달라지는 부분이 중요했다. LCR의 DLAB 비트를 1로 두면 `UART_DATA`와 `UART_IER` 위치에서 속도 분주값에 접근한다. DLAB을 0으로 돌리면 다시 데이터와 인터럽트 설정에 접근한다.

```c
void uart_init(void)
{
    reg_write(UART_LCR, 0x03u); // 8N1 설정
    reg_write(UART_IER, 0u);    // UART 인터럽트 끄기

    reg_write(UART_LCR, 0x83u); // DLAB=1: 분주값 설정
    reg_write(UART_DATA, 27u);  // 분주값 하위 8 bits
    reg_write(UART_IER, 0u);    // 분주값 상위 8 bits
    reg_write(UART_LCR, 0x03u); // DLAB=0: 송수신 레지스터로 복귀

    board_delay();
}
```

`0x03`은 데이터 8 bits, parity 없음, stop bit 1개인 **8N1** 설정이다. `0x83`은 여기에 bit 7인 DLAB을 추가한 값이다. UART 설명과 속도 공식은 HPS 매뉴얼의 UART Controller 장, 읽었던 PDF 2920–2922쪽에 나와 있다.

이 UART의 속도 계산은 다음과 같다.

```text
baud = UART 입력 클럭 / (16 × 분주값)

목표 분주값 = 25,000,000 / (16 × 57,600)
            ≈ 27.1267

사용한 정수 분주값 = 27
실제 baud ≈ 25,000,000 / (16 × 27)
          ≈ 57,870.37
목표 57,600 대비 오차 ≈ +0.47%
```

따라서 코드에서 27을 쓴 것은 임의의 설정이 아니다. 현재 클럭에서 57600 baud에 가까운 정수 분주값이다. PC 터미널도 57600 baud로 맞췄고 실제 문자열 출력을 확인했다. 클럭이 바뀌면 이 숫자를 그대로 사용할 수 없다.

### 문자 한 개를 보내는 코드

UART 송신에서는 LSR의 bit 5를 확인한다. 이 비트가 1이면 송신 holding register에 다음 문자를 쓸 수 있다.

```c
static void uart_putc(char ch)
{
    while ((reg_read(UART_LSR) & (1u << 5)) == 0u) {
    }
    reg_write(UART_DATA, (uint32_t)(unsigned char)ch);
}
```

`1u << 5`는 bit 5만 검사하는 마스크다. 상태 레지스터와 AND 연산을 해 결과가 0이면 아직 준비되지 않은 것이므로 기다린다. 준비되면 문자의 바이트 값을 송신 레지스터에 쓴다.

예를 들어 `uart_putc('A')`를 호출하면 준비 상태를 기다린 뒤 `'A'`의 값인 `0x41`을 쓴다. UART 하드웨어가 이 값을 직렬 신호로 변환해 전송한다. 데이터 레지스터에 썼다는 것과 마지막 stop bit까지 선로에서 전송이 끝났다는 것은 같은 시점이 아니다.

이렇게 상태를 직접 반복해서 확인하는 방식이 폴링이다. 코드는 단순하지만 기다리는 동안 CPU가 계속 실행한다. 현재는 학습용 최소 코드여서 송신과 scan 대기에 타임아웃을 넣지 않았다. 장치가 준비되지 않으면 반복문에서 계속 머무를 수 있다.

문자열 출력은 이 함수를 반복해서 호출한다.

```c
static void uart_puts(const char *text)
{
    while (*text != '\0') {
        uart_putc(*text++);
    }
}
```

최종 `main()`의 흐름은 단순하다.

```c
int main(void)
{
    if (board_init() != 0) {
        while (1) {
        }
    }

    uart_init();
    uart_puts("Bootloader ready\r\n");

    while (1) {
    }
}
```

먼저 보드 초기화 조건을 확인하고 필요한 핀을 준비한다. 성공하면 UART 속도를 설정하고 문자열을 보낸다. `\r\n`은 줄바꿈 후 다음 줄의 처음으로 이동하도록 넣은 문자다. 출력 후에는 다음 프로그램이 아직 없으므로 대기한다.

## ELF 빌드

### ARM용 빌드와 ELF

우분투 PC에서 실행하는 일반 프로그램과 보드의 ARM에서 실행할 프로그램은 대상 CPU가 다르다. 그래서 실행 코드는 `arm-none-eabi-gcc`로 빌드했다.

```text
startup.S + main.c + board.c
          ↓ ARM용 어셈블·컴파일
       코드와 데이터
          + linker.ld의 배치 규칙
          ↓ 링크
       bootloader.elf
```

ELF는 Executable and Linkable Format의 약자다. 코드와 데이터뿐 아니라 섹션 정보, 진입점, 심볼, 디버깅 정보 등을 담을 수 있는 파일 형식이다. 실행을 위해 메모리에 배치할 정보와, GDB에서 함수 이름이나 소스 줄을 보여주기 위한 정보가 함께 들어간다. ARM용 ELF 규약은 [Arm ELF ABI 문서](https://github.com/ARM-software/abi-aa/blob/main/aaelf32/aaelf32.rst)에 설명돼 있다.

빌드 명령은 다음과 같았다.

```bash
arm-none-eabi-gcc \
    -mcpu=cortex-a9 -marm -O0 -g \
    -ffreestanding -fno-unwind-tables -fno-asynchronous-unwind-tables \
    -nostdlib -Wall -Wextra -Werror \
    -Wl,--build-id=none -T linker.ld \
    startup.S main.c board.c \
    -o bootloader.elf
```

| 옵션 | 이 실습에서의 목적 |
| --- | --- |
| `-mcpu=cortex-a9` | 대상 CPU 지정 |
| `-marm` | ARM 명령어 상태의 코드 생성 |
| `-O0` | 소스 흐름을 따라가기 쉽도록 최적화하지 않음 |
| `-g` | 함수와 소스 줄을 추적할 디버깅 정보 포함 |
| `-ffreestanding` | 일반적인 OS 프로그램 실행 환경을 전제하지 않음 |
| `-nostdlib` | 기본 시작 파일과 표준 라이브러리를 자동으로 연결하지 않음 |
| `-T linker.ld` | 우리가 작성한 메모리 배치 규칙 사용 |
| `-Wall -Wextra -Werror` | 경고를 확인하고 경고가 있으면 빌드를 실패시킴 |

`-fno-unwind-tables`와 `-fno-asynchronous-unwind-tables`는 런타임 unwind 테이블 생성을 억제한다. `-Wl,--build-id=none`은 링커에 build-id를 만들지 않도록 전달한다. `-nostdlib`에서는 코드가 라이브러리 함수나 컴파일러 보조 함수를 요구하는지 확인해야 한다. 현재 코드는 표준 라이브러리 없이 링크됐다. [GCC 링크 옵션 설명](https://gcc.gnu.org/onlinedocs/gcc/Link-Options.html)

결과는 다음 명령으로 확인할 수 있다.

```bash
arm-none-eabi-readelf -h bootloader.elf
arm-none-eabi-readelf -S bootloader.elf
arm-none-eabi-size bootloader.elf
arm-none-eabi-nm -n bootloader.elf
```

실습 당시 ELF의 주요 값은 다음과 같았다.

```text
Machine:             ARM
Entry point address: 0xffff0000

.text   주소 0xffff0000, 크기 0x4e4
.rodata 주소 0xffff04e4, 크기 0x08c
.bss    주소 0xffff0570, 크기 0

_start         0xffff0000
main           0xffff01b8
__bss_start    0xffff0570
__bss_end      0xffff0570
__stack_bottom 0xfffff000
__stack_top    0xfffffff8
```

현재 RAM에 올릴 코드와 읽기 전용 데이터의 합은 `0x4e4 + 0x8c = 1392 bytes`였다. ELF 파일 전체의 크기는 이보다 크다. 디버깅 정보와 심볼처럼 보드의 실행 메모리에 올리지 않는 내용도 파일에 포함되기 때문이다. 소스를 수정하면 코드 크기와 `main` 등의 주소도 달라질 수 있다.

### execute.sh로 명령 모으기

단계가 추가될 때마다 명령을 따로 기억하지 않도록 `execute.sh`에 모았다. 현재 사용 방식은 세 가지다.

```bash
./execute.sh           # 링커 파일 생성과 ARM 빌드
./execute.sh jtag      # 빌드 후 JTAG 서버 실행
sudo ./execute.sh uart # UART 출력 보기
```

스크립트는 자신의 위치로 먼저 이동하므로 실행한 폴더와 상관없이 소스 파일을 찾는다. UART 모드에서는 실행 중인 프로그램의 출력을 읽기만 하고 다시 빌드하지 않는다. JTAG 모드의 `exec`는 스크립트 프로세스를 OpenOCD로 바꿔 서버를 유지한다.

이 시점에는 GDB의 업로드와 실행 명령을 스크립트에 자동화하지 않았다. CPU를 언제 멈추고 언제 실행하는지 이해하기 위해 GDB에서는 수동으로 진행했다.

## JTAG 업로드

### JTAG 장치 확인과 OpenOCD 설정

`jtagconfig`로 보드의 실제 체인을 확인했다.

```bash
jtagconfig
```

```text
1) DE-SoC [1-3]
  4BA00477   SOCVHPS
  02D120DD   5CSE(BA5|MA5)/5CSTFD5D5/..
```

하나의 JTAG 체인에 HPS와 FPGA가 함께 보였다. 연결할 CPU를 구분하려면 이 장치 ID와 체인 구성이 필요했다.

이번 PC에는 Quartus에 포함된 OpenOCD가 설치돼 있었다. 버전 표시는 `0.11.0-R22.4`였고, 사용 가능한 어댑터는 `aji_client`였다. 일반 OpenOCD 예제의 `usb_blaster` 설정을 그대로 사용하는 대신, 이미 설치된 Quartus JTAG 서버에 접속하는 방식으로 구성했다. AJI는 Advanced JTAG Interface이며 [Intel의 AJI 클라이언트 라이브러리](https://github.com/intel/libaji_client)가 해당 서버 접근을 설명한다.

사용한 `jtag.cfg`는 다음과 같다.

```tcl
# DE1-SoC: Quartus에 포함된 OpenOCD와 JTAG 서버 사용.
adapter driver aji_client
reset_config none

# jtagconfig로 확인한 체인 순서와 장치 ID.
jtag newtap de1soc cpu -irlen 4 -expected-id 0x4BA00477
jtag newtap de1soc fpga -irlen 10 -expected-id 0x02D120DD

# ARM Cortex-A9의 CPU0만 연결한다. CPU1은 아직 사용하지 않는다.
dap create de1soc.dap -chain-position de1soc.cpu
target create de1soc.cpu0 cortex_a -dap de1soc.dap \
    -coreid 0 -dbgbase 0x80110000

# PC 안에서 GDB가 연결할 주소: 127.0.0.1:3333
bindto 127.0.0.1
gdb_port 3333
tcl_port disabled
telnet_port disabled
```

`jtag newtap`은 체인에서 HPS와 FPGA 장치를 선언하고 기대하는 ID를 지정한다. `dap create`는 ARM Debug Access Port를 구성하고, `target create`는 디버깅 대상인 CPU0를 만든다. CPU1은 이번 대상에 넣지 않았다. `0x80110000`은 이 Cortex-A9 코어의 디버그 인터페이스 기준 주소이며, 프로그램을 저장할 OCRAM 주소와는 다른 용도다.

서버는 다음 명령으로 켰다.

```bash
cd ~/project/bootloader
./execute.sh jtag
```

OpenOCD에서 CPU0의 하드웨어 breakpoint와 watchpoint 수가 인식됐고, 마지막에 다음 메시지가 나왔다.

```text
Info : de1soc.cpu0: hardware has 6 breakpoints, 4 watchpoints
Info : Listening on port 3333 for gdb connections
```

이 상태는 GDB가 연결할 준비가 됐다는 뜻이다. 아직 부트로더가 실행됐다는 뜻은 아니다. OpenOCD 터미널은 켜둔 채 다른 터미널에서 GDB를 실행했다.

### GDB로 업로드하고 main까지 실행하기

다른 터미널에서 ELF를 지정해 GDB를 열었다.

```bash
cd ~/project/bootloader
gdb-multiarch bootloader.elf
```

GDB에서 OpenOCD에 접속했다.

```gdb
target remote localhost:3333
```

처음에는 다음처럼 보였다.

```text
Remote debugging using localhost:3333
0x00002fa8 in ?? ()
```

이때는 CPU에 연결된 상태였다. `??`는 현재 주소에 대응하는 이름과 소스 정보가 GDB의 사용자 ELF에 없다는 의미다. 연결됐다는 사실만으로 우리가 만든 부트로더가 업로드되거나 실행된 것은 아니다.

실제 업로드와 시작 코드 실행은 다음 명령으로 진행했다.

```gdb
monitor halt
load
set $cpsr = ($cpsr & ~0x20)
set $pc = &_start
tbreak main
continue
```

| 명령 | 수행하는 일 |
| --- | --- |
| `monitor halt` | OpenOCD에 CPU 정지를 요청 |
| `load` | ELF에 기록된 로드 주소로 코드와 데이터 전송 |
| `set $cpsr = ($cpsr & ~0x20)` | CPSR의 T bit를 0으로 하여 ARM 명령어 상태 선택 |
| `set $pc = &_start` | 시작 코드의 주소를 실행 위치로 지정 |
| `tbreak main` | `main()`에 한 번만 멈추는 breakpoint 설정 |
| `continue` | CPU 실행 재개 |

`load`가 주소를 정하는 것은 파일의 배치 정보를 이용한 동작이다. 소스 파일을 그대로 보드에 복사하는 명령이 아니다. [GDB target와 load 설명](https://sourceware.org/gdb/current/onlinedocs/gdb.html/Target-Commands.html)

실제 다운로드 로그는 다음과 같았다.

```text
Loading section .text, size 0x4e4 lma 0xffff0000
Loading section .rodata, size 0x8c lma 0xffff04e4
Start address 0xffff0000, load size 1392
Transfer rate: 17 KB/sec, 696 bytes/write.
```

링커가 지정한 OCRAM 주소에 코드와 읽기 전용 데이터가 올라갔다. 여기서의 전송률은 이 실행에서 나온 로그 값이며, 보드나 UART의 최대 성능을 측정한 결과는 아니다.

`continue` 후에는 `main()`의 첫 조건문에서 멈췄다.

```text
Temporary breakpoint 1, main () at main.c:59
59          if (board_init() != 0) {
```

![그림 1. 시작 코드를 거쳐 main에 도착한 GDB 화면과 CPU 레지스터](/assets/images/2026-10-11/de1-soc/gdb-main-registers.png)

이 화면에서 레지스터도 확인했다.

```gdb
info registers pc cpsr sp
```

```text
pc    0xffff01c0   0xffff01c0 <main+8>
cpsr  0x600001d3
sp    0xfffffff0
```

PC는 `main` 함수 안에 있었다. 초기 SP는 `0xFFFFFFF8`로 정했는데, `main()`의 진입 코드가 8바이트를 스택에 저장하면서 SP가 `0xFFFFFFF0`이 됐다. 스택 공간 안의 정렬된 주소였다.

CPSR의 낮은 값에서 실행 모드는 `0x13`, 즉 Supervisor였다. T bit는 0이어서 ARM 상태였고, IRQ/FIQ 마스크도 설정돼 있었다. N/Z/C/V 같은 비교 플래그까지 특정 값으로 맞춰야 한다는 뜻은 아니다. 이 기록에서는 실행 모드와 스택이 기대한 상태인지 확인하는 데 사용했다. [GDB의 ARM 실행 모드 설명](https://sourceware.org/gdb/current/onlinedocs/gdb.html/ARM.html)

이 중단점에 도착한 것으로 **시작 코드가 실행되어 C 함수에 진입했다는 것**을 확인했다. 아직 조건문의 `board_init()`은 실행 전이므로 UART 초기화 성공까지 확인한 상태는 아니었다.

## 실행 확인

### DAP WAIT와 data abort 로그를 어떻게 읽었나

CPSR를 설정하는 시점에는 다음 로그가 반복해서 나왔다.

```text
Info : DAP transaction stalled (WAIT) - slowing down
Error: data abort at 0xfffefffe, dfsr = 0x00001008
Error: data abort at 0xfffefffc, dfsr = 0x00001008
```

![그림 2. 디버깅 중 관찰한 DAP WAIT와 data abort 로그](/assets/images/2026-10-11/de1-soc/jtag-data-abort.png)

처음에는 부트로더가 실행 중 잘못된 주소를 접근한 것인지 헷갈렸다. 하지만 오류 뒤에 `main()` breakpoint에 도착했고, PC와 SP도 기대한 범위에 있었다. 이후에는 UART 문자열 출력까지 확인했다. 따라서 이 로그만으로 사용자 코드의 실행이 실패했다고 결론 내릴 수는 없었다.

오류에 나온 `0xFFFEFFFC`와 `0xFFFEFFFE`는 OCRAM 시작인 `0xFFFF0000` 바로 앞이다. 이 주소는 코드 RAM이 아니라 L2 캐시 컨트롤러의 주소 영역에 속한다. 연속된 프로그램 바이트처럼 임의로 읽어도 되는 공간은 아니다.

이 메시지는 [OpenOCD의 Cortex-A 메모리 접근 처리](https://github.com/openocd-org/openocd/blob/v0.11.0/src/target/cortex_a.c)에서 data fault를 보고할 때 출력된다. 디버거가 ARM/Thumb 상태나 실행 문맥을 확인하면서 주변 메모리를 조회했을 가능성을 생각했지만, **어떤 조회가 이 주소를 읽었는지는 아직 확정하지 않았다.** 원인을 수정했다고 기록할 단계도 아니다.

`DAP WAIT`는 해당 디버그 접근에서 대기 응답이 관찰됐다는 정보이고, 이 실행에서는 재시도 후 CPU를 인식하고 `main()`까지 진행했다. 이후 정상 진행이 보였다는 근거와 오류 자체를 함께 남겼다. 같은 오류가 계속 발생하거나 진입점에 도달하지 못한다면 메모리 맵, 실행 모드, 디버거의 요청과 CPU fault 상태를 더 확인해야 한다.

스크린샷에는 `target extended-remote :3333`을 선호한다는 경고도 있다. 이 실습에서 실제로 사용한 접속 명령은 `target remote localhost:3333`이었다. 접속 방식 권고와 data abort의 원인은 구분해서 보며, 접속 명령만 바꾸면 오류가 해결된다고 단정하지 않았다.

### UART 터미널에서 출력 확인하기

문자열은 한 번만 출력하므로, GDB에서 하드웨어 초기화를 진행하기 전에 UART 터미널을 열었다. 터미널 구성은 다음과 같았다.

| 터미널 | 실행 내용 |
| --- | --- |
| 첫 번째 | `./execute.sh jtag`로 OpenOCD 유지 |
| 두 번째 | `sudo ./execute.sh uart`로 UART 출력 읽기 |
| 세 번째 | GDB에서 업로드와 실행 제어 |

UART 출력은 다음 명령으로 열었다.

```bash
cd ~/project/bootloader
sudo ./execute.sh uart
```

내 PC의 `/dev/ttyUSB0`는 접근 권한이 제한돼 있어 `sudo`를 사용했다. 스크립트가 실제로 수행하는 설정과 읽기는 다음과 같다.

```bash
stty -F /dev/ttyUSB0 57600 raw -echo cs8 -parenb -cstopb \
    -ixon -ixoff -crtscts clocal
cat /dev/ttyUSB0
```

`stty`는 PC 쪽 직렬 포트를 57600 baud, 8N1로 설정한다. `raw`로 줄 단위 가공을 줄이고, 로컬 echo와 소프트웨어·하드웨어 흐름 제어를 끈다. `cat`은 들어오는 바이트를 화면에 표시한다. 이 단계에서는 보드로 요청을 보내는 기능을 사용하지 않았다.

그 뒤 `main()`에 멈춘 GDB 터미널에서 실행을 재개했다.

```gdb
continue
```

UART 터미널에 다음 결과가 나타났다.

```text
root@home:/home/doogunwo/project/bootloader# sudo ./execute.sh uart
UART 출력 대기: /dev/ttyUSB0, 57600 baud, 8N1 (종료: Ctrl+C)
Bootloader ready
```

![그림 3. 실제 보드에서 UART로 받은 Bootloader ready 문자열](/assets/images/2026-10-11/de1-soc/uart-bootloader-ready.png)

화면의 첫 번째 안내 문구인 `UART 출력 대기`는 **PC의 셸 스크립트가 출력한 것**이다. 두 번째 줄의 `Bootloader ready`는 **ARM에서 실행된 C 코드가 UART로 보낸 것**이다. 둘을 구분해야 장치에서 실제로 나온 결과인지 알 수 있다.

내 프로그램이 JTAG로 올라가 시작 코드를 실행했고, `main()`에서 보드와 UART 설정을 거쳐 PC로 문자열을 보냈다는 것이 이번 실습의 결과다.

### 이번 실습에서 확인한 것과 다음 단계

이번에 실제로 확인한 경로는 다음과 같다.

```text
ARM용 빌드와 ELF 생성
 → JTAG로 OCRAM에 업로드
 → _start에서 스택과 BSS 준비
 → main에 도착
 → 보드 I/O와 UART0 초기화
 → UART 송신
 → PC에서 Bootloader ready 확인
```

가장 크게 배운 것은 C 함수의 내용만 작성한다고 보드에서 바로 실행되는 것이 아니라는 점이었다. 코드가 놓일 메모리, 첫 실행 주소, 스택, 주변장치의 리셋과 핀 상태, PC 쪽 연결 도구까지 서로 맞아야 했다.

현재 결과는 UART **송신 경로**를 확인한 것이다. RX 핀을 설정했더라도 수신 기능을 실제로 시험한 것은 아니다. 외부 DDR, 인터럽트 처리, 펌웨어 다운로드와 실행도 이후 단계다. 현재 대기 코드는 계속 반복하는 구조여서 타임아웃과 오류 진단도 다음 개선 대상으로 남아 있다.

다음에는 PC에서 문자 하나를 보내고 부트로더가 그 문자를 받아 그대로 돌려주는 echo부터 구현할 생각이다. 송수신이 확인되면 펌웨어 길이, 데이터 전송, 수신 완료 응답, 실행 요청 같은 간단한 규칙을 정할 수 있다.

```text
PC가 문자 A 전송 → 부트로더가 A 수신 → PC에 A 응답

그다음 단계
PC가 펌웨어 전송 → 부트로더가 저장 → 수신 검증 → 실행
```

이번 글과 같은 시점의 [실습 소스 다운로드](/assets/downloads/de1-soc-bootloader-practice.zip)에는 `main.c`, `board.c`, IOCSR 설정, 시작 코드, 링커 원본과 생성 결과, JTAG 설정, 실행 스크립트를 넣었다. `execute.sh`의 기본 Quartus 경로는 내 우분투 환경에 맞춰져 있으며, 다른 설치 위치에서는 `QUARTUS_ROOTDIR`을 지정해 사용한다.

### 참고한 문서

- [Terasic DE1-SoC 공식 사양](https://www.terasic.com.tw/cgi-bin/page/archive.pl?CategoryNo=165&Language=Taiwan&No=836&PartNo=2)
- [Cyclone V HPS Technical Reference Manual](https://docs.altera.com/r/docs/683126/current)
- [실습에서 읽은 2014년판 HPS 매뉴얼 사본](https://www.scs.stanford.edu/~zyedidia/docs/visionfive/cv_5_HPS_tech_ref.pdf)
- [Arm Cortex-A9 Technical Reference Manual](https://documentation-service.arm.com/static/5f0370fccafe527e86f5bfb2?token=)
- [GNU ld 링커 스크립트 문서](https://sourceware.org/binutils/docs/ld/Scripts.html)
- [GDB 원격 디버깅 문서](https://sourceware.org/gdb/current/onlinedocs/gdb.html/Remote-Debugging.html)
- [U-Boot의 DE1-SoC 보드 설정](https://github.com/u-boot/u-boot/tree/master/board/terasic/de1-soc/qts)

메모리 주소와 레지스터 비트는 보드 이름만 보고 추측하지 않고 SoC 매뉴얼과 해당 보드 설정을 확인했다. 특히 이번에 다운로드한 PDF의 페이지 번호는 2014년판을 기준으로 하므로 최신 웹 문서의 장 번호와 다를 수 있다.
