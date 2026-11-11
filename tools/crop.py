# python3 tools/crop.py out.png in.png:cx,cy [in.png:cx,cy ...] [--w 260 --h 220 --z 3 --cols 3]
# Close-ups cut from screenshots (centre in CSS px of a 1512-wide shot at 2x), tiled, to look at pixels.
import sys
from PIL import Image
a = sys.argv[1:]; o = {'w': 260, 'h': 220, 'z': 3, 'cols': 3}
while '--' in ''.join(a[-2:-1])[:2]: o[a[-2][2:]] = int(a[-1]); a = a[:-2]
out, tiles = a[0], []
for spec in a[1:]:
    f, c = spec.rsplit(':', 1); cx, cy = [float(v) * 2 for v in c.split(',')]
    im = Image.open(f).convert('RGB'); x, y = int(cx - o['w'] / 2), int(cy - o['h'] / 2)
    tiles.append(im.crop((x, y, x + o['w'], y + o['h'])).resize((o['w'] * o['z'], o['h'] * o['z']), Image.NEAREST))
W, H = tiles[0].size; rows = -(-len(tiles) // o['cols'])
sheet = Image.new('RGB', (W * o['cols'], H * rows))
for i, t in enumerate(tiles): sheet.paste(t, ((i % o['cols']) * W, (i // o['cols']) * H))
sheet.save(out); print(sheet.size)
