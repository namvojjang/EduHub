-- FR-07: 내 신청 내역(employee_id로 찾고 최근 신청순)
CREATE INDEX idx_enrollment_employee_applied ON enrollment (employee_id, applied_at DESC, id DESC);
