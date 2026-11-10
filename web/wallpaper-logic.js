// The page as the Mac's desktop wallpaper (docs/specs/2026-11-10-wallpaper-design.md): the LiveWallpaper app in
// wallpaper/ opens it with ?wallpaper=1, and the page then shows only the sky and the island, edge to edge, with no
// header, buttons or panels and no pointer handling. Any value but 0 / false / no switches it on.
function fromSearch(search) {
  if (!search || typeof search !== 'string') return false;
  const p = new URLSearchParams(search);
  if (!p.has('wallpaper')) return false;
  return !/^(0|false|no)$/i.test(p.get('wallpaper'));
}
export const WallpaperLogic = { fromSearch };
