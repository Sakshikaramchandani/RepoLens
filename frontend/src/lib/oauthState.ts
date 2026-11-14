/**
 * Binds an OAuth round trip to the browser tab that started it (login CSRF protection).
 *
 * The backend signs the `state`, but a signed state proves only that *some* sign-in was started on this
 * server — an attacker could start one, then send a victim their own callback link and sign the victim
 * into the attacker's account. Remembering the state here and accepting only that state on the
 * callback page closes that: a link started elsewhere never matches.
 */
const STATE_KEY = "repolens.oauth.state";

/** Call with the provider's authorize URL right before redirecting to it. */
export function rememberOAuthState(authorizeUrl: string): void {
  const state = new URL(authorizeUrl).searchParams.get("state");
  if (!state) throw new Error("Authorize URL has no state");
  sessionStorage.setItem(STATE_KEY, state);
}

/** true only for the state this tab started; single-use. */
export function consumeOAuthState(state: string): boolean {
  try {
    const expected = sessionStorage.getItem(STATE_KEY);
    sessionStorage.removeItem(STATE_KEY);
    return expected !== null && expected === state;
  } catch {
    return false;
  }
}
