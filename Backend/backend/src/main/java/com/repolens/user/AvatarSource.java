package com.repolens.user;

/** Where the profile picture comes from. */
public enum AvatarSource {
    /** From GitHub sign-in / connect; refreshed when the user signs in with GitHub again. */
    GITHUB,
    /** From Google sign-in; refreshed when the user signs in with Google again. */
    GOOGLE,
    /** Uploaded in RepoLens; never replaced by a sign-in. */
    UPLOAD,
    /** Removed on purpose; sign-ins do not bring one back. */
    NONE
}
