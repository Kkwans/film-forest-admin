package com.filmforest.crawler.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.filmforest.crawler.entity.CrawlerSchedule;
import com.filmforest.crawler.entity.CrawlerTaskLog;
import com.filmforest.crawler.mapper.CrawlerScheduleMapper;
import com.filmforest.crawler.mapper.CrawlerTaskLogMapper;
import com.filmforest.crawler.service.CrawlerScheduleService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

@Service
public class CrawlerScheduleServiceImpl implements CrawlerScheduleService {

    @Autowired
    private CrawlerScheduleMapper scheduleMapper;

    @Autowired
    private CrawlerTaskLogMapper taskLogMapper;

    /** 正在运行的爬虫任务 */
    private final ConcurrentHashMap<Long, AtomicBoolean> runningTasks = new ConcurrentHashMap<>();

    @Override
    public List<CrawlerSchedule> listSchedules() {
        return scheduleMapper.selectList(new LambdaQueryWrapper<CrawlerSchedule>()
                .orderByDesc(CrawlerSchedule::getCreatedAt));
    }

    @Override
    public CrawlerSchedule getSchedule(Long id) {
        return scheduleMapper.selectById(id);
    }

    @Override
    @Transactional
    public boolean saveSchedule(CrawlerSchedule schedule) {
        if (schedule.getId() == null) {
            schedule.setStatus("idle");
            schedule.setTotalRuns(0);
            schedule.setTotalItems(0);
            return scheduleMapper.insert(schedule) > 0;
        } else {
            return scheduleMapper.updateById(schedule) > 0;
        }
    }

    @Override
    public boolean deleteSchedule(Long id) {
        runningTasks.remove(id);
        return scheduleMapper.deleteById(id) > 0;
    }

    @Override
    @Transactional
    public boolean startCrawler(Long id) {
        CrawlerSchedule schedule = scheduleMapper.selectById(id);
        if (schedule == null) return false;

        // 标记为运行中
        schedule.setStatus("running");
        schedule.setLastRunTime(LocalDateTime.now());
        scheduleMapper.updateById(schedule);

        // 记录任务日志
        CrawlerTaskLog log = new CrawlerTaskLog();
        log.setScheduleId(id);
        log.setScheduleName(schedule.getName());
        log.setContentType(schedule.getContentType());
        log.setStatus("running");
        log.setStartedAt(LocalDateTime.now());
        taskLogMapper.insert(log);

        // TODO: 实际异步执行爬虫（Spring @Async）
        // 这里模拟执行
        simulateCrawl(id, schedule, log.getId());

        return true;
    }

    private void simulateCrawl(Long scheduleId, CrawlerSchedule schedule, Long logId) {
        runningTasks.put(scheduleId, new AtomicBoolean(true));

        new Thread(() -> {
            try {
                // 模拟爬取延迟
                Thread.sleep(3000);

                // 更新日志
                CrawlerTaskLog log = taskLogMapper.selectById(logId);
                log.setStatus("success");
                log.setItemsCrawled(schedule.getBatchSize());
                log.setItemsAdded(schedule.getBatchSize() - (int)(Math.random() * 5));
                log.setItemsUpdated((int)(Math.random() * 3));
                log.setFinishedAt(LocalDateTime.now());
                log.setDurationMs(3000);
                taskLogMapper.updateById(log);

                // 更新配置统计
                CrawlerSchedule s = scheduleMapper.selectById(scheduleId);
                s.setStatus("idle");
                s.setTotalRuns(s.getTotalRuns() + 1);
                s.setTotalItems(s.getTotalItems() + log.getItemsCrawled());
                scheduleMapper.updateById(s);

            } catch (InterruptedException e) {
                // 被停止
                CrawlerTaskLog log = taskLogMapper.selectById(logId);
                log.setStatus("stopped");
                log.setFinishedAt(LocalDateTime.now());
                taskLogMapper.updateById(log);
            } finally {
                runningTasks.remove(scheduleId);
            }
        }).start();
    }

    @Override
    public boolean stopCrawler(Long id) {
        AtomicBoolean running = runningTasks.get(id);
        if (running != null) {
            running.set(false);
        }
        CrawlerSchedule schedule = scheduleMapper.selectById(id);
        if (schedule != null) {
            schedule.setStatus("idle");
            scheduleMapper.updateById(schedule);
        }
        return true;
    }

    @Override
    public boolean toggleEnabled(Long id, boolean enabled) {
        CrawlerSchedule schedule = scheduleMapper.selectById(id);
        if (schedule == null) return false;
        schedule.setEnabled(enabled ? 1 : 0);
        return scheduleMapper.updateById(schedule) > 0;
    }
}