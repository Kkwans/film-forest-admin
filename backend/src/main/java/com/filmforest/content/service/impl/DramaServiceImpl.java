package com.filmforest.content.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.filmforest.content.entity.Drama;
import com.filmforest.content.mapper.DramaMapper;
import com.filmforest.content.service.DramaService;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class DramaServiceImpl extends ServiceImpl<DramaMapper, Drama> implements DramaService {

    @Override
    public IPage<Drama> pageList(int pageNum, int pageSize, Integer year) {
        LambdaQueryWrapper<Drama> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Drama::getDeleted, 0);
        if (year != null) {
            wrapper.eq(Drama::getYear, year);
        }
        wrapper.orderByDesc(Drama::getCreatedAt);
        return page(new Page<>(pageNum, pageSize), wrapper);
    }

    @Override
    public Drama getDetail(Long id) {
        LambdaQueryWrapper<Drama> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Drama::getId, id).eq(Drama::getDeleted, 0);
        return getOne(wrapper);
    }
}