package com.example.eduhub.enrollment;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EnrollmentRepository extends JpaRepository<Enrollment, Long> {

  /** 취소 때 락 전에 회차 ID만 읽는다. 엔티티를 영속성 컨텍스트에 올리지 않기 위해서다 (설계명세 6.2). */
  @Query("select e.session.id from Enrollment e where e.id = :id")
  Optional<Long> findSessionIdById(@Param("id") Long id);

  /** 대기 순번 = 이 값 + 1. 같은 회차 WAITING 중 (appliedAt, id)가 앞선 수 (FR-05, D-04, 설계명세 Q1). */
  @Query(
      "select count(e) from Enrollment e where e.session.id = :sessionId and e.status = :status"
          + " and (e.appliedAt < :appliedAt or (e.appliedAt = :appliedAt and e.id < :id))")
  long countAhead(
      @Param("sessionId") Long sessionId,
      @Param("status") EnrollmentStatus status,
      @Param("appliedAt") LocalDateTime appliedAt,
      @Param("id") Long id);

  /** 승급 대상(대기 1순위). 순번과 같은 정렬 기준 (FR-06). */
  Optional<Enrollment> findFirstBySessionIdAndStatusOrderByAppliedAtAscIdAsc(
      Long sessionId, EnrollmentStatus status);

  long countBySessionIdAndStatus(Long sessionId, EnrollmentStatus status);

  boolean existsByCourseIdAndEmployeeIdAndStatusIn(
      Long courseId, Long employeeId, Collection<EnrollmentStatus> statuses);
}
