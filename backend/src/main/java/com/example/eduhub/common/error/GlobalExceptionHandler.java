package com.example.eduhub.common.error;

import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/** 예외를 ErrorResponse로 바꾼다. common은 도메인 예외를 직접 알지 않고 공통 예외 타입만 다룬다. */
@RestControllerAdvice
public class GlobalExceptionHandler {

  @ExceptionHandler(NotFoundException.class)
  public ResponseEntity<ErrorResponse> handleNotFound(NotFoundException e) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND)
        .body(new ErrorResponse(e.getCode(), e.getMessage()));
  }

  @ExceptionHandler(ConflictException.class)
  public ResponseEntity<ErrorResponse> handleConflict(ConflictException e) {
    return ResponseEntity.status(HttpStatus.CONFLICT)
        .body(new ErrorResponse(e.getCode(), e.getMessage()));
  }

  @ExceptionHandler(UnauthorizedException.class)
  public ResponseEntity<ErrorResponse> handleUnauthorized(UnauthorizedException e) {
    return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
        .body(new ErrorResponse(e.getCode(), e.getMessage()));
  }

  /** @Valid 검증 실패. 어떤 필드가 왜 틀렸는지 한 줄로 알려 준다. */
  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ErrorResponse> handleInvalid(MethodArgumentNotValidException e) {
    String message =
        e.getBindingResult().getFieldErrors().stream()
            .map(error -> error.getField() + ": " + error.getDefaultMessage())
            .sorted()
            .collect(Collectors.joining(", "));
    return badRequest(message);
  }

  @ExceptionHandler(HttpMessageNotReadableException.class)
  public ResponseEntity<ErrorResponse> handleUnreadable(HttpMessageNotReadableException e) {
    return badRequest("요청 본문을 읽을 수 없습니다.");
  }

  /** 필수 헤더 누락. 공통 오류 형식으로 바꾼다. */
  @ExceptionHandler(MissingRequestHeaderException.class)
  public ResponseEntity<ErrorResponse> handleMissingHeader(MissingRequestHeaderException e) {
    return badRequest("필수 헤더가 없습니다: " + e.getHeaderName());
  }

  /** 헤더·경로·쿼리 값의 형식 오류(예: 숫자가 아닌 값). */
  @ExceptionHandler(MethodArgumentTypeMismatchException.class)
  public ResponseEntity<ErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException e) {
    return badRequest("값의 형식이 올바르지 않습니다: " + e.getName());
  }

  /** 엔티티의 값 검증(예: 정원 0 이하). 요청 검증을 통과했더라도 도메인이 마지막으로 막는다. */
  @ExceptionHandler(IllegalArgumentException.class)
  public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException e) {
    return badRequest(e.getMessage());
  }

  private ResponseEntity<ErrorResponse> badRequest(String message) {
    return ResponseEntity.badRequest().body(new ErrorResponse("INVALID_REQUEST", message));
  }
}
