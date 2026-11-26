# 설계명세: NFR-03 인증 기반 (JWT 로그인, 역할별 접근 제어)

- 상태: 승인됨 (2026-11-19, 9장 Q1~Q4 모두 권장안). 구현계획: `docs/plans/NFR-03-auth.md`
- 관련: NFR-03, NFR-04, NFR-06, FR-03(관리자 구분), FR-04~06(`TODO(NFR-03)` 해소). FR-07·FR-08이 이 위에 올라간다
- 참고: 교육 5회차 Step 9-1. 교재는 Java 21 / Boot 3 기준이라 이 프로젝트(Java 8 / Boot 2.7 / Security 5.7)에 맞게 바꿨다 (8장)
- 범위 밖: 회원가입, 비밀번호 변경, 리프레시 토큰, 로그아웃(토큰 폐기), FR-07·08 API, 로그인 화면(Step 13~14)

## 1. 요구사항 정리

| ID | 이번에 지킬 것 |
|---|---|
| NFR-03 | 로그인한 사용자만 신청할 수 있다. 본인 신청만 조회·취소할 수 있다. 비밀 정보(JWT 서명 키)는 저장소에 두지 않는다 |
| FR-03 | 과정·회차 등록·수정·종료(`/api/v1/admin/**`)는 관리자(ADMIN)만 한다 |
| FR-04~06 | 신청자를 `X-Employee-Id` 헤더가 아니라 **토큰의 사용자**로 정한다. 요청 값의 사원 ID는 믿지 않는다 |
| NFR-04 | 새 API에 OpenAPI 문서를 단다. 401·403도 공통 `ErrorResponse {code, message}`로 응답한다. Swagger UI에서 토큰을 넣어 호출할 수 있다 |
| NFR-06 | 서명 키는 환경 변수 `EDUHUB_JWT_SECRET`. 개발용 계정은 dev 프로필에서만 만든다 |

### 사람이 정한 설계 결정 (교재 Step 9-1, Claude에게 맡기지 않는 결정)

| 결정 | 선택 | 이유 |
|---|---|---|
| 인증 방식 | JWT Bearer 토큰, 서버는 세션을 저장하지 않음(STATELESS) | 6회차에 shell·course-mfe·enrollment-mfe 여러 앱이 같은 API를 부른다 |
| 로그인 방법 | 교육용 개발 로그인: 사번 + 비밀번호(BCrypt 해시) | 실제 회사는 사내 SSO. 토큰을 받은 뒤의 구조는 같다 |
| 토큰 서명 | HS256, 환경 변수 `EDUHUB_JWT_SECRET`(32바이트 이상) | 비밀은 저장소에 두지 않는다 |
| 검증 구현 | Spring Security 리소스 서버(`oauth2ResourceServer().jwt()`) | 직접 만든 필터는 서명·만료·알고리즘 검사를 빠뜨리기 쉽다 |
| 남의 신청 | 404 (존재 여부를 숨김) | 지금 동작(FR-05·06) 그대로 |
| 사용자 꺼내는 곳 | `CurrentUser.from(Jwt)` 한 곳 | 컨트롤러는 이것으로만 사용자를 얻는다 |

## 2. API

### 2-1. 새 API (Tag `Auth`)

`POST /api/v1/auth/login` (operationId `login`) — 공개

| 요청 필드 (`LoginRequest`) | 타입 | 검증 |
|---|---|---|
| employeeNo | String | `@NotBlank`, `@Size(max = 20)` |
| password | String | `@NotBlank`, `@Size(max = 100)` |

응답 `200` (`LoginResponse`)

| 필드 | 타입 | 설명 |
|---|---|---|
| accessToken | String | JWT |
| tokenType | String | 항상 `Bearer` |
| expiresIn | long | 남은 초 (3600) |
| user | `MeResponse` | 아래 |

`GET /api/v1/me` (operationId `getMe`) — 로그인 필요. 응답 `200` (`MeResponse`): `employeeId`(Long), `employeeNo`(String), `name`(String), `role`(`EMPLOYEE`|`ADMIN`)

