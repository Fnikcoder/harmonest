package de.harmonest.api.auth;

import de.harmonest.api.auth.dto.AuthResponse;
import de.harmonest.api.auth.dto.LoginRequest;
import de.harmonest.api.auth.dto.UserProfileResponse;
import de.harmonest.security.HarmonestUserDetails;
import de.harmonest.service.auth.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Management authentication — replaces Cognito sign-in for the Angular admin app.
 * <p>
 * Paths are versioned under {@code /api/v1} so we can evolve contracts without breaking clients.
 */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;

    @Autowired
    private AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @GetMapping("/me")
    public ResponseEntity<UserProfileResponse> me(@AuthenticationPrincipal HarmonestUserDetails principal) {
        if (principal == null) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(authService.getProfile(principal.getUser().getId()));
    }
}
