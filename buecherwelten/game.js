(() => {
'use strict';
// ===================================================================
// Bücherwelten – ein Bücherei-Abenteuer (Prototyp)
// Alles (Grafik, Schrift, Musik) wird zur Laufzeit im Browser erzeugt.
// Keine externen Ressourcen, keine Netzwerkzugriffe, kein eval/innerHTML.
// ===================================================================

const VIEW_W = 384;
const VIEW_H = 216;
const TS = 16; // Kachelgröße in Pixeln

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;

// Daten nach dem Aufbau einfrieren – verhindert versehentliche oder
// eingeschleuste Änderungen an Spieldaten zur Laufzeit.
function deepFreeze(obj) {
  if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const key of Object.keys(obj)) deepFreeze(obj[key]);
  }
  return obj;
}

// Kleiner deterministischer Zufallsgenerator (mulberry32)
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return c;
}

function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function rgbToHex(r, g, b) {
  const h = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return '#' + h(r) + h(g) + h(b);
}

function shade(hex, f) {
  const [r, g, b] = hexToRgb(hex);
  if (f < 0) return rgbToHex(r * (1 + f), g * (1 + f), b * (1 + f));
  return rgbToHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f);
}

function mixHex(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t));
}

function rect(g, x, y, w, h, color) {
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
}

const pick = (arr, r) => arr[Math.floor(r() * arr.length) % arr.length];

// ===================================================================
// Pixel-Schrift (proportional, mit Umlauten). Zeilen mit '|' getrennt.
// 7 Zeilen = Großbuchstabenhöhe, 8 = mit Akzentzeile oben,
// 9 = mit Unterlänge, 10 = beides.
// ===================================================================
const FONT_SRC = {
  'A': '.###.|#...#|#...#|#####|#...#|#...#|#...#',
  'B': '####.|#...#|#...#|####.|#...#|#...#|####.',
  'C': '.###.|#...#|#....|#....|#....|#...#|.###.',
  'D': '####.|#...#|#...#|#...#|#...#|#...#|####.',
  'E': '#####|#....|#....|####.|#....|#....|#####',
  'F': '#####|#....|#....|####.|#....|#....|#....',
  'G': '.###.|#...#|#....|#.###|#...#|#...#|.####',
  'H': '#...#|#...#|#...#|#####|#...#|#...#|#...#',
  'I': '###|.#.|.#.|.#.|.#.|.#.|###',
  'J': '..###|...#.|...#.|...#.|#..#.|#..#.|.##..',
  'K': '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#',
  'L': '#....|#....|#....|#....|#....|#....|#####',
  'M': '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#',
  'N': '#...#|##..#|##..#|#.#.#|#..##|#..##|#...#',
  'O': '.###.|#...#|#...#|#...#|#...#|#...#|.###.',
  'P': '####.|#...#|#...#|####.|#....|#....|#....',
  'Q': '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#',
  'R': '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
  'S': '.###.|#...#|#....|.###.|....#|#...#|.###.',
  'T': '#####|..#..|..#..|..#..|..#..|..#..|..#..',
  'U': '#...#|#...#|#...#|#...#|#...#|#...#|.###.',
  'V': '#...#|#...#|#...#|#...#|.#.#.|.#.#.|..#..',
  'W': '#...#|#...#|#...#|#.#.#|#.#.#|##.##|#...#',
  'X': '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
  'Y': '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..',
  'Z': '#####|....#|...#.|..#..|.#...|#....|#####',
  'Ä': '.#.#.|.....|.###.|#...#|#...#|#####|#...#|#...#',
  'Ö': '.#.#.|.....|.###.|#...#|#...#|#...#|#...#|.###.',
  'Ü': '.#.#.|.....|#...#|#...#|#...#|#...#|#...#|.###.',
  'a': '.....|.....|.###.|....#|.####|#...#|.####',
  'b': '#....|#....|####.|#...#|#...#|#...#|####.',
  'c': '....|....|.###|#...|#...|#...|.###',
  'd': '....#|....#|.####|#...#|#...#|#...#|.####',
  'e': '.....|.....|.###.|#...#|#####|#....|.###.',
  'f': '.##|#..|###|#..|#..|#..|#..',
  'g': '.....|.....|.####|#...#|#...#|#...#|.####|....#|.###.',
  'h': '#....|#....|####.|#...#|#...#|#...#|#...#',
  'i': '#|.|#|#|#|#|#',
  'j': '..#|...|..#|..#|..#|..#|..#|#.#|.#.',
  'k': '#...|#...|#..#|#.#.|##..|#.#.|#..#',
  'l': '#.|#.|#.|#.|#.|#.|.#',
  'm': '.....|.....|##.#.|#.#.#|#.#.#|#.#.#|#.#.#',
  'n': '.....|.....|####.|#...#|#...#|#...#|#...#',
  'o': '.....|.....|.###.|#...#|#...#|#...#|.###.',
  'p': '.....|.....|####.|#...#|#...#|#...#|####.|#....|#....',
  'q': '.....|.....|.####|#...#|#...#|#...#|.####|....#|....#',
  'r': '....|....|#.##|##..|#...|#...|#...',
  's': '.....|.....|.####|#....|.###.|....#|####.',
  't': '.#..|.#..|###.|.#..|.#..|.#..|..##',
  'u': '.....|.....|#...#|#...#|#...#|#...#|.####',
  'v': '.....|.....|#...#|#...#|#...#|.#.#.|..#..',
  'w': '.....|.....|#...#|#.#.#|#.#.#|#.#.#|.#.#.',
  'x': '.....|.....|#...#|.#.#.|..#..|.#.#.|#...#',
  'y': '.....|.....|#...#|#...#|#...#|#...#|.####|....#|.###.',
  'z': '.....|.....|#####|...#.|..#..|.#...|#####',
  'ä': '.#.#.|.....|.###.|....#|.####|#...#|.####',
  'ö': '.#.#.|.....|.###.|#...#|#...#|#...#|.###.',
  'ü': '.#.#.|.....|#...#|#...#|#...#|#...#|.####',
  'ß': '.##.|#..#|#..#|#.#.|#..#|#..#|#.#.',
  'é': '...#.|..#..|.###.|#...#|#####|#....|.###.',
  '0': '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.',
  '1': '.#.|##.|.#.|.#.|.#.|.#.|###',
  '2': '.###.|#...#|....#|...#.|..#..|.#...|#####',
  '3': '.###.|#...#|....#|..##.|....#|#...#|.###.',
  '4': '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.',
  '5': '#####|#....|####.|....#|....#|#...#|.###.',
  '6': '.###.|#....|#....|####.|#...#|#...#|.###.',
  '7': '#####|....#|...#.|..#..|.#...|.#...|.#...',
  '8': '.###.|#...#|#...#|.###.|#...#|#...#|.###.',
  '9': '.###.|#...#|#...#|.####|....#|....#|.###.',
  '.': '.|.|.|.|.|.|#',
  ',': '..|..|..|..|..|..|.#|.#|#.',
  '!': '#|#|#|#|#|.|#',
  '?': '.###.|#...#|....#|...#.|..#..|.....|..#..',
  ':': '.|.|.|#|.|.|#',
  ';': '..|..|..|.#|..|..|.#|.#|#.',
  '-': '...|...|...|...|###|...|...',
  '–': '.....|.....|.....|.....|#####|.....|.....',
  "'": '#|#|.|.|.|.|.',
  '"': '#.#|#.#|...|...|...|...|...',
  '„': '...|...|...|...|...|...|#.#|#.#|...',
  '“': '#.#|#.#|...|...|...|...|...',
  '”': '#.#|#.#|...|...|...|...|...',
  '(': '.#|#.|#.|#.|#.|#.|.#',
  ')': '#.|.#|.#|.#|.#|.#|#.',
  '/': '....#|...#.|...#.|..#..|.#...|.#...|#....',
  '+': '.....|.....|..#..|..#..|#####|..#..|..#..',
  '*': '.....|#.#.#|.###.|#####|.###.|#.#.#|.....',
  '%': '##..#|##.#.|...#.|..#..|.#...|.#.##|#..##',
  '&': '.##..|#..#.|.##..|.#...|#.#.#|#..#.|.##.#',
  '#': '.#.#.|#####|.#.#.|.#.#.|#####|.#.#.|.....',
  '=': '....|....|####|....|####|....|....',
  '<': '...#|..#.|.#..|#...|.#..|..#.|...#',
  '>': '#...|.#..|..#.|...#|..#.|.#..|#...',
  '[': '##|#.|#.|#.|#.|#.|##',
  ']': '##|.#|.#|.#|.#|.#|##',
  '·': '.|.|.|.|#|.|.',
  '…': '.....|.....|.....|.....|.....|.....|#.#.#',
  '★': '...#...|..###..|#######|.#####.|..###..|.##.##.|.#...#.',
  '♪': '..##.|..#.#|..#..|..#..|.##..|###..|.#...',
  '→': '.....|..#..|...#.|#####|...#.|..#..|.....',
  '←': '.....|..#..|.#...|#####|.#...|..#..|.....',
  '↑': '..#..|.###.|#.#.#|..#..|..#..|..#..|.....',
  '↓': '.....|..#..|..#..|..#..|#.#.#|.###.|..#..',
  '▶': '#...|##..|###.|####|###.|##..|#...',
  '✓': '.....|....#|...#.|#.#..|.#...|.....|.....',
  '−': '...|...|...|...|###|...|...',
  '×': '.....|.....|#...#|.#.#.|..#..|.#.#.|#...#',
  '•': '..|..|..|##|##|..|..',
};

const Font = (() => {
  const LINE = 11;
  const SPACE = 4;
  const glyphs = new Map();
  let atlasW = 0;

  for (const ch of Object.keys(FONT_SRC)) {
    const rows = FONT_SRC[ch].split('|');
    const n = rows.length;
    const top = n === 8 || n === 10 ? 0 : 1;
    const w = rows[0].length;
    glyphs.set(ch, { rows, top, w, x: atlasW });
    atlasW += w + 1;
  }

  const atlases = new Map();
  function atlas(color) {
    let a = atlases.get(color);
    if (a) return a;
    a = makeCanvas(atlasW, 10);
    const g = a.getContext('2d');
    g.fillStyle = color;
    for (const gl of glyphs.values()) {
      gl.rows.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) {
          if (row[rx] === '#') g.fillRect(gl.x + rx, gl.top + ry, 1, 1);
        }
      });
    }
    atlases.set(color, a);
    return a;
  }

  function glyphFor(ch) {
    return glyphs.get(ch) || glyphs.get('?');
  }

  function advance(ch) {
    if (ch === ' ') return SPACE;
    return glyphFor(ch).w + 1;
  }

  function measure(str) {
    let w = 0;
    for (const ch of String(str)) w += advance(ch);
    return Math.max(0, w - 1);
  }

  // Zeichnet Text; y = Oberkante der Zeile (Akzentzeile).
  function draw(g, str, x, y, color = '#ffffff', scale = 1) {
    const a = atlas(color);
    let cx = Math.round(x);
    const cy = Math.round(y);
    for (const ch of String(str)) {
      if (ch === ' ') {
        cx += SPACE * scale;
        continue;
      }
      const gl = glyphFor(ch);
      g.drawImage(a, gl.x, 0, gl.w, 10, cx, cy, gl.w * scale, 10 * scale);
      cx += (gl.w + 1) * scale;
    }
    return cx;
  }

  function drawShadow(g, str, x, y, color = '#ffffff', shadow = '#1a1220', scale = 1) {
    draw(g, str, x + scale, y + scale, shadow, scale);
    return draw(g, str, x, y, color, scale);
  }

  function drawCentered(g, str, cx, y, color, shadow, scale = 1) {
    const w = measure(str) * scale;
    const x = Math.round(cx - w / 2);
    if (shadow) drawShadow(g, str, x, y, color, shadow, scale);
    else draw(g, str, x, y, color, scale);
  }

  // Wortumbruch auf maximale Breite; '\n' erzwingt Zeilenumbruch.
  function wrap(str, maxW) {
    const out = [];
    for (const para of String(str).split('\n')) {
      let line = '';
      for (const word of para.split(' ')) {
        const test = line ? line + ' ' + word : word;
        if (measure(test) <= maxW || !line) {
          line = test;
        } else {
          out.push(line);
          line = word;
        }
      }
      out.push(line);
    }
    return out;
  }

  return { LINE, measure, draw, drawShadow, drawCentered, wrap };
})();

// ===================================================================
// Palette & Sprites. Zeichen -> Farbe. Ziffern 1-9 sind Platzhalter,
// die pro Figur umgefärbt werden (Haare, Haut, Kleidung).
// ===================================================================
const PAL = {
  k: '#2b1d1f', K: '#140f17', w: '#f7f1e3', W: '#ffffff', e: '#231c2b',
  r: '#d1493f', R: '#8f2d33', o: '#ef8b3c', O: '#b8612b',
  y: '#f5cf4f', Y: '#c99a2f', l: '#86c35f', L: '#4a9150', n: '#2f6342',
  b: '#5fa8e8', B: '#3369b8', N: '#213e70', c: '#7fd6d9',
  p: '#9a64c4', P: '#5f3d86', m: '#ec86b2',
  t: '#d29a5c', T: '#a66d3c', u: '#744628', U: '#4a2b1b',
  h: '#f0e3c2', H: '#d6c08f', g: '#c7c1b6', G: '#8e887f', d: '#57514b', D: '#38332f',
  s: '#f3c4a0', S: '#d99c78', x: '#f6c937', X: '#c98f1c', v: '#a7d8ec',
};

const SKIN = {
  light: ['#f5cba8', '#dca27e'], medium: ['#e2ad80', '#c08562'], tan: ['#c98e5f', '#a46d45'],
  brown: ['#9f6942', '#7c4f31'], dark: ['#6e4428', '#52311c'],
};
const HAIR = {
  black: ['#2c2632', '#19141e'], brown: ['#6e452a', '#4a2d1b'], blonde: ['#f0cd66', '#c79f43'],
  red: ['#c75b2d', '#913f1d'], grey: ['#aaa6a1', '#7b7772'], white: ['#eeeae2', '#c3beb5'],
  auburn: ['#8c3c2b', '#62281b'], blue: ['#4c7fd4', '#33589c'], pink: ['#e68ab4', '#b45f86'],
};

// --- Figuren (16x16): 7 Bilder pro Frisur -------------------------
const CHAR_FRAMES = {
  short: {
    down0: [
      '................', '.....kkkkkk.....', '....k111111k....', '...k11111111k...',
      '...k11111111k...', '...k21777712k...', '...k17777771k...', '...k77e77e77k...',
      '...k87777778k...', '....kk7777kk....', '..k3333333333k..', '..k7433333347k..',
      '...k55555555k...', '...k555kk555k...', '...k999kk999k...', '................',
    ],
    down1: [
      '................', '.....kkkkkk.....', '....k111111k....', '...k11111111k...',
      '...k11111111k...', '...k21777712k...', '...k17777771k...', '...k77e77e77k...',
      '...k87777778k...', '....kk7777kk....', '..k3333333333k..', '..k7433333344k..',
      '...k55555555k...', '...k555kk999k...', '...k555k.kkk....', '...k999k........',
    ],
    up0: [
      '................', '.....kkkkkk.....', '....k111111k....', '...k11111111k...',
      '...k11111111k...', '...k11111111k...', '...k11111111k...', '...k21111112k...',
      '...k82222228k...', '....kk7777kk....', '..k3333333333k..', '..k7433333347k..',
      '...k55555555k...', '...k555kk555k...', '...k999kk999k...', '................',
    ],
    up1: [
      '................', '.....kkkkkk.....', '....k111111k....', '...k11111111k...',
      '...k11111111k...', '...k11111111k...', '...k11111111k...', '...k21111112k...',
      '...k82222228k...', '....kk7777kk....', '..k3333333333k..', '..k7433333344k..',
      '...k55555555k...', '...k555kk999k...', '...k555k.kkk....', '...k999k........',
    ],
    left0: [
      '................', '.....kkkkkk.....', '....k111111k....', '...k11111111k...',
      '...k11111111k...', '...k77111111k...', '..k77e711112k...', '...k77771112k...',
      '....k7777822k...', '.....kk777kk....', '....k3333333k...', '....k3433333k...',
      '....k7555555k...', '.....k55555k....', '....k99999kk....', '................',
    ],
    left1: [
      '................', '.....kkkkkk.....', '....k111111k....', '...k11111111k...',
      '...k11111111k...', '...k77111111k...', '..k77e711112k...', '...k77771112k...',
      '....k7777822k...', '.....kk777kk....', '....k3333333k...', '...k73433333k...',
      '....k5555555k...', '...k555kk555k...', '..k999k..k999k..', '................',
    ],
    left2: [
      '................', '................', '.....kkkkkk.....', '....k111111k....',
      '...k11111111k...', '...k11111111k...', '...k77111111k...', '..k77e711112k...',
      '...k77771112k...', '....k7777822k...', '....kkk777kk....', '....k3333333k...',
      '....k3437333k...', '....k5555555k...', '.....k55k55k....', '....k999kk99k...',
    ],
  },
};

// Lange Haare: Kopie der Kurzhaar-Bilder mit zusätzlichen Strähnen.
(function addLongHair() {
  const src = CHAR_FRAMES.short;
  const set = (rows, x, y, ch) => {
    const r = rows[y];
    rows[y] = r.slice(0, x) + ch + r.slice(x + 1);
  };
  const long = {};
  for (const key of Object.keys(src)) long[key] = src[key].slice();
  for (const key of ['down0', 'down1']) {
    const f = long[key];
    for (let y = 6; y <= 11; y++) {
      set(f, 2, y, 'k'); set(f, 3, y, '1'); set(f, 12, y, '1'); set(f, 13, y, 'k');
    }
    set(f, 3, 11, '2'); set(f, 12, 11, '2');
  }
  for (const key of ['up0', 'up1']) {
    const f = long[key];
    for (let y = 7; y <= 11; y++) {
      for (let x = 4; x <= 11; x++) set(f, x, y, y === 11 ? '2' : '1');
    }
  }
  for (const key of ['left0', 'left1', 'left2']) {
    const f = long[key];
    const off = key === 'left2' ? 1 : 0;
    for (let y = 7 + off; y <= 11 + off; y++) {
      set(f, 10, y, '1'); set(f, 11, y, '1'); set(f, 12, y, 'k');
    }
    set(f, 11, 11 + off, '2');
  }
  CHAR_FRAMES.long = long;
})();

// --- Bildaufbau aus Zeichen-Rastern -------------------------------
const spriteCache = new Map();

function buildSprite(rows, map = {}, key = null) {
  if (key && spriteCache.has(key)) return spriteCache.get(key);
  const h = rows.length;
  const w = rows[0].length;
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const col = map[ch] || PAL[ch];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
  }
  if (key) spriteCache.set(key, c);
  return c;
}

function flipCanvas(src) {
  const c = makeCanvas(src.width, src.height);
  const g = c.getContext('2d');
  g.translate(src.width, 0);
  g.scale(-1, 1);
  g.drawImage(src, 0, 0);
  return c;
}

// Silhouette-Sprites: Form-Funktion + Farbfunktion + automatischer Umriss
function maskSprite(w, h, inside, colorAt, outline = PAL.k) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  const m = [];
  for (let y = 0; y < h; y++) {
    m.push([]);
    for (let x = 0; x < w; x++) m[y].push(inside(x, y) ? 1 : 0);
  }
  const at = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? m[y][x] : 0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!m[y][x]) continue;
      const edge = !at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1);
      g.fillStyle = edge && outline ? outline : colorAt(x, y);
      g.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

// Figur-Aussehen -> Bildsatz (gecacht)
function lookKey(look) {
  return [look.style, look.hair, look.skin, look.shirt, look.pants, look.shoes, look.extra || ''].join('/');
}

const charCache = new Map();
function charSprites(look) {
  const key = lookKey(look);
  if (charCache.has(key)) return charCache.get(key);
  const frames = CHAR_FRAMES[look.style] || CHAR_FRAMES.short;
  const hair = HAIR[look.hair] || HAIR.brown;
  const skin = SKIN[look.skin] || SKIN.light;
  const map = {
    1: hair[0], 2: hair[1], 3: look.shirt, 4: shade(look.shirt, -0.25),
    5: look.pants, 6: shade(look.pants, -0.25), 7: skin[0], 8: skin[1], 9: look.shoes || '#3a2a26',
  };
  const mk = (name) => {
    const c = buildSprite(frames[name], map);
    if (look.extra) drawExtra(c.getContext('2d'), look.extra, name);
    return c;
  };
  const d0 = mk('down0');
  const d1 = mk('down1');
  const u0 = mk('up0');
  const u1 = mk('up1');
  const l0 = mk('left0');
  const l1 = mk('left1');
  const l2 = mk('left2');
  const set = {
    down: [d0, d1, d0, flipCanvas(d1)],
    up: [u0, u1, u0, flipCanvas(u1)],
    left: [l0, l1, l0, l2],
    right: [flipCanvas(l0), flipCanvas(l1), flipCanvas(l0), flipCanvas(l2)],
    portrait: d0,
  };
  charCache.set(key, set);
  return set;
}

// Accessoires: Brille, Dutt, Bart, Hut, Stirnband ...
function drawExtra(g, extra, frame) {
  const px = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
  const parts = extra.split('+');
  const down = frame.startsWith('down');
  const left = frame.startsWith('left');
  const dy = frame === 'left2' ? 1 : 0;
  for (const p of parts) {
    if (p === 'glasses') {
      if (down) { for (const x of [5, 6, 7, 8, 9, 10]) px(x, 7, '#2a2433'); px(6, 7, '#9fd0ee'); px(9, 7, '#9fd0ee'); }
      if (left) { px(3, 6 + dy, '#2a2433'); px(4, 6 + dy, '#2a2433'); px(5, 6 + dy, '#9fd0ee'); px(6, 6 + dy, '#2a2433'); }
    } else if (p === 'bun') {
      const y0 = frame === 'left2' ? 1 : 0;
      for (const [x, y] of [[6, 0], [7, 0], [8, 0], [9, 0], [6, 1], [9, 1]]) px(x, y + y0, PAL.k);
      for (const [x, y] of [[7, 1], [8, 1]]) px(x, y + y0, '#7b7772');
    } else if (p === 'beard') {
      const col = '#b8b4ad';
      if (down) { for (const x of [5, 6, 7, 8, 9, 10]) px(x, 8, col); for (const x of [6, 7, 8, 9]) px(x, 9, col); }
      if (left) { for (const x of [4, 5, 6, 7, 8]) px(x, 8 + dy, col); for (const x of [5, 6, 7]) px(x, 9 + dy, col); }
    } else if (p === 'hat') {
      const y0 = frame === 'left2' ? 1 : 0;
      for (let x = 3; x <= 12; x++) px(x, 2 + y0, '#1d1a22');
      for (let x = 2; x <= 13; x++) px(x, 3 + y0, '#1d1a22');
      for (let x = 5; x <= 10; x++) { px(x, 0 + y0, '#1d1a22'); px(x, 1 + y0, '#2e2a35'); }
    } else if (p === 'cap') {
      const y0 = frame === 'left2' ? 1 : 0;
      for (let x = 4; x <= 11; x++) { px(x, 1 + y0, '#2b4a7a'); px(x, 2 + y0, '#36598f'); }
      if (down) for (let x = 5; x <= 10; x++) px(x, 3, '#203a61');
      if (left) for (let x = 2; x <= 5; x++) px(x, 3 + y0, '#203a61');
    } else if (p === 'tattoo') {
      if (down) { px(5, 6, '#2b3e5a'); px(10, 6, '#2b3e5a'); px(5, 8, '#2b3e5a'); px(10, 8, '#2b3e5a'); px(7, 5, '#2b3e5a'); px(8, 5, '#2b3e5a'); }
      if (left) { px(4, 5 + dy, '#2b3e5a'); px(5, 7 + dy, '#2b3e5a'); px(6, 8 + dy, '#2b3e5a'); }
    } else if (p === 'headband') {
      const y0 = frame === 'left2' ? 1 : 0;
      for (let x = 4; x <= 11; x++) px(x, 4 + y0, '#e05a5a');
    } else if (p === 'pegleg') {
      if (left) { px(9, 14 + dy, '#efe7d6'); px(9, 13 + dy, '#efe7d6'); px(10, 14 + dy, '#2b1d1f'); }
      if (down) { px(10, 14, '#efe7d6'); px(9, 14, '#efe7d6'); }
    } else if (p === 'apron') {
      if (down) { for (let y = 11; y <= 13; y++) for (let x = 6; x <= 9; x++) px(x, y, '#fbf7ee'); }
      if (left) { for (let y = 11; y <= 13; y++) { px(4, y + dy, '#fbf7ee'); px(5, y + dy, '#fbf7ee'); } }
    } else if (p === 'headphones') {
      if (down) { px(3, 5, '#e05a5a'); px(3, 6, '#e05a5a'); px(12, 5, '#e05a5a'); px(12, 6, '#e05a5a'); }
      if (left) { px(9, 5 + dy, '#e05a5a'); px(9, 6 + dy, '#e05a5a'); px(10, 5 + dy, '#e05a5a'); }
    }
  }
}

// --- Gegenstände -------------------------------------------------
const BOOK_ROWS = [
  '..kkkkkkkk..', '.krrrrrrrrk.', '.krRRRRRRrkk', '.krRxxxxRrkw', '.krRRRRRRrkw',
  '.krrrrrrrrkw', '.krrrrrrrrkw', '.kkkkkkkkkkw', '..wwwwwwwwww',
];
function bookIcon(color) {
  return buildSprite(BOOK_ROWS, { r: color, R: shade(color, -0.3) }, 'book:' + color);
}

const ITEM_SPRITES = {
  book: bookIcon('#d1493f'),
  coin: buildSprite(['..kkkk..', '.kxxxxk.', 'kxXyyXxk', 'kxyXXyxk', 'kxyXXyxk', 'kxXyyXxk', '.kxxxxk.', '..kkkk..']),
  watch: buildSprite([
    '...kk...', '..kxxk..', '.kkkkkk.', 'kwwwkwwk', 'kwwwkwwk', 'kwwwkkwk', 'kwwwwwwk', '.kkkkkk.',
  ]),
  jar: buildSprite([
    '.kkkkkk.', 'kwwwwwwk', '.kkkkkk.', 'kvvvvvvk', 'kvoooovk', 'kvowwovk', 'kvoooovk', 'kvvvvvvk', '.kkkkkk.',
  ]),
  chair: buildSprite([
    '..kkkkkkkk..', '..kTTTTTTk..', '..kTttttTk..', '..kTttttTk..', '..kTTTTTTk..',
    '.kkkkkkkkkk.', '.ktttttttTk.', '.kTTTTTTTTk.', '.kk.kkkk.kk.', '.kk......kk.',
  ]),
  backpack: buildSprite([
    '..kkkk..', '.kk..kk.', 'kBBBBBBk', 'kBbbbbBk', 'kBkkkkBk', 'kBbBBbBk', 'kBBBBBBk', '.kkkkkk.',
  ]),
  burger: buildSprite(['.kkkkk.', 'kyyYyyk', 'kllllk.', 'kRRRRRk', 'kyyyyyk', '.kkkkk.']),
  phone: buildSprite(['kkkk', 'kbbk', 'kbbk', 'kbbk', 'kkkk']),
  gull: [
    buildSprite(['k.......k', 'gk.....kg', '.gk...kg.', '..gkwkg..', '....k....']),
    buildSprite(['.........', '.........', 'gggkwkggg', 'k..kwk..k', '....k....']),
  ],
};

// ===================================================================
// Prozedurale Kacheln & Möbel (alles per Pixel-Rechtecken gezeichnet)
// ===================================================================
const SPINES = [
  '#b8453a', '#2f6fb0', '#3b8f5a', '#e0b13c', '#7b52a6', '#cf6a2c', '#24877a', '#d98c3e',
  '#34495e', '#d95b8c', '#8f5a35', '#5e5bbf', '#9e2f3c', '#2a7c6b', '#e8a23d', '#41436e',
  '#6b8f3a', '#c2563f', '#2b6c8c', '#a3324e',
];

function px(g, x, y, c) {
  g.fillStyle = c;
  g.fillRect(x, y, 1, 1);
}

// --- Böden --------------------------------------------------------
function drawWoodFloor(g, x, y, tx, ty, light = '#d7a669', dark = '#c49157', seam = '#9c6b3e') {
  const r = makeRng(tx * 73856093 ^ ty * 19349663);
  for (let i = 0; i < 4; i++) {
    const yy = y + i * 4;
    rect(g, x, yy, 16, 4, (i + ty) % 2 ? light : dark);
    rect(g, x, yy + 3, 16, 1, seam);
    const j = Math.floor(r() * 14) + 1;
    rect(g, x + j, yy, 1, 3, seam);
    if (r() < 0.35) px(g, x + Math.floor(r() * 16), yy + 1, shade(light, 0.12));
  }
}

function drawCarpet(g, x, y, tx, ty, base, pat) {
  rect(g, x, y, 16, 16, base);
  for (let yy = 0; yy < 16; yy++) {
    for (let xx = 0; xx < 16; xx++) {
      const gx = tx * 16 + xx;
      const gy = ty * 16 + yy;
      if ((gx + gy) % 8 === 0 || (gx - gy + 1024) % 8 === 0) px(g, x + xx, y + yy, pat);
    }
  }
}

function drawStoneFloor(g, x, y, tx, ty) {
  rect(g, x, y, 16, 16, '#cfc8bb');
  rect(g, x, y + 7, 16, 1, '#b3ab9c');
  rect(g, x, y + 15, 16, 1, '#b3ab9c');
  rect(g, x + ((ty % 2) ? 3 : 11), y, 1, 7, '#b3ab9c');
  rect(g, x + ((ty % 2) ? 11 : 3), y + 8, 1, 7, '#b3ab9c');
  px(g, x + 5, y + 3, '#ddd7cb');
  px(g, x + 12, y + 11, '#ddd7cb');
}

function drawStage(g, x, y, tx, ty, edgeBelow) {
  drawWoodFloor(g, x, y, tx, ty, '#9b5e3c', '#8a5234', '#5e3622');
  if (edgeBelow) {
    rect(g, x, y + 12, 16, 4, '#4a2b1b');
    rect(g, x, y + 12, 16, 1, '#b07048');
  }
}

// --- Wände --------------------------------------------------------
function drawWallFace(g, x, y, kind, tx) {
  if (kind === 'window') {
    rect(g, x, y, 16, 16, '#5b4a44');
    rect(g, x, y + 1, 16, 11, '#3d3a48');
    rect(g, x + 1, y + 2, 14, 9, '#9fd3e6');
    rect(g, x + 1, y + 2, 14, 2, '#c8e9f3');
    for (let i = 0; i < 4; i++) px(g, x + 3 + i + (tx % 2) * 6, y + 9 - i, '#e8f7fb');
    rect(g, x + (tx % 2 ? 0 : 15), y + 1, 1, 11, '#2c2834');
    rect(g, x, y + 12, 16, 4, '#8a5a34');
    rect(g, x, y + 12, 16, 1, '#b07a48');
    rect(g, x, y + 15, 16, 1, '#4a2b1b');
  } else if (kind === 'curtain') {
    rect(g, x, y, 16, 16, '#7d2630');
    for (let i = 0; i < 16; i += 4) {
      rect(g, x + i, y, 1, 16, '#5c1a23');
      rect(g, x + i + 2, y, 1, 16, '#a33a45');
    }
    rect(g, x, y, 16, 2, '#d4a24c');
  } else {
    rect(g, x, y, 16, 16, '#efe3c8');
    rect(g, x, y, 16, 1, '#d7c7a6');
    rect(g, x, y + 9, 16, 7, '#9a6a3f');
    rect(g, x, y + 9, 16, 1, '#c18d58');
    rect(g, x + (tx % 2 ? 7 : 15), y + 10, 1, 5, '#7c5230');
    rect(g, x, y + 15, 16, 1, '#4a2b1b');
  }
}

