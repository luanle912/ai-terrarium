import './season-trees.js';
import { tr } from './i18n.js';
import { D, DAY, MID, TET, at } from './season-art.js';

const SEASONS = {
  newyear: {
    label: tr('seasonTree.newyear.label'),
    tree: 'Cây kim tuyến + pháo hoa',
    type: 'event',
    from: '12-27',
    to: '01-02',
    key: '01-01',
    accent: '#c9d3e3',
    colors: ['#c9d3e3', '#9aa6bd', '#ffd166', '#ff79c6', '#5ec8ff'],
    desc: 'Cây kim tuyến bạc 3 tầng, điểm chấm vàng, ngôi sao bạc. Pháo hoa nổ lần lượt phía trên ngọn cây.',
  },
  tet: {
    label: tr('seasonTree.tet.label'),
    tree: 'Cây mai + lì xì',
    type: 'lunar',
    window: '21 ngày trước → 10 ngày sau mùng 1',
    accent: '#ffd23f',
    colors: ['#ffd23f', '#f29e0b', '#7a4a2a', '#c0392b', '#f5c542'],
    desc:
      'Cành mai nâu uốn, hoa mai vàng 5 cánh nở khắp cành, bao lì xì đỏ treo đung đưa, cánh mai rơi chậm. ' +
      'Chậu đỏ viền vàng.',
  },
  valentine: {
    label: tr('seasonTree.valentine.label'),
    tree: 'Cây tạo hình trái tim',
    type: 'event',
    from: '02-07',
    to: '02-14',
    key: '02-14',
    accent: '#e93d82',
    colors: ['#e93d82', '#b8235f', '#ffb3cf', '#ffffff', '#7a4a2a'],
    desc: 'Cây cắt tỉa hình trái tim hồng trên thân nâu, viền sáng. Tim nhỏ bay lên chậm từ tán cây.',
  },
  womensday: {
    label: tr('seasonTree.womensday.label'),
    tree: 'Bình hoa hồng',
    type: 'event',
    from: '03-01',
    to: '03-08',
    key: '03-08',
    accent: '#ff5c8a',
    colors: ['#e5484d', '#ff8fab', '#ffd166', '#3f9a5a', '#9fd3ff'],
    desc: 'Bình thuỷ tinh cao, bó hồng đỏ – hồng – vàng, lá xanh, nơ hồng buộc cổ bình.',
  },
  spring: {
    label: tr('seasonTree.spring.label'),
    tree: 'Cây hoa anh đào',
    type: 'season',
    from: '03-09',
    to: '04-24',
    accent: '#f7a8c4',
    colors: ['#f7a8c4', '#f48fb1', '#ffffff', '#7a4a2a'],
    desc: 'Thân nâu, tán hoa anh đào hồng nhiều lớp, điểm hoa trắng, cánh hoa rơi lả tả.',
  },
  reunification: {
    label: tr('seasonTree.reunification.label'),
    tree: 'Cây dây cờ + bồ câu',
    type: 'event',
    from: '04-25',
    to: '05-01',
    key: '04-30',
    accent: '#da251d',
    colors: ['#3f9a5a', '#da251d', '#ffcd00', '#ffffff'],
    desc: 'Tán cây tròn, dây cờ đuôi nheo đỏ – vàng vắt ngang tán. Chim bồ câu trắng bay qua lại.',
  },
  children: {
    label: tr('seasonTree.children.label'),
    tree: 'Cây bóng bay',
    type: 'event',
    from: '05-25',
    to: '06-01',
    key: '06-01',
    accent: '#5ec8ff',
    colors: ['#e5484d', '#ffd166', '#5ec8ff', '#46a758', '#8e4ec6'],
    desc: 'Bụi cây nhỏ, 5 quả bóng bay nhiều màu buộc dây, nhấp nhô lên xuống lệch nhịp.',
  },
  summer: {
    label: tr('seasonTree.summer.label'),
    tree: 'Cây dừa',
    type: 'season',
    from: '06-02',
    to: '08-25',
    accent: '#12a594',
    colors: ['#2fae6a', '#1f7f4c', '#9b6b3f', '#ffd166', '#5ec8ff'],
    desc: 'Thân dừa cong phân đốt, tàu lá rủ, chùm dừa nâu. Quả bóng biển sọc dưới gốc.',
  },
  nationalday: {
    label: tr('seasonTree.nationalday.label'),
    tree: 'Cột cờ đỏ sao vàng',
    type: 'event',
    from: '08-26',
    to: '09-02',
    key: '09-02',
    accent: '#da251d',
    colors: ['#da251d', '#ffcd00', '#c9d3e3', '#3f9a5a'],
    desc: 'Cột cờ bạc trên bụi cây chậu, lá cờ đỏ sao vàng bay phấp phới theo sóng sin.',
  },
  midautumn: {
    label: tr('seasonTree.midautumn.label'),
    tree: 'Cây treo lồng đèn',
    type: 'lunar',
    window: '14 ngày trước → 3 ngày sau rằm tháng 8',
    accent: '#ff8b3d',
    colors: ['#3f9a5a', '#e5484d', '#ff8b3d', '#ffd166', '#f3f0d0'],
    desc: 'Tán cây tròn xanh, treo lồng đèn đỏ/cam có tim sáng, lắc nhẹ theo gió. Đèn ông sao vàng đặt dưới gốc.',
  },
  autumn: {
    label: tr('seasonTree.autumn.label'),
    tree: 'Cây phong lá đỏ',
    type: 'season',
    from: '09-03',
    to: '11-20',
    accent: '#e0703a',
    colors: ['#e0703a', '#c0392b', '#f2b134', '#6b3e24'],
    desc: 'Tán lá phong cam – đỏ – vàng, lá rơi đung đưa xuống sàn.',
  },
  vnwomen: {
    label: tr('seasonTree.vnwomen.label'),
    tree: 'Giỏ hoa',
    type: 'event',
    from: '10-14',
    to: '10-20',
    key: '10-20',
    accent: '#b56be0',
    colors: ['#b56be0', '#ff8fab', '#ffffff', '#a8763e', '#3f9a5a'],
    desc: 'Giỏ mây đan có quai, hoa tím – hồng – trắng, trái tim đỏ nhỏ cài giữa.',
  },
  halloween: {
    label: tr('seasonTree.halloween.label'),
    tree: 'Cây khô + bí ngô',
    type: 'event',
    from: '10-24',
    to: '11-01',
    key: '10-31',
    accent: '#ff7a1a',
    colors: ['#3a2b3f', '#ff7a1a', '#ffd166', '#1a1a1a', '#8e4ec6'],
    desc: 'Cây khô cành trơ, 3 quả bí ngô khắc mặt phát sáng chập chờn, dơi bay vòng quanh tán cây.',
  },
  teachers: {
    label: tr('seasonTree.teachers.label'),
    tree: 'Chồng sách + cúc vàng',
    type: 'event',
    from: '11-14',
    to: '11-20',
    key: '11-20',
    accent: '#f2b134',
    colors: ['#3e8ed0', '#e5484d', '#46a758', '#ffd23f', '#f6f4ee'],
    desc: 'Ba cuốn sách chồng lên nhau, chậu cúc vàng đặt trên cùng, quả táo đỏ bên cạnh.',
  },
  christmas: {
    label: tr('seasonTree.christmas.label'),
    tree: 'Cây thông Noel',
    type: 'event',
    from: '12-01',
    to: '12-26',
    key: '12-25',
    accent: '#2f8f4e',
    colors: ['#2f8f4e', '#226b3a', '#e5484d', '#ffd166', '#5ec8ff'],
    desc: 'Ba tầng lá thông, đèn nháy 4 màu, ngôi sao lấp lánh, kim tuyến vàng và 3 hộp quà dưới gốc.',
  },
  default: {
    label: tr('seasonTree.default.label'),
    tree: 'Cây xanh văn phòng',
    type: 'none',
    accent: '#3fa36b',
    colors: ['#3fa36b', '#2e8556', '#a5573b'],
    desc: 'Không có sự kiện → trả lại bàn số 1, không vẽ cây.',
  },
};
const ORDER = [
  'newyear',
  'tet',
  'valentine',
  'womensday',
  'spring',
  'reunification',
  'children',
  'summer',
  'nationalday',
  'midautumn',
  'autumn',
  'vnwomen',
  'halloween',
  'teachers',
  'christmas',
  'default',
];
const PRIORITY = [
  'tet',
  'midautumn',
  'newyear',
  'valentine',
  'womensday',
  'reunification',
  'children',
  'nationalday',
  'vnwomen',
  'halloween',
  'teachers',
  'christmas',
  'spring',
  'summer',
  'autumn',
];
const md = d => String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const inMD = (m, a, b) => (a <= b ? m >= a && m <= b : m >= a || m <= b);
const fmt = s => s.split('-').reverse().join('/');
for (const k in SEASONS) {
  const S = SEASONS[k];
  if (S.from) S.window = fmt(S.from) + ' → ' + fmt(S.to);
  if (!S.window) S.window = 'Mọi ngày còn lại';
}
function seasonFor(d) {
  d = d || new Date();
  const y = d.getFullYear(),
    t = d.getTime(),
    m = md(d);
  const near = (iso, b, a) => {
    const e = at(iso);
    return e != null && t >= e - b * DAY && t <= e + a * DAY + DAY - 1;
  };
  for (const k of PRIORITY) {
    const S = SEASONS[k];
    if (k === 'tet') {
      if (near(TET[y], 21, 10) || near(TET[y + 1], 21, 10)) return k;
      continue;
    }
    if (k === 'midautumn') {
      if (near(MID[y], 14, 3)) return k;
      continue;
    }
    if (inMD(m, S.from, S.to)) return k;
  }
  return 'default';
}
function drawSeasonTree(ctx, bx, by, s, t) {
  bx = Math.round(bx);
  by = Math.round(by);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(bx, by, 12, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  (D[s] || D.default)(ctx, bx, by, t);
  ctx.globalAlpha = 1;
}
export const SeasonTree = { seasonFor, drawSeasonTree, SEASONS, ORDER };
