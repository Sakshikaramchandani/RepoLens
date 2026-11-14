package com.repolens.retrieval;

/**
 * Ek mila hua chunk.
 * vectorRank / keywordRank: us list mein position (1 = sabse upar), null = us list mein nahi mila.
 * score: final RRF score (zyada = zyada relevant).
 */
public record RetrievedChunk(
        String id,
        String filePath,
        int startLine,
        int endLine,
        String className,
        String methodName,
        String content,
        double score,
        Integer vectorRank,
        Integer keywordRank) {

    public RetrievedChunk withRanking(double newScore, Integer newVectorRank, Integer newKeywordRank) {
        return new RetrievedChunk(
                id,
                filePath,
                startLine,
                endLine,
                className,
                methodName,
                content,
                newScore,
                newVectorRank,
                newKeywordRank);
    }

    /** "AuthService.java:42-60" */
    public String citation() {
        String fileName = filePath.substring(filePath.lastIndexOf('/') + 1);
        return fileName + ":" + startLine + "-" + endLine;
    }
}
