package com.filmforest.content.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.filmforest.content.entity.Anime;
import com.filmforest.content.mapper.AnimeMapper;
import com.filmforest.content.service.AnimeService;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;

@Service
public class AnimeServiceImpl extends ServiceImpl<AnimeMapper, Anime> implements AnimeService {

    @Override
    public IPage<Anime> pageList(int pageNum, int pageSize, Integer year, String genre) {
        Page<Anime> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<Anime> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(year != null, Anime::getYear, year);
        if (StringUtils.isNotBlank(genre)) {
            wrapper.like(Anime::getGenre, genre);
        }
        wrapper.orderByDesc(Anime::getCreatedAt);
        return page(page, wrapper);
    }

    @Override
    public Anime getDetail(Long id) {
        return getById(id);
    }
}
