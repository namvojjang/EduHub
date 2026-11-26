package com.example.eduhub.auth;

import com.example.eduhub.common.error.UnauthorizedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 로그인(NFR-03): 사번 조회 → BCrypt 비교 → 토큰 발급. 실패 원인은 구분하지 않는다(사용자 열거 방지). */
@Service
@Transactional(readOnly = true)
public class AuthService {

  private final EmployeeRepository employeeRepository;
  private final PasswordEncoder passwordEncoder;
  private final TokenService tokenService;
  // 사번이 없을 때도 BCrypt 비교를 한 번 수행해 응답 시간을 맞추기 위한 값
  private final String dummyHash;

  public AuthService(
      EmployeeRepository employeeRepository,
      PasswordEncoder passwordEncoder,
      TokenService tokenService) {
    this.employeeRepository = employeeRepository;
    this.passwordEncoder = passwordEncoder;
    this.tokenService = tokenService;
    this.dummyHash = passwordEncoder.encode("dummy");
  }

  public LoginResponse login(String employeeNo, String password) {
    Employee employee = employeeRepository.findByEmployeeNo(employeeNo).orElse(null);
    if (employee == null) {
      passwordEncoder.matches(password, dummyHash);
      throw loginFailed();
    }
    if (!passwordEncoder.matches(password, employee.getPasswordHash())) {
      throw loginFailed();
    }
    return new LoginResponse(
        tokenService.issue(employee),
        "Bearer",
        tokenService.ttlSeconds(),
        MeResponse.from(employee));
  }

  private UnauthorizedException loginFailed() {
    return new UnauthorizedException("LOGIN_FAILED", "사번 또는 비밀번호가 올바르지 않습니다.");
  }
}
