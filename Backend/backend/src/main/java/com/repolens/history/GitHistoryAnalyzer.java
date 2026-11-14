package com.repolens.history;

import java.io.IOException;
import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.eclipse.jgit.diff.DiffEntry;
import org.eclipse.jgit.diff.DiffFormatter;
import org.eclipse.jgit.diff.RawTextComparator;
import org.eclipse.jgit.errors.MissingObjectException;
import org.eclipse.jgit.lib.Constants;
import org.eclipse.jgit.lib.ObjectId;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.revwalk.RevCommit;
import org.eclipse.jgit.revwalk.RevWalk;
import org.eclipse.jgit.util.io.DisabledOutputStream;

/**
 * Walks the newest commits of a git repository and counts, per file: how many commits changed it
 * (churn), how many of those look like bug fixes, how many people touched it, and when it last
 * changed. Merge commits and the oldest (parentless / shallow-boundary) commit are skipped, so a
 * shallow clone never counts "every file added" as a change.
 */
public final class GitHistoryAnalyzer {

    /** Commit messages that describe fixing something. */
    static final Pattern BUG_FIX = Pattern.compile(
            "(?i)\\b(fix(es|ed|ing)?|bug(s|fix|fixes)?|hotfix|regression|crash(es|ed)?|defect|patch(es|ed)?)\\b");

    public record Stats(int commits, int bugFixCommits, int authors, Instant lastChanged) {}

    /** Result: per-file stats (paths relative to the repository root) and how many commits were read. */
    public record Result(Map<String, Stats> files, int commitsRead) {

        public static Result empty() {
            return new Result(Map.of(), 0);
        }
    }

    private static final class Acc {
        int commits;
        int fixes;
        final Set<String> authors = new HashSet<>();
        Instant last;
    }

    private GitHistoryAnalyzer() {}

    public static Result analyze(Repository repo, int maxCommits) throws IOException {
        ObjectId head = repo.resolve(Constants.HEAD);
        if (head == null) {
            return Result.empty();
        }
        Map<String, Acc> acc = new HashMap<>();
        int read = 0;
        try (RevWalk walk = new RevWalk(repo);
                DiffFormatter diff = new DiffFormatter(DisabledOutputStream.INSTANCE)) {
            diff.setRepository(repo);
            diff.setDiffComparator(RawTextComparator.DEFAULT);
            diff.setDetectRenames(false);
            walk.markStart(walk.parseCommit(head));

            for (RevCommit commit : walk) {
                if (read >= maxCommits) {
                    break;
                }
                read++;
                if (commit.getParentCount() != 1) {
                    continue; // merge (counted via its parents) or root / shallow boundary
                }
                List<DiffEntry> changes;
                try {
                    RevCommit parent = walk.parseCommit(commit.getParent(0));
                    changes = diff.scan(parent.getTree(), commit.getTree());
                } catch (MissingObjectException e) {
                    break; // reached the edge of a shallow clone
                }
                boolean fix = BUG_FIX.matcher(commit.getFullMessage()).find();
                String author = commit.getAuthorIdent().getEmailAddress().toLowerCase(Locale.ROOT);
                Instant when = Instant.ofEpochSecond(commit.getCommitTime());
                for (DiffEntry change : changes) {
                    String path = change.getChangeType() == DiffEntry.ChangeType.DELETE
                            ? change.getOldPath()
                            : change.getNewPath();
                    Acc a = acc.computeIfAbsent(path, k -> new Acc());
                    a.commits++;
                    if (fix) {
                        a.fixes++;
                    }
                    a.authors.add(author);
                    if (a.last == null || when.isAfter(a.last)) {
                        a.last = when;
                    }
                }
            }
        }
        Map<String, Stats> files = new HashMap<>();
        acc.forEach((path, a) -> files.put(path, new Stats(a.commits, a.fixes, a.authors.size(), a.last)));
        return new Result(files, read);
    }
}