function drawWallCap(g, x, y, open) {
  rect(g, x, y, 16, 16, '#3a2c2c');
  rect(g, x + 1, y + 1, 14, 14, '#4a3a38');
  if (open.n) rect(g, x, y, 16, 2, '#6d5651');
  if (open.s) rect(g, x, y + 14, 16, 2, '#2a1f1f');
  if (open.w) rect(g, x, y, 2, 16, '#5d4a46');
  if (open.e) rect(g, x + 14, y, 2, 16, '#5d4a46');
}

// --- Regale -------------------------------------------------------
function shelfKind(topicId) {
  const map = {
    c1_gross: 'large', c1_nach: 'lexicon', c2_lexika: 'lexicon', c1_hoer: 'media', c4_dvd: 'media',
    c4_hoer: 'media', c5_cd: 'cds', c5_dvd: 'media', c5_bluray: 'bluray', c4_games: 'games',
    c4_arto: 'art', c5_kunst: 'art', c5_noten: 'notes', c4_bilder: 'kids', c4_erst: 'kids',
    c4_fremd: 'kids', c4_comics: 'comics', c4_kinder: 'kids',
  };
  return map[topicId] || 'books';
}

function drawShelf(g, x, y, kind, color, seed) {
  const r = makeRng(seed);
  // Korpus
  rect(g, x, y, 32, 32, PAL.k);
  rect(g, x + 1, y + 1, 30, 3, '#c98f55');
  rect(g, x + 1, y + 1, 30, 1, '#e0ab70');
  rect(g, x + 1, y + 4, 30, 27, '#8a5832');
  rect(g, x + 1, y + 4, 2, 27, '#a8703f');
  rect(g, x + 29, y + 4, 2, 27, '#6f4425');
  // Schild in Collegefarbe
  rect(g, x + 11, y + 2, 10, 3, PAL.k);
  rect(g, x + 12, y + 2, 8, 2, color);
  const rows = [6, 15, 24];
  for (const ry of rows) {
    rect(g, x + 3, y + ry, 26, 7, '#3b2418');
    rect(g, x + 3, y + ry + 7, 26, 2, '#b67c47');
    rect(g, x + 3, y + ry + 8, 26, 1, '#6f4425');
    fillCompartment(g, x + 3, y + ry, 26, 7, kind, r);
  }
  rect(g, x + 1, y + 31, 30, 1, '#4a2b1b');
}

function fillCompartment(g, x, y, w, h, kind, r) {
  let cx = x;
  const end = x + w;
  if (kind === 'art') {
    while (cx < end - 6) {
      const fw = 6 + Math.floor(r() * 4);
      const fh = 5 + Math.floor(r() * 2);
      if (cx + fw > end) break;
      const fy = y + h - fh;
      rect(g, cx, fy, fw, fh, r() < 0.5 ? '#d9a441' : '#7a4a2a');
      rect(g, cx + 1, fy + 1, fw - 2, fh - 2, pick(['#7fb3d5', '#f5cba7', '#a9dfbf', '#f1948a', '#d2b4de'], r));
      px(g, cx + 2, fy + 2, pick(['#e74c3c', '#2e86c1', '#f4d03f', '#1e8449'], r));
      cx += fw + 1;
    }
    return;
  }
  if (kind === 'kids') {
    while (cx < end - 5) {
      const fw = 5 + Math.floor(r() * 3);
      if (cx + fw > end) break;
      const col = pick(['#f4d03f', '#5dade2', '#ec7063', '#58d68d', '#f0b27a', '#bb8fce'], r);
      rect(g, cx, y + 1, fw, h - 1, col);
      rect(g, cx, y + 1, fw, 1, shade(col, 0.35));
      const sx = cx + 1 + Math.floor(r() * (fw - 3));
      rect(g, sx, y + 3, 2, 2, pick(['#ffffff', '#2c3e50', '#e74c3c'], r));
      rect(g, cx + fw - 1, y + 1, 1, h - 1, shade(col, -0.3));
      cx += fw + 1;
    }
    return;
  }
  while (cx < end) {
    let bw = 2 + (r() < 0.4 ? 1 : 0);
    let bh = h - Math.floor(r() * 3);
    let col = pick(SPINES, r);
    let band = null;
    if (kind === 'large') { bw = 4; bh = h; }
    if (kind === 'lexicon') { bw = 3; bh = h - 1; col = r() < 0.5 ? '#7a2632' : '#22406b'; band = '#d9b24a'; }
    if (kind === 'media') { bw = 2; bh = h - 1; col = pick(['#1f2a44', '#2b2b2b', '#33506e', '#5b2c6f'], r); band = pick(['#e74c3c', '#f1c40f', '#3498db', '#ecf0f1'], r); }
    if (kind === 'bluray') { bw = 2; bh = h - 1; col = '#2f6fd0'; band = '#cfe3ff'; }
    if (kind === 'cds') { bw = 1; bh = 5; col = pick(['#bfc9d1', '#d5dbe0', '#9aa7b0'], r); }
    if (kind === 'games') { bw = 3; bh = 6; col = pick(['#2b6cd4', '#d63031', '#27ae60', '#ffffff', '#111111'], r); band = '#ffffff'; }
    if (kind === 'notes') { bw = 2; bh = h - 1; col = pick(['#f3ecd9', '#e8dcc0', '#fff8e7'], r); band = '#2b2b2b'; }
    if (kind === 'comics') { bw = 2; bh = h - 1 - Math.floor(r() * 2); col = pick(['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#1dd1a1', '#5f27cd'], r); }
    if (cx + bw > end) bw = end - cx;
    if (bw <= 0) break;
    if (r() < 0.06 && kind === 'books') {
      cx += 2;
      continue;
    }
    rect(g, cx, y + h - bh, bw, bh, col);
    px(g, cx, y + h - bh, shade(col, 0.3));
    if (bw > 1) rect(g, cx + bw - 1, y + h - bh, 1, bh, shade(col, -0.28));
    if (band) rect(g, cx, y + h - bh + 2, bw, 1, band);
    else if (r() < 0.5 && bh > 4) rect(g, cx, y + h - bh + 1 + Math.floor(r() * 3), bw, 1, shade(col, 0.4));
    cx += bw;
  }
}

// --- Theken & Möbel -----------------------------------------------
function drawInfoDesk(g, x, y) {
  // Zeichenfläche 48x22, Unterkante = Kachelunterkante
  rect(g, x, y + 4, 48, 18, PAL.k);
  rect(g, x + 1, y + 5, 46, 5, '#e2b57d');
  rect(g, x + 1, y + 5, 46, 1, '#f3cf9d');
  rect(g, x + 1, y + 10, 46, 11, '#9a6438');
  rect(g, x + 1, y + 10, 46, 1, '#6e4426');
  for (let i = 6; i < 46; i += 8) rect(g, x + i, y + 12, 1, 8, '#865530');
  // Info-Schild
  rect(g, x + 19, y + 11, 10, 9, PAL.k);
  rect(g, x + 20, y + 12, 8, 7, '#2f6fd0');
  rect(g, x + 23, y + 13, 2, 1, '#ffffff');
  rect(g, x + 23, y + 15, 2, 3, '#ffffff');
  // Bildschirm & Bücherstapel
  rect(g, x + 32, y, 11, 8, PAL.k);
  rect(g, x + 33, y + 1, 9, 5, '#7fc4e8');
  rect(g, x + 33, y + 1, 9, 1, '#bfe4f5');
  rect(g, x + 36, y + 7, 3, 2, '#4a4a55');
  rect(g, x + 5, y + 3, 9, 2, '#c0392b');
  rect(g, x + 6, y + 1, 8, 2, '#2e86c1');
  rect(g, x + 5, y, 7, 1, '#27ae60');
}

function drawReturnDesk(g, x, y) {
  // Ovale Theke 48x32
  const cx = x + 24;
  const cy = y + 14;
  for (let yy = 0; yy < 30; yy++) {
    for (let xx = 0; xx < 48; xx++) {
      const dx = (xx + 0.5 - 24) / 24;
      const dy = (yy + 0.5 - 13) / 13;
      const d = dx * dx + dy * dy;
      if (d <= 1) {
        const edge = d > 0.82;
        let col = edge ? PAL.k : '#e2b57d';
        if (!edge && yy < 6) col = '#f0c995';
        px(g, x + xx, y + yy, col);
      }
    }
  }
  // Vorderseite (Höhe)
  for (let xx = 2; xx < 46; xx++) {
    const dx = (xx + 0.5 - 24) / 24;
    const yb = Math.floor(13 + 13 * Math.sqrt(Math.max(0, 1 - dx * dx)));
    for (let k = 0; k < 5; k++) px(g, x + xx, y + yb - 1 + k, k === 4 ? PAL.k : k === 0 ? '#b77b46' : '#8d5a31');
  }
  // Bildschirm, Scanner, Bücher
  rect(g, cx - 14, cy - 10, 10, 7, PAL.k);
  rect(g, cx - 13, cy - 9, 8, 4, '#7fc4e8');
  rect(g, cx + 4, cy - 6, 12, 3, '#3b8f5a');
  rect(g, cx + 5, cy - 8, 10, 2, '#e0b13c');
  rect(g, cx + 4, cy - 10, 9, 2, '#b8453a');
  // Schild "Rückgabe" (Pfeil)
  rect(g, cx - 4, cy + 1, 9, 6, PAL.k);
  rect(g, cx - 3, cy + 2, 7, 4, '#ffffff');
  rect(g, cx - 2, cy + 3, 5, 1, '#2f6fd0');
  px(g, cx - 2, cy + 2, '#2f6fd0');
  px(g, cx - 2, cy + 4, '#2f6fd0');
}

function drawCart(g, x, y) {
  rect(g, x + 1, y + 2, 14, 12, PAL.k);
  rect(g, x + 2, y + 3, 12, 4, '#56606b');
  rect(g, x + 2, y + 8, 12, 4, '#56606b');
  const cols = ['#b8453a', '#2f6fb0', '#e0b13c', '#3b8f5a', '#7b52a6', '#cf6a2c'];
  for (let i = 0; i < 6; i++) {
    rect(g, x + 2 + i * 2, y + 3 + (i % 2), 2, 4 - (i % 2), cols[i]);
    rect(g, x + 2 + i * 2, y + 8 + ((i + 1) % 2), 2, 4 - ((i + 1) % 2), cols[(i + 3) % 6]);
  }
  rect(g, x + 2, y + 7, 12, 1, '#a9b3bd');
  rect(g, x + 2, y + 12, 12, 1, '#a9b3bd');
  rect(g, x + 2, y + 14, 2, 2, PAL.k);
  rect(g, x + 12, y + 14, 2, 2, PAL.k);
  rect(g, x, y, 1, 6, '#8c96a0');
  rect(g, x, y, 3, 1, '#8c96a0');
}

function drawTable(g, x, y, open, r) {
  // open: welche Seiten haben keinen Tisch-Nachbarn
  rect(g, x, y + 2, 16, 10, '#d9a86c');
  rect(g, x, y + 2, 16, 1, '#ecc58f');
  if (open.n) rect(g, x, y + 1, 16, 1, PAL.k);
  if (open.w) rect(g, x, y + 1, 1, 14, PAL.k);
  if (open.e) rect(g, x + 15, y + 1, 1, 14, PAL.k);
  rect(g, x + (open.w ? 1 : 0), y + 12, 16 - (open.w ? 1 : 0) - (open.e ? 1 : 0), 3, '#9a6438');
  rect(g, x, y + 15, 16, 1, PAL.k);
  if (open.w) rect(g, x + 1, y + 15, 2, 1, '#6e4426');
  if (open.e) rect(g, x + 13, y + 15, 2, 1, '#6e4426');
  if (r() < 0.55) {
    // aufgeschlagenes Buch
    const bx = x + 3 + Math.floor(r() * 5);
    rect(g, bx, y + 5, 9, 5, PAL.k);
    rect(g, bx + 1, y + 5, 3, 4, '#fbf6ea');
    rect(g, bx + 5, y + 5, 3, 4, '#fbf6ea');
    rect(g, bx + 4, y + 5, 1, 5, '#c9bba0');
    px(g, bx + 2, y + 6, '#9d917d');
    px(g, bx + 6, y + 7, '#9d917d');
  } else if (r() < 0.5) {
    rect(g, x + 5, y + 4, 6, 3, pick(SPINES, r));
    rect(g, x + 6, y + 3, 6, 2, pick(SPINES, r));
  }
}

function drawArmchair(g, x, y, col) {
  const dk = shade(col, -0.3);
  const lt = shade(col, 0.25);
  rect(g, x + 2, y + 1, 12, 14, PAL.k);
  rect(g, x + 3, y + 2, 10, 6, col);
  rect(g, x + 3, y + 2, 10, 1, lt);
  rect(g, x + 1, y + 6, 4, 9, PAL.k);
  rect(g, x + 11, y + 6, 4, 9, PAL.k);
  rect(g, x + 2, y + 7, 2, 7, dk);
  rect(g, x + 12, y + 7, 2, 7, dk);
  rect(g, x + 4, y + 8, 8, 4, lt);
  rect(g, x + 4, y + 12, 8, 2, dk);
}

function drawPlant(g, x, y, seed, flowers = false) {
  const r = makeRng(seed);
  // Topf
  const potY = y + 17;
  if (flowers) {
    rect(g, x + 4, potY, 8, 7, PAL.k);
    rect(g, x + 5, potY, 6, 6, '#e7e3dc');
    rect(g, x + 5, potY, 2, 6, '#ffffff');
    rect(g, x + 10, potY + 1, 1, 5, '#bdb6ab');
  } else {
    rect(g, x + 3, potY, 10, 7, PAL.k);
    rect(g, x + 4, potY + 1, 8, 5, '#c0603a');
    rect(g, x + 4, potY + 1, 8, 1, '#de7f55');
    rect(g, x + 4, potY + 5, 8, 1, '#8d3f22');
  }
  const leaf = ['#2f6342', '#4a9150', '#6cb35a', '#86c35f'];
  const blobs = [];
  for (let i = 0; i < 9; i++) {
    blobs.push([x + 3 + r() * 10, y + 3 + r() * 13, 2 + r() * 2.2, Math.floor(r() * 3)]);
  }
  for (const [bx, by, rad] of blobs) {
    for (let yy = -4; yy <= 4; yy++)
      for (let xx = -4; xx <= 4; xx++)
        if (xx * xx + yy * yy <= (rad + 1) * (rad + 1)) px(g, Math.round(bx + xx), Math.round(by + yy), PAL.k);
  }
  for (const [bx, by, rad, c] of blobs) {
    for (let yy = -4; yy <= 4; yy++)
      for (let xx = -4; xx <= 4; xx++)
        if (xx * xx + yy * yy <= rad * rad) px(g, Math.round(bx + xx), Math.round(by + yy), leaf[c + (yy < 0 ? 1 : 0)]);
  }
  if (flowers) {
    for (let i = 0; i < 5; i++) {
      const fx = Math.round(x + 3 + r() * 10);
      const fy = Math.round(y + 3 + r() * 9);
      rect(g, fx - 1, fy, 3, 1, '#e86f8a');
      rect(g, fx, fy - 1, 1, 3, '#e86f8a');
      px(g, fx, fy, '#ffd35c');
    }
  }
}

function drawGlobe(g, x, y) {
  rect(g, x + 7, y + 13, 2, 4, '#6e4426');
  rect(g, x + 4, y + 17, 8, 2, PAL.k);
  rect(g, x + 5, y + 17, 6, 1, '#9a6438');
  const cx = x + 8;
  const cy = y + 8;
  for (let yy = -6; yy <= 6; yy++) {
    for (let xx = -6; xx <= 6; xx++) {
      const d = xx * xx + yy * yy;
      if (d > 42) continue;
      let col = d > 30 ? PAL.k : '#3a86c8';
      if (d <= 30) {
        const land = Math.sin(xx * 0.9 + 1.3) + Math.cos(yy * 1.1 - 0.4) > 0.9;
        if (land) col = '#5aa452';
        if (xx < -2 && yy < -1 && d < 20) col = shade(col, 0.25);
      }
      px(g, cx + xx, cy + yy, col);
    }
  }
  for (let a = -0.5; a < 2.7; a += 0.08) {
    px(g, Math.round(cx + Math.cos(a) * 7.5), Math.round(cy - Math.sin(a) * 7.5), '#d9b24a');
  }
}

function drawCoatRack(g, x, y, seed) {
  const r = makeRng(seed);
  rect(g, x + 7, y + 1, 2, 20, '#5a3a24');
  rect(g, x + 4, y + 21, 8, 2, PAL.k);
  rect(g, x + 4, y + 2, 8, 1, '#5a3a24');
  const coats = [pick(['#2e4a6b', '#7a2e2e', '#556b2f', '#5b4a7a', '#8a6d3b'], r), pick(['#c0392b', '#34495e', '#d4ac0d', '#1abc9c'], r)];
  rect(g, x + 2, y + 3, 5, 10, PAL.k);
  rect(g, x + 3, y + 4, 3, 8, coats[0]);
  rect(g, x + 9, y + 3, 5, 9, PAL.k);
  rect(g, x + 10, y + 4, 3, 7, coats[1]);
  rect(g, x + 6, y + 0, 4, 2, '#3a2a26');
}

function drawBeanbag(g, x, y, col) {
  const lt = shade(col, 0.3);
  const dk = shade(col, -0.3);
  for (let yy = 0; yy < 12; yy++) {
    for (let xx = 0; xx < 16; xx++) {
      const dx = (xx + 0.5 - 8) / 8;
      const dy = (yy + 0.5 - 7) / 6;
      const d = dx * dx + dy * dy;
      if (d <= 1) px(g, x + xx, y + 4 + yy, d > 0.78 ? PAL.k : yy < 4 ? lt : yy > 9 ? dk : col);
    }
  }
  rect(g, x + 5, y + 8, 5, 2, shade(col, -0.15));
}

function drawPiano(g, x, y) {
  rect(g, x, y, 32, 24, PAL.k);
  rect(g, x + 1, y + 1, 30, 12, '#2a2230');
  rect(g, x + 1, y + 1, 30, 1, '#4b4055');
  rect(g, x + 3, y + 4, 26, 6, '#3a3042');
  rect(g, x + 12, y + 5, 8, 3, '#f3ecd9');
  rect(g, x + 13, y + 6, 6, 1, '#2b2b2b');
  rect(g, x + 1, y + 13, 30, 5, '#f7f3ea');
  for (let i = 2; i < 31; i += 3) rect(g, x + i, y + 13, 1, 5, '#b9b2a6');
  for (const i of [3, 6, 12, 15, 18, 24, 27]) rect(g, x + i, y + 13, 2, 3, '#1a141c');
  rect(g, x + 1, y + 18, 30, 5, '#2a2230');
  rect(g, x + 3, y + 23, 3, 1, PAL.k);
  rect(g, x + 26, y + 23, 3, 1, PAL.k);
}

function drawComputerDesk(g, x, y) {
  rect(g, x, y + 6, 32, 10, PAL.k);
  rect(g, x + 1, y + 7, 30, 4, '#e8e2d6');
  rect(g, x + 1, y + 11, 30, 4, '#a39a8c');
  for (const ox of [3, 19]) {
    rect(g, x + ox, y - 2, 10, 8, PAL.k);
    rect(g, x + ox + 1, y - 1, 8, 5, '#2f6fd0');
    rect(g, x + ox + 2, y, 3, 1, '#9fd3ff');
    rect(g, x + ox + 2, y + 2, 5, 1, '#9fd3ff');
    rect(g, x + ox + 4, y + 6, 2, 1, '#4a4a55');
    rect(g, x + ox + 1, y + 8, 8, 2, '#3a3a44');
  }
}

function drawLamp(g, x, y) {
  rect(g, x + 7, y + 6, 2, 17, '#3d3530');
  rect(g, x + 4, y + 23, 8, 1, PAL.k);
  rect(g, x + 3, y, 10, 7, PAL.k);
  rect(g, x + 4, y + 1, 8, 5, '#f4d58d');
  rect(g, x + 4, y + 5, 8, 1, '#d9a441');
}

function drawPillar(g, x, y) {
  rect(g, x + 1, y - 10, 14, 26, PAL.k);
  rect(g, x + 2, y - 9, 12, 24, '#d8d2c6');
  rect(g, x + 2, y - 9, 3, 24, '#ece7dc');
  rect(g, x + 11, y - 9, 3, 24, '#b9b2a5');
  rect(g, x + 2, y - 9, 12, 2, '#f4f0e8');
}

function drawSignPost(g, x, y, color, label) {
  rect(g, x + 7, y + 8, 2, 14, '#5a3a24');
  rect(g, x + 2, y + 21, 12, 2, PAL.k);
  rect(g, x + 1, y, 14, 10, PAL.k);
  rect(g, x + 2, y + 1, 12, 8, color);
  rect(g, x + 2, y + 1, 12, 1, shade(color, 0.35));
  Font.draw(g, label, x + 8 - Math.floor(Font.measure(label) / 2), y + 0, '#1a1220');
}

function drawMapBoard(g, x, y) {
  rect(g, x + 2, y + 13, 2, 10, '#5a3a24');
  rect(g, x + 12, y + 13, 2, 10, '#5a3a24');
  rect(g, x, y, 16, 15, PAL.k);
  rect(g, x + 1, y + 1, 14, 13, '#f4efe2');
  const cols = ['#f2d64b', '#d9443f', '#9a9a9a', '#f08c2e', '#3a7fd0', '#4caf50'];
  for (let i = 0; i < 3; i++) {
    rect(g, x + 2 + i * 4, y + 3, 4, 3, cols[i]);
    rect(g, x + 2 + i * 4, y + 9, 4, 3, cols[i + 3]);
  }
  rect(g, x + 2, y + 7, 12, 1, '#c9bfa8');
}

function drawLiftDoor(g, x, y) {
  // auf einer Wandfläche, 32 breit
  rect(g, x, y, 32, 16, '#cfc8bb');
  rect(g, x + 3, y + 2, 26, 14, '#5b6169');
  rect(g, x + 4, y + 3, 11, 13, '#aeb6bf');
  rect(g, x + 17, y + 3, 11, 13, '#aeb6bf');
  rect(g, x + 4, y + 3, 11, 1, '#d6dde3');
  rect(g, x + 17, y + 3, 11, 1, '#d6dde3');
  rect(g, x + 15, y + 3, 2, 13, '#3d434a');
  rect(g, x + 29, y + 7, 2, 4, PAL.k);
  px(g, x + 29, y + 8, '#f5cf4f');
  px(g, x + 30, y + 9, '#f5cf4f');
}

function drawWcDoor(g, x, y) {
  rect(g, x, y, 16, 16, '#efe3c8');
  rect(g, x + 2, y + 2, 12, 14, PAL.k);
  rect(g, x + 3, y + 3, 10, 13, '#3f7f9c');
  rect(g, x + 3, y + 3, 10, 1, '#62a2bf');
  px(g, x + 11, y + 10, '#f5cf4f');
  rect(g, x + 4, y + 5, 8, 5, '#ffffff');
  Font.draw(g, 'WC', x + 4, y + 4, '#1d3a5a');
}

function drawStairs(g, x, y, ti, downward) {
  for (let i = 0; i < 4; i++) {
    const yy = y + i * 4;
    rect(g, x, yy, 16, 4, i % 2 ? '#b5aa98' : '#cbc1ae');
    rect(g, x, yy + 3, 16, 1, '#8f8576');
  }
  if (ti === 0) rect(g, x, y, 2, 16, '#6b5b4b');
  if (ti === 1) rect(g, x + 14, y, 2, 16, '#6b5b4b');
  if (downward) {
    rect(g, x, y, 16, 16, 'rgba(40,30,30,0.18)');
  }
}

function drawEntrance(g, x, y, i) {
  for (let s = 0; s < 4; s++) {
    rect(g, x + s * 4, y, 4, 16, s % 2 ? '#c4baa6' : '#d6cdb9');
    rect(g, x + s * 4, y, 1, 16, '#9c917e');
  }
  rect(g, x, y, 16, 16, `rgba(20,14,20,${0.08 + (3 - i) * 0.08})`);
}

function drawLectern(g, x, y) {
  rect(g, x + 4, y + 4, 8, 12, PAL.k);
  rect(g, x + 5, y + 5, 6, 10, '#7a4a2a');
  rect(g, x + 3, y + 2, 10, 4, PAL.k);
  rect(g, x + 4, y + 2, 8, 3, '#a8703f');
  rect(g, x + 5, y + 2, 6, 2, '#fbf6ea');
}

// ===================================================================
// Spieldaten: Colleges & Systematik (nach dem Lageplan der Hauptbücherei),
// Bücher, Aufträge, Quiz, Figuren und Dialoge.
// Die Bücherlisten sind Beispieldaten und können durch echte
// Bestandsdaten ersetzt werden.
// ===================================================================
const COLLEGES = deepFreeze({
  c1: { num: 1, name: 'Literatur & Sprache', floor: '2', color: '#f2d64b', colorName: 'gelb', zone: 'y', carpet: ['#e3c25a', '#d1ad46'] },
  c2: { num: 2, name: 'Lokal-Regional-Global', floor: '2', color: '#d9443f', colorName: 'rot', zone: 'r', carpet: ['#b9474c', '#a63e44'] },
  c3: { num: 3, name: 'Standorte', floor: '2', color: '#9a9a9a', colorName: 'grau', zone: 'g', carpet: ['#a09fa8', '#908f99'] },
  c4: { num: 4, name: 'Kirango, der Kinderplanet', floor: '3', color: '#f08c2e', colorName: 'orange', zone: 'o', carpet: ['#e08d47', '#cc7d3b'] },
  c5: { num: 5, name: 'Kunstraum', floor: '3', color: '#3a7fd0', colorName: 'blau', zone: 'b', carpet: ['#5585c8', '#4874b4'] },
  c6: { num: 6, name: 'Know How', floor: '3', color: '#4caf50', colorName: 'grün', zone: 'n', carpet: ['#63a05e', '#568f51'] },
});
const COLLEGE_IDS = Object.freeze(['c1', 'c2', 'c3', 'c4', 'c5', 'c6']);

// Systematik: Themen = Regale (aus dem Lageplan übernommen)
const TOPICS = deepFreeze({
  c1_lit: { college: 'c1', name: 'Literatur' },
  c1_litwiss: { college: 'c1', name: 'Literaturwissenschaft' },
  c1_antho: { college: 'c1', name: 'Anthologien Prosa/Lyrik' },
  c1_tage: { college: 'c1', name: 'Tagebücher & Briefe' },
  c1_szene: { college: 'c1', name: 'Szene Österreich' },
  c1_teens: { college: 'c1', name: '4teens – Romane für junge LeserInnen' },
  c1_hoer: { college: 'c1', name: 'Hörbuch & Film' },
  c1_fremd: { college: 'c1', name: 'Fremdsprachenbibliothek' },
  c1_sprache: { college: 'c1', name: 'Sprache' },
  c1_nach: { college: 'c1', name: 'Nachschlagebibliothek' },
  c1_gross: { college: 'c1', name: 'Großdruck' },
  c2_reisen: { college: 'c2', name: 'Länder & Reisen' },
  c2_wien: { college: 'c2', name: 'Wien & Österreich' },
  c2_gesch: { college: 'c2', name: 'Geschichte' },
  c2_kultur: { college: 'c2', name: 'Kultur- und Sozialanthropologie' },
  c2_frei: { college: 'c2', name: 'Freizeit' },
  c2_sport: { college: 'c2', name: 'Sport' },
  c2_lexika: { college: 'c2', name: 'Lexika' },
  c3_gpm: { college: 'c3', name: 'Gesellschaft & Politik & Medien' },
  c3_recht: { college: 'c3', name: 'Recht' },
  c3_philo: { college: 'c3', name: 'Philosophie' },
  c3_psych: { college: 'c3', name: 'Psychologie' },
  c3_med: { college: 'c3', name: 'Medizin & Gesundheit' },
  c3_paed: { college: 'c3', name: 'Pädagogik' },
  c3_rel: { college: 'c3', name: 'Religionen & Esoterik' },
  c3_bfm: { college: 'c3', name: 'Bibliothek für Frauen und Männer' },
  c4_bilder: { college: 'c4', name: 'Bilderbücher' },
  c4_kinder: { college: 'c4', name: 'Kinderbücher' },
  c4_erst: { college: 'c4', name: 'Für LeseanfängerInnen' },
  c4_fremd: { college: 'c4', name: 'Fremdsprachige Kinder- & Bilderbücher' },
  c4_comics: { college: 'c4', name: 'Comics & Mangas' },
  c4_dvd: { college: 'c4', name: 'DVDs (Kinder)' },
  c4_hoer: { college: 'c4', name: 'Hörbücher (Kinder)' },
  c4_games: { college: 'c4', name: 'Konsolenspiele' },
  c4_arto: { college: 'c4', name: 'Artothek' },
  c5_musik: { college: 'c5', name: 'Musik' },
  c5_noten: { college: 'c5', name: 'Noten' },
  c5_kunst: { college: 'c5', name: 'Kunst' },
  c5_ttf: { college: 'c5', name: 'Theater & Tanz & Film' },
  c5_cd: { college: 'c5', name: 'CDs' },
  c5_dvd: { college: 'c5', name: 'DVDs' },
  c5_bluray: { college: 'c5', name: 'Blu-rays' },
  c6_nawi: { college: 'c6', name: 'Naturwissenschaften & Mathematik' },
  c6_technik: { college: 'c6', name: 'Technik' },
  c6_it: { college: 'c6', name: 'Informatik & Computer' },
  c6_beruf: { college: 'c6', name: 'Beruf & Karriere' },
  c6_wirt: { college: 'c6', name: 'Wirtschaft' },
});

// Karten: 2. OG und 3. OG (nach dem Lageplan, Spitze links)
//  #=Wand  ==Fenster  ~=Vorhang  X=WC  LL=Lift  TT=Treppe  E=Abgang
//  f=Foyer  c=Gang  h=Saal  y/r/g/o/b/n=College-Böden  V=Bühne
//  S=Regal(2x2)  I=Info(3x1)  R=Rückgabe(3x2)  C=Rückgabewagen  Q=Tisch
//  x=Sessel  A=Lesesessel  P=Pflanze  F=Blumen  K=Garderobe  G=Globus
//  M=Klavier  Z=Computer  B=Sitzsack  k=Säule  N=Wegweiser  O=Lageplan
//  *=Lampe  J=Lesepult
const MAPS = deepFreeze({
  '2': [
    '        ########################################################',
    '       ###X#LL======#======#======#=======LL#=====#===X==#=====#',
    '      #fffffffySSSSSSSSPyy*SSSSSSyyyyyyyFycccgSSSSSSSSgTTgSSSSg#',
    '     #PfffffffySSSSSSSSyAAySSSSSSyyyyyyyyycccgSSSSSSSSgTTgSSSSg#',
    '    #ffffffffFNyyyyyyyyyyyyyyyyyyyyyyyyyyycccgggggggggggggggggP#',
    '   #fOffffffffySSSSSSSSyyyxyxyyyyyyyyyyyyycccgggggggggggggggggg#',
    '  #fffffffffffySSSSSSSSyyyQQQyyyyyyyIIIyyycccgggggggggggggggggg#',
    ' #EEffffffffffyyyyyyyyyyyyyyyyyyyyyyyyyyyycccggSSSSgggggggggggg#',
    '#EEEffffRRRfffyyyyyyyyyyyyyyyyyyyyyyyyyyyycccggSSSSgggggggggggg#',
    '#EEEffffRRRfffrrrrrrrrrrrrrrrrrrrrrrrrTTrrcccgggggggggggggggggg#',
    ' #EEfffffffCffrrrrrrrrrrrrrrrrrrrrrrrrTTrrcccNggggggggggggggggg#',
    '  #fffffffffffrSSSSSSSSrrrSSSSrrrSSrrrrrrrcccgggggggggggggggggg#',
    '   #ffffffffffNSSSSSSSSrrrSSSSrrrSSrrrrrrrcccgggggxgxggggIIIggg#',
    '    #fffffff*frrrrrrrrrrrrrrrrrrrrrrrrrrrrcccgggggQQQgggggggggg#',
    '     #ffffffffrrrrrrrrrrrrrxrrrrrrrrGrrrrrcccgggggggggggggggggg#',
    '      #fffffffrrA*ArrrrrkrrQQrrkrrrrrrrrrrcccgAAggggggggggggggg#',
    '       #KfKfKfrrrrrrrrrrrrrrrrrrrrrrrrrrPrccPgggggggggggggggggF#',
    '        ########################################################',
  ],
  '3': [
    '        ########################################################',
    '       #~~~#LL#X####======#=========#=====LL========#==========#',
    '      #hhhh#ffffffff##SSSSSSSS##bSSSSSSbSSbbbbnSSSSSSnnTTnSSSSn#',
    '     #hhhFh#ffCfffff##SSSSSSSS##bSSSSSSbSSbbbbnSSSSSSnnTTnSSSSn#',
    '    #hhhhhh#ffffffFfoooooooooooobbbbbbbbbbbbbbnnnnnnnnnnnnnnnnn#',
    '   #hhhhhhh#ffffffffoooooooooooobbbbbbbbbbbbbbnnnnnnnnnnnnnnnnn#',
    '  #VVhxhxhh#ffffffffoSSSSSSooooobSSSSbbbbbbbbbNnnnnnnnnnnnnnnnn#',
    ' #VVVhhhhhh#ffffffffoSSSSSSooooobSSSSbbbbbIIIbnnnnnnnnnnnnnnnnn#',
    '#VVVJhxhxhhhfffffOffoooooooooooobbbbbbbbbbbbbbnZZnnZZnnnnnnnnnP#',
    '#VVVVhhhhhhhffffffffNoooooooBooobbbbbbTTbbbbbbnnnnnnnnnnnnnnnnn#',
    ' #VVVhxhxhh#ffffffffooooooBoooooNbbbbbTTbbbbbbnnnnnnnnnnnnnnnnn#',
    '  #VVhhhhhh#ffffffffoooooooooBoobbbbbbbbbbbbbbnnnnnnnnnnxxnnnnn#',
    '   #hhxhxhh#ffffffffooSSSSoooooobbbbbbbbbbbbbbnnnnnnnnnnQQnnnnn#',
    '    #hhhhhh#ffffffffooSSSSoooooobSSbbbbbbbbbbbnnnnnnnnnnnnnnnnn#',
    '     #hhhhh#ffffffffoooooooooooobSSbbbbbMMbbbbnnIIInnnnnnnnnnnn#',
    '      #hhPh#fAAfffff##oooooIII##bbbbAbbbbbbbbbnnnnnnnnnnnnnnAAn#',
    '       #hhh#fffffffP##oooooooo##bbbbbbbbbbbbPbnnnnnnnFnnnnnnnnn#',
    '        ########################################################',
  ],
});

