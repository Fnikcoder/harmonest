package de.harmonest.domain.notification;

import de.harmonest.domain.common.AuditableDocument;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Outbound email (access / QR / PIN) scheduled after successful check-in.
 */
@Getter
@Setter
@Document(collection = "notification_jobs")
public class NotificationJobDocument extends AuditableDocument {

    @Id
    private String id;

    @Indexed
    private String checkInId;

    @Indexed
    private String reservationId;

    private NotificationJobStatus status = NotificationJobStatus.PENDING;

    /** When the email should be sent (e.g. 24h before check-in). */
    private Instant scheduledAt;

    private Instant sentAt;

    private String recipientEmail;
    private String subject;
    private String lastError;
}
