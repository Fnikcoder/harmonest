package de.harmonest.api.checkin.dto;

import jakarta.validation.constraints.NotBlank;

public record CheckInSubmitRequest(
        @NotBlank String checkInId
) {
}
