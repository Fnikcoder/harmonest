package de.harmonest.service.notification;

import de.harmonest.config.HarmonestProperties;
import de.harmonest.domain.checkin.CheckInDocument;
import de.harmonest.domain.notification.NotificationJobDocument;
import de.harmonest.domain.notification.NotificationJobRepository;
import de.harmonest.domain.notification.NotificationJobStatus;
import de.harmonest.domain.reservation.ReservationRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

/**
 * Persists a notification job to MongoDB after check-in.
 * <p>
 * {@link NotificationDispatchJob} picks up due jobs on a cron schedule.
 */
@Service
public class NotificationScheduler {

    private final NotificationJobRepository notificationJobRepository;
    private final ReservationRepository reservationRepository;
    private final HarmonestProperties properties;

    public NotificationScheduler(
            NotificationJobRepository notificationJobRepository,
            ReservationRepository reservationRepository,
            HarmonestProperties properties
    ) {
        this.notificationJobRepository = notificationJobRepository;
        this.reservationRepository = reservationRepository;
        this.properties = properties;
    }

    public String scheduleAfterCheckIn(CheckInDocument checkIn) {
        NotificationJobDocument job = new NotificationJobDocument();
        job.setCheckInId(checkIn.getId());
        job.setReservationId(checkIn.getReservationId());
        job.setRecipientEmail(checkIn.getGuestEmail());
        job.setStatus(NotificationJobStatus.SCHEDULED);
        job.setSubject("Your access details — HarmoNest");

        Instant scheduledAt = reservationRepository.findById(checkIn.getReservationId())
                .map(r -> r.getCheckIn() != null
                        ? r.getCheckIn().minus(properties.getCheckin().getNotificationLeadHours(), ChronoUnit.HOURS)
                        : Instant.now().plus(1, ChronoUnit.HOURS))
                .orElse(Instant.now().plus(1, ChronoUnit.HOURS));

        job.setScheduledAt(scheduledAt);
        notificationJobRepository.save(job);
        return job.getId();
    }
}
