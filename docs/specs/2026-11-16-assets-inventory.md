# ai-terrarium: inventory of drawable things (for a `/assets` wiki page)

Worktree `~/ai-terrarium/.claude/worktrees/assets-wiki` (branch `claude/assets-wiki`). Every path below is under `web/` unless it says otherwise. Line numbers are where the function starts.

## 0. Things to know first

**Coordinates.** The scene is drawn in logical px. The whole scene is `LW×LH = 1104×931`, with `OX=368, OY=202` (computed in `office-scene.js`). A tile is 16 px wide and 8 px tall, in 2:1 iso.
- `PG(x,y,z)` is the lawn-level projection: `[OX+(x-y)*16, OY+(x+y)*8 - z]`.
- `P` is `PG` lifted by `FLOOR_Z=8` (the office floor).
- `PA` gives the ground height wherever a person stands (stairs, restroom).

All three are module constants, not parameters. Any office-mixin drawing is therefore pinned to scene coordinates.

**Six drawing styles.** Each style is a different way to render one item on its own:

| Style | Signature | Standalone? |
|---|---|---|
| **K. kit furniture** | `F.<name>(kit(ctx, ox, oy), t, o)` (`decor-kit.js:128`, `kit` makes its own P around (ox,oy)) | **Yes, trivially.** Pick any (ox,oy). |
| **PK. pantry kit** | `PantryItems.I[name].draw(PantryItems.kit(ctx, ox, oy), t, {night, use})` (`pantry-kit.js:34`) | **Yes, trivially.** Optional `k.shadow(0,0,w,h,0.22)`. |
| **ST. season-tree art** | `SeasonTree.drawSeasonTree(ctx, bx, by, key, t)` (`season-tree.js:241`) | **Yes, trivially.** The foot is at (bx,by). |
| **IP. island painter** | `drawX(pt, P, C, d, …)`: `pt = painter(ctx, P)` (`island-art.js:32`); `P` is any projection; `C(colour, snowAmt)` maps colour through night, snow and season; `d = {x,y,…}` is the tile | **Yes, with a tiny shim.** Pass your own `P = (x,y,z)=>[ox+(x-y)*16, oy+(x+y)*8-z]` and `C = c=>c`, or `seasonC(c=>night(mix(c,SNOW,snow*s),df), look)` as in `sky-island.js:42 bakeTools`. **The variant is chosen by `hash(d.x,d.y,salt)`**, so a catalogue picks tile coords to get each variant. |
| **SP. data sprites** | `DogSprites.frame(breed,name)` / `CritterSprites.frame(kind,name)` return `{rows,w,h,ax}` plus a palette | **Yes, trivially.** Or use the cached canvas from `ClaudeOffice.prototype.critterSprite(kind,name,dfB,red,flip)`. |
| **M. office mixin** | `ClaudeOffice.prototype.<m>.call(this, G, items?, …)` with `G = {ctx, poly, box, rect, th, t, df, ev, cold}` (built in `office-draw.js:338`; `poly`/`box`/`rect` close over `ctx` and the module `P`) | **Possible but scene-pinned.** Use `ctx.translate(-sceneX+pad, -sceneY+pad)` plus a stub `this`. Precedents: `IslandScene` borrows 70 methods onto a non-React host (`island-scene.js:23,181`), and `tests/office-draw-cathedral.test.mjs:47` calls `ClaudeOffice.prototype.cathedralItems.call({env:{reduced}}, {ctx,t,df}, items, ev)`. |
| **B. baked** | `SkyRender.renderIsland(island, frame, k, env)` paints into one scene-sized canvas (`sky-island.js:57`) | **Not alone** for lawn, shore, underside, water, mountain, pool, garden stones, flowers and snow lying. The helpers are exported, but they need full `island` data and they paint at island coordinates. You can render the full bake and crop it, or refactor. |
| **L. per-frame life** | `IslandLife.drawLife(ctx, island, PG, t, env)` (`island-life.js:623`) | **Not alone.** It draws every effect in one pass, and its internals (`geometry()`, `drawWater`, falls, mist, birds, flies) are module-private. Lake-life pieces are exported but need the private `geometry(island,PG)` result `g`. |

**The env shape** (built by `office.js:555 envNow`):
`{df: 0..1 daylight, hour, fx: {cloud, rain, snow, storm, fog}, reduced, frozen, flash, col: SkyLogic.skyColors(df,hour,fx), season: 'spring'|'summer'|'autumn'|'winter', event: 0..3}`.
- The weather presets are `SkyLogic.FX` (`sky-logic.js:142`): clear, cloudy, rain, storm, snow, fog.
- Snow cover is `snowShown` (0..1). `SnowLogic.depth(snow)` turns it into depth levels.
- The light buckets are `dfB = round(df*10)` and `snB = round(snow*10)`.

**Event object.** `EventLogic.active()` returns `{key:'christmas', level:1|2|3, eve, day}` (`event-logic.js:18`).
- Level 1 (1–7 Dec): lights, wreaths, Santa hats.
- Level 2 (8–14 Dec): candy canes, desk decor, full outfits, dressed dogs, kennel and pergola lights.
- Level 3 (15–26 Dec): everything.
- The event forces the season to winter (`EventLogic.season`).

**Themes.** `THEMES.night | day | blueprint` (`office-scene.js:402`). `th` carries floor, wall, trim, plant, pot, shadow and stroke colours. `office.js:506 theme` lerps between night and day by `dayFactor()`.

---

## 1. Trees and plants

