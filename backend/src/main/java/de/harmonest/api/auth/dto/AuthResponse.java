package de.harmonest.api.auth.dto;

public record AuthResponse(
        String accessToken,
        String refreshToken,
        UserProfileResponse user
) {
}
