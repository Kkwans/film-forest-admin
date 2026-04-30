package com.filmforest.content.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.IService;
import com.filmforest.content.entity.Movie;

public interface MovieService extends IService<Movie> {

    IPage<Movie> pageList(int pageNum, int pageSize, Integer year, String genre);

    Movie getDetail(Long id);
}
