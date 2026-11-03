# 🏢 ai-terrarium

**Watch your AI agents work in a pixel-art terrarium.**

A Claude Code plugin that turns your active coding sessions into animated characters working at desks in an isometric pixel-art office. Day and night follow your real clock — lights dim at sunset, stars come out, desk lamps glow.

```
  ┌─────────────────────────────────────┐
  │  ☁           ☀                      │
  │     ╔══════╗    ╔══════╗            │
  │     ║ 🧑‍💻  ║    ║ 🧑‍💻  ║  ← sessions │
  │     ║ ████ ║    ║ ████ ║            │
  │     ╚══════╝    ╚══════╝            │
  │         ☕           📁             │
  │  ╔══════╗    ╔══════╗               │
  │  ║ 💤   ║    ║ 🧑‍💻  ║               │
  │  ║ ████ ║    ║ ████ ║               │
  │  ╚══════╝    ╚══════╝     🚪       │
  └─────────────────────────────────────┘
       each desk = one Claude session
```

## ⚡ Quick Start

**Install** (at the Claude Code prompt):

```
/plugin install ai-terrarium --marketplace luanle912/ai-terrarium
```

**Open** your browser:

```
http://localhost:4317
```

That's it. The server starts automatically with every Claude Code session.

## 🔧 How It Works

```
~/.claude/projects/**/*.jsonl  →  SSE Server :4317  →  Pixel-Art Canvas
       (transcripts)              (zero deps)          (isometric office)
```

The plugin hooks into `session.start` and spawns a lightweight Node.js server that:

1. Reads Claude Code transcript files from `~/.claude/projects/`
2. Detects which sessions are active, idle, thinking, or waiting
3. Streams state via Server-Sent Events to the browser UI
4. Renders each session as an animated character at a desk

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Zero setup** | Installs as a plugin — server auto-starts, no config needed |
| **Real-time** | Sessions appear and disappear as you open/close Claude Code |
| **Day/night cycle** | Smooth continuous lighting based on your local time |
| **Session status** | See who's working, thinking, waiting for permission, or idle |
| **Sub-agents** | Child agents appear as smaller desks next to their parent |
| **No dependencies** | Pure Node.js — no `npm install` required |
| **Private** | Everything stays local — nothing leaves your machine |

## 🖥️ Alternative: Run Without Plugin

If you prefer not to install the plugin, run the server manually:

```bash
# Clone and run
git clone https://github.com/luanle912/ai-terrarium.git
node ai-terrarium/server.js
```

Then open `http://localhost:4317`.

## 🌐 Remote UI

You can also use the hosted UI and point it to your local server:

```
https://claude.ai/artifact/7rKQWsQxG8WttUXiWqEUt6?server=localhost:4317
```

> The server includes `Access-Control-Allow-Origin: *` so the hosted page can connect to your local SSE endpoint.

## ⚙️ Configuration

| Env Variable | Default | Description |
|-------------|---------|-------------|
| `PORT` | `4317` | Server port |
| `CLAUDE_DIR` | `~/.claude/projects` | Transcript directory |
| `ACTIVE_MIN` | `120` | Minutes before a session is considered inactive |

## 🔄 Update

```
claude plugin update ai-terrarium
```

## 📋 Requirements

- **Node.js 18+**
- **Claude Code 2.1+**

## 📄 License

MIT
