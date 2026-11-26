// When the scene's lights come on, in one place (spec 2026-11-18-asset-labels §5.6; tests/light.test.mjs). df is the
// daylight factor (dayFactor in web/sky-logic.js: 1 full day, 0 deep night). Each asset says which of these it uses;
// they need not all switch at the same df, but every threshold is read from here.
//   night(df)   the night palette: window panes, the usage board, the pantry's and the restrooms' night colours, the
//               frost on the office windows, the screens' idle blue, the moment's day/night half (df < 0.5)
//   day(df)     the day colours of the painted names on the floor and the restrooms' lobby sign (df > 0.5; at 0.5
//               exactly neither night nor day: these keep their night colour there, as they always did)
//   glow(df)    how strongly a light glows: nothing by day, rising from df 0.6 to full at 0 (the Christmas lights, the
//               lanterns, the WC lamps, the smoking corner's lights, embers, Rudolph's nose); glow(df) > 0 is "lit"
//   screen(df)  a working monitor and the desk lamp cast light on the desk (df < 0.7)
//   grain(df)   the floor's day grain shows (df > 0.2); specks(df) its night specks (df < 0.8)
//   lamp(df)    the island's lamp posts across the same band: off at df 0.8, full at 0.2
const NIGHT = 0.5,
  GLOW = 0.6,
  SCREEN = 0.7,
  BAND = [0.2, 0.8];
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);

const night = df => df < NIGHT;
const day = df => df > NIGHT;
const glow = df => (df >= GLOW ? 0 : 1 - df / GLOW);
const screen = df => df < SCREEN;
const grain = df => df > BAND[0];
const specks = df => df < BAND[1];
const lamp = df => clamp01((BAND[1] - df) / 0.6); // 0.6: the band's width, written out (0.8 - 0.2 is not 0.6 in floats)

export const Light = { NIGHT, GLOW, SCREEN, BAND, night, day, glow, screen, grain, specks, lamp };
