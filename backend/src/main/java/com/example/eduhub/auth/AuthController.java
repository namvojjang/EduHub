package com.example.eduhub.auth;

import com.example.eduhub.common.error.ErrorResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 개발 로그인과 현재 사용자 조회 (NFR-03).
 *
 * <p>springdoc 1.x는 @ApiResponse를 하나라도 직접 달면 성공 응답을 자동으로 만들지 않으므로 성공 응답도 명시한다.
 */
@Tag(name = "Auth", description = "로그인과 현재 사용자")
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class AuthController {

  private final AuthService authService;

  @SecurityRequirements()
  @Operation(operationId = "login", summary = "사번·비밀번호로 로그인 (JWT 발급)")
  @ApiResponse(
      responseCode = "200",
      description = "로그인 성공",
      content = @Content(schema = @Schema(implementation = LoginResponse.class)))
  @ApiResponse(
      responseCode = "400",
      description = "입력값 오류",
      content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
  @ApiResponse(
      responseCode = "401",
      description = "LOGIN_FAILED: 사번 또는 비밀번호가 올바르지 않음",
      content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
  @PostMapping("/auth/login")
  public LoginResponse login(@Valid @RequestBody LoginRequest request) {
    return authService.login(request.getEmployeeNo(), request.getPassword());
  }

  @Operation(operationId = "getMe", summary = "현재 로그인한 사용자 (토큰의 정보)")
  @ApiResponse(
      responseCode = "200",
      description = "현재 사용자",
      content = @Content(schema = @Schema(implementation = MeResponse.class)))
  @ApiResponse(
      responseCode = "401",
      description = "UNAUTHENTICATED: 토큰이 없거나 유효하지 않음",
      content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
  @GetMapping("/me")
  public MeResponse getMe(@Parameter(hidden = true) @AuthenticationPrincipal Jwt jwt) {
    return MeResponse.from(CurrentUser.from(jwt));
  }
}
