-- NFR-03: 사원(로그인 계정) 테이블.
-- enrollment.employee_id FK는 걸지 않음(설계 Q2): 기존 신청 데이터에 사원 테이블에 없는 employee_id가 있어 FK를 걸면 실패한다.
CREATE TABLE employee (
    id            BIGSERIAL    PRIMARY KEY,
    employee_no   VARCHAR(20)  NOT NULL,
    name          VARCHAR(50)  NOT NULL,
    password_hash VARCHAR(100) NOT NULL,          -- BCrypt (60자). 평문 저장 금지
    role          VARCHAR(20)  NOT NULL DEFAULT 'EMPLOYEE',
    CONSTRAINT ck_employee_role CHECK (role IN ('EMPLOYEE', 'ADMIN'))
);
CREATE UNIQUE INDEX ux_employee_no ON employee (employee_no);
