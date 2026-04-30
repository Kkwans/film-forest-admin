package com.filmforest.content.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.filmforest.content.entity.ShortDrama;
import com.filmforest.content.mapper.ShortDramaMapper;
import com.filmforest.content.service.ShortDramaService;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;

@Service
public class ShortDramaServiceImpl extends ServiceImpl<ShortDramaMapper, ShortDrama> implements ShortDramaService {

    @Override
    public IPage<ShortDrama> pageList(int pageNum, int pageSize, Integer year, String genre) {
        Page<ShortDrama> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<ShortDrama> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(year != null, ShortDrama::getYear, year);
        if (StringUtils.isNotBlank(genre)) {
            wrapper.like(ShortDrama::getGenre, genre);
        }
        wrapper.orderByDesc(ShortDrama::getCreatedAt);
        return page(page, wrapper);
    }

    @Override
    public ShortDrama getDetail(Long id) {
        return getById(id);
    }
}
