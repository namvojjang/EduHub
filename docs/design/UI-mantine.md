# 설계명세: course-mfe 화면 Mantine 전환 (FR-01, FR-02, FR-03)

- 상태: 승인됨 (2026-11-19). 구현계획: `docs/plans/UI-mantine.md`
- 관련: FR-01, FR-02, FR-03, NFR-07, NFR-08
- 범위: `frontend/apps/course-mfe`의 화면 4개와 대화상자 2개를 MUI에서 Mantine으로 바꾸고 디자인을 다듬는다.
  동작(조회 조건, 호출하는 훅, 이동 경로, 검증 규칙)은 바꾸지 않는다. 훅·API 클라이언트(`packages/api-client/src`)는 손대지 않는다.
  shell·enrollment-mfe(FR-04~06 화면)는 아직 없으므로 이번 범위가 아니다.

## 1. 스택 결정 변경 (개발자 결정, 2026-11-19)

| 항목 | 기존 | 변경 |
|---|---|---|
| UI 라이브러리 | MUI 5 (`@mui/material`, `@emotion/*`) | **Mantine 8.3** (`@mantine/core`, `@mantine/hooks` `^8.3.18`). MUI·emotion은 제거 |
| React | 18.3 | 18.3 그대로 |

왜 9가 아니라 8.3인가: Mantine 9(9.0.0~9.8.1 모두)의 peer dependency는 `react`/`react-dom` `^19.2.0`이다.
React 18을 유지하기로 했으므로 React 18·19를 모두 지원하는 8.3.x를 쓴다(peer `^18.x || ^19.x`).
React 19로 올릴 때 Mantine 9로 함께 올린다. 문서(루트 `CLAUDE.md`, `frontend/CLAUDE.md`, `docs/requirements.md`)에 이 결정을 적는다.

추가하지 않는 것(필요하면 따로 제안): `@mantine/dates`(날짜 선택기, dayjs 필요), `@mantine/modals`·`@mantine/notifications`, 아이콘 패키지, `postcss-preset-mantine`(CSS 모듈을 쓰지 않으므로 불필요).
일시 입력은 지금처럼 브라우저 기본 `datetime-local`을 쓰고, 확인 창은 지금처럼 `window.confirm`을 쓴다.

## 2. 테마와 공통 규칙

`src/theme.ts`에 테마 하나를 둔다 (`createTheme`).

- 주색 `indigo`, 라이트 모드만 (`defaultColorScheme="light"`).
- 모서리 `defaultRadius: 'md'`, 글꼴은 시스템 글꼴 + `'Malgun Gothic'` (웹 폰트를 내려받지 않는다).
- 밀도: 표는 `verticalSpacing="sm"`, 입력·버튼은 기본 크기(`sm`). 사내 업무용 차분한 톤.
- 화면 배경 `gray.0`, 내용은 흰 `Paper withBorder` 카드에 담는다. 폭은 `Container size="lg"`(사용자), 관리자도 같게.

상태 표시 색은 `constants/statusLabels.ts`에 라벨 옆에 둔다 (라벨과 색이 한곳에서 관리되게).

| 상태 | 라벨 | Badge 색 |
|---|---|---|
| 과정 `OPEN` / `CLOSED` | 운영 중 / 종료 | `teal` / `gray` |
| 회차 `RECRUITING` / `CLOSED` / `COMPLETED` | 모집 중 / 모집 마감 / 교육 완료 | `indigo` / `gray` / `dark` |

`main.tsx`는 `MantineProvider theme={theme}` + `@mantine/core/styles.css` import로 바꾼다. 화면 공통 헤더(AppShell)는 shell의 몫이라 만들지 않는다.

## 3. 화면별 변경

공통: 로딩은 `Loader`(가운데, `aria-label="불러오는 중"`), 오류는 `Alert color="red"`, 없음 안내는 `Alert color="yellow"`, 빈 목록은 표 안 가운데 `Text c="dimmed"`.
페이지 제목은 `Title order={2}`, 부제는 `Text c="dimmed" size="sm"`.

