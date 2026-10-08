package de.harmonest.api.email.dto;

import jakarta.validation.constraints.NotBlank;

public record VerifyEmailCodeRequest(
        @NotBlank String checkInId,
        @NotBlank String code
) {
}
