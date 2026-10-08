package de.harmonest.api.checkin.dto;

public record CheckInStatusResponse(
        String checkInId,
        String status,
        String scheduledNotificationId
) {
}
