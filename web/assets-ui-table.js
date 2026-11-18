// The conversion table of the /assets page (docs/specs/2026-11-18-asset-labels-design.md §5.10): one row per label
// (web/labels.js), one column per theme pack (none in the season chosen, winter, Christmas, and the small holidays as
// one column), each cell the label's entry drawn under that pack's look with the game's own code, as the grid's cards
// are (Preview: a cell is measured and drawn only once it comes near the screen, by the one paint loop). Under each
// cell the variant the look gives and the overlays it lays on it, so "which tree turns into which" reads at a glance.
// A click opens the entry in the drawer under that pack.
import { tr } from './i18n.js';
import { Labels } from './labels.js';
import { AssetsLogic } from './assets-logic.js';
import { AssetsRegistry } from './assets-registry.js';
import { AssetsStage } from './assets-stage.js';
import { Preview, SEASONS, h, packLabel } from './assets-ui-parts.js';

const { useMemo } = React;
const L = AssetsLogic,
  R = AssetsRegistry;
// The categories' accents by the label's group (its row's colour).
const GROUP_CAT = { outdoor: 'outdoor', office: 'office', pantry: 'pantry', people: 'people', animals: 'animals' };
let ROWS = null;
const rows = () => ROWS || (ROWS = L.tableRows(R.entries(), Labels.LIST));

function colTitle(col, season) {
  if (col.id === 'none') return tr('assets.table.none', { season: (SEASONS().find(o => o.id === season) || {}).label });
  return packLabel(col.pack);
}

function Cell({ row, col, controls, onOpen }) {
  const scene = useMemo(() => ({ ...controls, event: col.pack }), [controls, col.pack]),
    look = AssetsStage.envOf(scene).look,
    cell = useMemo(() => L.tableCell(row, look), [row, look]),
    decor = look.decor(row.id),
    caption = look.of(row.id) + (decor.length ? ' + ' + decor.join(' + ') : '');
  if (!cell)
    return h(
      'div',
      { className: 'as-tcell as-tcell-none', role: 'cell' },
      h('div', { className: 'as-tcell-stage' }, tr('assets.table.nothing')),
      h('code', { className: 'as-tcell-l' }, caption),
    );
  return h(
    'button',
    {
      type: 'button',
      className: 'as-tcell',
      role: 'cell',
      title: cell.entry.name() + ' · ' + caption,
      onClick: () => onOpen(cell.entry, cell.pick, col.pack),
    },
    h(
      'div',
      { className: 'as-tcell-stage' },
      h(Preview, { entry: cell.entry, pick: cell.pick, controls: scene, fit: 3, inset: 4, fps: 15 }),
    ),
    h('code', { className: 'as-tcell-l' }, caption),
  );
}

export function Table({ s, set, controls }) {
  const cols = L.tableCols(s.event),
    list = rows(),
    open = (e, pick, pack) => set({ id: e.id, pick, event: pack });
  return h(
    'main',
    { className: 'as-main', style: { '--accent': '#ffd166' } },
    h(
      'div',
      { className: 'as-main-head' },
      h('h1', { className: 'as-title' }, tr('assets.view.table')),
      h('span', { className: 'as-sub' }, tr('assets.table.sub', { n: list.length })),
    ),
    h(
      'div',
      { className: 'as-table-wrap' },
      h(
        'div',
        { className: 'as-table', role: 'table', 'aria-label': tr('assets.view.table') },
        h(
          'div',
          { className: 'as-trow as-thead', role: 'row' },
          h('div', { className: 'as-th', role: 'columnheader' }, tr('assets.table.label')),
          cols.map(c =>
            h(
              'div',
              {
                key: c.id,
                className: 'as-th',
                role: 'columnheader',
                title: c.id === 'holiday' ? tr('assets.table.holidayHint') : undefined,
              },
              colTitle(c, s.season),
            ),
          ),
        ),
        list.map(row => {
          const cat = R.cat(GROUP_CAT[row.group] || 'office'),
            // the entry the Christmas column draws, by name (the others may draw another of the row's entries)
            lead = L.tableCell(row, AssetsStage.envOf({ ...controls, event: 'christmas' }).look);
          return h(
            'div',
            { key: row.id, className: 'as-trow', role: 'row', style: { '--accent': cat.accent } },
            h(
              'div',
              { className: 'as-tlabel', role: 'rowheader' },
              h('code', { className: 'as-tlabel-id' }, row.id),
              lead && h('span', { className: 'as-tlabel-n' }, lead.entry.name()),
            ),
            cols.map(c => h(Cell, { key: c.id, row, col: c, controls, onOpen: open })),
          );
        }),
      ),
    ),
  );
}
