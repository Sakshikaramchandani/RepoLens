package com.repolens.risk;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

class JavaRiskAnalyzerTest {

    @Test
    void simpleClassIsLowRisk() {
        JavaRiskAnalyzer.Metrics m = JavaRiskAnalyzer.analyze("""
                package a;
                // a comment
                public class Point {
                    private final int x;
                    /* block
                       comment */
                    public Point(int x) { this.x = x; }
                    public int x() { return x; }
                }
                """);

        assertTrue(m.parsed());
        assertEquals(2, m.methods());
        assertEquals(2, m.complexity());
        assertEquals(1, m.maxMethodComplexity());
        assertEquals(6, m.loc(), "comments and blank lines are not counted");
        assertEquals("LOW", m.label());
        assertEquals(0, m.warnings());
    }

    @Test
    void countsDecisionPoints() {
        JavaRiskAnalyzer.Metrics m = JavaRiskAnalyzer.analyze("""
                class A {
                    int f(int a, boolean b) {
                        if (a > 0 && b) { return 1; }           // if + &&
                        for (int i = 0; i < a; i++) { }          // for
                        while (a-- > 0) { }                      // while
                        int y = b ? 1 : 2;                       // ?:
                        switch (a) { case 1: break; case 2: break; default: break; }  // 2 cases
                        try { y++; } catch (IllegalStateException e) { y--; }        // catch
                        return y;
                    }
                }
                """);
        assertEquals(1 + 2 + 1 + 1 + 1 + 2 + 1, m.maxMethodComplexity());
    }

    @Test
    void flagsSmells() {
        JavaRiskAnalyzer.Metrics m = JavaRiskAnalyzer.analyze("""
                class A {
                    // TODO remove this
                    void f(int a, int b, int c, int d, int e, int f) {
                        try { run(); } catch (Exception ex) { }
                        System.out.println("debug");
                    }
                    void run() {}
                }
                """);

        // TODO + 6 params + empty catch + generic catch + console = 5
        assertEquals(5, m.warnings());
        assertTrue(m.findings().stream().anyMatch(f -> f.contains("empty catch")));
        assertTrue(m.findings().stream().anyMatch(f -> f.contains("6 parameters")));
        assertTrue(m.findings().stream().anyMatch(f -> f.contains("Console output")));
    }

    @Test
    void unparseableFileStillGetsSizeMetrics() {
        JavaRiskAnalyzer.Metrics m = JavaRiskAnalyzer.analyze("class {{{ broken");
        assertFalse(m.parsed());
        assertEquals(1, m.loc());
        assertTrue(m.findings().get(0).startsWith("Could not be parsed"));
    }

    @Test
    void scoreIsBoundedAndLabelled() {
        assertEquals(100, JavaRiskAnalyzer.score(50, 500, 5000, 100));
        assertEquals(0, JavaRiskAnalyzer.score(0, 0, 0, 0));
        assertEquals("HIGH", JavaRiskAnalyzer.label(60));
        assertEquals("MEDIUM", JavaRiskAnalyzer.label(30));
        assertEquals("LOW", JavaRiskAnalyzer.label(29));
    }
}
