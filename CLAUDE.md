# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

EduHub: 사내 교육과정 조회·수강 신청 시스템. 임직원(수강생)과 교육 담당자(관리자)가 사용한다.
요구사항·결정 사항의 기준 문서는 `docs/requirements.md`다(FR-xx, NFR-xx, D-xx). 동작을 바꾸기 전에 읽고, 커밋과 코드에서는 해당 ID로 참조한다.

## 디렉터리 지도

| 경로 | 내용 | 세부 지침 |
|---|---|---|
| `backend/` | Java 8, Spring Boot 2.7, Gradle 7.6(Kotlin DSL, 래퍼 포함) | `backend/CLAUDE.md` |
| `frontend/` | React 18 + TypeScript, MUI, Axios, Module Federation(`shell`, `course-mfe`, `enrollment-mfe`), npm workspaces. 아직 코드 없음 | `frontend/CLAUDE.md` |
| `docs/` | 요구사항·결정 사항 | — |
| `.env.example` | 필요한 환경 변수 이름(값 없음) | — |

## 실행 명령

```bash
cd backend && ./gradlew test            # 테스트 (포맷 검사 포함은 ./gradlew check)
cd backend && ./gradlew spotlessApply   # 포맷 적용
cd backend && ./gradlew bootRun         # 실행 (dev 프로필, .env.example의 DB 변수 필요)
```

프론트엔드 명령은 설정이 추가되고 동작을 확인한 뒤에 적는다. 그 전에는 명령을 추측해서 쓰지 않는다.

## 공통 규칙

- 커밋 메시지: Conventional Commits 접두어(`feat:`, `chore:`, `docs:` 등) + 한국어 설명.
- 브랜치: 기본 브랜치는 `main`. 기능은 `feature/week<N>-<주제>`(예: `feature/week1-skeleton`), 설정·문서는 `chore/<주제>`. 주차는 요구사항 표의 "주차" 열을 따른다.
- 비밀 정보는 코드와 설정 파일에 쓰지 않는다. 환경 변수와 `.env`(커밋 금지)만 쓰고, 이름은 `.env.example`에 값 없이 추가한다 (NFR-03, NFR-06).
- 요청 범위 밖의 파일이나 기능은 추가하지 않는다. 필요해 보이면 만들기 전에 제안한다.
- 테스트 결과는 "통과했다"는 말이 아니라 실제 실행 출력으로 보고한다.
- 빌드와 테스트는 사람이 자기 터미널에서 직접 돌릴 수 있어야 한다. Gradle 래퍼(`gradlew`, `gradle/wrapper/`)는 커밋한다.
- 팀원이 AI 없이도 구조와 핵심 파일을 설명할 수 있어야 한다 (NFR-08). 의도가 드러나지 않는 추상화는 피한다.

## 개발 진행 절차 (기능 단위)

1. 시작: /fr-start <요구사항ID> → 설계명세(docs/design/) → 개발자 승인 → 구현계획(docs/plans/) → 개발자 승인
2. 구현: 계획의 작업마다 implementer에게 맡기고, 끝나면 reviewer로 검토한다
   - 심각·경고는 implementer에게 수정시킨다. 수정·재검토는 최대 2회, 넘으면 개발자에게 보고한다
3. 최종 검토: 모든 작업이 끝나면 critical-reviewer에게 설계명세 + 전체 diff + 1차 검토 결과를 넘긴다
4. 서브에이전트를 호출할 때 model은 지정하지 않는다 (정의 파일의 model을 따른다)
5. 3개 이상 파일·여러 계층에 걸친 작업이나 diff 1,000줄 이상은 개발자에게 알리고 지시를 받는다
6. 수량 변경(정원, 대기 순번)에는 반드시 락, 중복 방지는 DB 유일 제약으로 보장한다
