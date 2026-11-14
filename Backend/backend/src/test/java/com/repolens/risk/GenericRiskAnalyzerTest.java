package com.repolens.risk;

import static org.junit.jupiter.api.Assertions.*;

import com.repolens.language.Language;
import org.junit.jupiter.api.Test;

class GenericRiskAnalyzerTest {

    @Test
    void simplePythonIsLowRisk() {
        JavaRiskAnalyzer.Metrics m = GenericRiskAnalyzer.analyze(Language.PYTHON, """
                def add(a, b):
                    # if this was complex...
                    return a + b
                """);
        assertEquals(1, m.methods());
        assertEquals(1, m.maxMethodComplexity(), "the if in the comment does not count");
        assertEquals(2, m.loc());
        assertEquals("LOW", m.label());
    }

    @Test
    void countsDecisionsAndSmellsInTypeScript() {
        JavaRiskAnalyzer.Metrics m = GenericRiskAnalyzer.analyze(Language.TYPESCRIPT, """
                export function route(req: Req, a: number, b: number, c: number, d: number, e: number) {
                  // TODO: split this up
                  if (req.user && req.user.admin) {            // if + &&
                    for (const r of req.roles) {               // for
                      while (r.next) { r = r.next; }           // while
                    }
                  }
                  const x = req.flag ? 1 : 2;                  // ternary
                  switch (req.kind) { case "a": break; case "b": break; }   // 2 cases
                  try { run(); } catch (e) {}                  // catch + empty handler
                  console.log("debug");
                  eval(req.body);
                  return x;
                }
                """);
        assertEquals(1 + 2 + 1 + 1 + 1 + 2 + 1, m.maxMethodComplexity());
        assertTrue(m.findings().stream().anyMatch(f -> f.contains("6 parameters")));
        assertTrue(m.findings().stream().anyMatch(f -> f.contains("empty error handler")));
        assertTrue(m.findings().stream().anyMatch(f -> f.contains("Debug output")));
        assertTrue(m.findings().stream().anyMatch(f -> f.contains("eval()")));
        assertTrue(m.findings().stream().anyMatch(f -> f.contains("TODO")));
    }

    @Test
    void scriptsWithoutFunctionsAreOneUnitAndPythonCatchAllIsFlagged() {
        JavaRiskAnalyzer.Metrics script = GenericRiskAnalyzer.analyze(
                Language.SHELL, "if [ -f x ]; then\n  echo hi\nfi\nfor f in *; do echo $f; done\n");
        assertEquals(0, script.methods());
        assertEquals(3, script.complexity());

        JavaRiskAnalyzer.Metrics py = GenericRiskAnalyzer.analyze(
                Language.PYTHON, "def f():\n    try:\n        g()\n    except:\n        pass\n");
        assertTrue(py.findings().stream().anyMatch(f -> f.contains("empty error handler")));
        assertTrue(py.findings().stream().anyMatch(f -> f.contains("Catches every exception")));
    }

    @Test
    void historyRaisesTheScore() {
        int without = JavaRiskAnalyzer.score(8, 30, 200, 2);
        int with = JavaRiskAnalyzer.scoreWithHistory(8, 30, 200, 2, 25, 6);
        assertTrue(with > without, with + " > " + without);
        assertEquals(100, JavaRiskAnalyzer.scoreWithHistory(50, 500, 5000, 100, 100, 100));
    }
}