// Welches Regal (obere linke Kachel) welches Thema trägt
const SHELF_TOPICS = deepFreeze({
  '2': [
    [15, 2, 'c1_lit'], [17, 2, 'c1_litwiss'], [19, 2, 'c1_antho'], [21, 2, 'c1_tage'],
    [27, 2, 'c1_szene'], [29, 2, 'c1_teens'], [31, 2, 'c1_hoer'],
    [15, 5, 'c1_fremd'], [17, 5, 'c1_sprache'], [19, 5, 'c1_nach'], [21, 5, 'c1_gross'],
    [15, 11, 'c2_reisen'], [17, 11, 'c2_wien'], [19, 11, 'c2_gesch'], [21, 11, 'c2_kultur'],
    [26, 11, 'c2_frei'], [28, 11, 'c2_sport'], [33, 11, 'c2_lexika'],
    [46, 2, 'c3_gpm'], [48, 2, 'c3_recht'], [50, 2, 'c3_philo'], [52, 2, 'c3_psych'],
    [58, 2, 'c3_med'], [60, 2, 'c3_paed'], [47, 7, 'c3_rel'], [49, 7, 'c3_bfm'],
  ],
  '3': [
    [22, 2, 'c4_bilder'], [24, 2, 'c4_kinder'], [26, 2, 'c4_erst'], [28, 2, 'c4_fremd'],
    [21, 6, 'c4_comics'], [23, 6, 'c4_dvd'], [25, 6, 'c4_hoer'], [22, 12, 'c4_games'], [24, 12, 'c4_arto'],
    [33, 2, 'c5_musik'], [35, 2, 'c5_noten'], [37, 2, 'c5_kunst'], [40, 2, 'c5_ttf'],
    [33, 6, 'c5_cd'], [35, 6, 'c5_dvd'], [33, 13, 'c5_bluray'],
    [47, 2, 'c6_nawi'], [49, 2, 'c6_technik'], [51, 2, 'c6_it'], [58, 2, 'c6_beruf'], [60, 2, 'c6_wirt'],
  ],
});

const ZONE_LABEL = deepFreeze({
  '2': { f: 'Foyer · Ausleihe & Rückgabe', c: 'Gang · Lift', y: 'c1', r: 'c2', g: 'c3' },
  '3': { f: 'Foyer 3. OG', h: 'Veranstaltungssaal', o: 'c4', b: 'c5', n: 'c6' },
});

// Lift & Treppen verbinden 2. und 3. OG an gleicher Stelle
const FLOOR_NAMES = deepFreeze({ '2': '2. OG', '3': '3. OG' });

// Bücher auf dem Rückgabewagen (Beispieldaten)
const RETURN_BOOKS = deepFreeze([
  { id: 'r01', title: 'Reiseführer Italien', topic: 'c2_reisen' },
  { id: 'r02', title: 'Italienisch in 30 Tagen', topic: 'c1_sprache' },
  { id: 'r03', title: 'Gedichte für jeden Tag', topic: 'c1_antho' },
  { id: 'r04', title: 'Krimi in großer Schrift', topic: 'c1_gross' },
  { id: 'r05', title: 'Pride and Prejudice (englisch)', topic: 'c1_fremd' },
  { id: 'r06', title: 'Roman: Die Nacht der Bücher', topic: 'c1_lit' },
  { id: 'r07', title: '4teens: Sommer der Entscheidungen', topic: 'c1_teens' },
  { id: 'r08', title: 'Basteln mit Papier', topic: 'c2_frei' },
  { id: 'r09', title: 'Laufen für Anfänger', topic: 'c2_sport' },
  { id: 'r10', title: 'Das alte Ägypten', topic: 'c2_gesch' },
  { id: 'r11', title: 'Wiener Bezirke entdecken', topic: 'c2_wien' },
  { id: 'r12', title: 'Lexikon der Tiere', topic: 'c2_lexika' },
  { id: 'r13', title: 'Mein Recht als Mieter', topic: 'c3_recht' },
  { id: 'r14', title: 'Gesund schlafen', topic: 'c3_med' },
  { id: 'r15', title: 'Einführung in die Psychologie', topic: 'c3_psych' },
  { id: 'r16', title: 'Philosophie für Einsteiger', topic: 'c3_philo' },
  { id: 'r17', title: 'Weltreligionen im Überblick', topic: 'c3_rel' },
  { id: 'r18', title: 'Der kleine Drache Fridolin', topic: 'c4_bilder' },
  { id: 'r19', title: 'Erstes Lesen: Der Mond hat Durst', topic: 'c4_erst' },
  { id: 'r20', title: 'Konsolenspiel: Turbo-Kart', topic: 'c4_games' },
  { id: 'r21', title: 'CD: Wiener Walzer', topic: 'c5_cd' },
  { id: 'r22', title: 'Klavierschule Band 1', topic: 'c5_noten' },
  { id: 'r23', title: 'Malen mit Aquarell', topic: 'c5_kunst' },
  { id: 'r24', title: 'Ballett verstehen', topic: 'c5_ttf' },
  { id: 'r25', title: 'Mathe-Rätsel für Schlaue', topic: 'c6_nawi' },
  { id: 'r26', title: 'Robotik für Einsteiger', topic: 'c6_technik' },
  { id: 'r27', title: 'Websites bauen mit HTML', topic: 'c6_it' },
  { id: 'r28', title: 'Bewerben mit Erfolg', topic: 'c6_beruf' },
  { id: 'r29', title: 'Geld verstehen', topic: 'c6_wirt' },
]);

// Suchaufträge: Bücher nach Titel, Autor:in oder Thema finden
const SEARCHES = deepFreeze([
  { id: 's01', short: '„Die Verwandlung“ von Kafka', ask: 'Ein Leser sucht „Die Verwandlung“ von Franz Kafka.', hint: 'Romane und Erzählungen findest du bei „Literatur“ im College 1.', topic: 'c1_lit', found: 'Gefunden: „Die Verwandlung“ von Franz Kafka!' },
  { id: 's02', short: 'ein Buch von Christine Nöstlinger', ask: 'Gesucht: ein Buch von Christine Nöstlinger, zum Beispiel „Wir pfeifen auf den Gurkenkönig“.', hint: 'Christine Nöstlinger hat viele Kinderbücher geschrieben – schau im Kirango im 3. OG!', topic: 'c4_kinder', found: 'Gefunden: „Wir pfeifen auf den Gurkenkönig“!' },
  { id: 's03', short: 'ein Reiseführer für Japan', ask: 'Jemand plant eine Reise und braucht einen Reiseführer für Japan.', hint: 'Reiseführer stehen bei „Länder & Reisen“.', topic: 'c2_reisen', found: 'Gefunden: ein Reiseführer für Japan!' },
  { id: 's04', short: 'ein Buch über JavaScript', ask: 'Eine Schülerin möchte programmieren lernen. Finde ein Buch über JavaScript!', hint: 'Computer-Themen gibt es im Know How (3. OG, grün).', topic: 'c6_it', found: 'Gefunden: „JavaScript für Einsteiger“!' },
  { id: 's05', short: 'Noten zur „Zauberflöte“', ask: 'Gesucht: Noten zur „Zauberflöte“ von Wolfgang Amadeus Mozart.', hint: 'Noten findest du im Kunstraum.', topic: 'c5_noten', found: 'Gefunden: die Noten zur „Zauberflöte“!' },
  { id: 's06', short: '„Das Tagebuch der Anne Frank“', ask: 'Finde „Das Tagebuch der Anne Frank“.', hint: 'Tagebücher & Briefe stehen im College 1.', topic: 'c1_tage', found: 'Gefunden: „Das Tagebuch der Anne Frank“!' },
  { id: 's07', short: 'Kants „Kritik der reinen Vernunft“', ask: 'Ein Student sucht „Kritik der reinen Vernunft“ von Immanuel Kant.', hint: 'Das ist Philosophie – College 3 (grau).', topic: 'c3_philo', found: 'Gefunden: Kants „Kritik der reinen Vernunft“!' },
  { id: 's08', short: 'ein Manga', ask: 'Ein Kind möchte einen Manga ausleihen.', hint: 'Comics & Mangas gibt es im Kirango.', topic: 'c4_comics', found: 'Gefunden: ein spannender Manga!' },
  { id: 's09', short: 'ein Stadtführer für Wien', ask: 'Eine Touristin sucht einen Stadtführer für Wien.', hint: '„Wien & Österreich“ steht im College 2 (rot).', topic: 'c2_wien', found: 'Gefunden: ein Stadtführer für Wien!' },
  { id: 's10', short: 'ein Ratgeber zur Bewerbung', ask: 'Jemand braucht Tipps für die erste Bewerbung.', hint: '„Beruf & Karriere“ findest du im Know How.', topic: 'c6_beruf', found: 'Gefunden: ein Ratgeber zum Bewerben!' },
]);

// Quizfragen zur Bücherei & Systematik
const QUIZ = deepFreeze([
  { id: 'q01', q: 'In welchem College findest du Comics & Mangas?', a: ['College 4 – Kirango', 'College 1 – Literatur & Sprache', 'College 6 – Know How'], ok: 0, ex: 'Comics & Mangas stehen im Kirango, dem Kinderplaneten (3. OG, orange).' },
  { id: 'q02', q: 'Wo stehen Reiseführer?', a: ['College 3 – Standorte', 'College 2 – Lokal-Regional-Global', 'College 5 – Kunstraum'], ok: 1, ex: 'Reiseführer findest du im College 2 bei „Länder & Reisen“.' },
  { id: 'q03', q: 'Du suchst Noten fürs Klavier. Wohin gehst du?', a: ['College 6 – Know How', 'College 1 – Literatur & Sprache', 'College 5 – Kunstraum'], ok: 2, ex: 'Noten, Musik, CDs und Filme gibt es im Kunstraum (3. OG, blau).' },
  { id: 'q04', q: 'Was verrät dir die Signatur auf dem Buchrücken?', a: ['Wo das Buch im Regal steht', 'Wie viele Seiten es hat', 'Wer es zuletzt gelesen hat'], ok: 0, ex: 'Die Signatur ist wie eine Adresse: Sie zeigt, in welchem Bereich und an welcher Stelle ein Medium steht.' },
  { id: 'q05', q: 'Dein Handy klingelt in der Bücherei. Was ist am besten?', a: ['Laut abheben', 'Leise stellen und draußen telefonieren', 'Einfach klingeln lassen'], ok: 1, ex: 'Viele wollen hier in Ruhe lesen und lernen – Telefonate also lieber draußen führen.' },
  { id: 'q06', q: 'Wo findest du Bücher über Informatik & Computer?', a: ['College 2 – Lokal-Regional-Global', 'College 5 – Kunstraum', 'College 6 – Know How'], ok: 2, ex: 'Informatik & Computer gehören zum Know How (3. OG, grün) – wie Technik und Naturwissenschaften.' },
  { id: 'q07', q: 'In welchem Stockwerk liegt der Kunstraum?', a: ['3. OG', '2. OG', 'Erdgeschoss'], ok: 0, ex: 'Der Kunstraum (College 5) liegt im 3. OG – zwischen Kirango und Know How.' },
  { id: 'q08', q: 'Welche Farbe hat College 3 auf dem Lageplan?', a: ['Grün', 'Grau', 'Blau'], ok: 1, ex: 'College 3 ist grau. Gelb ist College 1, Rot ist College 2.' },
  { id: 'q09', q: 'Du hast ein ausgeliehenes Buch fertig gelesen. Was machst du damit?', a: ['Behalten', 'Irgendwo ins Regal stecken', 'An der Rückgabe zurückgeben'], ok: 2, ex: 'Ausgeliehene Medien gibst du an der Rückgabe zurück – erst dann sind sie wieder für alle verfügbar.' },
  { id: 'q10', q: 'Wo findest du Hörbücher für Erwachsene?', a: ['College 1 – Literatur & Sprache', 'College 6 – Know How', 'College 3 – Standorte'], ok: 0, ex: '„Hörbuch & Film“ gehört zum College 1. Hörbücher für Kinder gibt es im Kirango.' },
  { id: 'q11', q: 'Was kann man in einer Artothek ausleihen?', a: ['Autoteile', 'Bilder und Kunstwerke', 'Antike Möbel'], ok: 1, ex: 'In einer Artothek leiht man Bilder und Kunstwerke aus – wie Bücher, nur für die Wand!' },
  { id: 'q12', q: 'Welche Themen gehören zum College 3?', a: ['Comics, Bilderbücher, DVDs', 'Musik, Noten, Kunst', 'Philosophie, Psychologie, Recht'], ok: 2, ex: 'Im College 3 stehen u. a. Philosophie, Psychologie, Recht, Pädagogik und Religionen.' },
]);

// Buchwelten (werden mit Punkten freigeschaltet)
const WORLDS = deepFreeze({
  moby: { title: 'Moby Dick', author: 'Herman Melville', year: 1851, topic: 'c1_lit', floor: '2', need: 30 },
  alice: { title: 'Alice im Wunderland', author: 'Lewis Carroll', year: 1865, topic: 'c4_kinder', floor: '3', need: 80 },
});
const WORLD_IDS = Object.freeze(['moby', 'alice']);

const BADGES = deepFreeze([
  { id: 'erstes', name: 'Erstes Buch', desc: 'Das erste Buch richtig zurückgestellt.' },
  { id: 'sortier', name: 'Sortier-Profi', desc: '8 Bücher richtig einsortiert.' },
  { id: 'spuer', name: 'Spürnase', desc: '3 Suchaufträge erledigt.' },
  { id: 'quiz', name: 'Quiz-Ass', desc: '5 Quizfragen richtig beantwortet.' },
  { id: 'ruhe', name: 'Ruhepol', desc: 'Alle 3 Bücherei-Situationen gut gelöst.' },
  { id: 'entdeck', name: 'Entdeckungsreise', desc: 'Alle 6 Colleges besucht.' },
  { id: 'moby', name: 'Ausguck', desc: 'In „Moby Dick“ den weißen Wal gesichtet.' },
  { id: 'alice', name: 'Kaninchenbau', desc: 'In „Alice im Wunderland“ in den Kaninchenbau gefolgt.' },
]);
const BADGE_IDS = Object.freeze(BADGES.map((b) => b.id));

// --- Figuren ------------------------------------------------------
const mkLook = (style, hair, skin, shirt, pants, extra) => ({ style, hair, skin, shirt, pants, shoes: '#3a2a26', extra });

const PLAYER_LOOK = deepFreeze(mkLook('short', 'brown', 'light', '#2a9d8f', '#34495e'));

const NPCS = deepFreeze([
  // --- 2. OG
  { id: 'novak', name: 'Frau Novak', floor: '2', x: 9, y: 7, dir: 'down', role: 'return', look: mkLook('long', 'auburn', 'light', '#6d597a', '#2b2d42', 'glasses') },
  { id: 'yilmaz', name: 'Herr Yilmaz', floor: '2', x: 37, y: 5, dir: 'down', role: 'info', college: 'c1', look: mkLook('short', 'black', 'tan', '#3a7fd0', '#2b2d42'), greet: 'Grüß dich! Ich bin Herr Yilmaz von der Info im College 1. Wie kann ich helfen?' },
  { id: 'bauer', name: 'Frau Bauer', floor: '2', x: 58, y: 11, dir: 'down', role: 'info', college: 'c3', look: mkLook('long', 'grey', 'light', '#9c6644', '#3d405b', 'bun+glasses'), greet: 'Guten Tag! Frau Bauer, Info im College 3. Was darf es sein?' },
  { id: 'lena', name: 'Lena', floor: '2', x: 33, y: 5, dir: 'down', role: 'event', event: 'phone', look: mkLook('long', 'blue', 'medium', '#e76f51', '#264653', 'headphones') },
  { id: 'gruber', name: 'Herr Gruber', floor: '2', x: 27, y: 14, dir: 'down', role: 'event', event: 'food', sit: true, look: mkLook('short', 'white', 'light', '#8a9a5b', '#4a3f35', 'glasses') },
  { id: 'leser1', name: 'Leserin', floor: '2', x: 26, y: 5, dir: 'down', sit: true, look: mkLook('long', 'black', 'brown', '#f4a261', '#3d405b'), lines: ['Pssst … ich bin gerade beim spannendsten Kapitel!'] },
  { id: 'reise', name: 'Reisender', floor: '2', x: 35, y: 15, dir: 'left', wander: true, look: mkLook('short', 'red', 'light', '#2a6f97', '#5c4033'), lines: ['Ich plane eine Reise! Reiseführer stehen hier im College 2 bei „Länder & Reisen“.', 'Lokal, regional, global – von Wien bis ans andere Ende der Welt ist alles da.'] },
  { id: 'foyer1', name: 'Besucherin', floor: '2', x: 6, y: 13, dir: 'down', wander: true, look: mkLook('long', 'brown', 'dark', '#e9c46a', '#264653'), lines: ['Kennst du den Lageplan? Mit [K] siehst du, wo welches Thema steht.', 'Meine Jacke ist an der Garderobe – gleich da unten.'] },
  { id: 'leser3', name: 'Leser', floor: '2', x: 50, y: 12, dir: 'down', sit: true, look: mkLook('short', 'grey', 'tan', '#5e548e', '#2b2d42', 'glasses'), lines: ['Philosophie, Psychologie, Recht … im College 3 könnte ich stundenlang stöbern.'] },
  { id: 'gang2', name: 'Student', floor: '2', x: 52, y: 10, dir: 'down', wander: true, look: mkLook('short', 'blonde', 'light', '#b56576', '#22223b'), lines: ['Hast du gewusst, dass es im College 3 eine „Bibliothek für Frauen und Männer“ gibt?'] },
  // --- 3. OG
  { id: 'autorin', name: 'Autorin', floor: '3', x: 3, y: 9, dir: 'right', look: mkLook('long', 'black', 'medium', '#c1121f', '#1d3557'), lines: ['Heute lese ich aus meinem neuen Buch vor. Setz dich gern dazu – aber bitte leise!'] },
  { id: 'zuh1', name: 'Zuhörer', floor: '3', x: 6, y: 8, dir: 'left', sit: true, look: mkLook('short', 'brown', 'brown', '#2a9d8f', '#3d405b'), lines: ['Pssst – gerade wird vorgelesen!'] },
  { id: 'zuh2', name: 'Zuhörerin', floor: '3', x: 8, y: 10, dir: 'left', sit: true, look: mkLook('long', 'blonde', 'light', '#e5989b', '#3d405b'), lines: ['Lesungen im Veranstaltungssaal sind so schön gemütlich.'] },
  { id: 'kim', name: 'Kim', floor: '3', x: 28, y: 14, dir: 'down', role: 'info', college: 'c4', look: mkLook('short', 'pink', 'light', '#f08c2e', '#2b2d42'), greet: 'Hallo! Willkommen auf Kirango, dem Kinderplaneten! Ich bin Kim.' },
  { id: 'kind', name: 'Jonas', floor: '3', x: 24, y: 9, dir: 'down', wander: true, look: mkLook('short', 'blonde', 'medium', '#e63946', '#1d3557'), lines: ['Im Kirango gibt es Comics & Mangas – und sogar Konsolenspiele!', 'Ich mag Bilderbücher mit Drachen. Die stehen ganz oben links!'] },
  { id: 'rossi', name: 'Herr Rossi', floor: '3', x: 43, y: 6, dir: 'down', role: 'info', college: 'c5', look: mkLook('short', 'black', 'light', '#264653', '#22223b', 'beard'), greet: 'Ciao! Herr Rossi vom Kunstraum. Musik, Filme, Noten und Kunst – alles hier.' },
  { id: 'musik', name: 'Pianistin', floor: '3', x: 42, y: 15, dir: 'left', look: mkLook('long', 'red', 'tan', '#6a4c93', '#22223b'), lines: ['Ich suche Noten für mein Klavierstück. Im Kunstraum gibt es ein eigenes Regal für Noten!'] },
  { id: 'hoerer', name: 'Musikfan', floor: '3', x: 38, y: 12, dir: 'down', wander: true, look: mkLook('short', 'black', 'dark', '#ffb703', '#023047', 'headphones'), lines: ['♪ … Oh, hallo! Ich höre gerade in eine CD rein.'] },
  { id: 'wagner', name: 'Frau Wagner', floor: '3', x: 49, y: 13, dir: 'down', role: 'info', college: 'c6', look: mkLook('long', 'brown', 'medium', '#4caf50', '#2b2d42', 'glasses'), greet: 'Servus! Frau Wagner vom Know How. Was möchtest du wissen?' },
  { id: 'pc1', name: 'Schüler', floor: '3', x: 47, y: 9, dir: 'up', look: mkLook('short', 'brown', 'tan', '#457b9d', '#1d3557'), lines: ['Ich lerne für die Matura. Mathe und Naturwissenschaften findet man hier im Know How.'] },
  { id: 'pc2', name: 'Schülerin', floor: '3', x: 52, y: 9, dir: 'up', look: mkLook('long', 'black', 'light', '#e07a5f', '#3d405b'), lines: ['Ich schreibe gerade an meiner Bewerbung – die Ratgeber bei „Beruf & Karriere“ helfen echt!'] },
  { id: 'mira', name: 'Mira', floor: '3', x: 56, y: 11, dir: 'down', role: 'event', event: 'seat', sit: true, look: mkLook('long', 'brown', 'brown', '#90be6d', '#264653') },
  { id: 'lobby3', name: 'Besucher', floor: '3', x: 15, y: 11, dir: 'down', wander: true, look: mkLook('short', 'grey', 'dark', '#8d99ae', '#2b2d42'), lines: ['Lift und Treppen verbinden das 2. und das 3. OG.', 'Im Veranstaltungssaal links ist gerade eine Lesung.'] },
]);

// Verhaltens-Situationen: Lautstärke, Essen, „Ist hier noch frei?“
const EVENTS = deepFreeze({
  phone: {
    intro: [
      ['lena', '♪ Dü-dü-düdel-dü ♪ … Oh nein, mein Handy!'],
      ['lena', 'Hallo? … JA, ICH BIN IN DER BÜCHEREI! … WAS? ICH HÖR DICH SO SCHLECHT!'],
    ],
    question: 'Lena telefoniert ziemlich laut. Was tust du?',
    choices: [
      { t: 'Leise: „Magst du draußen weitertelefonieren?“', pts: 10, good: true, reply: [['lena', 'Oh – stimmt, sorry! Ich geh kurz raus und stell das Handy dann auf lautlos.']] },
      { t: '„RUHE DA DRINNEN!!!“ brüllen', pts: -5, reply: [['', 'Alle drehen sich um: „Pssst!“ – jetzt warst du lauter als das Handy …']] },
      { t: 'Mitsingen: ♪ Dü-dü-düdel-dü ♪', pts: -2, reply: [['lena', 'Haha, nett – aber in der Bücherei passt das nicht so ganz.']] },
    ],
    done: [['lena', 'Danke nochmal! Mein Handy ist jetzt auf lautlos.']],
  },
  food: {
    intro: [['gruber', 'Mmmh! So eine Leberkässemmel zwischen den Büchern – herrlich! *mampf*']],
    question: 'Herr Gruber isst direkt neben den Büchern. Was sagst du?',
    choices: [
      { t: '„Bitte nicht bei den Büchern essen – sonst gibt es Flecken und Brösel.“', pts: 10, good: true, reply: [['gruber', 'Hast eh recht. Ein Fettfleck im Stadtplan wär schad. Ich ess draußen fertig!']] },
      { t: '„Darf ich mal abbeißen?“', pts: -5, reply: [['gruber', 'Na, sicher net! Hol dir selber eine – und iss sie draußen, gell?']] },
      { t: 'Die Brösel einfach ins Regal wischen', pts: -5, reply: [['', 'Brösel im Regal locken Silberfischchen an. Keine gute Idee!']] },
    ],
    done: [['gruber', 'Die Semmel ist weggepackt. Jetzt wird nur noch gelesen!']],
  },
  seat: {
    intro: [['', 'Ein freier Lernplatz! Nur auf dem Sessel daneben liegt ein Rucksack.']],
    question: 'Du möchtest dich hinsetzen. Was machst du?',
    choices: [
      { t: '„Entschuldigung, ist hier noch frei?“', pts: 10, good: true, reply: [['mira', 'Oh, sorry! Der Rucksack gehört mir – ich räum ihn gleich weg. Setz dich ruhig!']] },
      { t: 'Den Rucksack einfach auf den Boden stellen', pts: -5, reply: [['mira', 'Hey! Das ist meiner. Du hättest auch fragen können …']] },
      { t: 'Dich auf den Tisch setzen', pts: -5, reply: [['mira', 'Ähm … der Tisch ist zum Lernen da, nicht zum Draufsitzen.']] },
    ],
    done: [['mira', 'Viel Spaß beim Lernen! Ich bin auch gleich fertig mit Mathe.']],
  },
});
const EVENT_IDS = Object.freeze(Object.keys(EVENTS));

const NOVAK_INTRO = deepFreeze([
  'Servus und willkommen in der Hauptbücherei! Ich bin Frau Novak von der Ausleihe und Rückgabe.',
  'Die Bücherei ist in sechs Colleges aufgeteilt – jedes hat seine eigene Farbe. Hier im 2. OG: Gelb, Rot und Grau. Oben im 3. OG: Orange, Blau und Grün.',
  'Mit [K] öffnest du jederzeit den Lageplan. Dort steht auch, welche Themen in welchem College zu finden sind.',
  'Du kannst mir gleich helfen: Auf dem Rückgabewagen warten Bücher darauf, wieder ins richtige Regal zu kommen.',
  'Aber Achtung: Ein Buch am falschen Platz springt sofort wieder heraus – und das kostet Punkte!',
  'Hier, nimm gleich das erste. Auf dem Etikett steht das Thema. Viel Erfolg!',
]);

const NOVAK_TIPS = deepFreeze([
  'Bücher, die du fertig gelesen hast, bringst du am besten hierher zur Rückgabe.',
  'Tipp: Mit [Shift] bist du schneller – aber in der Bücherei bitte leise!',
  'Kennst du schon das 3. OG? Mit dem Lift oder über die Treppen kommst du hinauf.',
  'Auf dem Lageplan [K] siehst du alle Colleges und ihre Themen.',
  'An den Info-Theken gibt es Suchaufträge und Quizfragen – die bringen Punkte!',
]);

const OBJECT_TEXT = deepFreeze({
  E: 'Hier geht es hinunter zum Ausgang. Die Bücher warten aber noch auf dich!',
  X: 'Das WC. Gut zu wissen, wo es ist!',
  K: 'Die Garderobe – hier bleiben Jacken und große Taschen.',
  G: 'Ein Globus – passend zum College „Lokal-Regional-Global“!',
  M: 'Ein Klavier. Hier wird nur ganz leise geklimpert …',
  Z: 'Computerplätze zum Recherchieren und Lernen.',
  B: 'Ein gemütlicher Sitzsack. Perfekt zum Schmökern!',
  A: 'Ein bequemer Lesesessel.',
  Q: 'Ein Lesetisch. Hier wird gelesen, gelernt und geflüstert.',
  x: 'Ein Sessel.',
  P: 'Eine Pflanze. Sie liest am liebsten Fachliteratur über Fotosynthese.',
  F: 'Frische Blumen machen die Bücherei gemütlich.',
  J: 'Das Lesepult für Lesungen.',
  k: 'Eine Säule.',
});

