package com.repolens.language;

import static org.junit.jupiter.api.Assertions.*;

import com.repolens.language.Definitions.Definition;
import com.repolens.language.Definitions.Kind;
import java.util.List;
import org.junit.jupiter.api.Test;

class DefinitionsTest {

    private static List<Definition> find(Language language, String code) {
        return Definitions.find(Definitions.Source.of(language, code));
    }

    private static Definition named(List<Definition> defs, String name) {
        return defs.stream()
                .filter(d -> d.name().equals(name))
                .findFirst()
                .orElseThrow(() -> new AssertionError(name + " not found in " + defs));
    }

    @Test
    void python() {
        List<Definition> defs = find(Language.PYTHON, """
                import os

                @dataclass
                class UserService:
                    \"\"\"Users.\"\"\"

                    def login(self, email, password):
                        if not email:
                            return None
                        return self.repo.find(email)

                    def logout(self):
                        pass

                async def main():
                    def helper():
                        return 1
                    return helper()
                """);
        Definition cls = named(defs, "UserService");
        assertEquals(Kind.TYPE, cls.kind());
        assertEquals(3, cls.startLine(), "decorator belongs to the class");
        Definition login = named(defs, "login");
        assertEquals(Kind.FUNCTION, login.kind());
        assertEquals("UserService", login.parent());
        assertEquals(2, login.params(), "self is not a parameter");
        assertEquals(7, login.declLine());
        assertEquals(10, login.endLine());
        assertTrue(named(defs, "helper").insideFunction());
        assertEquals(18, named(defs, "main").endLine());
    }

    @Test
    void typescript() {
        List<Definition> defs = find(Language.TYPESCRIPT, """
                export interface User { id: number }

                export async function fetchUser(id: number, token: string): Promise<User> {
                  const res = await fetch(`/u/${id}`, { headers: { a: "}" } });
                  return res.json();
                }

                export const Login = ({ onDone }: Props) => {
                  useEffect(() => {
                    if (x) { y(); }
                  }, []);
                  return null;
                };

                class Store {
                  private items: string[] = [];
                  add(item: string) {
                    this.items.push(item);
                  }
                }
                """);
        assertEquals(Kind.TYPE, named(defs, "User").kind());
        Definition fetchUser = named(defs, "fetchUser");
        assertEquals(3, fetchUser.declLine());
        assertEquals(6, fetchUser.endLine(), "braces inside strings and templates are ignored");
        assertEquals(2, fetchUser.params());
        Definition login = named(defs, "Login");
        assertEquals(13, login.endLine());
        assertTrue(defs.stream()
                .noneMatch(d -> d.name().equals("useEffect") || d.name().equals("if")));
        assertEquals("Store", named(defs, "add").parent());
    }

    @Test
    void goRustCsharpAndC() {
        List<Definition> go = find(Language.GO, """
                type Server struct {
                    db *DB
                }

                func (s *Server) Handle(w http.ResponseWriter, r *http.Request) {
                    if r == nil {
                        return
                    }
                }
                """);
        assertEquals(Kind.TYPE, named(go, "Server").kind());
        assertEquals(9, named(go, "Handle").endLine());

        List<Definition> rust = find(Language.RUST, """
                pub struct Cache<'a> { map: &'a str }

                impl<'a> Cache<'a> {
                    pub fn get(&self, key: &str) -> Option<&str> {
                        None
                    }
                }
                """);
        assertEquals(Kind.TYPE, named(rust, "Cache").kind());
        assertEquals(1, named(rust, "get").params(), "&self is not a parameter");

        List<Definition> cs = find(Language.CSHARP, """
                public class UserController : ControllerBase
                {
                    [HttpGet("{id}")]
                    public async Task<IActionResult> Get(int id)
                    {
                        if (id < 0) return BadRequest();
                        return Ok(await _repo.Find(id));
                    }
                }
                """);
        Definition get = named(cs, "Get");
        assertEquals(3, get.startLine(), "attribute belongs to the method");
        assertEquals("UserController", get.parent());
        assertTrue(cs.stream()
                .noneMatch(d -> d.name().equals("BadRequest") || d.name().equals("Ok")));

        List<Definition> c = find(Language.C, """
                #include <stdio.h>
                struct point make_point(int x, int y);

                static int add(int a, int b)
                {
                    return a + b;
                }
                """);
        assertEquals(7, named(c, "add").endLine());
        assertTrue(
                c.stream().noneMatch(d -> d.name().equals("point")), "a function returning a struct is not a struct");
    }

    @Test
    void markdownSectionsSkipCodeFences() {
        List<Definition> defs = find(Language.MARKDOWN, """
                # Title
                intro
                ## Install
                ```bash
                # not a heading
                npm i
                ```
                ## Usage
                run it
                """);
        assertEquals(
                List.of("Title", "Install", "Usage"),
                defs.stream().map(Definition::name).toList());
        assertEquals(7, named(defs, "Install").endLine());
    }

    @Test
    void rubyEndsAtItsEnd() {
        List<Definition> defs = find(Language.RUBY, """
                class Order
                  def total(items)
                    items.sum(&:price)
                  end
                end
                """);
        assertEquals(4, named(defs, "total").endLine());
        assertEquals(5, named(defs, "Order").endLine());
    }
}
