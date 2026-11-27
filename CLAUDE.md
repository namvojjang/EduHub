# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

EduHub: 사내 교육과정 조회·수강 신청 시스템. 임직원(수강생)과 교육 담당자(관리자)가 사용한다.
요구사항·결정 사항의 기준 문서는 `docs/requirements.md`다(FR-xx, NFR-xx, D-xx). 동작을 바꾸기 전에 읽고, 커밋과 코드에서는 해당 ID로 참조한다.

## 디렉터리 지도

| 경로 | 내용 | 세부 지침 |
|---|---|---|
| `backend/` | Java 8, Spring Boot 2.7, Gradle 7.6(Kotlin DSL, 래퍼 포함) | `backend/CLAUDE.md` |
| `frontend/` | React 18 + TypeScript, Mantine 8.3, Axios, Module Federation(`shell` 3000, `course-mfe` 3001, `enrollment-mfe` 3002), npm workspaces | `frontend/CLAUDE.md` |
| `docs/` | 요구사항·결정 사항 | — |
| `.env.example` | 필요한 환경 변수 이름(값 없음) | — |

## 실행 명령

```bash
cd backend && ./gradlew test            # 테스트 (포맷 검사 포함은 ./gradlew check)
cd backend && ./gradlew spotlessApply   # 포맷 적용
cd backend && ./gradlew bootRun         # 실행 (dev 프로필, .env.example의 DB 변수 필요)
```

프론트엔드 명령(테스트·빌드·세 앱 실행)은 `frontend/CLAUDE.md`에 있다. 확인한 명령만 적고 추측해서 쓰지 않는다.

## 공통 규칙

- 커밋 메시지: Conventional Commits 접두어(`feat:`, `chore:`, `docs:` 등) + 한국어 설명.
- 브랜치: 기본 브랜치는 `main`. 기능은 `feature/week<N>-<주제>`(예: `feature/week1-skeleton`), 설정·문서는 `chore/<주제>`. 주차는 요구사항 표의 "주차" 열을 따른다.
- 비밀 정보는 코드와 설정 파일에 쓰지 않는다. 환경 변수와 `.env`(커밋 금지)만 쓰고, 이름은 `.env.example`에 값 없이 추가한다 (NFR-03, NFR-06).
- 요청 범위 밖의 파일이나 기능은 추가하지 않는다. 필요해 보이면 만들기 전에 제안한다.
- 테스트 결과는 "통과했다"는 말이 아니라 실제 실행 출력으로 보고한다.
- 빌드와 테스트는 사람이 자기 터미널에서 직접 돌릴 수 있어야 한다. Gradle 래퍼(`gradlew`, `gradle/wrapper/`)는 커밋한다.
- 팀원이 AI 없이도 구조와 핵심 파일을 설명할 수 있어야 한다 (NFR-08). 의도가 드러나지 않는 추상화는 피한다.

## 자동화 (훅, `.claude/hooks/`)

- 파일 수정 시 자동 포맷(Java: Spotless, TS: prettier)은 팀 플러그인 `eduhub-team-kit`의 훅이 한다(아래 "팀 플러그인"). 보호 파일(운영 설정·`.env`·기존 마이그레이션·생성 API 클라이언트)과 위험 명령(운영 접속·`flywayClean`·강제 푸시·main 직접 푸시)은 훅이 차단한다. 차단 메시지의 안내를 따른다.
- 백엔드에 커밋 안 된 변경이 있으면 응답을 마칠 때 `./gradlew test`가 돈다. 실패가 로컬 DB 꺼짐 같은 코드 밖 원인이면 고치지 말고 사람에게 알린다.
- 훅은 Git Bash와 `jq`가 필요하다 (Windows: `winget install jqlang.jq` 후 앱 재시작).

## 팀 플러그인 (`eduhub-team-kit`)

- 팀 공통 스킬(`spring-api`, `fr-start`)·에이전트(`implementer`, `reviewer`)·포맷 훅은 마켓플레이스 `namvojjang/eduhub-team1-plugins`(Private)의 플러그인으로 쓴다. `.claude/settings.json`이 이 플러그인을 권장하므로, 폴더를 신뢰하면 설치 안내가 뜬다. 직접 설치: `claude plugin marketplace add namvojjang/eduhub-team1-plugins` → `claude plugin install eduhub-team-kit@eduhub-team1-plugins`
- 이 저장소 전용(`critical-reviewer`, 보호 훅, `stop-test`, `.mcp.json`)은 `.claude/`에 남긴다. 공통 자산을 바꾸려면 마켓플레이스 저장소에 PR을 올린다.

## 개발 진행 절차 (기능 단위)

1. 시작: /eduhub-team-kit:fr-start <요구사항ID> → 설계명세(docs/design/) → 개발자 승인 → 구현계획(docs/plans/) → 개발자 승인
2. 구현: 계획의 작업마다 implementer(`eduhub-team-kit:implementer`)에게 맡기고, 끝나면 reviewer(`eduhub-team-kit:reviewer`)로 검토한다
   - 심각·경고는 implementer에게 수정시킨다. 수정·재검토는 최대 2회, 넘으면 개발자에게 보고한다
3. 최종 검토: 모든 작업이 끝나면 critical-reviewer에게 설계명세 + 전체 diff + 1차 검토 결과를 넘긴다
4. 서브에이전트를 호출할 때 model은 지정하지 않는다 (정의 파일의 model을 따른다)
5. 3개 이상 파일·여러 계층에 걸친 작업이나 diff 1,000줄 이상은 개발자에게 알리고 지시를 받는다
6. 수량 변경(정원, 대기 순번)에는 반드시 락, 중복 방지는 DB 유일 제약으로 보장한다
