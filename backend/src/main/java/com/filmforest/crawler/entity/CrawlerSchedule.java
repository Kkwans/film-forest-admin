package com.filmforest.crawler.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("crawler_schedule")
public class CrawlerSchedule {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String name;
    private String contentType;
    private String sourceSite;
    private Integer enabled;
    private String cronExpression;
    private Integer batchSize;
    private Integer rateLimitMs;
    private String priority;
    private String genreFilter;
    private String status;
    private LocalDateTime lastRunTime;
    private LocalDateTime nextRunTime;
    private Integer totalRuns;
    private Integer totalItems;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}