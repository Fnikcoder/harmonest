package de.harmonest.integration.guesty;

public class GuestyApiException extends RuntimeException {

    public GuestyApiException(String message) {
        super(message);
    }

    public GuestyApiException(String message, Throwable cause) {
        super(message, cause);
    }
}
