package de.harmonest.api.email;

import de.harmonest.api.email.dto.SendVerificationEmailRequest;
import de.harmonest.api.email.dto.VerifyEmailCodeRequest;
import de.harmonest.service.checkin.EmailVerificationService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Email verification during check-in — aligned with legacy paths:
 * {@code send-verification-email}, {@code verify-email-code}.
 */
@RestController
@RequestMapping("/api/v1/email-verification")
public class EmailVerificationController {

    private final EmailVerificationService emailVerificationService;

    public EmailVerificationController(EmailVerificationService emailVerificationService) {
        this.emailVerificationService = emailVerificationService;
    }

    @PostMapping("/send-verification-email")
    public ResponseEntity<Map<String, String>> send(@Valid @RequestBody SendVerificationEmailRequest request) {
        emailVerificationService.sendVerificationEmail(request);
        return ResponseEntity.ok(Map.of("message", "Verification email sent"));
    }

    @PostMapping("/verify-email-code")
    public ResponseEntity<Map<String, String>> verify(@Valid @RequestBody VerifyEmailCodeRequest request) {
        emailVerificationService.verifyCode(request);
        return ResponseEntity.ok(Map.of("message", "Email verified"));
    }
}
