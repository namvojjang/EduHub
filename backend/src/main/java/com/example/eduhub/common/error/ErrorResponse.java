package com.example.eduhub.common.error;

import lombok.Value;

/** 모든 API의 오류 응답 본문. code는 클라이언트가 분기할 때 쓰는 고정 문자열이다. */
@Value
public class ErrorResponse {
  String code;
  String message;
}
