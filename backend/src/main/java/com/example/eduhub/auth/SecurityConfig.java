package com.example.eduhub.auth;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;

/** 접근 규칙(NFR-03, FR-03). 위에서부터 첫 일치가 적용되므로 순서를 바꾸지 않는다. Spring Security 5.7이라 antMatchers를 쓴다. */
@Configuration
public class SecurityConfig {

  @Bean
  public SecurityFilterChain securityFilterChain(HttpSecurity http, SecurityErrorHandlers handlers)
      throws Exception {
    http.csrf()
        .disable() // Authorization 헤더로 인증하므로 쿠키 기반 CSRF 대상이 아니다
        .sessionManagement()
        .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
        .and()
        .httpBasic()
        .disable()
        .formLogin()
        .disable()
        .authorizeHttpRequests(
            auth ->
                auth
                    // NFR-03: 로그인은 공개
                    .antMatchers(HttpMethod.POST, "/api/v1/auth/login")
                    .permitAll()
                    // D-06: 공개는 로그인과 상태 확인뿐. 과정 조회(FR-01, FR-02)도 로그인 필요.
                    // 새로 추가되는 경로는 기본적으로 로그인 필요(최종 검토 제안 1)
                    .antMatchers(HttpMethod.GET, "/api/health")
                    .permitAll()
                    // NFR-04: API 문서는 공개
                    .antMatchers("/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**")
                    .permitAll()
                    // FR-03: 과정·회차 쓰기는 관리자만
                    .antMatchers("/api/v1/admin/**")
                    .hasRole("ADMIN")
                    // NFR-03: 나머지는 로그인 필요
                    .anyRequest()
                    .authenticated())
        .oauth2ResourceServer(
            oauth ->
                oauth
                    .authenticationEntryPoint(handlers.authenticationEntryPoint())
                    .accessDeniedHandler(handlers.accessDeniedHandler())
                    .jwt(jwt -> jwt.jwtAuthenticationConverter(roleConverter())))
        .exceptionHandling(
            ex ->
                ex.authenticationEntryPoint(handlers.authenticationEntryPoint())
                    .accessDeniedHandler(handlers.accessDeniedHandler()));
    return http.build();
  }

  /**
   * 토큰의 role 클레임(EMPLOYEE/ADMIN)을 ROLE_ 접두어 권한으로 바꾼다. sub가 사원 id(숫자)가 아니면 여기서 인증을
   * 거부해(AuthenticationException) 기존 진입점이 401 JSON을 내게 한다.
   */
  private Converter<Jwt, AbstractAuthenticationToken> roleConverter() {
    JwtGrantedAuthoritiesConverter authorities = new JwtGrantedAuthoritiesConverter();
    authorities.setAuthoritiesClaimName("role");
    authorities.setAuthorityPrefix("ROLE_");
    JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
    converter.setJwtGrantedAuthoritiesConverter(authorities);
    return jwt -> {
      CurrentUser.from(jwt); // sub 검증용. 숫자가 아니면 InvalidBearerTokenException
      return converter.convert(jwt);
    };
  }

  @Bean
  public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder();
  }
}
