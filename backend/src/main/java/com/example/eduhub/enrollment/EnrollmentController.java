package com.example.eduhub.enrollment;

import com.example.eduhub.common.error.ErrorResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 수강 신청 API (FR-04).
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
  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public EnrollmentResponse apply(
      // TODO(NFR-03): 로그인 사용자에서 employeeId를 꺼낸다. 헤더는 임시다.
      @RequestHeader("X-Employee-Id") Long employeeId,
      @Valid @RequestBody EnrollmentRequest request) {
    return enrollmentService.apply(employeeId, request.getSessionId());
  }
}
