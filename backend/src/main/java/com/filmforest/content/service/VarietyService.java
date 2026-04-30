package com.filmforest.content.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;
import com.filmforest.content.entity.Variety;

public interface VarietyService extends IService<Variety> {

    IPage<Variety> pageList(int pageNum, int pageSize, Integer year, String genre);

    Variety getDetail(Long id);
}