### FR-01 과정 목록 `CourseListPage`
- 머리: 제목 "교육과정" + 부제 "사내 교육과정을 검색하고 일정을 확인하세요." 오른쪽에 `Button variant="default"` "과정 관리".
- 검색 카드: `TextInput`(과정명 검색) + `Select`(분류, "전체" 포함, `allowDeselect={false}`) + `Button` "검색". 좁은 화면에서는 `Group wrap`으로 줄바꿈.
- 표 카드: `Table highlightOnHover`, 분류는 `Badge variant="light" color="gray"`. 행 전체 클릭으로 상세 이동(지금과 같음), 마우스 커서 pointer.
- 아래: 왼쪽 `"1–2 / 전체 2"` 문구, 오른쪽 `Select`(페이지당 10/20/50) + `Pagination`. 페이지 번호는 화면 1부터, 훅에는 지금처럼 0부터 넘긴다.

### FR-02 과정 상세 `CourseDetailPage`
- `Button variant="subtle"` "← 목록으로".
- 머리 카드: 제목(`Title order={2}`) + 분류·상태 Badge, 설명(`Text c="dimmed"`, 줄바꿈 유지).
- 회차 카드: 제목 "회차" + `Table`. 남은 자리가 0이면 빨간 글자로 "0 (정원 마감)", 상태는 Badge.

### FR-03 관리자 과정 목록 `AdminCourseListPage`
- 머리: 제목 "과정 관리" + 부제, 오른쪽 `Button variant="default"` "임직원 화면", `Button` "과정 등록".
- 검색 카드: `TextInput` + `Button variant="default"` "검색".
- 표: 상태 Badge, 관리 열에 `Button size="xs" variant="light"` "관리", `Button size="xs" variant="light" color="red"` "종료".
- 페이지 영역은 FR-01과 같은 모양.
- 작업 오류 `Alert`는 `withCloseButton`.

### FR-03 과정별 관리 `AdminCoursePage`
- "← 과정 관리로", 머리 카드(제목·Badge·설명 + 오른쪽 "과정 정보 수정" `variant="default"`).
- 회차 카드: 제목 "회차" + 오른쪽 "회차 추가"(종료 과정이면 disabled), 표의 관리 열은 목록과 같은 버튼 모양("수정", "모집 마감").

### 대화상자 `CourseFormDialog`, `SessionFormDialog`
- `Modal`(제목 "과정 등록/수정", "회차 추가/수정", `size="md"`, 가운데). 입력은 `TextInput`·`Select`·`Textarea autosize`·`TextInput type="datetime-local"`·`TextInput type="number"`.
- 오류 `Alert color="red"`는 입력 위. 아래 `Group justify="flex-end"`: "취소"(`variant="default"`), "저장"(`loading={saving}`).
- props와 제출 값 형식은 그대로.

## 4. 테스트

- 기존 테스트의 의도(무엇을 보여 주고 무엇을 호출하는지)는 그대로 둔다. 바뀌는 것은 렌더 방식과 MUI 고유 조작뿐이다.
- `src/test/render.tsx`: `MantineProvider`로 감싸는 `renderWithProviders`. 모든 화면 테스트가 이걸 쓴다.
- `src/test/setup.ts`: jsdom에 없는 `window.matchMedia`, `ResizeObserver`, `Element.prototype.scrollIntoView`를 채운다 (Mantine 공식 테스트 안내).
- MUI `Select` 조작(`mouseDown` → option)은 Mantine `Select` 조작(입력 클릭 → `option` 클릭)으로 바꾼다.
- 표의 `aria-label`, 버튼 이름, 문구는 유지해서 테스트 질의를 바꾸지 않는다.

## 5. 위험·확인

- 변경 규모: course-mfe 파일 약 15개(화면 4, 대화상자 2, 테스트 4, 설정·테마 4, 문서 3), diff 약 900~1,200줄 예상 → 루트 CLAUDE.md 5번에 따라 이 명세 승인으로 진행 지시를 받는다.
- Module Federation으로 shell에 붙일 때 `MantineProvider`·`styles.css`는 shell이 한 번 제공해야 한다. 이번에는 단독 실행 진입점(`main.tsx`)에만 둔다. shell 작업 때 다시 정한다.
- 브라우저 확인은 백엔드(8080)와 dev 서버(3001)를 띄우고 네 화면을 스크린샷으로 남긴다.

---

## 6. 2차: 업무 포털형 디자인 (A안, 개발자 결정 2026-11-19)