| Item | Draws it (file:line) | Variants and drivers | Anim | Size (px) | Signature / deps | Standalone |
|---|---|---|---|---|---|---|
| Island tree, seasonal | `island-art-season.js:65 drawSeasonTree(pt,P,C,d,kind)`; `bareTree` :132; `firTree` :179; `trunk` :51 | 5 kinds: `fresh` (spring, 3–4 blossom clusters by hash), `green` (summer), `gold` (autumn, fallen leaves and flecks), `bare` (winter, snowed twigs), `fir` (winter during the Christmas event; `tall` 0–2 by hash). Snow caps through `C(c,s)`; night through `C`. In the live scene, `snowOnTop()` adds snow on the sprite (`island-art-snow.js:148`). | no | `TREE_EXT=[12,32,12,4]` → 24×36 | IP: `pt`, `P`, `C`, `d={x,y}`, `kind`. Kind comes from `SeasonLogic.look(season).trees` (`season-logic.js:30`) and is `fir` when the event is on and the trees are bare (`sky-island.js:207`). | **Yes** (IP) |
| Holiday / event trees (16 arts) | `season-trees.js` registers them into `D` (`season-art.js:56`): christmas:3, newyear:44, tet:81, valentine:125, womensday:138, spring:173, reunification:192, children:212, summer:236, nationalday:267, midautumn:282, autumn:308, vnwomen:331, halloween:357, teachers:389, default:421. The dispatcher is `season-tree.js:241`. | The date window is `SeasonTree.seasonFor(d)` (`season-tree.js:218`; lunar Tet/Mid-Autumn from the `TET`/`MID` tables in `season-art.js:37,45`). Live, only `type` `event`/`lunar` are drawn, and only on the 3 `HOLIDAY_TREES` tiles (`season-island.js:54`; not at Christmas). At night they are tinted through a scratch canvas (`office-draw.js:133 drawEventTree`, `NIGHT_TINT`). **spring, summer, autumn and default arts are never drawn live.** | yes, from `t` (blinking lights, flags, balloons, bats, fireworks, falling petals) | about 32×45 (pot to star, ±16 wide); scratch 48×58 | ST: `ctx`, `bx`, `by`, `key`, `t`. Shared helpers: `R`, `tri`, `blob`, `pat`, `heart`, `pot` (`season-art.js`). | **Yes** (ST) |
| Big Christmas tree (indoors) | `island-art-xmas.js:43 drawBigTree(pt,P,T,tile,level)`. The sprite is cached by `office-draw-xmas.js:163 treeSprite`; lights come from `xmasTreeLights` :223 and `litStar` :90. | Presents by level: `EventLogic.GIFTS=[0,2,5,9]` (`event-logic.js:117`). There are 24 bulbs in 4 colour groups (`BULB`/`BULB_OFF`); they blink by `groupLit(g,t,still)` and glow when `df<0.6` (`glowAt`). The star twinkles. | lights only | `BIG_TREE_EXT=[27,72,27,9]` → 54×81 | The still part is IP-like and already called standalone: `drawBigTree({ctx:g}, ()=>foot, c=>night(c,…), [0,0], level)`. Lights are an M-style method, pinned at `TREE_AT=[9.5,7]`. | Tree **yes**; lights need M or a copy |
| World mini tree | `world-ui.js:193 tree(g,x,y,df,kind)` | `green`, `fresh` (blossom), `gold`, `bare` (snow dots); night by `df` | no | about 6×9 | `g`, foot `x,y`, `df`, `kind` | **Yes** |
| Far-island trees | `sky-mist.js:384 farTree`, `:350 farFir` (inside `paintFarIsland`) | `FAR_CANOPY` fresh/green/gold, bare branches, festive lit fir | no | scales with `sc` | private; reach through `farIsland()` | via the far island |
| Office corner plants (3) | inline in `office-draw.js:618-637` | theme `th.plant`/`th.pot` | no | about 16×24 | inline in `draw()`; uses `box`/`rect` and `P` | **No** (inline; copy the 20 lines) |
| Desk plant / office plants | `decor-furniture.js:347 F.plants` | none | `t` | about 1 tile | K | **Yes** |
| Pantry plants | `pantry-items.js:4 PLANT(k,x,y,t,kind,z)`: kind 0 = leafy, 1 = bamboo/grass | sway by `t` | yes | about 20×28 | PK kit | **Yes** |
| Bamboo planter between office and pantry | `office-draw-furniture.js:39 drawPlanter(G,sg)` | th.plant, day/night lerp, blueprint | no | 1 tile | M | **Dead code**: listed in `SCENE_METHODS`, never called |
| Pergola vine, trough shrubs | inside `office-draw-smoking.js:15 smokingItems` | snow tint `SN`, night | no | part of the corner | M | No (part of the corner) |

## 2. Small outdoor decor

| Item | Draws it | Variants and drivers | Anim | Size | Signature / deps | Standalone |
|---|---|---|---|---|---|---|
| Bush | `island-art.js:459 drawBush(pt,P,C,d,fruit)` | big or small (`hash(x,y,41)`); berries (`hash 43`); `fruit` (spring: red and purple berries) | no | ext `[11,15,11,4]` → 22×19 | IP | **Yes** |
| Mushroom | `island-art.js:490 drawMushroom` | red with white spots or brown (`hash 45`); 1 or 2 (`hash 47`) | no | about 12×10 | IP | **Yes** (baked into the lawn live) |
| Rock / boulder | `island-art.js:514 drawRock`, `:442 boulder(pt,C,sx,sy,s)` | size 0 or 1 (`hash 49`) | no | about 12×8 | IP | **Yes** |
| Lawn flower dot | inline in `sky-island.js:152` | 3 colours or `d.colour`; density `look.flowers` | no | 1 px | baked | No (trivial) |
| Spring extra flowers | `island-art-season.js:309 drawSeasonFlowers(ctx,P,C,island,W,H,look)` | only when `look.flowers>1`; `PETALS` 4 colours | no | small | whole-island pass | **No** (it places itself over the island) |
| Lamp post | `island-art.js:368 drawLamp(pt,P,C,island,l)` | unlit sprite (`POLE_LAMP` rows); glow at night is separate (`island-life.js:554 drawLampLight`) | glow `t` | ext `[9,25,8,3]` → 17×28 | IP (`island` is unused apart from the name) | **Yes** (sprite); glow needs L |
| Candy cane (by each lamp) | `island-art-xmas.js:97 drawCandyCane(pt,P,T,l)` | event level ≥ 2 | no | `CANE_EXT=[4,14,5,2]` → 9×16 | IP (`T` is the colour fn) | **Yes** |
| Stone bench (rest corner) | `island-art.js:384 drawBench(pt,P,C,b)` | none | no | ext `[13,15,13,8]` → 26×23 | IP | **Yes** |
| Pavilion (one pillar, in the lake) | `island-art-lake.js:239 drawPavilion(pt,P,C,island)`; lantern glow `island-life.js:570` and `island-lake-life.js:383/399`; Christmas lights string `office-draw-xmas.js:40-75` | night via `C`; lights at event level 3 | lantern glow | `PAVILION_EXT=[31,59,31,8]` → 62×67 | IP, but reads `island.pavilion` (x, y, pillar; geometry from `PAVILION`, `island-art.js:314`) | **Yes** with a stub `island={pavilion:{x,y,pillar}}` (check the fields used) |
| Snowman (3 looks) | `island-art-season.js:226 drawSnowman(pt,P,C,m)` | `m.look%3`: tall with top hat and red scarf; stout with bucket, broom and blue scarf; small, tilted, green scarf | no | `SNOWMAN_EXT=[15,35,15,5]` → 30×40 | IP, `m={x,y,look}`. Live only in winter (`look.frozen`) at `SeasonIsland.snowmanTiles` (3 tiles) | **Yes** |
| Lotus pads and flowers | `island-art-lake.js:171 drawLakeDecor` (pads), `:207 flower(pt,C,x,y,kind)` | 2–3 pads per clump (hash); flower `pink`, `white` or none; hidden when frozen | no | about 14×8 | baked; `flower()` is private | `flower` no (private); pads no (loop over `island.lotus`) |
| Stepping stones to the pavilion | `drawLakeDecor` loop over `pav.path` | size by hash | no | about 12×6 | baked | No |
| Garden path stones and worn strip | `sky-island.js:122-149` | 2 tones by hash | no | per stone | baked inline | No |
| Duckweed | `island-lake-life.js:301 drawWeed(ctx,g,list,df)` | opens and closes (`weed(island,t,frozen)`); none when frozen | yes | small | needs private `g` | **No** |

