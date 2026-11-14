package com.repolens.user;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserAvatarRepository extends JpaRepository<UserAvatar, Long> {

    Optional<UserAvatar> findByToken(String token);
}
