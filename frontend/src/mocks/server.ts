import { setupServer } from "msw/node";
import { handlers } from "./handlers";

/** Same handlers, used by Vitest (Node) instead of the browser worker. */
export const server = setupServer(...handlers);
