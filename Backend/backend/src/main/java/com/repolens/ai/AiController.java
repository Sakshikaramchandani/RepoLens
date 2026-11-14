package com.repolens.ai;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ai")
@Tag(name = "AI status")
public class AiController {

    private final AiStatusService statusService;

    public AiController(AiStatusService statusService) {
        this.statusService = statusService;
    }

    @GetMapping("/status")
    @Operation(summary = "Chat model and embedding model, with live reachability")
    public AiStatusService.AiStatus status() {
        return statusService.status();
    }
}
