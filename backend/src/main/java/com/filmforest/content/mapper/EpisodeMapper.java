package com.filmforest.content.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.filmforest.content.entity.Episode;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface EpisodeMapper extends BaseMapper<Episode> {
}
