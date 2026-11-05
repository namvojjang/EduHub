package com.example.eduhub.common.error;

import lombok.Getter;

/** 조회 대상이 없을 때 던진다. GlobalExceptionHandler가 404로 바꾼다. 도메인별로 상속해 code를 정한다. */
@Getter
public abstract class NotFoundException extends RuntimeException {

  private final String code;

  protected NotFoundException(String code, String message) {
    super(message);
    this.code = code;
  }
}
