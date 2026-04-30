package com.filmforest.content.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.filmforest.content.entity.Variety;
import com.filmforest.content.mapper.VarietyMapper;
import com.filmforest.content.service.VarietyService;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;

@Service
public class VarietyServiceImpl extends ServiceImpl<VarietyMapper, Variety> implements VarietyService {

    @Override
    public IPage<Variety> pageList(int pageNum, int pageSize, Integer year, String genre) {
        Page<Variety> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<Variety> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(year != null, Variety::getYear, year);
        if (StringUtils.isNotBlank(genre)) {
            wrapper.like(Variety::getGenre, genre);
        }
        wrapper.orderByDesc(Variety::getCreatedAt);
        return page(page, wrapper);
    }

    @Override
    public Variety getDetail(Long id) {
        return getById(id);
    }
}
