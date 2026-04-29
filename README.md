# 影视森林管理端 (film-forest-admin)

影视森林内容管理/爬虫任务管理/数据维护后台。

## 技术栈

| 技术 | 说明 |
|------|------|
| Next.js 14 | React 全栈框架（App Router） |
| TypeScript | 类型安全 |
| TailwindCSS v4 | 原子化 CSS |
| Shadcn UI | 高质量组件库 |
| Zustand | 状态管理 |
| Axios | HTTP 客户端 |
| Lucide React | 图标库 |

## 功能

- [x] 响应式布局（移动端 + PC 自适应）
- [x] 侧边栏导航
- [x] 仪表盘：统计数据/最近内容/爬虫状态
- [ ] 内容管理页面
- [ ] 爬虫任务管理
- [ ] 数据统计
- [ ] 资源管理
- [ ] 系统设置

## 开发

```bash
# 安装依赖
npm install

# 本地开发
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run start
```

## 目录结构

```
src/
├── app/                    # Next.js App Router 页面
│   ├── page.tsx           # 仪表盘首页
│   ├── layout.tsx        # 管理后台布局
│   └── globals.css       # 全局样式
├── components/            # 业务组件
│   ├── AdminSidebar.tsx
│   └── AdminHeader.tsx
├── components/ui/        # Shadcn UI 组件
├── lib/                  # 工具函数
└── stores/               # Zustand 状态管理
```

## 关联项目

- 后端 API: [film-forest-server](https://github.com/Kkwans/film-forest-server)
- 用户端: [film-forest-client](https://github.com/Kkwans/film-forest-client)

## License

MIT