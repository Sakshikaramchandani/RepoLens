package com.repolens.github;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GithubConnectionRepository extends JpaRepository<GithubConnection, Long> {

    Optional<GithubConnection> findByUserId(Long userId);

    Optional<GithubConnection> findByGithubLoginIgnoreCase(String githubLogin);

    void deleteByUserId(Long userId);
}
