package com.repolens.project;

import com.repolens.common.ApiException;
import com.repolens.indexing.ChunkStore;
import com.repolens.project.ProjectDtos.CreateProjectRequest;
import com.repolens.project.ProjectDtos.ProjectResponse;
import com.repolens.project.ProjectDtos.UpdateProjectRequest;
import com.repolens.storage.StorageService;
import com.repolens.user.UserRepository;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;
    private final StorageService storageService;
    private final ChunkStore chunkStore;

    public ProjectService(
            ProjectRepository projectRepository,
            UserRepository userRepository,
            StorageService storageService,
            ChunkStore chunkStore) {
        this.projectRepository = projectRepository;
        this.userRepository = userRepository;
        this.storageService = storageService;
        this.chunkStore = chunkStore;
    }

    @Transactional
    public ProjectResponse create(CreateProjectRequest request, Long userId) {
        Project project = new Project(
                request.name().trim(), trimToNull(request.description()), userRepository.getReferenceById(userId));
        return toResponse(projectRepository.save(project));
    }

    @Transactional(readOnly = true)
    public List<ProjectResponse> list(Long userId) {
        return projectRepository.findByOwner_IdOrderByCreatedAtDesc(userId).stream()
                .map(ProjectService::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public ProjectResponse get(Long projectId, Long userId) {
        return toResponse(getOwnedProject(projectId, userId));
    }

    @Transactional
    public ProjectResponse update(Long projectId, UpdateProjectRequest request, Long userId) {
        Project project = getOwnedProject(projectId, userId);
        project.update(request.name().trim(), trimToNull(request.description()));
        return toResponse(project); // transaction khatam hote hi Hibernate khud UPDATE chalayega
    }

    @Transactional
    public void delete(Long projectId, Long userId) {
        Project project = getOwnedProject(projectId, userId);
        chunkStore.deleteByProject(projectId); // Week 3: vectors bhi hatao
        projectRepository.delete(project); // repo_files, index_jobs, github_sources cascade
        storageService.deleteProjectDir(userId, projectId); // disk se files bhi hatao
    }

    /**
     * OWNERSHIP CHECK. Project mile aur usi user ka ho, tabhi return.
     * Kisi aur ka project ho toh bhi "not found" bolte hain,
     * taaki attacker ko pata na chale ki wo project exist karta hai.
     * Sakshi ka GitHub import aur Week 3 indexing bhi yahi method use karenge.
     */
    @Transactional(readOnly = true)
    public Project getOwnedProject(Long projectId, Long userId) {
        return projectRepository
                .findByIdAndOwner_Id(projectId, userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Project not found"));
    }

    @Transactional(readOnly = true)
    public boolean isOwner(Long projectId, Long userId) {
        return projectRepository.existsByIdAndOwner_Id(projectId, userId);
    }

    public static ProjectResponse toResponse(Project p) {
        return new ProjectResponse(
                p.getId(), p.getName(), p.getDescription(), p.getSourceType().name(), p.getCreatedAt());
    }

    private static String trimToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
