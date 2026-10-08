package de.harmonest.api.checkin;

import de.harmonest.api.checkin.dto.CheckInStatusResponse;
import de.harmonest.api.checkin.dto.CheckInSubmitRequest;
import de.harmonest.api.checkin.dto.CheckInValidateRequest;
import de.harmonest.api.checkin.dto.CheckInValidateResponse;
import de.harmonest.service.checkin.CheckInService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Public guest check-in API — mirrors legacy API Gateway paths:
 * {@code validate}, {@code submit}, {@code status}.
 */
@RestController
@RequestMapping("/api/v1/checkin")
public class CheckInController {

    private final CheckInService checkInService;

    public CheckInController(CheckInService checkInService) {
        this.checkInService = checkInService;
    }

    @PostMapping("/validate")
    public ResponseEntity<CheckInValidateResponse> validate(@Valid @RequestBody CheckInValidateRequest request) {
        return ResponseEntity.ok(checkInService.validate(request));
    }

    @PostMapping(value = "/submit", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<CheckInStatusResponse> submit(
            @Valid @RequestPart("payload") CheckInSubmitRequest request,
            @RequestPart(value = "proofImage", required = false) MultipartFile proofImage
    ) {
        return ResponseEntity.ok(checkInService.submit(request, proofImage));
    }

    /** JSON-only submit for clients that upload proof in a separate call later. */
    @PostMapping(value = "/submit", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<CheckInStatusResponse> submitJson(@Valid @RequestBody CheckInSubmitRequest request) {
        return ResponseEntity.ok(checkInService.submit(request, null));
    }

    @GetMapping("/status/{checkInId}")
    public ResponseEntity<CheckInStatusResponse> status(@PathVariable String checkInId) {
        return ResponseEntity.ok(checkInService.status(checkInId));
    }
}
