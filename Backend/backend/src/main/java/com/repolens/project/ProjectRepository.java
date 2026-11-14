package com.repolens.project;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectRepository extends JpaRepository<Project, Long> {

    List<Project> findByOwner_IdOrderByCreatedAtDesc(Long ownerId);

    // Ownership check ka dil: id bhi match ho AUR owner bhi
    Optional<Project> findByIdAndOwner_Id(Long id, Long ownerId);

    boolean existsByIdAndOwner_Id(Long id, Long ownerId);
}
