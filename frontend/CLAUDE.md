# frontend/CLAUDE.md

프론트엔드 작업 지침. 공통 규칙은 루트 `CLAUDE.md`를 따른다.

아직 코드와 빌드 설정이 없다. 명령은 설정이 추가되고 동작을 확인한 뒤에 적는다. 그 전에는 명령을 추측해서 쓰지 않는다.

## 구조 (NFR-07)

- React 18 + TypeScript, npm workspaces.
- Module Federation으로 화면을 나눈다: `shell`(호스트), `course-mfe`(과정·회차), `enrollment-mfe`(신청·대기·수료).

## UI

- UI 컴포넌트는 MUI를 쓴다.

## API 호출 (NFR-04)

- API 클라이언트는 손으로 쓰지 않는다. 백엔드 OpenAPI 스펙(`/v3/api-docs`)에서 생성한 Axios 클라이언트를 쓴다.
- 생성된 클라이언트 파일은 직접 고치지 않는다. API가 바뀌면 스펙에서 다시 생성한다.
- 서버 데이터 조회는 커스텀 훅(`src/hooks/useXxx.ts`)으로 한다.
