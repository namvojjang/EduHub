-- D-03: 수료한 과정은 다시 신청할 수 없다. 유효 신청 유일 인덱스에 COMPLETED를 넣는다.
-- 인덱스 이름은 그대로 둔다. EnrollmentService가 이 이름으로 중복 위반을 판별한다.
-- 같은 (과정, 사원)에 COMPLETED와 CONFIRMED/WAITING이 함께 있으면 이 마이그레이션이 실패한다.
DROP INDEX ux_enrollment_course_employee_active;
CREATE UNIQUE INDEX ux_enrollment_course_employee_active
    ON enrollment (course_id, employee_id)
    WHERE status IN ('CONFIRMED', 'WAITING', 'COMPLETED');
