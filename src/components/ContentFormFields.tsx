/**
 * 内容管理表单字段组件
 *
 * 从 content/page.tsx 提取，供新增/编辑弹窗复用。
 * 包含：表单类型定义、工具函数、表单字段组件、通用 Field 布局组件。
 */

import { Select } from '@/components/ui/select';

// ========== 类型定义 ==========

export interface EditForm {
  title: string;
  posterUrl: string;
  year: string;
  scoreDouban: string;
  scoreImdb: string;
  scoreRt: string;
  genre: string;
  region: string;
  language: string;
  director: string;
  writer: string;
  actor: string;
  storyline: string;
  duration: string;
  releaseDate: string;
  alias: string;
  status: number;
  type: ContentType;
}

export type ContentType = 'movie' | 'drama' | 'variety' | 'anime' | 'short_drama';

// ========== 常量 ==========

export const EMPTY_FORM: EditForm = {
  title: '', posterUrl: '', year: '', scoreDouban: '', scoreImdb: '', scoreRt: '',
  genre: '', region: '', language: '', director: '', writer: '',
  actor: '', storyline: '', duration: '', releaseDate: '', alias: '',
  status: 1, type: 'movie',
};

export const TYPE_OPTIONS = [
  { label: '电影', value: 'movie' },
  { label: '剧集', value: 'drama' },
  { label: '综艺', value: 'variety' },
  { label: '动漫', value: 'anime' },
  { label: '短剧', value: 'short_drama' },
];

export const TYPE_LABELS: Record<string, string> = {
  movie: '电影', drama: '剧集', variety: '综艺', anime: '动漫', short_drama: '短剧'
};

export const TYPE_ICON_EMOJI: Record<string, string> = {
  movie: '🎬', drama: '📺', variety: '🎤', anime: '🎯', short_drama: '⚡'
};

// ========== 工具函数 ==========

/** 解析 JSON 数组为逗号分隔字符串 */
export function parseJsonArray(json: string | undefined): string {
  if (!json) return '';
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.join('，') : json;
  } catch { return json; }
}

/** 从表单数据构建提交用的数据对象 */
export function buildSubmitData(form: EditForm) {
  const parseArr = (v: string) =>
    v ? JSON.stringify(v.split(/[，,]/).map(s => s.trim()).filter(Boolean)) : null;
  return {
    title: form.title,
    posterUrl: form.posterUrl || undefined,
    year: form.year ? Number(form.year) : null,
    scoreDouban: form.scoreDouban ? Number(form.scoreDouban) : null,
    scoreImdb: form.scoreImdb ? Number(form.scoreImdb) : null,
    scoreRt: form.scoreRt ? Number(form.scoreRt) : null,
    genre: parseArr(form.genre),
    region: parseArr(form.region),
    language: parseArr(form.language),
    director: parseArr(form.director),
    writer: parseArr(form.writer),
    actor: parseArr(form.actor),
    storyline: form.storyline || null,
    duration: form.duration ? Number(form.duration) : null,
    releaseDate: form.releaseDate || null,
    alias: parseArr(form.alias),
    status: form.status,
  };
}

// ========== 通用输入框 ==========

const INPUT_CLASS = 'h-9 px-3 rounded-lg border bg-background text-foreground text-sm';
const INPUT_ERROR_CLASS = 'border-destructive focus:ring-destructive/20 focus:border-destructive';

