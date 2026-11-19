package com.example.eduhub.auth;

import com.example.eduhub.common.error.ErrorResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

/**
 * 401·403은 컨트롤러에 닿기 전에 Security 필터에서 나므로 @RestControllerAdvice가 잡지 못한다. 공통 ErrorResponse JSON을 직접
 * 쓴다 (NFR-03, NFR-04). 예외 메시지는 토큰 내용을 담을 수 있어 응답에 넣지 않는다.
 */
@Component
public class SecurityErrorHandlers {

  private final ObjectMapper objectMapper;

  public SecurityErrorHandlers(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  /** 토큰 없음·위조·만료 → 401 UNAUTHENTICATED. */
  public AuthenticationEntryPoint authenticationEntryPoint() {
    return new AuthenticationEntryPoint() {
      @Override
      public void commence(
          HttpServletRequest request,
          HttpServletResponse response,
          AuthenticationException authException)
          throws IOException {
        response.setHeader(HttpHeaders.WWW_AUTHENTICATE, "Bearer");
        write(response, HttpServletResponse.SC_UNAUTHORIZED, "UNAUTHENTICATED", "로그인이 필요합니다.");
      }
    };
  }

  /** 로그인했지만 권한 없음 → 403 FORBIDDEN. */
  public AccessDeniedHandler accessDeniedHandler() {
    return new AccessDeniedHandler() {
      @Override
      public void handle(
          HttpServletRequest request,
          HttpServletResponse response,
          AccessDeniedException accessDeniedException)
          throws IOException {
        write(response, HttpServletResponse.SC_FORBIDDEN, "FORBIDDEN", "권한이 없습니다.");
      }
    };
  }

  private void write(HttpServletResponse response, int status, String code, String message)
      throws IOException {
    response.setStatus(status);
    response.setContentType("application/json;charset=UTF-8");
    objectMapper.writeValue(response.getOutputStream(), new ErrorResponse(code, message));
  }
}
