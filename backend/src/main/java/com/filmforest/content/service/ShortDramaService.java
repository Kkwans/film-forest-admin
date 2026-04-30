package com.filmforest.content.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;
import com.filmforest.content.entity.ShortDrama;

public interface ShortDramaService extends IService<ShortDrama> {

    IPage<ShortDrama> pageList(int pageNum, int pageSize, Integer year, String genre);

    ShortDrama getDetail(Long id);
}
