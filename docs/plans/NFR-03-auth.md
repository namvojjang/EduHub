# 구현계획: NFR-03 인증 기반 (JWT 로그인, 역할별 접근 제어)

- 설계명세: `docs/design/NFR-03-auth.md` (승인됨 2026-11-19, Q1~Q4 권장안). 이 계획에 없는 결정은 설계명세를 따른다.
- 상태: 승인됨 (2026-11-19)
- 브랜치: `feature/week4-nfr-03-auth`
- 진행: 작업마다 implementer가 구현하고 reviewer가 검토한다. 심각·경고는 수정·재검토 최대 2회, 넘으면 개발자에게 보고. 모든 작업이 끝나면 critical-reviewer가 설계명세 + 전체 diff + 1차 검토 결과로 최종 검토하고, 지적 사항은 고치기 전에 개발자에게 먼저 보인다.
- 공통 제약: Java 8(record·`var`·text block·`List.of` 금지), `javax.*`, Spring Security **5.7**(`antMatchers`, `authorizeHttpRequests`), 엔티티 `@Setter` 금지, 엔티티를 응답으로 반환 금지. 상세는 `.claude/skills/eduhub-api/SKILL.md`.
- 경로는 `backend/src/main/java/com/example/eduhub/`(테스트는 `backend/src/test/java/...`) 기준. 완료 명령은 `backend/`에서 실행하고 실제 출력(테스트 수·실패 수)으로 보고한다.
- 커밋: 작업마다 1개 이상, Conventional Commits + 한국어, `NFR-03` 참조. 커밋은 메인 세션이 검토 통과 후 한다(implementer는 커밋하지 않는다).
- 사람이 할 일은 아래 표대로 **해당 작업을 시작할 때 메인 세션이 개발자에게 먼저 제시**하고, 끝났다는 답을 받은 뒤 진행한다.

## 단계별로 개발자가 직접 할 일

Claude가 할 수 없는 일(권한 deny, 비밀 값, 계정 승인)만 적는다.

| 작업 | 직접 할 일 | 이유 |
|---|---|---|
| 계획 | 이 구현계획 승인 | 팀 절차 |
| T1 | 없음 (끝나면 결과만 확인) | |
| T2 | 없음 (끝나면 결과만 확인) | 테스트 키는 `application-test.yml`에 Claude가 넣는다 |
| T3 | 없음 (끝나면 결과만 확인) | |
| T4 | 없음 (끝나면 결과만 확인) | |
| T5 시작 전 | ① `.env`에 `EDUHUB_JWT_SECRET=<48자 이상 무작위 문자열>` 추가 ② `.env.example`에 `EDUHUB_JWT_SECRET=` 이름만 추가 ③ (백엔드를 이미 띄워 두었다면) 다시 시작 | `.env`·`.env.example`은 deny `Read(./.env.*)`로 Claude가 수정할 수 없다. 비밀 값은 각자 만든다 |
| T5 중 | 브라우저에서 Swagger UI의 Authorize 버튼 확인(선택) | 화면 확인 |
| T6 | critical-reviewer 지적 사항 중 무엇을 고칠지 결정, PR 리뷰·병합 | 팀 절차 |

## 작업 순서

```
T1 사원 스키마·엔티티 ─> T2 보안 기반(의존성·필터 체인·오류 처리기) + 기존 테스트 이전
   ─> T3 로그인·/me ─> T4 신청 컨트롤러를 토큰 사용자로 ─> T5 OpenAPI·개발 계정·클라이언트 재생성 ─> T6 최종 확인
```

순서대로 진행한다. **T2는 의존성 추가와 기존 `@WebMvcTest` 이전을 한 작업으로 묶는다.** `spring-boot-starter-security`만 먼저 넣으면 모든 API가 기본 Basic 인증에 막혀 기존 테스트가 한꺼번에 깨지기 때문이다.

---

## T1. 사원 스키마와 엔티티

변경 파일
- 새로 만듦: `src/main/resources/db/migration/V4__create_employee.sql`
- 새로 만듦: `auth/Employee.java`, `auth/EmployeeRole.java`, `auth/EmployeeRepository.java`, `auth/package-info.java`
- 새로 만듦(테스트): `auth/EmployeeRepositoryTest.java`