/** 通用表单输入框 */
function FormInput({ error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  return (
    <div className="grid gap-1">
      <input
        {...props}
        className={INPUT_CLASS + ' placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-[border-color,box-shadow,background-color]' + (error ? ` ${INPUT_ERROR_CLASS}` : '') + (props.className ? ` ${props.className}` : '')}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** 通用表单文本域 */
function FormTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={'px-3 py-2 rounded-lg border bg-background text-foreground text-sm resize-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-[border-color,box-shadow,background-color]' + (props.className ? ` ${props.className}` : '')} />;
}

// ========== Field 布局组件 ==========

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="grid gap-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ========== 表单字段组件 ==========

export function ContentFormFields({ form, onChange, showStatus = false, errors = {} }: {
  form: EditForm;
  onChange: (form: EditForm) => void;
  showStatus?: boolean;
  errors?: Record<string, string>;
}) {
  return (
    <div className="space-y-6 py-2">
      {/* 基本信息 */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border/60">
          <span className="text-base">📋</span>
          <h4 className="text-sm font-semibold text-foreground">基本信息</h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="内容类型">
            <Select value={form.type} onChange={v => onChange({ ...form, type: v as ContentType })} options={TYPE_OPTIONS} />
          </Field>
          <Field label="年份">
            <FormInput value={form.year} onChange={e => onChange({ ...form, year: e.target.value })} placeholder="2026" error={errors.year} />
          </Field>
        </div>
        <Field label="标题">
          <FormInput value={form.title} onChange={e => onChange({ ...form, title: e.target.value })} placeholder="输入内容标题" error={errors.title} />
        </Field>
        <Field label="海报 URL">
          <FormInput value={form.posterUrl} onChange={e => onChange({ ...form, posterUrl: e.target.value })} placeholder="https://example.com/poster.jpg" />
          {form.posterUrl && (
            <div className="mt-2">
              <img
                src={form.posterUrl}
                alt="海报预览"
                className="w-20 h-28 object-cover rounded-lg ring-1 ring-border shadow-sm"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                onLoad={e => { (e.target as HTMLImageElement).style.display = ''; }}
              />
            </div>
          )}
        </Field>
      </div>

      {/* 评分信息 */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border/60">
          <span className="text-base">⭐</span>
          <h4 className="text-sm font-semibold text-foreground">评分信息</h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="豆瓣评分">
            <FormInput value={form.scoreDouban} onChange={e => onChange({ ...form, scoreDouban: e.target.value })} placeholder="8.5" error={errors.scoreDouban} />
          </Field>
          <Field label="IMDb 评分">
            <FormInput value={form.scoreImdb} onChange={e => onChange({ ...form, scoreImdb: e.target.value })} placeholder="8.3" error={errors.scoreImdb} />
          </Field>
          <Field label="RT 评分（%）">
            <FormInput value={form.scoreRt} onChange={e => onChange({ ...form, scoreRt: e.target.value })} placeholder="95" error={errors.scoreRt} />
          </Field>
        </div>
      </div>

      {/* 分类信息 */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border/60">
          <span className="text-base">🏷️</span>
          <h4 className="text-sm font-semibold text-foreground">分类信息</h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="类型（逗号分隔）">
            <FormInput value={form.genre} onChange={e => onChange({ ...form, genre: e.target.value })} placeholder="剧情，喜剧" />
          </Field>
          <Field label="地区（逗号分隔）">
            <FormInput value={form.region} onChange={e => onChange({ ...form, region: e.target.value })} placeholder="中国大陆" />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="语言（逗号分隔）">
            <FormInput value={form.language} onChange={e => onChange({ ...form, language: e.target.value })} placeholder="英语，汉语" />
          </Field>
          <Field label="又名（逗号分隔）">
            <FormInput value={form.alias} onChange={e => onChange({ ...form, alias: e.target.value })} placeholder="极限返航，末日圣母号" />
          </Field>
        </div>
      </div>

      {/* 演职信息 */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border/60">
          <span className="text-base">🎬</span>
          <h4 className="text-sm font-semibold text-foreground">演职信息</h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="导演（逗号分隔）">
            <FormInput value={form.director} onChange={e => onChange({ ...form, director: e.target.value })} placeholder="张三" />
          </Field>
          <Field label="编剧（逗号分隔）">
            <FormInput value={form.writer} onChange={e => onChange({ ...form, writer: e.target.value })} placeholder="编剧A" />
          </Field>
        </div>
        <Field label="演员（逗号分隔）">
          <FormInput value={form.actor} onChange={e => onChange({ ...form, actor: e.target.value })} placeholder="演员A，演员B" />
        </Field>
      </div>

      {/* 其他信息 */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border/60">
          <span className="text-base">📝</span>
          <h4 className="text-sm font-semibold text-foreground">其他信息</h4>
        </div>
        {showStatus && (
          <Field label="状态">
            <div className="flex items-center gap-2 h-9">
              <button type="button" onClick={() => onChange({ ...form, status: form.status === 1 ? 0 : 1 })} className={`w-10 h-5 rounded-full relative transition-colors ${form.status === 1 ? 'bg-primary' : 'bg-muted'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-[left,right] ${form.status === 1 ? 'right-0.5' : 'left-0.5'}`} />
              </button>
              <span className="text-sm text-muted-foreground">{form.status === 1 ? '已上线' : '已下线'}</span>
            </div>
          </Field>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="时长（分钟）">
            <FormInput value={form.duration} onChange={e => onChange({ ...form, duration: e.target.value })} placeholder="120" error={errors.duration} />
          </Field>
          <Field label="上映日期">
            <FormInput value={form.releaseDate} onChange={e => onChange({ ...form, releaseDate: e.target.value })} placeholder="2026-03-20" />
          </Field>
        </div>
        <Field label="剧情简介">
          <FormTextarea value={form.storyline} onChange={e => onChange({ ...form, storyline: e.target.value })} rows={3} />
        </Field>
      </div>
    </div>
  );
}
