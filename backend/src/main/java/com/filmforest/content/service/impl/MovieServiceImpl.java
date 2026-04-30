package com.filmforest.content.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.filmforest.content.entity.Movie;
import com.filmforest.content.mapper.MovieMapper;
import com.filmforest.content.service.MovieService;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;

@Service
public class MovieServiceImpl extends ServiceImpl<MovieMapper, Movie> implements MovieService {

    @Override
    public IPage<Movie> pageList(int pageNum, int pageSize, Integer year, String genre) {
        Page<Movie> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<Movie> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(year != null, Movie::getYear, year);
        if (StringUtils.isNotBlank(genre)) {
            wrapper.like(Movie::getGenre, genre);
        }
        wrapper.orderByDesc(Movie::getCreatedAt);
        return page(page, wrapper);
    }

    @Override
    public Movie getDetail(Long id) {
        return getById(id);
    }
}