내용
- `V4__create_employee.sql`: 설계명세 3장 SQL 그대로. 주석에 NFR-03, "enrollment.employee_id FK는 걸지 않음(설계 Q2)". V1~V3은 고치지 않는다.
- `EmployeeRole`: `EMPLOYEE`, `ADMIN`.
- `Employee`: `@Entity @Table(name = "employee") @Getter @NoArgsConstructor(access = PROTECTED)`. 필드 `id`(IDENTITY), `employeeNo`(length 20), `name`(length 50), `passwordHash`(length 100), `role`(`@Enumerated(STRING)`, length 20). 정적 팩터리 `create(String employeeNo, String name, String passwordHash, EmployeeRole role)` — 빈 값이면 `IllegalArgumentException`. 비밀번호 **평문을 받지 않는다**(해시만). `toString`에 해시를 넣지 않는다(Lombok `@ToString` 쓰지 않음).
- `EmployeeRepository extends JpaRepository<Employee, Long>`: `Optional<Employee> findByEmployeeNo(String employeeNo)`.
- `package-info.java`: "인증과 사원(NFR-03). enrollment가 CurrentUser를 참조한다. course는 auth에 의존하지 않는다."

테스트 (`@DataJpaTest` + `@AutoConfigureTestDatabase(replace = NONE)` + `@ActiveProfiles("test")`)
- `findByEmployeeNoReturnsSavedEmployee` (사번은 UUID 앞 12자 등 고유 값)
- `duplicateEmployeeNoViolatesUniqueIndex` (`saveAndFlush` 두 번 → `DataIntegrityViolationException`)
- `findByUnknownEmployeeNoIsEmpty`

완료 명령
```bash
./gradlew spotlessApply test --tests "com.example.eduhub.auth.EmployeeRepositoryTest"
```
(V4가 적용되고 `ddl-auto=validate`가 엔티티와 일치함을 함께 확인한다.)

커밋: `feat: 사원 테이블과 엔티티 추가(NFR-03)`

---

## T2. 보안 기반과 기존 컨트롤러 테스트 이전

변경 파일
- 수정: `backend/build.gradle.kts` — `implementation("org.springframework.boot:spring-boot-starter-security")`, `implementation("org.springframework.boot:spring-boot-starter-oauth2-resource-server")`, `testImplementation("org.springframework.security:spring-security-test")` (버전은 Boot BOM)
- 수정: `src/main/resources/application.yml` — `eduhub.jwt.secret: ${EDUHUB_JWT_SECRET}`, `eduhub.jwt.ttl-minutes: 60` (기본값 없음)
- 수정: `src/test/resources/application-test.yml` — `eduhub.jwt.secret`에 테스트 전용 고정 문자열(48자 이상, 주석 "테스트 전용, 운영 비밀 아님")
- 새로 만듦: `auth/JwtConfig.java`, `auth/SecurityConfig.java`, `auth/SecurityErrorHandlers.java`, `auth/CurrentUser.java`
- 새로 만듦(테스트): `TestAuth.java`(패키지 `com.example.eduhub`), `auth/JwtConfigTest.java`
- 수정(테스트): `enrollment/EnrollmentControllerTest.java`, `course/CourseAdminControllerTest.java`, `course/CourseControllerTest.java`, `common/health/HealthControllerTest.java`

