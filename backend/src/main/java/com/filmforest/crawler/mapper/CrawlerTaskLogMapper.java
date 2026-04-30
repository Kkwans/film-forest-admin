package com.filmforest.crawler.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.filmforest.crawler.entity.CrawlerTaskLog;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface CrawlerTaskLogMapper extends BaseMapper<CrawlerTaskLog> {
}