- `/me`는 토큰의 클레임만으로 응답한다(DB 조회 없음). 화면이 새로고침 뒤 "누구로 로그인했는지" 확인하는 용도다.

### 2-2. 기존 API 변경 (계약 변경 → 프론트 클라이언트 재생성)

| API | 변경 |
|---|---|
| `POST /api/v1/enrollments`, `GET /api/v1/enrollments/{id}`, `POST /api/v1/enrollments/{id}/cancel` | `X-Employee-Id` 헤더 삭제. 사원 ID는 토큰의 `sub`. 로그인 필요 |
| `/api/v1/admin/**` (FR-03 전부) | ADMIN만 |
| `GET /api/v1/courses`, `GET /api/v1/courses/*`, `GET /api/health`, `/swagger-ui/**`, `/v3/api-docs/**` | 공개 (하위 경로는 로그인 필요, 2-3 참고) |

- 경로·요청 본문·응답 본문은 바꾸지 않는다. 교재의 경로(`/api/sessions/{id}/enrollments`, `DELETE`)로 바꾸지 않는다.
- 교재가 경고한 구멍("`POST /api/v1/courses`가 `anyRequest().authenticated()`에 걸려 사원도 등록 가능")은 이 프로젝트에서는 생기지 않는다. 쓰기 API가 모두 `/api/v1/admin/**` 아래에 있기 때문이다. 그래도 테스트로 막아 둔다 (6장 S9).

### 2-3. 접근 규칙 (`SecurityFilterChain`, 위에서부터 첫 일치)

| 순서 | 요청 | 규칙 |
|---|---|---|
| 1 | `POST /api/v1/auth/login` | permitAll |
| 2 | `GET /api/v1/courses`, `GET /api/v1/courses/*`(지금 있는 공개 API만. 새로 추가되는 하위 경로는 기본적으로 로그인 필요, 최종 검토 제안 1), `GET /api/health`, `/swagger-ui/**`, `/swagger-ui.html`, `/v3/api-docs/**` | permitAll |
| 3 | `/api/v1/admin/**` | `hasRole("ADMIN")` |
| 4 | 그 밖의 모든 요청 | authenticated |

- CSRF 끔(쿠키가 아니라 `Authorization` 헤더로 인증), 세션 STATELESS, `httpBasic`·`formLogin` 끔.
- 역할: 토큰의 `role` 클레임(`EMPLOYEE`/`ADMIN`)을 `ROLE_` 접두어 권한으로 바꾼다 (`JwtGrantedAuthoritiesConverter`).
- Boot 2.7은 Spring Security 5.7이다. `requestMatchers(...)` 대신 `antMatchers(...)`를 쓴다.

### 2-4. 오류 (본문은 공통 `ErrorResponse {code, message}`)

| 상태 | code | 언제 | 만드는 곳 |
|---|---|---|---|
| 400 | `INVALID_REQUEST` | 로그인 요청 필드 누락·길이 초과 | 기존 `GlobalExceptionHandler` |
| 401 | `LOGIN_FAILED` | 사번 없음, 비밀번호 틀림 (**어느 쪽인지 구분하지 않는다**, 같은 메시지) | 새 `UnauthorizedException` → 핸들러에 401 추가 |
| 401 | `UNAUTHENTICATED` | 토큰 없음, 서명 위조, 만료, 형식 오류 | `AuthenticationEntryPoint` (Security 필터 단계) |
| 403 | `FORBIDDEN` | 로그인했지만 권한 없음 (사원이 `/api/v1/admin/**`) | `AccessDeniedHandler` |
| 404 | `ENROLLMENT_NOT_FOUND` | 남의 신청 조회·취소 (지금과 같음) | 기존 |

- 401·403은 컨트롤러에 닿기 전에 Security 필터에서 나므로 `@RestControllerAdvice`가 잡지 못한다. 그래서 진입점·거부 처리기 두 개가 `ErrorResponse` JSON을 직접 쓴다. 토큰 파싱 필터를 직접 만드는 것이 아니라 Spring이 제공하는 확장 지점만 채운다.
- 토큰 문제로 인한 401(`UNAUTHENTICATED`)에만 `WWW-Authenticate: Bearer`를 둔다. 로그인 실패(`LOGIN_FAILED`)는 자격 증명이 본문으로 오므로 두지 않는다.

