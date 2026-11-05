package com.example.eduhub.common.web;

import java.util.List;
import lombok.Value;
import org.springframework.data.domain.Page;

/** 페이지 응답. Spring의 Page를 그대로 노출하지 않고 필요한 필드만 고정한다 (NFR-04). page는 0부터 시작한다. */
@Value
public class PageResponse<T> {
  List<T> content;
  int page;
  int size;
  long totalElements;

  public static <T> PageResponse<T> from(Page<T> page) {
    return new PageResponse<>(
        page.getContent(), page.getNumber(), page.getSize(), page.getTotalElements());
  }
}
