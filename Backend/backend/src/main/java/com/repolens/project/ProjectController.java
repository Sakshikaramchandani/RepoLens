package com.repolens.project;

import com.repolens.file.ZipUploadService;
import com.repolens.github.GithubImportService;
import com.repolens.project.ProjectDtos.*;
import com.repolens.user.User;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/projects")
@Tag(name = "Projects (Week 2)")
public class ProjectController {

    private final ProjectService projectService;
    private final ZipUploadService zipUploadService;
    private final GithubImportService githubImportService;

    public ProjectController(
            ProjectService projectService, ZipUploadService zipUploadService, GithubImportService githubImportService) {
        this.projectService = projectService;
        this.zipUploadService = zipUploadService;
        this.githubImportService = githubImportService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create project")
    public ProjectResponse create(
            @Valid @RequestBody CreateProjectRequest request, @AuthenticationPrincipal User user) {
        return projectService.create(request, user.getId());
    }

    @GetMapping
    @Operation(summary = "List logged-in user's projects")
    public List<ProjectResponse> list(@AuthenticationPrincipal User user) {
        return projectService.list(user.getId());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get one project (owner only)")
    public ProjectResponse get(@PathVariable Long id, @AuthenticationPrincipal User user) {
        return projectService.get(id, user.getId());
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update project (owner only)")
    public ProjectResponse update(
            @PathVariable Long id,
            @Valid @RequestBody UpdateProjectRequest request,
            @AuthenticationPrincipal User user) {
        return projectService.update(id, request, user.getId());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete project + its files (owner only)")
    public void delete(@PathVariable Long id, @AuthenticationPrincipal User user) {
        projectService.delete(id, user.getId());
    }

    @PostMapping(value = "/{id}/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload ZIP (replaces existing files)")
    public UploadResponse uploadZip(
            @PathVariable Long id, @RequestParam("file") MultipartFile file, @AuthenticationPrincipal User user) {
        return zipUploadService.upload(id, user.getId(), file);
    }

    @PostMapping("/{id}/github")
    @Operation(summary = "Import from GitHub: shallow clone of one branch (replaces existing files)")
    public GithubImportResponse importGithub(
            @PathVariable Long id,
            @Valid @RequestBody GithubImportRequest request,
            @AuthenticationPrincipal User user) {
        return githubImportService.importRepository(id, user.getId(), request);
    }
}
