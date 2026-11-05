# EduHub

사내 교육과정 조회 수강 신청 시스템

## 백엔드 (`backend/`)

- Java 8, Spring Boot 2.7, Gradle 7.6 (래퍼 포함)
- 패키지: `com.example.eduhub` 아래 `course`, `enrollment`, `common`
- 프로필: `dev`(기본, 로컬 PostgreSQL의 `POSTGRES_DB`), `test`(같은 서버의 테스트 DB `eduhub_test`). Docker는 쓰지 않는다
- DB 접속 정보는 루트 `.env`(또는 환경 변수)로 받는다. [.env.example](.env.example)을 `.env`로 복사해 채우면 `bootRun`과 `test`가 자동으로 읽는다

```bash
cd backend
./gradlew test            # 테스트
./gradlew spotlessApply   # 포맷 적용 (spotlessCheck는 check에 포함)
./gradlew bootRun         # 실행, 문서: http://localhost:8080/swagger-ui.html
```
