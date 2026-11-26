# frontend/CLAUDE.md

프론트엔드 작업 지침. 공통 규칙은 루트 `CLAUDE.md`를 따른다.

현재는 `apps/course-mfe` 단독 앱(과정 목록·상세·관리자 화면)만 있다. `shell`과 `enrollment-mfe`는 아직 없다.

## 명령

`frontend/`에서 실행한다. 확인하지 않은 명령은 추측해서 적지 않는다.

```bash
npm test                              # 전체 워크스페이스 테스트
npm run build -w apps/course-mfe      # course-mfe 빌드
```

## 구조 (NFR-07)

- React 18 + TypeScript, npm workspaces.
- Module Federation으로 화면을 나눈다: `shell`(호스트), `course-mfe`(과정·회차), `enrollment-mfe`(신청·대기·수료).

## UI

- UI는 Mantine 8.3(`@mantine/core`·`hooks`·`modals`·`notifications`), 아이콘은 `@tabler/icons-react`, 글꼴은 `pretendard`(번들 포함)를 쓴다. Mantine 9는 React 19.2가 필요해 React 19 전환 때 함께 올린다.
- 색은 테마 토큰이나 `light-dark()`만 쓴다(다크 모드 대응).
- 화면 공통 레이아웃은 `src/layout/AppLayout.tsx`다(단독 실행용, `shell`이 생기면 옮긴다).

## 테스트 작성

- 컴포넌트 테스트는 `src/test/render.tsx`의 `renderWithProviders`로 렌더한다.
- jsdom에서 Mantine 드롭다운·메뉴 항목은 `getByRole(..., { hidden: true })`가 필요할 수 있다.

## API 호출 (NFR-04)

- API 클라이언트는 손으로 쓰지 않는다. 백엔드 OpenAPI 스펙(`/v3/api-docs`)에서 생성한 Axios 클라이언트를 쓴다.
- 생성된 클라이언트 파일은 직접 고치지 않는다. API가 바뀌면 스펙에서 다시 생성한다.
- 서버 데이터 조회는 커스텀 훅(`src/hooks/useXxx.ts`)으로 한다.
