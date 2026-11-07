// One island of the world view (several islands in one sky). Its simulation and drawing are the component's own
// methods, borrowed rather than copied, so every island in the world looks and moves exactly like the local page.
// What belongs to one island lives here; the sky, light, speed and selection come from the host component.
import './office-agents.js';
import './office-draw.js';
import './office-draw-furniture.js';
import './office-draw-restroom.js';
import './office-draw-smoking.js';
import './office-draw-people.js';
import './office-render.js';
import { DogLogic } from './dog-logic.js';
import { DOG_PLACES } from './office-scene.js';
import { ClaudeOffice } from './office.js';
export const SCENE_METHODS = [
  'syncLive',
  'addAgent',
  'dept',
  'colOwners',
  'freeDeskFor',
  'freeDesk',
  'log',
  'byId',
  'leave',
  'doneSweep',
  'goalFor',
  'updateAgent',
  'draw',
  'drawEventTree',
  'drawSeg',
  'drawPlanter',
  'pantryItems',
  'drawDesk',
  'actArms',
  'drawPerson',
  'drawRod',
  'drawSleeper',
  'headPos',
  'hit',
  'smokingItems',
  'restroomItems',
  'restroomPaint',
  'seasonNow',
  'stepDogs',
  'stepProps',
  'dogSprite',
  'drawDog',
];
// Every island bakes the same ground for a given resolution, light and snow, so one bake per k serves them all.
export const SCENE_ISLAND_CACHE = new Map();
// Dog sprites depend only on breed, frame and light, so all islands share one cache.
export const SCENE_DOG_SPRITES = new Map();
export class IslandScene {
  constructor(host, id) {
    this.host = host;
    this.id = id;
    this.agents = [];
    this.seq = 0;
    this.usedLooks = 0;
    this.goneSids = new Map();
    this.depts = new Map();
    this.firstSnap = true;
    this.seasonKey = 'default';
    this.canvas = document.createElement('canvas');
    this.k = null;
    this.lodK = 1;
    this.lod = null;
    this.drawnAt = -1e9;
    this.simAt = 0;
    this.state = { sel: null }; // the host's selected agent, when it is on this island
    this.raw = new Map(); // session id -> the session as the hub sent it (kind, tool, model for the detail panel)
    this.noUsage = true; // hubs carry no 5H / 7D usage, so the wall bars are left off
    this.dogWorld = { ...DOG_PLACES, agents: [], hour: 12, snow: 0, calm: false, now: 0, rand: Math.random };
    this.dogs = DogLogic.create(this.dogWorld);
    this.dogSprites = SCENE_DOG_SPRITES;
  }
  get theme() {
    return this.host.frameTheme || this.host.theme;
  }
  get env() {
    return this.host.env;
  }
  get speed() {
    return this.host.speed;
  }
  get seasonChoice() {
    return this.host.seasonChoice;
  }
  get seasonPreview() {
    return this.host.seasonPreview;
  }
  get snowShown() {
    return this.host.snowShown;
  }
  get islandCache() {
    return SCENE_ISLAND_CACHE.get(this.k);
  }
  set islandCache(v) {
    if (SCENE_ISLAND_CACHE.size >= 6 && !SCENE_ISLAND_CACHE.has(v.k)) SCENE_ISLAND_CACHE.clear();
    SCENE_ISLAND_CACHE.set(v.k, v);
  }
  renderK() {
    return this.lodK;
  } // canvas px per scene px, chosen by the world view from the island's level of detail
  sync(sessions) {
    this.raw = new Map(sessions.map(s => [s.id, s]));
    this.syncLive({ sessions });
  }
  frame(dt) {
    this.doneSweep(Date.now());
    this.agents.forEach(a => this.updateAgent(a, dt));
    this.stepDogs(dt);
    this.stepProps(dt);
    if (this.agents.some(a => a.gone)) {
      const gone = this.agents.filter(a => a.gone);
      gone.forEach(a => this.goneSids.set(a.sid, a.leftWhy || 'missing'));
      this.agents = this.agents.filter(a => !a.gone);
      const h_ = this.host;
      if (h_.state.selIsland === this.id && gone.some(a => a.id === h_.state.sel)) h_.setState({ sel: null });
    }
  }
}
for (const m of SCENE_METHODS) IslandScene.prototype[m] = ClaudeOffice.prototype[m];
for (const g of ['season', 'treeOn'])
  Object.defineProperty(IslandScene.prototype, g, Object.getOwnPropertyDescriptor(ClaudeOffice.prototype, g));
