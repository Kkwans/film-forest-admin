package com.filmforest.resource.entity;

import com.baomidou.mybatisplus.annotation.*;
import org.apache.ibatis.reflection.MetaObject;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * 在线播放资源表
 */
@Data
@TableName("resource_online")
public class ResourceOnline {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String contentType;      // movie/drama/variety/anime/short
    private Long contentId;          // 内容ID
    private Long episodeId;          // 剧集ID（可选）
    private String sourceName;       // 来源名称
    private String sourceUrl;       // 播放URL
    private Integer sort;
    private LocalDateTime createdAt;
}

