package de.harmonest.service.checkin;

import de.harmonest.api.checkin.dto.CheckInStatusResponse;
import de.harmonest.api.checkin.dto.CheckInSubmitRequest;
import de.harmonest.api.checkin.dto.CheckInValidateRequest;
import de.harmonest.api.checkin.dto.CheckInValidateResponse;
import de.harmonest.domain.checkin.CheckInDocument;
import de.harmonest.domain.checkin.CheckInRepository;
import de.harmonest.domain.checkin.CheckInStatus;
import de.harmonest.domain.reservation.ReservationDocument;
import de.harmonest.domain.reservation.ReservationRepository;
import de.harmonest.infrastructure.storage.ProofImageStorage;
import de.harmonest.service.notification.NotificationScheduler;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;

/**
 * Guest check-in orchestration — validate reservation, verify email, store proof, schedule email.
 */
@Service
public class CheckInService {

    private final ReservationRepository reservationRepository;
    private final CheckInRepository checkInRepository;
    private final ProofImageStorage proofImageStorage;
    private final NotificationScheduler notificationScheduler;

    public CheckInService(
            ReservationRepository reservationRepository,
            CheckInRepository checkInRepository,
            ProofImageStorage proofImageStorage,
            NotificationScheduler notificationScheduler
    ) {
        this.reservationRepository = reservationRepository;
        this.checkInRepository = checkInRepository;
        this.proofImageStorage = proofImageStorage;
        this.notificationScheduler = notificationScheduler;
    }

    /**
     * Step 1: confirm reservation exists and is eligible for check-in.
     */
    public CheckInValidateResponse validate(CheckInValidateRequest request) {
        ReservationDocument reservation = reservationRepository
                .findByConfirmationCodeIgnoreCase(request.confirmationCode())
                .orElseThrow(() -> new CheckInException("Reservation not found"));

        CheckInDocument checkIn = checkInRepository
                .findByConfirmationCodeIgnoreCase(request.confirmationCode())
                .orElseGet(() -> {
                    CheckInDocument doc = new CheckInDocument();
                    doc.setConfirmationCode(request.confirmationCode());
                    doc.setReservationId(reservation.getId());
                    doc.setGuestEmail(request.email());
                    doc.setStatus(CheckInStatus.DRAFT);
                    return checkInRepository.save(doc);
                });

        return new CheckInValidateResponse(
                true,
                checkIn.getId(),
                reservation.getGuestFirstName(),
                reservation.getCheckIn() != null ? reservation.getCheckIn().toString() : null,
                "Reservation found — continue check-in"
        );
    }

    /**
     * Step 2+: submit guest details and optional proof image.
     * Email verification is a separate endpoint; this method ties them together later.
     */
    public CheckInStatusResponse submit(CheckInSubmitRequest request, MultipartFile proofImage) {
        CheckInDocument checkIn = checkInRepository.findById(request.checkInId())
                .orElseThrow(() -> new CheckInException("Check-in session not found"));

        if (!checkIn.isEmailVerified()) {
            throw new CheckInException("Email must be verified before submitting check-in");
        }

        if (proofImage != null && !proofImage.isEmpty()) {
            String ref = proofImageStorage.store(checkIn.getId(), proofImage);
            checkIn.setProofImageRef(ref);
            checkIn.setStatus(CheckInStatus.PROOF_UPLOADED);
        }

        checkIn.setStatus(CheckInStatus.COMPLETED);
        checkIn.setCompletedAt(Instant.now());
        checkInRepository.save(checkIn);

        String notificationId = notificationScheduler.scheduleAfterCheckIn(checkIn);
        checkIn.setScheduledNotificationId(notificationId);
        checkInRepository.save(checkIn);

        return new CheckInStatusResponse(checkIn.getId(), checkIn.getStatus().name(), notificationId);
    }

    public CheckInStatusResponse status(String checkInId) {
        CheckInDocument checkIn = checkInRepository.findById(checkInId)
                .orElseThrow(() -> new CheckInException("Check-in not found"));
        return new CheckInStatusResponse(
                checkIn.getId(),
                checkIn.getStatus().name(),
                checkIn.getScheduledNotificationId()
        );
    }

}
