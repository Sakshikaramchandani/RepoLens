package com.repolens.indexing;

import com.repolens.file.RepoFile;
import com.repolens.file.RepoFileRepository;
import com.repolens.storage.StorageService;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/**
 * Alag class isliye: @Async tabhi kaam karta hai jab method DOOSRI bean se call ho.
 * Same class ke andar se call karoge toh wo normal (blocking) call ban jayegi.
 */
@Component
public class IndexWorker {

    private static final Logger log = LoggerFactory.getLogger(IndexWorker.class);

    private final IndexJobRepository jobRepository;
    private final RepoFileRepository repoFileRepository;
    private final StorageService storageService;
    private final IndexFileFilter fileFilter;
    private final CodeChunker chunker;
    private final FallbackLineChunker fallbackChunker;
    private final ChunkStore chunkStore;
    private final int batchSize;

    public IndexWorker(
            IndexJobRepository jobRepository,
            RepoFileRepository repoFileRepository,
            StorageService storageService,
            IndexFileFilter fileFilter,
            CodeChunker chunker,
            FallbackLineChunker fallbackChunker,
            ChunkStore chunkStore,
            @Value("${app.indexing.batch-size}") int batchSize) {
        this.jobRepository = jobRepository;
        this.repoFileRepository = repoFileRepository;
        this.storageService = storageService;
        this.fileFilter = fileFilter;
        this.chunker = chunker;
        this.fallbackChunker = fallbackChunker;
        this.chunkStore = chunkStore;
        this.batchSize = batchSize;
    }

    @Async("indexingExecutor")
    public void run(Long jobId, Long projectId, Long ownerId) {
        IndexJob job = jobRepository.findById(jobId).orElse(null);
        if (job == null) {
            return;
        }

        try {
            job.start();
            job = jobRepository.save(job);

            // 1. Purane chunks hatao (re-index = fresh start)
            int deleted = chunkStore.deleteByProject(projectId);
            log.info("Job {}: removed {} old chunks", jobId, deleted);

            // 2. Kaam ki files chuno
            List<RepoFile> files = repoFileRepository.findByProjectIdOrderByPathAsc(projectId).stream()
                    .filter(f -> fileFilter.shouldIndex(f.getPath()))
                    .toList();

            if (files.isEmpty()) {
                throw new IllegalStateException(
                        "No indexable files found. RepoLens indexes source code, config and docs; tests, "
                                + "generated code and dependency folders are skipped");
            }
            job.setTotalFiles(files.size());
            job = jobRepository.save(job);

            // 3. Har file: padho -> chunk -> batch bharte jao -> batch full ho toh embed + save
            Path baseDir = storageService.projectDir(ownerId, projectId);
            List<CodeChunk> batch = new ArrayList<>();
            int totalChunks = 0;

            for (RepoFile file : files) {
                Path onDisk = storageService.resolveSafely(baseDir, file.getPath());
                if (Files.exists(onDisk)) {
                    String content = new String(Files.readAllBytes(onDisk), StandardCharsets.UTF_8);

                    for (CodeChunk chunk : chunkFile(projectId, file.getPath(), content)) {
                        batch.add(chunk);
                        if (batch.size() >= batchSize) {
                            chunkStore.addBatch(batch);
                            totalChunks += batch.size();
                            batch.clear();
                        }
                    }
                } else {
                    log.warn("Job {}: file missing on disk, skipped: {}", jobId, file.getPath());
                }

                job.fileProcessed();
                job = jobRepository.save(job); // progress UI tak pahunche
            }

            // 4. Bacha hua aakhri batch
            if (!batch.isEmpty()) {
                chunkStore.addBatch(batch);
                totalChunks += batch.size();
            }

            job.markDone(totalChunks);
            jobRepository.save(job);
            log.info("Job {}: DONE. project={} files={} chunks={}", jobId, projectId, files.size(), totalChunks);

        } catch (Exception e) {
            log.error("Job {}: indexing FAILED", jobId, e);
            job.markFailed(friendlyMessage(e));
            jobRepository.save(job);
        }
    }

    /** Sakshi ka chunker kisi file par fail ho (jaise JavaParser parse error) toh fallback use karo */
    private List<CodeChunk> chunkFile(Long projectId, String path, String content) {
        try {
            return chunker.chunk(projectId, path, content);
        } catch (RuntimeException e) {
            log.warn("Chunker failed on {}, using line chunker: {}", path, e.getMessage());
            return fallbackChunker.chunk(projectId, path, content);
        }
    }

    private static String friendlyMessage(Exception e) {
        Throwable root = e;
        while (root.getCause() != null) {
            root = root.getCause();
        }
        String msg = String.valueOf(root.getMessage());
        if (msg.contains("Connection refused") || msg.contains("11434")) {
            return "Could not reach the embedding model (nomic-embed-text). Is the local model server running?";
        }
        if (msg.contains("not found") && msg.contains("model")) {
            return "Embedding model missing. Run: ollama pull nomic-embed-text";
        }
        return msg.length() > 500 ? msg.substring(0, 500) : msg;
    }
}
