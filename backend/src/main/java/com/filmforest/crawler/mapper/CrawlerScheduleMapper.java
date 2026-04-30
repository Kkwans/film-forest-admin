package com.filmforest.crawler.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.filmforest.crawler.entity.CrawlerSchedule;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface CrawlerScheduleMapper extends BaseMapper<CrawlerSchedule> {
}