package com.example.eduhub.enrollment;

import com.example.eduhub.course.CourseSession;
import com.example.eduhub.course.CourseSessionNotFoundException;
import com.example.eduhub.course.CourseSessionRepository;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Locale;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class EnrollmentService {

  private static final String ACTIVE_ENROLLMENT_INDEX = "ux_enrollment_course_employee_active";

  private final CourseSessionRepository courseSessionRepository;
  private final EnrollmentRepository enrollmentRepository;

  /**
   * 수강 신청 (FR-04, NFR-01, D-03). 정원이 차면 오류가 아니라 대기로 저장한다.
   *
   * <p>회차 행을 FOR UPDATE로 잠근 뒤에 인원을 세므로, 같은 회차 신청은 한 줄로 서서 정원을 넘지 않는다. 락은 커밋 때 풀린다. 같은 과정의 다른 회차 동시
   * 신청은 락이 막지 못하므로 유일 인덱스 위반을 DUPLICATE_ENROLLMENT로 바꾼다. 위반 후 트랜잭션은 중단 상태이므로 예외만 던지고 다른 쿼리를 하지 않는다.
   */
  public EnrollmentResponse apply(Long employeeId, Long sessionId) {
    CourseSession session =
        courseSessionRepository
            .findByIdForUpdate(sessionId)
            .orElseThrow(() -> new CourseSessionNotFoundException(sessionId));

    LocalDateTime now = LocalDateTime.now();
    session.requireOpenForEnrollment(now);

    Long courseId = session.getCourse().getId();
    if (enrollmentRepository.existsByCourseIdAndEmployeeIdAndStatusIn(
        courseId,
        employeeId,
        Arrays.asList(EnrollmentStatus.CONFIRMED, EnrollmentStatus.WAITING))) {
      throw new DuplicateEnrollmentException("이미 신청한 과정입니다: " + courseId);
    }

    long confirmed =
        enrollmentRepository.countBySessionIdAndStatus(sessionId, EnrollmentStatus.CONFIRMED);
    long waiting =
        enrollmentRepository.countBySessionIdAndStatus(sessionId, EnrollmentStatus.WAITING);
    // D-02·D-04: 대기자를 앞지르지 않는다. 정원이 늘어도 대기자가 있으면 새 신청은 대기다.
    // 정원 증가 시 자동 승급(D-02)이 생기기 전까지 이 조건이 새 신청의 대기자 추월을 막는다.
    Enrollment enrollment =
        confirmed < session.getCapacity() && waiting == 0
            ? Enrollment.confirm(session, employeeId, now)
            : Enrollment.waiting(session, employeeId, now);

    Enrollment saved;
    try {
      saved = enrollmentRepository.saveAndFlush(enrollment);
    } catch (DataIntegrityViolationException e) {
      if (isActiveEnrollmentViolation(e)) {
        throw new DuplicateEnrollmentException("이미 신청한 과정입니다: " + courseId);
      }
      throw e;
    }
    // 위반 후에는 쿼리를 하지 않는다. 순번은 정상 저장된 뒤, 회차 락을 쥔 채 계산한다 (FR-05).
    return EnrollmentResponse.from(saved, waitingNumberOf(saved));
  }

  /** 내 신청 단건 조회 (FR-05). 순번은 락 없이 읽은 조회 시점 값이다 (설계명세 6.4). 다른 직원의 신청은 없는 것으로 본다 (NFR-03). */
  @Transactional(readOnly = true)
  public EnrollmentResponse get(Long employeeId, Long enrollmentId) {
    Enrollment enrollment =
        enrollmentRepository
            .findById(enrollmentId)
            .filter(e -> employeeId.equals(e.getEmployeeId()))
            .orElseThrow(() -> new EnrollmentNotFoundException(enrollmentId));
    return EnrollmentResponse.from(enrollment, waitingNumberOf(enrollment));
  }

  /**
   * 신청 취소와 빈자리만큼 대기 순서대로 자동 승급 (FR-06, D-04, NFR-01).
   *
   * <p>순서가 중요하다. 락 전에 엔티티를 읽으면 낡은 상태로 이중 승급한다. 그래서 회차 ID만 읽고, 회차 락을 잡은 뒤에 신청 엔티티를 읽는다.
   */
  public EnrollmentResponse cancel(Long employeeId, Long enrollmentId) {
    Long sessionId =
        enrollmentRepository
            .findSessionIdByIdAndEmployeeId(enrollmentId, employeeId)
            .orElseThrow(() -> new EnrollmentNotFoundException(enrollmentId));
    CourseSession session =
        courseSessionRepository
            .findByIdForUpdate(sessionId)
            .orElseThrow(() -> new CourseSessionNotFoundException(sessionId));

    Enrollment enrollment =
        enrollmentRepository
            .findById(enrollmentId)
            .orElseThrow(() -> new EnrollmentNotFoundException(enrollmentId));
    // 방어용: 1단계에서 본인 확인을 했고 employee_id는 바뀌지 않는다.
    if (!employeeId.equals(enrollment.getEmployeeId())) {
      throw new EnrollmentNotFoundException(enrollmentId);
    }

    LocalDateTime now = LocalDateTime.now();
    session.requireNotStarted(now);

    boolean wasConfirmed = enrollment.getStatus() == EnrollmentStatus.CONFIRMED;
    enrollment.cancel();
    if (wasConfirmed) {
      promoteWaitingWhileSeatsAvailable(session, now);
    }
    return EnrollmentResponse.from(enrollment, null);
  }

  /**
   * 빈자리가 있는 동안 대기 순서대로 승급하고, 승급한 인원 수를 반환한다. 회차 락을 쥔 호출자만 부른다. D-02 정원 증가 후속 작업에서도 그대로 쓴다.
   *
   * <p>반복마다 flush한 뒤 확정 수를 다시 센다. 지금 설정(FlushMode AUTO)에서는 Hibernate가 같은 테이블 JPQL 전에 자동 flush하므로
   * 결과가 같지만, 명시적 flush는 그 설정이나 호출자의 미반영 변경과 무관하게 맞게 하는 방어 코드다(설계명세 6.2). 지우지 말 것. "취소 전 확정 수 - 1"로
   * 계산하면 취소 경로에서만 맞으므로 쓰지 않는다.
   */
  int promoteWaitingWhileSeatsAvailable(CourseSession lockedSession, LocalDateTime now) {
    Long sessionId = lockedSession.getId();
    int promoted = 0;
    while (true) {
      enrollmentRepository.flush();
      long confirmed =
          enrollmentRepository.countBySessionIdAndStatus(sessionId, EnrollmentStatus.CONFIRMED);
      if (confirmed >= lockedSession.getCapacity()) {
        return promoted;
      }
      Optional<Enrollment> first =
          enrollmentRepository.findFirstBySessionIdAndStatusOrderByAppliedAtAscIdAsc(
              sessionId, EnrollmentStatus.WAITING);
      if (!first.isPresent()) {
        return promoted;
      }
      first.get().promote(now);
      promoted++;
    }
  }

  /** 대기 순번 = 앞선 대기 수 + 1. 대기가 아니면 null (FR-05, D-04). */
  private Integer waitingNumberOf(Enrollment enrollment) {
    if (enrollment.getStatus() != EnrollmentStatus.WAITING) {
      return null;
    }
    return (int)
            enrollmentRepository.countAhead(
                enrollment.getSession().getId(),
                EnrollmentStatus.WAITING,
                enrollment.getAppliedAt(),
                enrollment.getId())
        + 1;
  }

  /**
   * 위반한 제약이 유효 신청 유일 인덱스인지 확인한다. 쿼리 없이 예외 정보만 본다. Hibernate의 제약 이름이 null이면(PostgreSQL에서 실제로 그렇다) 가장
   * 깊은 원인의 메시지에 인덱스 이름이 있는지로 확인한다.
   */
  private static boolean isActiveEnrollmentViolation(DataIntegrityViolationException e) {
    for (Throwable t = e; t != null; t = t.getCause() == t ? null : t.getCause()) {
      if (t instanceof ConstraintViolationException) {
        String name = ((ConstraintViolationException) t).getConstraintName();
        if (name != null) {
          return ACTIVE_ENROLLMENT_INDEX.equalsIgnoreCase(name);
        }
      }
    }
    String message = e.getMostSpecificCause().getMessage();
    return message != null && message.toLowerCase(Locale.ROOT).contains(ACTIVE_ENROLLMENT_INDEX);
  }
}
