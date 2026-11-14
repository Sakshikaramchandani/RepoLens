/** "ana" — the username when the server sent one, else the email's local part. */
export function displayName(user: { username?: string; email: string }): string {
  return user.username || user.email.split("@")[0];
}
