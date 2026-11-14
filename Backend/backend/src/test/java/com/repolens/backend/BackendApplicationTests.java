package com.repolens.backend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(
        properties = {
            "app.jwt.secret=test-only-jwt-secret-at-least-32-characters-long",
            "app.github.token-key=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
        })
class BackendApplicationTests {

    @Test
    void contextLoads() {}
}
