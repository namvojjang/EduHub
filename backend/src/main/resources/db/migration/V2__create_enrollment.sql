CREATE TABLE enrollment (
    id           BIGSERIAL   PRIMARY KEY,
    session_id   BIGINT      NOT NULL REFERENCES course_session (id),
    course_id    BIGINT      NOT NULL REFERENCES course (id),  -- 회차의 과정을 복사해 둔다. 과정 단위 중복 방지용 (D-03)
    employee_id  BIGINT      NOT NULL,          -- 직원 테이블이 없어 FK 없음 (NFR-03 때 결정)
    status       VARCHAR(20) NOT NULL,
    applied_at   TIMESTAMP   NOT NULL,
    confirmed_at TIMESTAMP,
    CONSTRAINT ck_enrollment_status CHECK (status IN ('CONFIRMED', 'WAITING', 'CANCELLED', 'COMPLETED', 'NOT_COMPLETED'))
);

-- FK 인덱스 겸 확정 인원 계산(session_id + status)용
CREATE INDEX idx_enrollment_session_status ON enrollment (session_id, status);

-- FK 인덱스 겸 과정 단위 중복 사전 확인용
CREATE INDEX idx_enrollment_course_employee ON enrollment (course_id, employee_id);

-- FR-04·D-03 중복 방지의 최종 보장: 같은 과정에 유효 신청 1건.
-- 취소된 신청은 제외해 재신청을 허용한다
CREATE UNIQUE INDEX ux_enrollment_course_employee_active
    ON enrollment (course_id, employee_id)
    WHERE status IN ('CONFIRMED', 'WAITING');
