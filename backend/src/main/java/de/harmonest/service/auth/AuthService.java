package de.harmonest.service.auth;

import de.harmonest.api.auth.dto.AuthResponse;
import de.harmonest.api.auth.dto.LoginRequest;
import de.harmonest.api.auth.dto.UserProfileResponse;
import de.harmonest.domain.user.UserDocument;
import de.harmonest.domain.user.UserRepository;
import de.harmonest.security.HarmonestUserDetails;
import de.harmonest.security.JwtService;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

/**
 * Handles login and profile for management users (replaces Cognito sign-in for new backend).
 */
@Service
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final UserRepository userRepository;

    public AuthService(
            AuthenticationManager authenticationManager,
            JwtService jwtService,
            UserRepository userRepository
    ) {
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    public AuthResponse login(LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.email(), request.password())
        );

        HarmonestUserDetails details = (HarmonestUserDetails) authentication.getPrincipal();
        UserDocument user = details.getUser();

        return new AuthResponse(
                jwtService.createAccessToken(user),
                jwtService.createRefreshToken(user),
                toProfile(user)
        );
    }

    public UserProfileResponse getProfile(String userId) {
        UserDocument user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        return toProfile(user);
    }

    private static UserProfileResponse toProfile(UserDocument user) {
        return new UserProfileResponse(
                user.getId(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                user.getRole().name().toLowerCase(),
                user.isEmailVerified()
        );
    }
}
