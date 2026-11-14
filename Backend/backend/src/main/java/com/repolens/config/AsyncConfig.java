package com.repolens.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.web.servlet.config.annotation.AsyncSupportConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@EnableAsync
public class AsyncConfig {

    /**
     * Indexing ke liye alag thread pool. Request turant return hoti hai,
     * kaam in threads mein background mein chalta hai.
     * 2 threads = ek saath max 2 projects index honge (Ollama par zyada load na pade).
     */
    @Bean(name = "indexingExecutor")
    public ThreadPoolTaskExecutor indexingExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(2);
        executor.setQueueCapacity(20);
        executor.setThreadNamePrefix("indexing-");
        return executor;
    }

    /**
     * Streaming chat answers (Flux -> SSE) are written by Spring MVC's async executor. Without this,
     * MVC falls back to SimpleAsyncTaskExecutor (a new thread per request, unbounded).
     * Spring Boot would normally provide a pool, but backs off because indexingExecutor exists.
     */
    @Bean(name = "mvcAsyncExecutor")
    public ThreadPoolTaskExecutor mvcAsyncExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(8);
        executor.setMaxPoolSize(32);
        executor.setQueueCapacity(200);
        executor.setThreadNamePrefix("mvc-async-");
        return executor;
    }

    @Bean
    public WebMvcConfigurer asyncSupportConfigurer(ThreadPoolTaskExecutor mvcAsyncExecutor) {
        return new WebMvcConfigurer() {
            @Override
            public void configureAsyncSupport(AsyncSupportConfigurer configurer) {
                configurer.setTaskExecutor(mvcAsyncExecutor);
            }
        };
    }
}