내용 (설계명세 2-3, 2-4, 4장)
- `JwtConfig`: 생성자에서 `@Value("${eduhub.jwt.secret}")`를 UTF-8 바이트로 바꾸고 **32바이트 미만이면 `IllegalStateException`**("EDUHUB_JWT_SECRET은 32바이트 이상이어야 합니다." — 키 값은 메시지에 넣지 않는다). `SecretKeySpec(bytes, "HmacSHA256")`. 빈 `JwtEncoder`(`NimbusJwtEncoder(new ImmutableSecret<>(key))`), `JwtDecoder`(`NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build()`).
- `SecurityConfig`: `@Bean SecurityFilterChain`
  - `csrf().disable()`, `sessionManagement().sessionCreationPolicy(STATELESS)`, `httpBasic().disable()`, `formLogin().disable()`
  - `authorizeHttpRequests`: 설계명세 2-3 표 순서 그대로 (`antMatchers(HttpMethod.POST, "/api/v1/auth/login").permitAll()` → `antMatchers(HttpMethod.GET, "/api/v1/courses/**", "/api/health").permitAll()` → `antMatchers("/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**").permitAll()` → `antMatchers("/api/v1/admin/**").hasRole("ADMIN")` → `anyRequest().authenticated()`)
  - `oauth2ResourceServer().jwt().jwtAuthenticationConverter(roleConverter())` + `.authenticationEntryPoint(...)`, `exceptionHandling().authenticationEntryPoint(...).accessDeniedHandler(...)`
  - `roleConverter()`: `JwtGrantedAuthoritiesConverter`의 claim 이름 `role`, 접두어 `ROLE_`
  - `@Bean PasswordEncoder` = `BCryptPasswordEncoder`
  - 각 규칙 줄에 FR·NFR 주석 (예: `// FR-03: 과정·회차 쓰기는 관리자만`)
- `SecurityErrorHandlers`: `@Component`. `AuthenticationEntryPoint` → 401, 헤더 `WWW-Authenticate: Bearer`, 본문 `ErrorResponse("UNAUTHENTICATED", "로그인이 필요합니다.")`. `AccessDeniedHandler` → 403, `ErrorResponse("FORBIDDEN", "권한이 없습니다.")`. `ObjectMapper`로 JSON, `Content-Type: application/json;charset=UTF-8`. 예외 메시지(토큰 내용 포함 가능)는 응답에 넣지 않는다.
- `CurrentUser`: Lombok `@Value`. `employeeId`(Long), `employeeNo`, `name`, `role`(String). `static CurrentUser from(Jwt jwt)` — `sub`를 `Long.valueOf`, 나머지는 `getClaimAsString`. `boolean isAdmin()`.
- `TestAuth.as(Long employeeId, String role)`: `SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(...).claim("role", role).claim("employeeNo", "T" + id).claim("name", "테스트")).authorities(new SimpleGrantedAuthority("ROLE_" + role))`.
- 기존 `@WebMvcTest` 4개 공통: `@Import({SecurityConfig.class, SecurityErrorHandlers.class})` + `@MockBean JwtDecoder jwtDecoder` (`jwt()` 후처리기는 디코더를 거치지 않는다. 디코더 빈만 있으면 된다).
  - `EnrollmentControllerTest`: 모든 요청에 `.with(as(사원ID, "EMPLOYEE"))`를 **추가**한다. `X-Employee-Id` 헤더는 이 작업에서는 그대로 둔다(컨트롤러는 T4에서 바꾼다).
  - `CourseAdminControllerTest`: 모든 요청에 `.with(as(1L, "ADMIN"))`.
  - `CourseControllerTest`, `HealthControllerTest`: 공개 경로라 토큰 없이 그대로 통과해야 한다(추가 없음, `@Import`만).

테스트 (새로)
- `JwtConfigTest` (순수 단위): `shortSecretIsRejected`(31바이트 → `IllegalStateException`, 메시지에 키 값 없음), `encodedTokenIsDecodedWithSameKey`(인코더로 발급 → 디코더로 `sub` 확인), `tokenSignedWithOtherKeyIsRejected`(다른 키로 발급한 토큰 → `JwtException`)
- `CourseAdminControllerTest`에 추가 (설계 S7·S9): `adminApiWithoutTokenIsUnauthorized`(401, code `UNAUTHENTICATED`, `WWW-Authenticate` 헤더), `adminApiWithEmployeeTokenIsForbidden`(사원 토큰으로 `POST /api/v1/admin/courses` → 403 `FORBIDDEN`. 생성·수정·종료·회차 추가·회차 수정·회차 종료 6개 모두, 서비스는 호출되지 않음 `verifyNoInteractions`)
- `CourseControllerTest`에 추가: `courseListIsPublic`(토큰 없이 200)

