package com.example.eduhub.auth;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.EnumType;
import javax.persistence.Enumerated;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 사원(로그인 계정) (NFR-03). 비밀번호는 BCrypt 해시만 받고 저장한다. toString에 해시를 넣지 않는다. */
@Entity
@Table(name = "employee")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Employee {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "employee_no", nullable = false, length = 20)
  private String employeeNo;

  @Column(nullable = false, length = 50)
  private String name;

  @Column(name = "password_hash", nullable = false, length = 100)
  private String passwordHash;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private EmployeeRole role;

  private Employee(String employeeNo, String name, String passwordHash, EmployeeRole role) {
    this.employeeNo = employeeNo;
    this.name = name;
    this.passwordHash = passwordHash;
    this.role = role;
  }

  /** passwordHash는 이미 해시된 값이다. 평문을 넘기지 않는다. */
  public static Employee create(
      String employeeNo, String name, String passwordHash, EmployeeRole role) {
    if (isBlank(employeeNo)) {
      throw new IllegalArgumentException("사번은 비어 있을 수 없습니다.");
    }
    if (isBlank(name)) {
      throw new IllegalArgumentException("이름은 비어 있을 수 없습니다.");
    }
    if (isBlank(passwordHash)) {
      throw new IllegalArgumentException("비밀번호 해시는 비어 있을 수 없습니다.");
    }
    if (role == null) {
      throw new IllegalArgumentException("역할은 비어 있을 수 없습니다.");
    }
    return new Employee(employeeNo, name, passwordHash, role);
  }

  private static boolean isBlank(String value) {
    return value == null || value.trim().isEmpty();
  }
}
