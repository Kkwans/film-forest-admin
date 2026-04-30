package com.filmforest.crawler.controller;

import com.filmforest.common.dto.Result;
import com.filmforest.crawler.entity.CrawlerSchedule;
import com.filmforest.crawler.entity.CrawlerTaskLog;
import com.filmforest.crawler.mapper.CrawlerTaskLogMapper;
import com.filmforest.crawler.service.CrawlerScheduleService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/crawler")
public class CrawlerController {

    @Autowired
    private CrawlerScheduleService scheduleService;

    @Autowired
    private CrawlerTaskLogMapper taskLogMapper;

    /** 获取所有定时配置 */
    @GetMapping("/schedules")
    public Result<List<CrawlerSchedule>> listSchedules() {
        return Result.ok(scheduleService.listSchedules());
    }

    /** 获取单个配置 */
    @GetMapping("/schedule/{id}")
    public Result<CrawlerSchedule> getSchedule(@PathVariable Long id) {
        return Result.ok(scheduleService.getSchedule(id));
    }

    /** 保存/更新配置 */
    @PostMapping("/schedule")
    public Result<Boolean> saveSchedule(@RequestBody CrawlerSchedule schedule) {
        return Result.ok(scheduleService.saveSchedule(schedule));
    }

    /** 删除配置 */
    @DeleteMapping("/schedule/{id}")
    public Result<Boolean> deleteSchedule(@PathVariable Long id) {
        return Result.ok(scheduleService.deleteSchedule(id));
    }

    /** 启动爬虫 */
    @PostMapping("/start/{id}")
    public Result<Boolean> startCrawler(@PathVariable Long id) {
        return Result.ok(scheduleService.startCrawler(id));
    }

    /** 停止爬虫 */
    @PostMapping("/stop/{id}")
    public Result<Boolean> stopCrawler(@PathVariable Long id) {
        return Result.ok(scheduleService.stopCrawler(id));
    }

    /** 切换启用状态 */
    @PostMapping("/toggle/{id}")
    public Result<Boolean> toggleEnabled(@PathVariable Long id, @RequestParam boolean enabled) {
        return Result.ok(scheduleService.toggleEnabled(id, enabled));
    }

    /** 获取任务日志 */
    @GetMapping("/logs")
    public Result<List<CrawlerTaskLog>> listLogs(@RequestParam(required = false) Long scheduleId) {
        LambdaQueryWrapper<CrawlerTaskLog> wrapper = new LambdaQueryWrapper<>();
        wrapper.orderByDesc(CrawlerTaskLog::getStartedAt).last("LIMIT 50");
        if (scheduleId != null) {
            wrapper.eq(CrawlerTaskLog::getScheduleId, scheduleId);
        }
        return Result.ok(taskLogMapper.selectList(wrapper));
    }

    /** 获取爬虫状态概览 */
    @GetMapping("/status")
    public Result<Map<String, Object>> getStatus() {
        List<CrawlerSchedule> schedules = scheduleService.listSchedules();
        Map<String, Object> status = new HashMap<>();
        status.put("schedules", schedules);
        status.put("total", schedules.size());
        status.put("running", schedules.stream().filter(s -> "running".equals(s.getStatus())).count());
        status.put("idle", schedules.stream().filter(s -> "idle".equals(s.getStatus())).count());
        return Result.ok(status);
    }
}