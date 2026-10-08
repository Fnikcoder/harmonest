package de.harmonest.service.checkin;

import de.harmonest.api.email.dto.SendVerificationEmailRequest;
import de.harmonest.api.email.dto.VerifyEmailCodeRequest;
import de.harmonest.domain.checkin.CheckInRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Temporary in-memory email verification until you choose SES / SMTP integration.
 * <p>
 * Production should persist codes in MongoDB with TTL index and send via mail provider.
 */
@Service
public class EmailVerificationService {

    private static final Logger log = LoggerFactory.getLogger(EmailVerificationService.class);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final CheckInRepository checkInRepository;

    /** checkInId -> (code, expiresAt) */
    private final Map<String, CodeEntry> pendingCodes = new ConcurrentHashMap<>();

    public EmailVerificationService(CheckInRepository checkInRepository) {
        this.checkInRepository = checkInRepository;
    }

    public void sendVerificationEmail(SendVerificationEmailRequest request) {
        checkInRepository.findById(request.checkInId())
                .orElseThrow(() -> new CheckInException("Check-in session not found"));

        String code = String.format("%06d", RANDOM.nextInt(1_000_000));
        pendingCodes.put(request.checkInId(), new CodeEntry(code, Instant.now().plusSeconds(900)));

        // TODO: integrate real email sender (SES, SendGrid, etc.)
        log.info("DEV ONLY — verification code for checkIn {}: {}", request.checkInId(), code);
    }

    public void verifyCode(VerifyEmailCodeRequest request) {
        CodeEntry entry = pendingCodes.get(request.checkInId());
        if (entry == null || entry.expiresAt().isBefore(Instant.now())) {
            throw new CheckInException("Verification code expired or not requested");
        }
        if (!entry.code().equals(request.code())) {
            throw new CheckInException("Invalid verification code");
        }

        pendingCodes.remove(request.checkInId());

        var checkIn = checkInRepository.findById(request.checkInId())
                .orElseThrow(() -> new CheckInException("Check-in session not found"));
        checkIn.setEmailVerified(true);
        checkInRepository.save(checkIn);
    }

    private record CodeEntry(String code, Instant expiresAt) {
    }
}
