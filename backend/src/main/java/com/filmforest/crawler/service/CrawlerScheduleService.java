package com.filmforest.crawler.service;

import com.filmforest.crawler.entity.CrawlerSchedule;
import java.util.List;

public interface CrawlerScheduleService {

    /**
     * 获取所有定时配置列表
     */
    List<CrawlerSchedule> listSchedules();

    /**
     * 获取单个配置
     */
    CrawlerSchedule getSchedule(Long id);

    /**
     * 新增/更新配置
     */
    boolean saveSchedule(CrawlerSchedule schedule);

    /**
     * 删除配置
     */
    boolean deleteSchedule(Long id);

    /**
     * 启动爬虫（手动触发一次）
     */
    boolean startCrawler(Long id);

    /**
     * 停止爬虫
     */
    boolean stopCrawler(Long id);

    /**
     * 切换启用/禁用状态
     */
    boolean toggleEnabled(Long id, boolean enabled);
}