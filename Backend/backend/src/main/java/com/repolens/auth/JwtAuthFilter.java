package com.repolens.auth;

import com.repolens.user.UserRepository;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.web.filter.OncePerRequestFilter;

// @Component nahi lagaya: SecurityConfig mein bean banega, warna filter do baar register hota
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserRepository userRepository;

    public JwtAuthFilter(JwtService jwtService, UserRepository userRepository) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        String header = request.getHeader("Authorization");

        // Token nahi hai: aage jaane do. Protected URL hua toh Security 401 dega
        if (header == null || !header.startsWith("Bearer ")) {
            chain.doFilter(request, response);
            return;
        }

        String token = header.substring(7);
        try {
            JwtService.TokenClaims claims = jwtService.parse(token);

            if (SecurityContextHolder.getContext().getAuthentication() == null) {
                userRepository
                        .findById(claims.userId())
                        .filter(user -> JwtService.issuedAfterRevocation(claims, user)) // revoked = anonymous
                        .ifPresent(user -> {
                            var auth = new UsernamePasswordAuthenticationToken(
                                    user, // principal = poora User object, controllers mein seedha milega
                                    null,
                                    List.of(new SimpleGrantedAuthority(
                                            "ROLE_" + user.getRole().name())));
                            auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                            SecurityContextHolder.getContext().setAuthentication(auth);
                        });
            }
        } catch (JwtException | IllegalArgumentException e) {
            // Token galat ya expired: user anonymous maana jayega, protected API par 401
        }

        chain.doFilter(request, response);
    }
}
