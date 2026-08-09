import {
  CalendarClock,
  FileText,
  Image as ImageIcon,
  Star,
  Tags,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { MultiSelect, Select } from '@/components/ui/select';
import type { TagItem } from '@/lib/api';

export interface EditForm {
  title: string;
  posterUrl: string;
  year: string;
  scoreDouban: string;
  scoreImdb: string;
  scoreRt: string;
  genreTagIds: string[];
  region: string;
  language: string;
  director: string;
  writer: string;
  actor: string;
  storyline: string;
  duration: string;
  totalEpisode: string;
  releaseDate: string;
  alias: string;
  seriesName: string;
  seriesOrder: string;
  status: number;
  type: ContentType;
}

export type ContentType = 'movie' | 'drama' | 'variety' | 'anime' | 'short_drama';

export const EMPTY_FORM: EditForm = {
  title: '',
  posterUrl: '',
  year: '',
  scoreDouban: '',
  scoreImdb: '',
  scoreRt: '',
  genreTagIds: [],
  region: '',
  language: '',
  director: '',
  writer: '',
  actor: '',
  storyline: '',
  duration: '',
  totalEpisode: '',
  releaseDate: '',
  alias: '',
  seriesName: '',
  seriesOrder: '',
  status: 0,
  type: 'movie',
};

export const TYPE_OPTIONS = [
  { label: '电影', value: 'movie' },
  { label: '剧集', value: 'drama' },
  { label: '综艺', value: 'variety' },
  { label: '动漫', value: 'anime' },
  { label: '短剧', value: 'short_drama' },
];

export const TYPE_LABELS: Record<string, string> = {
  movie: '电影',
  drama: '剧集',
  variety: '综艺',
  anime: '动漫',
  short_drama: '短剧',
};

export const STATUS_OPTIONS = [
  { label: '草稿', value: '0' },
  { label: '已上线', value: '1' },
  { label: '已下线', value: '2' },
];

export const STATUS_LABELS: Record<number, string> = {
  0: '草稿',
  1: '已上线',
  2: '已下线',
};

/** 解析 JSON 数组为易读文本。 */
export function parseJsonArray(json: string | undefined): string {
  if (!json) return '';
  try {
    const values = JSON.parse(json);
    return Array.isArray(values) ? values.join('，') : json;
  } catch {
    return json;
  }
}

/** 只提交标准题材 ID；genre JSON 由服务端生成兼容投影。 */
export function buildSubmitData(form: EditForm) {
  const parseArray = (value: string) => value
    ? JSON.stringify(value.split(/[，,]/).map(item => item.trim()).filter(Boolean))
    : null;
  return {
    title: form.title.trim(),
    posterUrl: form.posterUrl.trim() || undefined,
    year: form.year ? Number(form.year) : null,
    scoreDouban: form.scoreDouban ? Number(form.scoreDouban) : null,
    scoreImdb: form.scoreImdb ? Number(form.scoreImdb) : null,
    scoreRt: form.type === 'movie' ? form.scoreRt ? Number(form.scoreRt) : null : undefined,
    genreTagIds: form.genreTagIds.map(Number),
    region: parseArray(form.region),
    language: parseArray(form.language),
    director: parseArray(form.director),
    writer: form.type === 'short_drama' ? undefined : parseArray(form.writer),
    actor: parseArray(form.actor),
    storyline: form.storyline.trim() || null,
    duration: form.duration ? Number(form.duration) : null,
    totalEpisode: form.type === 'movie' ? undefined : form.totalEpisode ? Number(form.totalEpisode) : null,
    releaseDate: form.releaseDate || null,
    alias: parseArray(form.alias),
    seriesName: form.type === 'movie' ? form.seriesName.trim() || null : undefined,
    seriesOrder: form.type === 'movie' && form.seriesOrder ? Number(form.seriesOrder) : undefined,
    status: form.status,
  };
}

const INPUT_CLASS = 'h-9 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25';
const INPUT_ERROR_CLASS = 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20';

function FormInput({ error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  return (
    <div className="grid min-w-0 gap-1">
      <input
        {...props}
        className={`${INPUT_CLASS}${error ? ` ${INPUT_ERROR_CLASS}` : ''}${props.className ? ` ${props.className}` : ''}`}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function FormTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-28 w-full min-w-0 resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25${props.className ? ` ${props.className}` : ''}`}
    />
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
      {hint && <p className="text-xs leading-5 text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b border-border pb-2">
      <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></span>
      <h3 className="text-sm font-semibold text-foreground">{children}</h3>
    </div>
  );
}

export function ContentFormFields({
  form,
  onChange,
  standardGenres,
  genresLoading = false,
  showStatus = false,
  lockType = false,
  errors = {},
}: {
  form: EditForm;
  onChange: (form: EditForm) => void;
  standardGenres: TagItem[];
  genresLoading?: boolean;
  showStatus?: boolean;
  lockType?: boolean;
  errors?: Record<string, string>;
}) {
  return (
    <div className="space-y-7 py-1">
      <section className="space-y-4">
        <SectionTitle icon={FileText}>基本信息</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="内容类型" hint={lockType ? '内容类型决定存储结构，保存后不可直接转换。' : undefined}>
            <Select
              value={form.type}
              disabled={lockType}
              onChange={value => onChange({ ...form, type: value as ContentType, genreTagIds: [] })}
              options={TYPE_OPTIONS}
            />
          </Field>
          <Field label="年份"><FormInput type="number" min={1888} max={2099} value={form.year} onChange={event => onChange({ ...form, year: event.target.value })} placeholder="2026" error={errors.year} /></Field>
        </div>
        <Field label="标题"><FormInput value={form.title} maxLength={255} onChange={event => onChange({ ...form, title: event.target.value })} placeholder="输入内容标题" error={errors.title} /></Field>
        <Field label="又名" hint="多个名称可使用逗号分隔。"><FormInput value={form.alias} onChange={event => onChange({ ...form, alias: event.target.value })} placeholder="别名一，别名二" /></Field>
      </section>

      <section className="space-y-4">
        <SectionTitle icon={ImageIcon}>海报</SectionTitle>
        <div className="grid items-start gap-4 sm:grid-cols-[1fr_6rem]">
          <Field label="海报 URL" hint="可使用来源原图；TMDB 智能匹配状态将在详情中单独展示。">
            <FormInput type="url" value={form.posterUrl} onChange={event => onChange({ ...form, posterUrl: event.target.value })} placeholder="https://example.com/poster.jpg" />
          </Field>
          <div className="aspect-[2/3] overflow-hidden rounded-xl border border-border bg-muted/40">
            {form.posterUrl ? <img src={form.posterUrl} alt="海报预览" className="size-full object-cover" /> : <div className="grid size-full place-items-center text-muted-foreground"><ImageIcon className="size-6" /></div>}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle icon={Star}>评分信息</SectionTitle>
        <div className={`grid gap-4 ${form.type === 'movie' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
          <Field label="豆瓣评分"><FormInput type="number" min={0} max={10} step="0.1" value={form.scoreDouban} onChange={event => onChange({ ...form, scoreDouban: event.target.value })} placeholder="8.5" error={errors.scoreDouban} /></Field>
          <Field label="IMDb 评分"><FormInput type="number" min={0} max={10} step="0.1" value={form.scoreImdb} onChange={event => onChange({ ...form, scoreImdb: event.target.value })} placeholder="8.3" error={errors.scoreImdb} /></Field>
          {form.type === 'movie' && <Field label="RT 评分（%）"><FormInput type="number" min={0} max={100} step="1" value={form.scoreRt} onChange={event => onChange({ ...form, scoreRt: event.target.value })} placeholder="95" error={errors.scoreRt} /></Field>}
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle icon={Tags}>分类信息</SectionTitle>
        <Field label="标准题材（可多选）" hint="仅显示当前内容类型适用的系统题材；语言和地区不会混入题材。">
          <MultiSelect
            value={form.genreTagIds}
            onChange={genreTagIds => onChange({ ...form, genreTagIds })}
            options={standardGenres.map(tag => ({ label: tag.name, value: String(tag.id) }))}
            searchable
            disabled={genresLoading}
            placeholder={genresLoading ? '正在加载标准题材' : standardGenres.length ? '不限题材' : '当前类型暂无标准题材'}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="地区" hint="多个地区可使用逗号分隔。"><FormInput value={form.region} onChange={event => onChange({ ...form, region: event.target.value })} placeholder="中国大陆" /></Field>
          <Field label="语言" hint="多个语言可使用逗号分隔。"><FormInput value={form.language} onChange={event => onChange({ ...form, language: event.target.value })} placeholder="汉语，英语" /></Field>
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle icon={Users}>演职信息</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="导演"><FormInput value={form.director} onChange={event => onChange({ ...form, director: event.target.value })} placeholder="多个姓名使用逗号分隔" /></Field>
          {form.type !== 'short_drama' && <Field label="编剧"><FormInput value={form.writer} onChange={event => onChange({ ...form, writer: event.target.value })} placeholder="多个姓名使用逗号分隔" /></Field>}
        </div>
        <Field label="演员"><FormInput value={form.actor} onChange={event => onChange({ ...form, actor: event.target.value })} placeholder="多个姓名使用逗号分隔" /></Field>
      </section>

      <section className="space-y-4">
        <SectionTitle icon={CalendarClock}>播出与状态</SectionTitle>
        {showStatus && <Field label="内容状态"><Select value={String(form.status)} onChange={value => onChange({ ...form, status: Number(value) })} options={STATUS_OPTIONS} /></Field>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="时长（分钟）"><FormInput type="number" min={0} value={form.duration} onChange={event => onChange({ ...form, duration: event.target.value })} placeholder="120" error={errors.duration} /></Field>
          <Field label="上映 / 首播日期"><FormInput type="date" value={form.releaseDate} onChange={event => onChange({ ...form, releaseDate: event.target.value })} /></Field>
          {form.type !== 'movie' && <Field label="总集数 / 期数"><FormInput type="number" min={0} value={form.totalEpisode} onChange={event => onChange({ ...form, totalEpisode: event.target.value })} placeholder="12" error={errors.totalEpisode} /></Field>}
          {form.type === 'movie' && <Field label="系列名称"><FormInput value={form.seriesName} onChange={event => onChange({ ...form, seriesName: event.target.value })} placeholder="可留空" /></Field>}
          {form.type === 'movie' && <Field label="系列序号"><FormInput type="number" min={1} value={form.seriesOrder} onChange={event => onChange({ ...form, seriesOrder: event.target.value })} placeholder="1" error={errors.seriesOrder} /></Field>}
        </div>
        <Field label="剧情简介"><FormTextarea value={form.storyline} maxLength={5000} onChange={event => onChange({ ...form, storyline: event.target.value })} placeholder="输入完整简介" /></Field>
      </section>
    </div>
  );
}
