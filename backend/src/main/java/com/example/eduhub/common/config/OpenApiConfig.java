package com.example.eduhub.common.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** OpenAPI 문서 정보 (NFR-04). 문서: /swagger-ui.html, 스펙: /v3/api-docs */
@Configuration
public class OpenApiConfig {

  @Bean
  public OpenAPI eduHubOpenApi() {
    return new OpenAPI()
        .info(new Info().title("EduHub API").description("사내 교육과정 조회 수강 신청 시스템").version("v1"));
  }
}
