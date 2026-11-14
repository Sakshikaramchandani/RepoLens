package com.repolens.indexing;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface IndexJobRepository extends JpaRepository<IndexJob, Long> {

    Optional<IndexJob> findFirstByProjectIdOrderByIdDesc(Long projectId);

    boolean existsByProjectIdAndStatusIn(Long projectId, Collection<IndexJobStatus> statuses);

    List<IndexJob> findByStatusIn(Collection<IndexJobStatus> statuses);
}
