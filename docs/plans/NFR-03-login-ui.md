# 구현계획: 로그인 화면과 토큰 처리 (NFR-03 프론트엔드)

- 설계명세: `docs/design/NFR-03-login-ui.md` (승인됨 2026-11-26, Q1~Q4 권장안). 이 계획에 없는 결정은 설계명세를 따른다.
- 상태: 승인됨 (2026-11-26)
- 브랜치: `feature/week4-nfr-03-login-ui`
- 진행: 작업마다 implementer 구현 → reviewer 검토. 심각·경고는 수정·재검토 최대 2회. 모든 작업 후 critical-reviewer 최종 검토, 지적은 고치기 전에 개발자에게.
- 공통 제약: React 18 + TypeScript, Mantine 8.3(MUI 금지), react-router-dom 6, 생성 클라이언트 `@eduhub/api-client`만(생성 코드 수정 금지 — 훅이 막음), `frontend/CLAUDE.md`(테스트는 `renderWithProviders`, 서버 조회는 커스텀 훅). 경로는 `frontend/apps/course-mfe/src/` 기준.
- 완료 명령(`frontend/`): `npm test`, `npm run build -w apps/course-mfe`. 실제 출력으로 보고.
- 서브에이전트는 개발 서버(3001)·백엔드(8080)를 띄우지 않는다. 브라우저 확인은 메인 세션이 한다.
- 커밋: Conventional Commits + 한국어, `NFR-03` 참조. 메인 세션이 검토 통과 후.

## 단계별로 개발자가 직접 할 일

| 작업 | 직접 할 일 |
|---|---|
| 계획 | 이 구현계획 승인 |
| T1·T2 | 없음 |
| T3 | (선택) 브라우저에서 직접 로그인해 보기 — 메인 세션이 확인 결과를 먼저 보고한다 |
| T4 | 최종 검토 지적 결정, PR 병합 |

## 작업 순서

```
T1 http·클라이언트(토큰 첨부·401 처리) ─> T2 로그인 상태·화면·라우트·레이아웃 ─> T3 브라우저 확인 ─> T4 최종 검토·PR
```

---

## T1. 토큰 처리 Axios 인스턴스와 클라이언트

변경 파일
- 새로: `api/http.ts` — 설계 3-1 그대로(`tokenStore`, `UNAUTHORIZED_EVENT`, `http`, 로그인 요청 판별 함수). 로그인 요청 판별은 메서드 POST + URL이 `/api/v1/auth/login`으로 끝나는지
- 새로: `api/clients.ts` — `authApi = new AuthApi(undefined, '', http)`
- 수정: `api/courseApi.ts` — `courseApi`, `courseAdminApi`를 `new XxxApi(undefined, '', http)`로. 기존 basePath 주석은 유지
- 테스트: `api/http.test.ts` — 설계 5장 H1~H7. 네트워크 대신 요청마다 `adapter`를 넘겨 응답을 흉내(교재 방식). `beforeEach`에서 `localStorage.clear()`

완료 명령: `npm test`(전체 — 기존 훅·화면 테스트가 courseApi mock으로 영향 없는지) + `npm run build -w apps/course-mfe`

커밋: `feat: 토큰 첨부와 401 처리 Axios 인스턴스 추가(NFR-03)`

---

## T2. 로그인 상태, 화면, 라우트, 레이아웃

