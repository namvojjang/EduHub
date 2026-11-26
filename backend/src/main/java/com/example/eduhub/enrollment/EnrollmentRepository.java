package com.example.eduhub.enrollment;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EnrollmentRepository extends JpaRepository<Enrollment, Long> {

  /**
   * 취소 때 락 전에 본인 신청의 회차 ID만 읽는다. 엔티티를 영속성 컨텍스트에 올리지 않고, 남의 신청이면 비어 있어 회차 락을 잡지 않는다 (설계명세 6.2,
   * NFR-03).
   */
  @Query("select e.session.id from Enrollment e where e.id = :id and e.employeeId = :employeeId")
  Optional<Long> findSessionIdByIdAndEmployeeId(
      @Param("id") Long id, @Param("employeeId") Long employeeId);

  /** FR-02 남은 자리: 회차별 해당 상태 신청 수를 쿼리 1번으로. 행은 {sessionId, count}. 신청이 없는 회차는 행이 없다. */
  @Query(
      "select e.session.id, count(e) from Enrollment e"
          + " where e.session.id in :ids and e.status in :statuses group by e.session.id")
  List<Object[]> countBySessionIds(
      @Param("ids") Collection<Long> ids, @Param("statuses") Collection<EnrollmentStatus> statuses);

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

  /** FR-08 수료 처리: 회차·사원 ID 목록으로 신청을 한 번에 읽는다. */
  List<Enrollment> findBySessionIdAndEmployeeIdIn(Long sessionId, Collection<Long> employeeIds);

  /** FR-08 회차 완료 때 남은 대기 취소용. */
  List<Enrollment> findBySessionIdAndStatus(Long sessionId, EnrollmentStatus status);

  long countBySessionIdAndStatus(Long sessionId, EnrollmentStatus status);

  boolean existsByCourseIdAndEmployeeIdAndStatusIn(
      Long courseId, Long employeeId, Collection<EnrollmentStatus> statuses);

  /** D-03 수료한 과정인지 확인 (신청 사전 확인). */
  boolean existsByCourseIdAndEmployeeIdAndStatus(
      Long courseId, Long employeeId, EnrollmentStatus status);

  /**
   * FR-08 명단. 사번·이름은 auth.Employee를 연관관계 없이 left join(엔티티 조인)한다. 사원 행이 없는 신청도 빠지지 않는다. 엔티티를 올리지 않고
   * 값만 읽는다. 정렬은 대기 순번 기준과 같은 (appliedAt, id).
   */
  @Query(
      "select new com.example.eduhub.enrollment.RosterEntry("
          + " e.id, e.employeeId, m.employeeNo, m.name, e.status, e.appliedAt, e.confirmedAt,"
          + " e.promoted)"
          + " from Enrollment e left join Employee m on m.id = e.employeeId"
          + " where e.session.id = :sessionId and e.status in :statuses"
          + " order by e.appliedAt, e.id")
  List<RosterEntry> findRoster(
      @Param("sessionId") Long sessionId, @Param("statuses") Collection<EnrollmentStatus> statuses);

  /** FR-07. 과정·회차·대기 순번을 SQL 한 번으로(NFR-02). 순번 기준은 countAhead와 같은 (appliedAt, id)(D-04). */
  @Query(
      "select new com.example.eduhub.enrollment.MyEnrollmentResponse("
          + " e.id, s.id, c.id, c.title, s.startAt, s.place, e.status,"
          + " (select count(w) from Enrollment w"
          + "   where w.session = s and w.status = com.example.eduhub.enrollment.EnrollmentStatus.WAITING"
          + "     and (w.appliedAt < e.appliedAt or (w.appliedAt = e.appliedAt and w.id <= e.id))),"
          + " e.appliedAt, e.confirmedAt, e.promoted)"
          + " from Enrollment e join e.session s join s.course c"
          + " where e.employeeId = :employeeId and (:status is null or e.status = :status)"
          + " order by e.appliedAt desc, e.id desc")
  List<MyEnrollmentResponse> findMyEnrollments(
      @Param("employeeId") Long employeeId, @Param("status") EnrollmentStatus status);
}