## 3. 스키마 변경: `V4__create_employee.sql`

현재 직원 테이블이 없다 (`enrollment.employee_id`는 FK 없음, V2 주석 "NFR-03 때 결정"). 교재는 기존 `employee` 테이블에 컬럼을 추가하지만, 여기서는 새로 만든다.

```sql
CREATE TABLE employee (
    id            BIGSERIAL    PRIMARY KEY,
    employee_no   VARCHAR(20)  NOT NULL,
    name          VARCHAR(50)  NOT NULL,
    password_hash VARCHAR(100) NOT NULL,          -- BCrypt (60자). 평문 저장 금지
    role          VARCHAR(20)  NOT NULL DEFAULT 'EMPLOYEE',
    CONSTRAINT ck_employee_role CHECK (role IN ('EMPLOYEE', 'ADMIN'))
);
CREATE UNIQUE INDEX ux_employee_no ON employee (employee_no);
```

- `enrollment.employee_id → employee.id` FK는 **이번에 걸지 않는다**. 지금 DB(testdb)에 사원 테이블에 없는 employee_id를 가진 신청이 1만 4천여 건 있어(대부분 테스트가 남긴 데이터) FK를 걸면 마이그레이션이 실패한다. → 질문 Q2
- 부서 컬럼은 두지 않는다 (교재 예시에는 있으나 쓰는 기능이 없다).

## 4. 코드 구조

새 패키지 `com.example.eduhub.auth` (backend/CLAUDE.md의 도메인 패키지 목록에 추가)

| 파일 | 역할 |
|---|---|
| `Employee`, `EmployeeRole`, `EmployeeRepository` | 엔티티(`@Getter`, 정적 팩터리 `create`), `findByEmployeeNo` |
| `AuthService` | 로그인: 사번 조회 → BCrypt 비교 → 토큰 발급. 실패는 하나의 `UnauthorizedException`. `@Transactional(readOnly = true)` |
| `TokenService` | `JwtEncoder`로 발급. 클레임: `iss=eduhub`, `sub=사원 ID`, `employeeNo`, `name`, `role`, `iat`, `exp`(+60분) |
| `JwtConfig` | `EDUHUB_JWT_SECRET` → `SecretKeySpec(HmacSHA256)`. 32바이트 미만이면 **기동 실패**. `NimbusJwtEncoder`·`NimbusJwtDecoder(HS256)` 빈 |
| `SecurityConfig` | 2-3의 `SecurityFilterChain`, `PasswordEncoder`(BCrypt), 역할 변환기 |
| `SecurityErrorHandlers` | `AuthenticationEntryPoint`(401), `AccessDeniedHandler`(403) → `ErrorResponse` JSON |
| `CurrentUser` | `from(Jwt)`: `employeeId`, `employeeNo`, `name`, `role`. Lombok `@Value` (record 금지) |
| `AuthController` | `login`, `getMe`. Controller → `AuthService`만 부른다 (교재 예시처럼 Repository를 직접 부르지 않는다) |
| `LoginRequest`, `LoginResponse`, `MeResponse` | DTO (요청은 `@Getter @NoArgsConstructor @AllArgsConstructor`, 응답은 `@Value`) |
| `DevAccountLoader` | `@Profile("dev")` 전용. 사원 테이블이 비어 있으면 개발 계정 3개 생성 → 질문 Q3 |

기존 코드 변경

