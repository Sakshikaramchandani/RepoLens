package com.repolens.retrieval;

import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Hybrid retrieval = Vector search (meaning) + Keyword search (exact naam) -> RRF merge,
 * then made fit for questions that span many files:
 *   1. diversify: at most N chunks per file, so more files make it in
 *   2. broad questions ("list all endpoints", "how does the app work") get a wider net
 *   3. one hop: outlines of project files the retrieved code references (caller → callee)
 */
@Service
public class HybridRetriever {

    private static final Logger log = LoggerFactory.getLogger(HybridRetriever.class);

    private final VectorSearcher vectorSearcher;
    private final KeywordSearcher keywordSearcher;
    private final ProjectIndex projectIndex;
    private final int candidates;
    private final int topK;
    private final int broadTopK;
    private final int relatedFiles;
    private final int rrfK;

    public HybridRetriever(
            VectorSearcher vectorSearcher,
            KeywordSearcher keywordSearcher,
            ProjectIndex projectIndex,
            @Value("${app.chat.candidates}") int candidates,
            @Value("${app.chat.top-k}") int topK,
            @Value("${app.chat.broad-top-k}") int broadTopK,
            @Value("${app.chat.related-files}") int relatedFiles,
            @Value("${app.chat.rrf-k}") int rrfK) {
        this.vectorSearcher = vectorSearcher;
        this.keywordSearcher = keywordSearcher;
        this.projectIndex = projectIndex;
        this.candidates = candidates;
        this.topK = topK;
        this.broadTopK = broadTopK;
        this.relatedFiles = relatedFiles;
        this.rrfK = rrfK;
    }

    public List<RetrievedChunk> retrieve(Long projectId, String question) {
        return retrieve(projectId, question, projectIndex.files(projectId));
    }

    /** projectFiles = every indexed path (ChatService already loaded them for the prompt's file map). */
    public List<RetrievedChunk> retrieve(Long projectId, String question, List<String> projectFiles) {
        boolean broad = ContextExpander.isBroad(question);
        int limit = broad ? broadTopK : topK;
        int perFile = broad ? 2 : 3;

        List<RetrievedChunk> vector = vectorSearcher.search(projectId, question, candidates);
        List<RetrievedChunk> keyword = keywordSearcher.search(projectId, question, candidates);
        List<RetrievedChunk> fused = RrfFusion.fuse(vector, keyword, rrfK, candidates * 2);
        List<RetrievedChunk> picked = ContextExpander.diversify(fused, limit, perFile);

        List<RetrievedChunk> result = new ArrayList<>(picked);
        List<String> related = ContextExpander.referencedFiles(picked, projectFiles, relatedFiles);
        result.addAll(projectIndex.outlines(projectId, related));

        log.debug(
                "Retrieval project={} broad={} vector={} keyword={} picked={} related={}",
                projectId,
                broad,
                vector.size(),
                keyword.size(),
                picked.size(),
                related.size());
        return result;
    }
}