변경 파일
- 새로: `auth/AuthContext.tsx`(설계 3-2), `auth/RequireAuth.tsx`(3-3), `auth/LoginPage.tsx`(3-4, Mantine `Paper`·`TextInput`·`PasswordInput`·`Button loading`·`Alert`, dev 계정 안내는 `import.meta.env.DEV`일 때만)
- 수정: `main.tsx` — `BrowserRouter` 안에 `AuthProvider`(Notifications·Modals 순서는 기존 유지, `AuthProvider`는 `useNavigate`를 쓰므로 Router 안)
- 수정: `App.tsx` — `/login` 추가, `/admin/courses`·`/admin/courses/:id`를 `<RequireAuth admin>`으로 감쌈
- 수정: `layout/AppLayout.tsx` — 헤더 사용자 영역(비로그인 "로그인" 버튼 / 로그인 `Avatar`+`Menu`: 이름·사번·역할, 로그아웃), 좌측 "과정 관리"는 ADMIN만, "내 신청 내역"은 기존 상태 유지(Step 15)
- 수정: `src/test/render.tsx` — 필요하면 `AuthProvider`·`MemoryRouter`를 감싸는 도우미 추가(기존 `renderWithProviders`는 그대로 두고 새 함수로)
- 수정: `frontend/CLAUDE.md` — "API 호출"에 토큰 규칙(생성 클라이언트는 `http`로만 만든다, 로그인 요청 제외, 401/403 처리), "테스트 작성"에 인증 도우미
- 테스트: `auth/LoginPage.test.tsx`(A1~A3), `auth/RequireAuth.test.tsx`(R1~R2), `auth/AuthContext.test.tsx`(L2: 401 이벤트 → expired·이동), `layout/AppLayout.test.tsx`에 L1(역할별 메뉴). `authApi`는 `vi.mock('../api/clients')`로 대체

주의
- 401 이벤트가 연달아 와도 이미 `/login`이면 다시 이동하지 않는다
- 기존 관리자 화면 테스트는 페이지를 직접 렌더하므로 RequireAuth 영향이 없어야 한다. 깨지면 원인 보고

완료 명령: `npm test` + `npm run build -w apps/course-mfe`

커밋: `feat: 로그인 화면과 로그인 상태, 보호 라우트 추가(NFR-03)`

---

## T3. 브라우저 확인 (메인 세션)

- 백엔드(dev)와 course-mfe를 띄운다
- 확인 표(설계 5장 브라우저 항목)
  1. 비로그인: "과정 관리" 메뉴 없음, 과정 목록 보임
  2. E1001 / dev-password 로그인 → 이름 표시, "과정 관리" 없음
  3. 틀린 비밀번호 → "사번 또는 비밀번호가 올바르지 않습니다."
  4. 로그아웃 후 주소창 `/admin/courses` → 로그인 화면 → A0001 로그인 → 원래 화면으로, 관리자 목록 표시
  5. E1001로 `/admin/courses` → 관리자 전용 경고, 로그인 유지
  6. 요청에 `Authorization` 헤더, **로그인 요청에는 없음**
  7. 저장 토큰을 위조 값으로 바꾸고 새로고침 → 만료 안내와 로그인 화면
- 스크린샷을 개발자에게 보인다

---

## T4. 최종 검토와 PR

- `npm test`, `npm run build`, 백엔드 `./gradlew check`(변경 없음 확인)
- critical-reviewer: 설계명세 + `git diff main...` + T1·T2 검토 + T3 확인 결과. 중점: 토큰 노출 경로, 401/403 처리, 로그인 요청 예외, 리다이렉트(open redirect: `state.from`이 외부 URL이 아닌지), 경쟁 상태, 6회차 분리 경계
- PR 본문: 보안 메모(설계 4장), 교재와 다른 점, Step 15·16에서 쓸 `clients.ts`·`RequireAuth`

## 위험 영역

| 위험 | 대응 |
|---|---|
| courseApi 생성 방식 변경으로 기존 화면 깨짐 | T1 전체 테스트 + T3 브라우저 |
| 로그인 실패를 만료로 오인 | H5 테스트, 로그인 요청 판별 |
| 만료 토큰 때문에 로그인 불가 | H3 테스트(로그인 요청에 헤더 없음), T3-7 |
| `state.from`으로 외부 주소 이동(open redirect) | 내부 경로(`/`로 시작, `//` 아님)만 허용 — T2에서 처리, 최종 검토 중점 |
| 401 이벤트 반복으로 이동 반복 | 이미 `/login`이면 무시 |
