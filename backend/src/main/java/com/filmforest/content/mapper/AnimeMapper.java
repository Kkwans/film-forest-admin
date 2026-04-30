package com.filmforest.content.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.filmforest.content.entity.Anime;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface AnimeMapper extends BaseMapper<Anime> {
}
