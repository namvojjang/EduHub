package com.example.eduhub.course;

import com.example.eduhub.common.error.ErrorResponse;
import com.example.eduhub.common.web.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springdoc.api.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 관리자용 과정·회차 API (FR-03).
 *
 * <p>인증·권한(NFR-03)은 아직 없다. 로그인 기능을 붙일 때 /api/v1/admin/** 를 관리자만 쓰도록 막는다.
 *
 * <p>springdoc 1.x는 @ApiResponse를 하나라도 직접 달면 성공 응답을 자동으로 만들지 않으므로 성공 응답도 명시한다.
 */
@Tag(name = "Course Admin", description = "관리자: 과정·회차 등록·수정·종료")
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class CourseAdminController {

  private final CourseAdminService courseAdminService;

  @Operation(operationId = "listAdminCourses", summary = "관리자 과정 목록 (종료된 과정 포함)")
  @GetMapping("/courses")
  public PageResponse<AdminCourseSummaryResponse> list(
      @Parameter(description = "제목 키워드") @RequestParam(required = false) String keyword,
      @Parameter(description = "분류") @RequestParam(required = false) String category,
      @ParameterObject @PageableDefault(size = 20, sort = "id", direction = Sort.Direction.DESC)
          Pageable pageable) {
    return courseAdminService.search(keyword, category, pageable);
  }

  @Operation(operationId = "createCourse", summary = "과정 등록")
  @ApiResponse(
      responseCode = "201",
      description = "등록됨",
      content = @Content(schema = @Schema(implementation = CourseDetailResponse.class)))
  @ApiResponse(
      responseCode = "400",
      description = "입력값 오류",
      content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
  @PostMapping("/courses")
  @ResponseStatus(HttpStatus.CREATED)
  public CourseDetailResponse createCourse(@Valid @RequestBody CourseRequest request) {
    return courseAdminService.createCourse(request);
  }

  @Operation(operationId = "updateCourse", summary = "과정 수정")
  @ApiResponse(
      responseCode = "200",
      description = "수정됨",
      content = @Content(schema = @Schema(implementation = CourseDetailResponse.class)))
  @ApiResponse(
      responseCode = "400",
      description = "입력값 오류",
      content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
  @ApiResponse(
      responseCode = "404",
      description = "과정이 없음",
      content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
  @PutMapping("/courses/{id}")
  public CourseDetailResponse updateCourse(
      @PathVariable Long id, @Valid @RequestBody CourseRequest request) {
    return courseAdminService.updateCourse(id, request);
  }

  @Operation(operationId = "closeCourse", summary = "과정 종료 (목록에서 숨기고 새 회차 등록을 막는다)")
  @ApiResponse(
      responseCode = "200",
      description = "종료됨",
      content = @Content(schema = @Schema(implementation = CourseDetailResponse.class)))
  @ApiResponse(
      responseCode = "404",
      description = "과정이 없음",
      content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
  @ApiResponse(
      responseCode = "409",
      description = "이미 종료됨",
      content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
  @PostMapping("/courses/{id}/close")
  public CourseDetailResponse closeCourse(@PathVariable Long id) {
    return courseAdminService.closeCourse(id);
  }

  @Operation(operationId = "createSession", summary = "회차 등록")
  @ApiResponse(
      responseCode = "201",
      description = "등록됨",
      content = @Content(schema = @Schema(implementation = SessionResponse.class)))
  @ApiResponse(
      responseCode = "400",
      description = "입력값 오류",
      content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
  @ApiResponse(
      responseCode = "404",
      description = "과정이 없음",
      content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
  @ApiResponse(
      responseCode = "409",
      description = "종료된 과정",
      content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
  @PostMapping("/courses/{id}/sessions")
  @ResponseStatus(HttpStatus.CREATED)
  public SessionResponse createSession(
      @PathVariable Long id, @Valid @RequestBody SessionRequest request) {
    return courseAdminService.createSession(id, request);
  }

  @Operation(operationId = "updateSession", summary = "회차 수정 (모집 중인 회차만)")
  @ApiResponse(
      responseCode = "200",
      description = "수정됨",
      content = @Content(schema = @Schema(implementation = SessionResponse.class)))
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
      description = "모집 중이 아님",
      content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
  @PutMapping("/sessions/{sessionId}")
  public SessionResponse updateSession(
      @PathVariable Long sessionId, @Valid @RequestBody SessionRequest request) {
    return courseAdminService.updateSession(sessionId, request);
  }

  @Operation(operationId = "closeSession", summary = "회차 모집 마감 (D-01)")
  @ApiResponse(
      responseCode = "200",
      description = "마감됨",
      content = @Content(schema = @Schema(implementation = SessionResponse.class)))
  @ApiResponse(
      responseCode = "404",
      description = "회차가 없음",
      content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
  @ApiResponse(
      responseCode = "409",
      description = "모집 중이 아님",
      content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
  @PostMapping("/sessions/{sessionId}/close")
  public SessionResponse closeSession(@PathVariable Long sessionId) {
    return courseAdminService.closeSession(sessionId);
  }
}
