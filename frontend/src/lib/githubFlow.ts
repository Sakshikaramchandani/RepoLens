import { githubApi, GITHUB_INTENT_KEY, GITHUB_RETURN_KEY } from "../api/github";
import { rememberOAuthState } from "./oauthState";

/**
 * Starts the "connect" OAuth round trip for a signed-in user. GitHub sends the browser back to the
 * callback page, which reads the intent + return path stored here.
 */
export async function connectGithub(returnTo: string): Promise<void> {
  try {
    sessionStorage.setItem(GITHUB_RETURN_KEY, returnTo);
    sessionStorage.setItem(GITHUB_INTENT_KEY, "connect");
  } catch {
    /* storage blocked: the callback falls back to Settings */
  }
  const url = await githubApi.startUrl();
  rememberOAuthState(url);
  window.location.assign(url);
}
