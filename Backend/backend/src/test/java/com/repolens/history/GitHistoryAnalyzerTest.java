package com.repolens.history;

import static org.junit.jupiter.api.Assertions.*;

import java.nio.file.Files;
import java.nio.file.Path;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.lib.PersonIdent;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class GitHistoryAnalyzerTest {

    @TempDir
    Path dir;

    private void commit(Git git, String file, String content, String message, String email) throws Exception {
        Path path = dir.resolve(file);
        Files.createDirectories(path.getParent());
        Files.writeString(path, content);
        git.add().addFilepattern(file).call();
        PersonIdent who = new PersonIdent("Dev", email);
        git.commit().setMessage(message).setAuthor(who).setCommitter(who).call();
    }

    @Test
    void countsChurnBugFixesAndAuthorsPerFile() throws Exception {
        try (Git git = Git.init().setDirectory(dir.toFile()).call()) {
            commit(git, "src/a.py", "a = 1", "Initial commit", "ana@x.dev"); // root: not counted
            commit(git, "src/a.py", "a = 2", "Fix crash when a is empty", "ana@x.dev");
            commit(git, "src/a.py", "a = 3", "Add feature", "bo@x.dev");
            commit(git, "src/b.ts", "b", "Add b", "bo@x.dev");
            commit(git, "src/a.py", "a = 4", "hotfix: wrong total", "ana@x.dev");

            GitHistoryAnalyzer.Result result = GitHistoryAnalyzer.analyze(git.getRepository(), 300);
            assertEquals(5, result.commitsRead());
            GitHistoryAnalyzer.Stats a = result.files().get("src/a.py");
            assertEquals(3, a.commits());
            assertEquals(2, a.bugFixCommits());
            assertEquals(2, a.authors());
            assertEquals(1, result.files().get("src/b.ts").commits());

            GitHistoryAnalyzer.Result limited = GitHistoryAnalyzer.analyze(git.getRepository(), 2);
            assertEquals(2, limited.commitsRead());
            assertEquals(1, limited.files().get("src/a.py").commits());
        }
    }

    @Test
    void historyServiceMapsPathsIntoTheProjectAndKeepsOnlyStoredFiles() throws Exception {
        try (Git git = Git.init().setDirectory(dir.toFile()).call()) {
            commit(git, "a.py", "1", "init", "a@x.dev");
            commit(git, "a.py", "2", "fix bug", "a@x.dev");
            commit(git, "secret.bin", "x", "add binary", "a@x.dev");
        }
        FileHistoryService service = new FileHistoryService(null, 300);
        GitHistoryAnalyzer.Result result =
                service.read(dir.resolve(".git"), "my-repo/", java.util.Set.of("my-repo/a.py"));
        assertEquals(java.util.Set.of("my-repo/a.py"), result.files().keySet());
        assertEquals(1, result.files().get("my-repo/a.py").bugFixCommits());

        assertEquals(
                0, service.read(dir.resolve("missing"), "", java.util.Set.of()).commitsRead());
    }

    @Test
    void bugFixPattern() {
        assertTrue(GitHistoryAnalyzer.BUG_FIX.matcher("Fixes #12: null user").find());
        assertTrue(
                GitHistoryAnalyzer.BUG_FIX.matcher("patched login regression").find());
        assertFalse(GitHistoryAnalyzer.BUG_FIX.matcher("Add prefix option").find());
        assertFalse(GitHistoryAnalyzer.BUG_FIX.matcher("Debugging docs").find());
    }
}
