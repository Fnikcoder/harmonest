package de.harmonest.service.notification;

import de.harmonest.domain.notification.NotificationJobDocument;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Abstraction over the real mail provider (SES, SMTP, etc.).
 * <p>
 * Currently logs only — wire your template + QR/PIN content when ready.
 */
@Component
public class NotificationEmailSender {

    private static final Logger log = LoggerFactory.getLogger(NotificationEmailSender.class);

    public void sendAccessNotification(NotificationJobDocument job) {
        // TODO: build HTML from listing locks (QRLock / TTLock) — out of scope for foundation.
        log.info(
                "Sending access notification to {} for reservation {} (job {})",
                job.getRecipientEmail(),
                job.getReservationId(),
                job.getId()
        );
    }
}