// ===================================================================
// Musik & Soundeffekte – komplett per Web Audio synthetisiert.
// Kleiner Sequencer mit Vorausplanung (look-ahead scheduling).
// ===================================================================
const Sound = (() => {
  let ctx = null;
  let master = null;
  let musicBus = null;
  let sfxBus = null;
  let noiseBuf = null;
  let pulseWave = null;
  let musicOn = true;
  let sfxOn = true;
  let song = null;
  let songId = null;
  let step = 0;
  let nextT = 0;
  let timer = null;
  let amb = null;

  const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function freq(name) {
    const m = /^([A-G])([#b]?)(\d)$/.exec(name);
    if (!m) return 0;
    let n = SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    n += (parseInt(m[3], 10) + 1) * 12;
    return 440 * Math.pow(2, (n - 69) / 12);
  }

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();
    } catch (e) {
      ctx = null;
      return false;
    }
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.connect(ctx.destination);
    master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(comp);
    musicBus = ctx.createGain();
    musicBus.gain.value = musicOn ? 0.5 : 0;
    musicBus.connect(master);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = sfxOn ? 0.75 : 0;
    sfxBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    const r = makeRng(1234);
    for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
    const N = 32;
    const real = new Float32Array(N);
    const imag = new Float32Array(N);
    for (let n = 1; n < N; n++) real[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * 0.25);
    pulseWave = ctx.createPeriodicWave(real, imag);
    timer = setInterval(schedule, 25);
    return true;
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }
  function suspend() {
    if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
  }

  // --- Instrumente ------------------------------------------------
  function osc(type, f, t, dur, vol, dest, opt = {}) {
    const o = ctx.createOscillator();
    if (type === 'pulse') o.setPeriodicWave(pulseWave);
    else o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (opt.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, opt.slide), t + dur);
    if (opt.vib) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = 5.5;
      lg.gain.value = f * 0.006;
      lfo.connect(lg);
      lg.connect(o.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.2);
    }
    const g = ctx.createGain();
    const a = opt.attack ?? 0.01;
    const rel = opt.release ?? 0.06;
    const sus = opt.sustain ?? 0.7;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    if (dur > a + 0.08) {
      g.gain.linearRampToValueAtTime(vol * sus, t + a + 0.08);
      g.gain.setValueAtTime(vol * sus, t + dur);
    }
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, a + 0.01) + rel);
    let node = o;
    if (opt.lp) {
      const f2 = ctx.createBiquadFilter();
      f2.type = 'lowpass';
      f2.frequency.value = opt.lp;
      o.connect(f2);
      node = f2;
    }
    node.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + rel + 0.05);
  }

  function noise(t, dur, vol, dest, type = 'bandpass', f = 1000, q = 1, fEnd = null) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.setValueAtTime(f, t);
    if (fEnd) filt.frequency.exponentialRampToValueAtTime(fEnd, t + dur);
    filt.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  const INST = {
    lead: (f, t, d, v) => osc('square', f, t, d, v, musicBus, { lp: 2400, vib: d > 0.3 }),
    soft: (f, t, d, v) => osc('triangle', f, t, d, v, musicBus, { vib: d > 0.3 }),
    bass: (f, t, d, v) => osc('triangle', f, t, d, v, musicBus, { sustain: 0.8 }),
    arp: (f, t, d, v) => osc('pulse', f, t, Math.min(d, 0.12), v, musicBus, { sustain: 0.3, lp: 3000 }),
    reed: (f, t, d, v) => {
      osc('sawtooth', f, t, d, v, musicBus, { lp: 1600, vib: true, attack: 0.03 });
      osc('sawtooth', f * 1.004, t, d, v * 0.7, musicBus, { lp: 1400, attack: 0.03 });
    },
    chord: (f, t, d, v) => osc('square', f, t, Math.min(d, 0.14), v, musicBus, { lp: 1400, sustain: 0.4 }),
    bell: (f, t, d, v) => {
      osc('sine', f, t, Math.min(d, 0.5), v, musicBus, { sustain: 0.25, release: 0.4 });
      osc('sine', f * 2, t, 0.15, v * 0.35, musicBus, { sustain: 0.1, release: 0.2 });
    },
    pluck: (f, t, d, v) => osc('triangle', f, t, 0.12, v, musicBus, { sustain: 0.2, release: 0.15 }),
    K: (f, t, d, v) => osc('sine', 130, t, 0.12, v, musicBus, { slide: 45, sustain: 0.6, release: 0.05 }),
    S: (f, t, d, v) => noise(t, 0.12, v, musicBus, 'bandpass', 1800, 0.8),
    H: (f, t, d, v) => noise(t, 0.04, v * 0.6, musicBus, 'highpass', 7000, 0.7),
  };

  // --- Songs (eigene Kompositionen) --------------------------------
  // Token: Note (z. B. "C5", "F#4", "Bb3"), "-" halten, "." Pause,
  // "A+B+C" Akkord, "K"/"S"/"H" Schlagwerk.
  function chordTrack(bars, perBar, pattern, voicing) {
    const out = [];
    for (const name of bars) {
      for (let i = 0; i < perBar; i++) out.push(pattern[i] === 'x' ? voicing[name] : pattern[i] === 'b' ? voicing[name].split('+')[0].replace(/\d/, (n) => String(Number(n) - 1)) : '.');
    }
    return out.join(' ');
  }

  const V4 = {
    F: 'F3+A3+C4', Am: 'A3+C4+E4', Bb: 'Bb3+D4+F4', C: 'C4+E4+G4', Dm: 'D4+F4+A4',
    Gm: 'G3+Bb3+D4', A: 'A3+C#4+E4', G: 'G3+B3+D4', Em: 'E4+G4+B4', D: 'D4+F#4+A4', A7: 'A3+C#4+G4',
  };

  function arpTrack(bars, perBar) {
    const out = [];
    for (const name of bars) {
      const n = V4[name].split('+');
      const seq = [n[0], n[1], n[2], n[1]];
      for (let i = 0; i < perBar; i++) out.push(seq[i % 4]);
    }
    return out.join(' ');
  }

  const libBars = ['F', 'Am', 'Bb', 'C', 'F', 'Dm', 'Gm', 'F', 'Dm', 'Am', 'Bb', 'F', 'Gm', 'Am', 'Bb', 'C'];
  const SONGS = {
    library: {
      bpm: 84, spb: 2,
      tracks: [
        { inst: 'lead', vol: 0.07, notes:
          'C5 - A4 - F4 - A4 - C5 - E5 - D5 - C5 - D5 - - - Bb4 - C5 D5 C5 - - - - - . . ' +
          'C5 - A4 - F4 - A4 C5 D5 - F5 - E5 - D5 - Bb4 - D5 - C5 - E4 - F4 - - - - - . . ' +
          'F5 - E5 - D5 - A4 - C5 - E5 - A4 - - - Bb4 - D5 - F5 - D5 - C5 - - - A4 - - - ' +
          'G4 - Bb4 - D5 - G5 - E5 - C5 - A4 - C5 - D5 - C5 - Bb4 - A4 - G4 - - - - - . .' },
        { inst: 'bass', vol: 0.16, notes:
          'F2 - - - C3 - - - A2 - - - E3 - - - Bb2 - - - F3 - - - C3 - - - G2 - - - ' +
          'F2 - - - C3 - - - D3 - - - A2 - - - G2 - - - C3 - - - F2 - - - C3 - - - ' +
          'D3 - - - A2 - - - A2 - - - E3 - - - Bb2 - - - F3 - - - F2 - - - C3 - - - ' +
          'G2 - - - D3 - - - A2 - - - E3 - - - Bb2 - - - F3 - - - C3 - - - G2 - - -' },
        { inst: 'arp', vol: 0.035, notes: arpTrack(libBars, 8) },
      ],
    },
    shanty: {
      bpm: 132, spb: 2,
      tracks: [
        { inst: 'reed', vol: 0.05, notes:
          'D5 - C5 A4 - G4 F4 - G4 A4 - - G4 - E4 C4 - E4 G4 - A4 G4 - - ' +
          'D5 - C5 A4 - D5 F5 - E5 D5 - C5 E5 - D5 C5 - E4 D4 - - D4 - . ' +
          'A4 - C5 F5 - E5 E5 - D5 C5 - - D5 - E5 F5 - D5 E5 - C#5 A4 - - ' +
          'D5 - F5 A5 - F5 G5 - F5 D5 - Bb4 A4 - C#5 E5 - C#5 D5 - - - . .' },
        { inst: 'bass', vol: 0.2, notes: chordTrack(['Dm', 'Dm', 'C', 'C', 'Dm', 'Bb', 'C', 'Dm', 'F', 'C', 'Dm', 'A', 'Dm', 'Gm', 'A', 'Dm'], 6, 'b..b..', V4) },
        { inst: 'chord', vol: 0.025, notes: chordTrack(['Dm', 'Dm', 'C', 'C', 'Dm', 'Bb', 'C', 'Dm', 'F', 'C', 'Dm', 'A', 'Dm', 'Gm', 'A', 'Dm'], 6, '.xx.xx', V4) },
        { inst: 'K', vol: 0.35, notes: 'K . . . . . '.repeat(16) },
        { inst: 'S', vol: 0.12, notes: '. . . S . . '.repeat(16) },
      ],
    },
    waltz: {
      bpm: 150, spb: 1,
      tracks: [
        { inst: 'bell', vol: 0.08, notes:
          'D5 B4 G4 E5 - C5 F#5 E5 D5 B4 - - D5 B4 D5 G5 E5 B4 C#5 E5 G5 F#5 - - ' +
          'G5 F#5 E5 E5 D5 C5 C5 B4 A4 A4 - F#4 G4 B4 D5 E5 G5 E5 D5 C5 A4 G4 - -' },
        { inst: 'pluck', vol: 0.14, notes: chordTrack(['G', 'C', 'D', 'G', 'G', 'Em', 'A7', 'D', 'G', 'C', 'Am', 'D', 'G', 'Em', 'D', 'G'], 3, 'b..', Object.assign({ Am: 'A3+C4+E4' }, V4)) },
        { inst: 'chord', vol: 0.02, notes: chordTrack(['G', 'C', 'D', 'G', 'G', 'Em', 'A7', 'D', 'G', 'C', 'Am', 'D', 'G', 'Em', 'D', 'G'], 3, '.xx', Object.assign({ Am: 'A3+C4+E4' }, V4)) },
      ],
    },
  };

  for (const s of Object.values(SONGS)) {
    for (const tr of s.tracks) tr.tokens = tr.notes.trim().split(/\s+/);
    s.len = Math.max(...s.tracks.map((t) => t.tokens.length));
    s.stepDur = 60 / s.bpm / s.spb;
  }

  function scheduleStep(s, i, t) {
    for (const tr of s.tracks) {
      const toks = tr.tokens;
      const tok = toks[i % toks.length];
      if (tok === '.' || tok === '-') continue;
      let len = 1;
      while (toks[(i + len) % toks.length] === '-' && len < toks.length) len++;
      const dur = len * s.stepDur * 0.95;
      const fn = INST[tr.inst];
      if (!fn) continue;
      if (tok === 'K' || tok === 'S' || tok === 'H') {
        fn(0, t, dur, tr.vol);
        continue;
      }
      for (const n of tok.split('+')) {
        const f = freq(n);
        if (f) fn(f, t, dur, tr.vol);
      }
    }
  }

  function schedule() {
    if (!ctx || !song || ctx.state !== 'running') return;
    if (nextT < ctx.currentTime - 0.2) nextT = ctx.currentTime + 0.05;
    while (nextT < ctx.currentTime + 0.15) {
      scheduleStep(song, step, nextT);
      nextT += song.stepDur;
      step = (step + 1) % song.len;
    }
  }

  function play(id) {
    if (songId === id) return;
    songId = id;
    song = SONGS[id] || null;
    step = 0;
    if (ctx) nextT = ctx.currentTime + 0.12;
  }

  function stop() {
    song = null;
    songId = null;
  }

  // Meeresrauschen für Moby Dick
  function ambience(kind) {
    if (!ctx) return;
    if (amb) {
      try { amb.src.stop(); } catch (e) { /* bereits gestoppt */ }
      amb = null;
    }
    if (kind !== 'sea') return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    lfo.frequency.value = 0.18;
    lg.gain.value = 0.035;
    lfo.connect(lg);
    lg.connect(g.gain);
    src.connect(lp);
    lp.connect(g);
    g.connect(musicBus);
    src.start();
    lfo.start();
    amb = { src, lfo };
  }

  // --- Effekte ----------------------------------------------------
  const SFX = {
    blip: (t) => osc('square', 880, t, 0.04, 0.05, sfxBus, { lp: 3000 }),
    select: (t) => { osc('square', 660, t, 0.05, 0.06, sfxBus, { lp: 3000 }); osc('square', 990, t + 0.05, 0.06, 0.06, sfxBus, { lp: 3000 }); },
    talk: (t) => osc('square', 1100 + Math.random() * 200, t, 0.015, 0.018, sfxBus, { lp: 2500, release: 0.02 }),
    pickup: (t) => { osc('triangle', 1047, t, 0.06, 0.12, sfxBus); osc('triangle', 1568, t + 0.06, 0.1, 0.12, sfxBus); },
    correct: (t) => [523, 659, 784, 1047].forEach((f, i) => osc('square', f, t + i * 0.07, 0.08, 0.07, sfxBus, { lp: 3500 })),
    wrong: (t) => { osc('sawtooth', 196, t, 0.28, 0.07, sfxBus, { slide: 147, lp: 1200 }); },
    whoosh: (t) => noise(t, 0.4, 0.25, sfxBus, 'bandpass', 2400, 1.5, 300),
    thud: (t) => { osc('sine', 140, t, 0.12, 0.25, sfxBus, { slide: 55 }); noise(t, 0.08, 0.1, sfxBus, 'lowpass', 600); },
    unlock: (t) => [392, 523, 659, 784, 659, 784, 1047].forEach((f, i) => osc(i < 6 ? 'square' : 'triangle', f, t + i * 0.09, i === 6 ? 0.4 : 0.09, 0.07, sfxBus, { lp: 3200 })),
    pssst: (t) => noise(t, 0.6, 0.18, sfxBus, 'highpass', 3500, 0.7),
    ding: (t) => { osc('sine', 1319, t, 0.6, 0.12, sfxBus, { sustain: 0.3, release: 0.6 }); osc('sine', 1047, t + 0.25, 0.7, 0.1, sfxBus, { sustain: 0.3, release: 0.7 }); },
    coin: (t) => { osc('square', 988, t, 0.06, 0.07, sfxBus, { lp: 4000 }); osc('square', 1319, t + 0.06, 0.25, 0.07, sfxBus, { lp: 4000 }); },
    splash: (t) => noise(t, 0.9, 0.3, sfxBus, 'lowpass', 1400, 0.8, 250),
    jump: (t) => osc('square', 300, t, 0.1, 0.05, sfxBus, { slide: 620, lp: 2400 }),
    call: (t) => { osc('sawtooth', 220, t, 0.45, 0.06, sfxBus, { lp: 900, vib: true }); osc('sawtooth', 330, t + 0.12, 0.5, 0.05, sfxBus, { lp: 900 }); },
    nail: (t) => { for (let i = 0; i < 2; i++) { noise(t + i * 0.18, 0.05, 0.25, sfxBus, 'bandpass', 2500, 2); osc('sine', 900, t + i * 0.18, 0.04, 0.08, sfxBus); } },
    ring: (t) => { for (let i = 0; i < 6; i++) osc('square', i % 2 ? 1100 : 1400, t + i * 0.08, 0.07, 0.04, sfxBus, { lp: 3000 }); },
    ouch: (t) => osc('square', 420, t, 0.15, 0.06, sfxBus, { slide: 180, lp: 2000 }),
    spout: (t) => noise(t, 0.5, 0.1, sfxBus, 'bandpass', 1300, 0.9, 600),
    badge: (t) => [784, 988, 1175, 1568].forEach((f, i) => osc('triangle', f, t + i * 0.08, 0.12, 0.1, sfxBus)),
    door: (t) => { noise(t, 0.25, 0.08, sfxBus, 'bandpass', 500, 1.2, 900); },
    step: (t) => noise(t, 0.03, 0.03, sfxBus, 'lowpass', 500),
  };

  function sfx(name) {
    if (!ctx || !sfxOn || ctx.state !== 'running') return;
    const fn = SFX[name];
    if (fn) fn(ctx.currentTime + 0.005);
  }

  function setMusic(on) {
    musicOn = !!on;
    if (musicBus) musicBus.gain.setTargetAtTime(musicOn ? 0.5 : 0, ctx.currentTime, 0.05);
  }
  function setSfx(on) {
    sfxOn = !!on;
    if (sfxBus) sfxBus.gain.setTargetAtTime(sfxOn ? 0.75 : 0, ctx.currentTime, 0.05);
  }

  return {
    init, resume, suspend, play, stop, sfx, ambience, setMusic, setSfx,
    get musicOn() { return musicOn; },
    get sfxOn() { return sfxOn; },
    get ready() { return !!ctx; },
    songIds: Object.keys(SONGS),
  };
})();

// ===================================================================
// Spielstand im localStorage – nur als Komfort.
// Sicherheit: Größenlimit, JSON.parse in try/catch, jedes Feld wird
// gegen eine Whitelist/Typprüfung validiert und in ein frisches Objekt
// kopiert (kein Merge von Fremddaten -> keine Prototype-Pollution).
// ===================================================================
const Save = (() => {
  const KEY = 'buecherwelten.save.v1';
  const MAX_BYTES = 8192;
  const BOOK_IDS = RETURN_BOOKS.map((b) => b.id);
  const SEARCH_IDS = SEARCHES.map((s) => s.id);
  const QUIZ_IDS = QUIZ.map((q) => q.id);

  function defaults() {
    return {
      v: 1,
      pts: 0,
      floor: '2',
      x: -1,
      y: -1,
      tutorial: 0,
      carrying: null,
      wrongTries: 0,
      search: null,
      searchDone: [],
      quizDone: [],
      eventsDone: [],
      worldsDone: [],
      worldsSeen: [],
      badges: [],
      visited: [],
      returned: [],
      stats: { returns: 0, wrong: 0, searches: 0, quiz: 0 },
      music: true,
      sfx: true,
    };
  }

  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  function cleanList(v, allowed) {
    if (!Array.isArray(v)) return [];
    const out = [];
    for (const item of v.slice(0, 64)) {
      if (typeof item === 'string' && allowed.includes(item) && !out.includes(item)) out.push(item);
    }
    return out;
  }

  function cleanInt(v, lo, hi, dflt) {
    return Number.isInteger(v) && v >= lo && v <= hi ? v : dflt;
  }

  function cleanId(v, allowed) {
    return typeof v === 'string' && allowed.includes(v) ? v : null;
  }

  function sanitize(raw) {
    const d = defaults();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.v !== 1) return d;
    const get = (k) => (has(raw, k) ? raw[k] : undefined);
    d.pts = cleanInt(get('pts'), 0, 99999, 0);
    d.floor = get('floor') === '3' ? '3' : '2';
    d.x = cleanInt(get('x'), 0, 64 * TS, -1);
    d.y = cleanInt(get('y'), 0, 18 * TS, -1);
    d.tutorial = cleanInt(get('tutorial'), 0, 2, 0);
    d.carrying = cleanId(get('carrying'), BOOK_IDS);
    d.wrongTries = cleanInt(get('wrongTries'), 0, 99, 0);
    d.search = cleanId(get('search'), SEARCH_IDS);
    d.searchDone = cleanList(get('searchDone'), SEARCH_IDS);
    d.quizDone = cleanList(get('quizDone'), QUIZ_IDS);
    d.eventsDone = cleanList(get('eventsDone'), EVENT_IDS);
    d.worldsDone = cleanList(get('worldsDone'), WORLD_IDS);
    d.worldsSeen = cleanList(get('worldsSeen'), WORLD_IDS);
    d.badges = cleanList(get('badges'), BADGE_IDS);
    d.visited = cleanList(get('visited'), COLLEGE_IDS);
    d.returned = cleanList(get('returned'), BOOK_IDS);
    const st = get('stats');
    if (st && typeof st === 'object' && !Array.isArray(st)) {
      for (const k of Object.keys(d.stats)) d.stats[k] = cleanInt(has(st, k) ? st[k] : 0, 0, 99999, 0);
    }
    d.music = get('music') !== false;
    d.sfx = get('sfx') !== false;
    if (d.carrying && d.search) d.search = null;
    return d;
  }

  function load() {
    let txt = null;
    try {
      txt = window.localStorage.getItem(KEY);
    } catch (e) {
      return null;
    }
    if (typeof txt !== 'string' || txt.length === 0 || txt.length > MAX_BYTES) return null;
    let raw = null;
    try {
      raw = JSON.parse(txt);
    } catch (e) {
      return null;
    }
    return sanitize(raw);
  }

  function store(state) {
    try {
      const txt = JSON.stringify(sanitize(JSON.parse(JSON.stringify(state))));
      if (txt.length <= MAX_BYTES) window.localStorage.setItem(KEY, txt);
    } catch (e) {
      /* Speicher nicht verfügbar – Spiel läuft trotzdem */
    }
  }

  function clear() {
    try {
      window.localStorage.removeItem(KEY);
    } catch (e) {
      /* ignorieren */
    }
  }

  return { defaults, load, store, clear, sanitize };
})();

// ===================================================================
// Eingabe: Tastatur (physische Tasten via e.code) und Touch-Knöpfe.
// ===================================================================
const Input = (() => {
  const held = new Set();
  const pressed = new Set();
  let anyListener = null;
  const KEYMAP = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    KeyE: 'act', Enter: 'act', NumpadEnter: 'act', Space: 'jump',
    ShiftLeft: 'run', ShiftRight: 'run',
    KeyK: 'map', KeyM: 'music', Escape: 'menu', KeyP: 'menu',
  };

  function press(b) {
    if (!held.has(b)) pressed.add(b);
    held.add(b);
    if (anyListener) anyListener(b);
  }
  function release(b) {
    held.delete(b);
  }

  function onKeyDown(e) {
    const b = KEYMAP[e.code];
    if (!b) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    if (e.repeat && b !== 'up' && b !== 'down' && b !== 'left' && b !== 'right') return;
    press(b);
  }
  function onKeyUp(e) {
    const b = KEYMAP[e.code];
    if (!b) return;
    e.preventDefault();
    release(b);
  }

  function attach(target) {
    target.addEventListener('keydown', onKeyDown);
    target.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clear);
  }

  // Touch/Maus-Knöpfe: data-btn="up|down|left|right|act|run|map|menu|music"
  function bindButtons(root) {
    for (const el of root.querySelectorAll('[data-btn]')) {
      const names = String(el.dataset.btn).split(' ').filter((n) => /^[a-z]+$/.test(n));
      const down = (e) => {
        e.preventDefault();
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
        el.classList.add('on');
        for (const n of names) press(n);
      };
      const up = (e) => {
        e.preventDefault();
        el.classList.remove('on');
        for (const n of names) release(n);
      };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('lostpointercapture', up);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }

  function clear() {
    held.clear();
    pressed.clear();
  }

  return {
    attach,
    bindButtons,
    press,
    release,
    clear,
    down: (b) => held.has(b),
    hit: (b) => pressed.has(b),
    hitAny: (...bs) => bs.some((b) => pressed.has(b)),
    confirm: () => pressed.has('act') || pressed.has('jump'),
    endFrame: () => pressed.clear(),
    onAny: (fn) => { anyListener = fn; },
  };
})();

// ===================================================================
// UI: Panels, Dialoge (mit Porträt & Auswahl), Toasts, Banner, Floater
// ===================================================================
const UI_COL = {
  panel: 'rgba(30,22,34,0.93)', border: '#ead9b5', inner: '#4a3a4f',
  text: '#f7f1e3', title: '#ffd977', dim: '#b9aab8', good: '#8ee07a', bad: '#ff8a7a', accent: '#7fd6ff',
};

function drawPanel(g, x, y, w, h, fill = UI_COL.panel, border = UI_COL.border) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  g.fillStyle = fill;
  g.fillRect(x + 1, y + 1, w - 2, h - 2);
  g.fillStyle = border;
  g.fillRect(x + 2, y, w - 4, 1);
  g.fillRect(x + 2, y + h - 1, w - 4, 1);
  g.fillRect(x, y + 2, 1, h - 4);
  g.fillRect(x + w - 1, y + 2, 1, h - 4);
  g.fillRect(x + 1, y + 1, 1, 1);
  g.fillRect(x + w - 2, y + 1, 1, 1);
  g.fillRect(x + 1, y + h - 2, 1, 1);
  g.fillRect(x + w - 2, y + h - 2, 1, 1);
  g.fillStyle = UI_COL.inner;
  g.fillRect(x + 2, y + 1, w - 4, 1);
}

// --- Dialoge -----------------------------------------------------
const Dialog = (() => {
  let queue = [];
  let cur = null;
  let onDone = null;
  let blink = 0;
  const BOX = { x: 6, y: 150, w: 372, h: 60 };

  function open(pages, done) {
    queue = pages.filter(Boolean).slice();
    onDone = done || null;
    next();
  }

  function layout(p) {
    const textW = p.look ? BOX.w - 56 : BOX.w - 16;
    p.lines = Font.wrap(p.text, textW);
    p.total = p.lines.reduce((n, l) => n + l.length, 0);
    p.shown = 0;
    p.sel = 0;
    if (p.choices) {
      p.choiceLines = p.choices.map((c) => Font.wrap(c.t, 300));
    }
  }

  function next() {
    cur = queue.shift() || null;
    if (!cur) {
      const d = onDone;
      onDone = null;
      if (d) d();
      return;
    }
    layout(cur);
  }

  function close() {
    queue = [];
    cur = null;
    onDone = null;
  }

  function update(dt) {
    if (!cur) return;
    blink += dt;
    const before = Math.floor(cur.shown);
    cur.shown = Math.min(cur.total, cur.shown + dt * 55);
    if (Math.floor(cur.shown) !== before && Math.floor(cur.shown) % 3 === 0) Sound.sfx('talk');
    const done = cur.shown >= cur.total;
    if (done && cur.choices) {
      if (Input.hit('up')) { cur.sel = (cur.sel + cur.choices.length - 1) % cur.choices.length; Sound.sfx('blip'); }
      if (Input.hit('down')) { cur.sel = (cur.sel + 1) % cur.choices.length; Sound.sfx('blip'); }
    }
    if (Input.confirm()) {
      if (!done) {
        cur.shown = cur.total;
      } else if (cur.choices) {
        const ch = cur.choices[cur.sel];
        Sound.sfx('select');
        close();
        if (ch && ch.fn) ch.fn();
      } else {
        Sound.sfx('blip');
        next();
      }
    }
  }

  function draw(g) {
    if (!cur) return;
    const b = BOX;
    drawPanel(g, b.x, b.y, b.w, b.h);
    let tx = b.x + 8;
    if (cur.look) {
      const spr = charSprites(cur.look).portrait;
      rect(g, b.x + 6, b.y + 8, 36, 36, '#3b2d3f');
      rect(g, b.x + 6, b.y + 8, 36, 1, '#5d4a63');
      g.drawImage(spr, b.x + 8, b.y + 9, 32, 32);
      tx = b.x + 50;
    }
    if (cur.name) {
      const nw = Font.measure(cur.name) + 12;
      drawPanel(g, b.x + 4, b.y - 12, nw, 14, '#5b3f63');
      Font.draw(g, cur.name, b.x + 10, b.y - 11, UI_COL.title);
    }
    let left = Math.floor(cur.shown);
    let ty = b.y + 5;
    for (const line of cur.lines) {
      if (left <= 0) break;
      const part = line.slice(0, left);
      Font.draw(g, part, tx, ty, UI_COL.text);
      left -= line.length;
      ty += Font.LINE;
    }
    const done = cur.shown >= cur.total;
    if (done && !cur.choices && Math.floor(blink * 3) % 2 === 0) {
      Font.draw(g, '▶', b.x + b.w - 10, b.y + b.h - 12, UI_COL.title);
    }
    if (done && cur.choices) {
      const lines = cur.choiceLines.reduce((n, l) => n + l.length, 0);
      const h = lines * Font.LINE + 8;
      const cx = 52;
      const cy = b.y - 16 - h;
      drawPanel(g, cx, cy, 320, h, 'rgba(40,30,48,0.96)');
      let yy = cy + 4;
      cur.choiceLines.forEach((ls, i) => {
        const on = i === cur.sel;
        if (on) {
          rect(g, cx + 3, yy - 1, 314, ls.length * Font.LINE + 1, 'rgba(255,217,119,0.16)');
          Font.draw(g, '▶', cx + 6, yy, UI_COL.title);
        }
        ls.forEach((l, j) => Font.draw(g, l, cx + 16, yy + j * Font.LINE, on ? UI_COL.title : UI_COL.text));
        yy += ls.length * Font.LINE;
      });
    }
  }

  return { open, close, update, draw, active: () => !!cur };
})();

// Hilfsfunktionen zum Bauen von Dialogseiten
function npcPage(npc, text) {
  return { name: npc ? npc.name : '', look: npc ? npc.look : null, text };
}
function narr(text) {
  return { name: '', look: null, text };
}

// --- Toasts, Banner, Floater -------------------------------------
const Toast = (() => {
  const q = [];
  let cur = null;
  function show(text, color = UI_COL.title) {
    if (q.length > 4) q.shift();
    q.push({ text, color, t: 0 });
  }
  function update(dt) {
    if (!cur && q.length) cur = q.shift();
    if (cur) {
      cur.t += dt;
      if (cur.t > 2.4) cur = null;
    }
  }
  function draw(g) {
    if (!cur) return;
    const t = cur.t;
    const slide = t < 0.2 ? (0.2 - t) * 80 : t > 2.1 ? (t - 2.1) * 80 : 0;
    const w = Font.measure(cur.text) + 16;
    const x = Math.round((VIEW_W - w) / 2);
    const y = Math.round(22 - slide);
    drawPanel(g, x, y, w, 15, 'rgba(30,22,34,0.95)', cur.color);
    Font.draw(g, cur.text, x + 8, y + 2, cur.color);
  }
  return { show, update, draw, clear: () => { q.length = 0; cur = null; } };
})();

const Banner = (() => {
  let cur = null;
  function show(title, sub, color, prio = 0) {
    if (cur && cur.prio > prio && cur.t < 2.2) return;
    cur = { title, sub, color, t: 0, prio };
  }
  function update(dt) {
    if (cur) {
      cur.t += dt;
      if (cur.t > 2.6) cur = null;
    }
  }
  function draw(g) {
    if (!cur) return;
    const a = cur.t < 0.25 ? cur.t / 0.25 : cur.t > 2.2 ? Math.max(0, (2.6 - cur.t) / 0.4) : 1;
    g.globalAlpha = a;
    const w = Math.max(Font.measure(cur.title), Font.measure(cur.sub || '')) + 24;
    const x = Math.round((VIEW_W - w) / 2);
    const y = 40;
    const h = cur.sub ? 28 : 16;
    drawPanel(g, x, y, w, h, 'rgba(30,22,34,0.9)', cur.color);
    rect(g, x + 2, y + 2, 4, h - 4, cur.color);
    Font.drawCentered(g, cur.title, VIEW_W / 2 + 2, y + 3, '#ffffff');
    if (cur.sub) Font.drawCentered(g, cur.sub, VIEW_W / 2 + 2, y + 15, cur.color);
    g.globalAlpha = 1;
  }
  return { show, update, draw };
})();

const Floaters = (() => {
  let list = [];
  function add(x, y, text, color) {
    list.push({ x, y, text, color, t: 0 });
  }
  function update(dt) {
    for (const f of list) f.t += dt;
    list = list.filter((f) => f.t < 1.2);
  }
  function draw(g, camX, camY) {
    for (const f of list) {
      g.globalAlpha = f.t > 0.8 ? Math.max(0, (1.2 - f.t) / 0.4) : 1;
      Font.drawCentered(g, f.text, f.x - camX, f.y - camY - f.t * 22, f.color, '#1a1220');
    }
    g.globalAlpha = 1;
  }
  return { add, update, draw, clear: () => { list = []; } };
})();

// Kleine Sprechblase mit Symbol über Figuren
function drawBubble(g, x, y, text, color = '#2b1d1f') {
  const w = Math.max(9, Font.measure(text) + 6);
  const bx = Math.round(x - w / 2);
  const by = Math.round(y - 14);
  rect(g, bx + 1, by, w - 2, 12, '#2b1d1f');
  rect(g, bx, by + 1, w, 10, '#2b1d1f');
  rect(g, bx + 1, by + 1, w - 2, 10, '#fffaf0');
  rect(g, Math.round(x) - 1, by + 12, 3, 1, '#2b1d1f');
  rect(g, Math.round(x), by + 13, 1, 1, '#2b1d1f');
  rect(g, Math.round(x) - 1, by + 11, 3, 1, '#fffaf0');
  Font.draw(g, text, bx + 3, by + 1, color);
}

// ===================================================================
// Bücherei: Karten, Objekte, Figuren, Kollision, Interaktion, Mechanik
// ===================================================================
const WALL_CHARS = '#=~LX ';
const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

function zoneAt(floor, x, y) {
  if (floor === '2') return x <= 13 ? 'f' : x <= 41 ? (y <= 8 ? 'y' : 'r') : x <= 44 ? 'c' : 'g';
  return x <= 11 ? 'h' : x <= 19 ? 'f' : x <= 31 ? 'o' : x <= 45 ? 'b' : 'n';
}
const ZONE_COLLEGE = { y: 'c1', r: 'c2', g: 'c3', o: 'c4', b: 'c5', n: 'c6' };
const ZONE_SHORT = { f: 'Foyer', c: 'Gang', h: 'Saal' };

// Spielstand (wird beim Start aus Save geladen)
let S = Save.defaults();

