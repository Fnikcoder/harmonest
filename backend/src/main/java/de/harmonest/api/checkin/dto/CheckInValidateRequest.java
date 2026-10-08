package de.harmonest.api.checkin.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record CheckInValidateRequest(
        @NotBlank String confirmationCode,
        @NotBlank @Email String email
) {
}
