package com.repolens.risk;

import com.repolens.risk.RiskDtos.RiskReport;
import com.repolens.user.User;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/projects/{id}/risk")
@Tag(name = "Risk Analyzer")
public class RiskController {

    private final RiskService riskService;

    public RiskController(RiskService riskService) {
        this.riskService = riskService;
    }

    @GetMapping
    @Operation(summary = "Static risk score of every production Java file, highest first")
    public RiskReport risk(@PathVariable Long id, @AuthenticationPrincipal User user) {
        return riskService.analyze(id, user.getId());
    }
}
