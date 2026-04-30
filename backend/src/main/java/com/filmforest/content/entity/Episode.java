package com.filmforest.content.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("episode")
public class Episode {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String contentType;
    private Long contentId;
    private Integer season;
    private Integer episodeNumber;
    private String title;
    private String posterUrl;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
