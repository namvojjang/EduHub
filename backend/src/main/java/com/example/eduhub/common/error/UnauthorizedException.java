package com.example.eduhub.common.error;

import lombok.Getter;

/** 인증 실패(예: 로그인 실패). GlobalExceptionHandler가 401로 바꾼다. */
@Getter
public class UnauthorizedException extends RuntimeException {

  private final String code;

  public UnauthorizedException(String code, String message) {
    super(message);
    this.code = code;
  }
}
