---
name: eduhub-api
description: EduHub 백엔드에 REST API를 추가하거나 바꿀 때 쓰는 팀 절차. 새 엔드포인트 추가, 기존 API의 요청·응답·검증 변경, 새 기능(FR-xx)의 백엔드 구현, 테이블·엔티티 추가가 필요할 때 사용한다. 화면만 바꾸는 작업이나 설정 변경에는 쓰지 않는다.
---

# EduHub API 추가 절차

기준 예시는 `backend/src/main/java/com/example/eduhub/course/`다. 같은 이름 규칙과 구조를 따른다.
시작 전에 `docs/requirements.md`에서 해당 FR·D 번호를 읽고, 코드 주석과 커밋에 그 번호를 적는다.

## 0. 먼저 확인할 제약

- Java 8 / Spring Boot 2.7 / springdoc 1.x. 검증·JPA는 `jakarta.*`가 아니라 `javax.*`.
- Java 9 이후 문법·API는 컴파일되지 않는다. 대신 쓸 것:

| 쓰지 않음 | 대신 |
|---|---|
| `record` | Lombok `@Value`(응답), `@Getter @NoArgsConstructor @AllArgsConstructor`(요청) |
| `var`, text block, switch 식 | 타입 명시, 문자열 연결, 일반 `switch` |
| `List.of`, `Map.of`, `Set.of` | `Collections.singletonList`, `Collections.emptyList`, `Arrays.asList` |
| `stream().toList()` | `collect(Collectors.toList())` |
| `Optional.orElseThrow()` (인자 없음) | `orElseThrow(() -> new XxxNotFoundException(id))` |
| `String.isBlank()`, `strip()` | `StringUtils.hasText(...)`, `trim()` |
- 계층: Controller → Service → Repository. Controller가 Repository를 직접 부르지 않는다.
- 도메인 패키지(`course`, `enrollment`) 안에 평평하게 둔다. `course`는 `enrollment`에 의존하지 않는다.
- 여러 도메인이 함께 쓰는 것(오류 형식, 페이지 응답)만 `common`에 둔다.

## 1. 스키마: Flyway

- 테이블·컬럼이 바뀌면 `src/main/resources/db/migration/V{다음번호}__{설명}.sql`을 새로 만든다.
- 이미 적용된 마이그레이션 파일은 고치지 않는다. `ddl-auto`는 `validate`라서 엔티티와 컬럼이 다르면 기동이 실패한다.
- 상태값은 `VARCHAR` + `CHECK` 제약, FK 컬럼에는 인덱스를 만든다 (PostgreSQL은 FK 인덱스를 자동으로 만들지 않는다).

## 2. 엔티티

- `@Getter`, `@NoArgsConstructor(access = PROTECTED)`만 쓴다. `@Setter` 금지.
- 생성은 정적 팩터리(`Course.create(...)`), 상태 변경은 의미 있는 메서드(`close()`, `update(...)`)로만 한다.
- 상태 규칙 위반은 엔티티가 `ConflictException(code, message)`로 막는다 (→ 409). 값 범위 위반은 `IllegalArgumentException` (→ 400).
- 연관 관계는 `@ManyToOne(fetch = LAZY)` 단방향을 기본으로 한다. 컬렉션 매핑은 필요할 때만.
- 상태는 `@Enumerated(EnumType.STRING)`, 길이·NOT NULL은 SQL과 맞춘다.

## 3. DTO (Java 8이라 record 대신 Lombok)

- 응답: Lombok `@Value`(모든 필드 final, getter, 생성자) + 정적 `from(entity)` (예: `SessionResponse`). 지연 로딩 필드를 건드리지 않게 만든다 (N+1 방지, NFR-02).
- 요청: `@Getter @NoArgsConstructor @AllArgsConstructor` (예: `CourseRequest`). 빈 생성자는 Jackson 역직렬화용, 전체 생성자는 테스트용이다.
- 요청 검증은 `javax.validation.constraints`(`@NotBlank`, `@Size`, `@Min`, `@NotNull`, `@Future`). 숫자 필수값은 `Integer` + `@NotNull`로 둔다 (`int`는 빠져도 0이 되어 검증을 통과한다). 길이 제한은 컬럼 길이와 같게.
- 엔티티를 API 응답으로 그대로 반환하지 않는다. 페이지 응답은 `PageResponse.from(page)`.