완료 명령
```bash
./gradlew spotlessApply test
```
(전체 테스트. 의존성이 모든 컨트롤러에 영향을 주므로 전체를 돌린다.)

커밋: `feat: JWT 검증과 역할별 접근 제어 기반 추가(NFR-03, FR-03)`

---

## T3. 로그인과 /me API

변경 파일
- 새로 만듦: `auth/TokenService.java`, `auth/AuthService.java`, `auth/AuthController.java`, `auth/LoginRequest.java`, `auth/LoginResponse.java`, `auth/MeResponse.java`
- 새로 만듦: `common/error/UnauthorizedException.java`
- 수정: `common/error/GlobalExceptionHandler.java` — `UnauthorizedException` → 401 + `ErrorResponse(e.getCode(), e.getMessage())`
- 새로 만듦(테스트): `auth/AuthServiceTest.java`, `auth/AuthControllerTest.java`, `auth/AuthIntegrationTest.java`

내용 (설계명세 2-1, 5장)
- `TokenService`: 생성자 `JwtEncoder`, `@Value("${eduhub.jwt.ttl-minutes:60}") long`. `String issue(Employee e)`: 클레임 `iss=eduhub`, `sub=id`, `employeeNo`, `name`, `role`(enum name), `iat`, `exp`. 헤더 `JwsHeader.with(MacAlgorithm.HS256)`. `long ttlSeconds()`. 시간은 `Clock` 주입(테스트에서 만료 토큰을 만들 수 있게, 기본 `Clock.systemUTC()` 빈 또는 생성자 오버로드).
- `AuthService` (`@Service @Transactional(readOnly = true)`): `LoginResponse login(String employeeNo, String password)`.
  - 사번으로 조회. 없으면 **더미 해시와 `passwordEncoder.matches`를 한 번 실행**한 뒤 실패(응답 시간 맞춤). 더미 해시는 생성 시 `passwordEncoder.encode("dummy")`로 한 번 만들어 둔다.
  - 틀리면 `new UnauthorizedException("LOGIN_FAILED", "사번 또는 비밀번호가 올바르지 않습니다.")` — 사번 없음·비밀번호 틀림 **같은 예외, 같은 메시지**.
  - 성공: `LoginResponse(accessToken, "Bearer", ttlSeconds, MeResponse.from(employee))`.
- `UnauthorizedException`: `RuntimeException`, `code` 필드 (기존 `NotFoundException`·`ConflictException`과 같은 모양).
- `AuthController` (`@Tag(name = "Auth")`, `/api/v1`): `POST /auth/login`(operationId `login`, `@Valid @RequestBody LoginRequest`), `GET /me`(operationId `getMe`, `@AuthenticationPrincipal Jwt` → `MeResponse.from(CurrentUser.from(jwt))`). 성공·400·401 `@ApiResponse`를 모두 단다(springdoc 1.x 규칙). Controller는 `AuthService`만 부른다.
- DTO: `LoginRequest`(`@Getter @NoArgsConstructor @AllArgsConstructor`, `@NotBlank @Size(max=20) employeeNo`, `@NotBlank @Size(max=100) password`), `LoginResponse`·`MeResponse`(`@Value`). `MeResponse.from(Employee)`, `MeResponse.from(CurrentUser)`. 비밀번호 해시는 어떤 응답에도 없다.

테스트
- `AuthServiceTest` (Mockito, 실제 `BCryptPasswordEncoder`): `loginWithCorrectPasswordIssuesToken`, `unknownEmployeeNoIsLoginFailed`, `wrongPasswordIsLoginFailed`, `failureMessagesAreIdentical`(두 실패의 code·message 동일), `unknownEmployeeNoStillChecksPassword`(`PasswordEncoder` spy로 `matches` 1회 호출 확인)
- `AuthControllerTest` (`@WebMvcTest(AuthController.class)` + T2의 `@Import`·`@MockBean JwtDecoder` + `@MockBean AuthService`): `loginReturnsToken`(200), `loginWithBlankFieldsIsBadRequest`(400 `INVALID_REQUEST`), `loginFailureIsUnauthorized`(401 `LOGIN_FAILED`), `meReturnsTokenUser`(`with(as(...))` → 200), `meWithoutTokenIsUnauthorized`(401 `UNAUTHENTICATED`)
- `AuthIntegrationTest` (`@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional`, 실제 서명. 설계 S1~S3): 고유 사번으로 사원 저장 → `loginThenMeWithIssuedToken`(로그인 200 → 받은 토큰으로 `/me` 200, 이름 일치), `forgedTokenIsUnauthorized`(서명 부분을 바꾼 토큰 → 401), `expiredTokenIsUnauthorized`(과거 `Clock`의 `TokenService`로 발급한 토큰 → 401), `wrongPasswordAndUnknownNoReturnSameBody`

