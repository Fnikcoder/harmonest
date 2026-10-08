package de.harmonest.api.sync;

import de.harmonest.service.sync.ListingSyncService;
import de.harmonest.service.sync.ReservationSyncService;
import de.harmonest.service.sync.SyncResult;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Manual sync triggers for operations team (replaces Lambda schedulers / manual invokes).
 */
@RestController
@RequestMapping("/api/v1/sync")
public class SyncController {

    private final ListingSyncService listingSyncService;
    private final ReservationSyncService reservationSyncService;

    public SyncController(
            ListingSyncService listingSyncService,
            ReservationSyncService reservationSyncService
    ) {
        this.listingSyncService = listingSyncService;
        this.reservationSyncService = reservationSyncService;
    }

    @PostMapping("/listings")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'OWNER', 'ADMIN')")
    public ResponseEntity<SyncResult> syncListings() {
        return ResponseEntity.ok(listingSyncService.syncAll());
    }

    @PostMapping("/reservations")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'OWNER', 'ADMIN')")
    public ResponseEntity<SyncResult> syncReservations() {
        return ResponseEntity.ok(reservationSyncService.syncAll());
    }
}
