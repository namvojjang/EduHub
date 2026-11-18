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
