package de.harmonest.service.notification;

import de.harmonest.domain.notification.NotificationJobDocument;
import de.harmonest.domain.notification.NotificationJobRepository;
import de.harmonest.domain.notification.NotificationJobStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

/**
 * Polls MongoDB for notification jobs whose {@code scheduledAt} has passed and sends email.
 * <p>
 * Replaces the Lambda + EventBridge pattern with a simple scheduled task inside the monolith.
 */
@Component
public class NotificationDispatchJob {

    private static final Logger log = LoggerFactory.getLogger(NotificationDispatchJob.class);

    private final NotificationJobRepository notificationJobRepository;
    private final NotificationEmailSender emailSender;

    public NotificationDispatchJob(
            NotificationJobRepository notificationJobRepository,
            NotificationEmailSender emailSender
    ) {
        this.notificationJobRepository = notificationJobRepository;
        this.emailSender = emailSender;
    }

    /** Runs every minute — adjust cron when load increases. */
    @Scheduled(cron = "0 * * * * *")
    public void dispatchDueNotifications() {
        List<NotificationJobDocument> due = notificationJobRepository.findByStatusAndScheduledAtBefore(
                NotificationJobStatus.SCHEDULED,
                Instant.now()
        );

        for (NotificationJobDocument job : due) {
            try {
                emailSender.sendAccessNotification(job);
                job.setStatus(NotificationJobStatus.SENT);
                job.setSentAt(Instant.now());
            } catch (Exception ex) {
                log.error("Failed to send notification {}", job.getId(), ex);
                job.setStatus(NotificationJobStatus.FAILED);
                job.setLastError(ex.getMessage());
            }
            notificationJobRepository.save(job);
        }
    }
}
