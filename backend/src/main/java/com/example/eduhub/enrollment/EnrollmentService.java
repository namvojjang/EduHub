package com.example.eduhub.enrollment;

import com.example.eduhub.course.CourseSession;
import com.example.eduhub.course.CourseSessionNotFoundException;
import com.example.eduhub.course.CourseSessionRepository;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Locale;
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
    Enrollment enrollment =
        confirmed < session.getCapacity()
            ? Enrollment.confirm(session, employeeId, now)
            : Enrollment.waiting(session, employeeId, now);

    try {
      return EnrollmentResponse.from(enrollmentRepository.saveAndFlush(enrollment));
    } catch (DataIntegrityViolationException e) {
      if (isActiveEnrollmentViolation(e)) {
        throw new DuplicateEnrollmentException("이미 신청한 과정입니다: " + courseId);
      }
      throw e;
    }
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
