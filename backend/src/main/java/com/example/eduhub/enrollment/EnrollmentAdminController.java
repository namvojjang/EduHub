package com.example.eduhub.enrollment;

import com.example.eduhub.common.error.ErrorResponse;
import com.example.eduhub.course.SessionResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 관리자용 회차 명단·수료 처리 API (FR-08). /api/v1/admin/** 는 SecurityConfig가 ADMIN만 허용한다 (NFR-03).
 *
 * <p>springdoc 1.x는 @ApiResponse를 하나라도 직접 달면 성공 응답을 자동으로 만들지 않으므로 성공 응답도 명시한다.
 */
@Tag(name = "EnrollmentAdmin", description = "관리자: 회차 명단·수료 처리")
@RestController
@RequestMapping("/api/v1/admin/sessions/{sessionId}")
@RequiredArgsConstructor
public class EnrollmentAdminController {

  private final EnrollmentAdminService enrollmentAdminService;

  @Operation(operationId = "getRoster", summary = "회차 명단 (확정·수료·미수료 + 대기 순번 순 대기자)")
  @ApiResponse(
      responseCode = "200",
      description = "조회됨 (사원 행이 없는 신청은 사번·이름 null)",
      content = @Content(schema = @Schema(implementation = RosterResponse.class)))
  @ApiResponse(
      responseCode = "401",
      description = "로그인 필요 (토큰 없음·만료·위조)",
      content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
  @ApiResponse(
      responseCode = "403",
      description = "관리자만 가능",
      content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
  @ApiResponse(
      responseCode = "404",
      description = "회차 없음 (SESSION_NOT_FOUND)",
      content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
  @GetMapping("/roster")
  public RosterResponse getRoster(@PathVariable Long sessionId) {
    return enrollmentAdminService.roster(sessionId);
  }

  @Operation(operationId = "completeSession", summary = "회차 교육 완료 (시작 시각이 지난 회차만, 남은 대기는 취소)")
  @ApiResponse(
      responseCode = "200",
      description = "완료됨",
      content = @Content(schema = @Schema(implementation = SessionResponse.class)))
  @ApiResponse(
      responseCode = "400",
      description = "잘못된 요청",
      content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
  @ApiResponse(
      responseCode = "401",
      description = "로그인 필요 (토큰 없음·만료·위조)",
      content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
  @ApiResponse(
      responseCode = "403",
      description = "관리자만 가능",
      content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
  @ApiResponse(
      responseCode = "404",
      description = "회차 없음 (SESSION_NOT_FOUND)",
      content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
  @ApiResponse(
      responseCode = "409",
      description = "시작 전 회차 (SESSION_NOT_STARTED) 또는 이미 완료 (SESSION_ALREADY_COMPLETED)",
      content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
  @PostMapping("/complete")
  public SessionResponse completeSession(@PathVariable Long sessionId) {
    return enrollmentAdminService.completeSession(sessionId);
  }

  @Operation(
      operationId = "recordCompletions",
      summary = "수료·미수료 처리 (교육 완료된 회차의 확정 신청만, 안 되는 사원은 사유와 함께)")
  @ApiResponse(
      responseCode = "200",
      description = "처리됨 (일부 실패는 failed에 사유 포함)",
      content = @Content(schema = @Schema(implementation = CompletionResponse.class)))
  @ApiResponse(
      responseCode = "400",
      description = "검증 실패 (INVALID_REQUEST)",
      content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
  @ApiResponse(
      responseCode = "401",
      description = "로그인 필요 (토큰 없음·만료·위조)",
      content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
  @ApiResponse(
      responseCode = "403",
      description = "관리자만 가능",
      content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
  @ApiResponse(
      responseCode = "404",
      description = "회차 없음 (SESSION_NOT_FOUND)",
      content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
  @ApiResponse(
      responseCode = "409",
      description = "교육 완료 전 회차 (SESSION_NOT_COMPLETED)",
      content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
  @PostMapping("/completions")
  public CompletionResponse recordCompletions(
      @PathVariable Long sessionId, @Valid @RequestBody CompletionRequest request) {
    return enrollmentAdminService.recordCompletions(
        sessionId, request.getResult(), request.getEmployeeIds());
  }
}