완료 명령
```bash
./gradlew spotlessApply test --tests "com.example.eduhub.auth.*"
```

커밋: `feat: 개발 로그인(JWT 발급)과 현재 사용자 조회 API 추가(NFR-03, NFR-04)`

---

## T4. 신청 API를 토큰 사용자로 (TODO(NFR-03) 해소)

변경 파일
- 수정: `enrollment/EnrollmentController.java`
- 수정(테스트): `enrollment/EnrollmentControllerTest.java`

내용 (설계명세 2-2)
- 세 메서드의 `@RequestHeader("X-Employee-Id") Long employeeId`와 `TODO(NFR-03)` 주석을 지우고 `@AuthenticationPrincipal Jwt jwt` → `CurrentUser.from(jwt).getEmployeeId()`로 서비스에 넘긴다. **서비스 시그니처와 경로·본문은 바꾸지 않는다.** `@Parameter(hidden = true)`로 `Jwt`가 OpenAPI 파라미터에 나오지 않게 한다.
- 각 `@Operation`에 401 응답(`ErrorResponse`)을 추가한다. 클래스 주석에 NFR-03.
- `GlobalExceptionHandler.handleMissingHeader`는 남겨 둔다(설계 4장).

테스트 (설계 S4~S6)
- 기존 테스트에서 `X-Employee-Id` 헤더를 모두 지우고 `with(as(...))`만 남긴다. 헤더 누락 400 테스트가 있으면 **삭제하고** 아래로 대체한다.
- 추가: `applyWithoutTokenIsUnauthorized`, `getWithoutTokenIsUnauthorized`, `cancelWithoutTokenIsUnauthorized`(401 `UNAUTHENTICATED`, 서비스 호출 없음), `applyUsesEmployeeIdFromToken`(토큰 사원 42 → `verify(service).apply(42L, sessionId)`), `headerEmployeeIdIsIgnored`(토큰 42 + 헤더 `X-Employee-Id: 7` → 서비스는 42로 호출)
- 남의 신청 404 테스트는 그대로 통과해야 한다.

완료 명령
```bash
./gradlew spotlessApply test --tests "com.example.eduhub.enrollment.*"
```
(동시성 테스트는 서비스를 직접 부르므로 바뀌지 않고 통과해야 한다.)

커밋: `feat: 신청·조회·취소의 신청자를 토큰 사용자로 변경(NFR-03, FR-04, FR-06)`

---

## T5. OpenAPI 인증 스킴, 개발 계정, 프론트 클라이언트 재생성

전제: 개발자가 `.env`에 `EDUHUB_JWT_SECRET`을 넣었다(없으면 `bootRun`이 의도대로 실패한다).

