// The page as the Mac's desktop wallpaper (docs/specs/2026-11-10-wallpaper-design.md): the LiveWallpaper app in
// wallpaper/ opens it with ?wallpaper=1, and the page then shows only the sky and the island, edge to edge, with no
// header, buttons or panels and no pointer handling. Any value but 0 / false / no switches it on.
function fromSearch(search) {
  if (!search || typeof search !== 'string') return false;
  const p = new URLSearchParams(search);
  if (!p.has('wallpaper')) return false;
  return !/^(0|false|no)$/i.test(p.get('wallpaper'));
}
// As a wallpaper the page is drawn at FPS frames a second instead of every display refresh. Measured on a MacBook
// with an external screen (2026-11-10): at 60 frames WebKit's GPU process took ~135 % of a core and the two pages
// ~50 %; at 20 frames ~60 % and ~27 %; at 10 ~40 % and ~20 %, but people walk visibly in steps. 15 keeps the pixel
// art smooth enough. A frame is due once 1000 / FPS ms have passed since the last one drawn, less a little slack for
// vsync jitter (at 60 Hz every fourth refresh is 66.7 ms apart, give or take a fraction).
const FPS = 15,
  SLACK_MS = 4;
function frameDue(t, last) {
  return last == null || t - last >= 1000 / FPS - SLACK_MS;
}
export const WallpaperLogic = { fromSearch, FPS, frameDue };
