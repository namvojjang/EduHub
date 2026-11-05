# backend/CLAUDE.md

백엔드 작업 지침. 공통 규칙은 루트 `CLAUDE.md`를 따른다.

## 명령 (`backend/`에서 실행)

```bash
./gradlew test                                              # 전체 테스트
./gradlew test --tests "com.example.eduhub.common.health.HealthControllerTest"   # 테스트 하나
./gradlew check                                             # 테스트 + 포맷 검사(spotlessCheck)
./gradlew spotlessApply                                     # 포맷 적용 (google-java-format 1.7)
```

- 프로필: `dev`(기본, 로컬 PostgreSQL, 접속 정보는 `DB_URL`·`DB_USERNAME`·`DB_PASSWORD` 환경 변수), `test`(DB·JPA·Flyway 자동 설정 제외).
- Java 8이다. `var`, record, text block을 쓰지 않는다. Spring Boot 2.7이므로 `javax.*` 패키지를 쓴다(`jakarta.*` 아님).

## 패키지와 계층 규칙 (NFR-07)

- 도메인 패키지: `com.example.eduhub.course`, `com.example.eduhub.enrollment`. 공통 코드는 `com.example.eduhub.common`.
- `enrollment`는 `course`를 참조할 수 있다. `course`는 `enrollment`에 의존하지 않는다.
- 계층: Controller → Service → Repository. Controller에서 Repository를 직접 호출하지 않는다.
- 서비스 계층 테스트 커버리지 70% 이상 (NFR-05).

## JPA 규칙

- 연관 관계는 `FetchType.LAZY`로 둔다.
- 엔티티를 API 응답으로 그대로 반환하지 않는다. DTO로 바꿔 반환한다.
- `spring.jpa.open-in-view=false`를 유지한다 (NFR-02).
- 스키마는 Flyway 마이그레이션(`src/main/resources/db/migration`)으로만 바꾼다. `ddl-auto`는 `validate`다 (NFR-06).

## OpenAPI 규칙 (NFR-04)

- springdoc-openapi 1.x. 문서는 `/swagger-ui.html`, 스펙은 `/v3/api-docs`.
- 프론트 API 클라이언트는 이 스펙에서 생성하므로, API 변경은 곧 계약 변경이다.

## 도메인 핵심 규칙 (상세는 `docs/requirements.md` D-01~05)

- 정원 정합성: 동시에 100명이 마지막 1자리에 신청해도 정원을 넘으면 안 된다 (NFR-01). 동시성 테스트로 검증한다.
- 대기 순번은 저장하지 않고 신청 시각 순으로 계산한다 (D-04). 시각이 같을 때의 동점 기준은 미정이다. 임의로 정하지 않는다.
- 자동 승급: 확정 취소·정원 증가로 자리가 생기면 같은 트랜잭션에서 대기 1순위를 확정하고, 확정 시각과 승급 여부를 기록한다 (D-02, D-04).
- 회차 상태: 모집 중 → 모집 마감 → 교육 완료. "정원 마감"은 남은 자리 0으로 계산한다. 회차 시작 시 남은 대기는 취소된다 (D-01).
- 같은 과정에는 유효 신청(확정·대기) 1건만. 수료한 과정은 재신청 불가 (D-03).
- 정원은 확정 인원보다 작게 줄일 수 없다. 신청이 있는 회차·과정은 삭제하지 않는다 (D-02).
- 수료 처리는 교육 완료된 회차의 확정 신청만, 수료 또는 미수료로 (D-05). 신청 상태: 확정, 대기, 취소, 수료, 미수료.
