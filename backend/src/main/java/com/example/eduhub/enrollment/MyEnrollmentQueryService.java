package com.example.eduhub.enrollment;

import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 내 신청 내역 조회 (FR-07). 변경·락이 있는 EnrollmentService와 나눈 조회 전용 서비스다.
 *
 * <p>employeeId는 컨트롤러가 토큰에서 꺼낸 값만 넘긴다 (NFR-03).
 */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class MyEnrollmentQueryService {

  private final EnrollmentRepository enrollmentRepository;

  /** status가 null이면 전체. 최근 신청순, SQL 한 번 (NFR-02). */
  public List<MyEnrollmentResponse> list(Long employeeId, EnrollmentStatus status) {
    return enrollmentRepository.findMyEnrollments(employeeId, status);
  }
}
