# 🎨 Antigravity Image Gen

使用 Google Antigravity API (Gemini 3 Pro Image) 原生生成高质量图像的 OpenClaw Skill。

无需浏览器自动化，直接调用 Cloud Code sandbox 端点。

## ✨ 特性

- **高质量图像生成** — 使用 Gemini 3 Pro Image 模型
- **多种宽高比** — 支持 1:1、16:9、9:16、4:3、3:4
- **自动 Token 刷新** — OAuth 令牌过期时自动续期
- **原生集成** — 与 OpenClaw/Clawdbot 无缝配合

## 📋 前置要求

- **Node.js** — 需要安装 Node.js 运行环境
- **Google Antigravity OAuth** — 需要在 OpenClaw 中完成 OAuth 登录

```bash
openclaw models auth login --provider google-antigravity
```

## 🚀 使用方法

### 命令行直接调用

```bash
node scripts/generate.js \
  --prompt "火星上的未来城市" \
  --output "/tmp/mars.png" \
  --aspect-ratio "16:9"
```

### 参数说明

| 参数 | 必填 | 说明 | 默认值 |
|------|------|------|--------|
| `--prompt` | ✅ | 图像描述 | - |
| `--output` | ❌ | 输出路径 | `~/clawd/generated-images/antigravity_<ts>.png` |
| `--aspect-ratio` | ❌ | 宽高比 | `1:1` |

### 支持的宽高比

- `1:1` — 正方形（默认）
- `16:9` — 宽屏横版
- `9:16` — 竖版（手机壁纸/Stories）
- `4:3` — 传统横版
- `3:4` — 传统竖版

## 📤 输出

脚本执行后会：
1. 将图像保存到指定路径
2. 输出 `MEDIA: <path>`，OpenClaw 会自动识别并发送图片

## ❗ 常见问题

| 错误 | 原因 | 解决方案 |
|------|------|----------|
| `429 Resource Exhausted` | API 配额耗尽 | 等待配额恢复或检查项目限制 |
| `No image data found` | 提示词被安全过滤或 API 结构变化 | 检查 "Model message" 输出，调整提示词 |
| `Auth Error` | 未登录或登录过期 | 重新运行 `openclaw models auth login --provider google-antigravity` |

## 🔗 相关链接

- 📺 **YouTube**: [AI超元域](https://www.youtube.com/@AIsuperdomain)
- 🐦 **X/Twitter**: [@AISuperDomain](https://x.com/AISuperDomain)

## 📄 License

MIT
