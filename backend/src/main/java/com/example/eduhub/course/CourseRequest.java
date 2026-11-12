package com.example.eduhub.course;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 과정 등록·수정 요청 (FR-03). 길이 제한은 V1 마이그레이션의 컬럼 길이와 같다. */
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class CourseRequest {

  @NotBlank
  @Size(max = 200)
  private String title;

  @NotBlank
  @Size(max = 50)
  private String category;

  @Size(max = 2000)
  private String description;
}