## 4. Repository

- `JpaRepository<Entity, Long>`. 조건이 선택적인 검색은 `JpaSpecificationExecutor` + `XxxSpecifications`.
- 파생 쿼리 이름 예: `findByCourseIdOrderByStartAtAsc`.

## 5. Service

- 조회 전용 서비스: 클래스에 `@Transactional(readOnly = true)` (`CourseQueryService`).
- 변경 서비스: 클래스에 `@Transactional`, 조회 메서드만 `@Transactional(readOnly = true)` (`CourseAdminService`).
- 없는 대상은 `NotFoundException`을 상속한 `XxxNotFoundException`(code 예: `COURSE_NOT_FOUND`)을 던진다 (→ 404).
- 상태 규칙은 엔티티 메서드에 맡기고, 서비스는 조회·저장·DTO 변환만 한다.

## 6. Controller와 OpenAPI (NFR-04)

- 경로는 `/api/v1/...`, 관리자 기능은 `/api/v1/admin/...`. 요청 본문은 `@Valid @RequestBody`.
- 클래스에 `@Tag`, 메서드에 `@Operation(operationId = "동사명사", summary = "...")`. operationId가 프론트 생성 메서드 이름이 된다.
- springdoc 1.x는 `@ApiResponse`를 하나라도 달면 성공 응답을 자동으로 만들지 않는다. 오류 응답을 달 때는 성공 응답(200/201)도 `content = @Content(schema = @Schema(implementation = Xxx.class))`로 함께 단다.
- 등록은 `@ResponseStatus(HttpStatus.CREATED)`. 목록은 `@ParameterObject @PageableDefault(...) Pageable`.
- 오류 본문은 항상 `ErrorResponse {code, message}`. 예외 → HTTP 상태는 `GlobalExceptionHandler`가 정한다:

| 예외 | 상태 | code |
|---|---|---|
| `MethodArgumentNotValidException`(@Valid 실패), `HttpMessageNotReadableException`, `IllegalArgumentException` | 400 | `INVALID_REQUEST` |
| `NotFoundException` 하위(`CourseNotFoundException` 등) | 404 | 예외가 정한 값 (`COURSE_NOT_FOUND`) |
| `ConflictException` | 409 | 예외가 정한 값 (`COURSE_CLOSED`) |

- 새 예외 종류가 필요하면 위 표에 맞는 공통 예외를 상속하고, 정말 새 상태 코드가 필요할 때만 핸들러에 추가한다.

## 7. 테스트

- Service 단위 테스트: `@ExtendWith(MockitoExtension.class)`, 리포지토리는 mock, 상태 규칙은 실제 엔티티로 확인 (커버리지 70%, NFR-05).
- Controller: `@WebMvcTest(XxxController.class)` + `@MockBean` 서비스. 성공·400·404·409 응답 코드와 `code` 값을 확인한다.
- Repository·검색 조건: `@DataJpaTest` + `@AutoConfigureTestDatabase(replace = NONE)` + `@ActiveProfiles("test")`. 로컬 PostgreSQL을 쓰므로, 테스트 데이터는 고유한 값(UUID 토큰)으로 넣고 그 값으로 검색한다.
- 테스트 이름은 영어 동사구(`createSessionOnClosedCourseIsConflict`).

## 8. 프론트 API 클라이언트 재생성

- 요청·응답·경로가 바뀌었으면 백엔드를 띄운 상태(8080)에서 `cd frontend && npm run generate:api`.
- 생성기는 Java 8용 5.4.0으로 고정돼 있다(`frontend/openapitools.json`). 생성 코드(`packages/api-client/src`)는 손대지 않는다.
- 생성된 메서드 이름이 `operationId`와 같은지, 새 모델 타입이 생겼는지 확인하고 함께 커밋한다.

## 검증

```bash
cd backend && ./gradlew spotlessApply test
```

- 통과할 때까지 고치고, 결과는 실제 출력(테스트 수, 실패 수)으로 보고한다.
- 커밋 메시지: `feat: ...(FR-xx)` 형식, 관련 D 번호가 있으면 본문에 적는다.
