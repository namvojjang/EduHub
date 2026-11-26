package com.example.eduhub.enrollment;

import java.time.LocalDateTime;
import lombok.Value;

/**
 * 명단 한 줄 (FR-08). 사원 행이 없는 신청은 employeeNo·name이 null이다. waitingNumber는 대기만 채운다.
 *
 * <p>JPQL 생성자 표현식이 쓰는 8개 인자 생성자와, 서비스가 순번을 붙일 때 쓰는 전체 생성자를 따로 둔다.
 */
@Value
public class RosterEntry {

  Long enrollmentId;
  Long employeeId;
  String employeeNo;
  String name;
  EnrollmentStatus status;
  Integer waitingNumber;
  LocalDateTime appliedAt;
  LocalDateTime confirmedAt;
  boolean promoted;

  /** JPQL 생성자 표현식용 (순번 없음). */
  public RosterEntry(
      Long enrollmentId,
      Long employeeId,
      String employeeNo,
      String name,
      EnrollmentStatus status,
      LocalDateTime appliedAt,
      LocalDateTime confirmedAt,
      boolean promoted) {
    this(
        enrollmentId, employeeId, employeeNo, name, status, null, appliedAt, confirmedAt, promoted);
  }

  public RosterEntry(
      Long enrollmentId,
      Long employeeId,
      String employeeNo,
      String name,
      EnrollmentStatus status,
      Integer waitingNumber,
      LocalDateTime appliedAt,
      LocalDateTime confirmedAt,
      boolean promoted) {
    this.enrollmentId = enrollmentId;
    this.employeeId = employeeId;
    this.employeeNo = employeeNo;
    this.name = name;
    this.status = status;
    this.waitingNumber = waitingNumber;
    this.appliedAt = appliedAt;
    this.confirmedAt = confirmedAt;
    this.promoted = promoted;
  }

  /** 대기 순번을 붙인 복사본. */
  public RosterEntry withWaitingNumber(int number) {
    return new RosterEntry(
        enrollmentId,
        employeeId,
        employeeNo,
        name,
        status,
        number,
        appliedAt,
        confirmedAt,
        promoted);
  }
}
