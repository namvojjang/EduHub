package com.example.eduhub.enrollment;

import java.util.Collection;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EnrollmentRepository extends JpaRepository<Enrollment, Long> {

  long countBySessionIdAndStatus(Long sessionId, EnrollmentStatus status);

  boolean existsByCourseIdAndEmployeeIdAndStatusIn(
      Long courseId, Long employeeId, Collection<EnrollmentStatus> statuses);
}
