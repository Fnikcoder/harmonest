package de.harmonest.api.email.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record SendVerificationEmailRequest(
        @NotBlank String checkInId,
        @NotBlank @Email String email
) {
}
