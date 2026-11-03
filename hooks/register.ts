import type { Register } from 'claude-code'

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)

    const serverPath = `${$.plugin.root}/server.js`
    const exists = await $.fs.exists(serverPath)
    if (!exists) {
      $.ui.toast(`claude-office: server.js not found at ${serverPath}`)
      return started
    }

    void (async () => {
      try {
        const server = $.process.spawn({
          argv: ['node', serverPath],
          env: { PORT: '4317' },
        })
        $.ui.toast('Claude Office server started on :4317')
        $.ui.status('Office :4317')
        for await (const { stream, text } of server) {
          if (stream === 'stderr' && text.trim()) {
            $.ui.log(`claude-office: ${text.trim()}`, { to: 'debug' })
          }
        }
        $.ui.status(undefined)
      } catch (err) {
        $.ui.log(`claude-office: server failed to start`, { to: 'debug' })
        $.ui.status(undefined)
      }
    })()

    return started
  })
}