1차(3절) 결과가 "상용 프로그램 느낌이 안 난다"는 피드백을 받아 A안(업무 포털형)으로 다시 디자인한다. 시안은 목록 화면 한 장(샘플 데이터)으로 확인했다.
결정: A안, 목록 API 확장은 **별도 작업**(이번에는 화면만), Mantine **8.3 유지**(9는 React 19.2 필요), **Pretendard**와 **다크 모드 토글** 적용.
이 절이 3절과 다르면 이 절을 따른다. 훅·API 클라이언트는 여전히 바꾸지 않는다.

### 6.1 추가 의존성 (모두 React 18 호환 확인)

| 패키지 | 버전 | 용도 |
|---|---|---|
| `@mantine/notifications` | `^8.3.18` | 저장·종료 뒤 토스트 |
| `@mantine/modals` | `^8.3.18` | `window.confirm` 대신 앱 안 확인 창(`modals.openConfirmModal`) |
| `@tabler/icons-react` | `^3.52.0` | 아이콘 (Mantine 공식 예제와 같은 세트) |
| `pretendard` | `^1.3.9` | 글꼴. CDN이 아니라 번들에 포함(사내망 대비). `dist/web/variable/pretendardvariable-dynamic-subset.css`만 import |

### 6.2 테마·다크 모드

- `theme.ts`: `fontFamily`·`headings.fontFamily`를 `'Pretendard Variable', Pretendard, <시스템 글꼴>`로, `primaryColor: 'indigo'`, `defaultRadius: 'md'`, 컴포넌트 기본값(Card·Paper `radius: 'lg'`, Button `radius: 'md'`)을 둔다.
- `MantineProvider defaultColorScheme="light"`. 사용자가 헤더에서 바꾼 값은 Mantine 기본 저장소(localStorage)에 남는다.
- 색은 모두 테마 토큰이나 `light-dark()`로 쓴다. 고정 색(`#fff`, `gray.0` 직접 지정)은 쓰지 않는다. 화면 배경은 `light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-8))`.
- 분류별 색은 `constants/categories.ts`의 `CATEGORY_COLOR`(개발 indigo, 데이터 cyan, 리더십 grape, 직무공통 orange, 없으면 gray).

### 6.3 앱 뼈대 `src/layout/AppLayout.tsx`

- `AppShell`: 헤더 60px, 좌측 내비 220px(모바일은 `Burger`로 접힘).
- 헤더: 로고(그라데이션 `ThemeIcon` "E" + "EduHub"), 가운데 과정 검색 입력(제출하면 `/?keyword=…`로 이동), 오른쪽 다크 모드 토글(`ActionIcon`, 해/달 아이콘, `aria-label="화면 테마 전환"`)과 사용자 자리(`Avatar` + "임직원"·"로그인 연동 전" — 인증은 NFR-03 TODO, 가짜 이름을 넣지 않는다).
- 내비: "학습" 묶음에 교육과정(`/`), 내 신청 내역(비활성, 설명 "4주차 · FR-07"), "관리" 묶음에 과정 관리(`/admin/courses`). 현재 경로에 맞춰 `active`.
- 적용 위치: 단독 실행 진입점 `main.tsx`에서 `<AppLayout><App /></AppLayout>`. `App`(shell에 노출할 컴포넌트)에는 넣지 않는다 — shell이 생기면 이 레이아웃을 shell로 옮긴다.
- 공용 `src/components/PageHeader.tsx`: 브레드크럼 + 제목(`Title order={2}`) + 설명 + 오른쪽 동작 영역.
- 공용 `src/components/EmptyState.tsx`: 아이콘 + 제목 + 설명 + 선택 동작 버튼.

### 6.4 FR-01 과정 목록

- 검색어는 URL 쿼리 `keyword`가 기준이다(헤더 검색과 공유). 검색어가 바뀌면 분류·페이지·페이지당 개수는 초기화되고 보기 방식(카드/표)만 유지한다(목록 부분을 `key={keyword}`로 다시 마운트). 화면에 "‘검색어’ 검색 결과 · 검색 지우기"를 보여 준다. 페이지 안의 별도 검색 입력은 없앤다.
- 분류는 `Chip.Group`(전체 + CATEGORIES). 바꾸면 page 0.
- `SegmentedControl` 카드/표 전환(기본 카드). 카드: 분류 색 띠, 분류 Badge, 제목(2줄 자름), "자세히 보기" 버튼(상세로 이동). 표: 1차와 같은 표(`aria-label="과정 목록"`).
- 카드에 설명·다음 회차·남은 자리는 **넣지 않는다**(목록 API에 없음, 별도 작업). 시안의 그 부분은 API 확장 뒤에 붙인다.
- 로딩은 카드 모양 `Skeleton` 6개, 빈 결과는 `EmptyState`("조건에 맞는 과정이 없습니다." + 검색어나 분류가 걸려 있으면 "조건 지우기" — 둘 다 초기화), 오류는 `Alert`.
- 아래 페이지 영역은 1차와 같다.