| 파일 | 변경 |
|---|---|
| `EnrollmentController` | `@RequestHeader("X-Employee-Id")` 3곳 → `@AuthenticationPrincipal Jwt jwt` + `CurrentUser.from(jwt).getEmployeeId()`. `TODO(NFR-03)` 삭제. 서비스 시그니처는 그대로 |
| `common/error/UnauthorizedException`, `GlobalExceptionHandler` | 401 처리 추가 (`MissingRequestHeaderException` 처리는 쓰는 곳이 없어지면 남겨도 무해, 그대로 둔다) |
| `common/config/OpenApiConfig` | `bearerAuth`(HTTP bearer, JWT) 보안 스킴과 전역 요구사항 추가 → Swagger UI "Authorize" 버튼 |
| `build.gradle.kts` | `spring-boot-starter-security`, `spring-boot-starter-oauth2-resource-server`, 테스트에 `spring-security-test` (버전은 Boot BOM) |
| `application.yml` | `eduhub.jwt.secret: ${EDUHUB_JWT_SECRET}`, `eduhub.jwt.ttl-minutes: 60` (값 없음, 환경 변수만) |
| `src/test/resources/application-test.yml` | 테스트 전용 서명 키(32바이트 이상, 운영 비밀 아님 → 커밋 가능) |
| `.env.example` | `EDUHUB_JWT_SECRET=` 이름 추가 → **사람이 직접** (deny 규칙 `Read(./.env.*)` 때문에 Claude가 수정할 수 없다) |

패키지 의존: `enrollment → auth`(CurrentUser만), `course`는 `auth`에 의존하지 않는다(규칙은 `SecurityConfig`의 경로로 건다), `auth → common`.

## 5. 보안·트랜잭션 처리

- **사용자 열거 방지**: 사번이 없을 때도 미리 만든 더미 BCrypt 해시와 비교해 응답 시간을 맞추고, 메시지는 "사번 또는 비밀번호가 올바르지 않습니다." 하나만 쓴다.
- **토큰 검증**: `NimbusJwtDecoder`가 서명(HS256 고정, `alg: none`·다른 알고리즘 거부)과 `exp`를 검사한다. 직접 파싱하지 않는다.
- **비밀**: 서명 키는 로그·응답·예외 메시지에 넣지 않는다. 비밀번호 해시는 응답 DTO에 없다.
- **트랜잭션**: 로그인은 조회만 한다(`readOnly`). 신청·취소의 락·트랜잭션(NFR-01, D-02)은 바꾸지 않는다. 컨트롤러에서 사원 ID를 꺼내는 방식만 바뀐다.
- **알려진 한계(범위 밖)**: 토큰은 만료(60분) 전에 폐기할 수 없다(로그아웃은 화면에서 토큰을 지우는 것). 사원 권한을 바꿔도 이미 발급된 토큰은 만료 때까지 이전 역할을 가진다.

## 6. 테스트 시나리오

| # | 종류 | 시나리오 | 기대 |
|---|---|---|---|
| S1 | `@SpringBootTest` + MockMvc (실제 서명) | 로그인 성공 → 받은 토큰으로 `GET /api/v1/me` | 200, 토큰의 사용자 정보. 발급·검증 키가 짝이 맞는지 확인 |
| S2 | 〃 | 비밀번호 틀림 / 없는 사번 | 둘 다 401 `LOGIN_FAILED`, **메시지 동일** |
| S3 | 〃 | 토큰 없음 / 서명 위조 / 만료 토큰으로 `/me` | 401 `UNAUTHENTICATED` |
| S4 | `@WebMvcTest` + `jwt()` | 토큰 없이 신청·조회·취소 | 401 |
| S5 | 〃 | 사원 A 토큰으로 신청 | 서비스가 A의 ID로 호출됨 (요청 값이 아니라 토큰) |
| S6 | 〃 (기존 테스트 이전) | 남의 신청 조회·취소 | 404 (지금과 같음) |
| S7 | `@WebMvcTest` | 사원 토큰으로 `/api/v1/admin/**` 각 쓰기 API | 403 `FORBIDDEN` |
| S8 | 〃 | 관리자 토큰으로 과정 등록 | 201 |
| S9 | 〃 | 토큰 없이 `POST /api/v1/admin/courses` / `GET /api/v1/courses` | 401 / 200 |
| S10 | 단위 | `AuthService`: 성공, 사번 없음, 비밀번호 틀림 | 같은 예외 (Mockito) |
| S11 | 단위 | `JwtConfig`: 32바이트 미만 키 | 기동 실패(예외) |
| S12 | 회귀 | 기존 `@WebMvcTest` 전부(`EnrollmentControllerTest`, `CourseAdminControllerTest`, `CourseControllerTest`, `HealthControllerTest`) | `X-Employee-Id` 대신 `jwt()`로 바꿔 모두 통과 |

