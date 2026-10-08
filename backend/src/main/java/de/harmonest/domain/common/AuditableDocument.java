package de.harmonest.domain.common;

import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.annotation.Version;

import java.time.Instant;

/**
 * Base fields shared by MongoDB documents.
 * <p>
 * {@link org.springframework.data.mongodb.core.mapping.event.AuditingEntityListener}
 * populates timestamps when auditing is enabled — standard practice for traceability.
 */
@Getter
@Setter
public abstract class AuditableDocument {

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    /** Optimistic locking — prevents lost updates when two sync jobs overlap. */
    @Version
    private Long version;
}
