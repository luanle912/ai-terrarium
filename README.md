<p align="center">
  <h1 align="center">🏢 ai-terrarium</h1>
  <p align="center">
    <strong>Watch your AI agents work in a pixel-art terrarium.</strong>
  </p>
  <p align="center">
    <a href="#-quick-start">Quick Start</a> ·
    <a href="#-features">Features</a> ·
    <a href="#%EF%B8%8F-configuration">Configuration</a> ·
    <a href="https://claude.ai/artifact/7rKQWsQxG8WttUXiWqEUt6?server=localhost:4317">Live Demo</a>
  </p>
  <p align="center">
    <a href="https://github.com/luanle912/ai-terrarium/stargazers"><img src="https://img.shields.io/github/stars/luanle912/ai-terrarium?style=flat&color=f4b400" alt="Stars"></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
    <img src="https://img.shields.io/badge/node-18%2B-brightgreen" alt="Node 18+">
    <img src="https://img.shields.io/badge/dependencies-0-success" alt="Zero deps">
    <img src="https://img.shields.io/badge/claude--code-plugin-blueviolet" alt="Claude Code Plugin">
  </p>
</p>

<br>

<p align="center">
  <img src="assets/demo.jpg" alt="ai-terrarium — pixel-art isometric office with Claude Code sessions as animated characters" width="720">
</p>

<br>

Each active **Claude Code session** becomes an animated character sitting at a desk in an isometric pixel-art office. Day and night follow your real clock — lights dim at sunset, stars come out, desk lamps glow.

---

## ⚡ Quick Start

**One command** at the Claude Code prompt:

```
/plugin install ai-terrarium --marketplace luanle912/ai-terrarium
```

Open your browser → **http://localhost:4317** — that's it.

> The server starts automatically with every new Claude Code session. No config needed.

---

## ✨ Features

| | Feature | Description |
|---|---------|-------------|
| 🔌 | **Zero setup** | Installs as a Claude Code plugin — server auto-starts on `session.start` |
| ⚡ | **Real-time** | Sessions appear and disappear as you open and close Claude Code |
| 🌅 | **Day/night cycle** | Smooth continuous lighting with cosine interpolation based on local time |
| 🔍 | **Session status** | See who's working, thinking, waiting for permission, talking, or idle |
| 🤖 | **Sub-agents** | Child agents appear as smaller desks next to their parent |
| 📦 | **Zero dependencies** | Pure Node.js — no `npm install`, no build step |
| 🔒 | **Private** | Reads local transcripts only — nothing leaves your machine |

---

## 🔧 How It Works

```
~/.claude/projects/**/*.jsonl  →  SSE Server :4317  →  Pixel-Art Canvas
       (transcripts)               (Node.js)           (HTML5 Canvas)
```

The plugin hooks into `session.start` and spawns a lightweight Node.js server:

1. **Reads** Claude Code transcript files from `~/.claude/projects/`
2. **Detects** session state — active, idle, thinking, permission, error
3. **Streams** state via Server-Sent Events to the browser
4. **Renders** each session as an animated character at an isometric desk

---

## 🖥️ Alternative: Run Without Plugin

Don't want to install the plugin? Run the server standalone:

```bash
git clone https://github.com/luanle912/ai-terrarium.git
node ai-terrarium/server.js
# → http://localhost:4317
```

Or use the **hosted UI** pointed at your local server:

```
https://claude.ai/artifact/7rKQWsQxG8WttUXiWqEUt6?server=localhost:4317
```

---

## ⚙️ Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4317` | Server port |
| `CLAUDE_DIR` | `~/.claude/projects` | Transcript directory |
| `ACTIVE_MIN` | `120` | Minutes before a session is considered inactive |

---

## 🔄 Update

```
claude plugin update ai-terrarium
```

---

## 📋 Requirements

- **Node.js 18+** — check with `node -v`
- **Claude Code 2.1+**

---

## 📄 License

[MIT](LICENSE)

---

<p align="center">
  <sub>Built with ❤️ for the Claude Code community</sub>
  <br>
  <sub>If you find this useful, a ⭐ would be much appreciated!</sub>
</p>
