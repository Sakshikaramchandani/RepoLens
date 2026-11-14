package com.repolens.github;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GithubSourceRepository extends JpaRepository<GithubSource, Long> {

    Optional<GithubSource> findByProjectId(Long projectId);
}
