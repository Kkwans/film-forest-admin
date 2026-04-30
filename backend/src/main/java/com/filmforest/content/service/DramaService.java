package com.filmforest.content.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;
import com.filmforest.content.entity.Drama;

public interface DramaService extends IService<Drama> {

    IPage<Drama> pageList(int pageNum, int pageSize, Integer year);

    Drama getDetail(Long id);
}