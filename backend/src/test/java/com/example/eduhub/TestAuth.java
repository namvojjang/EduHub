package com.example.eduhub;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;

import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;

/** 컨트롤러 테스트용 로그인 사용자(NFR-03). 사용: mockMvc.perform(get(...).with(TestAuth.as(1L, "EMPLOYEE"))) */
public final class TestAuth {

  private TestAuth() {}

  public static JwtRequestPostProcessor as(Long employeeId, String role) {
    return jwt()
        .jwt(
            j ->
                j.subject(String.valueOf(employeeId))
                    .claim("role", role)
                    .claim("employeeNo", "T" + employeeId)
                    .claim("name", "테스트"))
        .authorities(new SimpleGrantedAuthority("ROLE_" + role));
  }
}
