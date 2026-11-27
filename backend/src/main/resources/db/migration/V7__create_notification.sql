-- FR-09: 신청 확정·대기 승급 알림 기록. 처음에는 기록만 하고 발송은 하지 않는다.
-- employee_id에는 FK를 걸지 않는다: enrollment.employee_id도 FK가 없고(V2·V4 주석),
-- 사원 테이블에 없는 ID의 신청도 있어 FK를 걸면 알림 저장이 실패한다.
CREATE TABLE notification (
    id            BIGSERIAL    PRIMARY KEY,
    employee_id   BIGINT       NOT NULL,
    enrollment_id BIGINT       NOT NULL REFERENCES enrollment (id),
    type          VARCHAR(30)  NOT NULL,
    message       VARCHAR(200) NOT NULL,
    created_at    TIMESTAMP    NOT NULL,
    CONSTRAINT ck_notification_type CHECK (type IN ('ENROLLMENT_CONFIRMED', 'ENROLLMENT_PROMOTED'))
);

-- 사원별 최신순 조회용
CREATE INDEX idx_notification_employee ON notification (employee_id, created_at);
-- FK 인덱스
CREATE INDEX idx_notification_enrollment ON notification (enrollment_id);
