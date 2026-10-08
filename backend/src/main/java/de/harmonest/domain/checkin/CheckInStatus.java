package de.harmonest.domain.checkin;

/**
 * Lifecycle of a guest check-in attempt.
 */
public enum CheckInStatus {
    /** Guest started but has not completed all steps. */
    DRAFT,
    /** Email verification pending. */
    EMAIL_PENDING,
    /** Proof image uploaded; awaiting validation. */
    PROOF_UPLOADED,
    /** Check-in accepted; notification may be scheduled. */
    COMPLETED,
    FAILED
}
