package de.harmonest.api.checkin.dto;

public record CheckInValidateResponse(
        boolean valid,
        String checkInId,
        String guestFirstName,
        String checkInDate,
        String message
) {
}
