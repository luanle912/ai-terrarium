import { tr } from './i18n.js';
import { SeasonLogic } from './season-logic.js';
import { BubbleLogic } from './bubble-logic.js';
import { actLabel, FH, LH, LW, P, PA, h } from './office-scene.js';
import { ST, fmtK } from './office-util.js';
import { ClaudeOffice, mixin } from './office.js';
// The page root as the desktop wallpaper: edge to edge and deaf to the pointer (made once, reused every render).
const WALLPAPER_APP = {
  paddingTop: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  paddingRight: 0,
  gap: 0,
  pointerEvents: 'none',
};
// The React tree of the local page: header, scene, bubbles, panels and settings; plus hit testing.
// What someone says on the way to their fate (web/fate-logic.js); nothing special for the EXIT door.
const fateLine = kind =>
  ({
    lightning: () => tr('bubble.fate.lightning'),
    wind: () => tr('bubble.fate.wind'),
    freeze: () => tr('bubble.fate.freeze'),
    lake: () => tr('bubble.fate.lake'),
    fish: () => tr('bubble.fate.fish'),
    duck: () => tr('bubble.fate.duck'),
    melt: () => tr('bubble.fate.melt'),
    balloon: () => tr('bubble.fate.balloon'),
    ufo: () => tr('bubble.fate.ufo'),
    rocket: () => tr('bubble.fate.rocket'),
    hole: () => tr('bubble.fate.hole'),
    banana: () => tr('bubble.fate.banana'),
    dust: () => tr('bubble.fate.dust'),
    ghost: () => tr('bubble.fate.ghost'),
    snowball: () => tr('bubble.fate.snowball'),
    bird: () => tr('bubble.fate.bird'),
    sleigh: () => tr('bubble.fate.sleigh'),
    wrapped: () => tr('bubble.fate.wrapped'),
    skateoff: () => tr('bubble.fate.skateoff'),
    chimney: () => tr('bubble.fate.chimney'),
  })[kind]?.();
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
            ({
              bath: '💦 ',
              bench: '🪑 ',
              fish: '🎣 ',
              smoke: '🚬 ',
              wc: '🚻 ',
              sky: '☁️ ',
              microwave: '🍱 ',
              meal: '🍪 ',
              snack: '🍪 ',
              snowball: '❄️ ',
              snowman: '⛄ ',
              skate: '⛸️ ',
              gift: '🎁 ',
            }[a.actNow] || '☕ ') + (actLabel(a.actNow, this.eventNow()) || tr('bubble.pantryBreak'))
          );
        case 'leaving':
          return fateLine(a.fate) || tr('bubble.leaving');
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
      // the season shown, a preview or the Settings choice included; the holiday's name while its trees are up
      const seasonInfo = SeasonLogic.seasonChip(this.seasonNow(), this.treeOn ? this.season : null);
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
      const animalSlot = this.animalSlot();
      const s = sel && !animalSlot && this.byId(sel);
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
      // bubbles of agents at work, while agents on a break speak a line when they change activity and fade
      // (BubbleLogic).
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
      const narrow = !!(this.narrowMq && this.narrowMq.matches),
        wp = this.wallpaper;
      // As the desktop wallpaper (?wallpaper=1) the page is the scene alone: no header, frame, error box, buttons or
      // panels, and it takes no pointer input (the app's window lets every click through to the desktop anyway).
      const top =
        !wp &&
        this.renderHeader({
          deptList,
          hdrCtl,
          isLive,
          isSim,
          ls,
          narrow,
          paused,
          seasonInfo,
          srcColor,
          srcLabel,
          summary,
        });

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
            ...(wp ? WALLPAPER_APP : null),
          },
        },

        top,

        !wp &&
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
              border: wp ? 'none' : '3px solid #232a39',
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
              cursor: wp ? 'default' : 'grab',
              touchAction: 'none',
              width: '100%',
              height: '100%',
              zIndex: 0,
              display: 'block',
            },
          }),
          // The view is fitted to the island top (FH tall), not the whole scene: the deep underside may run off the
          // bottom.
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
          this.animalArrow(),
          this.animalPanelEl(animalSlot),

          // As others see it the panel carries only what the hub gets: no name, folder, activity text or history.
          !wp && this.renderOthersPanel({ others, s, selData }),
          !wp && this.renderDetailPanel({ others, s, selData }),

          !wp &&
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

          !wp &&
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

          !wp &&
            this.renderSettingsPanel({
              agentCount,
              autoApprove,
              bubbleMode,
              dataSource,
              endpoint,
              isLive,
              isSim,
              showSettings,
              speed,
            }),
        ),
      );
    }
  },
);
