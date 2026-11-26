package com.example.eduhub.common.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI 문서 정보 (NFR-04). 문서: /swagger-ui.html, 스펙: /v3/api-docs
 *
 * <p>인증(NFR-03): 모든 API에 Bearer JWT를 기본 요구한다. 공개 API는 @SecurityRequirements()로 제외한다.
 */
@Configuration
public class OpenApiConfig {

  private static final String BEARER_AUTH = "bearerAuth";

  @Bean
  public OpenAPI eduHubOpenApi() {
    return new OpenAPI()
        .info(new Info().title("EduHub API").description("사내 교육과정 조회 수강 신청 시스템").version("v1"))
        .components(
            new Components()
                .addSecuritySchemes(
                    BEARER_AUTH,
                    new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT")))
        .addSecurityItem(new SecurityRequirement().addList(BEARER_AUTH));
  }
}
