package com.repolens.file;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RepoFileRepository extends JpaRepository<RepoFile, Long> {

    List<RepoFile> findByProjectIdOrderByPathAsc(Long projectId);

    long countByProjectId(Long projectId);

    // Ek hi SQL mein saari rows delete (ek-ek karke nahi)
    @Modifying
    @Query("delete from RepoFile r where r.projectId = :projectId")
    int deleteByProjectId(@Param("projectId") Long projectId);
}
