package com.repolens.indexing;

import com.repolens.indexing.IndexDtos.IndexJobResponse;
import com.repolens.user.User;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/projects/{id}/index")
@Tag(name = "Indexing (Week 3)")
public class IndexController {

    private final IndexingService indexingService;

    public IndexController(IndexingService indexingService) {
        this.indexingService = indexingService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.ACCEPTED)
    @Operation(summary = "Start async indexing job (returns immediately with QUEUED)")
    public IndexJobResponse start(@PathVariable Long id, @AuthenticationPrincipal User user) {
        return indexingService.start(id, user.getId());
    }

    @GetMapping("/status")
    @Operation(summary = "Latest job status + progress. NOT_INDEXED if never indexed")
    public IndexJobResponse status(@PathVariable Long id, @AuthenticationPrincipal User user) {
        return indexingService.status(id, user.getId());
    }
}
