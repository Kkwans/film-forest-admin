package com.filmforest.content.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.filmforest.content.entity.Movie;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface MovieMapper extends BaseMapper<Movie> {
}
