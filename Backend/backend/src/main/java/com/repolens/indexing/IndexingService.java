package com.repolens.indexing;

import com.repolens.common.ApiException;
import com.repolens.file.RepoFileRepository;
import com.repolens.indexing.IndexDtos.IndexJobResponse;
import com.repolens.project.ProjectService;
import java.util.List;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class IndexingService {

    private static final List<IndexJobStatus> ACTIVE = List.of(IndexJobStatus.QUEUED, IndexJobStatus.RUNNING);

    private final ProjectService projectService;
    private final IndexJobRepository jobRepository;
    private final RepoFileRepository repoFileRepository;
    private final IndexWorker indexWorker;

    public IndexingService(
            ProjectService projectService,
            IndexJobRepository jobRepository,
            RepoFileRepository repoFileRepository,
            IndexWorker indexWorker) {
        this.projectService = projectService;
        this.jobRepository = jobRepository;
        this.repoFileRepository = repoFileRepository;
        this.indexWorker = indexWorker;
    }

    /**
     * @Transactional jaan-boojh ke NAHI lagaya: job row turant commit honi chahiye,
     * taaki background thread usko DB mein dhoondh sake.
     */
    public IndexJobResponse start(Long projectId, Long userId) {
        projectService.getOwnedProject(projectId, userId); // ownership (Week 2)

        if (jobRepository.existsByProjectIdAndStatusIn(projectId, ACTIVE)) {
            throw new ApiException(HttpStatus.CONFLICT, "Indexing is already running for this project");
        }
        if (repoFileRepository.countByProjectId(projectId) == 0) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST, "Project has no files. Upload a ZIP or import from GitHub first");
        }

        IndexJob job = jobRepository.save(new IndexJob(projectId));
        indexWorker.run(job.getId(), projectId, userId); // turant return, kaam background mein
        return toResponse(job);
    }

    @Transactional(readOnly = true)
    public IndexJobResponse status(Long projectId, Long userId) {
        projectService.getOwnedProject(projectId, userId);
        return jobRepository
                .findFirstByProjectIdOrderByIdDesc(projectId)
                .map(IndexingService::toResponse)
                .orElse(new IndexJobResponse(null, projectId, "NOT_INDEXED", 0, 0, 0, null));
    }

    /** Server indexing ke beech band hua toh wo job hamesha RUNNING na dikhe */
    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void failStaleJobs() {
        jobRepository
                .findByStatusIn(ACTIVE)
                .forEach(job -> job.markFailed("Server restarted during indexing. Please start again"));
    }

    private static IndexJobResponse toResponse(IndexJob job) {
        return new IndexJobResponse(
                job.getId(),
                job.getProjectId(),
                job.getStatus().name(),
                job.getProgress(),
                job.getTotalFiles(),
                job.getProcessedFiles(),
                job.getErrorMessage());
    }
}
