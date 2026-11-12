package com.example.eduhub.common.error;

import lombok.Getter;

/** 현재 상태에서 할 수 없는 요청(예: 종료된 과정에 회차 추가). GlobalExceptionHandler가 409로 바꾼다. */
@Getter
public class ConflictException extends RuntimeException {

  private final String code;

  public ConflictException(String code, String message) {
    super(message);
    this.code = code;
  }
}
