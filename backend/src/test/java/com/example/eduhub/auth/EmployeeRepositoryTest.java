package com.example.eduhub.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;

/** 로컬 PostgreSQL의 테스트 DB에 Flyway V4를 적용하고 엔티티 매핑(validate)과 유일 인덱스를 확인한다 (NFR-03). */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class EmployeeRepositoryTest {

  @Autowired private EmployeeRepository employeeRepository;

  @Test
  void findByEmployeeNoReturnsSavedEmployee() {
    String no = uniqueNo();
    employeeRepository.saveAndFlush(
        Employee.create(no, "테스트", "$2a$10$hash", EmployeeRole.EMPLOYEE));

    Employee found = employeeRepository.findByEmployeeNo(no).get();

    assertThat(found.getId()).isNotNull();
    assertThat(found.getName()).isEqualTo("테스트");
    assertThat(found.getRole()).isEqualTo(EmployeeRole.EMPLOYEE);
  }

  @Test
  void duplicateEmployeeNoViolatesUniqueIndex() {
    String no = uniqueNo();
    employeeRepository.saveAndFlush(Employee.create(no, "첫째", "$2a$10$hash", EmployeeRole.ADMIN));

    assertThatThrownBy(
            () ->
                employeeRepository.saveAndFlush(
                    Employee.create(no, "둘째", "$2a$10$hash", EmployeeRole.EMPLOYEE)))
        .isInstanceOf(DataIntegrityViolationException.class);
  }

  @Test
  void findByUnknownEmployeeNoIsEmpty() {
    assertThat(employeeRepository.findByEmployeeNo(uniqueNo())).isEmpty();
  }

  /** 로컬 DB에 데이터가 남아도 충돌하지 않도록 매번 고유한 사번을 쓴다. */
  private String uniqueNo() {
    return UUID.randomUUID().toString().replace("-", "").substring(0, 12);
  }
}
