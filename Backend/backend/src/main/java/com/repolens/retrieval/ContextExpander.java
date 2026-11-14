package com.repolens.retrieval;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Pure helpers that make retrieval cover questions spanning many files.
 *
 * - diversify(): the top chunks often all come from one file; cap chunks per file so more files
 *   make it into the prompt.
 * - referencedFiles(): one hop along the code — types, modules and imports the retrieved code
 *   mentions that are files of this project (AuthController → AuthService, JwtService), most
 *   mentioned first. Their outlines are added to the context.
 * - isBroad(): "list all endpoints", "how does the whole app work" need wider retrieval.
 */
public final class ContextExpander {

    private ContextExpander() {}

    private static final Pattern TYPE_NAME =
            Pattern.compile("\\b([A-Z][a-z0-9]+(?:[A-Z][A-Za-z0-9]*)+|[A-Z][a-z]{3,})\\b");
    private static final Pattern IMPORT_PATH =
            Pattern.compile("(?:from\\s+['\"]?|import\\s+['\"]?|require\\(\\s*['\"]|include\\s+['\"<]|use\\s+|mod\\s+)"
                    + "([\\w@./:-]+)");

    private static final Pattern BROAD = Pattern.compile("\\b(all|every|each|list|overview|architecture|structure"
            + "|summari[sz]e|summary|end[- ]to[- ]end|walk me through|step by step|whole|entire|across"
            + "|how does (?:the|this) (?:project|app|application|codebase|system|repo|service) work"
            + "|what does (?:the|this) (?:project|app|application|codebase|system|repo) do"
            + "|which (?:\\w+ ){0,3}(?:endpoints|routes|apis|controllers|tables|entities|models|services"
            + "|components|pages|screens|commands|jobs|handlers|modules|files|classes|functions))\\b");

    public static boolean isBroad(String question) {
        return question != null
                && BROAD.matcher(question.toLowerCase(Locale.ROOT)).find();
    }

    /** Ranked chunks → at most {@code limit}, no more than {@code perFile} from one file. */
    public static List<RetrievedChunk> diversify(List<RetrievedChunk> ranked, int limit, int perFile) {
        List<RetrievedChunk> picked = new ArrayList<>();
        List<RetrievedChunk> overflow = new ArrayList<>();
        Map<String, Integer> perFileCount = new HashMap<>();
        for (RetrievedChunk c : ranked) {
            if (picked.size() >= limit) {
                break;
            }
            int n = perFileCount.getOrDefault(c.filePath(), 0);
            if (n < perFile) {
                picked.add(c);
                perFileCount.put(c.filePath(), n + 1);
            } else {
                overflow.add(c);
            }
        }
        // few distinct files: fill the remaining slots with the best of the rest
        for (RetrievedChunk c : overflow) {
            if (picked.size() >= limit) {
                break;
            }
            picked.add(c);
        }
        return picked;
    }

    /**
     * Project files referenced by the given chunks but not already among them, most mentioned first.
     * Matching is by file name without extension (AuthService → .../AuthService.java,
     * auth_service → .../auth_service.py, "./utils/date" → .../utils/date.ts).
     */
    public static List<String> referencedFiles(List<RetrievedChunk> chunks, List<String> projectFiles, int max) {
        Map<String, List<String>> byStem = new HashMap<>();
        for (String path : projectFiles) {
            byStem.computeIfAbsent(stem(path), k -> new ArrayList<>()).add(path);
        }
        Set<String> already = new HashSet<>();
        for (RetrievedChunk c : chunks) {
            already.add(c.filePath());
        }

        Map<String, Integer> mentions = new LinkedHashMap<>();
        for (RetrievedChunk c : chunks) {
            String ownStem = stem(c.filePath());
            for (String ref : references(c.content())) {
                List<String> paths = byStem.get(ref);
                if (paths == null || ref.equals(ownStem) || paths.size() > 3) {
                    continue; // unknown, self, or too ambiguous (index.ts, utils.py everywhere)
                }
                for (String path : paths) {
                    if (!already.contains(path)) {
                        mentions.merge(path, 1, Integer::sum);
                    }
                }
            }
        }
        return mentions.entrySet().stream()
                .sorted((a, b) -> Integer.compare(b.getValue(), a.getValue()))
                .limit(max)
                .map(Map.Entry::getKey)
                .toList();
    }

    /** Type names and the last segment of import paths, as file stems. */
    static Set<String> references(String content) {
        Set<String> refs = new HashSet<>();
        if (content == null) {
            return refs;
        }
        Matcher types = TYPE_NAME.matcher(content);
        while (types.find()) {
            refs.add(types.group(1));
        }
        Matcher imports = IMPORT_PATH.matcher(content);
        while (imports.find()) {
            String path = imports.group(1).replaceAll("[;'\">]+$", "");
            String[] parts = path.split("[./:]+");
            for (int i = parts.length - 1; i >= 0; i--) {
                if (!parts[i].isBlank() && !parts[i].equals("*")) {
                    refs.add(parts[i]);
                    break;
                }
            }
        }
        return refs;
    }

    static String stem(String path) {
        String name = path.substring(path.lastIndexOf('/') + 1);
        int dot = name.indexOf('.');
        return dot > 0 ? name.substring(0, dot) : name;
    }
}
