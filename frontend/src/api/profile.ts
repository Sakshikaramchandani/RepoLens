import { apiClient } from "./client";
import { API_BASE_URL } from "./contract";

export type AvatarSource = "GITHUB" | "GOOGLE" | "UPLOAD" | "NONE";

export interface Profile {
  id: number;
  email: string;
  role: string;
  username: string;
  avatarUrl: string | null;
  /** null = never chosen (a GitHub / Google sign-in may import one). */
  avatarSource: AvatarSource | null;
  /** Pictures from linked GitHub / Google accounts the user can switch to. */
  providerAvatars: Array<{ source: Exclude<AvatarSource, "UPLOAD" | "NONE">; url: string }>;
}

/** Same rule as ProfileService.USERNAME on the server. */
export const USERNAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,29}$/;

/** Uploaded pictures are served by the API ("/api/avatars/…"); provider pictures are absolute URLs. */
export function avatarSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith("/") ? `${API_BASE_URL}${url}` : url;
}

export const profileApi = {
  async get(): Promise<Profile> {
    const { data } = await apiClient.get<Profile>("/api/users/me");
    return data;
  },
  async setUsername(username: string): Promise<Profile> {
    const { data } = await apiClient.patch<Profile>("/api/users/me", { username });
    return data;
  },
  /** image = data URL produced by cropToSquare(). */
  async uploadAvatar(image: string): Promise<Profile> {
    const { data } = await apiClient.put<Profile>("/api/users/me/avatar", { image }, { timeout: 30_000 });
    return data;
  },
  async useProviderAvatar(source: "GITHUB" | "GOOGLE"): Promise<Profile> {
    const { data } = await apiClient.put<Profile>("/api/users/me/avatar/source", { source });
    return data;
  },
  async removeAvatar(): Promise<Profile> {
    const { data } = await apiClient.delete<Profile>("/api/users/me/avatar");
    return data;
  },
};