### 6.5 FR-02 과정 상세

- 브레드크럼(교육과정 › 과정명). 히어로 카드: 분류 색 띠, 분류·상태 Badge, 큰 제목, 설명.
- 회차는 표 대신 카드 목록(`role="list" aria-label="회차 목록"`, 각 카드 `role="listitem"`): 시작 일시(크게), 장소(아이콘), 상태 Badge, 남은 자리 `Progress`(확정 비율, 남은 0이면 red·"0 (정원 마감)", 20% 이하 orange, 그 외 teal; "마감 임박" Badge는 모집 중 회차에만)와 "남은 자리 n / 정원".
- 각 회차 카드에 "신청하기" 버튼은 **비활성 + Tooltip "수강 신청 화면 준비 중 (enrollment-mfe)"**. 키보드·스크린리더 사용자를 위해 항상 보이는 안내 문구 "수강 신청 화면 준비 중"을 두고 버튼에 `aria-describedby`로 연결한다. 신청 화면은 이번 범위가 아니다.
- 로딩 Skeleton, 없음은 `EmptyState`("과정을 찾을 수 없습니다." + 목록으로), 회차 없음은 `EmptyState`.

### 6.6 FR-03 관리자

- 과정 관리 목록: `PageHeader`(오른쪽 "과정 등록" 버튼, 아이콘), 페이지 안 검색 입력은 유지(관리자는 헤더 검색과 별개), 요약은 "전체 n개"만(상태별 통계는 API가 없어 넣지 않는다 — 목록 API 확장 작업에서 함께). 표의 관리 열은 행 메뉴(`Menu`, `ActionIcon aria-label="<과정명> 작업"`): "관리"(이동), "종료"(빨강, OPEN만).
- 과정별 관리: 히어로 카드(제목·Badge·설명 + "과정 정보 수정"), 회차 표(상태 Badge, 남은 자리 표시) + 행 메뉴("수정", "모집 마감" — RECRUITING만).
- 확인은 `modals.openConfirmModal`(제목, 설명, 빨간 확인 버튼 "종료"/"모집 마감", 취소). 문구는 기존 confirm 문구를 쓴다.
- 등록·수정 폼은 `Drawer`(오른쪽, `position="right"`, size md)로 바꾼다. 입력·검증·제출 값 형식은 그대로. 분류 Select에 `allowDeselect={false}`.
- 성공하면 `notifications.show`(초록, 예: "과정을 등록했습니다."), 실패는 기존처럼 Alert/폼 안 Alert.

### 6.7 테스트

- `renderWithProviders`에 `ModalsProvider`·`Notifications`를 더하고 `MemoryRouter`는 각 테스트가 지금처럼 감싼다.
- `AppLayout` 테스트 추가: 현재 경로의 내비가 active, 헤더 검색 제출 시 `/?keyword=…`로 이동, 테마 토글 버튼이 있다.
- 목록: URL `keyword`가 훅 인자로 가는지, 분류 칩을 바꾸면 page 0, 카드/표 전환, 빈 상태 문구.
- 상세: `getByRole('list', { name: '회차 목록' })` 기준으로 바뀐다. 정원 마감·마감 임박 표시.
- 관리자: 행 메뉴를 열고 `menuitem`을 누르는 흐름, 확인 창의 확인 버튼을 누르면 액션 호출, `window.confirm` 스파이는 없앤다.

### 6.8 범위 밖 (별도 제안)

- 목록 API 확장(설명·다음 회차·남은 자리, 상태별 개수) — FR-01·FR-03, NFR-02(N+1) 설계 필요.
- 개발용 시드 데이터(지금 DB에는 "동시성 테스트 과정 …"만 있어 화면 인상이 나쁘다).
- prettier 설정 파일.
