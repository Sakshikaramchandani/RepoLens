package com.repolens.retrieval;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Reciprocal Rank Fusion: do ranked lists ko ek list banata hai.
 *
 * Har list chunk ko 1 / (k + rank) points deti hai (rank 1 = sabse upar). Points jod do.
 * Jo chunk DONO lists mein upar ho, wo sabse upar aata hai. Sirf position use hoti hai,
 * raw scores nahi, kyunki vector distance aur keyword rank alag-alag scale par hain.
 * k = 60 standard value hai: isse rank 1 baaki sab par haavi nahi hota.
 */
public final class RrfFusion {

    private RrfFusion() {}

    public static List<RetrievedChunk> fuse(
            List<RetrievedChunk> vectorResults, List<RetrievedChunk> keywordResults, int k, int limit) {
        Map<String, Entry> byId = new LinkedHashMap<>();

        for (int i = 0; i < vectorResults.size(); i++) {
            RetrievedChunk c = vectorResults.get(i);
            Entry e = byId.computeIfAbsent(c.id(), id -> new Entry(c));
            if (e.vectorRank == null) { // ek list mein same chunk do baar: pehli position rakho
                e.vectorRank = i + 1;
                e.score += 1.0 / (k + i + 1);
            }
        }
        for (int i = 0; i < keywordResults.size(); i++) {
            RetrievedChunk c = keywordResults.get(i);
            Entry e = byId.computeIfAbsent(c.id(), id -> new Entry(c));
            if (e.keywordRank == null) {
                e.keywordRank = i + 1;
                e.score += 1.0 / (k + i + 1);
            }
        }

        List<Entry> entries = new ArrayList<>(byId.values());
        entries.sort(Comparator.comparingDouble((Entry e) -> e.score).reversed().thenComparingInt(Entry::bestRank));

        return entries.stream()
                .limit(limit)
                .map(e -> e.chunk.withRanking(e.score, e.vectorRank, e.keywordRank))
                .toList();
    }

    private static final class Entry {
        final RetrievedChunk chunk;
        Integer vectorRank;
        Integer keywordRank;
        double score;

        Entry(RetrievedChunk chunk) {
            this.chunk = chunk;
        }

        int bestRank() {
            int v = vectorRank == null ? Integer.MAX_VALUE : vectorRank;
            int w = keywordRank == null ? Integer.MAX_VALUE : keywordRank;
            return Math.min(v, w);
        }
    }
}