// --- Etagen aufbauen ------------------------------------------------
function buildFloor(id) {
  const rows = MAPS[id];
  const F = { id, w: rows[0].length, h: rows.length, rows, objects: [], shelves: [], objAt: new Map(), wallAt: new Map(), solid: null, layer: null };
  F.raw = (x, y) => (x < 0 || y < 0 || x >= F.w || y >= F.h ? ' ' : rows[y][x]);
  F.isWall = (x, y) => WALL_CHARS.includes(F.raw(x, y));
  F.solid = new Uint8Array(F.w * F.h);
  for (let y = 0; y < F.h; y++) {
    for (let x = 0; x < F.w; x++) {
      const ch = F.raw(x, y);
      const walk = 'fchyrgobnVT'.includes(ch);
      F.solid[y * F.w + x] = walk ? 0 : 1;
    }
  }

  const add = (o) => {
    F.objects.push(o);
    for (let yy = o.ty; yy < o.ty + o.th; yy++) for (let xx = o.tx; xx < o.tx + o.tw; xx++) F.objAt.set(yy * F.w + xx, o);
    return o;
  };
  const sprite = (w, h, fn) => {
    const c = makeCanvas(w, h);
    fn(c.getContext('2d'));
    return c;
  };
  const mk = (type, ch, tx, ty, tw, th, img, offY, extra = {}) =>
    add(Object.assign({ type, ch, tx, ty, tw, th, img, px: tx * TS, py: ty * TS + offY, sortY: (ty + th) * TS }, extra));

  // Regale mit Themen
  const topicAt = new Map();
  for (const [x, y, t] of SHELF_TOPICS[id]) topicAt.set(y * F.w + x, t);
  const used = new Set();
  for (let y = 0; y < F.h; y++) {
    for (let x = 0; x < F.w; x++) {
      const i = y * F.w + x;
      const ch = F.raw(x, y);
      if (used.has(i)) continue;
      if (ch === 'S') {
        const topic = topicAt.get(i);
        if (!topic) continue;
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) used.add((y + dy) * F.w + x + dx);
        const col = COLLEGES[TOPICS[topic].college].color;
        const img = sprite(32, 32, (g) => drawShelf(g, 0, 0, shelfKind(topic), col, x * 131 + y * 17 + id.charCodeAt(0)));
        let world = null;
        for (const wid of WORLD_IDS) if (WORLDS[wid].topic === topic && WORLDS[wid].floor === id) world = wid;
        F.shelves.push(mk('shelf', ch, x, y, 2, 2, img, 0, { topic, world }));
      } else if (ch === 'I' && F.raw(x - 1, y) !== 'I') {
        used.add(i); used.add(i + 1); used.add(i + 2);
        mk('info', ch, x, y, 3, 1, sprite(48, 22, (g) => drawInfoDesk(g, 0, 0)), -6, { npcAt: [x + 1, y - 1] });
      } else if (ch === 'R' && F.raw(x - 1, y) !== 'R' && F.raw(x, y - 1) !== 'R') {
        for (let yy = 0; yy < 2; yy++) for (let xx = 0; xx < 3; xx++) used.add((y + yy) * F.w + x + xx);
        mk('ret', ch, x, y, 3, 2, sprite(48, 32, (g) => drawReturnDesk(g, 0, 0)), 0, { npcAt: [x + 1, y - 1] });
      } else if ((ch === 'M' || ch === 'Z') && F.raw(x - 1, y) !== ch) {
        used.add(i); used.add(i + 1);
        if (ch === 'M') mk('piano', ch, x, y, 2, 1, sprite(32, 24, (g) => drawPiano(g, 0, 0)), -8);
        else mk('pc', ch, x, y, 2, 1, sprite(32, 18, (g) => drawComputerDesk(g, 0, 2)), -2);
      } else if (ch === 'Q') {
        const open = { n: F.raw(x, y - 1) !== 'Q', w: F.raw(x - 1, y) !== 'Q', e: F.raw(x + 1, y) !== 'Q' };
        const r = makeRng(x * 7 + y * 13);
        mk('table', ch, x, y, 1, 1, sprite(16, 16, (g) => drawTable(g, 0, 0, open, r)), 0);
      } else if (ch === 'x') {
        mk('chair', ch, x, y, 1, 1, ITEM_SPRITES.chair, 2, { sortY: y * TS + 6, dx: 2 });
      } else if (ch === 'A') {
        const cols = ['#b8453a', '#3b7a57', '#4a6fa5', '#9b5d8f'];
        mk('arm', ch, x, y, 1, 1, sprite(16, 16, (g) => drawArmchair(g, 0, 0, cols[(x + y) % cols.length])), 0);
      } else if (ch === 'P' || ch === 'F') {
        mk('plant', ch, x, y, 1, 1, sprite(16, 24, (g) => drawPlant(g, 0, 0, x * 31 + y, ch === 'F')), -8);
      } else if (ch === 'K') {
        mk('coat', ch, x, y, 1, 1, sprite(16, 24, (g) => drawCoatRack(g, 0, 0, x)), -8);
      } else if (ch === 'G') {
        mk('globe', ch, x, y, 1, 1, sprite(16, 20, (g) => drawGlobe(g, 0, 0)), -4);
      } else if (ch === 'B') {
        const cols = ['#e67e22', '#9b59b6', '#1abc9c', '#e84393'];
        mk('bean', ch, x, y, 1, 1, sprite(16, 16, (g) => drawBeanbag(g, 0, 0, cols[(x + y) % cols.length])), 0);
      } else if (ch === 'k') {
        mk('pillar', ch, x, y, 1, 1, sprite(16, 26, (g) => drawPillar(g, 0, 10)), -10);
      } else if (ch === 'N') {
        const cid = ZONE_COLLEGE[zoneAt(id, x, y)];
        const col = COLLEGES[cid];
        mk('sign', ch, x, y, 1, 1, sprite(16, 24, (g) => drawSignPost(g, 0, 0, col.color, String(col.num))), -8, { college: cid });
      } else if (ch === 'O') {
        mk('mapboard', ch, x, y, 1, 1, sprite(16, 24, (g) => drawMapBoard(g, 0, 0)), -8);
      } else if (ch === '*') {
        mk('lamp', ch, x, y, 1, 1, sprite(16, 24, (g) => drawLamp(g, 0, 0)), -8);
      } else if (ch === 'J') {
        mk('lectern', ch, x, y, 1, 1, sprite(16, 16, (g) => drawLectern(g, 0, 0)), 0);
      } else if (ch === 'C') {
        mk('cart', ch, x, y, 1, 1, sprite(16, 16, (g) => drawCart(g, 0, 0)), 0);
      } else if (ch === 'E') {
        F.objAt.set(i, { type: 'exit', ch, tx: x, ty: y, tw: 1, th: 1, img: null });
      } else if (ch === 'L' && F.raw(x - 1, y) !== 'L') {
        const lift = { type: 'lift', tx: x, ty: y, tw: 2, th: 1 };
        F.wallAt.set(i, lift);
        F.wallAt.set(i + 1, lift);
      } else if (ch === 'X') {
        F.wallAt.set(i, { type: 'wc', tx: x, ty: y, tw: 1, th: 1 });
      }
    }
  }
  F.layer = renderFloorLayer(F);
  return F;
}

function renderFloorLayer(F) {
  const c = makeCanvas(F.w * TS, F.h * TS);
  const g = c.getContext('2d');
  rect(g, 0, 0, c.width, c.height, '#140f17');
  const floorKind = (x, y) => {
    const z = zoneAt(F.id, x, y);
    return z;
  };
  for (let y = 0; y < F.h; y++) {
    for (let x = 0; x < F.w; x++) {
      const ch = F.raw(x, y);
      const X = x * TS;
      const Y = y * TS;
      if (ch === ' ') continue;
      if (F.isWall(x, y)) {
        const below = F.raw(x, y + 1);
        const outer = F.raw(x - 1, y) === ' ' || F.raw(x + 1, y) === ' ';
        if (!WALL_CHARS.includes(below) && !outer) {
          drawWallFace(g, X, Y, ch === '=' ? 'window' : ch === '~' ? 'curtain' : 'plain', x);
          if (ch === 'L' && F.raw(x - 1, y) !== 'L') drawLiftDoor(g, X, Y);
          if (ch === 'X') drawWcDoor(g, X, Y);
        } else {
          const open = (xx, yy) => !WALL_CHARS.includes(F.raw(xx, yy));
          drawWallCap(g, X, Y, { n: open(x, y - 1), s: false, w: open(x - 1, y), e: open(x + 1, y) });
        }
        continue;
      }
      const z = floorKind(x, y);
      if (ch === 'V') {
        drawStage(g, X, Y, x, y, F.raw(x, y + 1) !== 'V' || F.raw(x + 1, y) !== 'V');
      } else if (ch === 'T') {
        drawStairs(g, X, Y, F.raw(x - 1, y) === 'T' ? 1 : 0, false);
      } else if (ch === 'E') {
        drawEntrance(g, X, Y, x);
      } else if (z === 'f') {
        drawWoodFloor(g, X, Y, x, y);
      } else if (z === 'h') {
        drawWoodFloor(g, X, Y, x, y, '#a4693f', '#975f39', '#6a3f24');
      } else if (z === 'c') {
        drawStoneFloor(g, X, Y, x, y);
      } else {
        const col = COLLEGES[ZONE_COLLEGE[z]];
        drawCarpet(g, X, Y, x, y, col.carpet[0], col.carpet[1]);
      }
    }
  }
  // Teppichkanten zwischen Zonen
  for (let y = 0; y < F.h; y++) {
    for (let x = 0; x < F.w; x++) {
      if (F.isWall(x, y) || 'VTE'.includes(F.raw(x, y))) continue;
      const z = floorKind(x, y);
      const cid = ZONE_COLLEGE[z];
      if (!cid) continue;
      const trim = shade(COLLEGES[cid].carpet[0], -0.35);
      const X = x * TS;
      const Y = y * TS;
      const diff = (xx, yy) => !F.isWall(xx, yy) && floorKind(xx, yy) !== z;
      if (diff(x - 1, y)) rect(g, X, Y, 2, TS, trim);
      if (diff(x + 1, y)) rect(g, X + TS - 2, Y, 2, TS, trim);
      if (diff(x, y - 1)) rect(g, X, Y, TS, 2, trim);
      if (diff(x, y + 1)) rect(g, X, Y + TS - 2, TS, 2, trim);
    }
  }
  // Planeten-Teppich im Kirango
  if (F.id === '3') {
    const cx = 27.5 * TS;
    const cy = 10.5 * TS;
    for (let yy = -30; yy <= 30; yy++) {
      for (let xx = -38; xx <= 38; xx++) {
        const d = (xx * xx) / (38 * 38) + (yy * yy) / (30 * 30);
        if (d > 1) continue;
        let col = d > 0.86 ? '#7b3fa0' : d > 0.8 ? '#f6d365' : '#5b8fd9';
        if (d <= 0.8 && Math.sin(xx * 0.18) + Math.cos(yy * 0.22) > 1.1) col = '#7ccf6a';
        if (d <= 0.8 && (xx + yy * 2) % 23 === 0) col = '#ffffff';
        px(g, Math.round(cx + xx), Math.round(cy + yy), col);
      }
    }
  }
  return c;
}

// --- Figuren --------------------------------------------------------
function makeActor(def) {
  return {
    id: def.id, def, name: def.name, look: def.look, spr: charSprites(def.look),
    x: def.x * TS + 8, y: def.y * TS + 14, homeX: def.x * TS + 8, homeY: def.y * TS + 14,
    dir: def.dir || 'down', anim: 0, moving: false, sit: !!def.sit, hidden: false,
    wander: !!def.wander, target: null, wait: 1 + Math.random() * 3, bubble: null, bubbleT: 0, lineIdx: 0, stuck: 0,
  };
}