- 동시성 테스트(`EnrollmentConcurrencyTest` 등)는 서비스를 직접 부르므로 바뀌지 않는다.
- 공통 테스트 도우미 `TestAuth.as(employeeId, role)`를 두고 Step 10·11에서도 쓴다.

## 7. 영향 범위와 위험

| 항목 | 내용 |
|---|---|
| **프론트 관리자 화면** | `course-mfe`의 관리자 화면(`/api/v1/admin/**` 호출)은 이 변경 뒤 **로그인 화면(Step 13~14)이 생길 때까지 401로 동작하지 않는다**. 과정 목록·상세(공개 GET)는 그대로 동작한다 → 질문 Q1 |
| 프론트 API 클라이언트 | `X-Employee-Id` 파라미터가 사라지고 `AuthApi`(login, getMe)가 생긴다. `npm run generate:api`로 재생성해 함께 커밋 (NFR-04) |
| 로컬 실행 | `bootRun`에 `EDUHUB_JWT_SECRET`이 필요하다. 없으면 기동 실패(의도). `.env`에 넣으면 기존 `spring.config.import`가 읽는다 |
| 변경 규모 | 새 파일 약 14개, 기존 수정 약 8개, 여러 계층. CLAUDE.md 절차 5에 해당 → 구현계획에서 작업을 나누고 단계마다 보고 |

## 8. 교재 코드와 다르게 하는 것

| 교재 (Boot 3 / Java 21) | 이 프로젝트 |
|---|---|
| `record`, text block, `var`, `jakarta.*` | Lombok `@Value`, 문자열 연결, 타입 명시, `javax.*` |
| `requestMatchers(...)` | `antMatchers(...)` (Security 5.7) |
| `/api/auth/login`, `/api/me` | `/api/v1/auth/login`, `/api/v1/me` (팀 경로 규칙 `/api/v1/...`) |
| `/api/v1/courses/**` 쓰기 = ADMIN | 쓰기는 이미 `/api/v1/admin/**`에 있다 → `/api/v1/admin/**` = ADMIN |
| 기존 `employee`에 컬럼 추가 | `employee` 테이블 새로 생성 |
| `AuthController`가 Repository 직접 호출 | `AuthService`를 거친다 (계층 규칙) |
| 401·403 본문 없음 | `ErrorResponse` JSON (NFR-04) |
| `DevDataLoader`가 과정·회차·신청까지 생성 | 계정만 (범위 최소화) |

## 9. 질문과 결정

> 개발자 결정 (2026-11-19): Q1 받아들인다, Q2 FK 걸지 않는다, Q3 (a) `dev-password`, Q4 60분·리프레시 없음. 모두 권장안.


- **Q1. 프론트 관리자 화면이 Step 13~14 전까지 401이 된다.** 받아들이고 진행할까? (권장: 받아들인다. 교재 순서이고, 로그인 화면이 Step 14에서 바로 붙는다)
- **Q2. `enrollment.employee_id` FK를 이번에 걸지 않는다.** 괜찮은가? (권장: 걸지 않는다. 테스트 DB 분리와 기존 데이터 정리 후 별도 마이그레이션으로)
- **Q3. 개발용 계정 비밀번호를 어떻게 둘까?**
  - (a) 교재처럼 코드에 `dev-password` (dev 프로필 전용, 개발 DB에만 생김). 간단하다
  - (b) 환경 변수 `EDUHUB_DEV_PASSWORD`에서 읽고, 없으면 계정을 만들지 않는다. 저장소에 비밀번호 문자열이 남지 않는다
  - 권장: (a). 운영 비밀이 아니고 팀원 누구나 같은 계정으로 확인할 수 있어야 한다(교재의 curl 확인). 사번은 교재와 같이 `E1001`·`E1002`(사원), `A0001`(관리자)
- **Q4. 토큰 만료 60분, 리프레시 토큰 없음.** 교재 결정 그대로 갈까? (권장: 그대로)
