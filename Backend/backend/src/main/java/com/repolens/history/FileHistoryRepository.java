package com.repolens.history;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FileHistoryRepository extends JpaRepository<FileHistory, Long> {

    List<FileHistory> findByProjectId(Long projectId);

    @Modifying
    @Query("DELETE FROM FileHistory h WHERE h.projectId = :projectId")
    void deleteByProjectId(@Param("projectId") Long projectId);
}
