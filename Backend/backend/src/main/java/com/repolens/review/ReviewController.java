package com.repolens.review;

import com.repolens.review.ReviewDtos.ReviewRequest;
import com.repolens.review.ReviewDtos.ReviewResponse;
import com.repolens.user.User;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/projects/{id}/review")
@Tag(name = "Code Review")
public class ReviewController {

    private final ReviewService reviewService;

    public ReviewController(ReviewService reviewService) {
        this.reviewService = reviewService;
    }

    @PostMapping
    @Operation(summary = "AI code review of selected files (max 5). Issues sorted by severity")
    public ReviewResponse review(
            @PathVariable Long id, @Valid @RequestBody ReviewRequest request, @AuthenticationPrincipal User user) {
        return reviewService.review(id, user.getId(), request);
    }
}
