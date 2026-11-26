// The small holidays (docs/specs/2026-11-18-asset-labels-design.md §5.2, D2): one pack per dated or lunar entry of the
// season tree (season-tree.js), each swapping only the holiday tree for its own, as the page does today. Christmas is
// not one of them: its tree is the 'xmas' variant in the Christmas event pack.
import { SeasonTree } from '../season-tree.js';

const holiday = key => ({
  key,
  kind: 'holiday',
  swap: { 'tree.holiday': key },
  decor: {},
  extras: [],
  rules: {},
  text: {},
  build: {},
});

export const HOLIDAYS = Object.keys(SeasonTree.SEASONS)
  .filter(k => k !== 'christmas' && ['event', 'lunar'].includes(SeasonTree.SEASONS[k].type))
  .map(holiday);
