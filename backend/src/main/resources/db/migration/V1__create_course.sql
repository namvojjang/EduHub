-- FR-01~03: 과정과 회차. 상태값은 D-01, D-02 기준.

CREATE TABLE course (
    id          BIGSERIAL     PRIMARY KEY,
    title       VARCHAR(200)  NOT NULL,
    category    VARCHAR(50)   NOT NULL,
    description VARCHAR(2000),
    status      VARCHAR(20)   NOT NULL,
    CONSTRAINT ck_course_status CHECK (status IN ('OPEN', 'CLOSED'))
);

CREATE TABLE course_session (
    id        BIGSERIAL    PRIMARY KEY,
    course_id BIGINT       NOT NULL REFERENCES course (id),
    start_at  TIMESTAMP    NOT NULL,
    place     VARCHAR(200) NOT NULL,
    capacity  INTEGER      NOT NULL,
    status    VARCHAR(20)  NOT NULL,
    CONSTRAINT ck_course_session_capacity CHECK (capacity > 0),
    CONSTRAINT ck_course_session_status CHECK (status IN ('RECRUITING', 'CLOSED', 'COMPLETED'))
);

-- PostgreSQL은 FK에 인덱스를 자동으로 만들지 않는다. 과정 상세의 회차 조회(FR-02)에 쓴다.
CREATE INDEX idx_course_session_course_id ON course_session (course_id);