// --- Bücherei-Szene ---------------------------------------------------
const Library = (() => {
  const floors = {};
  let F = null;
  let player = null;
  let npcs = [];
  let camX = 0;
  let camY = 0;
  let zone = null;
  let target = null;
  let noise = 0;
  let pssstCd = 0;
  let flying = [];
  let sparks = [];
  let trans = null;
  let stairLock = false;
  let quizPtr = 0;
  let ringT = 0;
  let saveT = 0;
  let time = 0;
  let onOpenMap = null;
  let onStartWorld = null;

  function init(hooks) {
    onOpenMap = hooks.openMap;
    onStartWorld = hooks.startWorld;
    for (const id of ['2', '3']) floors[id] = buildFloor(id);
  }

  function solidAt(x, y) {
    const tx = Math.floor(x / TS);
    const ty = Math.floor(y / TS);
    if (tx < 0 || ty < 0 || tx >= F.w || ty >= F.h) return true;
    return F.solid[ty * F.w + tx] === 1;
  }

  function boxFree(a, x, y, ignore) {
    const pts = [[x - 5, y - 5], [x + 4, y - 5], [x - 5, y - 1], [x + 4, y - 1]];
    for (const [px2, py2] of pts) if (solidAt(px2, py2)) return false;
    const all = [player, ...npcs];
    for (const o of all) {
      if (!o || o === a || o === ignore || o.hidden || o.floor !== F.id) continue;
      if (Math.abs(o.x - x) < 10 && Math.abs(o.y - y) < 6) return false;
    }
    return true;
  }

  function moveActor(a, dx, dy) {
    let moved = false;
    if (dx) {
      const nx = a.x + dx;
      if (boxFree(a, nx, a.y)) { a.x = nx; moved = true; }
    }
    if (dy) {
      const ny = a.y + dy;
      if (boxFree(a, a.x, ny)) { a.y = ny; moved = true; }
    }
    return moved;
  }

  function enterFloor(id, x, y, dir) {
    F = floors[id];
    S.floor = id;
    player.floor = id;
    player.x = x;
    player.y = y;
    if (dir) player.dir = dir;
    for (const n of npcs) n.floor = n.def.floor;
    zone = null;
    flying = [];
    stairLock = F.raw(Math.floor(x / TS), Math.floor((y - 2) / TS)) === 'T';
    snapCamera();
  }

  function start() {
    player = makeActor({ id: 'player', name: 'Du', look: PLAYER_LOOK, x: 5, y: 8, dir: 'right' });
    player.floor = '2';
    npcs = NPCS.map((d) => {
      const a = makeActor(d);
      a.floor = d.floor;
      return a;
    });
    applyEventState();
    let fx = 5 * TS + 8;
    let fy = 8 * TS + 14;
    const fl = S.floor === '3' ? '3' : '2';
    F = floors[fl];
    if (S.x > 0 && S.y > 0) {
      fx = S.x;
      fy = S.y;
    }
    enterFloor(fl, fx, fy, 'right');
    if (!boxFree(player, player.x, player.y)) enterFloor('2', 5 * TS + 8, 8 * TS + 14, 'right');
    noise = 0;
    Sound.play('library');
  }

  function applyEventState() {
    for (const n of npcs) {
      if (n.id === 'lena' && S.eventsDone.includes('phone')) n.hidden = true;
    }
  }

  function snapCamera() {
    camX = clamp(Math.round(player.x - VIEW_W / 2), 0, F.w * TS - VIEW_W);
    camY = clamp(Math.round(player.y - 8 - VIEW_H / 2), 0, F.h * TS - VIEW_H);
  }

  // --- Punkte, Abzeichen, Freischaltungen ----------------------------
  function addPoints(n, label, wx, wy) {
    S.pts = Math.max(0, S.pts + n);
    const txt = (n > 0 ? '+' : '') + n + ' ★';
    if (wx !== undefined) Floaters.add(wx, wy, txt, n > 0 ? UI_COL.good : UI_COL.bad);
    if (label) Toast.show(txt + '  ' + label, n > 0 ? UI_COL.good : UI_COL.bad);
    checkUnlocks();
    checkBadges();
    requestSave();
  }

  function worldUnlocked(id) {
    return S.worldsSeen.includes(id) || S.pts >= WORLDS[id].need;
  }

  function checkUnlocks() {
    for (const id of WORLD_IDS) {
      if (!S.worldsSeen.includes(id) && S.pts >= WORLDS[id].need) {
        S.worldsSeen.push(id);
        const w = WORLDS[id];
        const col = COLLEGES[TOPICS[w.topic].college];
        Sound.sfx('unlock');
        Banner.show('Neue Buchwelt: „' + w.title + '“', 'College ' + col.num + ' · Regal „' + TOPICS[w.topic].name + '“', col.color, 2);
      }
    }
  }

  function checkBadges() {
    const st = S.stats;
    const rules = {
      erstes: st.returns >= 1, sortier: st.returns >= 8, spuer: S.searchDone.length >= 3,
      quiz: S.quizDone.length >= 5, ruhe: S.eventsDone.length >= 3, entdeck: S.visited.length >= 6,
      moby: S.worldsDone.includes('moby'), alice: S.worldsDone.includes('alice'),
    };
    for (const b of BADGES) {
      if (rules[b.id] && !S.badges.includes(b.id)) {
        S.badges.push(b.id);
        Sound.sfx('badge');
        Toast.show('Abzeichen erhalten: ' + b.name + '!', '#ffd977');
      }
    }
  }

  function requestSave() {
    saveT = 0.6;
  }

  function persist() {
    if (player && F) {
      S.x = Math.round(player.x);
      S.y = Math.round(player.y);
      S.floor = F.id;
    }
    Save.store(S);
  }

  // --- Rückgabe -------------------------------------------------------
  const bookById = (id) => RETURN_BOOKS.find((b) => b.id === id);

  function takeFromCart() {
    if (S.carrying) {
      const b = bookById(S.carrying);
      Dialog.open([narr('Du trägst schon „' + b.title + '“. Stell es zuerst ins richtige Regal!')]);
      return;
    }
    if (S.search) {
      Dialog.open([narr('Erledige zuerst deinen Suchauftrag – dann kannst du wieder Bücher einsortieren.')]);
      return;
    }
    let pool = RETURN_BOOKS.filter((b) => !S.returned.includes(b.id));
    if (!pool.length) {
      S.returned = [];
      pool = RETURN_BOOKS.slice();
    }
    let book;
    if (S.stats.returns === 0 && !S.returned.includes('r01')) {
      book = bookById('r01');
    } else {
      const here = pool.filter((b) => COLLEGES[TOPICS[b.topic].college].floor === F.id);
      const src = here.length && Math.random() < 0.7 ? here : pool;
      book = src[Math.floor(Math.random() * src.length)];
    }
    S.carrying = book.id;
    S.wrongTries = 0;
    Sound.sfx('pickup');
    Toast.show('Du trägst: ' + book.title, UI_COL.accent);
    requestSave();
  }

  function placeBook(shelf) {
    const book = bookById(S.carrying);
    if (!book) return;
    const cx = shelf.px + 16;
    const cy = shelf.py + 14;
    if (shelf.topic === book.topic) {
      S.carrying = null;
      S.stats.returns++;
      if (!S.returned.includes(book.id)) S.returned.push(book.id);
      Sound.sfx('correct');
      for (let i = 0; i < 10; i++) sparks.push({ x: cx + (Math.random() - 0.5) * 26, y: cy + (Math.random() - 0.5) * 20, t: 0, life: 0.6 + Math.random() * 0.4, col: '#fff3b0' });
      addPoints(10, 'Richtig einsortiert!', cx, cy - 10);
      if (S.tutorial === 1) {
        S.tutorial = 2;
        const nov = npcs.find((n) => n.id === 'novak');
        Dialog.open([
          narr('Perfekt! „' + book.title + '“ steht wieder am richtigen Platz.'),
          npcPage(nov.def, 'Super gemacht! (Frau Novak winkt von der Rückgabe.) Am Rückgabewagen warten noch mehr Bücher – auch einer im 3. OG.'),
          npcPage(nov.def, 'An den Info-Theken gibt es Suchaufträge und Quizfragen. Und wenn du 30 ★ sammelst, öffnet sich ein ganz besonderes Buch …'),
        ]);
      }
    } else {
      const sameCollege = TOPICS[shelf.topic].college === TOPICS[book.topic].college;
      S.stats.wrong++;
      S.wrongTries++;
      flying.push({ sx: cx, sy: cy - 4, ex: player.x, ey: player.y - 6, t: 0, dur: 0.65, col: COLLEGES[TOPICS[book.topic].college].color });
      Sound.sfx('whoosh');
      setTimeout(() => Sound.sfx('thud'), 600);
      addPoints(sameCollege ? -2 : -5, sameCollege ? 'Richtiges College, falsches Regal!' : 'Falsches College – das Buch springt heraus!', cx, cy - 10);
      if (S.wrongTries === 2) {
        const col = COLLEGES[TOPICS[book.topic].college];
        setTimeout(() => Toast.show('Tipp: Das gehört ins College ' + col.num + ' (' + col.colorName + ', ' + FLOOR_NAMES[col.floor] + ')', UI_COL.accent), 900);
      }
    }
    requestSave();
  }

  // --- Info-Theken: Suche & Quiz --------------------------------------
  function infoTalk(npc) {
    const d = npc.def;
    const pages = [];
    const menu = [];
    const s = S.search ? SEARCHES.find((x) => x.id === S.search) : null;
    if (s) {
      menu.push({ t: 'Tipp zum Suchauftrag', fn: () => Dialog.open([npcPage(d, 'Du suchst: ' + s.short + '. ' + s.hint)]) });
      menu.push({ t: 'Suchauftrag abbrechen', fn: () => { S.search = null; requestSave(); Dialog.open([npcPage(d, 'Kein Problem – vielleicht ein andermal!')]); } });
    } else {
      menu.push({ t: 'Suchauftrag', fn: () => giveSearch(d) });
    }
    menu.push({ t: 'Quizfrage', fn: () => askQuiz(d) });
    menu.push({ t: 'Tschüss!', fn: () => {} });
    pages.push(Object.assign(npcPage(d, d.greet), { choices: menu }));
    Dialog.open(pages);
  }

  function giveSearch(d) {
    if (S.carrying) {
      Dialog.open([npcPage(d, 'Bring zuerst das Buch zurück, das du gerade trägst. Dann hab ich einen Auftrag für dich!')]);
      return;
    }
    const s = SEARCHES.find((x) => !S.searchDone.includes(x.id));
    if (!s) {
      Dialog.open([npcPage(d, 'Du hast alle Suchaufträge erledigt – großartig! Du kennst dich hier richtig gut aus.')]);
      return;
    }
    S.search = s.id;
    Sound.sfx('pickup');
    requestSave();
    Dialog.open([npcPage(d, 'Ein Suchauftrag! ' + s.ask), npcPage(d, 'Tipp: ' + s.hint)]);
  }

  function askQuiz(d) {
    const open = QUIZ.filter((q) => !S.quizDone.includes(q.id));
    if (!open.length) {
      Dialog.open([npcPage(d, 'Du hast alle Quizfragen richtig beantwortet. Respekt – du bist ein echtes Bücherei-Ass!')]);
      return;
    }
    const q = open[quizPtr % open.length];
    quizPtr++;
    const choices = q.a.map((ans, i) => ({
      t: ans,
      fn: () => {
        if (i === q.ok) {
          S.quizDone.push(q.id);
          S.stats.quiz++;
          Sound.sfx('correct');
          addPoints(10, 'Richtig!', player.x, player.y - 20);
          Dialog.open([npcPage(d, 'Richtig! ' + q.ex)]);
        } else {
          Sound.sfx('wrong');
          Dialog.open([npcPage(d, 'Leider nicht. ' + q.ex + ' Frag mich später nochmal!')]);
        }
      },
    }));
    Dialog.open([Object.assign(npcPage(d, q.q), { choices })]);
  }

  // --- Verhaltens-Situationen ----------------------------------------
  function runEvent(npc) {
    const id = npc.def.event;
    const ev = EVENTS[id];
    const page = (who, t) => {
      if (!who) return narr(t);
      const n = npcs.find((a) => a.id === who);
      return npcPage(n ? n.def : null, t);
    };
    if (S.eventsDone.includes(id)) {
      Dialog.open(ev.done.map(([w, t]) => page(w, t)));
      return;
    }
    const pages = ev.intro.map(([w, t]) => page(w, t));
    pages.push(Object.assign(narr(ev.question), {
      choices: ev.choices.map((c) => ({
        t: c.t,
        fn: () => {
          const after = () => {
            if (c.good) {
              S.eventsDone.push(id);
              addPoints(c.pts, 'Gut gemacht!', npc.x, npc.y - 20);
              if (id === 'phone') npc.leaving = true;
            } else {
              addPoints(c.pts, 'Hmm, das geht besser …', npc.x, npc.y - 20);
              Toast.show('Tipp: Sprich nochmal mit ' + npc.name + ' – es gibt eine bessere Lösung.', UI_COL.accent);
            }
          };
          if (c.good) Sound.sfx('correct'); else Sound.sfx('wrong');
          Dialog.open(c.reply.map(([w, t]) => page(w, t)), after);
        },
      })),
    }));
    Dialog.open(pages);
  }

  // --- Interaktion -----------------------------------------------------
  function findTarget() {
    const d = DIRV[player.dir];
    const fx = player.x + d[0] * 12;
    const fy = player.y - 3 + d[1] * 13;
    for (const n of npcs) {
      if (n.hidden || n.floor !== F.id) continue;
      if (Math.abs(n.x - fx) < 10 && Math.abs(n.y - 4 - fy) < 11) return { kind: 'npc', npc: n };
    }
    const tx = Math.floor(fx / TS);
    const ty = Math.floor(fy / TS);
    if (tx < 0 || ty < 0 || tx >= F.w || ty >= F.h) return null;
    const i = ty * F.w + tx;
    const o = F.objAt.get(i);
    if (o) {
      if (o.npcAt) {
        const n = npcs.find((a) => !a.hidden && a.floor === F.id && Math.floor(a.x / TS) === o.npcAt[0] && Math.floor((a.y - 2) / TS) === o.npcAt[1]);
        if (n) return { kind: 'npc', npc: n, via: o };
      }
      return { kind: 'obj', obj: o };
    }
    const w = F.wallAt.get(i);
    if (w && player.dir === 'up') return { kind: 'obj', obj: w };
    return null;
  }

  function promptFor(t) {
    if (!t) return null;
    if (t.kind === 'npc') return 'Sprechen: ' + t.npc.name;
    const o = t.obj;
    switch (o.type) {
      case 'shelf': return (S.carrying ? 'Einstellen: ' : 'Regal: ') + TOPICS[o.topic].name;
      case 'cart': return 'Rückgabewagen';
      case 'lift': return 'Lift → ' + FLOOR_NAMES[F.id === '2' ? '3' : '2'];
      case 'wc': return 'WC';
      case 'sign': return 'Wegweiser College ' + COLLEGES[o.college].num;
      case 'mapboard': return 'Lageplan ansehen';
      case 'exit': return 'Ausgang';
      case 'chair': return F.id === '3' && o.tx === 57 && o.ty === 11 ? 'Lernplatz' : null;
      case 'lamp': return null;
      default: return OBJECT_TEXT[o.ch] ? 'Ansehen' : null;
    }
  }

  function interact(t) {
    if (!t) return;
    if (t.kind === 'npc') {
      const n = t.npc;
      if (n.wander) n.target = null;
      faceToward(n, player);
      if (n.def.role === 'info') return infoTalk(n);
      if (n.def.role === 'event') return runEvent(n);
      if (n.def.role === 'return') return novakTalk(n);
      const lines = n.def.lines || ['…'];
      const line = lines[n.lineIdx % lines.length];
      n.lineIdx++;
      Dialog.open([npcPage(n.def, line)]);
      return;
    }
    const o = t.obj;
    switch (o.type) {
      case 'shelf': return shelfInteract(o);
      case 'cart': return takeFromCart();
      case 'lift': return useLift(o);
      case 'wc': return Dialog.open([narr(OBJECT_TEXT.X)]);
      case 'exit': return Dialog.open([narr(OBJECT_TEXT.E)]);
      case 'mapboard': return onOpenMap();
      case 'sign': {
        const c = COLLEGES[o.college];
        const topics = Object.keys(TOPICS).filter((k) => TOPICS[k].college === o.college).map((k) => TOPICS[k].name);
        Dialog.open([narr('College ' + c.num + ' · ' + c.name + ' (' + c.colorName + ', ' + FLOOR_NAMES[c.floor] + ')'), narr('Hier findest du: ' + topics.join(', ') + '.')]);
        return;
      }
      case 'chair':
        if (F.id === '3' && o.tx === 57 && o.ty === 11) {
          const mira = npcs.find((n) => n.id === 'mira');
          if (!S.eventsDone.includes('seat')) return runEvent(mira);
          noise = 0;
          return Dialog.open([narr('Du setzt dich kurz an den Lernplatz und atmest durch. Herrlich ruhig hier!')]);
        }
        return Dialog.open([narr(OBJECT_TEXT.x)]);
      default:
        if (OBJECT_TEXT[o.ch]) Dialog.open([narr(OBJECT_TEXT[o.ch])]);
    }
  }

  function faceToward(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (a.sit) return;
    a.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
  }

  function novakTalk(n) {
    const d = n.def;
    if (S.tutorial === 0) {
      const pages = NOVAK_INTRO.map((t) => npcPage(d, t));
      Dialog.open(pages, () => {
        S.tutorial = 1;
        takeFromCart();
      });
      return;
    }
    if (S.carrying) {
      const b = bookById(S.carrying);
      const topic = TOPICS[b.topic];
      const extra = S.wrongTries >= 2 ? ' Kleiner Tipp: College ' + COLLEGES[topic.college].num + '!' : '';
      Dialog.open([npcPage(d, 'Du trägst noch „' + b.title + '“. Thema: ' + topic.name + '. Schau auf dem Lageplan [K] nach, in welchem College das steht!' + extra)]);
      return;
    }
    const tip = NOVAK_TIPS[Math.floor(Math.random() * NOVAK_TIPS.length)];
    Dialog.open([Object.assign(npcPage(d, tip), {
      choices: [
        { t: 'Ein Buch vom Rückgabewagen nehmen', fn: takeFromCart },
        { t: 'Danke, bis später!', fn: () => {} },
      ],
    })]);
  }

  function shelfInteract(o) {
    const topic = TOPICS[o.topic];
    const col = COLLEGES[topic.college];
    if (S.carrying) return placeBook(o);
    if (S.search) {
      const s = SEARCHES.find((x) => x.id === S.search);
      if (s && s.topic === o.topic) {
        S.search = null;
        S.searchDone.push(s.id);
        S.stats.searches++;
        Sound.sfx('correct');
        addPoints(15, 'Suchauftrag erledigt!', o.px + 16, o.py);
        Dialog.open([narr(s.found)]);
        return;
      }
    }
    if (o.world) {
      const w = WORLDS[o.world];
      if (worldUnlocked(o.world)) {
        Dialog.open([
          narr('Regal „' + topic.name + '“. Ein Buch leuchtet: „' + w.title + '“ von ' + w.author + ' (' + w.year + ').'),
          Object.assign(narr('Möchtest du in die Geschichte eintauchen?'), {
            choices: [
              { t: 'Eintauchen!', fn: () => onStartWorld(o.world) },
              { t: 'Später', fn: () => {} },
            ],
          }),
        ]);
      } else {
        Dialog.open([narr('Regal „' + topic.name + '“. Ein Buch schimmert geheimnisvoll: „' + w.title + '“ von ' + w.author + '.'),
          narr('Sammle ' + w.need + ' ★, um in seine Welt einzutauchen. Du hast ' + S.pts + ' ★.')]);
      }
      return;
    }
    Dialog.open([narr('Regal „' + topic.name + '“ – College ' + col.num + ' · ' + col.name + '.')]);
  }

  // --- Etagenwechsel -------------------------------------------------
  function useLift(o) {
    Sound.sfx('ding');
    changeFloor(F.id === '2' ? '3' : '2', (o.tx + 1) * TS, 2 * TS + 13, 'down');
  }

  function changeFloor(to, x, y, dir) {
    if (trans) return;
    trans = { t: 0, to, x, y, dir, switched: false };
  }

  // --- Update ---------------------------------------------------------
  function update(dt) {
    time += dt;
    if (saveT > 0) {
      saveT -= dt;
      if (saveT <= 0) persist();
    }
    if (trans) {
      trans.t += dt;
      if (!trans.switched && trans.t >= 0.25) {
        trans.switched = true;
        enterFloor(trans.to, trans.x, trans.y, trans.dir);
        Banner.show(FLOOR_NAMES[trans.to], trans.to === '2' ? 'College 1 · 2 · 3' : 'College 4 · 5 · 6', '#ead9b5');
        requestSave();
      }
      if (trans.t >= 0.5) trans = null;
      return;
    }

    // Spieler bewegen
    let mx = 0;
    let my = 0;
    if (Input.down('left')) mx -= 1;
    if (Input.down('right')) mx += 1;
    if (Input.down('up')) my -= 1;
    if (Input.down('down')) my += 1;
    const running = Input.down('run') && (mx || my);
    const speed = running ? 105 : 60;
    if (mx || my) {
      const len = Math.hypot(mx, my);
      const vx = (mx / len) * speed * dt;
      const vy = (my / len) * speed * dt;
      if (Math.abs(mx) > Math.abs(my) || (mx && !my)) player.dir = mx < 0 ? 'left' : 'right';
      else player.dir = my < 0 ? 'up' : 'down';
      const moved = moveActor(player, vx, vy);
      player.moving = moved;
      player.anim += dt * (running ? 12 : 8);
    } else {
      player.moving = false;
      player.anim = 0;
    }

    // Lautstärke
    const z = zoneAt(F.id, Math.floor(player.x / TS), Math.floor((player.y - 2) / TS));
    const quiet = z !== 'f' && z !== 'c';
    if (running && player.moving && quiet) noise = Math.min(100, noise + 55 * dt);
    else noise = Math.max(0, noise - 25 * dt);
    if (pssstCd > 0) pssstCd -= dt;
    if (noise >= 100 && pssstCd <= 0) {
      noise = 0;
      pssstCd = 2;
      Sound.sfx('pssst');
      let best = null;
      let bd = 1e9;
      for (const n of npcs) {
        if (n.hidden || n.floor !== F.id) continue;
        const dd = Math.hypot(n.x - player.x, n.y - player.y);
        if (dd < bd) { bd = dd; best = n; }
      }
      if (best && bd < 200) { best.bubble = 'Pssst!'; best.bubbleT = 1.6; }
      addPoints(-3, 'Pssst! Bitte nicht rennen – hier wird gelesen.', player.x, player.y - 22);
    }

    // Zone verfolgen
    if (z !== zone) {
      zone = z;
      const lab = ZONE_LABEL[F.id][z];
      if (COLLEGES[lab]) {
        const c = COLLEGES[lab];
        Banner.show('College ' + c.num, c.name, c.color);
        if (!S.visited.includes(lab)) {
          S.visited.push(lab);
          checkBadges();
          requestSave();
        }
      } else if (lab) {
        Banner.show(lab, '', '#ead9b5');
      }
    }

    // Treppen
    const ptx = Math.floor(player.x / TS);
    const pty = Math.floor((player.y - 3) / TS);
    const onStairs = F.raw(ptx, pty) === 'T';
    if (!onStairs) stairLock = false;
    if (onStairs && !stairLock) {
      let sx = ptx;
      while (F.raw(sx - 1, pty) === 'T') sx--;
      let sy = pty;
      while (F.raw(sx, sy - 1) === 'T') sy--;
      Sound.sfx('door');
      changeFloor(F.id === '2' ? '3' : '2', (sx + 1) * TS, (sy + 2) * TS + 13, 'down');
      return;
    }

    // NPCs
    for (const n of npcs) updateNpc(n, dt);

    // Interaktion
    target = findTarget();
    if (Input.hit('act') || Input.hit('jump')) {
      if (target) interact(target);
    }

    // Lenas Handy
    const lena = npcs.find((n) => n.id === 'lena');
    if (lena && !lena.hidden && !S.eventsDone.includes('phone') && F.id === lena.floor) {
      ringT -= dt;
      if (ringT <= 0) {
        ringT = 6;
        if (Math.hypot(lena.x - player.x, lena.y - player.y) < 160) {
          Sound.sfx('ring');
          lena.bubble = '♪';
          lena.bubbleT = 1.5;
        }
      }
    }

    // Partikel
    for (const f of flying) f.t += dt;
    flying = flying.filter((f) => f.t < f.dur);
    for (const s of sparks) s.t += dt;
    sparks = sparks.filter((s) => s.t < s.life);
    for (const sh of F.shelves) {
      if (sh.world && worldUnlocked(sh.world) && !S.worldsDone.includes(sh.world) && Math.random() < dt * 6) {
        sparks.push({ x: sh.px + 4 + Math.random() * 24, y: sh.py + 4 + Math.random() * 24, t: 0, life: 0.8, col: '#fff7c2' });
      }
    }

    // Kamera
    const tx2 = clamp(Math.round(player.x - VIEW_W / 2), 0, F.w * TS - VIEW_W);
    const ty2 = clamp(Math.round(player.y - 8 - VIEW_H / 2), 0, F.h * TS - VIEW_H);
    camX += (tx2 - camX) * Math.min(1, dt * 10);
    camY += (ty2 - camY) * Math.min(1, dt * 10);
    if (Math.abs(tx2 - camX) < 0.5) camX = tx2;
    if (Math.abs(ty2 - camY) < 0.5) camY = ty2;
  }

  function updateNpc(n, dt) {
    if (n.bubbleT > 0) {
      n.bubbleT -= dt;
      if (n.bubbleT <= 0) n.bubble = null;
    }
    if (n.leaving) {
      n.fade = (n.fade || 1) - dt * 0.8;
      if (n.fade <= 0) { n.hidden = true; n.leaving = false; }
      return;
    }
    if (!n.wander || n.hidden || n.floor !== F.id || Dialog.active()) {
      n.moving = false;
      return;
    }
    if (!n.target) {
      n.moving = false;
      n.wait -= dt;
      if (n.wait <= 0) {
        for (let k = 0; k < 8; k++) {
          const tx = Math.floor(n.homeX / TS) + Math.floor(Math.random() * 9) - 4;
          const ty = Math.floor(n.homeY / TS) + Math.floor(Math.random() * 5) - 2;
          if (tx > 0 && ty > 0 && tx < F.w && ty < F.h && F.solid[ty * F.w + tx] === 0 && F.raw(tx, ty) !== 'T') {
            n.target = [tx * TS + 8, ty * TS + 14];
            n.stuck = 0;
            break;
          }
        }
        n.wait = 2 + Math.random() * 4;
      }
      return;
    }
    const dx = n.target[0] - n.x;
    const dy = n.target[1] - n.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1.5) {
      n.target = null;
      n.moving = false;
      return;
    }
    const sp = 24 * dt;
    const vx = Math.abs(dx) > 0.5 ? Math.sign(dx) * Math.min(sp, Math.abs(dx)) : 0;
    const vy = Math.abs(dx) <= 0.5 && Math.abs(dy) > 0.5 ? Math.sign(dy) * Math.min(sp, Math.abs(dy)) : 0;
    if (vx) n.dir = vx < 0 ? 'left' : 'right';
    else if (vy) n.dir = vy < 0 ? 'up' : 'down';
    const ok = moveActor(n, vx, vy);
    n.moving = ok;
    n.anim += dt * 6;
    if (!ok) {
      n.stuck += dt;
      if (n.stuck > 0.8) n.target = null;
    }
  }

  // --- Zeichnen ------------------------------------------------------
  function drawActor(g, a, ox, oy) {
    const frames = a.spr[a.dir];
    const f = a.moving ? frames[Math.floor(a.anim) % 4] : frames[0];
    const sitOff = a.sit ? 4 : 0;
    const x = Math.round(a.x - 8 - ox);
    const y = Math.round(a.y - 15 - oy + sitOff);
    if (!a.sit) {
      g.fillStyle = 'rgba(30,15,20,0.25)';
      g.fillRect(x + 3, Math.round(a.y - oy) - 1, 10, 2);
      g.fillRect(x + 4, Math.round(a.y - oy) - 2, 8, 1);
    }
    if (a.fade !== undefined && a.fade < 1) g.globalAlpha = Math.max(0, a.fade);
    g.drawImage(f, x, y);
    g.globalAlpha = 1;
  }

  function draw(g) {
    const ox = Math.round(camX);
    const oy = Math.round(camY);
    g.drawImage(F.layer, ox, oy, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);
    const items = [];
    for (const o of F.objects) {
      if (!o.img) continue;
      if (o.px + o.img.width < ox - 8 || o.px > ox + VIEW_W + 8 || o.py > oy + VIEW_H + 8 || o.py + o.img.height < oy - 8) continue;
      items.push({ y: o.sortY, fn: () => g.drawImage(o.img, o.px + (o.dx || 0) - ox, o.py - oy) });
    }
    for (const n of npcs) {
      if (n.hidden || n.floor !== F.id) continue;
      items.push({ y: n.y, fn: () => drawActor(g, n, ox, oy) });
    }
    items.push({ y: player.y + 0.5, fn: () => drawActor(g, player, ox, oy) });
    // Rucksack auf Miras Nachbarsessel
    if (F.id === '3' && !S.eventsDone.includes('seat')) {
      items.push({ y: 11 * TS + 7, fn: () => g.drawImage(ITEM_SPRITES.backpack, 57 * TS + 4 - ox, 11 * TS + 2 - oy) });
    }
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.fn();

    // Leckereien & Symbole über NPCs
    for (const n of npcs) {
      if (n.hidden || n.floor !== F.id) continue;
      const bx = n.x - ox;
      const by = n.y - 16 - oy + (n.sit ? 4 : 0);
      if (n.id === 'gruber' && !S.eventsDone.includes('food')) g.drawImage(ITEM_SPRITES.burger, Math.round(bx + 5), Math.round(by + 8));
      if (n.bubble) drawBubble(g, bx, by, n.bubble, n.bubble === '♪' ? '#7b3fa0' : '#b8453a');
      else if ((n.id === 'novak' && S.tutorial === 0) || (n.def.role === 'event' && !S.eventsDone.includes(n.def.event))) {
        if (Math.floor(time * 2) % 2 === 0 || n.id === 'novak') drawBubble(g, bx, by - Math.round(Math.sin(time * 4)), '!', '#b8453a');
      }
    }
    // Leuchtende Buchwelt-Regale
    for (const sh of F.shelves) {
      if (sh.world && worldUnlocked(sh.world) && !S.worldsDone.includes(sh.world)) {
        const a = 0.35 + 0.25 * Math.sin(time * 4);
        g.fillStyle = `rgba(255,240,170,${a})`;
        g.fillRect(sh.px + 3 - ox, sh.py + 5 - oy, 26, 1);
        g.fillRect(sh.px + 3 - ox, sh.py + 29 - oy, 26, 1);
        drawBubble(g, sh.px + 16 - ox, sh.py - 1 - oy + Math.round(Math.sin(time * 3)), '★', '#c98f1c');
      }
    }
    for (const s of sparks) {
      const k = 1 - s.t / s.life;
      g.globalAlpha = k;
      rect(g, Math.round(s.x - ox), Math.round(s.y - oy - s.t * 10), 1, 1, s.col);
      if (k > 0.5) {
        rect(g, Math.round(s.x - ox) - 1, Math.round(s.y - oy - s.t * 10), 3, 1, s.col);
        rect(g, Math.round(s.x - ox), Math.round(s.y - oy - s.t * 10) - 1, 1, 3, s.col);
      }
    }
    g.globalAlpha = 1;
    // Fliegende Bücher
    for (const f of flying) {
      const k = f.t / f.dur;
      const x = lerp(f.sx, f.ex, k) - ox;
      const y = lerp(f.sy, f.ey, k) - Math.sin(k * Math.PI) * 34 - oy;
      g.save();
      g.translate(Math.round(x), Math.round(y));
      g.rotate(k * Math.PI * 3);
      g.drawImage(bookIcon(f.col), -6, -4);
      g.restore();
    }
    Floaters.draw(g, ox, oy);
    drawHud(g);
    if (trans) {
      const a = trans.t < 0.25 ? trans.t / 0.25 : 1 - (trans.t - 0.25) / 0.25;
      g.fillStyle = `rgba(12,8,14,${clamp(a, 0, 1)})`;
      g.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  function objective() {
    if (S.tutorial === 0) return 'Sprich mit Frau Novak an der Ausleihe/Rückgabe.';
    if (S.carrying) {
      const b = bookById(S.carrying);
      const t = TOPICS[b.topic];
      const hint = S.wrongTries >= 2 ? ' (College ' + COLLEGES[t.college].num + ')' : '';
      return 'Bring es zum Regal „' + t.name + '“' + hint + '.';
    }
    if (S.search) {
      const s = SEARCHES.find((x) => x.id === S.search);
      return 'Suche: ' + s.short + '.';
    }
    for (const id of WORLD_IDS) {
      const w = WORLDS[id];
      if (S.worldsDone.includes(id)) continue;
      const col = COLLEGES[TOPICS[w.topic].college];
      if (worldUnlocked(id)) return '„' + w.title + '“ wartet im College ' + col.num + ' (' + FLOOR_NAMES[col.floor] + '), Regal „' + TOPICS[w.topic].name + '“.';
      return 'Sammle ' + w.need + ' ★ für die Buchwelt „' + w.title + '“.';
    }
    return 'Alle Buchwelten erlebt! Sammle weiter Punkte und Abzeichen.';
  }

  function drawHud(g) {
    // Punkte
    const pw = Font.measure(String(S.pts)) + 24;
    drawPanel(g, 4, 4, pw, 15);
    Font.draw(g, '★', 10, 6, '#ffd24a');
    Font.draw(g, String(S.pts), 20, 6, UI_COL.text);
    // Lautstärke
    if (noise > 1) {
      drawPanel(g, 4, 21, 52, 11);
      Font.draw(g, '♪', 8, 21, noise > 70 ? UI_COL.bad : UI_COL.dim);
      rect(g, 16, 25, 36, 3, '#3d3242');
      rect(g, 16, 25, Math.round(36 * noise / 100), 3, noise > 70 ? '#ff6b5b' : noise > 40 ? '#ffc95b' : '#8ee07a');
    }
    // Etage & Bereich
    const lab = ZONE_LABEL[F.id][zone];
    const zt = COLLEGES[lab] ? 'College ' + COLLEGES[lab].num : ZONE_SHORT[zone] || '';
    const top = FLOOR_NAMES[F.id] + (zt ? ' · ' + zt : '');
    const tw = Font.measure(top) + 14;
    drawPanel(g, VIEW_W - tw - 4, 4, tw, 15);
    if (COLLEGES[lab]) rect(g, VIEW_W - tw + 1, 8, 4, 7, COLLEGES[lab].color);
    Font.draw(g, top, VIEW_W - tw + 8, 6, UI_COL.text);
    if (Dialog.active()) return;
    // Ziel (mit getragenem Buch)
    const lines = Font.wrap(objective(), 360);
    let book = null;
    if (S.carrying) book = bookById(S.carrying);
    const rows = lines.length + (book ? 1 : 0);
    const oh = rows * Font.LINE + 4;
    let ow = Math.max(...lines.map((l) => Font.measure(l)));
    if (book) ow = Math.max(ow, Font.measure(book.title) + 16);
    const oy = VIEW_H - oh - 4;
    g.fillStyle = 'rgba(20,14,22,0.7)';
    g.fillRect(4, oy, ow + 12, oh);
    let ly = oy + 1;
    if (book) {
      const col = COLLEGES[TOPICS[book.topic].college];
      g.drawImage(bookIcon(S.wrongTries >= 2 ? col.color : '#c9b48a'), 8, ly + 1);
      Font.draw(g, book.title, 23, ly, '#ffffff');
      ly += Font.LINE;
    }
    lines.forEach((l, i) => Font.draw(g, l, 9, ly + i * Font.LINE, book ? UI_COL.accent : '#f1e6cf'));
    // Interaktionshinweis
    const p = promptFor(target);
    if (p) {
      const w = Font.measure(p) + 26;
      const x = Math.round((VIEW_W - w) / 2);
      const y = oy - 19;
      drawPanel(g, x, y, w, 15, 'rgba(30,22,34,0.93)', '#ffd977');
      drawPanel(g, x + 3, y + 2, 13, 11, '#ffd977', '#ffd977');
      Font.draw(g, 'E', x + 7, y + 2, '#2b1d1f');
      Font.draw(g, p, x + 20, y + 2, UI_COL.text);
    }
  }

  // Für Lageplan-Ansicht
  function miniInfo() {
    return { floors, playerFloor: F ? F.id : '2', px: player ? player.x : 0, py: player ? player.y : 0 };
  }

  return {
    init, start, update, draw, persist, addPoints, checkBadges, requestSave, miniInfo,
    get floor() { return F; },
    get player() { return player; },
    setPlayer(x, y, dir) { player.x = x; player.y = y; if (dir) player.dir = dir; snapCamera(); },
    debugTarget: () => target,
  };
})();

// ===================================================================
// Buchwelten – gemeinsame Teile: Buchseiten-Karte
// ===================================================================
const StoryCard = (() => {
  let pages = null;
  let idx = 0;
  let t = 0;
  let onDone = null;

  function show(p, done) {
    pages = p;
    idx = 0;
    t = 0;
    onDone = done || null;
  }

  function update(dt) {
    if (!pages) return false;
    t += dt;
    if (t > 0.35 && Input.confirm()) {
      Sound.sfx('blip');
      idx++;
      t = 0;
      if (idx >= pages.length) {
        pages = null;
        const d = onDone;
        onDone = null;
        if (d) d();
      }
    }
    return true;
  }

  function draw(g) {
    if (!pages) return;
    const p = pages[idx];
    rect(g, 0, 0, VIEW_W, VIEW_H, p.bg || '#1b1420');
    for (let i = 0; i < 40; i++) {
      const r = makeRng(i * 97);
      rect(g, Math.floor(r() * VIEW_W), Math.floor(r() * VIEW_H), 1, 1, 'rgba(255,240,200,0.25)');
    }
    // Aufgeschlagenes Buch
    const bx = 22;
    const by = 14;
    const bw = 340;
    const bh = 186;
    rect(g, bx - 4, by + 2, bw + 8, bh + 4, '#5a2b1f');
    rect(g, bx - 4, by + bh + 2, bw + 8, 4, '#3a1b13');
    rect(g, bx, by, bw / 2, bh, '#f4ead2');
    rect(g, bx + bw / 2, by, bw / 2, bh, '#f7efdb');
    rect(g, bx + bw / 2 - 3, by, 3, bh, '#d8c8a4');
    rect(g, bx + bw / 2, by, 2, bh, '#e7dbbe');
    for (let i = 0; i < 3; i++) rect(g, bx + 2 + i, by + bh - 1 - i, bw / 2 - 4, 1, '#e2d4b4');
    // linke Seite: Titel
    const lx = bx + bw / 4;
    if (p.icon) p.icon(g, lx, by + 104);
    Font.drawCentered(g, p.title, lx, by + 18, '#5a2b1f', null, p.title.length > 12 ? 1 : 2);
    if (p.sub) Font.drawCentered(g, p.sub, lx, by + (p.title.length > 12 ? 32 : 42), '#8a5a3a');
    // rechte Seite: Text
    const lines = Font.wrap(p.text, bw / 2 - 26);
    let ty = by + 14;
    for (const l of lines) {
      Font.draw(g, l, bx + bw / 2 + 12, ty, '#3a2a22');
      ty += Font.LINE;
    }
    if (Math.floor(t * 2.5) % 2 === 0 && t > 0.35) Font.draw(g, '▶', bx + bw - 14, by + bh - 14, '#8a5a3a');
    Font.draw(g, (idx + 1) + '/' + pages.length, bx + bw / 2 + 12, by + bh - 14, '#b39a76');
  }

  function close() {
    pages = null;
    onDone = null;
  }

  return { show, update, draw, close, active: () => !!pages };
})();

// --- Meeres-Sprites --------------------------------------------------
function whaleInside(x, y) {
  if (x >= 1 && x <= 17 && y >= 3 && y <= 15) return !(x <= 2 && (y <= 4 || y >= 14));
  if (x > 17 && x <= 37) {
    const k = (x - 17) / 20;
    const top = 3 + k * 5 - (x >= 23 && x <= 27 ? 1 : 0);
    const bot = 15 - k * 4;
    return y >= top && y <= bot;
  }
  if (x > 37 && x <= 40) return y >= 8 && y <= 11;
  if (x > 40 && x <= 44) {
    const s = x - 40;
    return (y >= 8 - s * 1.4 && y <= 9) || (y >= 10 && y <= 11 + s * 1.2);
  }
  return false;
}

function makeWhale(c1, c2, c3, scars) {
  const spr = maskSprite(45, 18, whaleInside, (x, y) => (y < 7 ? c1 : y < 12 ? c2 : c3));
  const g = spr.getContext('2d');
  rect(g, 5, 11, 2, 1, '#1c1820');
  rect(g, 3, 13, 12, 1, shade(c3, -0.35));
  if (scars) {
    for (const [x, y, l] of [[9, 5, 4], [20, 7, 5], [28, 8, 3], [12, 9, 3]]) rect(g, x, y, l, 1, '#b9b2a6');
  }
  return spr;
}

const SEA_SPR = {
  moby: makeWhale('#fbf8f1', '#e6e0d4', '#cbc3b5', true),
  whale: makeWhale('#66707f', '#535c6a', '#434a56', false),
  ghost: maskSprite(45, 18, whaleInside, () => '#6a8296', '#566e82'),
  dolphin: maskSprite(18, 9, (x, y) => {
    const dx = (x - 9) / 7.5;
    const dy = (y - 5) / 2.4;
    if (dx * dx + dy * dy <= 1) return true;
    if (x <= 2 && (y === 5 || y === 6)) return true;
    if (x >= 9 && x <= 11 && y >= 1 && y <= 3 && x - 9 <= 3 - y) return true;
    if (x >= 16 && (y === 2 || y === 3 || y === 7 || y === 8)) return true;
    return false;
  }, (x, y) => (y < 5 ? '#6d8fb0' : '#a9c2d6')),
  ship: (() => {
    const c = makeCanvas(26, 22);
    const g = c.getContext('2d');
    rect(g, 2, 16, 22, 4, '#3b2a24');
    rect(g, 4, 20, 18, 1, '#3b2a24');
    for (const [x, h] of [[7, 14], [13, 16], [19, 12]]) {
      rect(g, x, 16 - h, 1, h, '#3b2a24');
      rect(g, x - 3, 18 - h, 7, Math.floor(h * 0.55), '#efe6d2');
    }
    return c;
  })(),
};

function cloudSprite(seed) {
  const r = makeRng(seed);
  const c = makeCanvas(60, 22);
  const g = c.getContext('2d');
  const blobs = [];
  for (let i = 0; i < 6; i++) blobs.push([10 + r() * 40, 10 + r() * 6, 5 + r() * 6]);
  for (const [bx, by, rad] of blobs) {
    for (let y = -10; y <= 10; y++) for (let x = -12; x <= 12; x++) {
      if (x * x + y * y <= rad * rad) px(g, Math.round(bx + x), Math.round(by + y), y > 2 ? '#dbe9f2' : '#ffffff');
    }
  }
  return c;
}
const CLOUDS = [cloudSprite(1), cloudSprite(2), cloudSprite(3)];

function drawSky(g, t, horizon, camX = 0, top = '#78b9de', bottom = '#d6eef6') {
  const bands = 10;
  for (let i = 0; i < bands; i++) {
    const y0 = Math.floor((horizon * i) / bands);
    const y1 = Math.floor((horizon * (i + 1)) / bands);
    rect(g, 0, y0, VIEW_W, y1 - y0, mixHex(top, bottom, i / (bands - 1)));
  }
  for (let i = 0; i < 4; i++) {
    const cx = ((i * 140 - camX * 0.15 + t * (4 + i)) % (VIEW_W + 80) + VIEW_W + 80) % (VIEW_W + 80) - 70;
    g.drawImage(CLOUDS[i % 3], Math.round(cx), 10 + i * 13);
  }
}

function drawSea(g, t, horizon, camX = 0, deep = '#1f5c85', light = '#4e9cc9') {
  const h = VIEW_H - horizon;
  const bands = 8;
  for (let i = 0; i < bands; i++) {
    const y0 = horizon + Math.floor((h * i) / bands);
    const y1 = horizon + Math.floor((h * (i + 1)) / bands);
    rect(g, 0, y0, VIEW_W, y1 - y0, mixHex(light, deep, i / (bands - 1)));
  }
  rect(g, 0, horizon, VIEW_W, 1, '#cfe8f2');
  for (let row = 0; row < 12; row++) {
    const y = horizon + 4 + row * row * 0.9 + row * 3;
    if (y > VIEW_H) break;
    const spacing = 26 + row * 6;
    const len = 3 + row;
    const off = (t * (6 + row * 2) - camX * (0.2 + row * 0.04)) % spacing;
    for (let x = -spacing + off + (row % 2) * 9; x < VIEW_W; x += spacing) {
      rect(g, Math.round(x), Math.round(y), len, 1, row < 4 ? '#a9d6ea' : '#7fbfdd');
    }
  }
}

// ===================================================================
// Buchwelt 1: Moby Dick
// ===================================================================
const MobyWorld = (() => {
  const W = 768;
  const DECK = 158;
  let phase = 'deck';
  let t = 0;
  let p = null;
  let npcs = [];
  let ahabDone = false;
  let climbing = false;
  let msg = null;
  let onExit = null;
  let firstTime = true;
  let camX = 0;
  // Ausguck
  let spy = { x: 192, y: 128 };
  let creatures = [];
  let parts = [];
  let lookT = 0;
  let spawnT = 0;
  let mobyTimes = [];
  let callCd = 0;
  let found = false;
  let result = null;
  let breach = null;

  const looks = {
    ismael: mkLook('short', 'brown', 'light', '#3c5a7a', '#5b4636', 'cap'),
    ahab: mkLook('short', 'grey', 'light', '#2b2d42', '#2b2d42', 'hat+beard+pegleg'),
    queequeg: mkLook('short', 'black', 'brown', '#7a4a2a', '#3d3a2a', 'tattoo'),
    starbuck: mkLook('short', 'brown', 'tan', '#5b6b3a', '#3d3a2a', 'beard'),
  };
  const NPC_DEF = {
    queequeg: { name: 'Queequeg', look: looks.queequeg, lines: [
      'Ismael, mein Freund! Seit wir uns in New Bedford ein Zimmer geteilt haben, fahren wir gemeinsam zur See.',
      'Meine Harpune ist bereit. Aber der Kapitän … er sucht nicht irgendeinen Wal.',
    ] },
    starbuck: { name: 'Starbuck', look: looks.starbuck, lines: [
      'Ich bin Starbuck, der Erste Steuermann der Pequod.',
      'Wir sind Walfänger, keine Rächer. Doch Kapitän Ahab denkt nur noch an einen einzigen Wal. Pass auf dich auf, Ismael.',
    ] },
    ahab: { name: 'Kapitän Ahab', look: looks.ahab },
  };

  const platforms = [
    { x: 236, w: 16, top: DECK - 14 }, { x: 252, w: 16, top: DECK - 14 }, { x: 244, w: 16, top: DECK - 28 },
    { x: 300, w: 16, top: DECK - 14 }, { x: 520, w: 16, top: DECK - 14 },
  ];

  function groundAt(x) {
    let gy = DECK;
    if (x >= 616) gy = DECK - 14;
    else if (x >= 600) gy = DECK - 7;
    return gy;
  }

  function enter(exitCb, first) {
    onExit = exitCb;
    firstTime = first;
    phase = 'intro';
    t = 0;
    ahabDone = false;
    climbing = false;
    msg = null;
    found = false;
    result = null;
    breach = null;
    p = { x: 90, y: DECK, vx: 0, vy: 0, ground: true, dir: 'right', anim: 0, spr: charSprites(looks.ismael) };
    npcs = [
      { id: 'queequeg', x: 150, y: DECK, dir: 'right', idx: 0 },
      { id: 'ahab', x: 430, y: DECK, dir: 'left', idx: 0 },
      { id: 'starbuck', x: 640, y: DECK - 14, dir: 'left', idx: 0 },
    ];
    for (const n of npcs) n.spr = charSprites(NPC_DEF[n.id].look);
    Sound.play('shanty');
    Sound.ambience('sea');
    StoryCard.show([
      { title: 'Moby Dick', sub: 'Herman Melville · 1851', text: '„Nennt mich Ismael.“\n\nIch habe auf dem Walfänger Pequod angeheuert. Seit Tagen sind wir auf See – doch unser Kapitän hat sich noch kein einziges Mal an Deck gezeigt …', icon: drawWhaleIcon },
      { title: 'Moby Dick', sub: 'Kapitel: Das Achterdeck', text: 'Heute aber lässt Kapitän Ahab die ganze Mannschaft zusammenrufen.\n\nSprich mit den Leuten an Deck – und dann mit Ahab am Großmast.\n\n←→ gehen · Leertaste springen · E sprechen', icon: drawWhaleIcon },
    ], () => { phase = 'deck'; });
  }

  function drawWhaleIcon(g, x, y) {
    g.drawImage(SEA_SPR.moby, x - 45, y - 18, 90, 36);
    for (let i = 0; i < 6; i++) rect(g, x - 34 + i * 2, y - 22 - (i % 3) * 3, 1, 3, '#7fbfdd');
  }

  function exitWorld() {
    Sound.ambience(null);
    onExit(result);
  }

  // --- Deck ---------------------------------------------------------
  function talk(n) {
    const d = NPC_DEF[n.id];
    if (n.id === 'ahab') {
      if (!ahabDone) {
        const page = (tx) => npcPage(d, tx);
        Dialog.open([
          page('Männer! Alle Mann an Deck! Seht her!'),
          page('Diese Goldmünze ist eine spanische Dublone – sechzehn Dollar wert!'),
          page('Wer mir als Erster einen weißköpfigen Wal mit runzliger Stirn und schiefem Kiefer meldet, dem gehört sie!'),
          page('Es ist Moby Dick – der weiße Wal, der mir mein Bein genommen hat. Dieses Bein aus Walknochen erinnert mich jeden Tag an ihn.'),
          narr('*Tock! Tock!* Ahab nagelt die Dublone an den Großmast.'),
          page('Du da, Ismael! Hinauf in den Mastkorb – und halte die Augen offen!'),
        ], () => {
          ahabDone = true;
          Sound.sfx('nail');
          setTimeout(() => Sound.sfx('coin'), 380);
          msg = { text: 'Klettere am Großmast hinauf: stell dich davor und drück ↑', t: 4 };
        });
      } else {
        Dialog.open([npcPage(d, 'Was stehst du noch hier? Hinauf mit dir! Der Wal wartet nicht.')]);
      }
      return;
    }
    const line = d.lines[n.idx % d.lines.length];
    n.idx++;
    Dialog.open([npcPage(d, line)]);
  }

  function updateDeck(dt) {
    if (climbing) {
      p.y -= 55 * dt;
      p.anim += dt * 8;
      if (p.y <= 46) {
        climbing = false;
        startLookout();
      }
      return;
    }
    let mx = 0;
    if (Input.down('left')) mx -= 1;
    if (Input.down('right')) mx += 1;
    p.vx = mx * 72;
    if (mx) p.dir = mx < 0 ? 'left' : 'right';
    if ((Input.hit('jump') || Input.hit('tjump')) && p.ground) {
      p.vy = -215;
      p.ground = false;
      Sound.sfx('jump');
    }
    p.x = clamp(p.x + p.vx * dt, 48, 732);
    const oldY = p.y;
    p.vy += 640 * dt;
    p.y += p.vy * dt;
    let floorY = groundAt(p.x);
    if (p.vy >= 0) {
      for (const pl of platforms) {
        if (p.x > pl.x - 3 && p.x < pl.x + pl.w + 3 && oldY <= pl.top + 0.5 && p.y >= pl.top) floorY = Math.min(floorY, pl.top);
      }
    }
    if (p.y >= floorY) {
      p.y = floorY;
      p.vy = 0;
      p.ground = true;
    } else {
      p.ground = false;
    }
    p.anim = mx ? p.anim + dt * 9 : 0;

    // Gespräche
    let near = null;
    for (const n of npcs) if (Math.abs(n.x - p.x) < 20 && Math.abs(n.y - p.y) < 16) near = n;
    if (near && Input.hit('act')) {
      near.dir = p.x < near.x ? 'left' : 'right';
      talk(near);
    }
    // Mast
    const atMast = Math.abs(p.x - 400) < 10 && p.ground;
    if (atMast && Input.hit('up')) {
      if (!ahabDone) msg = { text: 'Erst einmal hören, was der Kapitän zu sagen hat …', t: 2.5 };
      else {
        climbing = true;
        p.x = 400;
        Sound.sfx('jump');
      }
    }
    if (msg) {
      msg.t -= dt;
      if (msg.t <= 0) msg = null;
    }
    camX = clamp(Math.round(p.x - VIEW_W / 2), 0, W - VIEW_W);
  }

  function drawDeck(g) {
    const rock = Math.round(Math.sin(t * 0.9) * 2);
    const horizon = 108;
    drawSky(g, t, horizon, camX);
    drawSea(g, t, horizon, camX);
    const ox = camX;
    const oy = rock;
    // Masten & Segel (hinter dem Deck)
    for (const [mx, top] of [[170, -10], [400, -40], [650, 0]]) {
      const x = mx - ox;
      rect(g, x - 3, top + oy, 6, DECK - top, '#5a3a24');
      rect(g, x - 3, top + oy, 2, DECK - top, '#7a5236');
      for (const [yy, w] of [[top + 30, 70], [top + 78, 84]]) {
        if (mx === 650 && yy > 120) continue;
        rect(g, x - w / 2, yy + oy, w, 3, '#4a2e1c');
        const sh = 40;
        for (let i = 0; i < sh; i++) {
          const bulge = Math.round(Math.sin((i / sh) * Math.PI) * 4);
          rect(g, x - w / 2 + 3 - bulge, yy + 3 + i + oy, w - 6 + bulge * 2, 1, i % 9 === 0 ? '#ddd2b8' : '#f1e8d2');
        }
      }
    }
    // Takelage
    g.fillStyle = '#3b2a20';
    for (const [x1, y1, x2, y2] of [[400, -40, 60, DECK - 6], [400, -40, 740, DECK - 20], [170, -10, 40, DECK - 6], [650, 0, 750, DECK - 20]]) {
      const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1));
      for (let i = 0; i < steps; i++) {
        const k = i / steps;
        g.fillRect(Math.round(lerp(x1, x2, k) - ox), Math.round(lerp(y1, y2, k) + oy), 1, 1);
      }
    }
    // Mastkorb
    rect(g, 400 - 12 - ox, 34 + oy, 24, 8, '#4a2e1c');
    rect(g, 400 - 12 - ox, 34 + oy, 24, 2, '#7a5236');
    // Dublone am Mast
    if (ahabDone) {
      g.drawImage(ITEM_SPRITES.coin, 400 - 4 - ox, 118 + oy);
      if (Math.floor(t * 4) % 3 === 0) rect(g, 400 + 3 - ox, 117 + oy, 1, 1, '#ffffff');
    }
    // Rumpf
    rect(g, 20 - ox, DECK + oy, 730, 34, '#5b3420');
    for (let y = 0; y < 34; y += 5) rect(g, 20 - ox, DECK + y + oy, 730, 1, '#4a2a19');
    rect(g, 20 - ox, DECK + oy, 730, 3, '#8a5a36');
    rect(g, 600 - ox, DECK - 14 + oy, 150, 14, '#5b3420');
    rect(g, 600 - ox, DECK - 14 + oy, 150, 2, '#8a5a36');
    rect(g, 600 - ox, DECK - 7 + oy, 16, 7, '#6b4128');
    for (let i = 0; i < 10; i++) rect(g, 20 + 8 + i * 70 - ox, DECK + 12 + oy, 6, 6, '#2a1a12');
    // Bug
    for (let i = 0; i < 24; i++) rect(g, 20 - i - ox, DECK - 8 + Math.floor(i / 3) + oy, 1, 30 - Math.floor(i / 2), '#5b3420');
    rect(g, -20 - ox, DECK - 16 + oy, 44, 2, '#5a3a24');
    // Reling
    for (let x = 30; x < 600; x += 12) rect(g, x - ox, DECK - 12 + oy, 2, 12, '#6b4128');
    rect(g, 30 - ox, DECK - 13 + oy, 570, 2, '#8a5a36');
    for (let x = 606; x < 748; x += 12) rect(g, x - ox, DECK - 26 + oy, 2, 12, '#6b4128');
    rect(g, 606 - ox, DECK - 27 + oy, 142, 2, '#8a5a36');
    // Fässer & Kisten
    for (const pl of platforms) {
      const x = pl.x - ox;
      const y = pl.top + oy;
      if (pl.x === 244) {
        rect(g, x, y, 16, 14, PAL.k);
        rect(g, x + 1, y + 1, 14, 12, '#a36a3c');
        rect(g, x + 1, y + 6, 14, 1, '#6b4128');
        continue;
      }
      rect(g, x + 1, y, 14, 14, PAL.k);
      rect(g, x + 2, y + 1, 12, 12, '#8a5a36');
      rect(g, x + 2, y + 3, 12, 1, '#55575e');
      rect(g, x + 2, y + 10, 12, 1, '#55575e');
      rect(g, x + 4, y + 1, 2, 12, '#9c6a42');
    }
    // Steuerrad
    const wx = 715 - ox;
    const wy = DECK - 32 + oy;
    for (let a = 0; a < 8; a++) {
      const ang = a * Math.PI / 4 + t * 0.2;
      for (let r = 0; r < 9; r++) rect(g, Math.round(wx + Math.cos(ang) * r), Math.round(wy + Math.sin(ang) * r), 1, 1, '#6b4128');
    }
    rect(g, wx - 1, wy, 3, 18, '#5a3a24');
    // Figuren
    const drawSide = (a) => {
      const set = a.spr[a.dir === 'left' ? 'left' : a.dir === 'right' ? 'right' : a.dir];
      const moving = a === p && (Math.abs(p.vx) > 0 || climbing);
      const fr = climbing ? a.spr.up[Math.floor(p.anim) % 4] : moving ? set[Math.floor(a.anim) % 4] : set[0];
      g.drawImage(fr, Math.round(a.x - 8 - ox), Math.round(a.y - 15 + oy));
    };
    for (const n of npcs) {
      drawSide(n);
      if (n.id === 'queequeg') {
        rect(g, n.x + 7 - ox, n.y - 22 + oy, 1, 22, '#6b4128');
        rect(g, n.x + 6 - ox, n.y - 25 + oy, 3, 3, '#c9cfd6');
      }
      if (n.id === 'ahab' && !ahabDone && Math.floor(t * 2) % 2 === 0) drawBubble(g, n.x - ox, n.y - 16 + oy, '!', '#b8453a');
    }
    drawSide(p);
    // Vordere Wellen (durchgehende Wellenbänder)
    const bands = [[DECK + 24, '#3d8cc0', '#a9dcef', 0.07, 2.2], [DECK + 33, '#2f78ad', '#8fcbe6', 0.09, 2.6], [DECK + 44, '#245f8f', '#7fbfdd', 0.11, 3]];
    bands.forEach(([base, col, hi, f, amp], i) => {
      for (let x = 0; x < VIEW_W; x++) {
        const wx = x + camX * (0.95 + i * 0.05);
        const top = Math.round(base + Math.sin(wx * f + t * (1.6 + i * 0.4)) * amp + Math.sin(wx * f * 2.3 - t) * 1);
        rect(g, x, top, 1, VIEW_H - top, col);
        rect(g, x, top, 1, 1, hi);
      }
    });
    // HUD
    drawPanel(g, 4, 4, 86, 15);
    Font.draw(g, 'Moby Dick', 10, 6, '#ffd977');
    const obj = !ahabDone ? 'Sprich mit Kapitän Ahab am Großmast.' : 'Klettere am Großmast hinauf (↑).';
    const near = npcs.find((n) => Math.abs(n.x - p.x) < 20 && Math.abs(n.y - p.y) < 16);
    if (!Dialog.active()) {
      g.fillStyle = 'rgba(20,14,22,0.62)';
      g.fillRect(4, VIEW_H - 15, Font.measure(obj) + 10, 12);
      Font.draw(g, obj, 9, VIEW_H - 14, '#f1e6cf');
      let prompt = near ? 'Sprechen: ' + NPC_DEF[near.id].name : Math.abs(p.x - 400) < 10 && ahabDone ? 'Hinaufklettern (↑)' : null;
      if (prompt) {
        const w = Font.measure(prompt) + 26;
        const x = Math.round((VIEW_W - w) / 2);
        drawPanel(g, x, VIEW_H - 36, w, 15, 'rgba(30,22,34,0.93)', '#ffd977');
        drawPanel(g, x + 3, VIEW_H - 34, 13, 11, '#ffd977', '#ffd977');
        Font.draw(g, near ? 'E' : '↑', x + 7, VIEW_H - 34, '#2b1d1f');
        Font.draw(g, prompt, x + 20, VIEW_H - 34, UI_COL.text);
      }
      if (msg) {
        const w = Font.measure(msg.text) + 16;
        drawPanel(g, (VIEW_W - w) / 2, 24, w, 15);
        Font.draw(g, msg.text, (VIEW_W - w) / 2 + 8, 26, UI_COL.text);
      }
    }
  }

  // --- Ausguck -------------------------------------------------------
  function startLookout() {
    phase = 'lookout';
    lookT = 0;
    spawnT = 1;
    creatures = [];
    parts = [];
    callCd = 0;
    spy = { x: 192, y: 128 };
    mobyTimes = [12 + Math.random() * 4, 33 + Math.random() * 4, 54 + Math.random() * 4];
    msg = { text: '←→↑↓ Fernrohr bewegen · E: „Da bläst er!“ rufen', t: 5 };
  }

  function spawn(type) {
    const c = { type, x: 40 + Math.random() * 300, y: 110 + Math.random() * 60, t: 0, rise: 0.7, stay: 3 + Math.random() * 3, spoutT: 0.4, dir: Math.random() < 0.5 ? -1 : 1 };
    if (type === 'moby') c.stay = 6.5;
    if (type === 'gull') { c.y = 28 + Math.random() * 50; c.x = c.dir > 0 ? -12 : VIEW_W + 12; c.stay = 99; }
    if (type === 'ship') { c.y = 100; c.x = Math.random() * 300 + 30; c.stay = 12; }
    if (type === 'dolphin') { c.stay = 1.6; c.rise = 0; }
    if (type === 'whale' || type === 'moby') {
      for (let k = 0; k < 6; k++) {
        const clash = creatures.some((o) => (o.type === 'whale' || o.type === 'moby') && Math.abs(o.x - c.x) < 60 && Math.abs(o.y - c.y) < 22);
        if (!clash) break;
        c.x = 40 + Math.random() * 300;
        c.y = 110 + Math.random() * 60;
      }
    }
    creatures.push(c);
  }

  function visibleFrac(c) {
    if (c.type === 'gull' || c.type === 'ship' || c.type === 'dolphin') return 1;
    if (c.t < c.rise) return c.t / c.rise;
    if (c.t < c.rise + c.stay) return 1;
    return Math.max(0, 1 - (c.t - c.rise - c.stay) / 0.7);
  }

  function updateLookout(dt) {
    lookT += dt;
    if (callCd > 0) callCd -= dt;
    if (msg) {
      msg.t -= dt;
      if (msg.t <= 0) msg = null;
    }
    if (breach) return updateBreach(dt);
    const sp = 120 * dt;
    if (Input.down('left')) spy.x -= sp;
    if (Input.down('right')) spy.x += sp;
    if (Input.down('up')) spy.y -= sp;
    if (Input.down('down')) spy.y += sp;
    spy.x = clamp(spy.x, 24, VIEW_W - 24);
    spy.y = clamp(spy.y, 40, 176);
    spawnT -= dt;
    if (spawnT <= 0) {
      spawnT = 1.8 + Math.random() * 1.6;
      const n = creatures.filter((c) => c.type !== 'gull').length;
      if (n < 5) {
        const r = Math.random();
        spawn(r < 0.48 ? 'whale' : r < 0.72 ? 'dolphin' : r < 0.9 ? 'gull' : 'ship');
      }
    }
    if (mobyTimes.length && lookT >= mobyTimes[0]) {
      mobyTimes.shift();
      spawn('moby');
    }
    for (const c of creatures) {
      c.t += dt;
      if (c.type === 'gull') c.x += c.dir * 30 * dt;
      if (c.type === 'ship') c.x += c.dir * 3 * dt;
      if (c.type === 'dolphin') c.x += c.dir * 50 * dt;
      if ((c.type === 'whale' || c.type === 'moby') && c.t > c.rise && c.t < c.rise + c.stay) {
        c.x += c.dir * 4 * dt;
        c.spoutT -= dt;
        if (c.spoutT <= 0) {
          c.spoutT = 1.6 + Math.random();
          const bx = c.x + (c.dir < 0 ? -18 : 18);
          for (let i = 0; i < 16; i++) parts.push({ x: bx + (Math.random() - 0.5) * 3, y: c.y - 10, vx: (Math.random() - 0.5) * 18, vy: -55 - Math.random() * 35, t: 0, life: 1 });
          if (Math.hypot(c.x - spy.x, c.y - spy.y) < 90) Sound.sfx('spout');
        }
      }
    }
    creatures = creatures.filter((c) => {
      if (c.type === 'gull') return c.x > -20 && c.x < VIEW_W + 20;
      if (c.type === 'dolphin') return c.t < 1.6;
      return c.t < c.rise + c.stay + 0.8;
    });
    for (const q of parts) {
      q.t += dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vy += 120 * dt;
    }
    parts = parts.filter((q) => q.t < q.life);

    if (Input.hitAny('act', 'jump', 'tjump') && callCd <= 0) {
      callCd = 1;
      Sound.sfx('call');
      let hit = null;
      let best = 1e9;
      for (const c of creatures) {
        const vf = visibleFrac(c);
        if (vf < 0.3) continue;
        const cy = c.type === 'whale' || c.type === 'moby' ? c.y - 5 : c.y;
        const d = Math.hypot(c.x - spy.x, cy - spy.y);
        const rad = c.type === 'whale' || c.type === 'moby' ? 30 : 18;
        if (d < rad && (d < best || c.type === 'moby')) {
          if (hit && hit.type === 'moby') continue;
          hit = c;
          best = d;
        }
      }
      if (hit && hit.type === 'moby') {
        found = true;
        result = { world: 'moby', pts: 30, how: 'found' };
        breach = { t: 0, x: hit.x, y: hit.y };
        hit.t = 999;
        Sound.sfx('splash');
        msg = { text: '„Da bläst er! Ein Buckel wie ein Schneeberg – es ist Moby Dick!“', t: 4 };
      } else if (hit && hit.type === 'whale') {
        msg = { text: 'Ahab (von unten): „Das ist ein gewöhnlicher Pottwal! Den weißen, Ismael!“  −2 ★', t: 3 };
        Sound.sfx('wrong');
        Library.addPoints(-2, null);
      } else if (hit && hit.type === 'dolphin') {
        msg = { text: 'Nur ein paar Delfine.', t: 2 };
      } else if (hit && hit.type === 'ship') {
        msg = { text: 'Ein anderes Walfangschiff am Horizont.', t: 2 };
      } else if (hit && hit.type === 'gull') {
        msg = { text: 'Eine Möwe. Hübsch – aber kein Wal.', t: 2 };
      } else {
        msg = { text: 'Nur Wasser und Wellen …', t: 2 };
      }
    }
    if (!found && !mobyTimes.length && !creatures.some((c) => c.type === 'moby') && lookT > 30) {
      result = { world: 'moby', pts: 15, how: 'ahab' };
      breach = { t: 0, x: 280, y: 140, ahab: true };
      Sound.sfx('splash');
      msg = { text: 'Ahab ruft selbst: „Da bläst er! Es ist Moby Dick!“', t: 4 };
    }
  }

  function updateBreach(dt) {
    breach.t += dt;
    if (breach.t > 0.9 && breach.t - dt <= 0.9) Sound.sfx('splash');
    for (const q of parts) {
      q.t += dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vy += 140 * dt;
    }
    parts = parts.filter((q) => q.t < q.life);
    if (breach.t < 1.4 && Math.random() < 0.6) {
      for (let i = 0; i < 4; i++) parts.push({ x: breach.x + (Math.random() - 0.5) * 50, y: breach.y, vx: (Math.random() - 0.5) * 60, vy: -40 - Math.random() * 80, t: 0, life: 1.1 });
    }
    if (breach.t > 3.2 && phase === 'lookout') {
      phase = 'outro';
      const ahab = result.how === 'ahab';
      const pages = [
        { title: ahab ? 'Da bläst er!' : 'Gesichtet!', sub: 'Moby Dick', icon: drawWhaleIcon,
          text: ahab
            ? 'Diesmal war Ahab schneller: Er hat den weißen Wal selbst entdeckt – und die Dublone behält er.\n\nGenau so passiert es übrigens auch im Buch: Ahab sichtet Moby Dick als Erster.'
            : 'Du hast Moby Dick als Erster gesichtet – die Dublone gehört dir!\n\nIm Buch ist es übrigens Ahab selbst, der den weißen Wal zuerst entdeckt.' },
        { title: 'Wie geht es weiter?', sub: 'Herman Melville', icon: drawWhaleIcon,
          text: 'Die große Jagd auf den weißen Wal beginnt erst … Wie sie ausgeht, erzählt Herman Melville im Buch.\n\nKlassiker wie „Moby Dick“ findest du in der Bücherei im College 1 bei der Literatur.' + (firstTime ? '\n\n+' + result.pts + ' ★ und ein neues Abzeichen!' : '') },
      ];
      StoryCard.show(pages, exitWorld);
    }
  }

  function drawCreature(g, c, mode) {
    const vf = visibleFrac(c);
    if (vf <= 0) return;
    if (c.type === 'gull') {
      const f = ITEM_SPRITES.gull[Math.floor(c.t * 6) % 2];
      g.drawImage(f, Math.round(c.x - 4), Math.round(c.y));
      return;
    }
    if (c.type === 'ship') {
      g.globalAlpha = mode === 'far' ? 0.55 : 1;
      g.drawImage(SEA_SPR.ship, Math.round(c.x - 13), Math.round(c.y - 20));
      g.globalAlpha = 1;
      return;
    }
    if (c.type === 'dolphin') {
      const k = c.t / 1.6;
      const yy = c.y - Math.sin(k * Math.PI) * 16;
      g.save();
      g.translate(Math.round(c.x), Math.round(yy));
      if (c.dir > 0) g.scale(-1, 1);
      g.rotate((k - 0.5) * 1.2 * -1);
      g.drawImage(mode === 'far' ? SEA_SPR.ghost : SEA_SPR.dolphin, -9, -4, 18, 9);
      g.restore();
      return;
    }
    const spr = mode === 'far' ? SEA_SPR.ghost : c.type === 'moby' ? SEA_SPR.moby : SEA_SPR.whale;
    const visH = Math.round(10 * vf);
    if (visH <= 0) return;
    const sx = Math.round(c.x - 22);
    const sy = Math.round(c.y - visH);
    g.save();
    if (c.dir > 0) {
      g.translate(sx + 45, 0);
      g.scale(-1, 1);
      g.drawImage(spr, 0, 0, 45, visH, 0, sy, 45, visH);
    } else {
      g.drawImage(spr, 0, 0, 45, visH, sx, sy, 45, visH);
    }
    g.restore();
    rect(g, sx - 2, Math.round(c.y), 49, 1, '#d8eef6');
  }

  function drawSeaScene(g, mode) {
    drawSky(g, t, 96, 0, '#86c3e4', '#e2f2f7');
    drawSea(g, t, 96, 0, '#1d5a83', '#5aa6cf');
    for (const c of creatures) drawCreature(g, c, mode);
    for (const q of parts) {
      g.globalAlpha = 1 - q.t / q.life;
      rect(g, Math.round(q.x), Math.round(q.y), 1, 2, '#f2fbff');
    }
    g.globalAlpha = 1;
  }

  function drawLookout(g) {
    drawSeaScene(g, 'far');
    // Dunst
    g.fillStyle = 'rgba(214,232,242,0.42)';
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    // Fernrohr: vergrößerte, klare Ansicht
    const R = 30;
    g.save();
    g.beginPath();
    g.arc(Math.round(spy.x), Math.round(spy.y), R, 0, TAU);
    g.clip();
    g.translate(spy.x, spy.y);
    g.scale(1.6, 1.6);
    g.translate(-spy.x, -spy.y);
    drawSeaScene(g, 'near');
    g.restore();
    for (let a = 0; a < 360; a += 2) {
      const r1 = a * Math.PI / 180;
      rect(g, Math.round(spy.x + Math.cos(r1) * (R + 1)), Math.round(spy.y + Math.sin(r1) * (R + 1)), 2, 2, '#6b4a1e');
      rect(g, Math.round(spy.x + Math.cos(r1) * R), Math.round(spy.y + Math.sin(r1) * R), 1, 1, '#d9b24a');
    }
    // Breach
    if (breach && !breach.ahab) {
      const k = clamp(breach.t / 1.8, 0, 1);
      const x = breach.x;
      const y = breach.y - Math.sin(k * Math.PI) * 60;
      g.save();
      g.translate(Math.round(x), Math.round(y));
      g.rotate((k - 0.5) * 1.4);
      g.drawImage(SEA_SPR.moby, -45, -18, 90, 36);
      g.restore();
    }
    if (breach && breach.ahab) {
      const k = clamp(breach.t / 1.8, 0, 1);
      g.save();
      g.translate(breach.x, breach.y - Math.sin(k * Math.PI) * 40);
      g.rotate((k - 0.5) * 1.2);
      g.drawImage(SEA_SPR.moby, -45, -18, 90, 36);
      g.restore();
    }
    for (const q of parts) {
      if (!breach) break;
      g.globalAlpha = 1 - q.t / q.life;
      rect(g, Math.round(q.x), Math.round(q.y), 2, 2, '#ffffff');
    }
    g.globalAlpha = 1;
    // Mastkorb-Rand
    rect(g, 0, VIEW_H - 22, VIEW_W, 22, '#5a3a24');
    rect(g, 0, VIEW_H - 22, VIEW_W, 3, '#8a5a36');
    for (let x = 0; x < VIEW_W; x += 24) rect(g, x, VIEW_H - 19, 2, 19, '#4a2e1c');
    // HUD
    drawPanel(g, 4, 4, 120, 15);
    Font.draw(g, 'Ausguck · Moby Dick', 10, 6, '#ffd977');
    const left = Math.max(0, 1 - lookT / 64);
    drawPanel(g, VIEW_W - 108, 4, 104, 15);
    Font.draw(g, 'Ahab', VIEW_W - 102, 6, UI_COL.dim);
    rect(g, VIEW_W - 76, 10, 66, 3, '#3d3242');
    rect(g, VIEW_W - 76, 10, Math.round(66 * left), 3, left < 0.3 ? '#ff6b5b' : '#ffd977');
    if (msg) {
      const lines = Font.wrap(msg.text, 340);
      const h = lines.length * Font.LINE + 6;
      drawPanel(g, 18, VIEW_H - 22 - h - 4, 348, h);
      lines.forEach((l, i) => Font.draw(g, l, 26, VIEW_H - 22 - h - 1 + i * Font.LINE, UI_COL.text));
    }
  }

  function update(dt) {
    t += dt;
    if (StoryCard.update(dt)) return;
    if (phase === 'deck') updateDeck(dt);
    else if (phase === 'lookout') updateLookout(dt);
  }

  function draw(g) {
    if (phase === 'intro' || (phase === 'outro' && StoryCard.active())) {
      StoryCard.draw(g);
      return;
    }
    if (phase === 'deck') drawDeck(g);
    else if (phase === 'lookout') drawLookout(g);
    if (StoryCard.active()) StoryCard.draw(g);
  }

  return { enter, update, draw, debug: () => ({ phase, spy, creatures, p }) };
})();

