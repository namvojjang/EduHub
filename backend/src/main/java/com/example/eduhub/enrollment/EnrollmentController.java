package com.example.eduhub.enrollment;

import com.example.eduhub.auth.CurrentUser;
import com.example.eduhub.common.error.ErrorResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 수강 신청 API (FR-04), 대기 순번 조회 (FR-05), 신청 취소와 자동 승급 (FR-06). 신청자는 토큰의 사용자다 (NFR-03).
 *
 * <p>springdoc 1.x는 @ApiResponse를 하나라도 직접 달면 성공 응답을 자동으로 만들지 않으므로 성공 응답도 명시한다.
 */
@Tag(name = "Enrollment", description = "수강 신청")
@RestController
@RequestMapping("/api/v1/enrollments")
@RequiredArgsConstructor
public class EnrollmentController {

  private final EnrollmentService enrollmentService;

  @Operation(operationId = "applyEnrollment", summary = "수강 신청 (정원이 차면 대기)")
  @ApiResponse(
      responseCode = "201",
      description = "신청됨 (확정 또는 대기)",
      content = @Content(schema = @Schema(implementation = EnrollmentResponse.class)))
  @ApiResponse(
      responseCode = "400",
      description = "입력값 오류",
      content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
  @ApiResponse(
      responseCode = "404",
      description = "회차가 없음",
      content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
  @ApiResponse(
      responseCode = "409",
      description = "모집 중이 아님 또는 이미 신청함",
      content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
  @ApiResponse(
      responseCode = "401",
      description = "로그인 필요 (토큰 없음·만료·위조)",
      content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public EnrollmentResponse apply(
      @Parameter(hidden = true) @AuthenticationPrincipal Jwt jwt,
      @Valid @RequestBody EnrollmentRequest request) {
    return enrollmentService.apply(CurrentUser.from(jwt).getEmployeeId(), request.getSessionId());
  }

  @Operation(operationId = "getEnrollment", summary = "내 신청 단건 조회 (대기 순번 포함)")
  @ApiResponse(
      responseCode = "200",
      description = "조회됨 (대기이면 waitingNumber 포함)",
      content = @Content(schema = @Schema(implementation = EnrollmentResponse.class)))
  @ApiResponse(
      responseCode = "400",
      description = "입력값 오류",
      content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
  @ApiResponse(
      responseCode = "404",
      description = "신청이 없음 (다른 직원의 신청 포함)",
      content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
  @ApiResponse(
      responseCode = "401",
      description = "로그인 필요 (토큰 없음·만료·위조)",
      content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
  @GetMapping("/{enrollmentId}")
  public EnrollmentResponse get(
      @Parameter(hidden = true) @AuthenticationPrincipal Jwt jwt, @PathVariable Long enrollmentId) {
    return enrollmentService.get(CurrentUser.from(jwt).getEmployeeId(), enrollmentId);
  }

  @Operation(operationId = "cancelEnrollment", summary = "내 신청 취소 (확정 취소 시 대기 1순위 자동 확정)")
  @ApiResponse(
      responseCode = "200",
      description = "취소됨",
      content = @Content(schema = @Schema(implementation = EnrollmentResponse.class)))
  @ApiResponse(
      responseCode = "400",
      description = "입력값 오류",
      content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
  @ApiResponse(
      responseCode = "404",
      description = "신청이 없음 (다른 직원의 신청 포함)",
      content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
  @ApiResponse(
      responseCode = "409",
      description = "ENROLLMENT_NOT_CANCELLABLE: 취소할 수 없는 상태, SESSION_ALREADY_STARTED: 이미 시작된 회차",
      content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
  @ApiResponse(
      responseCode = "401",
      description = "로그인 필요 (토큰 없음·만료·위조)",
      content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
  @PostMapping("/{enrollmentId}/cancel")
  public EnrollmentResponse cancel(
      @Parameter(hidden = true) @AuthenticationPrincipal Jwt jwt, @PathVariable Long enrollmentId) {
    return enrollmentService.cancel(CurrentUser.from(jwt).getEmployeeId(), enrollmentId);
  }
}