## 3. The island, sky and weather

| Item | Draws it | Variants and drivers | Anim | Standalone |
|---|---|---|---|---|
| Lawn checker and season grass tint | `sky-island.js:78-87`; `island-art-season.js:24 seasonC` | season tint (spring #9be36b 0.2, autumn #e2b43c 0.45, winter #f2f7ff 0.35); night `df` | no | No (baked) |
| Shore faces and soil lip | `island-art.js:295 shoreFace(pt,P,C,x,y,plane,bare)` | x or y plane; bare under the fall | no | Per tile, yes (IP); meaningful only as part of the island |
| Underside (earth and stone) | `island-art.js:250 drawUnderside` / `:254 undersideLayer` (pixel layer per frame) | night | no | **No** (needs `island` and `frame`) |
| 1 px outline | `sky-island.js:97-115` | `OUTLINE '#3B2F4A'` | | No |
| Snow lying on the lawn, snow edge, icicles | `island-art-snow.js:34 drawSnowLawn`, `:78 drawSnowEdge`, `:99 drawIcicles`, `:12 snowTile`, `:119 snowCap`, `:148 snowOnTop(img,k,S,depth)` | `SnowLogic.depth(snow)` levels; night via `S` | no | `snowOnTop` works on any sprite canvas (yes); the rest are baked |
| Lake water (open or frozen ice) | `island-art-lake.js:92 drawWater` (baked) and `:356 iceDetail`; moving surface `island-life.js:364 drawWater` (private) | `frozen`; rain rings; glints | yes | **No** |
| Mountain | `island-art-mountain.js:89 drawMountain(pt,P,C,island,snow)` | snow amount | no | **No** (`island.mountain` shape) |
| Pool at the mountain's foot | `island-art-mountain.js:215 drawPool` | frozen | no | No |
| Waterfalls (main and mountain) | `island-life.js:462 drawMainFall`, `:393 drawMountainFall` (private) | flow from `fx` (rain makes it stronger) | yes | **No** |
| Frozen falls (ice columns) | `island-season-life.js:100 drawIceFalls`, `:69 iceColumn` | winter | no | No (needs `g`) |
| Vines on the cliff | `island-life.js:436 drawVines` (private) | wind (autumn breeze) | yes | No |
| Mist at the falls | `island-life.js:501 drawMist`; sprites `sky-mist.js:47 mistSprite`, `:66 mistWisp` | sky colours; frozen | yes | `mistWisp(ctx,x,y,cw,ch,v,lit,shade,a)` **yes** |
| Rainbow | `island-life.js:529 drawRainbow`, `:288 paintRainbow` | after rain for 3 min (`rainbowLevel`, `RAINBOW_MS`) | fade | No (private) |
| Lamp pools of light | `island-life.js:544 drawPools`, `:554 drawLampLight` (exported) | night (`lampGlow(df)`) | flicker | `drawLampLight(ctx,island,PG,i,t,env)`: island-pinned |
| Fall particles (petals, leaves, snow) | `island-season-life.js:33 drawFall(ctx,island,PG,t,env)`; seeds `season-island.js:80/125` | `look.fall`: petals (30), leaves (200), snow (200); wind | yes | No (whole island) |
| Plinth, stone faces, stairs | inline `office-draw.js:273-326` | night stone | no | No (inline) |
| Sky gradient, stars, moon, sun with halo, clouds, far islands, sea mist bands | `sky-render.js:36 drawBack(ctx,w,h,t,env)` | `df`, `hour` (the sun arcs), `fx.cloud`, `flash` (lightning), season, event, `env.overview` | yes | Full stage only (a w×h canvas works, so a small "sky swatch" is possible) |
| Far islands | `sky-mist.js:184 farIsland(ctx,x,y,sc,col,kind,trees,snowy,festive)`, painter `:215`, `farSnowman` :365, `farCabin` :373 | `kind`: `plain`, `tree`, `rock`; `trees`: fresh, green, gold, bare; `snowy`; `festive` (lit fir, snowman, cabin with a lit window, event ≥ 2) | no | **Yes** (needs only `col.haze`; cached per kind) |
| Rain, snow, fog banks, near cloud, mist wisps | `sky-render.js:196 drawFront(ctx,w,h,t,env)`; `sky-mist.js:135 mistRow` | `fx.rain`, `fx.snow`, `fx.fog`, `fx.storm` | yes | Full stage only |
| Storm tint over the island | `office-draw.js:687` | `fx.storm` | | inline |
| Transition cloud banks (world mode) | `sky-render.js:323 drawCurtains`, `:285 curtainEdge` | sky colours | yes | Yes (w×h canvas) |
| Sun, moon, stars | inside `drawBack` (lines ~57–110) | `df`, `hour`, `fx.cloud` | twinkle | No (inline) |

## 4. Animals

| Item | Draws it | Variants and drivers | Anim | Size | Signature / deps | Standalone |
|---|---|---|---|---|---|---|
| Dogs (3 breeds × 9 frames) | Data in `dog-sprites.js:4 BREEDS` with `frame()` :383. Canvas sprite in `office-draw-people.js:520 dogSprite(breed,name,dfB,snB,ev)`; placed by `:553 drawDog` | Breeds: corgi, husky, dalmatian (`name`, `pal`). Frames: stand, wag, run1, run2, sit, lie, sleep, bow, drink. Act-to-frame mapping is `DogLogic.pose(d,t)` (`dog-logic.js:632`): rest/company→lie, sleep/inside→sleep\|lie, drink/sniff→drink, sit, bow, play→bow/run1, moving→run1/run2/stand. Snow settles on top pixels (`snB≥3`). Night mix `DogLogic.nightMix`. Extras in `drawDog`: drink ripples, sleep Z, greeting heart. | `t` | corgi 15×10, husky 17×12, dalmatian 17×13 (frames 12–18 × 7–14) | `dogSprite` uses only `this.dogSprites` (a Map) | **Yes** (SP; `dogSprite.call({dogSprites:new Map()}, …)`) |
| Dogs at Christmas | `dog-sprites-xmas.js:103 dress(breed,name,f)`, `:94 palFor` | corgi: antlers and red nose (`PAD=3` extra rows); husky: red scarf; dalmatian: red sweater with white collar. `ev.level≥2`. | | +3 px tall | pure | **Yes** |
| Kennels (3) | `office-draw-doghouse.js:52 doghouseItems(G,items,snow,dfB,snB)`; helpers `doghouseShingles` :181, `doghouseSleeper` :201, `doghouseBowl` :216, `doghouseBone` :231, `doghouseLantern` :246, `doghouseZs` :277 | Roof colour per dog (`ROOF` :11: red, blue, green); snow on the roof (depth); dog inside (`act 'inside'`) with Zs; wall lantern glows at night; Christmas: small wreath over the door (`office-draw-xmas.js:104 wreath`) and gable lights (level 2) | Zs, lantern | about 1 × 0.7 tiles, ~40×40 | M; positions fixed by `DOG_HOUSES` (`office-scene.js:92`); `this.dogs`, `this.dogSprite`, `this.eventNow` | M + translate (one `items` entry per house, so you can pick one) |
| Ducks | `island-lake-life.js:321 drawDucks(ctx,g,list,df,t)`, `:257 duckShape` | awake or asleep (head tucked); wake ring; none when frozen | yes | 9×8 | needs private `g` | **No**; `duckShape` is private (~10 lines to copy) |
| Fish | `island-lake-life.js:276 drawFish` | under water; none when frozen | yes | tiny | needs `g` | No |
| Birds (V flock by day) | `island-life.js:597 drawBirds`, `:61 creatures` | `df>0.6`; wing up or spread; none in heavy rain | yes | about 5×3 each | private | No |
| Fireflies | `island-life.js:580 drawFlies` | `df<0.3`, none in winter | pulse | 1–2 px with glow | private | No |
| Polar bear (mother) and cub | Data `critter-sprites.js:271 BEAR_TOP`, `KINDS.bear`, `KINDS.cub` (:300). Drawn by `office-draw-bears.js:137 drawBear` through `critterSprite`. Behaviour `polar-bears.js` | Frames: stand, walk1, walk2, lie. Winter only. | `t` | bear 22×11, cub 12×7 | SP | **Yes** |
| Igloo | `office-draw-bears.js:54 paintIgloo(dfB)` (private), `:142 drawIgloo(G,dfB)` | night `dfB` | no | `IW×IH=64×46` | M; pinned at `BEARS.igloo` | M + translate (or export `paintIgloo`) |
| Reindeer (incl. Rudolph) | `critter-sprites.js:37 KINDS.reindeer`; `office-draw-critters.js:20 paint`, `:161 drawCritter` | stand, walk1, walk2, look, graze; `red` = Rudolph (`RUDOLPH` palette; nose glow after dark `NOSE_GLOW`) | | 18×16 (graze 20×8) | SP / `critterSprite` | **Yes** |
| Elves | `KINDS.elf` | walk1, walk2, carry1, carry2, place, slip | | 7–10 × 11–12 | SP | **Yes** |
| Penguins | `KINDS.penguin` | stand, waddle1, waddle2, slide | | 7×8 (slide 12×4) | SP (drawn at `WATER_Z` on the ice) | **Yes** |
| Santa (seated by the tree) | `KINDS.santa` | sit, wave | | 12×15 | SP | **Yes** |
| Santa's sleigh (sky) | `KINDS.sleigh` `fly`; `office-draw-critters.js:184 drawSleigh(ctx,back,w,h)` | crosses the back sky canvas; drops parcels | yes | 44×13 | SP; `drawSleigh` is stage-pinned | Sprite **yes** |
| Parcel (parachute or box) | `KINDS.parcel` | chute, box | | 9×11, 9×5 | SP | **Yes** |
| Present pile by the stairs | `office-draw-critters.js:83 paintPile(n,dfB)` (private), `:175 drawPile` | n presents = placed by elves + landed from the sleigh (`PILE`) | no | `PILE_W×H=36×16` | M | M (or export `paintPile`) |

**Data-sprite counts.** Dogs: 3 breeds × 9 frames = 27, doubled by the Christmas dress = 54. Critters: reindeer 5, elf 6, penguin 4, santa 2, sleigh 1, parcel 2, bear 4, cub 4 = 28 frames. Every critter frame also has a flip and 11 night levels (`critterSprite` cache index `dfB*4+red*2+flip`).

## 5. People

Everything here is `ClaudeOffice.prototype.drawPerson(G, a)` (`office-draw-people.js:145`). It is **M style**:
- **`this` needs:** `state.sel`, `env.reduced`, `xmasArms` (when `G.ev`) and `drawRod`.
- **`a` needs:** `{x, y, id, sid, status, seated, moving, dirFront, actNow, stool, skin, shirt, acc, parent, tool, outfit, look}`.
- **Position:** `PA(a.x,a.y)` (scene-pinned). Set `a.x` and `a.y`, then translate.
- **Look:** comes from `PeopleLogic.look(sid)` (`people-logic.js:63`), cached on `a.look` (`LOOK`, `office-people.js:13`).
- **Body parts:** live in `PERSON` (`office-people.js:16`) and take `(R, L, sx, hy, …)`, where `R` is a rect fn. They are **standalone** helpers.

| Aspect | Where | Values |
|---|---|---|
| Gender | `people-logic.js:28 genderOf` | m, f |
| Skin / hair colour / pants / skirt / layer | `people-logic.js:30-45` | `SKIN` 8; `HAIR` 13 entries (11 unique); `PANTS` 7; `SKIRT` 5; `LAYER` 5 |
| Hair style | `STYLE` (:47); drawn by `PERSON.hairFront` :18, `hairBack` :107, `hairSeat` :305, `hairProfile` :371, `hairBath` :407 | m: crop, side, quiff, buzz, curly, cap. f: long, wavy, bob, ponytail, bun |
| Beard | `STYLE.m.beard`; drawn in `PERSON.face` :168 | stubble, full, moustache, or none |
| Top | `PERSON.top` :201 | m: tee, shirt, hoodie, jacket. f: blouse, tee, cardigan, dress. Layered (jacket, cardigan) with a layer colour. The shirt colour is the department colour (`shirtOf`, `office-people-xmas.js:35`) |
| Legs | `PERSON.legs` :260, `legsSit` :285 | pants or skirt; walk frames l1/l2; tap (waiting) |
| Accessory | `drawPerson` :421 plus `face` | glasses, headset, earrings |
| Statuses | `office-util.js:37 ST`, `ICON` :49 | working, thinking, talking, waiting, permission, error, idle, done, entering, leaving. Icons: permission, error, done, idle, waiting, talking, plus the thinking cloud, sleep Zs and done confetti |
| Seated poses (at the desk) | `drawPerson` :199-361 | skey: working (typing arms), reading, terminal (Bash: red mug and steam), thinking (hand to chin), permission (hand up), error (hands on head, smoke), done (both arms up), visitor (talking, profile hair), subagent (waiting), default |
| Standing / walking | :362-478 | walk 2-frame (`t*9`); front or back (`dirFront`); waiting tap; talking wave and mouth; done arms up; error shake; stool sit (heights 1 and 2) |
| Idle acts (arms and props) | `actArms` :32; `drawRod` :108 | coffee, fridge, water, snack/vending, microwave, phone, smoke (`SmokeLogic.cycle`: drag, ember, puffs), fish (rod, line, float, nibble), arcade, foosball, stretch, table (cup), meal, bench, wc, bath |
| Bathing in the pond | :157-184 | head and shoulders in ripples |
| Asleep at the desk (mat, pillow, blanket) | `drawSleeper` :617 | hair style on the pillow; blanket colour by id; breathing (`t`); xmas `hatSleep` | 
| Sleep "Z"s over the desk | `office-draw.js:661` | | 
| Sub-agent | `a.parent` | gold crown (no outfit) or elf outfit (event) |
| Selection ring | :153 | `state.sel === a.id` |
| Christmas outfits | `outfit-logic.js:61 outfit(sid,ev,isSub,dept)`; drawn by `office-people-xmas.js XMAS`: `hatEvent` :44, `scarf` :87, `top` :95, `hatSleep` :114, `breath` :38 | Level 1: Santa hat only. Level ≥ 2: `KINDS` santa, sweater (2 alt colourways), reindeer, coat (department colour), snowman. Sub-agents are always elf. `HATS`: santa, muffs, antlers, beanie, tophat, elf. Scarf in the department colour. Breath puffs when `G.cold` (snow depth ≥ 2, daylight, outdoors) |
| Christmas idle acts | `office-draw-idle-xmas.js:44 xmasArms`; `drawSnowball` :111, `drawRolled` :122, `drawTrail` :136; layout `event-idle.js` | snowball (throw arc), snowman (rolling a ball that grows), skate (arms out, trail on the ice), gift (setting a present down), cocoa (red mug and steam in place of coffee) |
| Falling out of the EXIT door | `office-draw-fall.js:80 drawFaller(ctx,f,x,y,s,u)`, `:61 drawFallers` | tumbling, shrinking, fading; `SIZE`× scale; drawn on the sky canvas | yes; standalone-ish (takes ctx and a figure record) |
| Fate scenes (20) | `office-draw-fate.js:83 SCENES`: lightning, wind, freeze, lake, ufo, balloon, rocket, melt, hole, dust, ghost. `office-draw-fate-more.js:23`: fish, duck, banana, snowball, bird. `office-draw-fate-xmas.js:16`: sleigh, wrapped, skateoff, chimney. Helpers: `fig` :31, `doll` :44, `skeleton` :52, `wisps` :66, `ripples` :72 | Weights and conditions from `fate-logic.js:13 FATES` (storm, wind, cold, frozen, night, hot, xmas, eve); duration 3–5 s | `u` = seconds since start | Signature `SCENES[kind](S, G, f, u, x, y)`, with `S` = an object that has `drawPerson`, `f = {who: agent, seed}`, and (x,y) = feet px. **Standalone-able** with a stub `S`, so it can be shown as an animated loop |
| Speech bubbles, status chip, header | DOM/React (`office-render.js`, `bubble-logic.js` MODES speech, always, off; `office-render-header.js`) | | | **Not canvas** (would need HTML and CSS) |

**Approx. size.** A person is about 10×21 px standing (foot to hair top, `hy = by-18`), +5 for a hat. The seated status icon floats about 36 px above the seat.

## 6. Office furniture and decor (`decor-*.js`, `office-decor.js`, `office-draw*.js`)

`OfficeDecor.ITEMS` (`office-decor.js:89`) is a ready catalogue: `{key, name (vi), fn, wall?}` × 16. Every `fn` is K style (`fn(kit(ctx,ox,oy), t, o)`).

| key | fn (file:line) | Options / variants | Used live? |
|---|---|---|---|
| desk | `decor-furniture.js:5 F.desk` | `o.screen`: code, read, term, think, perm, error, done, off (`SCREEN` `office-decor.js:8`, animated by `t`; `SCREEN_MAP` status→screen :107); `o.lit` 0..1 (`PropUse`); `o.noMug` | yes (`deskWorkstation` :119; 16 desks) |
| chair | `:109 F.chair` (= chairBase + backrest) | none | yes |
| chairBase | `:78` | | via chair |
| backrest | `:98` | drawn over a seated person | yes |
| bookshelf | `:139` | `BOOKS` :113 | **catalogue only** |
| coffee | `:173` | `t` | **catalogue only** |
| fridge | `:214` | | **catalogue only** (the pantry has its own) |
| cooler | `:233` | | **catalogue only** |
| vending | `:254` | `t` | **catalogue only** |
| table | `:292` | | **catalogue only** |
| partition | `:316` | `o.color` | **catalogue only** (live partitions are `drawSeg`) |
| plants | `:347` | `t` | **catalogue only** |
| window | `decor-wall.js:155 F.window` (art `windowDraw` :3) | `o.night` (day sky or night sky), `t` | yes (4 on the back wall, `office-draw.js:373`) |
| walldecor | `:168` (poster `posterDraw` :114, clock `clockDraw` :73, EXIT `exitDraw` :101) | `t` (EXIT glow) | **catalogue only** |
| door | `:182` (art `doorDraw` :138, plus EXIT sign and mat) | `t` | yes (`office-draw.js:459`) |
| rug | `:191` | | **catalogue only** |

Other office pieces:

| Item | Where | Variants | Standalone |
|---|---|---|---|
| Usage board (5h / 7d) | `decor-boards.js:248 drawUsageBoard(ctx,X0,Y0,o,t,dir)`; surfaces `boardLED` :18, `boardWhite` :93, `boardGauge` :166; `BOARDS` :237 | `o.variant`: led (live), whiteboard, gauge; `o.night`; `o.h5`/`o.d7` 0..1 (colour `UCOL`: green, amber, red); reset minutes; `dir` left/back | **Yes** (78×48 surface, `mount` skews it) |
| Office walls, trim, cap, skirting | inline `office-draw.js:359-368` | theme `th.wl`/`wr`/`trim`; snow on walls `office-draw-winter.js:35 winterWalls` (`snowOnWall` :21) | No (inline) |
| Floor tiles and department zones | inline `office-draw.js:461-513` | checker `th.fa`/`fb`; zones tinted by department colour (`DEPT_PAL` `office-scene.js:393`); empty zones darkened; pantry tiles and planks lerp day/night | No |
| Floor paint (department name, EMPTY, PANTRY) | inline `:542-583` with `text3` 3×5 pixel font (`office-util.js:93/153`; also `decor-kit.js:3/47`, `pantry-kit.js:16`) | | `text3` **yes** |
| Glass partition segments | `office-draw-furniture.js:14 drawSeg(G,sg,own)` | department colour cap; blueprint theme | M (66 segs) |
| Left-wall shelf, colour binders | inline `office-draw.js:413-417` | | No |
| Wall clock (live time) | inline `office-draw.js:418-456` (reads `new Date()`) | real time | No (inline; `clockDraw` is the static one) |
| Corridor bookshelf | inline `:638-651` | | No |
| Entry mat, window light patches on the floor | inline `:585-594` | `df` | No |
| Legacy desk | `office-draw-furniture.js:122 drawDesk` | vacant theme `vacantTheme` | **Dead code** |
| Christmas desk decor | `office-draw-xmas.js:118 deskDecor(ctx,i,x,y)` | `i%3`: mini tree, stocking, tinsel; level ≥ 2, owned desks only | **Yes** (private fn; 4 rects) |
| Wreath | `office-draw-xmas.js:104 wreath(ctx,x,y,small)` | big (EXIT door) or small (kennel gables) | **Yes** (private) |
| Light strings | `office-draw-xmas.js:76 drawString(ctx,at,t,glow,still,lit)`; layout `STRINGS` :40 via `EventLogic.lightString` | levels: walls (1), kennels and pergola (2), pavilion (3); blink groups; night glow `glowSprite` :15 | **Yes** (give it any `Float32Array` of x,y pairs) |
| Footprints in snow | `office-draw-winter.js:42 drawPrints(G,now)` | fade over `PRINT_LIFE` | M |

## 7. Pantry (`pantry-*.js`)

`PantryItems.I` is a **full catalogue with metadata**: `{name (vi), group (vi), size [w,d] tiles, note (vi), wall?, flat?, draw(k,t,o)}`. Order is in `ORDER` (`pantry-items.js:49`) and live placement in `LAYOUT` (:74). Draw: `I[name].draw(PantryItems.kit(ctx,ox,oy), t, {night, use})`. `use` 0..1 comes from `PropUse` (`prop-use.js`; lit or moving only while someone uses it). The pantry is always indoors (no season or snow).

| name | line | group | size | options | animated |
|---|---|---|---|---|---|
| fridge | `pantry-kitchen.js:4` | Bếp | 0.82×0.76, wall | `use` (door open) | yes |
| cabinet | :60 | Bếp | 1.8×0.8 | none | no |
| espresso | :86 | Bếp | 0.7×0.55 | `use` | yes |
| grinder | :138 | Bếp | 0.9×0.45 | `use` | yes |
| sink | :176 | Bếp | 1.3×0.6 | `use` | yes |
| microwave | :224 | Bếp | 0.95×0.6 | `use` | yes |
| drinkfridge | :266 | Bếp | 1.0×0.8 | `use` | yes |
| wallcab | :309 | Bếp | 2.0×0.42, wall | `night` | no |
| neon (CAFE sign) | :331 | Bếp | 2.9×0.3, wall | `night` | flicker by `t` |
| island (bar) | :373 | Quầy bar | 3.5×0.95 | `use` | |
| stool | :438 | Quầy bar | 0.4×0.4 | none | |
| pendant lamp | :467 | Quầy bar | 0.4×0.4 | `night` (glow) | |
| sofa | `pantry-lounge.js:5` | Phòng khách | 2.8×0.9 | none | |
| coffeetable | :44 | Phòng khách | 1.6×0.65 | none | |
| armchair | :85 | Phòng khách | 0.85×0.9 | none | |
| floorlamp | :113 | Phòng khách | 0.4×0.4 | `night` | |
| rug | :136 | Phòng khách | 4.4×3.4, flat | none | |
| booth | :169 | Góc booth | 0.6×3.7 | none | |
| cafetable | :194 | Góc booth | 1.4×0.7 | `use`, `night` | |
| arcade | :243 | Góc game | 0.7×0.8 | `use`, `night` (screen and strip lights) | yes |
| foosball | :309 | Góc game | 1.6×0.6 | `use` | yes |
| planter | :354 | Cây xanh | 0.55×2.5 | `night` | sway |
| potplant | :369 | Cây xanh | 0.5×0.5 | none | sway |

Size in px is roughly `(w+d)*16` wide.

## 8. Restroom and smoking corner

| Item | Where | Pieces | Standalone |
|---|---|---|---|
| Restroom block | `office-draw-restroom.js:31 restroomItems(G,items,snow)`; `:522 restroomPaint`; layout `RestroomLogic.layout` (`restroom-logic.js`), `WC` in `office-scene.js:76` | slab, plinth and stairs; lobby planks and room tiles; rug; back wall; hand dryer; plant; room walls; mirrors; urinals with modesty screens; front wall with 2 doorways; door signs (pictograms via `RESTROOM_GLYPH` `office-util.js:138`, dusty blue men, dusty pink women); swing doors (`RestroomLogic.doorSwing`, shut or swung); stalls (accent panels, wall-hung toilets, door shut with a red light when occupied); vanities (cabinet, worktop, steel sinks, taps, `propLit`); bar stool; bench; painted lobby name. Mostly reuses pantry kit pieces. | **No.** One big M pass at a fixed spot, part drawn immediately and part pushed as `items`. Needs `this.agents`, `this.propLit`. Renderable as a cropped "room" view only |
| Smoking corner | `office-draw-smoking.js:15 smokingItems(G,items,snow)`; layout `SmokeLogic.layout` (`smoke-logic.js`) | stone pad (warm light pool at night), planted trough (one item per tile), slatted bench, cantilever pergola with trellis, vine and knee brace, ash bin, extinguisher, bollard light (glow), no-smoking-area sign. Snow via `SN(c,k)`, night via `N` | M with no `this` deps. Pushes several items at fixed `SMOKE.x/y` (PG). **Crop it as one "corner" card** |
| Smoke (cigarette) | in `drawPerson` (:430-456) | ember, wisp, exhale (`SmokeLogic.cycle`) | part of the person |

## 9. Christmas event pieces (outdoors and landmark)

| Item | Where | Variants | Size | Standalone |
|---|---|---|---|---|
| Cathedral (landmark) | `island-art-cathedral.js:376 paintCathedral(level,depth)` (cached `cathedralLayer` :395), `:466 drawCathedral(pt,P,T,S,depth,level,at)`; palette `CATHEDRAL_PAL` :28; nave, towers, spire, rose window, garland, mini firs | event `level` 1–3; snow `depth` (roof snow); night via `T`/`S` | `CATHEDRAL_EXT=[64,110,60,10]` → 124×120 | **Yes** (IP-like; `paintCathedral(level,depth)` returns a pixel layer). Placed only if `EventLandmark.site(island,block)` finds room |
| Cathedral lights | `office-draw-cathedral.js:69 cathedralGlow`, `:41 windowSprite`, `:56 eveHalo`, `:115 cathedralItems` | night windows, rose halo, facade string; eave string (level 2); rose ring and star (level 3); Christmas Eve = all lit and halo | | M (test harness already does this) |
| Our Lady statue and crib (yard) | `island-art-cathedral-yard.js:110 drawOurLady(pt,P,T,S,depth,level,at)`; `:41 crib`, `:57 figure`; `yardLayer` :94; glow `office-draw-cathedral.js:93 yardGlow` | level (crib light ≥ 2), snow depth, night | `LADY_EXT=[18,30,18,8]` → 36×38 | **Yes** |
| Big tree, candy canes, critters, presents, sleigh, wreaths, strings, desk decor, outfits, dog dress, idle acts, fate scenes sleigh/wrapped/skateoff/chimney | see sections 1, 2, 4, 5, 6 | | | |
| Far islands "festive" | `sky-mist.js:184` with `festive=true` (event ≥ 2) | | | **Yes** |

## 10. World view (multi-island hub)

| Item | Where | Variants | Size | Standalone |
|---|---|---|---|---|
| Simple island (LOD "simple") | `world-ui.js:217 paintIsland(g,color,df,lit,mine,season)`, cached by `art(key,paint)` :87 and drawn by `world-draw.js:329 drawSimpleIsland` | `color` (the island's roof colour; `ISLAND_COLORS` in `hub/pages.js`); `df` day/night; `lit` 0–6 windows (busy sessions); `mine` (gold pennant); `season` (grass tint, snow on roof and lawn, flowers or leaves, mini trees) | `ART_W×ART_H = 88×59` | **Yes** |
| Slot tile (no island) | `world-ui.js:284 paintTile(g,kind)` | `empty`, `yours` (gold), `full` | 88×59 | **Yes** |
| Island name plate | `world-ui.js:302 plate`, `world-draw.js:391 drawIslandLabel` | busy count, alert dot, offline, hover, mine | | Yes (text) |
| Full island (LOD "full") | `IslandScene` (`island-scene.js:98`) borrows the office draw at `lodK` | the whole office scene per island; only reindeer among the critters (`only:'reindeer'`) | | The scene |
| World clouds | `world-draw.js:135 drawClouds` | phase | | method |

## 11. Wallpaper mode

`wallpaper-logic.js`: `?wallpaper=1` runs at 15 fps and redraws the back sky every 2nd frame. **It has no unique drawables**; it shows the same scene and sky with no UI.

---

## A. Existing catalogues and metadata in code (wiki feed)

| Source | What it gives | Language |
|---|---|---|
| `season-tree.js:5 SEASONS` (+ `ORDER` :175, `PRIORITY` :193, `seasonFor` :218) | 16 entries: `label` (i18n `seasonTree.*.label`), `tree` (title), `type` (event, lunar, season, none), `from`/`to`/`key` or `window`, `accent`, `colors[]`, `desc` | label in 7 langs; **`tree`, `desc` and the computed `window` are hard-coded Vietnamese** |
| `office-decor.js:89 ITEMS` | 16 office pieces `{key, name, fn, wall}` | `name` Vietnamese |
| `pantry-*.js` `I.*` + `pantry-items.js ORDER/LAYOUT` | 23 pieces `{name, group, size, note, wall, flat}` | Vietnamese |
| `season-logic.js:30 LOOKS` + table comment :23 | per season: trees, grass tint, flowers, fruit, fall, wind, minSnow, frozen; `ACCENT` colours :107; i18n `season.*` | i18n |
| `event-logic.js` | level-to-content table (comment :12–16), `GIFTS`, `TREE_AT`, `MAX_BULBS` | English comments |
| `outfit-logic.js` | `KINDS`, `HATS`, `MAKE` colours | code |
| `people-logic.js` | `STYLE`, palettes | code |
| `dog-sprites.js BREEDS` | `name` (Corgi, Husky, Dalmatian), `pal`, `frames` | English names |
| `critter-sprites.js KINDS` | kinds, frames, palettes (no names) | |
| `fate-logic.js:13 FATES` | 21 kinds incl. `exit`: `at`, `dur`, weight fn of conditions; i18n `bubble.fate.*` (20 lines with emoji) | i18n |
| `office-scene.js` | `ACT_TXT` (21 acts, i18n `office.act.*`); `WEATHER_LABEL`, `WEATHER_PREVIEW` (i18n `weather.*`); `THEMES` (labels Night shift, Sunny studio, Blueprint); `DEPT_PAL` | i18n |
| `office-util.js` | `ST` (10 statuses, i18n `office.status.*`, colours), `ICON` pixel icons | i18n |
| `sky-logic.js:142 FX`, `WEATHERS` | 6 weathers | |
| `decor-boards.js:237 BOARDS` | 3 board variants | |
| `world-ui.js KIND_LABEL` :16 | work kinds (i18n `world.kind.*`) | |

**The i18n test fences this off.** `tests/i18n.test.mjs:86-87` (`DESIGN_NOTES` + `CATALOGUE = /^web\/(season-|decor-|office-decor|pantry-)/`) whitelists Vietnamese only in the `tree`, `desc`, `window`, `name`, `group` and `note` fields of those files. Anywhere else, Vietnamese fails the test. A wiki page that shows these strings to non-Vietnamese viewers needs new i18n keys (7 tables in `web/i18n/*.js`).

## B. How pages are served, and what `/assets` needs

**Local server** (`server.js:159 createHandler`):
- `/` and `/index.html` read `claude-office.html` (`HTML_FILE`, :95) and send it with `text/html`, `no-cache`.
- `/web/*` goes to `lib/web-assets.js readAsset` / `respond` (ETag, gzip). `ASSET_RE = /^\/web\/((?:[a-z0-9-]+\/)?[a-z0-9-]+\.(js|css))$/`. It allows `.js` and `.css` only, lowercase `[a-z0-9-]` names, and at most one sub-folder.
- There is **no CSP** on the local server. Every other path returns 404.

**Hub** (`hub/publish.js`):
- `GET /` (:334) needs a session (`helpers.requireSession`). Signed out it gets `welcomePage()` with `PAGE_CSP` (`hub/pages.js:13`). Signed in it gets `officePage.get()` from `createOfficePage(OFFICE_FILE)` (`hub/csp.js`), which caches the file by mtime and hashes inline scripts into the CSP.
- `GET ASSET_RE` (:347, `ownLimit`, no session) serves the same web assets.
- The router (`hub/http.js:126`) matches a string path exactly or a RegExp.
- `officeCsp` (`hub/csp.js:20`):
  - `default-src 'none'`
  - `script-src 'self' <hashes> https://cdnjs.cloudflare.com`
  - `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`
  - `font-src https://fonts.gstatic.com`
  - `connect-src 'self'` plus open-meteo
  - `img-src 'self' data:`
  - `frame-ancestors 'none'`, `base-uri 'none'`, `form-action 'self'`

**The current shell** is `claude-office.html`, 10 lines with no `<html>`/`<head>`. It loads Google Fonts, `web/styles.css`, React 18.3.1 and ReactDOM UMD from cdnjs with SRI, and `<script type="module" src="web/main.js">`.

**Adding `/assets` would take:**
1. A new shell, e.g. `claude-assets.html` at the root. It must load React UMD if it imports `office-scene.js` or `office.js`: `office-scene.js:9` does `export const h = React.createElement` at import time, and `office.js` defines `ClaudeOffice` on `React.Component`.
2. A module entry under `web/`, e.g. `web/assets-main.js`. A flat name passes `ASSET_RE`, and so does a sub-folder `web/assets/x.js`.
3. Local: one `else if (route === '/assets' …)` branch in `server.js:198` reading the new file. The simplest change gives `createHandler` a second `htmlFile`-like option, since tests inject `htmlFile`.
4. Hub: a `list.push({method:'GET', path:'/assets', handler})` in `hub/publish.js`, with its own `createOfficePage(ASSETS_FILE)` (that gives the same CSP). Decide whether it needs a session; `/` does.
5. **Tests that will break:**
   - `tests/i18n.test.mjs:95` asserts that `moduleGraph()`, which starts from **only** `claude-office.html`'s entry, reaches every `web/**/*.js`. A new entry module (and anything only it imports) fails this until `moduleGraph` (`tests/web.mjs:16`) learns a second entry.
   - `tests/i18n.test.mjs:9` scans only `claude-office.html` for Vietnamese; the new shell should be added.
   - `tests/hub-hardening.test.mjs:35` lists assets from `moduleGraph`.
6. **Name clash to note:** the repo root already has an `assets/` folder (logo, screenshots; read by `hub/pages.js:17`). It is not served over HTTP, so there is no route conflict, only naming confusion.

## C. Existing previews and test harnesses

**Settings preview buttons** (`office-render-settings.js`):
- Season: `previewSeason(k)` at :106 calls `SeasonLogic.startSeasonPreview` and lasts 60 s.
- Event: :91 calls `EventLogic.startPreview` and shows level 3 for 60 s.
- Weather: :313 calls `this.previewWeather(type)` (`office.js:548`, `SkyLogic.startPreview`), which blends in within about 3 s and lasts a minute.

All three act on the live scene: they swap `seasonNow()`, `eventNow()` and `env`. None renders an item on its own.

**Headless harnesses:**
- `tests/office-draw-cathedral.test.mjs:11-26` has a Proxy recording 2D context (`context(log,state)` logs every call with its fillStyle and alpha; gradients and image data are stubbed). It also has a fake `document.createElement` that returns `{width,height,getContext}`, and it calls `ClaudeOffice.prototype.cathedralItems.call({env}, {ctx,t,df}, items, ev)`. **This is the pattern for driving M-style draws without a page.**
- `tests/island-art-cathedral.test.mjs:209 withCanvas(fn)` is a smaller fake document.
- `tests/island-underside.test.mjs:49` checks that a palette layer keeps `fillRect`.
- `tests/back-wall.test.mjs`, `season-frozen`, `rest-corner` and `event-landmark` shim `globalThis.React = {createElement, Component}` so `office-scene.js` loads in Node.
- Loaders: `tests/web.mjs loadWeb(name)` (`require` of ESM, Node 22.12+), `tests/load-i18n.mjs loadI18n('vi')`.
- `IslandScene` (`island-scene.js:98-183`) is a production precedent for a non-React host running the office draw methods. It needs: `agents`, `depts`, `state.sel`, `dogs`, `dogSprites`, `dogWorld`, `canvas`, a `theme` getter, an `env` getter, `seasonNow`, `eventNow`, `snowShown`, `noUsage`, and `islandCache` get/set.

## D. Counts per category (items / variants found)

| Category | Distinct items | Variants (approx.) | Notes |
|---|---|---|---|
| Trees and plants | 10 | ~45 | island tree 5 kinds; event trees 16 arts; big Xmas tree 4 present levels × lit/unlit; world mini tree 4; far canopies 4 + festive fir; office corner plant; F.plants; pantry PLANT 2; planter (dead) |
| Small outdoor decor | 13 | ~30 | bush 2×2 (+ fruit), mushroom 2×2, rock 2, flower dots, spring flowers, lamp (+ glow), candy cane, bench, pavilion (+ lantern, + lights), snowman 3, lotus pad / flower pink, white, stepping stones, garden stones, duckweed |
| Island, sky and weather | 24 | ~60 | lawn × 4 seasons × snow depth × night; underside; shore; snow/icicles; water open/frozen; mountain ± snow; pool; 2 falls / ice falls; vines; mist; rainbow; lamp pools; fall particles 3; plinth and stairs; sky gradient, sun, moon, stars, clouds; far islands 3 kinds × 4 trees × snowy × festive; front weather 6 presets + storm tint + flash; transition curtains |
| Animals | 15 | 27 dog frames (54 with dress) + 28 critter frames + duck 2 + bird 2 + fly + igloo + pile + 3 kennels | dogs 3 breeds × 9; reindeer 5 (+ Rudolph), elf 6, penguin 4, santa 2, sleigh 1, parcel 2, bear 4, cub 4 |
| People | 1 figure, many parts | gender 2 × hair 6/5 × top 4/4 × beard 4 × acc 4 × skin 8 × hair colour 11 …; 10 statuses; 10 seated poses; ~8 standing poses; 21 acts; bath; sleeper; faller; outfits 7 (hat-only, santa, sweater ×2, reindeer, coat, snowman, elf); hats 6; 20 fate scenes | |
| Office furniture and decor | 16 (`ITEMS`) + 14 others | screen 8 modes × lit; window day/night; usage board 3 × day/night × levels; 3 themes; zone tints; Xmas desk decor 3; wreath 2; strings 4 placements | 9 of the 16 `ITEMS` are catalogue-only (never drawn live) |
| Pantry | 23 | `use` on 10, `night` on 8 | full metadata catalogue |
| Restroom | 1 block (~17 piece types) | occupied/free stalls, door swing, men/women, snow | one pass; not separable |
| Smoking corner | 1 corner (8 piece types) | night light, snow | one pass; items separable by index |
| Christmas landmark | 2 (cathedral, statue and crib) | 3 levels × snow depths × day/night/eve | baked sprites standalone, lights M |
| World view | 4 | island: colours × 11 df × 7 lit × mine × 4 seasons; tile 3 | fully standalone |
| **Total** | **~135 items** | **~350+ variant combinations worth a card** | |
