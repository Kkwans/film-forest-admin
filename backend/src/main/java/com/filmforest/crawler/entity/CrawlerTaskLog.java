package com.filmforest.crawler.entity;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class CrawlerTaskLog {

    private Long id;
    private Long scheduleId;
    private String scheduleName;
    private String contentType;
    private String status;
    private Integer itemsCrawled;
    private Integer itemsAdded;
    private Integer itemsUpdated;
    private String errorMessage;
    private Integer durationMs;
    private LocalDateTime startedAt;
    private LocalDateTime finishedAt;
}