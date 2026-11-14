import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AppProviders } from "../AppProviders";
import { AppRoutes } from "../routes/AppRoutes";

/** Render the whole app (providers + routes) at a given URL. */
export function renderApp(initialPath = "/") {
  const user = userEvent.setup();
  const utils = render(
    <AppProviders>
      <MemoryRouter initialEntries={[initialPath]}>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>,
  );
  return { user, ...utils };
}
