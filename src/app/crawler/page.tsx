'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, FileClock, ListChecks } from 'lucide-react';
import { crawlerApi, type CrawlerSchedule, type CrawlerSourceDescriptor, type CrawlerTaskLog } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { useAdaptivePolling } from '@/hooks/useAdaptivePolling';
import { extractErrorMessage } from '@/lib/utils';
import { CrawlerConfigSection } from './components/CrawlerConfigSection';
import { CrawlerJobsSection } from './components/CrawlerJobsSection';
import { CrawlerLogsSection } from './components/CrawlerLogsSection';
import { CrawlerStatsSection } from './components/CrawlerStatsSection';

type Section = 'config' | 'jobs' | 'logs' | 'stats';

const sections = [
  { key: 'config' as const, label: '任务配置', description: '来源与调度', icon: ListChecks },
  { key: 'jobs' as const, label: '运行任务', description: '实时进度与取消', icon: Activity },
  { key: 'logs' as const, label: '执行日志', description: '真分页与筛选', icon: FileClock },
  { key: 'stats' as const, label: '运行统计', description: 'SQL 聚合与健康度', icon: BarChart3 },
];

export default function CrawlerPage() {
  const toast = useToast();
  const [section, setSection] = useState<Section>('config');
  const [schedules, setSchedules] = useState<CrawlerSchedule[]>([]);
  const [sources, setSources] = useState<CrawlerSourceDescriptor[]>([]);
  const [activeJobs, setActiveJobs] = useState<CrawlerTaskLog[]>([]);
  const [staticLoading, setStaticLoading] = useState(true);
  const [jobsLoading, setJobsLoading] = useState(true);

  const refreshSchedules = useCallback(async () => {
    const response = await crawlerApi.listSchedules();
    if (response.data?.code !== 200) throw new Error(response.data?.message || '配置加载失败');
    setSchedules(Array.isArray(response.data.data) ? response.data.data : []);
  }, []);

  const refreshJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      const response = await crawlerApi.listActiveJobs();
      if (response.data?.code !== 200) throw new Error(response.data?.message || '活动 Job 加载失败');
      setActiveJobs(Array.isArray(response.data.data) ? response.data.data : []);
    } catch (error: unknown) {
      toast.error(extractErrorMessage(error, '活动 Job 加载失败'));
    } finally {
      setJobsLoading(false);
    }
  }, [toast]);

  const refreshConfiguration = useCallback(async () => {
    try {
      await Promise.all([refreshSchedules(), refreshJobs()]);
    } catch (error: unknown) {
      toast.error(extractErrorMessage(error, '配置刷新失败'));
    }
  }, [refreshJobs, refreshSchedules, toast]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [scheduleResponse, sourceResponse, jobsResponse] = await Promise.all([
          crawlerApi.listSchedules(), crawlerApi.listSources(), crawlerApi.listActiveJobs(),
        ]);
        if (cancelled) return;
        if (scheduleResponse.data?.code !== 200 || sourceResponse.data?.code !== 200 || jobsResponse.data?.code !== 200) {
          throw new Error('爬虫管理数据响应异常');
        }
        setSchedules(Array.isArray(scheduleResponse.data.data) ? scheduleResponse.data.data : []);
        setSources(Array.isArray(sourceResponse.data.data) ? sourceResponse.data.data : []);
        setActiveJobs(Array.isArray(jobsResponse.data.data) ? jobsResponse.data.data : []);
      } catch (error: unknown) {
        if (!cancelled) toast.error(extractErrorMessage(error, '爬虫管理数据加载失败'));
      } finally {
        if (!cancelled) {
          setStaticLoading(false);
          setJobsLoading(false);
        }
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [toast]);

  useAdaptivePolling({ hasActiveJobs: activeJobs.length > 0, onPoll: refreshJobs });

  const summary = useMemo(() => ({
    configurations: schedules.length,
    enabled: schedules.filter(item => item.enabled === 1).length,
    active: activeJobs.length,
  }), [activeJobs.length, schedules]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-foreground">爬虫管理</h1><p className="mt-1 text-sm text-muted-foreground">配置是静态定义，Job 是运行事实；自动调度默认保持关闭。</p></div>
        <div className="flex gap-2 text-xs"><span className="rounded-full bg-muted px-3 py-1.5 text-muted-foreground">{summary.configurations} 个配置</span><span className="rounded-full bg-primary/10 px-3 py-1.5 text-primary">{summary.active} 个活动 Job</span><span className="rounded-full bg-muted px-3 py-1.5 text-muted-foreground">{summary.enabled} 个自动调度</span></div>
      </header>

      <nav aria-label="爬虫管理区域" className="grid gap-2 rounded-xl border border-border bg-card p-2 sm:grid-cols-2 xl:grid-cols-4">
        {sections.map(item => {
          const Icon = item.icon;
          const active = section === item.key;
          return (
            <button key={item.key} type="button" onClick={() => setSection(item.key)} className={`flex items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors ${active ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`}>
              <Icon className="size-5 shrink-0" /><span><span className="block text-sm font-medium">{item.label}</span><span className={`block text-xs ${active ? 'text-primary-foreground/75' : 'text-muted-foreground'}`}>{item.description}</span></span>
            </button>
          );
        })}
      </nav>

      {section === 'config' && <CrawlerConfigSection schedules={schedules} sources={sources} loading={staticLoading} onRefresh={refreshConfiguration} />}
      {section === 'jobs' && <CrawlerJobsSection jobs={activeJobs} loading={jobsLoading} onRefresh={refreshJobs} />}
      {section === 'logs' && <CrawlerLogsSection schedules={schedules} sources={sources} hasActiveJobs={activeJobs.length > 0} />}
      {section === 'stats' && <CrawlerStatsSection hasActiveJobs={activeJobs.length > 0} />}
    </div>
  );
}