// ===================================================================
// Buchwelt 2: Alice im Wunderland – der Sturz in den Kaninchenbau
// ===================================================================
const ALICE_SPR = (() => {
  const map = { 1: '#f0cd66', 2: '#c79f43', 3: '#5b9bd5', 4: '#3f74a8', 7: '#f5cba8', 8: '#dca27e', m: '#c0605a' };
  const fall = buildSprite([
    '..kk...11...kk..',
    '.k77k.k11k.k77k.',
    '.k73kk1111kk37k.',
    '..k3k111111k3k..',
    '..k3k1kkkk1k3k..',
    '...kk177771kk...',
    '....k7e77e7k....',
    '....k77mm77k....',
    '.....kk77kk.....',
    '....k33ww33k....',
    '...k333ww333k...',
    '...k34wwww43k...',
    '..k334wwww433k..',
    '.k3334wwww4333k.',
    'k33334wwww43333k',
    'k3333wwwwww3333k',
    '.kwwwwwwwwwwwwk.',
    '..kkkkkkkkkkkk..',
    '....kwwk.kwwk...',
    '....kwwk.kwwk...',
    '...kkkk...kkkk..',
    '................',
  ], map);
  const rabbit = buildSprite([
    '.....kk.kk......',
    '....kwk.kwk.....',
    '....kwk.kmk.....',
    '....kwkkkwk.....',
    '...kwwwwwwk.....',
    '..kwwwwwmwk.....',
    '..kwwwwwwwwk....',
    '...kwwwwwwk.....',
    '..krrrrrrk......',
    '.kwrrxrrrrk.....',
    '.kwrrrrrrwk.....',
    '..krrrrrrk......',
    '..kwwkkwwk......',
    '.kwwk..kwwk.....',
    '.kkk....kkk.....',
    '................',
  ], { m: '#ec86b2' });
  return { fall, rabbit, rabbitL: flipCanvas(rabbit) };
})();

const AliceWorld = (() => {
  let phase = 'intro';
  let t = 0;
  let fallT = 0;
  const FALL_TIME = 38;
  let depth = 0;
  let speed = 60;
  let ax = 192;
  let items = [];
  let walls = [];
  let deco = [];
  let got = 0;
  let hurt = 0;
  let jarSeen = false;
  let bookSeen = false;
  let msg = null;
  let landT = 0;
  let onExit = null;
  let firstTime = true;
  let spawnY = 0;
  let onResult = null;

  function enter(exitCb, first) {
    onExit = exitCb;
    firstTime = first;
    phase = 'intro';
    t = 0;
    fallT = 0;
    depth = 0;
    speed = 60;
    ax = 192;
    items = [];
    walls = [];
    deco = [];
    got = 0;
    hurt = 0;
    jarSeen = false;
    bookSeen = false;
    msg = null;
    landT = 0;
    spawnY = 0;
    Sound.play('waltz');
    StoryCard.show([
      { title: 'Alice', sub: 'Lewis Carroll · 1865', icon: drawRabbitIcon, text: 'Alice sitzt mit ihrer Schwester am Ufer und langweilt sich: Was nützt ein Buch ohne Bilder und Gespräche?\n\nDa hoppelt ein weißes Kaninchen mit rosa Augen vorbei, zieht eine Taschenuhr aus der Weste und murmelt: „Oje, oje! Ich komme zu spät!“' },
      { title: 'Alice', sub: 'Hinunter in den Kaninchenbau', icon: drawRabbitIcon, text: 'Neugierig rennt Alice hinterher – und springt in den Kaninchenbau. Er wird zu einem tiefen, tiefen Schacht …\n\n←→ lenken · Sammle Taschenuhren, Gläser und Bücher · Weiche den Regalbrettern aus!' },
    ], () => { phase = 'fall'; });
    for (let y = 0; y < VIEW_H + 60; y += 60) addRow(y);
    spawnY = VIEW_H + 60;
  }

  function drawRabbitIcon(g, x, y) {
    g.drawImage(ALICE_SPR.rabbit, x - 24, y - 30, 48, 48);
  }

  function addRow(y) {
    const r = Math.random;
    for (const side of [0, 1]) {
      const kinds = ['shelf', 'cupboard', 'map', 'picture'];
      deco.push({ side, y: y + r() * 30, kind: kinds[Math.floor(r() * kinds.length)], seed: Math.floor(r() * 1000) });
    }
  }

  function spawnStuff() {
    const r = Math.random();
    if (fallT > 2 && r < 0.42) {
      const side = Math.random() < 0.5 ? 0 : 1;
      const len = 50 + Math.random() * 70;
      walls.push({ side, y: VIEW_H + 20, len });
    } else {
      const kind = r < 0.68 ? 'watch' : r < 0.84 ? 'jar' : 'book';
      items.push({ kind, x: 90 + Math.random() * 204, y: VIEW_H + 12, t: Math.random() * 6 });
    }
  }

  function update(dt) {
    t += dt;
    if (StoryCard.update(dt)) return;
    if (msg) {
      msg.t -= dt;
      if (msg.t <= 0) msg = null;
    }
    if (phase === 'fall') updateFall(dt);
    else if (phase === 'land') updateLand(dt);
  }

  function updateFall(dt) {
    fallT += dt;
    speed = 60 + Math.min(50, fallT * 1.6);
    const dy = speed * dt;
    depth += dy;
    let mx = 0;
    if (Input.down('left')) mx -= 1;
    if (Input.down('right')) mx += 1;
    ax = clamp(ax + mx * 110 * dt, 86, 298);
    if (hurt > 0) hurt -= dt;
    for (const d of deco) d.y -= dy;
    deco = deco.filter((d) => d.y > -70);
    spawnY -= dy;
    while (spawnY < VIEW_H + 60) {
      addRow(spawnY);
      spawnY += 60;
    }
    for (const it of items) { it.y -= dy; it.t += dt; }
    for (const w of walls) w.y -= dy;
    if (fallT < FALL_TIME - 3) {
      if (Math.random() < dt * 1.6) spawnStuff();
    }
    // Einsammeln
    for (const it of items) {
      if (it.got) continue;
      if (Math.abs(it.x - ax) < 12 && Math.abs(it.y - 86) < 14) {
        it.got = true;
        got++;
        Sound.sfx('coin');
        if (it.kind === 'jar' && !jarSeen) {
          jarSeen = true;
          msg = { text: 'Ein Glas mit der Aufschrift „ORANGENMARMELADE“ – leider leer!', t: 3 };
        } else if (it.kind === 'book' && !bookSeen) {
          bookSeen = true;
          msg = { text: 'Ein Buch! Hoffentlich mit Bildern und Gesprächen …', t: 3 };
        }
      }
    }
    items = items.filter((it) => !it.got && it.y > -20);
    // Regalbretter
    for (const w of walls) {
      if (w.hit) continue;
      const x0 = w.side === 0 ? 72 : 312 - w.len;
      const x1 = w.side === 0 ? 72 + w.len : 312;
      if (ax + 6 > x0 && ax - 6 < x1 && Math.abs(w.y - 84) < 9 && hurt <= 0) {
        w.hit = true;
        hurt = 1.1;
        Sound.sfx('ouch');
        if (got > 0) got--;
        msg = { text: 'Autsch! Ein Regalbrett!', t: 1.5 };
      }
    }
    walls = walls.filter((w) => w.y > -20);
    if (fallT >= FALL_TIME) {
      phase = 'land';
      landT = 0;
      Sound.sfx('thud');
    }
  }

  function updateLand(dt) {
    landT += dt;
    if (landT > 1.2 && landT - dt <= 1.2) {
      msg = { text: 'Das weiße Kaninchen: „Bei meinen Ohren und Schnurrhaaren, wie spät es schon ist!“', t: 4 };
      Sound.sfx('talk');
    }
    if (landT > 5.2 && phase === 'land') {
      phase = 'outro';
      const pts = 20 + Math.min(10, got);
      onResult = { world: 'alice', pts, how: 'done' };
      StoryCard.show([
        { title: 'Plumps!', sub: 'Alice im Wunderland', icon: drawRabbitIcon, text: 'Alice landet weich auf einem Haufen Zweige und trockener Blätter. Du hast ' + got + ' Dinge im Fallen eingesammelt.\n\nUnten findet Alice einen Saal voller Türen, einen winzigen goldenen Schlüssel – und ein Fläschchen mit der Aufschrift „TRINK MICH“.' },
        { title: 'Wie geht es weiter?', sub: 'Lewis Carroll', icon: drawRabbitIcon, text: 'Was Alice im Wunderland alles erlebt, liest du am besten selbst!\n\nKinderbuch-Klassiker wie diesen findest du im Kirango, dem Kinderplaneten.' + (firstTime ? '\n\n+' + pts + ' ★ und ein neues Abzeichen!' : '') },
      ], () => onExit(onResult));
    }
  }

  function drawWalls(g) {
    // Tunnelwände
    rect(g, 0, 0, VIEW_W, VIEW_H, '#2a1c16');
    rect(g, 72, 0, 240, VIEW_H, '#1a120e');
    for (let i = 0; i < 18; i++) {
      const y = ((i * 37 - depth * 0.6) % 240 + 240) % 240 - 20;
      rect(g, 90 + (i * 53) % 200, Math.round(y), 2, 1, '#3a2a20');
    }
    for (const side of [0, 1]) {
      const x = side === 0 ? 0 : 312;
      rect(g, x, 0, 72, VIEW_H, '#5a3d2b');
      for (let i = 0; i < 10; i++) {
        const y = ((i * 29 - depth) % 290 + 290) % 290 - 20;
        rect(g, x + (i * 17) % 60, Math.round(y), 8, 2, '#6b4a34');
      }
      rect(g, side === 0 ? 70 : 312, 0, 2, VIEW_H, '#2a1c16');
    }
    for (const d of deco) {
      const x = d.side === 0 ? 8 : 320;
      const y = Math.round(d.y);
      const r = makeRng(d.seed);
      if (d.kind === 'shelf') {
        rect(g, x, y, 56, 22, PAL.k);
        rect(g, x + 1, y + 1, 54, 20, '#6e4426');
        fillCompartment(g, x + 2, y + 2, 52, 8, 'books', r);
        rect(g, x + 2, y + 10, 52, 1, '#a8703f');
        fillCompartment(g, x + 2, y + 12, 52, 8, 'books', r);
      } else if (d.kind === 'cupboard') {
        rect(g, x + 6, y, 44, 30, PAL.k);
        rect(g, x + 7, y + 1, 42, 28, '#8a5a32');
        rect(g, x + 27, y + 1, 1, 28, PAL.k);
        rect(g, x + 24, y + 13, 2, 3, '#d9b24a');
        rect(g, x + 29, y + 13, 2, 3, '#d9b24a');
      } else if (d.kind === 'map') {
        rect(g, x + 4, y, 48, 30, PAL.k);
        rect(g, x + 5, y + 1, 46, 28, '#efe3c2');
        for (let i = 0; i < 5; i++) rect(g, x + 8 + r() * 30, y + 5 + r() * 18, 6 + r() * 10, 4 + r() * 4, '#9cc58a');
        rect(g, x + 5, y + 14, 46, 1, '#7fb3d5');
      } else {
        rect(g, x + 12, y, 32, 26, '#d9a441');
        rect(g, x + 15, y + 3, 26, 20, '#7fb3d5');
        rect(g, x + 22, y + 9, 10, 10, '#f5cba8');
        rect(g, x + 20, y + 7, 14, 3, '#5a3a24');
      }
    }
    for (const w of walls) {
      const y = Math.round(w.y);
      const x0 = w.side === 0 ? 72 : 312 - w.len;
      rect(g, x0, y - 3, w.len, 7, PAL.k);
      rect(g, x0 + (w.side ? 1 : 0), y - 2, w.len - 1, 4, '#b07a48');
      rect(g, x0 + (w.side ? 1 : 0), y - 2, w.len - 1, 1, '#d6a06a');
      const r = makeRng(Math.floor(w.len * 10));
      for (let bx = x0 + 3; bx < x0 + w.len - 4; bx += 3) rect(g, bx, y - 9, 2, 6 + Math.floor(r() * 2) - 1, pick(SPINES, r));
    }
  }

  function draw(g) {
    if (phase === 'intro' || (phase === 'outro' && StoryCard.active())) {
      StoryCard.draw(g);
      return;
    }
    drawWalls(g);
    for (const it of items) {
      const spr = it.kind === 'watch' ? ITEM_SPRITES.watch : it.kind === 'jar' ? ITEM_SPRITES.jar : bookIcon('#7b52a6');
      const bob = Math.round(Math.sin(it.t * 3) * 2);
      g.drawImage(spr, Math.round(it.x - spr.width / 2), Math.round(it.y - spr.height / 2 + bob));
    }
    if (phase === 'fall') {
      if (hurt <= 0 || Math.floor(hurt * 12) % 2 === 0) {
        const wob = Math.round(Math.sin(t * 6) * 1);
        g.drawImage(ALICE_SPR.fall, Math.round(ax - 16), 64 + wob, 32, 44);
      }
      // Haare/Wind-Streifen
      for (let i = 0; i < 6; i++) {
        const sx = 90 + ((i * 41 + Math.floor(t * 30)) % 200);
        const sy = ((i * 47 - t * 260) % 216 + 216) % 216;
        rect(g, sx, Math.round(sy), 1, 10, 'rgba(255,255,255,0.18)');
      }
    }
    if (phase === 'land') {
      // Blätterhaufen und Kaninchen
      rect(g, 72, 168, 240, 48, '#3a2a1c');
      for (let i = 0; i < 60; i++) {
        const r = makeRng(i);
        rect(g, 90 + Math.floor(r() * 200), 150 + Math.floor(r() * 24), 4, 2, pick(['#c0703a', '#d9a441', '#8a5a32', '#6b8f3a'], r));
      }
      const ay = Math.min(140, 64 + landT * 260);
      g.drawImage(ALICE_SPR.fall, Math.round(ax - 16), Math.round(ay), 32, 44);
      if (landT > 1.0) {
        const rx = 60 + (landT - 1.0) * 70;
        g.drawImage(ALICE_SPR.rabbit, Math.round(rx), 146, 32, 32);
        if (Math.floor(t * 4) % 2 === 0) g.drawImage(ITEM_SPRITES.watch, Math.round(rx) + 26, 154);
      }
    }
    // HUD
    drawPanel(g, 4, 4, 126, 15);
    Font.draw(g, 'Alice im Wunderland', 10, 6, '#ffd977');
    drawPanel(g, VIEW_W - 64, 4, 60, 15);
    g.drawImage(ITEM_SPRITES.watch, VIEW_W - 58, 7);
    Font.draw(g, '× ' + got, VIEW_W - 46, 6, UI_COL.text);
    const prog = clamp(fallT / FALL_TIME, 0, 1);
    rect(g, VIEW_W - 8, 26, 3, 160, '#3d3242');
    rect(g, VIEW_W - 8, 26, 3, Math.round(160 * prog), '#ffd977');
    if (msg) {
      const lines = Font.wrap(msg.text, 300);
      const h = lines.length * Font.LINE + 6;
      drawPanel(g, 40, VIEW_H - h - 8, 304, h);
      lines.forEach((l, i) => Font.draw(g, l, 48, VIEW_H - h - 5 + i * Font.LINE, UI_COL.text));
    }
    if (StoryCard.active()) StoryCard.draw(g);
  }

  return { enter, update, draw, debug: () => ({ phase, fallT, got }) };
})();

