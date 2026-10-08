package de.harmonest.service.sync;

/**
 * Summary returned after a Guesty sync job.
 */
public record SyncResult(int created, int updated, int fetchedFromGuesty) {
}
