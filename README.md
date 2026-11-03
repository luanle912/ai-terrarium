# ai-terrarium

> Watch your AI agents work in a pixel-art terrarium.

Each active Claude Code session becomes an animated character sitting at a desk in an isometric pixel-art office. Day and night follow your real clock — lights dim at sunset, stars come out, desk lamps glow.

![demo](https://claude.ai/artifact/7rKQWsQxG8WttUXiWqEUt6)

## Install

At the Claude Code prompt:

```
/plugin install ai-terrarium --marketplace luanle912/ai-terrarium
```

Then open **http://localhost:4317** in your browser.

## How it works

The plugin hooks into `session.start` and spawns a zero-dependency Node.js SSE server on port 4317. The server reads Claude Code transcripts from `~/.claude/projects/` and streams session state to the browser in real time.

```
~/.claude/projects/**/*.jsonl  →  SSE server :4317  →  Pixel-art canvas
```

## Features

- **Zero setup** — installs as a Claude Code plugin, server auto-starts
- **Real-time** — sessions appear/disappear as you open/close Claude Code
- **Continuous lighting** — smooth day/night cycle based on your local time
- **No dependencies** — pure Node.js, no npm install needed
- **Private** — reads local transcripts only, nothing leaves your machine

## Update

```
claude plugin update ai-terrarium
```

## Requirements

- Node.js 18+
- Claude Code 2.1+
