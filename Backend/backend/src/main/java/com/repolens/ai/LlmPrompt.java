package com.repolens.ai;

/**
 * A system + user prompt pair.
 *
 * @param maxTokens upper bound for the answer; null = provider default from configuration
 */
public record LlmPrompt(String system, String user, Integer maxTokens) {

    public static LlmPrompt of(String system, String user) {
        return new LlmPrompt(system, user, null);
    }

    public LlmPrompt withMaxTokens(int tokens) {
        return new LlmPrompt(system, user, tokens);
    }
}