// ===================================================================
// Bildschirme: Titel, Lageplan, Pausenmenü, Abzeichen, Steuerung
// ===================================================================
function drawMenuList(g, items, sel, x, y, w, color = UI_COL.text) {
  items.forEach((it, i) => {
    const on = i === sel;
    const yy = y + i * 14;
    if (on) {
      rect(g, x, yy - 2, w, 13, 'rgba(255,217,119,0.18)');
      Font.draw(g, '▶', x + 4, yy, UI_COL.title);
    }
    Font.draw(g, it, x + 14, yy, on ? UI_COL.title : color);
  });
}

const CONTROLS_TEXT = [
  ['Pfeiltasten / WASD', 'gehen'],
  ['Shift (halten)', 'rennen – macht aber Lärm!'],
  ['E / Enter / Leertaste', 'sprechen, Regal benutzen, weiter'],
  ['K', 'Lageplan öffnen'],
  ['M', 'Musik an/aus'],
  ['Esc / P', 'Menü'],
  ['In Buchwelten', 'Leertaste springen · E sprechen · ↑ klettern'],
  ['Touch', 'Steuerkreuz · A = Aktion · B = rennen/springen'],
];

function drawControls(g, title = 'Steuerung') {
  drawPanel(g, 24, 16, 336, 184);
  Font.drawCentered(g, title, VIEW_W / 2, 24, UI_COL.title, '#1a1220', 2);
  CONTROLS_TEXT.forEach(([k, v], i) => {
    const y = 52 + i * 17;
    drawPanel(g, 34, y - 3, Font.measure(k) + 10, 14, '#4a3a55', '#8f7a99');
    Font.draw(g, k, 39, y - 1, '#ffffff');
    Font.draw(g, v, 46 + Font.measure(k) + 8, y - 1, UI_COL.text);
  });
  Font.drawCentered(g, 'Weiter mit E / Enter', VIEW_W / 2, 186, UI_COL.dim);
}

// --- Lageplan ---------------------------------------------------------
const MapView = (() => {
  const SC = 3;
  const plans = {};
  let sel = 0;
  let t = 0;
  const PLAN_COL = { c1: '#f2d64b', c2: '#e0453f', c3: '#a3a3a3', c4: '#f39232', c5: '#3f86d8', c6: '#4cb050' };

  function buildPlan(F) {
    const c = makeCanvas(F.w * SC, F.h * SC);
    const g = c.getContext('2d');
    for (let y = 0; y < F.h; y++) {
      for (let x = 0; x < F.w; x++) {
        const ch = F.raw(x, y);
        if (ch === ' ') continue;
        let col;
        if (F.isWall(x, y)) col = ch === 'L' ? '#ffffff' : '#2b2230';
        else {
          const z = zoneAt(F.id, x, y);
          const cid = ZONE_COLLEGE[z];
          col = cid ? PLAN_COL[cid] : '#f4efe2';
          if (ch === 'S') col = shade(col, -0.28);
          else if (ch === 'T') col = (x + y) % 2 ? '#6b6b6b' : '#ffffff';
          else if (!'fchyrgobnV'.includes(ch)) col = shade(col, -0.12);
        }
        rect(g, x * SC, y * SC, SC, SC, col);
      }
    }
    // Markierungen: Info (i), Lift (L), WC
    const mark = (tx, ty, text, bg) => {
      const w = Font.measure(text) + 4;
      rect(g, tx * SC - 1, ty * SC - 3, w, 10, bg);
      Font.draw(g, text, tx * SC + 1, ty * SC - 4, '#ffffff');
    };
    for (const o of F.objects) {
      if (o.type === 'info') mark(o.tx + 1, o.ty, 'i', '#2f6fd0');
      if (o.type === 'ret') mark(o.tx, o.ty, 'R', '#7b3fa0');
    }
    for (const [i, o] of F.wallAt) {
      if (o.type === 'lift' && i === o.ty * F.w + o.tx) mark(o.tx, o.ty + 1, 'L', '#555555');
      if (o.type === 'wc') mark(o.tx, o.ty + 1, 'WC', '#3f7f9c');
    }
    return c;
  }

  function open() {
    const info = Library.miniInfo();
    for (const id of ['2', '3']) if (!plans[id]) plans[id] = buildPlan(info.floors[id]);
    const F = Library.floor;
    const p = Library.player;
    const z = ZONE_COLLEGE[zoneAt(F.id, Math.floor(p.x / TS), Math.floor(p.y / TS))];
    sel = z ? COLLEGE_IDS.indexOf(z) : 0;
    t = 0;
  }

  function update(dt) {
    t += dt;
    if (Input.hit('up')) { sel = (sel + 5) % 6; Sound.sfx('blip'); }
    if (Input.hit('down')) { sel = (sel + 1) % 6; Sound.sfx('blip'); }
    if (Input.hitAny('map', 'menu', 'act', 'jump')) return false;
    return true;
  }

  function draw(g) {
    rect(g, 0, 0, VIEW_W, VIEW_H, 'rgba(14,10,18,0.92)');
    Font.draw(g, 'Lageplan · Hauptbücherei', 8, 4, UI_COL.title);
    const info = Library.miniInfo();
    const rows = [['2', 18], ['3', 104]];
    for (const [id, y] of rows) {
      Font.draw(g, FLOOR_NAMES[id] + ':', 8, y, '#ffffff');
      rect(g, 6, y + 12, 196, 58, '#f9f6ee');
      g.drawImage(plans[id], 8, y + 14);
      if (info.playerFloor === id && Math.floor(t * 3) % 2 === 0) {
        const px2 = 8 + (info.px / TS) * SC;
        const py2 = y + 14 + (info.py / TS) * SC;
        rect(g, Math.round(px2) - 2, Math.round(py2) - 4, 5, 5, '#e0115f');
        rect(g, Math.round(px2) - 1, Math.round(py2) - 3, 3, 3, '#ffffff');
      }
      // Hervorhebung des gewählten Colleges
      const cid = COLLEGE_IDS[sel];
      if (COLLEGES[cid].floor === id) {
        const F = info.floors[id];
        g.fillStyle = 'rgba(255,255,255,' + (0.25 + 0.2 * Math.sin(t * 5)) + ')';
        for (let yy = 0; yy < F.h; yy++) for (let xx = 0; xx < F.w; xx++) {
          if (!F.isWall(xx, yy) && F.raw(xx, yy) !== ' ' && ZONE_COLLEGE[zoneAt(id, xx, yy)] === cid) g.fillRect(8 + xx * SC, y + 14 + yy * SC, SC, SC);
        }
      }
    }
    // Legende
    const lx = 210;
    COLLEGE_IDS.forEach((cid, i) => {
      const c = COLLEGES[cid];
      const y = 18 + i * 13;
      const on = i === sel;
      if (on) rect(g, lx - 2, y - 2, 170, 12, 'rgba(255,217,119,0.18)');
      rect(g, lx, y, 8, 8, PLAN_COL[cid]);
      Font.draw(g, c.num + ' · ' + c.name, lx + 12, y - 1, on ? UI_COL.title : UI_COL.text);
    });
    const cid = COLLEGE_IDS[sel];
    const topics = Object.keys(TOPICS).filter((k) => TOPICS[k].college === cid).map((k) => TOPICS[k].name);
    drawPanel(g, lx - 4, 98, 174, 104, 'rgba(40,30,48,0.96)', PLAN_COL[cid]);
    Font.draw(g, FLOOR_NAMES[COLLEGES[cid].floor] + ', ' + COLLEGES[cid].colorName + ':', lx + 2, 100, PLAN_COL[cid]);
    let y = 112;
    for (const tp of topics) {
      for (const l of Font.wrap('• ' + tp, 162)) {
        if (y < 196) Font.draw(g, l, lx + 2, y, UI_COL.text);
        y += 9;
      }
    }
    Font.draw(g, '↑↓ College wählen · K schließen', 8, 204, UI_COL.dim);
    Font.draw(g, 'L Lift · i Info · R Rückgabe', 210, 204, UI_COL.dim);
  }

  return { open, update, draw };
})();

// --- Abzeichen --------------------------------------------------------
function drawBadges(g) {
  drawPanel(g, 14, 8, 356, 200);
  Font.drawCentered(g, 'Abzeichen', VIEW_W / 2, 14, UI_COL.title, '#1a1220', 2);
  BADGES.forEach((b, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 24 + col * 174;
    const y = 42 + row * 38;
    const got = S.badges.includes(b.id);
    // Medaille
    for (let yy = -7; yy <= 7; yy++) for (let xx = -7; xx <= 7; xx++) {
      const d = xx * xx + yy * yy;
      if (d <= 49) px(g, x + 8 + xx, y + 10 + yy, d > 36 ? '#2b1d1f' : got ? (d < 12 ? '#ffe680' : '#e0b13c') : '#5a5060');
    }
    if (got) Font.draw(g, '★', x + 5, y + 5, '#b8860b');
    Font.draw(g, b.name, x + 22, y, got ? UI_COL.title : UI_COL.dim);
    Font.wrap(b.desc, 140).slice(0, 2).forEach((l, j) => Font.draw(g, l, x + 22, y + 11 + j * 10, got ? UI_COL.text : '#8d8091'));
  });
  Font.drawCentered(g, S.badges.length + ' von ' + BADGES.length + ' · Weiter mit E', VIEW_W / 2, 194, UI_COL.dim);
}

// --- Titelbildschirm ------------------------------------------------
const Title = (() => {
  let t = 0;
  let sel = 0;
  let sub = null;
  let items = [];
  let hasSave = false;
  let hooks = null;

  function enter(h) {
    hooks = h;
    t = 0;
    sub = null;
    hasSave = !!Save.load();
    rebuild();
    sel = 0;
    Sound.play('library');
  }

  function rebuild() {
    items = [];
    if (hasSave) items.push({ id: 'cont', label: 'Weiterspielen' });
    items.push({ id: 'new', label: 'Neues Spiel' });
    items.push({ id: 'ctrl', label: 'Steuerung' });
    items.push({ id: 'music', label: 'Musik: ' + (S.music ? 'an' : 'aus') });
  }

  function update(dt) {
    t += dt;
    if (sub === 'ctrl') {
      if (Input.hitAny('act', 'jump', 'menu')) { sub = null; Sound.sfx('blip'); }
      return;
    }
    if (Input.hit('up')) { sel = (sel + items.length - 1) % items.length; Sound.sfx('blip'); }
    if (Input.hit('down')) { sel = (sel + 1) % items.length; Sound.sfx('blip'); }
    if (Input.confirm()) {
      const it = items[sel];
      Sound.sfx('select');
      if (it.id === 'cont') hooks.cont();
      else if (it.id === 'new') {
        if (hasSave) {
          Dialog.open([Object.assign(narr('Ein neues Spiel überschreibt deinen gespeicherten Fortschritt. Wirklich neu beginnen?'), {
            choices: [{ t: 'Ja, neu beginnen', fn: () => hooks.newGame() }, { t: 'Nein', fn: () => {} }],
          })]);
        } else hooks.newGame();
      } else if (it.id === 'ctrl') sub = 'ctrl';
      else if (it.id === 'music') {
        hooks.toggleMusic();
        rebuild();
      }
    }
  }

  function draw(g) {
    const F = Library.miniInfo().floors['2'];
    const span = F.w * TS - VIEW_W;
    const ox = Math.round((Math.sin(t * 0.06) * 0.5 + 0.5) * span);
    g.drawImage(F.layer, ox, 40, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);
    for (const o of F.objects) {
      if (!o.img) continue;
      const x = o.px - ox;
      if (x < -50 || x > VIEW_W + 10) continue;
      g.drawImage(o.img, x + (o.dx || 0), o.py - 40);
    }
    rect(g, 0, 0, VIEW_W, VIEW_H, 'rgba(18,12,22,0.62)');
    // Bücher-Leiste oben
    const r = makeRng(7);
    for (let x = 0; x < VIEW_W; x += 3) rect(g, x, 0, 3, 6 + Math.floor(r() * 4), pick(SPINES, r));
    Font.drawCentered(g, 'BÜCHERWELTEN', VIEW_W / 2 + 2, 30, '#3a1d12', null, 3);
    Font.drawCentered(g, 'BÜCHERWELTEN', VIEW_W / 2, 28, '#ffd977', null, 3);
    Font.drawCentered(g, 'Ein Bücherei-Abenteuer in der Hauptbücherei', VIEW_W / 2, 64, '#f7f1e3', '#1a1220');
    if (sub === 'ctrl') {
      drawControls(g);
      return;
    }
    drawPanel(g, 128, 90, 128, items.length * 14 + 10);
    drawMenuList(g, items.map((i) => i.label), sel, 132, 96, 120);
    Font.drawCentered(g, '↑↓ wählen · Enter / E bestätigen', VIEW_W / 2, 176, UI_COL.dim, '#1a1220');
    Font.drawCentered(g, 'Prototyp · Grafik, Texte & Musik werden im Browser erzeugt', VIEW_W / 2, 200, '#9d8fa0', '#1a1220');
  }

  return { enter, update, draw };
})();

// --- Pausenmenü --------------------------------------------------------
const Pause = (() => {
  let sel = 0;
  let sub = null;
  let items = [];
  let hooks = null;
  let ctx = 'library';

  function open(h, where) {
    hooks = h;
    ctx = where;
    sub = null;
    sel = 0;
    rebuild();
  }

  function rebuild() {
    items = [{ id: 'back', label: 'Weiterspielen' }];
    if (ctx === 'library') items.push({ id: 'map', label: 'Lageplan' });
    items.push({ id: 'badges', label: 'Abzeichen' });
    items.push({ id: 'ctrl', label: 'Steuerung' });
    items.push({ id: 'music', label: 'Musik: ' + (S.music ? 'an' : 'aus') });
    items.push({ id: 'sfx', label: 'Effekte: ' + (S.sfx ? 'an' : 'aus') });
    if (ctx !== 'library') items.push({ id: 'leave', label: 'Buchwelt verlassen' });
    items.push({ id: 'title', label: 'Zum Titelbildschirm' });
    items.push({ id: 'reset', label: 'Spielstand löschen' });
  }

  // Rückgabe: false = Menü schließen
  function update() {
    if (sub) {
      if (Input.hitAny('act', 'jump', 'menu')) { sub = null; Sound.sfx('blip'); }
      return true;
    }
    if (Input.hit('menu')) return false;
    if (Input.hit('up')) { sel = (sel + items.length - 1) % items.length; Sound.sfx('blip'); }
    if (Input.hit('down')) { sel = (sel + 1) % items.length; Sound.sfx('blip'); }
    if (Input.confirm()) {
      const it = items[sel];
      Sound.sfx('select');
      switch (it.id) {
        case 'back': return false;
        case 'map': hooks.openMap(); return false;
        case 'badges': sub = 'badges'; break;
        case 'ctrl': sub = 'ctrl'; break;
        case 'music': hooks.toggleMusic(); rebuild(); break;
        case 'sfx': hooks.toggleSfx(); rebuild(); break;
        case 'leave': hooks.leaveWorld(); return false;
        case 'title': hooks.toTitle(); return false;
        case 'reset':
          Dialog.open([Object.assign(narr('Spielstand wirklich löschen? Punkte, Abzeichen und Fortschritt gehen verloren.'), {
            choices: [{ t: 'Ja, löschen', fn: () => hooks.reset() }, { t: 'Abbrechen', fn: () => {} }],
          })]);
          return false;
        default: break;
      }
    }
    return true;
  }

  function draw(g) {
    rect(g, 0, 0, VIEW_W, VIEW_H, 'rgba(14,10,18,0.72)');
    if (sub === 'badges') return drawBadges(g);
    if (sub === 'ctrl') return drawControls(g);
    const h = items.length * 14 + 30;
    drawPanel(g, 120, (VIEW_H - h) / 2, 144, h);
    Font.drawCentered(g, 'Pause', VIEW_W / 2, (VIEW_H - h) / 2 + 5, UI_COL.title);
    drawMenuList(g, items.map((i) => i.label), sel, 124, (VIEW_H - h) / 2 + 22, 136);
  }

  return { open, update, draw };
})();

// ===================================================================
// Hauptprogramm: Szenen, Spielschleife, Skalierung, Start
// ===================================================================
const Game = (() => {
  const buffer = makeCanvas(VIEW_W, VIEW_H);
  const g = buffer.getContext('2d');
  let screen = null;
  let sg = null;
  let scale = 1;
  let offX = 0;
  let offY = 0;
  let mid = null;
  let midG = null;
  let scene = 'title';
  let overlay = null;
  let fade = null;
  let last = 0;
  let acc = 0;
  let running = true;
  let worldCtx = null;

  const STEP = 1 / 60;

  function resize() {
    const wrap = screen.parentElement;
    const cssW = Math.max(1, wrap.clientWidth);
    const cssH = Math.max(1, wrap.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    screen.width = Math.round(cssW * dpr);
    screen.height = Math.round(cssH * dpr);
    const s = Math.min(screen.width / VIEW_W, screen.height / VIEW_H);
    // Ganzzahlig, wenn es fast passt – sonst ganzzahlig hochrechnen und weich auf Endgröße bringen
    if (s < 1 || s - Math.floor(s) < 0.03) {
      scale = s < 1 ? s : Math.floor(s);
      mid = null;
    } else {
      scale = s;
      const k = Math.max(1, Math.round(s));
      if (!mid || mid.width !== VIEW_W * k) {
        mid = makeCanvas(VIEW_W * k, VIEW_H * k);
        midG = mid.getContext('2d');
        midG.imageSmoothingEnabled = false;
      }
    }
    offX = Math.floor((screen.width - VIEW_W * scale) / 2);
    offY = Math.floor((screen.height - VIEW_H * scale) / 2);
    sg = screen.getContext('2d');
    sg.imageSmoothingEnabled = false;
  }

  function ensureAudio() {
    if (!Sound.ready) {
      if (Sound.init()) {
        Sound.setMusic(S.music);
        Sound.setSfx(S.sfx);
      }
    }
    Sound.resume();
  }

  // --- Szenenwechsel -----------------------------------------------
  function fadeTo(fn) {
    if (fade) return;
    fade = { t: 0, fn, done: false };
  }

  function toTitle() {
    if (scene === 'library') Library.persist();
    Dialog.close();
    Toast.clear();
    overlay = null;
    scene = 'title';
    Title.enter(titleHooks);
  }

  function startLibrary() {
    Library.start();
    scene = 'library';
  }

  const titleHooks = {
    cont: () => fadeTo(() => {
      S = Save.load() || Save.defaults();
      applySettings();
      startLibrary();
    }),
    newGame: () => fadeTo(() => {
      const keep = { music: S.music, sfx: S.sfx };
      Save.clear();
      S = Save.defaults();
      S.music = keep.music;
      S.sfx = keep.sfx;
      startLibrary();
      Save.store(S);
    }),
    toggleMusic,
  };

  function applySettings() {
    Sound.setMusic(S.music);
    Sound.setSfx(S.sfx);
  }

  function toggleMusic() {
    S.music = !S.music;
    Sound.setMusic(S.music);
    Toast.show('Musik ' + (S.music ? 'an' : 'aus'), UI_COL.accent);
    Save.store(S);
  }

  function toggleSfx() {
    S.sfx = !S.sfx;
    Sound.setSfx(S.sfx);
    Save.store(S);
  }

  function startWorld(id) {
    const first = !S.worldsDone.includes(id);
    worldCtx = { id, first };
    Library.persist();
    fadeTo(() => {
      scene = id;
      if (id === 'moby') MobyWorld.enter(endWorld, first);
      else AliceWorld.enter(endWorld, first);
    });
  }

  function endWorld(result) {
    const ctx = worldCtx;
    fadeTo(() => {
      Sound.ambience(null);
      scene = 'library';
      Sound.play('library');
      const w = WORLDS[ctx.id];
      const shelf = Library.miniInfo().floors[w.floor].shelves.find((s) => s.topic === w.topic);
      if (result && ctx.first) {
        S.worldsDone.push(ctx.id);
        Library.addPoints(result.pts, 'Buchwelt „' + w.title + '“ abgeschlossen!');
      }
      Library.checkBadges();
      if (shelf && Library.floor.id === w.floor) Library.setPlayer(shelf.px + 16, (shelf.ty + 2) * TS + 13, 'up');
      Library.persist();
      worldCtx = null;
    });
  }

  function leaveWorld() {
    worldCtx = Object.assign({}, worldCtx, { first: false });
    StoryCard.close();
    Sound.ambience(null);
    endWorld(null);
  }

  const pauseHooks = {
    openMap: () => { MapView.open(); overlay = 'map'; },
    toggleMusic,
    toggleSfx,
    leaveWorld,
    toTitle: () => fadeTo(toTitle),
    reset: () => fadeTo(() => {
      const keep = { music: S.music, sfx: S.sfx };
      Save.clear();
      S = Save.defaults();
      S.music = keep.music;
      S.sfx = keep.sfx;
      toTitle();
    }),
  };

  // --- Schleife ----------------------------------------------------
  function update(dt) {
    Toast.update(dt);
    Banner.update(dt);
    Floaters.update(dt);
    if (fade) {
      fade.t += dt;
      if (!fade.done && fade.t >= 0.3) {
        fade.done = true;
        fade.fn();
      }
      if (fade.t >= 0.6) fade = null;
      return;
    }
    if (Input.hit('music') && !Dialog.active()) toggleMusic();
    if (overlay === 'map') {
      if (!MapView.update(dt)) overlay = null;
      return;
    }
    if (overlay === 'pause') {
      if (Dialog.active()) {
        Dialog.update(dt);
        return;
      }
      if (!Pause.update(dt) && overlay === 'pause') overlay = null;
      return;
    }
    if (Dialog.active()) {
      Dialog.update(dt);
      return;
    }
    if (scene === 'title') {
      Title.update(dt);
      return;
    }
    if (Input.hit('menu')) {
      overlay = 'pause';
      Pause.open(pauseHooks, scene);
      Sound.sfx('select');
      return;
    }
    if (scene === 'library') {
      if (Input.hit('map')) {
        MapView.open();
        overlay = 'map';
        Sound.sfx('select');
        return;
      }
      Library.update(dt);
    } else if (scene === 'moby') MobyWorld.update(dt);
    else if (scene === 'alice') AliceWorld.update(dt);
  }

  function draw() {
    if (scene === 'title') Title.draw(g);
    else if (scene === 'library') Library.draw(g);
    else if (scene === 'moby') MobyWorld.draw(g);
    else if (scene === 'alice') AliceWorld.draw(g);
    Banner.draw(g);
    Dialog.draw(g);
    Toast.draw(g);
    if (overlay === 'map') MapView.draw(g);
    if (overlay === 'pause') {
      Pause.draw(g);
      Dialog.draw(g);
    }
    if (fade) {
      const a = fade.t < 0.3 ? fade.t / 0.3 : 1 - (fade.t - 0.3) / 0.3;
      g.fillStyle = `rgba(10,6,12,${clamp(a, 0, 1)})`;
      g.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    sg.fillStyle = '#0d0a10';
    sg.fillRect(0, 0, screen.width, screen.height);
    if (mid) {
      midG.drawImage(buffer, 0, 0, mid.width, mid.height);
      sg.imageSmoothingEnabled = true;
      sg.imageSmoothingQuality = 'high';
      sg.drawImage(mid, offX, offY, Math.round(VIEW_W * scale), Math.round(VIEW_H * scale));
    } else {
      sg.imageSmoothingEnabled = false;
      sg.drawImage(buffer, offX, offY, Math.round(VIEW_W * scale), Math.round(VIEW_H * scale));
    }
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.1, (now - last) / 1000 || 0);
    last = now;
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 6) {
      update(STEP);
      Input.endFrame();
      acc -= STEP;
      steps++;
    }
    if (steps >= 6) acc = 0;
    draw();
    requestAnimationFrame(frame);
  }

  function boot() {
    screen = document.getElementById('screen');
    if (!screen || !screen.getContext) return;
    const loaded = Save.load();
    if (loaded) {
      S.music = loaded.music;
      S.sfx = loaded.sfx;
    }
    Library.init({
      openMap: () => { MapView.open(); overlay = 'map'; },
      startWorld,
    });
    Input.attach(window);
    Input.onAny(() => ensureAudio());
    const pad = document.getElementById('pad');
    if (pad) Input.bindButtons(pad);
    const fs = document.getElementById('fs');
    if (fs && document.fullscreenEnabled && document.documentElement.requestFullscreen) {
      fs.hidden = false;
      fs.addEventListener('click', () => {
        try {
          if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
          else document.documentElement.requestFullscreen().catch(() => {});
        } catch (e) {
          /* Vollbild nicht erlaubt */
        }
      });
    }
    screen.addEventListener('pointerdown', () => {
      try { screen.focus({ preventScroll: true }); } catch (e) { /* egal */ }
      ensureAudio();
    });
    window.addEventListener('resize', resize);
    if (window.ResizeObserver) new ResizeObserver(resize).observe(screen.parentElement);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (scene === 'library') Library.persist();
        Sound.suspend();
        Input.clear();
      } else if (Sound.ready) {
        Sound.resume();
        last = performance.now();
      }
    });
    window.addEventListener('pagehide', () => { if (scene === 'library') Library.persist(); });
    resize();
    drawLogo();
    Title.enter(titleHooks);
    last = performance.now();
    requestAnimationFrame(frame);
  }

  function drawLogo() {
    const logo = document.getElementById('logo');
    if (!logo || !logo.getContext) return;
    const text = 'BÜCHERWELTEN';
    const w = Font.measure(text) + 2;
    logo.width = w;
    logo.height = 11;
    const lg = logo.getContext('2d');
    Font.draw(lg, text, 1, 1, '#3a1d12');
    Font.draw(lg, text, 0, 0, '#ffd977');
  }

  return { boot, get scene() { return scene; }, get overlay() { return overlay; } };
})();

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', Game.boot);
else Game.boot();

})();
