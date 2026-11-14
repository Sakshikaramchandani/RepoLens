package com.repolens.indexing;

import com.repolens.chunking.IndexableFiles;
import org.springframework.stereotype.Component;

/**
 * Which files the indexing job sends to the chunker.
 * Week 3 (Sakshi): the rules now live in com.repolens.chunking.IndexableFiles, so the job and the
 * chunker use exactly the same rules. Method name and signature unchanged, as agreed.
 */
@Component
public class IndexFileFilter {

    public boolean shouldIndex(String path) {
        return IndexableFiles.isIndexable(path);
    }
}
