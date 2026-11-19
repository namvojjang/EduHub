package com.example.eduhub.auth;

import lombok.Value;
import org.springframework.security.oauth2.jwt.Jwt;

/** 토큰에서 꺼낸 현재 사용자(NFR-03). 컨트롤러는 이것으로만 사용자를 얻는다. */
@Value
public class CurrentUser {
  Long employeeId;
  String employeeNo;
  String name;
  String role;

  public static CurrentUser from(Jwt jwt) {
    return new CurrentUser(
        Long.valueOf(jwt.getSubject()),
        jwt.getClaimAsString("employeeNo"),
        jwt.getClaimAsString("name"),
        jwt.getClaimAsString("role"));
  }

  public boolean isAdmin() {
    return "ADMIN".equals(role);
  }
}
