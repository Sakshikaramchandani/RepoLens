package com.repolens.file;

import com.repolens.project.ProjectDtos.FileContentResponse;
import com.repolens.project.ProjectDtos.FileNode;
import com.repolens.user.User;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@Tag(name = "Files (Week 2)")
public class FileController {

    private final RepoFileService repoFileService;

    public FileController(RepoFileService repoFileService) {
        this.repoFileService = repoFileService;
    }

    @GetMapping("/projects/{id}/files")
    @Operation(summary = "File tree of a project (folders first)")
    public List<FileNode> fileTree(@PathVariable Long id, @AuthenticationPrincipal User user) {
        return repoFileService.getTree(id, user.getId());
    }

    @GetMapping("/files/{fileId}/content")
    @Operation(summary = "Text content of one file")
    public FileContentResponse fileContent(@PathVariable Long fileId, @AuthenticationPrincipal User user) {
        return repoFileService.getContent(fileId, user.getId());
    }
}
