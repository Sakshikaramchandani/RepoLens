package com.repolens.ai;

/**
 * A failed model call. {@code getMessage()} is safe to show to users: it never contains
 * the prompt or raw provider responses.
 *
 * @see #isRetryable() true for timeouts and connection problems
 */
public class LlmException extends RuntimeException {

    private final boolean retryable;

    public LlmException(String message, boolean retryable) {
        this(message, retryable, null);
    }

    public LlmException(String message, boolean retryable, Throwable cause) {
        super(message, cause);
        this.retryable = retryable;
    }

    /**
     * What end users see. The detailed message (status, what to fix) stays in the
     * server log; the UI only ever talks about "the AI model".
     */
    public String userMessage() {
        String detail = getMessage() == null ? "" : getMessage();
        if (detail.contains("token budget")) {
            return "The request was too large for the AI model. Try a narrower question or fewer files";
        }
        return retryable
                ? "The AI model is busy or unreachable right now. Please try again in a moment"
                : "The AI model is not available right now. Check the server's AI settings";
    }

    public boolean isRetryable() {
        return retryable;
    }
}
