package com.example.eduhub.enrollment;

import com.example.eduhub.auth.CurrentUser;
import com.example.eduhub.common.error.ErrorResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 내 신청 내역 API (FR-07). 사원 ID는 토큰에서만 꺼내며 경로·쿼리·본문으로 받지 않는다 (NFR-03).
 *
 * <p>springdoc 1.x는 @ApiResponse를 하나라도 직접 달면 성공 응답을 자동으로 만들지 않으므로 성공 응답도 명시한다.
 */
@Tag(name = "Enrollment", description = "수강 신청")
@RestController
@RequestMapping("/api/v1/me")
@RequiredArgsConstructor
public class MyEnrollmentController {

  private final MyEnrollmentQueryService myEnrollmentQueryService;

  @Operation(operationId = "listMyEnrollments", summary = "내 신청 내역 (최근 신청순, 상태 필터 선택)")
  @ApiResponse(
      responseCode = "200",
      description = "조회됨 (없으면 빈 배열, 대기이면 waitingNumber 포함)",
      content =
          @Content(
              array = @ArraySchema(schema = @Schema(implementation = MyEnrollmentResponse.class))))
  @ApiResponse(
      responseCode = "400",
      description = "status 값 오류",
      content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
  @ApiResponse(
      responseCode = "401",
      description = "로그인 필요 (토큰 없음·만료·위조)",
      content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
  @GetMapping("/enrollments")
  public List<MyEnrollmentResponse> listMyEnrollments(
      @Parameter(hidden = true) @AuthenticationPrincipal Jwt jwt,
      @RequestParam(required = false) EnrollmentStatus status) {
    return myEnrollmentQueryService.list(CurrentUser.from(jwt).getEmployeeId(), status);
  }
}
