package com.example.eduhub.auth;

import lombok.Value;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.InvalidBearerTokenException;

/** 토큰에서 꺼낸 현재 사용자(NFR-03). 컨트롤러는 이것으로만 사용자를 얻는다. */
@Value
public class CurrentUser {
  Long employeeId;
  String employeeNo;
  String name;
  String role;

  /**
   * sub가 사원 id(숫자)가 아니면 인증 실패(InvalidBearerTokenException)로 다룬다. SecurityConfig의 변환 단계에서 먼저 호출해
   * 컨트롤러에 닿기 전에 401로 막는다.
   */
  public static CurrentUser from(Jwt jwt) {
    return new CurrentUser(
        parseEmployeeId(jwt.getSubject()),
        jwt.getClaimAsString("employeeNo"),
        jwt.getClaimAsString("name"),
        jwt.getClaimAsString("role"));
  }

  private static Long parseEmployeeId(String subject) {
    try {
      return Long.valueOf(subject);
    } catch (NumberFormatException e) {
      // subject가 null이어도 NumberFormatException이다. 값은 메시지에 넣지 않는다.
      throw new InvalidBearerTokenException("토큰의 sub가 사원 id가 아닙니다.");
    }
  }

  public boolean isAdmin() {
    return "ADMIN".equals(role);
  }
}
