package de.harmonest.api.auth.dto;

public record UserProfileResponse(
        String userId,
        String email,
        String firstName,
        String lastName,
        String role,
        boolean emailVerified
) {
}
