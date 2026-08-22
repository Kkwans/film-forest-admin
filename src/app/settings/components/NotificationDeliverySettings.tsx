'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  CircleAlert,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  Save,
  Send,
  Server,
  ShieldCheck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import {
  notificationApi,
  type NotificationPreference,
  type SmtpSettingView,
} from '@/lib/api';
import { extractErrorMessage } from '@/lib/utils';

const defaultPreferences: NotificationPreference = {
  emailEnabled: 0,
  crawlerFailure: 1,
  crawlerRecovery: 1,
  dataAnomaly: 1,
  crawlerSuccess: 0,
};

interface SmtpForm {
  host: string;
  port: number;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
  securityMode: 'NONE' | 'STARTTLS' | 'SSL';
  enabled: boolean;
  hasSavedPassword: boolean;
}

const emptySmtp: SmtpForm = {
  host: '',
  port: 587,
  username: '',
  password: '',
  fromEmail: '',
  fromName: '影视森林',
  securityMode: 'STARTTLS',
  enabled: false,
  hasSavedPassword: false,
};

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 ${
        checked ? 'border-primary bg-primary' : 'border-border bg-muted'
      }`}
    >
      <span aria-hidden className={`absolute left-0.5 top-0.5 size-4.5 rounded-full bg-white shadow-sm transition-transform ${
        checked ? 'translate-x-5' : 'translate-x-0.5'
      }`} />
    </button>
  );
}

function PreferenceRow({
  icon: Icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: typeof Bell;
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/25 p-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-background text-muted-foreground shadow-sm">
          <Icon className="size-4.5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>
      <Toggle checked={checked} onChange={onChange} label={title} />
    </div>
  );
}

function smtpForm(view: SmtpSettingView): SmtpForm {
  return {
    host: view.host || '',
    port: view.port || (view.securityMode === 'SSL' ? 465 : 587),
    username: view.username || '',
    password: '',
    fromEmail: view.fromEmail || '',
    fromName: view.fromName || '影视森林',
    securityMode: view.securityMode || 'STARTTLS',
    enabled: view.enabled,
    hasSavedPassword: Boolean(view.passwordMask),
  };
}

function PreferenceCard({
  preferences,
  saving,
  onToggle,
  onSave,
}: {
  preferences: NotificationPreference;
  saving: boolean;
  onToggle: (key: keyof NotificationPreference) => void;
  onSave: () => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2.5 text-lg">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Bell className="size-4" /></span>
              个人通知偏好
            </CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">站内通知按管理员独立订阅；邮件仅在系统 SMTP 可用时投递。</p>
          </div>
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />}保存偏好
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <PreferenceRow icon={CircleAlert} title="爬虫失败与中断" description="任务失败、部分失败或被中断时告警，建议保持开启。" checked={preferences.crawlerFailure === 1} onChange={() => onToggle('crawlerFailure')} />
        <PreferenceRow icon={RefreshCw} title="爬虫恢复" description="失败任务重试成功后发送恢复通知。" checked={preferences.crawlerRecovery === 1} onChange={() => onToggle('crawlerRecovery')} />
        <PreferenceRow icon={AlertTriangle} title="数据异常" description="重复激增、字段缺失或资源异常时告警。" checked={preferences.dataAnomaly === 1} onChange={() => onToggle('dataAnomaly')} />
        <PreferenceRow icon={CheckCircle2} title="普通成功" description="每次任务成功都通知，默认关闭以减少噪声。" checked={preferences.crawlerSuccess === 1} onChange={() => onToggle('crawlerSuccess')} />
        <div className="sm:col-span-2">
          <PreferenceRow icon={Mail} title="邮件投递" description="将已订阅事件同步发送到当前管理员账号邮箱；站内通知始终保留。" checked={preferences.emailEnabled === 1} onChange={() => onToggle('emailEnabled')} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function NotificationDeliverySettings({ preferencesOnly = false }: { preferencesOnly?: boolean }) {
  const toast = useToast();
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [smtp, setSmtp] = useState<SmtpForm>(emptySmtp);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [testing, setTesting] = useState<'connection' | 'mail' | null>(null);
  const [testRecipient, setTestRecipient] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        const preferenceResponse = await notificationApi.getPreferences();
        if (preferenceResponse.data?.code === 200) {
          setPreferences({ ...defaultPreferences, ...preferenceResponse.data.data });
        }
        if (!preferencesOnly) {
          const smtpResponse = await notificationApi.getSmtp();
          if (smtpResponse.data?.code === 200) {
            const view = smtpResponse.data.data as SmtpSettingView;
            setSmtp(smtpForm(view));
            setConfigured(view.configured);
            setTestRecipient(view.fromEmail || '');
          }
        }
      } catch (error: unknown) {
        toast.error(extractErrorMessage(error, '加载通知与邮件设置失败'));
      } finally {
        setLoading(false);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [preferencesOnly, toast]);

  const togglePreference = (key: keyof NotificationPreference) => {
    setPreferences(current => ({ ...current, [key]: current[key] === 1 ? 0 : 1 }));
  };

  const savePreferences = async () => {
    setSavingPreferences(true);
    try {
      const response = await notificationApi.savePreferences(preferences);
      if (response.data?.code === 200) setPreferences(response.data.data);
      toast.success('个人通知偏好已保存');
    } catch (error: unknown) {
      toast.error(extractErrorMessage(error, '保存通知偏好失败'));
    } finally {
      setSavingPreferences(false);
    }
  };

  const validateSmtp = () => {
    if (!smtp.host.trim()) return '请输入 SMTP 服务器地址';
    if (!Number.isInteger(smtp.port) || smtp.port < 1 || smtp.port > 65535) return 'SMTP 端口必须在 1–65535 之间';
    if (!smtp.fromEmail.trim() || !smtp.fromEmail.includes('@')) return '请输入有效的发件邮箱';
    if (smtp.username.trim() && !smtp.password && !smtp.hasSavedPassword) return '使用账号认证时必须填写密码';
    return null;
  };

  const saveSmtp = async () => {
    const validation = validateSmtp();
    if (validation) {
      toast.error(validation);
      return;
    }
    setSavingSmtp(true);
    try {
      const response = await notificationApi.saveSmtp({
        host: smtp.host.trim(),
        port: smtp.port,
        username: smtp.username.trim() || undefined,
        password: smtp.password || undefined,
        fromEmail: smtp.fromEmail.trim(),
        fromName: smtp.fromName.trim() || undefined,
        securityMode: smtp.securityMode,
        enabled: smtp.enabled,
      });
      const view = response.data.data as SmtpSettingView;
      setSmtp(smtpForm(view));
      setConfigured(view.configured);
      setTestRecipient(current => current || view.fromEmail || '');
      toast.success(view.enabled ? 'SMTP 已保存并启用' : 'SMTP 配置已保存');
    } catch (error: unknown) {
      toast.error(extractErrorMessage(error, '保存 SMTP 配置失败'));
    } finally {
      setSavingSmtp(false);
    }
  };

  const runTest = async (kind: 'connection' | 'mail') => {
    if (!configured) {
      toast.error('请先保存完整 SMTP 配置');
      return;
    }
    if (kind === 'mail' && (!testRecipient.trim() || !testRecipient.includes('@'))) {
      toast.error('请输入有效的测试收件邮箱');
      return;
    }
    setTesting(kind);
    try {
      const response = kind === 'connection'
        ? await notificationApi.testSmtpConnection()
        : await notificationApi.sendTestMail(testRecipient.trim());
      const result = response.data.data as { success: boolean; category: string; message: string };
      if (result.success) toast.success(result.message);
      else toast.error(`${result.message}（${result.category}）`);
    } catch (error: unknown) {
      toast.error(extractErrorMessage(error, 'SMTP 测试失败'));
    } finally {
      setTesting(null);
    }
  };

  const changeSecurityMode = (value: string) => {
    const securityMode = value as SmtpForm['securityMode'];
    setSmtp(current => ({
      ...current,
      securityMode,
      port: current.port === 587 || current.port === 465
        ? securityMode === 'SSL' ? 465 : 587
        : current.port,
    }));
  };

  if (loading) {
    return (
      <Card id="notifications">
        <CardContent className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />加载通知配置…
        </CardContent>
      </Card>
    );
  }

  if (preferencesOnly) {
    return <PreferenceCard preferences={preferences} saving={savingPreferences} onToggle={togglePreference} onSave={() => void savePreferences()} />;
  }

  return (
    <section id="notifications" className="scroll-mt-24 space-y-6">
      <PreferenceCard preferences={preferences} saving={savingPreferences} onToggle={togglePreference} onSave={() => void savePreferences()} />

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2.5 text-lg">
                <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Server className="size-4" /></span>
                系统 SMTP
              </CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">全站共用一套发件配置；密码加密保存，页面和 API 均不回传明文。</p>
            </div>
            <div className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
              configured ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground'
            }`}>
              {configured ? <ShieldCheck className="size-3.5" /> : <KeyRound className="size-3.5" />}
              {configured ? (smtp.enabled ? '已配置并启用' : '已配置，未启用') : '尚未配置'}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium">
              SMTP 服务器
              <Input value={smtp.host} onChange={event => setSmtp(current => ({ ...current, host: event.target.value }))} placeholder="smtp.example.com" autoComplete="off" />
            </label>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(7rem,0.65fr)] gap-3">
              <label className="grid gap-1.5 text-sm font-medium">
                安全模式
                <Select value={smtp.securityMode} onChange={changeSecurityMode} options={[
                  { value: 'STARTTLS', label: 'STARTTLS' },
                  { value: 'SSL', label: 'SSL/TLS' },
                  { value: 'NONE', label: '无加密' },
                ]} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                端口
                <Input type="number" min={1} max={65535} value={smtp.port} onChange={event => setSmtp(current => ({ ...current, port: Number(event.target.value) }))} />
              </label>
            </div>
            <label className="grid gap-1.5 text-sm font-medium">
              登录账号 <span className="text-xs font-normal text-muted-foreground">不需要认证时留空</span>
              <Input value={smtp.username} onChange={event => setSmtp(current => ({ ...current, username: event.target.value }))} autoComplete="username" placeholder="mailer@example.com" />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              登录密码
              <Input type="password" value={smtp.password} onChange={event => setSmtp(current => ({ ...current, password: event.target.value }))} autoComplete="new-password" placeholder={smtp.hasSavedPassword ? '已安全保存，留空则保持不变' : '输入 SMTP 密码或授权码'} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              发件邮箱
              <Input type="email" value={smtp.fromEmail} onChange={event => setSmtp(current => ({ ...current, fromEmail: event.target.value }))} placeholder="noreply@example.com" />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              发件人名称
              <Input value={smtp.fromName} onChange={event => setSmtp(current => ({ ...current, fromName: event.target.value }))} placeholder="影视森林" />
            </label>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/25 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">启用邮件投递</p>
              <p className="mt-0.5 text-xs text-muted-foreground">关闭后 Outbox 保留待发送邮件，不影响站内通知和爬虫任务。</p>
            </div>
            <Toggle checked={smtp.enabled} onChange={() => setSmtp(current => ({ ...current, enabled: !current.enabled }))} label="启用邮件投递" />
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid flex-1 gap-1.5 text-sm font-medium lg:max-w-sm">
              测试收件邮箱
              <Input type="email" value={testRecipient} onChange={event => setTestRecipient(event.target.value)} placeholder="admin@example.com" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void runTest('connection')} disabled={testing !== null || !configured}>
                {testing === 'connection' ? <Loader2 className="animate-spin" /> : <RefreshCw />}测试连接
              </Button>
              <Button variant="outline" onClick={() => void runTest('mail')} disabled={testing !== null || !configured}>
                {testing === 'mail' ? <Loader2 className="animate-spin" /> : <Send />}发送测试邮件
              </Button>
              <Button onClick={saveSmtp} disabled={savingSmtp}>
                {savingSmtp ? <Loader2 className="animate-spin" /> : <Save />}保存 SMTP
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
