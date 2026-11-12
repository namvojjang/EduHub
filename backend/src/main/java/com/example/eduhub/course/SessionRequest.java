package com.example.eduhub.course;

import java.time.LocalDateTime;
import javax.validation.constraints.Future;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 회차 등록·수정 요청 (FR-03). */
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class SessionRequest {

  /** 회차 시작 시각. 지난 시각으로는 열 수 없다 (D-01: 시작 시각이 되면 모집 마감). */
  @NotNull @Future private LocalDateTime startAt;

  @NotBlank
  @Size(max = 200)
  private String place;

  @NotNull
  @Min(1)
  private Integer capacity;
}
