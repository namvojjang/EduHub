package com.example.eduhub.auth;

import lombok.Value;

@Value
public class LoginResponse {
  String accessToken;
  String tokenType;
  long expiresIn;
  MeResponse user;
}
