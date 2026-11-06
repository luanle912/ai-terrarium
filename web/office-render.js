import { tr } from './i18n.js';
import { SeasonTree } from './season-tree.js';
import { BubbleLogic } from './bubble-logic.js';
import { ACT_TXT, FH, LH, LW, P, PA, WEATHER_LABEL, WEATHER_PREVIEW, h, languagePicker } from './office-scene.js';
import { ST, fmtK } from './office-util.js';
import { ClaudeOffice, mixin } from './office.js';
// The React tree of the local page: header, scene, bubbles, panels and settings; plus hit testing.
mixin(
  ClaudeOffice,
  class {
    hit(e) {
      const r = e.currentTarget.getBoundingClientRect(),
        lx = ((e.clientX - r.left) / r.width) * LW,
        ly = ((e.clientY - r.top) / r.height) * LH;
      let best = null,
        bd = 1e9;
      for (const a of this.agents) {
        const [sx, sy] = a.sleeping ? P(a.x, a.y, -4) : a.seated ? P(a.x, a.y, 11.5) : PA(a.x, a.y);
        const hw = a.sleeping ? 14 : 7;
        if (
          lx > sx - hw &&
          lx < sx + hw &&
          ly > sy - (a.sleeping ? 10 : a.seated ? 30 : 24) &&
          ly < sy + (a.sleeping ? 8 : 3)
        ) {
          const d = Math.abs(lx - sx) + Math.abs(ly - sy + 10);
          if (d < bd) {
            bd = d;
            best = a;
          }
        }
      }
      return best;
    }
    loadBubbleMode() {
      try {
        const v = this.storage && this.storage.getItem(BubbleLogic.STORAGE_KEY);
        return BubbleLogic.MODES.includes(v) ? v : 'speech';
      } catch (e) {
        return 'speech';
      }
    }
    setBubbleMode(m) {
      if (!BubbleLogic.MODES.includes(m)) return;
      this.setState({ bubbleMode: m });
      try {
        this.storage && this.storage.setItem(BubbleLogic.STORAGE_KEY, m);
      } catch (e) {}
    }
    bubbleText(a) {
      const t = a.target && this.byId(a.target);
      switch (a.status) {
        case 'working':
          return a.tool[0] + ' ' + a.tool[1];
        case 'thinking':
          return tr('bubble.thinking');
        case 'permission':
          return tr('bubble.needsApproval', { msg: a.msg });
        case 'error':
          return tr('bubble.error', { msg: a.msg });
        case 'talking':
          return '→ ' + (t ? t.name : '?') + ': ' + a.msg;
        case 'waiting':
          return a.waitSub
            ? tr('bubble.waitingSub', { name: t ? t.name : '' })
            : tr('bubble.waiting', { name: t ? t.name : '?' });
        case 'done':
          return tr('bubble.done');
        case 'entering':
          return a.parent ? tr('bubble.subEntering') : tr('bubble.newSession');
        case 'idle':
          return (
            ({ bath: '💦 ', smoke: '🚬 ', wc: '🚻 ', sky: '☁️ ', microwave: '🍱 ', meal: '🍪 ', snack: '🍪 ' }[
              a.actNow
            ] || '☕ ') + (ACT_TXT[a.actNow] || tr('bubble.pantryBreak'))
          );
        case 'leaving':
          return tr('bubble.leaving');
        default:
          return null;
      }
    }

    render() {
      if (this.world) return this.renderWorld();
      const { sel, paused, live, dataSource, endpoint, bubbleMode, autoApprove, agentCount, speed, showSettings } =
        this.state;
      const isLive = dataSource === 'live',
        isSim = !isLive,
        ls = live,
        others = isLive && this.state.asOthers;
      const cnt = k => this.agents.filter(a => !a.leaving && k.includes(a.status)).length;
      const seasonInfo = SeasonTree && this.treeOn ? SeasonTree.SEASONS[this.seasonKey] : null;
      const summary = [
        [tr('summary.working'), ['working'], '#3e8ed0'],
        [tr('summary.thinking'), ['thinking'], '#5b8def'],
        [tr('summary.talking'), ['talking', 'waiting'], '#12a594'],
        [tr('summary.permission'), ['permission'], '#f5a524'],
        [tr('summary.error'), ['error'], '#e5484d'],
        [tr('summary.idle'), ['idle', 'done'], '#8b8fa3'],
        [tr('summary.subagent'), null, '#ffd166'],
      ].map(([label, ks, color]) => ({
        label,
        color,
        n: ks ? cnt(ks) : this.agents.filter(a => a.parent && !a.leaving).length,
      }));
      const deptList = [...this.depts.values()]
        .map(Dp => ({
          label: Dp.key,
          short: Dp.label,
          color: Dp.color,
          n: this.agents.filter(a => a.dept === Dp.key && !a.leaving).length,
        }))
        .filter(d => d.n > 0);
      const s = sel && this.byId(sel);
      const par = s && s.parent && this.byId(s.parent);
      const selDept = s ? this.depts.get(s.dept) : null;
      const selData = s
        ? {
            name: s.name,
            short: s.short,
            sid: s.sid,
            color: s.shirt,
            statusLabel: (ST[s.status] || ST.working)[0],
            statusColor: (ST[s.status] || ST.working)[1],
            activity: this.bubbleText(s) || '—',
            cwd: s.cwd,
            model: s.model,
            tokens: fmtK(s.tokens),
            role: par ? tr('detail.role.sub', { parent: par.short }) : tr('detail.role.main'),
            dept: s.dept,
            deptColor: selDept ? selDept.color : '#8b8fa3',
            canApprove: !isLive && s.status === 'permission',
            hist: (s.liveHist || s.hist).slice(0, 7),
          }
        : null;
      const srcLabel = isLive
        ? ls === 'ok'
          ? 'LIVE · ~/.claude'
          : ls === 'error'
            ? tr('source.live.lost')
            : tr('source.live.connecting')
        : tr('source.sim');
      const srcColor = isLive ? (ls === 'ok' ? '#46a758' : ls === 'error' ? '#e5484d' : '#f5a524') : '#ffd166';
      // Approval, errors, the selected and the hovered agent always show their bubble. "Gọn" (compact) also keeps the
      // bubbles of agents at work, while agents on a break speak a line when they change activity and fade (BubbleLogic).
      const shown = this.agents.filter(a => !a.gone);
      const pinnedOf = a => sel === a.id || this.hoverId === a.id || a.status === 'permission' || a.status === 'error';
      const busy = a => BubbleLogic.BUSY.has(a.status);
      const talk = BubbleLogic.step(
        this.bubbleMem,
        shown.map(a => ({
          id: a.id,
          status: a.status,
          tool: a.tool,
          actNow: a.actNow,
          target: a.target,
          pinned: pinnedOf(a) || busy(a),
        })),
        performance.now(),
      );
      const bubbles = others
        ? []
        : shown.map(a => {
            const v =
              pinnedOf(a) || bubbleMode === 'always' || (bubbleMode === 'speech' && busy(a))
                ? 'show'
                : bubbleMode === 'speech'
                  ? talk.get(a.id)
                  : null;
            const txt = v ? this.bubbleText(a) : null;
            if (!txt) return null;
            const [sx, sy] = this.headPos(a),
              c = (ST[a.status] || ST.working)[1];
            return h(
              'div',
              {
                key: a.id,
                ref: el => {
                  if (el) this.bubbleEls[a.id] = el;
                  else delete this.bubbleEls[a.id];
                },
                style: {
                  opacity: v === 'fade' ? 0 : 1,
                  transition: 'opacity ' + BubbleLogic.FADE_MS + 'ms',
                  position: 'absolute',
                  left: Math.min(92, Math.max(8, (sx / LW) * 100)) + '%',
                  top: ((sy - 12) / LH) * 100 + '%',
                  transform: 'translate(-50%,-100%) scale(calc(var(--cam-inv,1) * var(--bubble-k,1)))',
                  transformOrigin: '50% 100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '3px 6px',
                  background: '#ffffff',
                  color: '#14161c',
                  border: '2px solid ' + c,
                  boxShadow: '2px 2px 0 rgba(0,0,0,0.35)',
                  font: "500 10px/1.2 'JetBrains Mono',monospace",
                  whiteSpace: 'nowrap',
                  maxWidth: 'var(--bubble-w,240px)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                },
              },
              h('b', { style: { color: c, fontFamily: "'Pixelify Sans',monospace", fontSize: 11 } }, a.name),
              h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis' } }, txt),
            );
          });

      const pad = {
        paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
      };

      const hdrCtl = { padding: '4px 10px', fontSize: 11 };
      const narrow = !!(this.narrowMq && this.narrowMq.matches);
      const logo = h(
        'div',
        {
          style: {
            fontFamily: "'Pixelify Sans',monospace",
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: '0.02em',
            color: '#ffffff',
          },
        },
        'CLAUDE CO.',
      );
      const seasonChip =
        seasonInfo &&
        h(
          'div',
          { className: 'chip', style: { borderColor: seasonInfo.accent, gap: 6 } },
          h('span', {
            style: {
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: seasonInfo.accent,
              display: 'inline-block',
              boxShadow: '0 0 4px ' + seasonInfo.accent,
            },
          }),
          h('span', { style: { color: seasonInfo.accent, fontWeight: 600 } }, seasonInfo.label),
        );
      const summaryChips = summary.map((c, i) =>
        h(
          'div',
          { key: i, className: 'chip' },
          h('span', { style: { width: 8, height: 8, background: c.color, display: 'inline-block' } }),
          h('span', null, c.label),
          h('strong', { style: { color: '#ffffff' } }, c.n),
        ),
      );
      const deptLabel = h('span', { style: { fontSize: 10, color: '#5d6578' } }, tr('header.depts'));
      const deptChips = deptList.map((d, i) =>
        h(
          'div',
          {
            key: i,
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '2px 8px 2px 2px',
              background: 'var(--surface)',
              border: '1px solid #232a39',
            },
          },
          h(
            'span',
            {
              style: {
                padding: '1px 5px',
                background: d.color,
                color: '#ffffff',
                fontFamily: "'Pixelify Sans',monospace",
                fontWeight: 600,
                fontSize: 11,
              },
            },
            d.short,
          ),
          h('span', { style: { color: '#c9cfdc', whiteSpace: 'nowrap' } }, d.label),
          h('strong', { style: { color: '#ffffff' } }, d.n),
        ),
      );
      const srcPill = label =>
        h(
          'div',
          {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: '2px solid var(--border)',
              background: 'var(--surface)',
              ...hdrCtl,
            },
          },
          h('span', { style: { width: 8, height: 8, background: srcColor, display: 'inline-block' } }),
          h(
            'span',
            { style: { color: 'var(--fg)', fontWeight: 600, whiteSpace: narrow ? 'nowrap' : undefined } },
            label,
          ),
        );
      const pauseBtn = label =>
        h(
          'button',
          {
            className: 'btn',
            title: narrow ? (paused ? tr('header.resume') : tr('header.pause')) : undefined,
            style: hdrCtl,
            onClick: () => this.setState(p => ({ paused: !p.paused })),
          },
          label,
        );
      const addBtn = label =>
        isSim &&
        h(
          'button',
          {
            className: 'btn btn-accent',
            title: narrow ? tr('header.addSession') : undefined,
            style: hdrCtl,
            onClick: () => {
              const a = this.addAgent({});
              if (a) this.setState({ sel: a.id });
            },
          },
          label,
        );

      // Phone: one fixed-height row (logo, source, pause, add) and one strip of status and department chips that
      // scrolls sideways instead of wrapping, so the header never pushes the island down. A phone on its side is wide but
      // short, so there the strip sits inside the row between the logo and the controls.
      const strip = flex =>
        h(
          'div',
          {
            key: 'strip',
            className: 'hscroll',
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              flex,
              overflowX: 'auto',
              whiteSpace: 'nowrap',
              minWidth: 0,
            },
          },
          seasonChip,
          this.worldChip(),
          summaryChips,
          deptList.length > 0 && h('span', { style: { width: 4, flex: 'none' } }),
          deptList.length > 0 && deptLabel,
          deptChips,
        );
      const oneRow = narrow && window.innerWidth > 640;
      const top = narrow
        ? [
            h(
              'header',
              {
                key: 'hdr',
                style: { display: 'flex', alignItems: 'center', gap: 8, height: 30, flex: 'none', minWidth: 0 },
              },
              h('div', { title: tr('header.logoTitle'), style: { flex: 'none' } }, logo),
              oneRow ? strip('1 1 0') : h('div', { style: { flex: '1 1 0', minWidth: 0 } }),
              srcPill(
                isLive
                  ? ls === 'ok'
                    ? 'LIVE'
                    : ls === 'error'
                      ? tr('source.short.lost')
                      : tr('source.short.connecting')
                  : tr('source.sim'),
              ),
              pauseBtn(paused ? '▶' : '❚❚'),
              addBtn('+'),
            ),
            !oneRow && strip('none'),
          ]
        : [
            h(
              'header',
              { key: 'hdr', style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 16px' } },
              h(
                'div',
                {
                  title: tr('header.logoTitle'),
                  style: { display: 'flex', alignItems: 'baseline', gap: 8, flex: 'none' },
                },
                logo,
                this.serverVersion &&
                  h(
                    'span',
                    {
                      style: {
                        fontSize: 10,
                        color: 'var(--muted)',
                        fontFamily: "'JetBrains Mono',monospace",
                        opacity: 0.6,
                      },
                    },
                    'v' + this.serverVersion,
                  ),
              ),
              h(
                'div',
                {
                  style: {
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                    fontSize: 11,
                    alignItems: 'center',
                    flex: '1 1 360px',
                    minWidth: 0,
                  },
                },
                seasonChip,
                this.worldChip(),
                summaryChips,
              ),
              h(
                'div',
                { style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, flex: 'none' } },
                srcPill(srcLabel),
                pauseBtn(paused ? '▶ ' + tr('header.resume') : '❚❚ ' + tr('header.pause')),
                addBtn(tr('header.addSessionBtn')),
              ),
            ),
            deptList.length > 0 &&
              h(
                'div',
                {
                  key: 'depts',
                  style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, fontSize: 11 },
                },
                deptLabel,
                deptChips,
              ),
          ];

      return h(
        'div',
        {
          className: 'app',
          style: {
            display: 'flex',
            flexDirection: 'column',
            gap: narrow ? 6 : 8,
            paddingTop: narrow ? 8 : 12,
            paddingBottom: narrow ? 8 : 12,
            boxSizing: 'border-box',
            overflow: 'hidden',
            background: 'var(--bg)',
            ...pad,
          },
        },

        top,

        isLive &&
          ls === 'error' &&
          h(
            'div',
            {
              style: {
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: '14px 16px',
                border: '2px solid #e5484d',
                background: '#2a1418',
                fontSize: 12,
                lineHeight: 1.6,
                color: '#ffd7d9',
              },
            },
            h('strong', { style: { color: '#ffffff', fontSize: 13 } }, tr('server.needed.title')),
            h('span', null, tr('server.needed.body')),
            h(
              'code',
              {
                style: {
                  display: 'block',
                  background: 'var(--bg)',
                  padding: '8px 10px',
                  color: '#ffd166',
                  fontSize: 11,
                  whiteSpace: 'pre-wrap',
                  userSelect: 'all',
                },
              },
              'npx claude-office@latest\n# or: node claude-office-server.js',
            ),
            h('span', { style: { color: 'var(--muted)' } }, tr('server.needed.streams', { endpoint })),
            h('span', { style: { color: 'var(--muted)', fontSize: 11 } }, tr('server.needed.tip')),
          ),

        h(
          'div',
          {
            ref: this.setStage,
            style: {
              position: 'relative',
              flex: '1 1 0',
              minHeight: 0,
              border: '3px solid #232a39',
              overflow: 'hidden',
              containerType: 'size',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            },
          },
          h('canvas', {
            ref: this.setBack,
            style: {
              position: 'absolute',
              inset: 0,
              cursor: 'grab',
              touchAction: 'none',
              width: '100%',
              height: '100%',
              zIndex: 0,
              display: 'block',
            },
          }),
          // The view is fitted to the island top (FH tall), not the whole scene: the deep underside may run off the bottom.
          h(
            'div',
            {
              ref: this.setWrap,
              style: {
                position: 'relative',
                alignSelf: 'flex-start',
                transformOrigin: '0 0',
                touchAction: 'none',
                userSelect: 'none',
                width: 'min(100cqw, calc(100cqh * ' + LW + ' / ' + FH + '))',
                aspectRatio: LW + ' / ' + LH,
                marginTop: 'calc((100cqh - min(100cqw * ' + FH + ' / ' + LW + ', 100cqh)) / 2)',
              },
            },
            h('canvas', {
              ref: this.setCanvas,
              width: LW,
              height: LH,
              onClick: this.onClick,
              onMouseMove: this.onMove,
              onMouseLeave: this.onLeave,
              style: {
                position: 'relative',
                zIndex: 1,
                width: '100%',
                height: 'auto',
                display: 'block',
                imageRendering: 'pixelated',
                touchAction: 'none',
              },
            }),
            h('div', { style: { position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3 } }, bubbles),
          ),
          h('canvas', {
            ref: this.setFront,
            style: {
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              zIndex: 2,
              pointerEvents: 'none',
              display: 'block',
            },
          }),

          // As others see it the panel carries only what the hub gets: no name, folder, activity text or history.
          selData &&
            others &&
            (() => {
              const raw = this.raw.get(s.sid) || {},
                fl = (l, v, k) =>
                  h(
                    'div',
                    { key: k, style: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 } },
                    h('span', { style: { fontSize: 10, color: 'var(--muted)' } }, l),
                    h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, v),
                  );
              return h(
                'div',
                {
                  style: {
                    position: 'absolute',
                    zIndex: 10,
                    top: 12,
                    right: 12,
                    width: 300,
                    maxWidth: 'calc(100% - 24px)',
                    boxSizing: 'border-box',
                    background: 'var(--surface)',
                    border: '3px solid var(--fg)',
                    boxShadow: '6px 6px 0 rgba(0,0,0,0.45)',
                    padding: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    fontSize: 12,
                  },
                },
                h(
                  'div',
                  { style: { display: 'flex', alignItems: 'center', gap: 10 } },
                  h(
                    'div',
                    {
                      style: {
                        width: 34,
                        height: 34,
                        background: selData.deptColor,
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: "'Pixelify Sans',monospace",
                        fontSize: 13,
                        fontWeight: 700,
                        flex: 'none',
                      },
                    },
                    selData.short,
                  ),
                  h(
                    'div',
                    {
                      style: {
                        flex: 1,
                        minWidth: 0,
                        fontFamily: "'Pixelify Sans',monospace",
                        fontSize: 17,
                        fontWeight: 600,
                        color: '#ffffff',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      },
                    },
                    selData.dept,
                  ),
                  h(
                    'button',
                    {
                      className: 'btn',
                      onClick: () => this.setState({ sel: null }),
                      style: { width: 28, height: 28, padding: 0, flex: 'none' },
                    },
                    '×',
                  ),
                ),
                h(
                  'div',
                  { style: { padding: 10, background: 'var(--bg)', borderLeft: '4px solid ' + selData.statusColor } },
                  h('span', { style: { fontWeight: 600, color: selData.statusColor } }, selData.statusLabel),
                ),
                h(
                  'div',
                  { style: { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '10px 14px' } },
                  fl(
                    tr('detail.field.kind'),
                    {
                      shell: tr('detail.kind.shell'),
                      edit: tr('detail.kind.edit'),
                      read: tr('detail.kind.read'),
                      web: tr('detail.kind.web'),
                      agent: tr('detail.kind.agent'),
                      mcp: tr('detail.kind.mcp'),
                      other: tr('detail.kind.other'),
                    }[raw.kind] || '—',
                    'kind',
                  ),
                  fl(tr('detail.field.dept'), selData.dept, 'dept'),
                  raw.tool ? fl(tr('detail.field.tool'), String(raw.tool).slice(0, 32), 'tool') : null,
                  raw.model ? fl(tr('detail.field.model'), String(raw.model).slice(0, 48), 'model') : null,
                  fl(tr('detail.field.role'), selData.role, 'role'),
                ),
              );
            })(),
          selData &&
            !others &&
            h(
              'div',
              {
                style: {
                  position: 'absolute',
                  zIndex: 10,
                  top: 12,
                  right: 12,
                  width: 300,
                  maxWidth: 'calc(100% - 24px)',
                  maxHeight: 'calc(100% - 68px)',
                  overflowY: 'auto',
                  boxSizing: 'border-box',
                  background: 'var(--surface)',
                  border: '3px solid var(--fg)',
                  boxShadow: '6px 6px 0 rgba(0,0,0,0.45)',
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  fontSize: 12,
                },
              },
              h(
                'div',
                { style: { display: 'flex', alignItems: 'center', gap: 10 } },
                h(
                  'div',
                  {
                    style: {
                      width: 34,
                      height: 34,
                      background: selData.deptColor,
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: "'Pixelify Sans',monospace",
                      fontSize: 13,
                      fontWeight: 700,
                      flex: 'none',
                    },
                  },
                  selData.short,
                ),
                h(
                  'div',
                  { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 } },
                  h(
                    'div',
                    {
                      style: {
                        fontFamily: "'Pixelify Sans',monospace",
                        fontSize: 17,
                        fontWeight: 600,
                        color: '#ffffff',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      },
                    },
                    selData.name,
                  ),
                  h('div', { style: { fontSize: 10, color: 'var(--muted)' } }, selData.sid),
                ),
                h(
                  'button',
                  {
                    className: 'btn',
                    onClick: () => this.setState({ sel: null }),
                    style: { width: 28, height: 28, padding: 0, flex: 'none' },
                  },
                  '×',
                ),
              ),
              h(
                'div',
                {
                  style: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    padding: 10,
                    background: 'var(--bg)',
                    borderLeft: '4px solid ' + selData.statusColor,
                  },
                },
                h('span', { style: { fontWeight: 600, color: selData.statusColor } }, selData.statusLabel),
                h('span', { style: { color: 'var(--fg)', wordBreak: 'break-all' } }, selData.activity),
              ),
              selData.canApprove &&
                h(
                  'div',
                  { style: { display: 'flex', gap: 8 } },
                  h(
                    'button',
                    {
                      onClick: () => {
                        if (s) {
                          this.log(s, tr('detail.log.allowed', { msg: s.msg }));
                          s.status = 'working';
                          s.tool = [s.msg.split(':')[0], s.msg.split(':')[1] || ''];
                          s.until = Date.now() + 3000 / this.speed;
                          this.forceUpdate();
                        }
                      },
                      style: {
                        flex: 1,
                        border: '2px solid #46a758',
                        background: '#46a758',
                        color: '#06140a',
                        padding: 9,
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      },
                    },
                    tr('detail.allow'),
                  ),
                  h(
                    'button',
                    {
                      className: 'btn',
                      onClick: () => {
                        if (s) {
                          this.log(s, tr('detail.log.denied', { msg: s.msg }));
                          s.status = 'error';
                          s.msg = tr('detail.msg.userDenied');
                          s.until = Date.now() + 2000 / this.speed;
                          this.forceUpdate();
                        }
                      },
                      style: { flex: 1, padding: 9 },
                    },
                    tr('detail.deny'),
                  ),
                ),
              h(
                'div',
                { style: { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '10px 14px' } },
                [
                  [tr('detail.field.cwd'), selData.cwd],
                  [tr('detail.field.model'), selData.model],
                  [tr('detail.field.tokens'), selData.tokens],
                  [tr('detail.field.role'), selData.role],
                ].map(([label, val], i) =>
                  h(
                    'div',
                    { key: i, style: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 } },
                    h('span', { style: { fontSize: 10, color: 'var(--muted)' } }, label),
                    h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, val),
                  ),
                ),
                h(
                  'div',
                  {
                    key: 'dept',
                    style: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, gridColumn: '1 / -1' },
                  },
                  h('span', { style: { fontSize: 10, color: 'var(--muted)' } }, tr('detail.field.deptByCwd')),
                  h(
                    'span',
                    { style: { display: 'flex', alignItems: 'center', gap: 6 } },
                    h('span', {
                      style: { width: 8, height: 8, background: selData.deptColor, display: 'inline-block' },
                    }),
                    selData.dept,
                  ),
                ),
              ),
              h(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
                h('span', { style: { fontSize: 10, color: 'var(--muted)' } }, tr('detail.field.recent')),
                selData.hist.map((hh, i) =>
                  h(
                    'div',
                    { key: i, style: { display: 'flex', gap: 8, lineHeight: 1.45 } },
                    h('span', { style: { color: '#5d6578', flex: 'none' } }, hh.t),
                    h('span', { style: { color: '#c9cfdc', wordBreak: 'break-word' } }, hh.text),
                  ),
                ),
              ),
            ),

          h(
            'button',
            {
              className: 'settings-toggle',
              'aria-label': tr('settings.title'),
              title: tr('settings.toggleTitle'),
              onClick: () => this.setState(p => ({ showSettings: !p.showSettings })),
            },
            '⚙',
          ),

          others &&
            h(
              'div',
              {
                role: 'status',
                style: {
                  position: 'absolute',
                  zIndex: 5,
                  left: 10,
                  top: 10,
                  padding: '3px 8px',
                  background: 'var(--surface)',
                  border: '2px solid #f5a524',
                  fontSize: 11,
                  color: 'var(--fg)',
                },
              },
              tr('settings.viewingAsOthers', {
                level:
                  this.state.othersShare === 'co-ban'
                    ? tr('settings.othersLevel.basic')
                    : tr('settings.othersLevel.private'),
              }),
            ),

          showSettings &&
            h(
              'div',
              { className: 'settings-panel' },
              h(
                'div',
                {
                  style: {
                    fontFamily: "'Pixelify Sans',monospace",
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#ffffff',
                    marginBottom: 4,
                  },
                },
                tr('settings.title'),
              ),
              languagePicker(),
              h(
                'label',
                null,
                tr('settings.dataSource'),
                h(
                  'select',
                  { value: dataSource, onChange: e => this.setState({ dataSource: e.target.value }) },
                  h('option', { value: 'sim' }, tr('settings.dataSource.sim')),
                  h('option', { value: 'live' }, tr('settings.dataSource.live')),
                ),
              ),
              isLive &&
                h(
                  'label',
                  null,
                  tr('settings.endpoint'),
                  h('input', {
                    type: 'text',
                    value: endpoint,
                    onChange: e => this.setState({ endpoint: e.target.value }),
                  }),
                ),
              isLive &&
                h(
                  'label',
                  { title: tr('settings.asOthers.title') },
                  tr('settings.asOthers'),
                  h('input', {
                    type: 'checkbox',
                    checked: !!this.state.asOthers,
                    onChange: e => this.setState({ asOthers: e.target.checked, sel: null }),
                  }),
                ),
              isLive && this.worldJoinSection(),
              isSim &&
                h(
                  'label',
                  null,
                  tr('settings.agentCount', { n: agentCount }),
                  h('input', {
                    type: 'range',
                    min: 1,
                    max: 16,
                    value: agentCount,
                    onChange: e => this.setState({ agentCount: +e.target.value }),
                  }),
                ),
              h(
                'label',
                null,
                tr('settings.speed', { speed: speed.toFixed(2) }),
                h('input', {
                  type: 'range',
                  min: 0.5,
                  max: 3,
                  step: 0.25,
                  value: speed,
                  onChange: e => this.setState({ speed: +e.target.value }),
                }),
              ),
              h(
                'label',
                { title: tr('settings.bubbles.title') },
                tr('settings.bubbleText'),
                h(
                  'select',
                  { value: bubbleMode, onChange: e => this.setBubbleMode(e.target.value) },
                  BubbleLogic.MODES.map(m =>
                    h(
                      'option',
                      { key: m, value: m },
                      {
                        speech: tr('settings.bubbles.speech'),
                        always: tr('settings.bubbles.always'),
                        off: tr('settings.bubbles.off'),
                      }[m],
                    ),
                  ),
                ),
              ),
              h('div', { style: { borderTop: '1px solid var(--border)', margin: '2px 0' } }),
              h(
                'label',
                null,
                tr('settings.weather'),
                h(
                  'select',
                  {
                    'aria-label': tr('settings.weather.mode'),
                    value: this.state.weatherMode,
                    onChange: e => this.setWeather({ weatherMode: e.target.value }),
                  },
                  h('option', { value: 'random' }, tr('settings.weather.random')),
                  h('option', { value: 'real' }, tr('settings.weather.real')),
                  h('option', { value: 'off' }, tr('settings.weather.off')),
                ),
              ),
              this.state.weatherMode === 'real' &&
                h(
                  'div',
                  { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
                  h(
                    'div',
                    { style: { display: 'flex', gap: 6 } },
                    h('input', {
                      type: 'text',
                      'aria-label': tr('settings.weather.city'),
                      placeholder: tr('settings.weather.cityPlaceholder'),
                      value: this.state.cityDraft,
                      style: { flex: 1, maxWidth: 'none' },
                      onChange: e => this.setState({ cityDraft: e.target.value }),
                      onKeyDown: e => {
                        if (e.key === 'Enter') this.setWeather({ city: this.state.cityDraft.trim() });
                      },
                    }),
                    h(
                      'button',
                      {
                        className: 'btn',
                        style: { padding: '4px 8px', fontSize: 11 },
                        onClick: () => this.setWeather({ city: this.state.cityDraft.trim() }),
                      },
                      tr('settings.weather.update'),
                    ),
                  ),
                  this.state.realStatus.text &&
                    h(
                      'span',
                      {
                        role: 'status',
                        style: {
                          fontSize: 11,
                          lineHeight: 1.4,
                          color:
                            this.state.realStatus.state === 'error'
                              ? '#ff9b9e'
                              : this.state.realStatus.state === 'ok'
                                ? '#8fd69a'
                                : 'var(--muted)',
                        },
                      },
                      this.state.realStatus.text,
                    ),
                  h(
                    'span',
                    { style: { fontSize: 10, color: 'var(--muted)', lineHeight: 1.4 } },
                    tr('settings.weather.privacyNote'),
                  ),
                ),
              h(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
                h('span', null, tr('settings.weather.current', { label: WEATHER_LABEL[this.wx.to] })),
                h(
                  'div',
                  { style: { display: 'flex', flexWrap: 'wrap', gap: 4 } },
                  WEATHER_PREVIEW.map(([type, label]) =>
                    h(
                      'button',
                      {
                        key: type,
                        className: 'btn',
                        title: tr('settings.weather.previewTitle', { label: WEATHER_LABEL[type] }),
                        style: { padding: '3px 7px', fontSize: 11 },
                        onClick: () => this.previewWeather(type),
                      },
                      label,
                    ),
                  ),
                ),
              ),
              isSim &&
                h(
                  'label',
                  null,
                  tr('settings.autoApprove'),
                  h('input', {
                    type: 'checkbox',
                    checked: autoApprove,
                    onChange: e => this.setState({ autoApprove: e.target.checked }),
                  }),
                ),
            ),
        ),
      );
    }
  },
);