변경 파일
- 수정: `common/config/OpenApiConfig.java` — `Components().addSecuritySchemes("bearerAuth", new SecurityScheme().type(HTTP).scheme("bearer").bearerFormat("JWT"))`, 전역 `SecurityRequirement().addList("bearerAuth")`. 공개 API(`login`, 과정 조회, health)는 `@SecurityRequirements()`(빈 값)로 표시.
- 새로 만듦: `auth/DevAccountLoader.java` — `@Component @Profile("dev")`, `ApplicationRunner`. `employeeRepository.count() == 0`일 때만 `E1001 김사원`, `E1002 이사원`(EMPLOYEE), `A0001 박관리`(ADMIN), 비밀번호 `dev-password`의 BCrypt 해시로 생성(설계 Q3). 클래스 주석: "dev 프로필 전용. 운영 비밀 아님. 운영·테스트 프로필에서는 만들어지지 않는다."
- 수정: `backend/CLAUDE.md` — 도메인 패키지 목록에 `auth`, 의존 규칙(`enrollment → auth`), 로컬 실행에 `EDUHUB_JWT_SECRET` 필요, 개발 계정 표
- 재생성: `frontend/packages/api-client/src/*` (`npm run generate:api`, 백엔드 8080 실행 상태). `AuthApi`(`login`, `getMe`) 생성, 신청 API의 `xEmployeeId` 인자 제거 확인
- 수정(필요 시): `frontend/apps/course-mfe`는 신청 API를 쓰지 않으므로 변경 없음. 관리자 화면의 401은 Step 13~14에서 해결(설계 Q1)

테스트
- `DevAccountLoaderTest` (Mockito): `createsThreeAccountsWhenEmpty`(역할·사번, 해시가 평문이 아님), `skipsWhenAccountsExist`
- 수동 확인 (실제 출력으로 보고): `bootRun` 후 PowerShell `Invoke-RestMethod`로 로그인(E1001) → `/me` 200, 토큰 없이 `/me` 401, 사원 토큰으로 `POST /api/v1/admin/courses` 403, 관리자(A0001) 토큰으로 201. Swagger UI에 Authorize 버튼이 보인다.
- `cd frontend && npm test` 통과(생성 클라이언트 변경 영향 확인)

완료 명령
```bash
./gradlew spotlessApply test
cd ../frontend && npm run generate:api && npm test
```

커밋 2개
- `feat: OpenAPI Bearer 인증 스킴과 dev 개발 계정 추가(NFR-03, NFR-04)`
- `feat: 인증 API 클라이언트 재생성(NFR-03, NFR-04)`

---

## T6. 최종 확인

- `./gradlew check` (테스트 + spotlessCheck) 전체 실행, 실제 출력 보고
- critical-reviewer에게 설계명세 + `git diff main...` + T1~T5 검토 결과를 넘긴다. 중점: 접근 규칙 순서와 빠진 경로, 토큰 검증 우회 가능성, 비밀이 로그·응답·저장소에 남는지, 사용자 열거, 테스트가 실제 서명 경로를 지나는지
- 지적 사항은 고치기 전에 개발자에게 보인다
- PR 본문: "Claude에게 맡긴 것 / 직접 한 것", 사람이 할 일(`.env`, `.env.example`), 프론트 관리자 화면 401 안내(설계 Q1)

## 위험 영역

| 위험 | 대응 |
|---|---|
| 의존성 추가 순간 기존 API 전부 401/403 | T2에서 의존성·필터 체인·기존 테스트 이전을 한 작업으로 묶고 전체 테스트로 확인 |
| 접근 규칙 순서 실수로 관리자 API가 열림 | S7(사원 403 × 6개 API), S9(토큰 없음 401) 테스트. critical-reviewer 중점 항목 |
| `@WebMvcTest`가 `SecurityFilterChain`을 못 읽어 Boot 기본 보안으로 테스트가 엉뚱하게 통과·실패 | 모든 컨트롤러 테스트에 `@Import(SecurityConfig, SecurityErrorHandlers)` 명시. 기본 보안이면 401 코드가 `UNAUTHENTICATED`가 아니므로 code 검사로 드러난다 |
| `jwt()` 후처리기만 쓰면 실제 서명·만료 검증을 시험하지 않음 | T2 `JwtConfigTest`, T3 `AuthIntegrationTest`(실제 발급·검증, 위조, 만료) |
| 서명 키 누출 | 키를 설정 파일 기본값·예외 메시지·로그에 넣지 않는다. 테스트 키는 `application-test.yml`에만, "운영 비밀 아님" 주석 |
| 프론트 관리자 화면 401 | 설계 Q1에서 받아들임. PR 본문에 명시 |
| 테스트 DB에 사원이 쌓임 | `@Transactional` 테스트는 롤백. `@DataJpaTest`는 기본 롤백. 고유 사번 사용 |
