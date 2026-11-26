package com.example.eduhub.auth;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * dev 프로필 전용. 운영 비밀 아님. 운영·테스트 프로필에서는 만들어지지 않는다(설계 Q3).
 *
 * <p>사원이 하나도 없을 때만 개발용 계정 3개(비밀번호 dev-password)를 만든다. 비밀번호는 로그에 쓰지 않는다.
 */
@Slf4j
@Component
@Profile("dev")
@RequiredArgsConstructor
public class DevAccountLoader implements ApplicationRunner {

  private static final String DEV_PASSWORD = "dev-password";

  private final EmployeeRepository employeeRepository;
  private final PasswordEncoder passwordEncoder;

  @Override
  public void run(ApplicationArguments args) {
    if (employeeRepository.count() != 0) {
      return;
    }
    String hash = passwordEncoder.encode(DEV_PASSWORD);
    create("E1001", "김사원", hash, EmployeeRole.EMPLOYEE);
    create("E1002", "이사원", hash, EmployeeRole.EMPLOYEE);
    create("A0001", "박관리", hash, EmployeeRole.ADMIN);
  }

  private void create(String employeeNo, String name, String hash, EmployeeRole role) {
    employeeRepository.save(Employee.create(employeeNo, name, hash, role));
    log.info("개발 계정 생성: {}", employeeNo);
  }
}
