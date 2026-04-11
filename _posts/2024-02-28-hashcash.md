---
title: "해시캐시 Hashcash : 비트코인의 POW의 기반"
layout: post
categories:
  - writing
  - blockchain
tags:
  - 논문리뷰
thumbnail: https://velog.velcdn.com/images/doogunwo/post/bbebe60d-431b-47ae-8dde-c237def60d6d/image.png
---
### 비트코인

> Proof of Work

비트코인은 "해시캐시" 라는 기술을 사용하여 작업 증명을 통해 네트워크에서의 합의를 통해 트랜잭션을 인증하고 체인에 새 블록을 생성하는 합의 메커니즘 중 하나이다.

그러나, 이 Hashcash라는 기술은 원래 비트코인을 위한 기술이 아니었다.

ref 1) https://en.wikipedia.org/wiki/Hashcash

기존에는

>Hashcash는 이메일 스팸 및 서비스 거부 공격을 제한하는 데 사용되는 작업 증명 시스템 입니다 . Hashcash는 1997년 Adam Back  에 의해 제안되었으며 Back의 2002년 논문 "Hashcash - 서비스 거부 대응책"에서 더 공식적으로 설명되었습니다.  Hashcash에서 클라이언트는 임의의 숫자를 문자열과 여러 번 연결하고 이 새 문자열을 해시해야 합니다. 그런 다음 특정 양의 0으로 시작하는 해시가 발견될 때까지 계속해서 이를 수행해야 합니다.

다음 설명과 같이, 이메일 스팸 및 서비스 거부 공격을 제한하는 방식으로 

> 계산을 위해 선택 가능한 작업량이 필요하지만 증명을 효율적으로 확인할 수 있는 암호화 해시 기반 작업 증명 알고리즘

을 목표로 구현되었다. 무차별 대입을 통해 자원을 소모하는 과정을 증명하는 사용자는 스팸 발송자가 아닐 것이라는 생각으로 만들어졌다.

결국 해당 기술은 비트코인에서 사용되어 많은 자원을 소모하도록 결과를 초래했다.

### 실험

비트코인의 작업 증명은 많은 자원을 소모하는 과정이라는 점을 쉽게 확인할 수 있다. 소스코드를 작성해 Nonce 값에 따라 시간 소요 차이를 확인해본다.

```cpp
#include <iostream>
#include <string>
#include <openssl/sha.h>
#include <ctime>
#include <sstream>

std::string calculateHash(const std::string& input){
    unsigned char hash[SHA256_DIGEST_LENGTH];
    SHA256_CTX sha256;

    SHA256_Init(&sha256);
    SHA256_Update(&sha256, input.c_str(), input.length());
    SHA256_Final(hash, &sha256);

    std::stringstream ss;
    for(int i=0; i<SHA256_DIGEST_LENGTH; i++){
        ss << std::hex << (int)hash[i];

    }

    return ss.str();
}

std::string generateHashcash(const std::string& prefix, int difficulty) {
    std::string hash;
    int nonce = 213;
    while (true) {
        std::string candidate = prefix + std::to_string(nonce);
        hash = calculateHash(candidate);
        
        // Check if hash meets the required difficulty
        bool valid = true;
        for (int i = 0; i < difficulty; ++i) {
            if (hash[i] != '0') {
                valid = false;
                break;
            }
        }
        if (valid) {
            break;
        }
        ++nonce;
    }
    return hash;
}

int main() {
    clock_t start, finish;
    double duration;

    start = clock();

    std::string prefix = "example@domain.com:12345:";
    int difficulty = 3;
    std::string hashcash = generateHashcash(prefix, difficulty);
    std::cout << "Hashcash: " << hashcash << std::endl;

    finish = clock();
    duration = (double) (finish - start)/CLOCKS_PER_SEC;
    std::cout << duration << "s" << std::endl;
    return 0;
}//g++ -o pow ProofOfWork.cpp -lssl -lcrypto

```


이 코드는 Hashcash의 개념을 사용하여 특정 prefix와 난이도(difficulty)에 해당하는 해시를 생성한다. 여기서 prefix는 일반적으로 이메일 주소와 포트 번호와 같은 정보를 나타내며, difficulty는 원하는 해시값의 선행 0의 개수를 의미한다.

calculateHash: 입력된 문자열을 SHA-256 해시 함수를 사용하여 해싱하는데, 이 함수는 OpenSSL 라이브러리를 사용하여 구현되었다.

generateHashcash: 주어진 prefix와 difficulty를 바탕으로 해시값을 생성하고 이 함수에서는 nonce 값을 조정하여 원하는 difficulty를 만족하는 해시값을 찾는다.

main: 프로그램의 진입점이다. 여기서는 prefix와 difficulty를 설정하고 generateHashcash 함수를 호출해 해시캐시 값을 생성한다. 생성된 해시캐시 값을 출력한다.

![](https://velog.velcdn.com/images/doogunwo/post/bbebe60d-431b-47ae-8dde-c237def60d6d/image.png)

최종결과는 다음과 같다.

중간결과를 계속 출력하도록 하면 

![](https://velog.velcdn.com/images/doogunwo/post/e855347c-5399-4b1b-9bc3-7f32984034db/image.png)

연산이 이루어지는 것을 확인할 수 있다.
