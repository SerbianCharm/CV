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
  'è': '.#...|..#..|.###.|#...#|#####|#....|.###.',
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
  { id: 's11', short: 'das Märchen „Hänsel und Gretel“', ask: 'Ein Bub wünscht sich das Märchen „Hänsel und Gretel“ – am liebsten mit vielen Bildern.', hint: 'Märchen mit Bildern stehen bei den Bilderbüchern im Kirango (3. OG, orange).', topic: 'c4_bilder', found: 'Gefunden: „Hänsel und Gretel“ als Bilderbuch!' },
  { id: 's12', short: 'ein Buch über künstliche Intelligenz', ask: 'Eine Studentin will verstehen, wie KI-Chatbots funktionieren. Finde ein Buch über künstliche Intelligenz!', hint: 'KI gehört zu „Informatik & Computer“ im Know How (3. OG, grün).', topic: 'c6_it', found: 'Gefunden: „Künstliche Intelligenz verstehen“!' },
  { id: 's13', short: 'ein Buch über Politik und Satire', ask: 'Ein Leser sucht ein Buch darüber, wie Satire die Mächtigen aufs Korn nimmt.', hint: 'Politik und Medien findest du im College 3 (grau).', topic: 'c3_gpm', found: 'Gefunden: „Satire und Macht“!' },
  { id: 's14', short: 'ein Buch über das Ballett „Der Nussknacker“', ask: 'Eine Ballettschülerin sucht ein Buch über „Der Nussknacker“.', hint: 'Ballett steht bei „Theater & Tanz & Film“ im Kunstraum (3. OG, blau).', topic: 'c5_ttf', found: 'Gefunden: ein Bildband über den „Nussknacker“!' },
  { id: 's15', short: 'Ideen für eine Weltreise', ask: 'Ein Paar plant eine Reise rund um die Welt und braucht Ideen für die Route.', hint: 'Reisebücher stehen bei „Länder & Reisen“ im College 2 (rot).', topic: 'c2_reisen', found: 'Gefunden: „Einmal rund um die Welt“!' },
  { id: 's16', short: 'ein Buch über Raketen', ask: 'Ein Kind will wissen, wie Raketen ins All kommen. Finde ein Buch über Raketentechnik!', hint: 'Technik findest du im Know How – gleich neben Informatik.', topic: 'c6_technik', found: 'Gefunden: „Raketen und Raumfahrt“!' },
  { id: 's17', short: 'ein Mathebuch über Zahlenfolgen', ask: 'Eine Schülerin liebt Rätsel mit Zahlenfolgen – genau wie einst Ada Lovelace.', hint: 'Mathematik steht bei den Naturwissenschaften im Know How.', topic: 'c6_nawi', found: 'Gefunden: „Das Buch der Zahlenfolgen“!' },
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
  { id: 'q13', q: 'Wer gilt als erste Programmiererin der Welt?', a: ['Marie Curie', 'Ada Lovelace', 'Bertha von Suttner'], ok: 1, ex: 'Ada Lovelace veröffentlichte 1843 ein Rechenprogramm für Charles Babbages Analytische Maschine.' },
  { id: 'q14', q: 'Wie heißt der Test, ob man eine Maschine im Gespräch von einem Menschen unterscheiden kann?', a: ['Turing-Test', 'Crashtest', 'Lackmustest'], ok: 0, ex: 'Alan Turing nannte ihn 1950 „Imitationsspiel“. Heute heißt er nach ihm Turing-Test.' },
  { id: 'q15', q: 'Wie heißt das Land der winzigen Menschen in „Gullivers Reisen“?', a: ['Nimmerland', 'Liliput', 'Lummerland'], ok: 1, ex: 'Gulliver strandet in Liliput. Die Menschen dort sind kaum größer als ein Daumen.' },
  { id: 'q16', q: 'Wer hat „In 80 Tagen um die Welt“ geschrieben?', a: ['Jules Verne', 'Karl May', 'Mark Twain'], ok: 0, ex: 'Jules Verne. Von ihm stammt auch „Von der Erde zum Mond“.' },
]);

// Buchwelten (werden mit Punkten freigeschaltet). Reihenfolge = Freischalt-Reihenfolge.
// Abstand zwischen zwei Welten wächst um je 10 ★ (30, 40, 50 … 100).
const WORLDS = deepFreeze({
  haensel: { title: 'Hänsel und Gretel', author: 'Brüder Grimm', by: 'den Brüdern Grimm', year: 1812, topic: 'c4_bilder', floor: '3', need: 20, color: '#c0703a',
    teaser: 'Nachts im Wald: Folge den Kieselsteinen im Mondlicht nach Hause.' },
  moby: { title: 'Moby Dick', author: 'Herman Melville', year: 1851, topic: 'c1_lit', floor: '2', need: 50, color: '#3f74a8',
    teaser: 'Kletter in den Mastkorb der Pequod und halte Ausschau nach dem weißen Wal.' },
  alice: { title: 'Alice im Wunderland', author: 'Lewis Carroll', year: 1865, topic: 'c4_kinder', floor: '3', need: 90, color: '#5b9bd5',
    teaser: 'Folge dem weißen Kaninchen in den Kaninchenbau – und fall und fall …' },
  turing: { title: 'Können Maschinen denken?', author: 'Alan Turing', year: 1950, topic: 'c6_it', floor: '3', need: 140, color: '#3b8f5a',
    teaser: 'Das Imitationsspiel: Wer am Fernschreiber ist Mensch, wer Maschine?' },
  gulliver: { title: 'Gullivers Reisen', author: 'Jonathan Swift', year: 1726, topic: 'c3_gpm', floor: '2', need: 200, color: '#b8453a',
    teaser: 'Als Riese in Liliput: Zieh die Flotte von Blefuscu an den Strand.' },
  nuss: { title: 'Nussknacker und Mausekönig', author: 'E. T. A. Hoffmann', year: 1816, topic: 'c5_ttf', floor: '3', need: 270, color: '#7b3fa0',
    teaser: 'Um Mitternacht erwachen die Spielsachen. Knack die Nüsse im Takt!' },
  reise: { title: 'In 80 Tagen um die Welt', author: 'Jules Verne', year: 1873, topic: 'c2_reisen', floor: '2', need: 350, color: '#d9a441',
    teaser: 'Phileas Fogg hat gewettet. Zug, Schiff oder Elefant – du entscheidest.' },
  mond: { title: 'Von der Erde zum Mond', author: 'Jules Verne', year: 1865, topic: 'c6_technik', floor: '3', need: 440, color: '#4a5d7a',
    teaser: 'Der Kanonen-Club schießt zum Mond. Du bestimmst Ladung und Zeitpunkt.' },
  ada: { title: 'Die Analytische Maschine', author: 'Ada Lovelace', year: 1843, topic: 'c6_it', floor: '3', need: 540, color: '#9b5d8f',
    teaser: 'Programmiere Babbages Rechenmaschine mit Lochkarten – bis sie Musik macht.' },
});
const WORLD_IDS = Object.freeze(['haensel', 'moby', 'alice', 'turing', 'gulliver', 'nuss', 'reise', 'mond', 'ada']);

const BADGES = deepFreeze([
  { id: 'erstes', name: 'Erstes Buch', desc: 'Das erste Buch richtig zurückgestellt.' },
  { id: 'sortier', name: 'Sortier-Profi', desc: '8 Bücher richtig einsortiert.' },
  { id: 'spuer', name: 'Spürnase', desc: '3 Suchaufträge erledigt.' },
  { id: 'quiz', name: 'Quiz-Ass', desc: '5 Quizfragen richtig beantwortet.' },
  { id: 'ruhe', name: 'Ruhepol', desc: 'Alle 3 Bücherei-Situationen gut gelöst.' },
  { id: 'entdeck', name: 'Entdeckungsreise', desc: 'Alle 6 Colleges besucht.' },
  { id: 'moby', name: 'Ausguck', desc: 'In „Moby Dick“ den weißen Wal gesichtet.' },
  { id: 'alice', name: 'Kaninchenbau', desc: 'In „Alice im Wunderland“ in den Kaninchenbau gefolgt.' },
  { id: 'leseratte', name: 'Leseratte', desc: '3 Buchwelten erlebt.' },
  { id: 'weltenbummler', name: 'Weltenbummler', desc: 'Alle 9 Buchwelten erlebt.' },
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
  { id: 'foyer1', name: 'Besucherin', floor: '2', x: 6, y: 13, dir: 'down', wander: true, look: mkLook('long', 'brown', 'dark', '#e9c46a', '#264653'), lines: ['Kennst du den Lageplan? Mit [K] siehst du, wo welches Thema steht.', 'Mit [B] – am Handy mit „Bücher“ – siehst du alle Bücherwelten. Ich spare gerade auf „Moby Dick“!', 'Meine Jacke ist an der Garderobe – gleich da unten.'] },
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
  'Mit [K] – am Handy mit „Plan“ – öffnest du jederzeit den Lageplan. Dort steht auch, welche Themen in welchem College zu finden sind.',
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
  'Mit [B] – am Handy mit „Bücher“ – öffnest du die Bücherliste. Dort steht, ab wie vielen ★ sich welche Buchwelt öffnet.',
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
  let songStart = null;
  let startPending = false;

  const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function freq(name) {
    const m = /^([A-G])([#b]?)(\d)$/.exec(name);
    if (!m) return 0;
    let n = SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    n += (parseInt(m[3], 10) + 1) * 12;
    return 440 * Math.pow(2, (n - 69) / 12);
  }

  // iPhone/iPad: Ohne Angabe behandelt Safari Web-Audio wie „ambient“ – dann schaltet der
  // Lautlos-Schalter alles stumm. Mit Musik an spielt das Spiel wie ein Video ("playback"),
  // mit Musik aus gilt wieder der Lautlos-Schalter. Andere Browser kennen die API nicht.
  function applySession() {
    try {
      const as = navigator.audioSession;
      if (as && 'type' in as) as.type = musicOn ? 'playback' : 'ambient';
    } catch (e) {
      /* nicht unterstützt */
    }
  }

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    applySession();
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
    if (ctx && ctx.state !== 'running' && ctx.state !== 'closed') ctx.resume().catch(() => {});
  }

  // Muss direkt in einem Nutzer-Ereignis laufen (touchend, pointerup, click, keydown).
  // iOS gibt Audio bei touchstart/pointerdown nicht frei; ein stiller Mini-Ton „weckt“ den Kontext.
  function unlock() {
    if (!ctx && !init()) return;
    if (ctx.state === 'running' || ctx.state === 'closed') return;
    ctx.resume().catch(() => {});
    try {
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, 22050);
      src.connect(ctx.destination);
      src.start(0);
    } catch (e) {
      /* egal */
    }
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
    E: 'E3+G#3+B3', Bm: 'B3+D4+F#4',
  };

  // Einzelne hohe Glockentöne zu Taktbeginn (jeder n-te Takt)
  function bellTrack(bars, perBar, every, tops) {
    const out = [];
    bars.forEach((name, i) => {
      for (let k = 0; k < perBar; k++) out.push(k === 0 && i % every === 0 ? tops[name] : '.');
    });
    return out.join(' ');
  }

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
  const forestBars = ['Am', 'F', 'G', 'Am', 'Dm', 'Am', 'E', 'Am', 'F', 'C', 'G', 'Em', 'Dm', 'Am', 'E', 'Am'];
  const labBars = ['Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'E'];
  const lilliBars = ['D', 'G', 'A', 'D', 'Bm', 'G', 'A', 'D'];
  const marchBars = ['G', 'G', 'D', 'D', 'G', 'C', 'D', 'G', 'Em', 'C', 'D', 'G', 'C', 'G', 'D', 'G'];
  const galopBars = ['C', 'G', 'C', 'G', 'C', 'F', 'G', 'C', 'Am', 'Dm', 'G', 'C', 'F', 'C', 'G', 'C'];
  const spaceBars = ['C', 'Am', 'F', 'G', 'C', 'Em', 'F', 'G'];
  const engineBars = ['G', 'D', 'G', 'C', 'G', 'Am', 'D', 'G', 'Em', 'C', 'G', 'D', 'C', 'G', 'D', 'G'];

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
    // Hänsel und Gretel: leises Wiegenlied im Mondlicht (3/4)
    forest: {
      bpm: 84, spb: 2,
      tracks: [
        { inst: 'soft', vol: 0.075, notes:
          'A4 - C5 - E5 - F5 - E5 - C5 - D5 - - - B4 - C5 - A4 - - - ' +
          'D5 - F5 - A5 - G5 - E5 - C5 - B4 - G#4 - E4 - A4 - - - . . ' +
          'A4 - C5 - F5 - E5 - D5 - C5 - B4 - D5 - G5 - G5 - F5 - E5 - ' +
          'F5 - E5 - D5 - C5 - B4 - A4 - G#4 - B4 - E5 - A4 - - - . .' },
        { inst: 'bass', vol: 0.13, notes: chordTrack(forestBars, 6, 'b.....', V4) },
        { inst: 'pluck', vol: 0.05, notes: chordTrack(forestBars, 6, '..x.x.', V4) },
        { inst: 'bell', vol: 0.03, notes: bellTrack(forestBars, 6, 2, { Am: 'E6', F: 'C6', G: 'D6', Em: 'B5', Dm: 'A5', E: 'B5', C: 'G5' }) },
      ],
    },
    // Turing: Fernschreiber-Takt und leise Pulswellen
    lab: {
      bpm: 104, spb: 4,
      tracks: [
        { inst: 'soft', vol: 0.06, notes:
          'E5 - - - - - - - D5 - - - C5 - - - A4 - - - - - - - - - - - . . . . ' +
          'G4 - - - C5 - - - E5 - - - - - - - D5 - - - - - - - - - - - . . . . ' +
          'E5 - - - A5 - - - G5 - - - E5 - - - F5 - - - - - - - E5 - - - C5 - - - ' +
          'D5 - - - - - - - F5 - - - - - - - E5 - - - - - - - G#4 - - - B4 - - -' },
        { inst: 'arp', vol: 0.028, notes: arpTrack(labBars, 16) },
        { inst: 'bass', vol: 0.14, notes: chordTrack(labBars, 16, 'b.......b...b...', V4) },
        { inst: 'H', vol: 0.06, notes: 'H . . H . . H . H . . H . . H . '.repeat(8) },
      ],
    },
    // Gulliver: kleiner Jig für die Liliputaner (6/8)
    lilliput: {
      bpm: 104, spb: 3,
      tracks: [
        { inst: 'lead', vol: 0.05, notes:
          'D5 - F#5 A5 - F#5 B5 - A5 G5 - E5 C#5 - E5 A5 - E5 F#5 - E5 D5 - - ' +
          'D5 - F#5 B5 - A5 G5 - F#5 E5 - D5 C#5 D5 E5 A4 - C#5 D5 - - D5 . .' },
        { inst: 'bass', vol: 0.16, notes: chordTrack(lilliBars, 6, 'b..b..', V4) },
        { inst: 'pluck', vol: 0.05, notes: chordTrack(lilliBars, 6, '..x..x', V4) },
        { inst: 'H', vol: 0.05, notes: 'H . . H . . '.repeat(8) },
      ],
    },
    // Nussknacker: eigener Zinnsoldaten-Marsch (4/4)
    march: {
      bpm: 116, spb: 2,
      tracks: [
        { inst: 'lead', vol: 0.06, notes:
          'D5 - G5 - G5 A5 B5 - G5 - D5 - B4 - G4 - A4 - D5 - D5 E5 F#5 - A5 - - - F#5 - D5 - ' +
          'B5 - G5 - B5 - D6 - C6 - B5 - A5 - G5 - F#5 - A5 - E5 - F#5 - G5 - D5 - G5 - . . ' +
          'E5 - G5 - B5 - G5 - E5 - C5 - E5 G5 C6 - D6 - C6 - B5 - A5 - B5 - G5 - D5 - . . ' +
          'E5 - E5 F#5 G5 - E5 - D5 - D5 E5 D5 - B4 - A4 - D5 - F#5 - A5 - G5 - - - G4 - . .' },
        { inst: 'bass', vol: 0.16, notes: chordTrack(marchBars, 8, 'b...b...', V4) },
        { inst: 'chord', vol: 0.025, notes: chordTrack(marchBars, 8, '..x...x.', V4) },
        { inst: 'K', vol: 0.3, notes: 'K . . . K . . . '.repeat(16) },
        { inst: 'S', vol: 0.1, notes: '. . S . . . S . '.repeat(15) + '. . S . S S S S' },
      ],
    },
    // 80 Tage: flotter Galopp (2/4)
    galop: {
      bpm: 148, spb: 2,
      tracks: [
        { inst: 'lead', vol: 0.05, notes:
          'E5 G5 C6 G5 D5 G5 B5 G5 E5 G5 C6 E6 D6 - B5 - C6 B5 A5 G5 F5 A5 C6 A5 G5 F5 E5 D5 C5 - . . ' +
          'A5 G5 E5 C5 D5 F5 A5 F5 G5 B5 D6 B5 C6 - G5 - A5 F5 C5 F5 G5 E5 C5 E5 D5 G5 B5 D6 C6 - . .' },
        { inst: 'bass', vol: 0.16, notes: chordTrack(galopBars, 4, 'b...', V4) },
        { inst: 'chord', vol: 0.025, notes: chordTrack(galopBars, 4, '..x.', V4) },
        { inst: 'K', vol: 0.25, notes: 'K . . . '.repeat(16) },
        { inst: 'S', vol: 0.08, notes: '. . S . '.repeat(16) },
      ],
    },
    // Von der Erde zum Mond: weite Fanfare über Glitzer-Arpeggien
    space: {
      bpm: 92, spb: 4,
      tracks: [
        { inst: 'soft', vol: 0.07, notes:
          'C5 - - - G4 - - - C5 - - - E5 - - - G5 - - - - - - - E5 - - - C5 - - - ' +
          'F5 - - - A5 - - - C6 - - - A5 - - - G5 - - - - - - - - - - - . . . . ' +
          'E5 - - - G5 - - - C6 - - - G5 - - - B5 - - - - - - - G5 - - - E5 - - - ' +
          'A5 - - - C6 - - - F6 - - - C6 - - - D6 - - - B5 - - - G5 - - - D5 - - -' },
        { inst: 'arp', vol: 0.025, notes: arpTrack(spaceBars, 16) },
        { inst: 'bass', vol: 0.15, notes: chordTrack(spaceBars, 16, 'b.......b.......', V4) },
      ],
    },
    // Ada Lovelace: Spieluhr mit Uhrwerk-Ticken (3/4)
    engine: {
      bpm: 132, spb: 2,
      tracks: [
        { inst: 'bell', vol: 0.06, notes:
          'D5 - G5 - B5 - A5 - F#5 - D5 - G5 - B5 - D6 - E6 - - - C6 - B5 - G5 - D5 - C6 - A5 - E5 - F#5 - A5 - D6 - G5 - - - . . ' +
          'G5 - B5 - E6 - E6 - C6 - G5 - D6 - B5 - G5 - F#5 - A5 - D6 - C6 - E6 - G5 - B5 - D6 - G5 - A5 - F#5 - E5 - G5 - - - . .' },
        { inst: 'bass', vol: 0.13, notes: chordTrack(engineBars, 6, 'b.....', V4) },
        { inst: 'pluck', vol: 0.05, notes: chordTrack(engineBars, 6, '..x.x.', V4) },
        { inst: 'H', vol: 0.05, notes: 'H . H . H . '.repeat(16) },
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
    if (nextT < ctx.currentTime - 0.2) {
      const nt = ctx.currentTime + 0.05;
      if (songStart !== null) songStart += nt - nextT;
      nextT = nt;
    }
    while (nextT < ctx.currentTime + 0.15) {
      if (startPending && step === 0) {
        songStart = nextT;
        startPending = false;
      }
      scheduleStep(song, step, nextT);
      nextT += song.stepDur;
      step = (step + 1) % song.len;
    }
  }

  function play(id, restart) {
    if (songId === id && !restart) return;
    songId = id;
    song = SONGS[id] || null;
    step = 0;
    songStart = null;
    startPending = true;
    if (ctx) nextT = ctx.currentTime + 0.12;
  }

  function stop() {
    song = null;
    songId = null;
    songStart = null;
  }

  // Sekunden seit Schritt 0 des laufenden Liedes (Audio-Uhr) – für das Rhythmusspiel
  function songTime() {
    if (!ctx || ctx.state !== 'running' || songStart === null || !song) return null;
    return ctx.currentTime - songStart - (ctx.outputLatency || ctx.baseLatency || 0);
  }

  function songInfo(id) {
    const sg = SONGS[id];
    return sg ? { stepDur: sg.stepDur, len: sg.len, tracks: sg.tracks.map((tr) => tr.tokens.slice()) } : null;
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
    owl: (t) => { osc('sine', 440, t, 0.22, 0.07, sfxBus, { slide: 380 }); osc('sine', 410, t + 0.32, 0.45, 0.07, sfxBus, { slide: 350, vib: true }); },
    pebble: (t) => { osc('sine', 2093, t, 0.05, 0.05, sfxBus, { release: 0.2 }); osc('sine', 3136, t + 0.04, 0.08, 0.035, sfxBus, { release: 0.25 }); },
    type: (t) => { noise(t, 0.025, 0.1, sfxBus, 'bandpass', 3200, 2); osc('square', 140, t, 0.02, 0.02, sfxBus, { lp: 900, release: 0.02 }); },
    bell: (t) => { osc('sine', 1760, t, 0.4, 0.06, sfxBus, { sustain: 0.3, release: 0.5 }); osc('sine', 2637, t, 0.2, 0.03, sfxBus, { release: 0.3 }); },
    crack: (t) => { noise(t, 0.07, 0.25, sfxBus, 'bandpass', 1900, 1.5); osc('square', 320, t, 0.03, 0.04, sfxBus, { slide: 120, lp: 1500 }); },
    squeak: (t) => osc('square', 1700, t, 0.09, 0.035, sfxBus, { slide: 2500, lp: 4000 }),
    arrow: (t) => noise(t, 0.14, 0.12, sfxBus, 'highpass', 3000, 0.8, 6000),
    boom: (t) => { noise(t, 1.4, 0.4, sfxBus, 'lowpass', 500, 0.7, 60); osc('sine', 90, t, 0.6, 0.3, sfxBus, { slide: 28 }); },
    whistle: (t) => { osc('square', 880, t, 0.55, 0.035, sfxBus, { lp: 2200, vib: true }); osc('square', 1109, t, 0.55, 0.03, sfxBus, { lp: 2200 }); },
    gear: (t) => { for (let i = 0; i < 3; i++) noise(t + i * 0.07, 0.04, 0.12, sfxBus, 'bandpass', 900 + i * 300, 3); },
    punch: (t) => { noise(t, 0.03, 0.2, sfxBus, 'bandpass', 2500, 2); osc('square', 520, t, 0.025, 0.04, sfxBus, { lp: 2000 }); },
    cheer: (t) => { for (let i = 0; i < 7; i++) osc('square', 1400 + Math.random() * 900, t + i * 0.05, 0.07, 0.02, sfxBus, { slide: 2400, lp: 4000 }); },
    rope: (t) => noise(t, 0.2, 0.1, sfxBus, 'bandpass', 700, 1.2, 1400),
  };

  function sfx(name) {
    if (!ctx || !sfxOn || ctx.state !== 'running') return;
    const fn = SFX[name];
    if (fn) fn(ctx.currentTime + 0.005);
  }

  function setMusic(on) {
    musicOn = !!on;
    applySession();
    if (musicBus) musicBus.gain.setTargetAtTime(musicOn ? 0.5 : 0, ctx.currentTime, 0.05);
  }
  function setSfx(on) {
    sfxOn = !!on;
    if (sfxBus) sfxBus.gain.setTargetAtTime(sfxOn ? 0.75 : 0, ctx.currentTime, 0.05);
  }

  return {
    init, resume, unlock, suspend, play, stop, sfx, ambience, setMusic, setSfx, songTime, songInfo,
    get state() { return ctx ? ctx.state : 'none'; },
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
  let touchMode = false;
  const KEYMAP = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    KeyE: 'act', Enter: 'act', NumpadEnter: 'act', Space: 'jump',
    ShiftLeft: 'run', ShiftRight: 'run',
    KeyK: 'map', KeyB: 'books', KeyM: 'music', Escape: 'menu', KeyP: 'menu',
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
    touchMode = false;
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

  // Touch/Maus-Knöpfe: data-btn="up|down|left|right|act|run|map|books|menu|music"
  const btnNames = (el) => String(el.dataset.btn).split(' ').filter((n) => /^[a-z]+$/.test(n));

  function bindButtons(root) {
    const hasTouch = 'ontouchstart' in window;
    // Maus und Stift: Zeiger-Ereignisse direkt am Knopf
    for (const el of root.querySelectorAll('[data-btn]')) {
      const names = btnNames(el);
      let down = false;
      const onDown = (e) => {
        if (hasTouch && e.pointerType === 'touch') return;
        e.preventDefault();
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
        down = true;
        el.classList.add('on');
        for (const n of names) press(n);
      };
      const onUp = (e) => {
        if (!down || (hasTouch && e.pointerType === 'touch')) return;
        e.preventDefault();
        down = false;
        el.classList.remove('on');
        for (const n of names) release(n);
      };
      el.addEventListener('pointerdown', onDown);
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onUp);
      el.addEventListener('lostpointercapture', onUp);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    if (hasTouch) bindTouch(root);
  }

  // Finger: ein zentraler Handler am Dokument, der selbst nachsieht, welcher Knopf unter dem
  // Finger liegt. iOS Safari stellt Ereignisse an fest positionierten Knöpfen im Querformat
  // sonst teils nicht zu (die Knöpfe reagierten erst nach einer Berührung im Hochformat).
  // Nebenbei kann man jetzt auf dem Steuerkreuz von einer Richtung zur nächsten rutschen.
  function bindTouch(root) {
    const fingers = new Map();
    const btns = () => Array.from(root.querySelectorAll('[data-btn]'));

    function hit(x, y, onlyDpad) {
      let best = null;
      let bd = 1e9;
      for (const el of btns()) {
        if (onlyDpad && !el.closest('.dpad')) continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const m = 6;
        if (x < r.left - m || x > r.right + m || y < r.top - m || y > r.bottom + m) continue;
        const d = Math.hypot(x - (r.left + r.right) / 2, y - (r.top + r.bottom) / 2);
        if (d < bd) { bd = d; best = el; }
      }
      return best;
    }

    function heldByOther(el, id) {
      for (const [fid, f] of fingers) if (fid !== id && f.el === el) return true;
      return false;
    }

    function setFinger(id, el) {
      const f = fingers.get(id);
      if (!f || f.el === el) return;
      const prev = f.el;
      f.el = el;
      if (prev && !heldByOther(prev, id)) {
        prev.classList.remove('on');
        for (const n of btnNames(prev)) release(n);
      }
      if (el) {
        el.classList.add('on');
        for (const n of btnNames(el)) press(n);
      }
    }

    function onStart(e) {
      touchMode = true;
      let used = false;
      for (const t of e.changedTouches) {
        const el = hit(t.clientX, t.clientY, false);
        if (!el) continue;
        used = true;
        fingers.set(t.identifier, { el: null, dpad: !!el.closest('.dpad') });
        setFinger(t.identifier, el);
      }
      if (used && e.cancelable) e.preventDefault();
    }

    function onMove(e) {
      let used = false;
      for (const t of e.changedTouches) {
        const f = fingers.get(t.identifier);
        if (!f) continue;
        used = true;
        if (f.dpad) setFinger(t.identifier, hit(t.clientX, t.clientY, true));
      }
      if (used && e.cancelable) e.preventDefault();
    }

    function onEnd(e) {
      let used = false;
      for (const t of e.changedTouches) {
        if (!fingers.has(t.identifier)) continue;
        used = true;
        setFinger(t.identifier, null);
        fingers.delete(t.identifier);
      }
      if (used && e.cancelable) e.preventDefault();
    }

    function releaseAll() {
      for (const id of Array.from(fingers.keys())) {
        setFinger(id, null);
        fingers.delete(id);
      }
    }

    document.addEventListener('touchstart', onStart, { passive: false });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd, { passive: false });
    document.addEventListener('touchcancel', onEnd, { passive: false });
    // Beim Drehen des Geräts nichts „hängen“ lassen
    window.addEventListener('orientationchange', releaseAll);
    window.addEventListener('blur', releaseAll);
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
    get touch() { return touchMode; },
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

  return {
    open, close, update, draw, active: () => !!cur,
    // Textbreite mit/ohne Porträt; so viele Zeilen passen in den Kasten
    metrics: Object.freeze({ textW: BOX.w - 56, textWNarr: BOX.w - 16, maxLines: Math.floor((BOX.h - 15) / Font.LINE) + 1, choiceW: 300 }),
  };
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

// Glitzer-Stern (p = 0…1 Helligkeit), für Regale und Bücherliste
function drawTwinkle(g, x, y, p, col = '#ffd977') {
  if (p <= 0.05) return;
  x = Math.round(x);
  y = Math.round(y);
  const a = g.globalAlpha;
  g.globalAlpha = a * Math.min(1, p * 1.4);
  rect(g, x, y, 1, 1, '#ffffff');
  if (p > 0.35) { rect(g, x - 1, y, 3, 1, col); rect(g, x, y - 1, 1, 3, col); rect(g, x, y, 1, 1, '#ffffff'); }
  if (p > 0.8) { rect(g, x - 2, y, 1, 1, col); rect(g, x + 2, y, 1, 1, col); rect(g, x, y - 2, 1, 1, col); rect(g, x, y + 2, 1, 1, col); }
  g.globalAlpha = a;
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
        const worlds = WORLD_IDS.filter((wid) => WORLDS[wid].topic === topic && WORLDS[wid].floor === id);
        F.shelves.push(mk('shelf', ch, x, y, 2, 2, img, 0, { topic, worlds }));
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
  const nearNoted = new Set();

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
    // Ältere Spielstände: inzwischen erreichte Buchwelten gleich melden
    if (S.tutorial > 0) checkUnlocks();
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
    noteNextWorld();
    requestSave();
  }

  // Kurz vor dem Ziel: einmal Bescheid geben, welche Buchwelt bald aufgeht
  function noteNextWorld() {
    const id = WORLD_IDS.find((w) => !worldUnlocked(w));
    if (!id || nearNoted.has(id)) return;
    const left = WORLDS[id].need - S.pts;
    if (left > 0 && left <= 10) {
      nearNoted.add(id);
      Toast.show('Noch ' + left + ' ★ bis „' + WORLDS[id].title + '“ – siehe Bücherliste', UI_COL.accent);
    }
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
        Banner.show('Neue Buchwelt: „' + w.title + '“', FLOOR_NAMES[w.floor] + ' · College ' + col.num + ' · „' + TOPICS[w.topic].name + '“', col.color, 2);
      }
    }
  }

  function checkBadges() {
    const st = S.stats;
    const rules = {
      erstes: st.returns >= 1, sortier: st.returns >= 8, spuer: S.searchDone.length >= 3,
      quiz: S.quizDone.length >= 5, ruhe: S.eventsDone.length >= 3, entdeck: S.visited.length >= 6,
      moby: S.worldsDone.includes('moby'), alice: S.worldsDone.includes('alice'),
      leseratte: S.worldsDone.length >= 3, weltenbummler: WORLD_IDS.every((w) => S.worldsDone.includes(w)),
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
          npcPage(nov.def, 'An den Info-Theken gibt es Suchaufträge und Quizfragen. Und ab ' + WORLDS[WORLD_IDS[0]].need + ' ★ öffnet sich das erste Buch, in das du hineinspringen kannst!'),
          npcPage(nov.def, 'Mit [B] – am Handy mit dem Knopf „Bücher“ – siehst du alle Bücherwelten und wie viele ★ du für jede brauchst.'),
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
    if (o.worlds.length === 1) {
      const id = o.worlds[0];
      const w = WORLDS[id];
      const by = w.by || w.author;
      if (S.worldsDone.includes(id)) {
        Dialog.open([
          narr('Regal „' + topic.name + '“. „' + w.title + '“ von ' + by + ' glitzert – diese Geschichte hast du schon erlebt.'),
          Object.assign(narr('Noch einmal eintauchen? (Punkte gibt es nur beim ersten Mal.)'), {
            choices: [
              { t: 'Ja, nochmal!', fn: () => onStartWorld(id) },
              { t: 'Später', fn: () => {} },
            ],
          }),
        ]);
      } else if (worldUnlocked(id)) {
        Dialog.open([
          narr('Regal „' + topic.name + '“. Ein Buch leuchtet: „' + w.title + '“ von ' + by + ' (' + w.year + ').'),
          Object.assign(narr('Möchtest du in die Geschichte eintauchen?'), {
            choices: [
              { t: 'Eintauchen!', fn: () => onStartWorld(id) },
              { t: 'Später', fn: () => {} },
            ],
          }),
        ]);
      } else {
        Dialog.open([narr('Regal „' + topic.name + '“. Ein Buch schimmert geheimnisvoll: „' + w.title + '“ von ' + by + '.'),
          narr('Sammle ' + w.need + ' ★, um in seine Welt einzutauchen. Du hast ' + S.pts + ' ★.')]);
      }
      return;
    }
    if (o.worlds.length > 1) {
      const choices = o.worlds.map((id) => {
        const w = WORLDS[id];
        const ok = worldUnlocked(id);
        const tag = S.worldsDone.includes(id) ? ' ✓' : ok ? '' : ' – ab ' + w.need + ' ★';
        return {
          t: '„' + w.title + '“ (' + w.author + ')' + tag,
          fn: ok ? () => onStartWorld(id) : () => Dialog.open([narr('„' + w.title + '“ öffnet sich ab ' + w.need + ' ★. Du hast ' + S.pts + ' ★.')]),
        };
      });
      choices.push({ t: 'Später', fn: () => {} });
      Dialog.open([Object.assign(narr('Regal „' + topic.name + '“. Hier stehen zwei besondere Bücher. Welches schlägst du auf?'), { choices })]);
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
      if (shelfState(sh).done && Math.random() < dt * 12) {
        sparks.push({ x: sh.px + 2 + Math.random() * 28, y: sh.py + 2 + Math.random() * 28, t: 0, life: 0.5 + Math.random() * 0.5, col: Math.random() < 0.5 ? '#ffd977' : '#fff7c2', tw: true });
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

  // Zustand eines Regals mit Buchwelt(en): bereit (leuchtet, ★) / erlebt (glitzert)
  function shelfState(sh) {
    let ready = false;
    let done = false;
    for (const id of sh.worlds) {
      if (S.worldsDone.includes(id)) done = true;
      else if (worldUnlocked(id)) ready = true;
    }
    return { ready, done };
  }

  function shelfFor(id) {
    const w = WORLDS[id];
    const F2 = floors[w.floor];
    if (!F2) return null;
    const sh = F2.shelves.find((x) => x.worlds.includes(id));
    return sh ? { floor: w.floor, shelf: sh } : null;
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
      if (shelfState(sh).ready) {
        const a = 0.35 + 0.25 * Math.sin(time * 4);
        g.fillStyle = `rgba(255,240,170,${a})`;
        g.fillRect(sh.px + 3 - ox, sh.py + 5 - oy, 26, 1);
        g.fillRect(sh.px + 3 - ox, sh.py + 29 - oy, 26, 1);
        drawBubble(g, sh.px + 16 - ox, sh.py - 1 - oy + Math.round(Math.sin(time * 3)), '★', '#c98f1c');
      }
    }
    for (const s of sparks) {
      const k = 1 - s.t / s.life;
      if (s.tw) {
        // Glitzern: kleiner Stern, der auf- und wieder abblendet
        g.globalAlpha = 1;
        drawTwinkle(g, s.x - ox, s.y - oy, Math.sin((s.t / s.life) * Math.PI), s.col);
        continue;
      }
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
      return 'Sammle ' + w.need + ' ★ für „' + w.title + '“ – alle Buchwelten: ' + (Input.touch ? 'Knopf „Bücher“' : '[B]');
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
    init, start, update, draw, persist, addPoints, checkBadges, requestSave, miniInfo, worldUnlocked, shelfFor,
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
  // Aufgeschlagenes Buch: Position und Größe
  const BX = 22;
  const BY = 14;
  const BW = 340;
  const BH = 186;
  const TEXT_W = BW / 2 - 26;
  // Zeilen, die auf die rechte Seite passen, ohne die Seitenzahl zu berühren
  const MAX_LINES = Math.floor((BH - 39) / Font.LINE) + 1;
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
    const bx = BX;
    const by = BY;
    const bw = BW;
    const bh = BH;
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
    const lines = Font.wrap(p.text, TEXT_W);
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

  return {
    show, update, draw, close, active: () => !!pages,
    metrics: Object.freeze({ textW: TEXT_W, maxLines: MAX_LINES, titleW: BW / 2 - 12 }),
  };
})();

// --- Gemeinsame Helfer für Buchwelten ------------------------------
// Kopfleiste: Titel links, Zähler rechts (optional mit kleinem Bild)
function drawWorldHud(g, title, right, icon) {
  const w = Font.measure(title) + 14;
  drawPanel(g, 4, 4, w, 15);
  Font.draw(g, title, 10, 6, '#ffd977');
  if (right) {
    const iw = icon ? icon.width + 3 : 0;
    const rw = Font.measure(right) + 14 + iw;
    drawPanel(g, VIEW_W - rw - 4, 4, rw, 15);
    let x = VIEW_W - rw + 3;
    if (icon) {
      g.drawImage(icon, x, 4 + Math.round((15 - icon.height) / 2));
      x += iw;
    }
    Font.draw(g, right, x, 6, UI_COL.text);
  }
}

// Kurze Meldung (unten oder an fester Höhe)
function drawWorldMsg(g, text, y) {
  const lines = Font.wrap(text, 330);
  const h = lines.length * Font.LINE + 6;
  const yy = y === undefined ? VIEW_H - h - 6 : y;
  drawPanel(g, 22, yy, 340, h);
  lines.forEach((l, i) => Font.draw(g, l, 30, yy + 3 + i * Font.LINE, UI_COL.text));
}

function rewardLine(first, pts) {
  return first ? '\n\n+' + pts + ' ★' : '';
}

// Großes Emblem aus der Bücherliste als Bild auf der Buchseite
function emblemIcon(id, size = 48) {
  return (g, x, y) => g.drawImage(BOOK_EMBLEMS[id].c, Math.round(x - size / 2), Math.round(y - size * 0.62), size, size);
}

// Sternenhimmel (gleichbleibend, leicht funkelnd)
function drawStars(g, seed, n, t, x0 = 0, y0 = 0, w = VIEW_W, h = VIEW_H) {
  const r = makeRng(seed);
  for (let i = 0; i < n; i++) {
    const x = x0 + Math.floor(r() * w);
    const y = y0 + Math.floor(r() * h);
    const tw = 0.5 + 0.5 * Math.sin(t * (1 + r() * 2) + i);
    g.globalAlpha = 0.35 + 0.65 * tw * r();
    rect(g, x, y, 1, 1, r() < 0.15 ? '#ffe9a8' : '#ffffff');
  }
  g.globalAlpha = 1;
}

// ===================================================================
// Buchwelt: Moby Dick – Ausguck auf der Pequod
// ===================================================================
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
// Buchwelt: Hänsel und Gretel – im Mondlicht den Kieselsteinen folgen
// ===================================================================
const HaenselWorld = (() => {
  const CW = 12;
  const CH = 7;
  const MW = CW * 3 + 1;
  const MH = CH * 3 + 1;
  const HOUSE = { tx: 1, ty: 1, tw: 3, th: 2 };
  let grid = null;
  let layer = null;
  let dark = null;
  let dg = null;
  let pathTiles = [];
  let candy = null;
  let phase = 'intro';
  let t = 0;
  let p = null;
  let gretel = null;
  let trail = [];
  let pebbles = [];
  let found = 0;
  let msg = null;
  let camX = 0;
  let camY = 0;
  let owl = null;
  let owlT = 7;
  let flies = [];
  let homeT = 0;
  let darkSaid = false;
  let candySaid = false;
  let onExit = null;
  let firstTime = true;
  let result = null;

  const looks = {
    haensel: mkLook('short', 'blonde', 'light', '#6b8f3a', '#5c4033'),
    gretel: mkLook('long', 'blonde', 'light', '#b8453a', '#7a2f2a'),
    vater: mkLook('short', 'brown', 'light', '#7a5a3a', '#4a3a2a', 'beard'),
  };
  const HOME = { x: 2 * TS + 8, y: 3 * TS + 10 };
  const WINDOW = { x: HOUSE.tx * TS + 11, y: HOUSE.ty * TS + 17 };

  const solid = (tx, ty) => tx < 0 || ty < 0 || tx >= MW || ty >= MH || grid[ty * MW + tx] !== 0;

  // --- Wald (Irrgarten mit 2 Kacheln breiten Wegen) ------------------
  function buildMaze() {
    const r = makeRng(1812);
    grid = new Uint8Array(MW * MH).fill(1);
    const open = (x, y) => { grid[y * MW + x] = 0; };
    const cell = (cx, cy) => { for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) open(cx * 3 + 1 + dx, cy * 3 + 1 + dy); };
    const between = (ax, ay, bx, by) => {
      if (ax !== bx) { const wx = Math.max(ax, bx) * 3; for (let dy = 0; dy < 2; dy++) open(wx, ay * 3 + 1 + dy); }
      else { const wy = Math.max(ay, by) * 3; for (let dx = 0; dx < 2; dx++) open(ax * 3 + 1 + dx, wy); }
    };
    const seen = new Uint8Array(CW * CH);
    const stack = [[CW - 1, CH - 1]];
    seen[CW * CH - 1] = 1;
    cell(CW - 1, CH - 1);
    while (stack.length) {
      const [cx, cy] = stack[stack.length - 1];
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [cx + dx, cy + dy])
        .filter(([x, y]) => x >= 0 && y >= 0 && x < CW && y < CH && !seen[y * CW + x]);
      if (!nb.length) { stack.pop(); continue; }
      const [nx, ny] = nb[Math.floor(r() * nb.length)];
      seen[ny * CW + nx] = 1;
      cell(nx, ny);
      between(cx, cy, nx, ny);
      stack.push([nx, ny]);
    }
    for (let k = 0; k < 8; k++) {
      const cx = Math.floor(r() * (CW - 1));
      const cy = Math.floor(r() * (CH - 1));
      if (r() < 0.5) between(cx, cy, cx, cy + 1); else between(cx, cy, cx + 1, cy);
    }
    // Lichtung mit dem Haus des Holzhackers
    for (let y = 1; y <= 5; y++) for (let x = 1; x <= 5; x++) open(x, y);
    for (let y = HOUSE.ty; y < HOUSE.ty + HOUSE.th; y++) for (let x = HOUSE.tx; x < HOUSE.tx + HOUSE.tw; x++) grid[y * MW + x] = 2;
  }

  function bfs(starts) {
    const dist = new Int32Array(MW * MH).fill(-1);
    const prev = new Int32Array(MW * MH).fill(-1);
    const q = [];
    for (const [x, y] of starts) { dist[y * MW + x] = 0; q.push(y * MW + x); }
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi];
      const x = i % MW;
      const y = (i - x) / MW;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (solid(nx, ny)) continue;
        const j = ny * MW + nx;
        if (dist[j] >= 0) continue;
        dist[j] = dist[i] + 1;
        prev[j] = i;
        q.push(j);
      }
    }
    return { dist, prev };
  }

  function planPath() {
    const start = [(CW - 1) * 3 + 1, (CH - 1) * 3 + 2];
    const { prev } = bfs([start]);
    const goal = Math.floor(HOME.y / TS) * MW + Math.floor(HOME.x / TS);
    pathTiles = [];
    for (let i = goal; i >= 0; i = prev[i]) pathTiles.push([i % MW, Math.floor(i / MW)]);
    pathTiles.reverse();
    // Knusperhäuschen: die Sackgasse, die am weitesten vom Heimweg entfernt liegt
    const away = bfs(pathTiles).dist;
    let best = null;
    for (let cy = 0; cy < CH; cy++) {
      for (let cx = 0; cx < CW; cx++) {
        if (cx < 2 && cy < 2) continue;
        const x = cx * 3 + 1;
        const y = cy * 3 + 1;
        let exits = 0;
        if (!solid(x - 1, y)) exits++;
        if (!solid(x + 2, y)) exits++;
        if (!solid(x, y - 1)) exits++;
        if (!solid(x, y + 2)) exits++;
        const d = away[y * MW + x];
        const far = Math.hypot(x - start[0], y - start[1]) > 14;
        if (exits === 1 && d > 0 && far && (!best || d > best.d)) best = { cx, cy, d };
      }
    }
    candy = best ? { tx: best.cx * 3 + 1, ty: best.cy * 3 + 1 } : null;
    if (candy) { grid[candy.ty * MW + candy.tx] = 2; grid[candy.ty * MW + candy.tx + 1] = 2; }
  }

  function renderLayer() {
    const c = makeCanvas(MW * TS, MH * TS);
    const g = c.getContext('2d');
    const r = makeRng(77);
    rect(g, 0, 0, c.width, c.height, '#1b2a21');
    for (let i = 0; i < 2600; i++) {
      rect(g, Math.floor(r() * c.width), Math.floor(r() * c.height), 1 + Math.floor(r() * 2), 1, pick(['#22352a', '#16231b', '#2c3a22', '#3b3420'], r));
    }
    for (let ty = 0; ty < MH; ty++) {
      for (let tx = 0; tx < MW; tx++) {
        if (grid[ty * MW + tx] !== 1) continue;
        const x = tx * TS;
        const y = ty * TS;
        const kind = r();
        rect(g, x + 6, y + 9, 4, 7, '#3a2618');
        rect(g, x + 6, y + 9, 1, 7, '#4d3420');
        if (kind < 0.35) {
          // Tanne
          for (let k = 0; k < 3; k++) {
            const w = 6 + k * 3;
            const yy = y - 1 + k * 4;
            for (let j = 0; j < 4; j++) rect(g, x + 8 - Math.floor((w * (j + 1)) / 8), yy + j, Math.floor((w * (j + 1)) / 4), 1, j === 3 ? '#163522' : '#1f4a2c');
          }
          rect(g, x + 7, y - 2, 2, 2, '#2a5b3a');
        } else {
          const base = pick(['#1f4a2c', '#24563a', '#1d4330'], r);
          for (let yy = -8; yy <= 8; yy++) {
            for (let xx = -8; xx <= 8; xx++) {
              const d = xx * xx + yy * yy;
              if (d > 64 + Math.floor(r() * 6)) continue;
              let col = base;
              if (xx + yy < -6) col = shade(base, 0.22);
              else if (xx + yy > 7) col = shade(base, -0.28);
              px(g, x + 8 + xx, y + 5 + yy, col);
            }
          }
          for (let k = 0; k < 4; k++) px(g, x + 3 + Math.floor(r() * 10), y + Math.floor(r() * 8), shade(base, 0.35));
        }
      }
    }
    // Haus des Holzhackers
    const hx = HOUSE.tx * TS;
    const hy = HOUSE.ty * TS;
    rect(g, hx + 2, hy + 6, 44, 26, '#2b1d1f');
    rect(g, hx + 3, hy + 7, 42, 24, '#9c7344');
    for (let i = 0; i < 6; i++) rect(g, hx + 3, hy + 9 + i * 4, 42, 1, '#7d5a33');
    for (let i = 0; i < 12; i++) rect(g, hx + 24 - i * 2 - 2, hy - 6 + i, 4 + i * 4, 1, i % 3 === 0 ? '#5e2a1f' : '#7a3b2a');
    rect(g, hx + 31, hy - 8, 5, 8, '#5a4a44');
    rect(g, hx + 19, hy + 18, 10, 13, '#4a2c1a');
    rect(g, hx + 27, hy + 24, 1, 2, '#d9b24a');
    rect(g, hx + 7, hy + 13, 9, 8, '#2b1d1f');
    rect(g, hx + 8, hy + 14, 7, 6, '#ffd977');
    rect(g, hx + 11, hy + 14, 1, 6, '#8a5a32');
    rect(g, hx + 8, hy + 16, 7, 1, '#8a5a32');
    // Knusperhäuschen in einer Sackgasse
    if (candy) {
      const x = candy.tx * TS;
      const y = candy.ty * TS - 6;
      rect(g, x + 1, y + 8, 30, 22, '#2b1d1f');
      rect(g, x + 2, y + 9, 28, 20, '#b5713a');
      for (let i = 0; i < 4; i++) rect(g, x + 2, y + 12 + i * 5, 28, 1, '#fbf3e4');
      for (let i = 0; i < 9; i++) rect(g, x + 16 - i * 2 - 1, y + i, 2 + i * 4, 1, '#fbf3e4');
      for (const [cx2, cy2, col] of [[9, 5, '#e0115f'], [16, 2, '#3b8f5a'], [22, 6, '#2f6fb0'], [12, 7, '#f5cf4f']]) rect(g, x + cx2, y + cy2, 2, 2, col);
      rect(g, x + 12, y + 20, 8, 9, '#6e3b1d');
      rect(g, x + 5, y + 16, 5, 5, '#f7b6c8');
      rect(g, x + 22, y + 16, 5, 5, '#f7b6c8');
    }
    return c;
  }

  function placeThings() {
    pebbles = [];
    const r = makeRng(5);
    const stepN = Math.max(3, Math.round(pathTiles.length / 30));
    for (let i = 3; i < pathTiles.length - 3; i += stepN) {
      const [tx, ty] = pathTiles[i];
      pebbles.push({ x: tx * TS + 6 + Math.floor(r() * 5), y: ty * TS + 7 + Math.floor(r() * 5), got: false, s: Math.floor(r() * 3) });
    }
    flies = [];
    for (let k = 0; k < 9; k++) {
      const [tx, ty] = pathTiles[Math.floor(r() * pathTiles.length)];
      const bx = tx * TS + 8 + (r() - 0.5) * 30;
      const by = ty * TS + 8 + (r() - 0.5) * 30;
      flies.push({ bx, by, x: bx, y: by, ph: r() * 10 });
    }
  }

  function enter(exitCb, first) {
    onExit = exitCb;
    firstTime = first;
    if (!grid) {
      buildMaze();
      planPath();
      layer = renderLayer();
      dark = makeCanvas(VIEW_W, VIEW_H);
      dg = dark.getContext('2d');
    }
    placeThings();
    phase = 'intro';
    t = 0;
    found = 0;
    msg = null;
    owl = null;
    owlT = 7;
    homeT = 0;
    darkSaid = false;
    candySaid = false;
    result = null;
    const [sx, sy] = pathTiles[0];
    p = { x: sx * TS + 8, y: sy * TS + 12, dir: 'up', anim: 0, moving: false, spr: charSprites(looks.haensel) };
    gretel = { x: p.x + 10, y: p.y, dir: 'up', anim: 0, moving: false, spr: charSprites(looks.gretel) };
    trail = [];
    snapCam();
    Sound.play('forest');
    const icon = emblemIcon('haensel');
    StoryCard.show([
      { title: 'Hänsel und Gretel', sub: 'Brüder Grimm · 1812', icon, text: 'Vor einem großen Wald wohnt ein armer Holzhacker mit seinen Kindern Hänsel und Gretel. Das Brot reicht nicht mehr für alle. Da beschließt die Stiefmutter: Die Kinder bleiben im Wald.\n\nHänsel hat alles gehört. In der Nacht schleicht er hinaus und steckt sich die Taschen voll weißer Kieselsteine.' },
      { title: 'Hänsel und Gretel', sub: 'Nachts im Wald', icon, text: 'Auf dem Weg in den Wald hat Hänsel heimlich einen Stein nach dem anderen fallen lassen. Jetzt ist es Nacht, und die Kinder sind allein.\n\n„Wart nur, Gretel, bis der Mond aufgeht“, sagt Hänsel.\n\n↑↓←→ gehen · Folge den Kieselsteinen nach Hause!' },
    ], () => {
      phase = 'walk';
      msg = { text: 'Die Kieselsteine schimmern im Mondlicht. Verschwindet der Mond hinter Wolken, wird es dunkel – dann kurz warten!', t: 6 };
    });
  }

  function snapCam() {
    camX = clamp(Math.round(p.x - VIEW_W / 2), 0, MW * TS - VIEW_W);
    camY = clamp(Math.round(p.y - 8 - VIEW_H / 2), 0, MH * TS - VIEW_H);
  }

  function moon() {
    return clamp(0.62 + 0.4 * Math.sin(t * 0.3) + 0.12 * Math.sin(t * 1.07), 0.1, 1);
  }

  function free(x, y) {
    for (const [ax, ay] of [[x - 4, y - 5], [x + 3, y - 5], [x - 4, y - 1], [x + 3, y - 1]]) {
      if (solid(Math.floor(ax / TS), Math.floor(ay / TS))) return false;
    }
    return true;
  }

  function update(dt) {
    t += dt;
    for (const f of flies) {
      f.x = f.bx + Math.sin(t * 0.7 + f.ph) * 14;
      f.y = f.by + Math.cos(t * 0.9 + f.ph * 1.3) * 9;
    }
    if (StoryCard.update(dt)) return;
    if (msg) {
      msg.t -= dt;
      if (msg.t <= 0) msg = null;
    }
    if (phase === 'walk') updateWalk(dt);
    else if (phase === 'home') updateHome(dt);
  }

  function updateWalk(dt) {
    let mx = 0;
    let my = 0;
    if (Input.down('left')) mx -= 1;
    if (Input.down('right')) mx += 1;
    if (Input.down('up')) my -= 1;
    if (Input.down('down')) my += 1;
    p.moving = false;
    if (mx || my) {
      const sp = (Input.down('run') ? 82 : 58) * dt;
      const len = Math.hypot(mx, my);
      const vx = (mx / len) * sp;
      const vy = (my / len) * sp;
      if (Math.abs(mx) >= Math.abs(my)) p.dir = mx < 0 ? 'left' : 'right';
      else p.dir = my < 0 ? 'up' : 'down';
      if (vx && free(p.x + vx, p.y)) { p.x += vx; p.moving = true; }
      if (vy && free(p.x, p.y + vy)) { p.y += vy; p.moving = true; }
      if (p.moving) {
        p.anim += dt * 8;
        trail.push({ x: p.x, y: p.y, dir: p.dir });
        if (trail.length > 40) trail.shift();
      }
    }
    // Gretel geht hinterher
    gretel.moving = false;
    if (trail.length > 14) {
      const tgt = trail[trail.length - 14];
      if (Math.hypot(tgt.x - gretel.x, tgt.y - gretel.y) > 0.5) {
        gretel.moving = true;
        gretel.anim += dt * 8;
      }
      gretel.x = tgt.x;
      gretel.y = tgt.y;
      gretel.dir = tgt.dir;
    }
    // Kieselsteine
    for (const pb of pebbles) {
      if (!pb.got && Math.abs(pb.x - p.x) < 10 && Math.abs(pb.y - (p.y - 3)) < 10) {
        pb.got = true;
        found++;
        Sound.sfx('pebble');
      }
    }
    const m = moon();
    if (m < 0.25 && !darkSaid) {
      darkSaid = true;
      msg = { text: 'Gretel: „Ich seh fast nichts mehr!“ – Hänsel: „Gleich kommt der Mond wieder hinter den Wolken hervor.“', t: 5 };
    }
    if (candy && !candySaid && Math.hypot(p.x - (candy.tx * TS + 16), p.y - (candy.ty * TS + 20)) < 34) {
      candySaid = true;
      msg = { text: 'Riecht es hier nach Lebkuchen? Ein Häuschen aus Brot und Zucker … Das gehört aber in einen anderen Teil des Märchens. Schnell weiter!', t: 6 };
      Sound.sfx('bell');
    }
    // Uhu
    owlT -= dt;
    if (owlT <= 0) {
      owlT = 10 + Math.random() * 6;
      const cands = [];
      for (let ty = Math.floor(camY / TS); ty < Math.floor((camY + VIEW_H) / TS); ty++) {
        for (let tx = Math.floor(camX / TS); tx < Math.floor((camX + VIEW_W) / TS); tx++) {
          if (grid[ty * MW + tx] === 1 && Math.hypot(tx * TS - p.x, ty * TS - p.y) > 60) cands.push([tx, ty]);
        }
      }
      if (cands.length) {
        const [tx, ty] = cands[Math.floor(Math.random() * cands.length)];
        owl = { x: tx * TS + 8, y: ty * TS + 4, t: 2.6 };
        Sound.sfx('owl');
      }
    }
    if (owl) {
      owl.t -= dt;
      if (owl.t <= 0) owl = null;
    }
    // Daheim?
    if (Math.hypot(p.x - HOME.x, p.y - HOME.y) < 14) {
      phase = 'home';
      homeT = 0;
      p.moving = false;
      gretel.moving = false;
      p.dir = 'up';
      Sound.sfx('door');
    }
    followCam(dt);
  }

  function followCam(dt) {
    const tx = clamp(Math.round(p.x - VIEW_W / 2), 0, MW * TS - VIEW_W);
    const ty = clamp(Math.round(p.y - 8 - VIEW_H / 2), 0, MH * TS - VIEW_H);
    camX += (tx - camX) * Math.min(1, dt * 8);
    camY += (ty - camY) * Math.min(1, dt * 8);
  }

  function updateHome(dt) {
    homeT += dt;
    if (homeT > 1.2 && homeT - dt <= 1.2) {
      msg = { text: 'Der Vater reißt die Tür auf: „Hänsel! Gretel! Da seid ihr ja!“', t: 4 };
      Sound.sfx('talk');
    }
    followCam(dt);
    if (homeT > 4.6) {
      phase = 'outro';
      const total = pebbles.length;
      const pts = 20 + Math.round((10 * found) / Math.max(1, total));
      result = { world: 'haensel', pts };
      const icon = emblemIcon('haensel');
      StoryCard.show([
        { title: 'Zuhause!', sub: 'Hänsel und Gretel', icon, text: 'Als der Morgen dämmert, stehen Hänsel und Gretel vor ihrem Haus. Der Vater schließt sie überglücklich in die Arme – er hatte keine ruhige Minute mehr.\n\nDu hast ' + found + ' von ' + total + ' Kieselsteinen gefunden.' },
        { title: 'Wie geht es weiter?', sub: 'Brüder Grimm', icon, text: 'Bald ist das Brot wieder knapp. Diesmal hat Hänsel nur Brotkrumen dabei – und die Vögel picken sie auf. Wer dann tief im Wald in einem Häuschen aus Brot und Zucker wohnt? Lies selbst!\n\nMärchen wie dieses findest du bei den Bilderbüchern im Kirango.' + rewardLine(firstTime, pts) },
      ], () => onExit(result));
    }
  }

  // --- Zeichnen ------------------------------------------------------
  function drawActor(g, a, ox, oy) {
    const frames = a.spr[a.dir];
    const f = a.moving ? frames[Math.floor(a.anim) % 4] : frames[0];
    const x = Math.round(a.x - 8 - ox);
    const y = Math.round(a.y - 15 - oy);
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(x + 4, Math.round(a.y - oy) - 2, 8, 2);
    g.drawImage(f, x, y);
  }

  function hole(x, y, r, a = 1) {
    const gr = dg.createRadialGradient(x, y, r * 0.2, x, y, r);
    gr.addColorStop(0, 'rgba(0,0,0,' + a + ')');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    dg.fillStyle = gr;
    dg.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function draw(g) {
    if (phase === 'intro' || (phase === 'outro' && StoryCard.active())) {
      StoryCard.draw(g);
      return;
    }
    const ox = Math.round(camX);
    const oy = Math.round(camY);
    const m = moon();
    g.drawImage(layer, ox, oy, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);
    for (const pb of pebbles) {
      if (pb.got) continue;
      const x = Math.round(pb.x - ox);
      const y = Math.round(pb.y - oy);
      if (x < -4 || y < -4 || x > VIEW_W + 4 || y > VIEW_H + 4) continue;
      rect(g, x - 1, y, 3 + (pb.s === 2 ? 1 : 0), 2, '#c9c6bd');
      rect(g, x - 1, y, 1, 1, '#ffffff');
    }
    const actors = [gretel, p].slice().sort((a, b) => a.y - b.y);
    for (const a of actors) drawActor(g, a, ox, oy);
    if (phase === 'home' && homeT > 1.0) {
      const vs = charSprites(looks.vater);
      g.drawImage(vs.down[0], Math.round(2 * TS + 1 - ox), Math.round(2 * TS + 3 - oy));
    }
    // Dunkelheit (am Ende dämmert es)
    const dawn = phase === 'home' ? clamp(homeT / 3, 0, 1) : 0;
    dg.globalCompositeOperation = 'source-over';
    dg.clearRect(0, 0, VIEW_W, VIEW_H);
    dg.fillStyle = 'rgba(5,7,20,' + ((0.97 - 0.13 * m) * (1 - dawn * 0.85)) + ')';
    dg.fillRect(0, 0, VIEW_W, VIEW_H);
    dg.globalCompositeOperation = 'destination-out';
    hole(p.x - ox, p.y - 8 - oy, 30 + 46 * m);
    hole(WINDOW.x - ox, WINDOW.y - oy, 52, 0.9);
    for (const f of flies) hole(f.x - ox, f.y - oy, 8, 0.7);
    dg.globalCompositeOperation = 'source-over';
    if (dawn > 0) {
      dg.fillStyle = 'rgba(255,170,120,' + (0.12 * dawn) + ')';
      dg.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    g.drawImage(dark, 0, 0);
    // Kieselsteine schimmern im Mondlicht auch in der Dunkelheit
    const range = 70 + 170 * m;
    pebbles.forEach((pb, i) => {
      if (pb.got) return;
      const d = Math.hypot(pb.x - p.x, pb.y - p.y);
      const a = m * clamp(1 - d / range, 0, 1) * (0.7 + 0.3 * Math.sin(t * 3 + i * 1.7));
      if (a <= 0.03) return;
      g.globalAlpha = a;
      const x = Math.round(pb.x - ox);
      const y = Math.round(pb.y - oy);
      rect(g, x - 1, y, 3, 2, '#f4f2ff');
      if (a > 0.5) { rect(g, x, y - 1, 1, 4, '#dfe6ff'); rect(g, x - 2, y + 0, 5, 1, '#dfe6ff'); }
      g.globalAlpha = 1;
    });
    // Glühwürmchen
    for (const f of flies) {
      const a = 0.5 + 0.5 * Math.sin(t * 4 + f.ph * 3);
      g.globalAlpha = a;
      rect(g, Math.round(f.x - ox), Math.round(f.y - oy), 1, 1, '#e6ff8a');
      g.globalAlpha = 1;
    }
    if (owl && Math.floor(owl.t * 5) % 7 !== 0) {
      const x = Math.round(owl.x - ox);
      const y = Math.round(owl.y - oy);
      rect(g, x - 3, y, 2, 2, '#ffd23f');
      rect(g, x + 2, y, 2, 2, '#ffd23f');
    }
    // HUD mit Mond
    drawWorldHud(g, 'Hänsel und Gretel', found + ' / ' + pebbles.length, PEBBLE_ICON);
    const mx = 192;
    for (let yy = -5; yy <= 5; yy++) for (let xx = -5; xx <= 5; xx++) {
      if (xx * xx + yy * yy <= 25) px(g, mx + xx, 11 + yy, xx * xx + yy * yy > 16 ? '#c9c3a6' : '#fff6cf');
    }
    g.globalAlpha = clamp(1 - m, 0, 0.9);
    rect(g, mx - 9, 8, 18, 4, '#5b6378');
    rect(g, mx - 7, 12, 14, 3, '#4a5166');
    g.globalAlpha = 1;
    if (msg) drawWorldMsg(g, msg.text, 24);
    if (StoryCard.active()) StoryCard.draw(g);
  }

  const PEBBLE_ICON = buildSprite(['.kkk.', 'kWWgk', 'kWggk', '.kkk.']);

  return {
    enter, update, draw,
    debug: () => ({ phase, p, pebbles, found, home: HOME, path: pathTiles, candy, solid, size: [MW, MH] }),
  };
})();

// ===================================================================
// Buchwelt: Alan Turing – „Können Maschinen denken?“ (1950)
// Das Imitationsspiel: Wer am Fernschreiber ist Mensch, wer Maschine?
// ===================================================================
const TuringWorld = (() => {
  const ROUNDS = deepFreeze([
    {
      intro: 'Hinter Tür A und Tür B steht je ein Fernschreiber. An einem tippt ein Mensch, am anderen antwortet unsere Rechenmaschine. Stell zwei Fragen – dann rate!',
      qs: [
        { q: 'Was ist 34957 plus 70764?', human: 'Puh. Moment … ich brauch Papier … 105.721? Ohne Gewähr!', hd: 2.6, machine: '105721', md: 0.15 },
        { q: 'Magst du lieber Sommer oder Winter?', human: 'Winter! Schnee, heißer Tee und ein gutes Buch.', hd: 1.2, machine: 'Sommer. Im Sommer ist es warm.', md: 0.3 },
        { q: 'Schreib mir ein Gedicht über eine Brücke.', human: 'Eine Brücke, die ist lang … mehr fällt mir nicht ein, sorry!', hd: 2.0, machine: 'Da muss ich passen. Gedichte konnte ich noch nie.', md: 0.4 },
      ],
      explain: 'Verraten hat sie das Tempo: Eine Rechenaufgabe löst die Maschine in einem Wimpernschlag. Und ihre Antworten sind kurz und ein bisschen steif.',
    },
    {
      intro: 'Jetzt wird es schwieriger. Ich habe der Maschine beigebracht, sich zu tarnen: Sie lässt sich Zeit – und baut absichtlich Fehler ein.',
      qs: [
        { q: 'Was ist 34957 plus 70764?', human: '105.721. Ich bin Buchhalterin, das kann ich im Schlaf.', hd: 1.6, machine: '… 105621', md: 3.0 },
        { q: 'Was hast du heute gefrühstückt?', human: 'Nichts – ich hab verschlafen. Mein Magen knurrt!', hd: 1.0, machine: 'Ein Butterbrot. Ein Butterbrot. Ein Butterbrot mit Marmelade.', md: 0.6 },
        { q: 'Wie ist das Wetter bei dir?', human: 'Grau. Typisch Manchester – es nieselt schon wieder.', hd: 1.1, machine: 'Das Wetter ist angenehm.', md: 0.5 },
      ],
      explain: 'Rechnen half diesmal nicht: Die Maschine hat gezögert und sich verrechnet – wie ein Mensch. Verraten haben sie die seltsam wiederholten, allgemeinen Antworten.',
    },
    {
      intro: 'Letzte Runde. Das ist meine beste Maschine. Achte darauf, wer wirklich etwas erlebt hat.',
      qs: [
        { q: 'Was hat dich zuletzt zum Lachen gebracht?', human: 'Mein Hund ist in eine Pfütze gesprungen und hat dann beleidigt geschaut, als wär es meine Schuld!', hd: 1.4, machine: 'Ein Witz. Er war sehr lustig. Ich habe sehr gelacht.', md: 0.8 },
        { q: 'Erzähl von deinem liebsten Ort.', human: 'Der Dachboden bei meiner Oma. Dort roch es nach alten Büchern und Lavendel.', hd: 1.5, machine: 'Mein liebster Ort ist ein schöner Ort, an dem ich gerne bin.', md: 0.9 },
        { q: 'Bist du eine Maschine?', human: 'Nein! Was für eine Frage. Bist DU eine?', hd: 0.9, machine: 'Nein. Ich bin ein ganz normaler Mensch mit ganz normalen Hobbys.', md: 0.8 },
      ],
      explain: 'Sie klang freundlich, aber ihre Antworten waren leer: keine Erinnerungen, keine Gerüche, kein Hund in der Pfütze. Echte Erlebnisse lassen sich schwer fälschen.',
    },
  ]);
  const TURING = { name: 'Alan Turing', look: mkLook('short', 'black', 'light', '#6b5a45', '#3d3a35') };
  const CPS = 30;
  const DOOR_X = { A: 258, B: 318 };

  let phase = 'intro';
  let t = 0;
  let round = 0;
  let machine = 'A';
  let asked = [];
  let sel = 0;
  let guess = 'A';
  let paper = [];
  let job = null;
  let correct = 0;
  let onExit = null;
  let firstTime = true;
  let result = null;

  function enter(exitCb, first) {
    onExit = exitCb;
    firstTime = first;
    phase = 'intro';
    t = 0;
    round = 0;
    correct = 0;
    result = null;
    Sound.play('lab');
    const icon = emblemIcon('turing');
    StoryCard.show([
      { title: 'Können Maschinen denken?', sub: 'Alan Turing · 1950', icon, text: 'Manchester, 1950. Der Mathematiker Alan Turing arbeitet an einem der ersten Computer der Welt. Eine Frage lässt ihn nicht los: Können Maschinen denken?\n\nStatt endlos darüber zu streiten, erfindet er ein Spiel.' },
      { title: 'Das Imitationsspiel', sub: 'Mensch oder Maschine?', icon, text: 'Hinter zwei Türen stehen Fernschreiber. An einem tippt ein Mensch, am anderen antwortet eine Maschine. Du stellst Fragen – nur schriftlich.\n\nKannst du herausfinden, wer die Maschine ist?\n\n↑↓ Frage wählen · E fragen · ←→ Tür wählen' },
    ], () => startRound());
  }

  function startRound() {
    const R = ROUNDS[round];
    machine = Math.random() < 0.5 ? 'A' : 'B';
    asked = [];
    sel = 0;
    guess = 'A';
    paper = [];
    job = null;
    phase = 'talk';
    Dialog.open([npcPage(TURING, (round === 0 ? '' : 'Neues Papier, neue Runde! ') + R.intro)], () => { phase = 'ask'; });
  }

  function openQuestions() {
    return ROUNDS[round].qs.map((q, i) => i).filter((i) => !asked.includes(i));
  }

  function ask(i) {
    const q = ROUNDS[round].qs[i];
    asked.push(i);
    const ans = (side) => (side === machine ? { text: q.machine, delay: q.md } : { text: q.human, delay: q.hd });
    job = { steps: [
      { who: 'Du', text: q.q, delay: 0.2 },
      Object.assign({ who: 'A' }, ans('A')),
      Object.assign({ who: 'B' }, ans('B')),
    ], i: 0, wait: 0.2, shown: 0, line: null };
    phase = 'typing';
    sel = 0;
  }

  function update(dt) {
    t += dt;
    if (StoryCard.update(dt)) return;
    if (phase === 'ask') {
      const open = openQuestions();
      if (Input.hit('up')) { sel = (sel + open.length - 1) % open.length; Sound.sfx('blip'); }
      if (Input.hit('down')) { sel = (sel + 1) % open.length; Sound.sfx('blip'); }
      if (Input.confirm()) { Sound.sfx('select'); ask(open[sel]); }
    } else if (phase === 'typing') {
      updateTyping(dt);
    } else if (phase === 'guess') {
      if (Input.hit('left')) { guess = 'A'; Sound.sfx('blip'); }
      if (Input.hit('right')) { guess = 'B'; Sound.sfx('blip'); }
      if (Input.confirm()) decide();
    }
  }

  function updateTyping(dt) {
    const st = job.steps[job.i];
    if (!job.line) {
      job.wait -= dt;
      if (job.wait > 0) return;
      job.line = { who: st.who, text: st.text, shown: 0 };
      paper.push(job.line);
    }
    const fast = Input.down('act') || Input.down('jump') ? 4 : 1;
    const before = Math.floor(job.line.shown);
    job.line.shown = Math.min(st.text.length, job.line.shown + dt * CPS * fast);
    if (Math.floor(job.line.shown) !== before && Math.floor(job.line.shown) % 2 === 0) Sound.sfx('type');
    if (job.line.shown >= st.text.length) {
      job.i++;
      job.line = null;
      if (job.i >= job.steps.length) {
        job = null;
        if (asked.length >= 2) {
          phase = 'guess';
        } else {
          phase = 'ask';
        }
        return;
      }
      job.wait = job.steps[job.i].delay;
    }
  }

  function decide() {
    const ok = guess === machine;
    if (ok) correct++;
    Sound.sfx(ok ? 'correct' : 'wrong');
    phase = 'talk';
    const head = ok ? 'Richtig erkannt! Die Maschine war ' + machine + '. ' : 'Knapp daneben – die Maschine war ' + machine + '. ';
    Dialog.open([npcPage(TURING, head + ROUNDS[round].explain)], () => {
      round++;
      if (round < ROUNDS.length) startRound();
      else finish();
    });
  }

  function finish() {
    phase = 'outro';
    const pts = 20 + Math.round((10 * correct) / ROUNDS.length);
    result = { world: 'turing', pts };
    const icon = emblemIcon('turing');
    StoryCard.show([
      { title: 'Das Imitationsspiel', sub: 'Alan Turing · 1950', icon, text: 'Du hast ' + correct + ' von ' + ROUNDS.length + ' Maschinen entlarvt.\n\nTuring schrieb 1950, er rechne damit, dass Computer um das Jahr 2000 so gut antworten, dass man nach fünf Minuten Fragen in fast jedem dritten Fall falsch rät.' },
      { title: 'Und heute?', sub: 'Können Maschinen denken?', icon, text: 'Heute plaudern wir täglich mit Maschinen – mit Sprachassistenten und KI-Chatbots. Oft merkt man es gar nicht.\n\nDarum lohnt sich, was Bibliotheken seit jeher können: Quellen prüfen, nachfragen, vergleichen. Bücher über Informatik und KI findest du im Know How.' + rewardLine(firstTime, pts) },
    ], () => onExit(result));
  }

  // --- Zeichnen ------------------------------------------------------
  function drawRoom(g) {
    rect(g, 0, 0, VIEW_W, 132, '#2d4436');
    for (let x = 0; x < VIEW_W; x += 24) rect(g, x, 0, 1, 132, '#29402f');
    rect(g, 0, 124, VIEW_W, 8, '#4a3526');
    rect(g, 0, 132, VIEW_W, VIEW_H - 132, '#6b4a30');
    for (let y = 136; y < VIEW_H; y += 7) rect(g, 0, y, VIEW_W, 1, '#5a3d27');
    // Kabel von den Türen zum Fernschreiber
    rect(g, 120, 142, 150, 1, '#1d1a22');
    rect(g, 120, 146, 210, 1, '#1d1a22');
    for (const side of ['A', 'B']) drawDoor(g, side);
  }

  function drawDoor(g, side) {
    const x = DOOR_X[side];
    const typing = job && job.line && job.line.who === side;
    const thinking = job && !job.line && job.steps[job.i] && job.steps[job.i].who === side;
    rect(g, x - 3, 30, 52, 102, '#3b2a20');
    rect(g, x, 34, 46, 98, '#7a4f2e');
    rect(g, x + 4, 40, 38, 36, '#6b4428');
    rect(g, x + 4, 82, 38, 44, '#6b4428');
    rect(g, x + 38, 84, 3, 3, '#d9b24a');
    rect(g, x + 14, 46, 18, 22, '#efe3c2');
    Font.draw(g, side, x + 18, 48, '#3b2a20', 2);
    // Lampe
    const lit = typing || (thinking && Math.floor(t * 6) % 2 === 0);
    rect(g, x + 19, 21, 8, 6, PAL.k);
    rect(g, x + 20, 22, 6, 4, lit ? (side === 'A' ? '#ff6b5b' : '#6fb7ff') : '#4a3a3a');
    if (phase === 'guess' && guess === side) {
      const a = 0.5 + 0.5 * Math.sin(t * 6);
      g.strokeStyle = 'rgba(255,217,119,' + a + ')';
      g.lineWidth = 2;
      g.strokeRect(x - 5, 28, 56, 106);
      Font.drawCentered(g, '↓', x + 23, 9 + Math.round(Math.sin(t * 5) * 2), '#ffd977');
    }
  }

  function drawPaper(g) {
    rect(g, 12, 6, 228, 118, 'rgba(0,0,0,0.25)');
    rect(g, 10, 4, 228, 118, '#f6f1e1');
    for (let y = 16; y < 120; y += 11) rect(g, 12, y, 224, 1, '#e8e0cc');
    rect(g, 10, 4, 228, 2, '#e2d8c0');
    // Fernschreiber
    rect(g, 4, 118, 240, 30, PAL.k);
    rect(g, 5, 119, 238, 28, '#d8d2bf');
    rect(g, 5, 119, 238, 4, '#3a3a3a');
    for (let i = 0; i < 14; i++) {
      rect(g, 14 + i * 16, 128, 11, 6, '#2b2b2b');
      rect(g, 15 + i * 16, 129, 9, 3, '#5a5a5a');
    }
    for (let i = 0; i < 12; i++) rect(g, 22 + i * 16, 137, 11, 6, '#2b2b2b');
    // Text
    const lines = [];
    for (const ln of paper) {
      const label = ln.who === 'Du' ? 'Du: ' : ln.who + ': ';
      const txt = label + ln.text.slice(0, Math.floor(ln.shown));
      Font.wrap(txt, 214).forEach((l, i) => lines.push({ l, who: ln.who, first: i === 0 }));
    }
    const max = 10;
    const vis = lines.slice(-max);
    vis.forEach((o, i) => {
      const y = 7 + i * 11;
      const col = o.who === 'Du' ? '#6a3f8f' : o.who === 'A' ? '#9b3a30' : '#2a5b95';
      if (o.first) {
        const lab = o.who + ':';
        Font.draw(g, lab, 16, y, col);
        Font.draw(g, o.l.slice(lab.length), 16 + Font.measure(lab) + 1, y, '#2b2b3a');
      } else {
        Font.draw(g, o.l, 16, y, '#2b2b3a');
      }
    });
    if (job && job.line && Math.floor(t * 4) % 2 === 0 && vis.length) {
      const last = vis[vis.length - 1];
      rect(g, 16 + Font.measure(last.l) + 1, 7 + (vis.length - 1) * 11 + 1, 4, 8, '#2b2b3a');
    }
  }

  function drawPanelUi(g) {
    if (Dialog.active()) return;
    drawPanel(g, 6, 152, 372, 58);
    const info = 'Runde ' + Math.min(round + 1, ROUNDS.length) + '/' + ROUNDS.length + ' · ✓ ' + correct;
    Font.draw(g, info, 372 - Font.measure(info), 156, UI_COL.dim);
    if (phase === 'ask') {
      Font.draw(g, 'Deine Frage an A und B (' + (asked.length + 1) + ' von 2):', 14, 156, UI_COL.title);
      const open = openQuestions();
      drawMenuList(g, open.map((i) => ROUNDS[round].qs[i].q), sel, 10, 170, 362);
    } else if (phase === 'typing') {
      const st = job ? job.steps[job.i] : null;
      if (st && st.who !== 'Du') {
        const dots = '.'.repeat(1 + (Math.floor(t * 3) % 3));
        Font.draw(g, (job.line ? st.who + ' tippt' : st.who + ' denkt nach') + dots, 14, 160, st.who === 'A' ? '#ff8a7a' : '#7fb7ff');
      } else {
        Font.draw(g, 'Deine Frage wird übertragen …', 14, 160, UI_COL.text);
      }
      Font.draw(g, 'E gedrückt halten: schneller drucken', 14, 186, UI_COL.dim);
    } else if (phase === 'guess') {
      Font.draw(g, 'Wer ist die Maschine?', 14, 158, UI_COL.title);
      Font.draw(g, '← Tür A', 40, 176, guess === 'A' ? '#ffd977' : UI_COL.dim, 1);
      Font.draw(g, 'Tür B →', 280, 176, guess === 'B' ? '#ffd977' : UI_COL.dim, 1);
      Font.drawCentered(g, 'E entscheiden', VIEW_W / 2, 194, UI_COL.dim);
    }
  }

  function draw(g) {
    if (phase === 'intro' || (phase === 'outro' && StoryCard.active())) {
      StoryCard.draw(g);
      return;
    }
    drawRoom(g);
    drawPaper(g);
    const ts = charSprites(TURING.look);
    g.drawImage(ts.down[0], 246, 134);
    drawPanelUi(g);
    if (StoryCard.active()) StoryCard.draw(g);
  }

  return {
    enter, update, draw, rounds: ROUNDS,
    debug: () => ({ phase, round, machine, asked: asked.slice(), correct, sel, guess }),
  };
})();

// ===================================================================
// Buchwelt: Gullivers Reisen – die Flotte von Blefuscu an Land ziehen
// ===================================================================
const GulliverWorld = (() => {
  const W = 720;
  const LILLI = 150;
  const BLEF = 600;
  const TIME = 90;
  const SHIP_SPR = buildSprite([
    '......kr.......', '......kkk......', '.....kwwwk.....', '....kwwwwwk....', '....kwwwwwk....',
    '...kwwwwwwwk...', '......kk.......', 'kkkkkkkkkkkkkkk', '.kTTTTTTTTTTTk.', '..kTTTTTTTTTk..', '...kkkkkkkkk...',
  ]);
  const SHIP_ICON = buildSprite(['...kw...', '..kwww..', '.kwwwww.', 'kkkkkkkk', '.kTTTTk.', '..kkkk..']);
  let bg = null;
  let phase = 'intro';
  let t = 0;
  let gul = null;
  let ships = [];
  let folk = [];
  let archers = [];
  let arrows = [];
  let delivered = 0;
  let timeLeft = TIME;
  let camX = 0;
  let msg = null;
  let said = {};
  let onExit = null;
  let firstTime = true;
  let result = null;
  const LOOK = mkLook('short', 'brown', 'light', '#2b4a7a', '#d9cdb0', 'glasses');

  function depth(x) {
    if (x < LILLI || x >= BLEF + 10) return 0;
    if (x > 300 && x < 420) return 2;
    return 1;
  }

  function buildBg() {
    const c = makeCanvas(W, VIEW_H);
    const g = c.getContext('2d');
    const r = makeRng(1726);
    for (let x = 0; x < W; x++) {
      const d = depth(x);
      const col = d === 0 ? '#e7cf92' : d === 1 ? '#3f8fbf' : '#2b6f9e';
      rect(g, x, 0, 1, VIEW_H, col);
    }
    // Strandkanten
    for (let y = 0; y < VIEW_H; y++) {
      const w1 = 4 + Math.round(Math.sin(y * 0.15) * 2);
      rect(g, LILLI - w1, y, w1, 1, '#d8bd7c');
      rect(g, LILLI, y, 3, 1, '#a9d8ea');
      rect(g, BLEF + 10, y, w1, 1, '#d8bd7c');
      rect(g, BLEF + 7, y, 3, 1, '#a9d8ea');
    }
    for (let i = 0; i < 500; i++) {
      const x = Math.floor(r() * W);
      if (depth(x) === 0) rect(g, x, Math.floor(r() * VIEW_H), 1, 1, '#cdb377');
    }
    // Liliput: winzige Stadt mit Mauer
    rect(g, 0, 0, 58, VIEW_H, '#b9a77a');
    for (let y = 6; y < VIEW_H - 6; y += 14) {
      for (let x = 4; x < 50; x += 12) {
        const h = 5 + Math.floor(r() * 4);
        rect(g, x, y + 8 - h, 9, h, pick(['#e8dcc0', '#d9c7a1', '#f0e6d0'], r));
        rect(g, x - 1, y + 8 - h - 2, 11, 2, pick(['#b8453a', '#8f2d33', '#a0522d'], r));
      }
    }
    rect(g, 56, 0, 3, VIEW_H, '#8a7a5a');
    for (let y = 0; y < VIEW_H; y += 6) rect(g, 55, y, 5, 2, '#8a7a5a');
    // Blefuscu: Hafen und Türme
    rect(g, W - 60, 0, 60, VIEW_H, '#b3a58a');
    for (let y = 10; y < VIEW_H - 10; y += 22) {
      rect(g, W - 46, y, 10, 14, '#d9d2c0');
      rect(g, W - 47, y - 3, 12, 3, '#3a5a8a');
      rect(g, W - 26, y + 6, 14, 9, '#e8e0cc');
      rect(g, W - 27, y + 4, 16, 2, '#3a5a8a');
    }
    rect(g, BLEF + 12, 100, 28, 4, '#7a5a3a');
    return c;
  }

  function enter(exitCb, first) {
    onExit = exitCb;
    firstTime = first;
    if (!bg) bg = buildBg();
    phase = 'intro';
    t = 0;
    delivered = 0;
    timeLeft = TIME;
    msg = null;
    said = {};
    result = null;
    arrows = [];
    gul = { x: 110, y: 120, dir: 'right', anim: 0, moving: false, stun: 0, spr: charSprites(LOOK) };
    ships = [];
    for (let col = 0; col < 3; col++) {
      for (let row = 0; row < 4; row++) ships.push({ x: 478 + col * 34 + (row % 2) * 10, y: 34 + row * 44, hooked: false, done: false, bob: Math.random() * 6 });
    }
    const r = makeRng(9);
    folk = [];
    for (let i = 0; i < 11; i++) folk.push({ x: 70 + r() * 70, y: 14 + r() * 190, tx: 0, ty: 0, wait: r() * 2, jump: 0, col: pick(['#b8453a', '#2f6fb0', '#3b8f5a', '#7b52a6', '#e0b13c'], r) });
    archers = [];
    for (let i = 0; i < 5; i++) archers.push({ x: BLEF + 26 + (i % 2) * 8, y: 22 + i * 42, cd: 1 + i * 0.4 });
    camX = 0;
    Sound.play('lilliput');
    const icon = emblemIcon('gulliver');
    StoryCard.show([
      { title: 'Gullivers Reisen', sub: 'Jonathan Swift · 1726', icon, text: 'Nach einem Schiffbruch erwacht der Schiffsarzt Lemuel Gulliver an einem fremden Strand – festgebunden mit hundert dünnen Fäden. Um ihn herum wuseln Menschen, kaum größer als ein Daumen.\n\nEr ist im Land Liliput.' },
      { title: 'Gullivers Reisen', sub: 'Die Flotte von Blefuscu', icon, text: 'Liliput streitet mit der Nachbarinsel Blefuscu – darüber, an welchem Ende man ein Ei aufschlägt! Jetzt rüstet Blefuscu eine Flotte zum Angriff.\n\nGulliver watet hinüber und holt sich die Schiffe.\n\n↑↓←→ waten · E Schiff anhaken · Bring die Schiffe nach Liliput!' },
    ], () => {
      phase = 'play';
      msg = { text: 'Wate hinüber nach Blefuscu (rechts). In der Mitte ist das Wasser tief – dort musst du schwimmen.', t: 5 };
    });
  }

  function speed() {
    const d = depth(gul.x);
    const base = d === 0 ? 72 : d === 1 ? 54 : 36;
    const n = ships.filter((s) => s.hooked).length;
    return base * (1 - n * 0.022);
  }

  function update(dt) {
    t += dt;
    if (StoryCard.update(dt)) return;
    if (msg) {
      msg.t -= dt;
      if (msg.t <= 0) msg = null;
    }
    if (phase !== 'play') return;
    timeLeft -= dt;
    // Bewegen
    let mx = 0;
    let my = 0;
    if (Input.down('left')) mx -= 1;
    if (Input.down('right')) mx += 1;
    if (Input.down('up')) my -= 1;
    if (Input.down('down')) my += 1;
    gul.moving = false;
    if (gul.stun > 0) gul.stun -= dt;
    else if (mx || my) {
      const len = Math.hypot(mx, my);
      const sp = speed() * dt;
      gul.x = clamp(gul.x + (mx / len) * sp, 70, BLEF + 40);
      gul.y = clamp(gul.y + (my / len) * sp, 26, VIEW_H - 4);
      gul.dir = Math.abs(mx) >= Math.abs(my) ? (mx < 0 ? 'left' : 'right') : my < 0 ? 'up' : 'down';
      gul.moving = true;
      gul.anim += dt * 6;
    }
    // Schiffe anhaken
    if (Input.hit('act') || Input.hit('jump')) {
      let best = null;
      let bd = 30;
      for (const s of ships) {
        if (s.hooked || s.done) continue;
        const d = Math.hypot(s.x - gul.x, s.y - (gul.y - 8));
        if (d < bd) { bd = d; best = s; }
      }
      if (best) {
        best.hooked = true;
        Sound.sfx('rope');
        if (!said.hook) {
          said.hook = true;
          msg = { text: 'Gulliver schneidet das Ankertau durch und befestigt einen Haken am Bug. Hol so viele, wie du schaffst!', t: 4 };
        }
      } else if (!said.near) {
        said.near = true;
        msg = { text: 'Stell dich direkt neben ein Schiff und drück E.', t: 3 };
      }
    }
    // Angehakte Schiffe hängen wie an einem Seil hintereinander
    let lead = { x: gul.x, y: gul.y - 6 };
    for (const s of ships) {
      if (!s.hooked) continue;
      const dx = s.x - lead.x;
      const dy = s.y - lead.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > 17) {
        s.x = lead.x + (dx / d) * 17;
        s.y = lead.y + (dy / d) * 17;
      }
      lead = s;
    }
    // Abliefern am Strand von Liliput
    if (gul.x < LILLI - 6) {
      const n = ships.filter((s) => s.hooked).length;
      if (n) {
        let i = delivered;
        for (const s of ships) {
          if (!s.hooked) continue;
          s.hooked = false;
          s.done = true;
          s.x = LILLI + 8 + (i % 2) * 14;
          s.y = 30 + Math.floor(i / 2) * 26;
          i++;
        }
        delivered += n;
        Sound.sfx('cheer');
        for (const f of folk) f.jump = 0.8;
        msg = { text: n === 1 ? 'Ein Schiff mehr für Liliput! Die Liliputaner jubeln.' : n + ' Schiffe auf einmal! Die Liliputaner jubeln.', t: 3 };
      }
    }
    updateFolk(dt);
    updateArrows(dt);
    const target = clamp(Math.round(gul.x - VIEW_W / 2), 0, W - VIEW_W);
    camX += (target - camX) * Math.min(1, dt * 5);
    if (delivered >= ships.length || timeLeft <= 0) finish();
  }

  function updateFolk(dt) {
    for (const f of folk) {
      if (f.jump > 0) f.jump -= dt;
      const d = Math.hypot(f.x - gul.x, f.y - gul.y);
      if (d < 12) {
        // ausweichen!
        const ang = Math.atan2(f.y - gul.y, f.x - gul.x) || 0;
        f.x = clamp(f.x + Math.cos(ang) * 60 * dt, 62, LILLI - 6);
        f.y = clamp(f.y + Math.sin(ang) * 60 * dt, 10, VIEW_H - 6);
        if (!f.squeak) {
          f.squeak = true;
          Sound.sfx('squeak');
          if (!said.step) {
            said.step = true;
            msg = { text: '„He, pass doch auf, du Riese!“ – Vorsicht, wo du hintrittst.', t: 3 };
          }
        }
        continue;
      }
      if (d > 24) f.squeak = false;
      f.wait -= dt;
      if (f.wait <= 0) {
        f.tx = clamp(f.x + (Math.random() - 0.5) * 40, 62, LILLI - 8);
        f.ty = clamp(f.y + (Math.random() - 0.5) * 40, 10, VIEW_H - 6);
        f.wait = 1 + Math.random() * 2.5;
      }
      if (f.tx) {
        f.x += clamp(f.tx - f.x, -10 * dt, 10 * dt);
        f.y += clamp(f.ty - f.y, -10 * dt, 10 * dt);
      }
    }
  }

  function updateArrows(dt) {
    for (const a of archers) {
      a.cd -= dt;
      if (a.cd <= 0) {
        a.cd = 1.4 + Math.random() * 0.8;
        if (Math.abs(gul.x - a.x) < 250) {
          const ang = Math.atan2(gul.y - 22 - a.y, gul.x - a.x);
          arrows.push({ x: a.x, y: a.y, vx: Math.cos(ang) * 120, vy: Math.sin(ang) * 120, life: 2.5 });
          Sound.sfx('arrow');
        }
      }
    }
    for (const ar of arrows) {
      ar.x += ar.vx * dt;
      ar.y += ar.vy * dt;
      ar.life -= dt;
      if (Math.abs(ar.x - gul.x) < 8 && Math.abs(ar.y - (gul.y - 22)) < 9) {
        ar.life = 0;
        gul.stun = 0.35;
        Sound.sfx('ouch');
        if (!said.arrow) {
          said.arrow = true;
          msg = { text: 'Die Pfeile pieksen wie Nadeln – zum Glück schützt die Brille Gullivers Augen!', t: 4 };
        }
      }
    }
    arrows = arrows.filter((a) => a.life > 0);
  }

  function finish() {
    phase = 'outro';
    const pts = 20 + Math.round((10 * delivered) / ships.length);
    result = { world: 'gulliver', pts };
    const icon = emblemIcon('gulliver');
    const head = delivered >= ships.length
      ? 'Die ganze Flotte liegt am Strand von Liliput!'
      : 'Die Sonne geht unter. ' + delivered + ' von ' + ships.length + ' Schiffen liegen am Strand von Liliput.';
    StoryCard.show([
      { title: 'Nardac!', sub: 'Gullivers Reisen', icon, text: head + ' Der Kaiser ernennt Gulliver zum Nardac – das ist der höchste Ehrentitel des Landes.\n\nÜbrigens: Der Eier-Streit lebt in der Informatik weiter. „Big-Endian“ und „Little-Endian“ heißen dort zwei Arten, Zahlen im Speicher abzulegen.' },
      { title: 'Wie geht es weiter?', sub: 'Jonathan Swift', icon, text: 'Gulliver reist noch weiter: zu Riesen, auf eine fliegende Insel und zu sprechenden Pferden. Swift nimmt dabei die Mächtigen seiner Zeit aufs Korn.\n\nDarum steht diese Satire bei „Gesellschaft & Politik & Medien“ im College 3.' + rewardLine(firstTime, pts) },
    ], () => onExit(result));
  }

  // --- Zeichnen ------------------------------------------------------
  function draw(g) {
    if (phase === 'intro' || (phase === 'outro' && StoryCard.active())) {
      StoryCard.draw(g);
      return;
    }
    const ox = Math.round(camX);
    g.drawImage(bg, ox, 0, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);
    // Wellen
    for (let i = 0; i < 70; i++) {
      const r = makeRng(i * 13);
      const x = LILLI + 6 + ((r() * (BLEF - LILLI - 12) + t * (6 + r() * 6)) % (BLEF - LILLI - 12));
      const y = Math.floor(r() * VIEW_H);
      if (x - ox < -8 || x - ox > VIEW_W) continue;
      rect(g, Math.round(x - ox), y, 5, 1, 'rgba(255,255,255,0.35)');
    }
    // Liliputaner
    for (const f of folk) {
      const x = Math.round(f.x - ox);
      const y = Math.round(f.y - (f.jump > 0 ? Math.abs(Math.sin(f.jump * 12)) * 3 : 0));
      if (x < -4 || x > VIEW_W + 4) continue;
      rect(g, x, y - 4, 2, 2, '#f5cba8');
      rect(g, x, y - 2, 2, 2, f.col);
      rect(g, x, y, 1, 1, '#3a2a26');
      rect(g, x + 1, y, 1, 1, '#3a2a26');
    }
    // Schiffe
    for (const s of ships) {
      const bob = Math.round(Math.sin(t * 2 + s.bob) * 1);
      g.drawImage(SHIP_SPR, Math.round(s.x - 7 - ox), Math.round(s.y - 8 + bob));
    }
    // Seile zu den angehakten Schiffen
    g.strokeStyle = '#e8dcc0';
    g.lineWidth = 1;
    let prev = { x: gul.x, y: gul.y - 10 };
    for (const s of ships) {
      if (!s.hooked) continue;
      g.beginPath();
      g.moveTo(Math.round(prev.x - ox) + 0.5, Math.round(prev.y) + 0.5);
      g.lineTo(Math.round(s.x - ox) + 0.5, Math.round(s.y) + 0.5);
      g.stroke();
      prev = s;
    }
    // Gulliver (doppelt so groß)
    const frames = gul.spr[gul.dir];
    const f = gul.moving ? frames[Math.floor(gul.anim) % 4] : frames[0];
    const gx = Math.round(gul.x - 16 - ox);
    const gy = Math.round(gul.y - 31);
    const d = depth(gul.x);
    if (d === 0) {
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(gx + 8, Math.round(gul.y) - 3, 16, 3);
    }
    if (gul.stun > 0 && Math.floor(gul.stun * 20) % 2 === 0) g.globalAlpha = 0.6;
    g.drawImage(f, gx, gy, 32, 32);
    g.globalAlpha = 1;
    if (d > 0) {
      const cut = d === 1 ? 9 : 15;
      g.fillStyle = d === 1 ? 'rgba(63,143,191,0.85)' : 'rgba(43,111,158,0.9)';
      g.fillRect(gx, gy + 32 - cut, 32, cut + 1);
      rect(g, gx + 2 + Math.round(Math.sin(t * 5) * 2), gy + 32 - cut, 28, 1, 'rgba(255,255,255,0.6)');
    }
    // Bogenschützen und Pfeile
    for (const a of archers) {
      const x = Math.round(a.x - ox);
      rect(g, x, a.y - 4, 2, 2, '#f5cba8');
      rect(g, x, a.y - 2, 2, 3, '#3a5a8a');
      rect(g, x - 2, a.y - 3, 1, 4, '#7a5a3a');
    }
    for (const ar of arrows) {
      const x = Math.round(ar.x - ox);
      const y = Math.round(ar.y);
      const l = Math.hypot(ar.vx, ar.vy);
      rect(g, x, y, 1, 1, '#2b1d1f');
      rect(g, Math.round(x - (ar.vx / l) * 3), Math.round(y - (ar.vy / l) * 3), 1, 1, '#8a6a4a');
    }
    // HUD
    drawWorldHud(g, 'Gullivers Reisen', delivered + ' / ' + ships.length, SHIP_ICON);
    const frac = clamp(timeLeft / TIME, 0, 1);
    rect(g, 140, 9, 104, 5, '#2b2230');
    rect(g, 141, 10, Math.round(102 * frac), 3, frac > 0.3 ? '#ffd24a' : '#ff8a5b');
    for (let yy = -3; yy <= 3; yy++) for (let xx = -3; xx <= 3; xx++) if (xx * xx + yy * yy <= 9) px(g, 134 + xx, 11 + yy, '#ffd24a');
    if (msg) drawWorldMsg(g, msg.text);
    if (StoryCard.active()) StoryCard.draw(g);
  }

  return {
    enter, update, draw,
    debug: () => ({ phase, gul, ships, delivered, timeLeft, setTime: (v) => { timeLeft = v; } }),
  };
})();

// ===================================================================
// Buchwelt: Nussknacker und Mausekönig – Nüsse knacken im Takt
// ===================================================================
const NussWorld = (() => {
  const LANES = [156, 192, 228];
  const HIT_Y = 168;
  const SPEED = 92;
  const LEAD = 2.4;
  const ARROWS = ['←', '↑', '→'];
  const SPR = {
    nut: buildSprite([
      '...kkkkkk...', '..kTtTtTtk..', '.kTtTkTtTtk.', 'kTtTtkTtTtTk', 'ktTtTkTtTtTk',
      'kTtTtkTtTtTk', '.kTtTkTtTtk.', '..kTtTtTtk..', '...kkkkkk...',
    ]),
    half: buildSprite(['..kkk.', '.kTtTk', 'kTtTtk', 'ktTtTk', '.kTtk.', '..kk..']),
    nutcracker: buildSprite([
      '....kkkk....', '...kNNNNk...', '...kNNNNk...', '..kNNNNNNk..', '..kxxxxxxk..', '..kssssssk..',
      '..kseskesk..', '..kssssssk..', '..kwwwwwwk..', '..kwkkkkwk..', '...kwwwwk...', '..krrrrrrk..',
      '.krrxrrxrrk.', '.krrrxxrrrk.', '.ksrrrrrrsk.', '..kkkkkkkk..', '..kBBkkBBk..', '..kBBkkBBk..',
      '..kBBkkBBk..', '.kkkk..kkkk.',
    ]),
    soldier: buildSprite([
      '..kkkk..', '.kNNNNk.', '.kNNNNk.', '.kssssk.', '.ksesek.', '..kkkk..',
      '.krrrrk.', 'krrxxrrk', '.krrrrk.', '.kBBBBk.', '.kBkkBk.', '.kk..kk.',
    ]),
    mouse: buildSprite([
      '..kk........', '.kmgk.......', '.kgggkkkk...', 'kegggggggk..', 'kgggggggggk.',
      '.kgggggggggk', '..kk...kk.kk',
    ]),
    slipper: buildSprite(['..kkkkk...', '.kmmmmmkk.', 'kmwwmmmmmk', 'kkkkkkkkkk']),
  };
  const MARIE = mkLook('long', 'brown', 'light', '#f4f1e8', '#e8e0cc');

  let phase = 'intro';
  let t = 0;
  let chart = [];
  let nextIdx = 0;
  let pops = [];
  let bits = [];
  let combo = 0;
  let score = 0;
  let hits = 0;
  let advance = 0;
  let laneFlash = [0, 0, 0];
  let countT = 0;
  let startLocal = 0;
  let useAudio = false;
  let endAt = 0;
  let slip = null;
  let msg = null;
  let onExit = null;
  let firstTime = true;
  let result = null;

  const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function midi(name) {
    const m = /^([A-G])([#b]?)(\d)$/.exec(name);
    if (!m) return 0;
    return SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (parseInt(m[3], 10) + 1) * 12;
  }

  // Noten aus der Melodie des Marsches ableiten: höher → rechts, tiefer → links, gleich → Mitte
  function buildChart() {
    const info = Sound.songInfo('march');
    const toks = info.tracks[0];
    const out = [];
    let lastStep = -9;
    let lastPitch = 0;
    for (let i = 0; i < toks.length; i++) {
      const tok = toks[i];
      if (tok === '-' || tok === '.') continue;
      const pitch = midi(tok);
      if (i - lastStep < 2) { lastPitch = pitch; continue; }
      let lane = 1;
      if (out.length) lane = pitch > lastPitch ? 2 : pitch < lastPitch ? 0 : 1;
      out.push({ time: i * info.stepDur, lane, state: null });
      lastStep = i;
      lastPitch = pitch;
    }
    endAt = toks.length * info.stepDur;
    return out;
  }

  function enter(exitCb, first) {
    onExit = exitCb;
    firstTime = first;
    phase = 'intro';
    t = 0;
    chart = buildChart();
    nextIdx = 0;
    pops = [];
    bits = [];
    combo = 0;
    score = 0;
    hits = 0;
    advance = 0;
    slip = null;
    msg = null;
    result = null;
    Sound.play('march');
    const icon = emblemIcon('nuss');
    StoryCard.show([
      { title: 'Nussknacker und Mausekönig', sub: 'E. T. A. Hoffmann · 1816', icon, text: 'Heiliger Abend bei Familie Stahlbaum. Unter dem Christbaum findet Marie ein kleines Männchen mit großem Mund: einen Nussknacker. Sie schließt ihn sofort ins Herz.\n\nAls um Mitternacht die Uhr schlägt, raschelt und pfeift es plötzlich überall …' },
      { title: 'Die Schlacht', sub: 'Um Mitternacht', icon, text: 'Aus den Ritzen im Boden quillt ein Heer von Mäusen, angeführt vom Mausekönig mit sieben Köpfen und sieben Kronen! Der Nussknacker erwacht und ruft die Spielzeugsoldaten zum Kampf.\n\nKnack die Nüsse im Takt: ← ↑ → drücken, wenn eine Nuss die Linie erreicht.' },
    ], () => {
      phase = 'count';
      countT = 0;
      useAudio = Sound.ready;
      Sound.stop();
    });
  }

  function clock() {
    if (phase === 'count') return countT - LEAD - (useAudio ? 0.12 : 0);
    if (useAudio) {
      const st = Sound.songTime();
      if (st !== null) return st;
    }
    return t - startLocal - (useAudio ? 0.12 : 0);
  }

  function update(dt) {
    t += dt;
    if (StoryCard.update(dt)) return;
    if (msg) {
      msg.t -= dt;
      if (msg.t <= 0) msg = null;
    }
    for (let i = 0; i < 3; i++) laneFlash[i] = Math.max(0, laneFlash[i] - dt * 4);
    for (const p of pops) p.t += dt;
    pops = pops.filter((p) => p.t < 0.7);
    for (const b of bits) { b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 300 * dt; }
    bits = bits.filter((b) => b.t < 0.6);
    if (phase === 'count') {
      const before = Math.floor(countT / 0.6);
      countT += dt;
      if (Math.floor(countT / 0.6) !== before && countT < LEAD) Sound.sfx('blip');
      handleInput();
      if (countT >= LEAD) {
        phase = 'play';
        startLocal = t;
        Sound.play('march', true);
      }
      return;
    }
    if (phase === 'play') {
      handleInput();
      const now = clock();
      for (const n of chart) {
        if (!n.state && now - n.time > 0.2) {
          n.state = 'miss';
          combo = 0;
          advance = Math.min(60, advance + 4);
          pops.push({ lane: n.lane, text: 'Daneben', col: UI_COL.bad, t: 0 });
        }
      }
      if (now > endAt + 0.4) {
        phase = 'slipper';
        slip = { pos: 0, dir: 1, tries: 0, fly: null };
        Sound.play('march');
        msg = { text: 'Der Mausekönig greift den Nussknacker an! Marie zieht ihren Pantoffel aus … Drück E, wenn der Zeiger im grünen Feld ist!', t: 99 };
      }
      return;
    }
    if (phase === 'slipper') updateSlipper(dt);
  }

  function handleInput() {
    const lanes = [];
    if (Input.hit('left')) lanes.push(0);
    if (Input.hit('up') || Input.hit('down')) lanes.push(1);
    if (Input.hit('right')) lanes.push(2);
    if (!lanes.length) return;
    const now = clock();
    for (const lane of lanes) {
      laneFlash[lane] = 1;
      let best = null;
      let bd = 0.22;
      for (const n of chart) {
        if (n.state || n.lane !== lane) continue;
        const d = Math.abs(n.time - now);
        if (d < bd) { bd = d; best = n; }
      }
      if (!best) continue;
      const good = bd < 0.09;
      best.state = good ? 'super' : 'good';
      hits++;
      score += good ? 1 : 0.7;
      combo++;
      advance = Math.max(0, advance - 3);
      Sound.sfx('crack');
      pops.push({ lane, text: good ? 'Super!' : 'Gut!', col: good ? '#ffd977' : UI_COL.good, t: 0 });
      for (let k = 0; k < 6; k++) bits.push({ x: LANES[lane], y: HIT_Y, vx: (Math.random() - 0.5) * 90, vy: -60 - Math.random() * 60, t: 0 });
    }
  }

  function updateSlipper(dt) {
    if (slip.fly) {
      slip.fly.t += dt;
      if (slip.fly.t >= 0.9) {
        if (slip.fly.hit) {
          phase = 'won';
          slip.wonT = 0;
          Sound.sfx('thud');
          setTimeout(() => Sound.sfx('cheer'), 250);
          msg = { text: 'Volltreffer! Der Mausekönig taumelt – und das ganze Mäuseheer ergreift die Flucht.', t: 99 };
        } else {
          slip.fly = null;
          msg = { text: 'Knapp vorbei! Marie hat noch den zweiten Pantoffel … Nochmal!', t: 99 };
        }
      }
      return;
    }
    slip.pos += slip.dir * dt * 1.25;
    if (slip.pos > 1) { slip.pos = 1; slip.dir = -1; }
    if (slip.pos < 0) { slip.pos = 0; slip.dir = 1; }
    if (Input.hit('act') || Input.hit('jump')) {
      slip.tries++;
      const ok = Math.abs(slip.pos - 0.5) < 0.11 || slip.tries >= 3;
      slip.fly = { t: 0, hit: ok };
      Sound.sfx('whoosh');
    }
  }

  function finishLater(dt) {
    slip.wonT += dt;
    if (slip.wonT > 2.4 && phase === 'won') {
      phase = 'outro';
      msg = null;
      const ratio = chart.length ? score / chart.length : 0;
      const pts = 20 + Math.round(10 * ratio);
      result = { world: 'nuss', pts };
      const icon = emblemIcon('nuss');
      StoryCard.show([
        { title: 'Der Pantoffel trifft!', sub: 'Nussknacker und Mausekönig', icon, text: 'Marie wirft ihren Pantoffel mitten ins Getümmel – und der Mausekönig flieht mit seinem ganzen Heer.\n\nDu hast ' + hits + ' von ' + chart.length + ' Nüssen im Takt geknackt.' },
        { title: 'Wie geht es weiter?', sub: 'E. T. A. Hoffmann', icon, text: 'Wer ist der Nussknacker wirklich? Was weiß Pate Drosselmeier? Und wie sieht das Puppenreich mit seinem Marzipanschloss aus? Lies selbst!\n\nWeil Tschaikowski daraus ein berühmtes Ballett gemacht hat, steht die Geschichte hier bei „Theater & Tanz & Film“.' + rewardLine(firstTime, pts) },
      ], () => onExit(result));
    }
  }

  // --- Zeichnen ------------------------------------------------------
  function drawRoom(g) {
    rect(g, 0, 0, VIEW_W, 150, '#1d2346');
    for (let x = 0; x < VIEW_W; x += 32) rect(g, x, 0, 16, 150, '#20284d');
    rect(g, 0, 146, VIEW_W, 4, '#3a2a20');
    rect(g, 0, 150, VIEW_W, VIEW_H - 150, '#5a3d2b');
    for (let y = 154; y < VIEW_H; y += 8) rect(g, 0, y, VIEW_W, 1, '#4d3324');
    // Fenster mit Mond
    rect(g, 168, 14, 48, 40, '#3a2a20');
    rect(g, 171, 17, 42, 34, '#0f1530');
    rect(g, 191, 17, 2, 34, '#3a2a20');
    rect(g, 171, 33, 42, 2, '#3a2a20');
    for (let yy = -5; yy <= 5; yy++) for (let xx = -5; xx <= 5; xx++) if (xx * xx + yy * yy <= 25) px(g, 202 + xx, 25 + yy, '#fff6cf');
    // Christbaum
    for (let i = 0; i < 9; i++) rect(g, 30 - i * 3, 22 + i * 12, 14 + i * 6, 12, i % 2 ? '#1f6b3a' : '#236f40');
    rect(g, 33, 130, 8, 16, '#4a2c1a');
    for (const [x, y, c] of [[30, 40, '#e0115f'], [18, 70, '#ffd24a'], [44, 82, '#5fa8e8'], [24, 104, '#e0115f'], [52, 112, '#ffd24a'], [12, 122, '#5fa8e8']]) {
      rect(g, x, y, 3, 3, c);
      if (Math.floor(t * 2 + x) % 3 === 0) rect(g, x + 1, y - 1, 1, 1, '#ffffff');
    }
    rect(g, 34, 14, 5, 5, '#ffd24a');
    // Glasschrank
    rect(g, 318, 26, 56, 120, '#3a2a20');
    rect(g, 321, 29, 50, 114, '#2a3550');
    for (let y = 60; y < 140; y += 30) rect(g, 321, y, 50, 2, '#3a2a20');
  }

  function drawArmies(g) {
    // Spielzeugsoldaten links
    for (let i = 0; i < 6; i++) {
      const x = 64 + (i % 3) * 14;
      const y = 150 + Math.floor(i / 3) * 16;
      const hop = combo > 0 && (Math.floor(t * 4) + i) % 4 === 0 ? 1 : 0;
      g.drawImage(SPR.soldier, x, y - hop);
    }
    g.drawImage(SPR.nutcracker, 108, 142);
    // Mäuse rechts (rücken bei Fehlern vor)
    const flee = phase === 'won' ? slip.wonT * 140 : 0;
    for (let i = 0; i < 8; i++) {
      const x = 268 + (i % 4) * 24 - advance + flee;
      const y = 154 + Math.floor(i / 4) * 18 + ((Math.floor(t * 6) + i) % 2);
      if (x < VIEW_W + 10) g.drawImage(SPR.mouse, Math.round(x), y);
    }
    // Mausekönig mit sieben Köpfen
    const kx = 332 - advance * 0.6 + flee;
    const ky = 132 + (phase === 'won' ? Math.min(20, slip.wonT * 30) : 0);
    if (kx < VIEW_W + 20) {
      rect(g, kx - 2, ky + 14, 30, 18, PAL.k);
      rect(g, kx - 1, ky + 15, 28, 16, '#8e887f');
      rect(g, kx + 4, ky + 20, 18, 3, '#7b3fa0');
      for (let i = 0; i < 7; i++) {
        const hx = kx - 4 + i * 5;
        const hy = ky + 6 + Math.abs(i - 3) * 2;
        rect(g, hx, hy, 6, 6, PAL.k);
        rect(g, hx + 1, hy + 1, 4, 4, '#c7c1b6');
        rect(g, hx + 1, hy + 2, 1, 1, '#e0115f');
        rect(g, hx + 1, hy - 2, 4, 2, '#ffd24a');
        rect(g, hx + 1, hy - 3, 1, 1, '#ffd24a');
        rect(g, hx + 4, hy - 3, 1, 1, '#ffd24a');
      }
    }
  }

  function drawLanes(g) {
    rect(g, 136, 18, 112, 168, 'rgba(10,8,20,0.55)');
    for (let i = 0; i < 3; i++) {
      const x = LANES[i];
      rect(g, x, 18, 1, 168, 'rgba(255,255,255,0.08)');
      const f = laneFlash[i];
      drawPanel(g, x - 13, HIT_Y - 9, 26, 18, f > 0 ? 'rgba(255,217,119,' + (0.25 + 0.5 * f) + ')' : 'rgba(40,30,48,0.9)', '#ffd977');
      Font.drawCentered(g, ARROWS[i], x + 1, HIT_Y - 5, '#ffffff');
    }
    const now = clock();
    for (const n of chart) {
      if (n.state) continue;
      const y = HIT_Y - (n.time - now) * SPEED;
      if (y < 10 || y > VIEW_H + 10) continue;
      const x = LANES[n.lane];
      g.drawImage(SPR.nut, x - 6, Math.round(y) - 5);
      Font.drawCentered(g, ARROWS[n.lane], x + 1, Math.round(y) - 4, '#fff3b0');
    }
    for (const b of bits) {
      g.globalAlpha = 1 - b.t / 0.6;
      g.drawImage(SPR.half, Math.round(b.x - 3), Math.round(b.y - 3));
      g.globalAlpha = 1;
    }
    for (const p of pops) {
      g.globalAlpha = 1 - p.t / 0.7;
      Font.drawCentered(g, p.text, LANES[p.lane] + 1, HIT_Y - 26 - p.t * 20, p.col, '#1a1220');
      g.globalAlpha = 1;
    }
    if (phase === 'count') {
      const n = Math.max(1, Math.ceil((LEAD - countT) / 0.6));
      Font.drawCentered(g, String(Math.min(3, n)), VIEW_W / 2, 80, '#ffd977', '#1a1220', 3);
    }
  }

  function drawSlipper(g) {
    const marie = charSprites(MARIE);
    g.drawImage(marie.right[0], 140, 150);
    if (phase === 'slipper' && !slip.fly) {
      drawPanel(g, 90, 112, 204, 18);
      rect(g, 94, 117, 196, 8, '#3d3242');
      rect(g, 94 + Math.round(196 * 0.39), 117, Math.round(196 * 0.22), 8, '#5fbf5f');
      const mx = 94 + Math.round(196 * slip.pos);
      rect(g, mx - 1, 114, 3, 14, '#ffffff');
    }
    if (slip && slip.fly) {
      const k = clamp(slip.fly.t / 0.9, 0, 1);
      const tx = slip.fly.hit ? 340 : 366;
      const x = lerp(152, tx, k);
      const y = lerp(150, 128, k) - Math.sin(k * Math.PI) * 60;
      g.save();
      g.translate(Math.round(x), Math.round(y));
      g.rotate(k * Math.PI * 4);
      g.drawImage(SPR.slipper, -5, -2);
      g.restore();
    }
  }

  function draw(g) {
    if (phase === 'intro' || (phase === 'outro' && StoryCard.active())) {
      StoryCard.draw(g);
      return;
    }
    drawRoom(g);
    drawArmies(g);
    if (phase === 'count' || phase === 'play') drawLanes(g);
    if (phase === 'slipper' || phase === 'won') drawSlipper(g);
    drawWorldHud(g, 'Nussknacker', hits + ' / ' + chart.length, SPR.half);
    if (combo >= 4 && phase === 'play') Font.drawCentered(g, combo + 'er-Serie!', VIEW_W / 2, 24, '#ffd977', '#1a1220');
    if (msg) drawWorldMsg(g, msg.text, 30);
    if (StoryCard.active()) StoryCard.draw(g);
  }

  const baseUpdate = update;
  function updateAll(dt) {
    baseUpdate(dt);
    if (phase === 'won') finishLater(dt);
  }

  return {
    enter, update: updateAll, draw,
    debug: () => ({ phase, now: clock(), chart, hits, score, slip, advance }),
  };
})();

// ===================================================================
// Buchwelt: In 80 Tagen um die Welt – Routenwahl gegen die Uhr
// ===================================================================
const ReiseWorld = (() => {
  // Weltkarte (einfache Umrisse, Länge/Breite) – nach Osten von London bis London
  const LAND = [
    [[-166, 68], [-156, 71.3], [-140, 69.6], [-120, 69], [-100, 68], [-95, 71], [-88, 68.5], [-82, 69.5], [-80, 66], [-75, 64], [-70, 62], [-64, 60], [-62, 57], [-58, 54], [-56, 51.5], [-59, 48], [-64, 47], [-66, 45], [-70, 43.5], [-70, 41.5], [-74, 40.5], [-76, 38], [-76, 35], [-79, 33], [-81, 31], [-81, 28], [-80, 25.5], [-81.5, 25], [-82.5, 27.5], [-84, 30], [-89, 30.2], [-90, 29], [-94, 29.6], [-97, 27.8], [-97.5, 22], [-96, 19], [-91, 18.6], [-90.5, 21], [-87, 21.5], [-88.3, 16], [-83.5, 15], [-83.6, 11], [-81.5, 9], [-79, 9.5], [-77.5, 8.5], [-80, 7.3], [-83.6, 8.5], [-87.5, 13], [-91, 13.8], [-94, 16], [-101, 17.3], [-105, 19.5], [-107, 23.5], [-109.5, 26], [-112.5, 29], [-114.7, 31.5], [-112, 27], [-110, 23], [-112, 25], [-115.5, 30], [-117.1, 32.5], [-121, 35], [-122.5, 37.5], [-124, 40], [-124, 46.5], [-124.7, 48.4], [-128, 52], [-133, 57], [-140, 59.8], [-145, 60.5], [-151.5, 59.5], [-154, 57.5], [-160, 55.5], [-163, 55], [-158, 57.5], [-162, 59.8], [-165, 62.5], [-161, 64.5], [-166, 65.3], [-164, 66.5]],
    [[-73, 78], [-60, 82], [-40, 83.5], [-18, 80], [-20, 75], [-22, 70], [-30, 68], [-40, 65], [-43, 60], [-48, 61], [-52, 64], [-54, 67], [-56, 71], [-60, 76]],
    [[-80, 62], [-64, 62], [-62, 67], [-67, 69.7], [-75, 72], [-85, 73.4], [-90, 71.3], [-85, 69.8], [-81, 68], [-83, 66], [-78, 64.5]],
    [[-118, 69], [-101, 68.5], [-102, 72], [-114, 73], [-118, 71.5]],
    [[-77.5, 8.5], [-72, 11.8], [-67, 10.7], [-61, 8.5], [-54, 5.8], [-50, 1.7], [-44, -2.5], [-37, -5], [-35, -7.5], [-38, -13], [-39, -17.5], [-42, -23], [-48.5, -26], [-51, -31], [-56.5, -35.5], [-57.5, -38], [-62.5, -41], [-65.5, -45], [-67.5, -46.5], [-68.5, -50], [-68.5, -54.5], [-74.5, -52.5], [-75.5, -48], [-73, -40], [-71.5, -32], [-70.5, -25], [-70.4, -18], [-75.5, -15], [-79, -8], [-81.2, -4.5], [-80, -2.5], [-80, 1], [-77.5, 3.5], [-77.5, 7.5]],
    [[-85, 21.9], [-81.8, 23.1], [-77.5, 21.5], [-74.2, 20.2], [-77.8, 20.7], [-81, 21.9]],
    [[-74.5, 18.5], [-72.8, 19.9], [-70, 19.7], [-68.3, 18.6], [-71, 17.8]],
    [[-17, 21], [-17.2, 14.7], [-15, 11], [-11.5, 7], [-8, 4.5], [0, 5.6], [5.5, 4.5], [9.6, 3], [9, -1], [12.3, -6], [13.5, -12], [11.8, -17.5], [14.5, -23], [16.5, -28.6], [18.4, -34], [22, -34], [27.5, -33.2], [31.3, -29], [32.8, -25.5], [35.5, -24], [34.9, -20], [39.5, -16.5], [40.4, -11], [39, -6.5], [41, -2], [44.5, 1.5], [49, 6.8], [51.3, 11.8], [45, 10.5], [43.4, 11.7], [41.5, 14.5], [38.5, 18], [37.3, 21], [35.6, 23.5], [33.6, 27.5], [32.4, 29.8], [32.3, 31.2], [28, 31], [25, 31.6], [22.5, 32.8], [20, 31.5], [15.5, 31.5], [11.5, 33.2], [10.8, 35.5], [10, 37.3], [4, 36.9], [0, 35.8], [-5.5, 35.8], [-9.5, 32.5], [-11.5, 28], [-14.5, 26], [-16.5, 22]],
    [[43.3, -21.5], [44, -25], [47, -25.2], [49.5, -17.5], [50.5, -15.2], [49.3, -12], [46, -15.8], [43.6, -18.5]],
    [[-9.5, 37], [-8.9, 39], [-8.8, 42], [-8, 43.7], [-1.6, 43.4], [-1.2, 46], [-4.4, 47.9], [-1.6, 48.7], [0.2, 49.7], [1.6, 50.5], [4, 51.5], [4.8, 52.8], [8.6, 53.9], [8.6, 55.5], [10.3, 57.6], [10.6, 56.2], [11, 54], [14.3, 54], [18.5, 54.5], [21.2, 55.2], [21, 57], [24, 57.4], [23.6, 58.9], [28, 59.5], [30, 60], [25, 60.3], [22.5, 60], [21.4, 61], [21.7, 63], [24.5, 65.8], [29, 69.5], [33, 69.3], [40.5, 67.8], [41, 66.2], [34.8, 65.7], [34.5, 64.5], [37, 63.8], [44, 66.3], [44, 68.4], [53, 68.7], [59, 68.5], [61, 69.8], [66, 69.6], [69.5, 72.8], [73, 71.5], [79, 72.3], [87, 74], [95, 76], [104.5, 77.7], [113, 76], [118, 73.5], [129, 72.6], [140, 72.4], [153, 71], [161, 69.5], [170.5, 70], [180, 68.8], [180, 65], [177, 62.5], [170, 60], [163, 58], [161.8, 54.5], [156.7, 51], [155.5, 56], [158, 58], [160, 60.5], [156, 61.5], [153, 59.2], [143, 59.3], [137.5, 56.5], [135, 54.7], [138.5, 53], [141.3, 53], [140, 48.4], [136.5, 44.8], [133.5, 42.8], [129.7, 41], [128, 39], [129.4, 35.3], [126.2, 35], [126.6, 37], [124.7, 38], [125, 39.6], [121.6, 40], [118, 39.2], [118.9, 37.4], [122.5, 37.3], [120.4, 36], [119.4, 34.8], [121.9, 31.7], [122, 30], [120.4, 27], [118, 24.5], [114.2, 22.3], [110.5, 21.2], [109.6, 21.5], [106.7, 20.7], [105.7, 19], [108.5, 15.5], [109.2, 11.6], [106.5, 9.5], [104.8, 8.6], [103.4, 10.5], [100.9, 12.6], [100, 13.4], [99.2, 10], [100.4, 7.5], [102.9, 5.5], [103.4, 2.6], [104.2, 1.4], [101.4, 2.8], [100.3, 4.8], [98.5, 8.2], [98.6, 12], [97.6, 16.5], [94.3, 16], [94.6, 18], [92.4, 20.7], [91.8, 22.3], [88.5, 21.7], [86.8, 20.4], [83, 17.8], [80.2, 13.5], [80.2, 11], [77.5, 8.1], [76, 10.5], [74.5, 14], [72.8, 19], [72.4, 22.9], [70.5, 20.8], [69, 22.4], [67.4, 24], [66.5, 25.4], [61.5, 25.1], [57.4, 25.7], [56.5, 27.1], [53.5, 26.8], [50.1, 30.2], [48, 29.5], [50.2, 26.7], [51.6, 24.2], [54, 24.1], [56.4, 26.4], [56.4, 24.9], [59.8, 22.3], [57.7, 19], [55.3, 17.2], [52.2, 16], [48.7, 14], [45, 12.8], [43.5, 12.6], [42.6, 15.5], [40.2, 20.2], [38.5, 23.6], [36.5, 26], [34.6, 28.1], [34.4, 29.5], [34.9, 29.5], [34.2, 31.3], [35, 33.1], [36, 34.6], [35.8, 35.8], [36.2, 36.6], [34, 36.3], [30.6, 36.7], [28, 36.7], [26.3, 38.2], [26.6, 40.2], [29, 40.9], [31.2, 41.1], [35.2, 42], [38.3, 40.9], [41.5, 41.5], [41.7, 42.8], [38, 44.5], [39.1, 47.1], [35, 45.6], [36.4, 45.1], [33.5, 44.5], [32.6, 45.4], [33.6, 46], [30.8, 46.6], [29.6, 45], [28.6, 43.7], [28, 42], [28.8, 41.1], [26.4, 40.6], [23, 40.4], [23.5, 38.5], [21.7, 36.8], [20.2, 39.6], [19.5, 41.7], [16, 43.5], [13.7, 45.6], [12.4, 45.4], [12.4, 44.2], [14.9, 42.1], [16.2, 41.7], [18.5, 40.2], [17, 38.9], [16, 38], [16.2, 38.9], [15.4, 40], [14, 40.8], [12.6, 41.5], [10.5, 42.9], [10.2, 43.9], [8.8, 44.4], [6.6, 43.2], [3.1, 43.1], [3.1, 41.9], [0.8, 41], [0, 39.9], [0.1, 38.7], [-0.7, 37.6], [-2.1, 36.7], [-5.4, 36], [-7.5, 37.1]],
    [[5, 58], [5, 62], [8, 63.5], [12.5, 66], [15.5, 68.5], [19, 69.8], [25, 71], [31, 70.3], [28.5, 68.5], [28, 66.5], [30, 63.8], [31.5, 62.8], [27, 60.5], [22.5, 60], [21.6, 63.2], [25.3, 65.5], [22.2, 65.8], [19.6, 63.5], [17.6, 62.5], [18.8, 60], [16.5, 57.8], [14.5, 56.1], [12.9, 55.4], [11.8, 58], [10.5, 59.6], [8, 58.1]],
    [[-5.7, 50], [-1, 50.7], [1.3, 51.1], [1.7, 52.5], [0.3, 53.4], [-1.5, 55.5], [-2.1, 56], [-1.8, 57.6], [-3, 58.6], [-5, 58.6], [-6.2, 57.5], [-5.6, 55.3], [-3.4, 54.9], [-3, 53.3], [-4.6, 53.3], [-4.9, 51.8], [-3, 51.6], [-5.7, 50.1]],
    [[-10, 51.6], [-6.2, 52.2], [-6, 53.8], [-5.5, 54.6], [-8.5, 55.2], [-10, 54.2], [-10.4, 52.2]],
    [[-24, 64.5], [-22, 66.3], [-14.5, 66.2], [-13.6, 65], [-18, 63.4], [-22, 63.8]],
    [[52, 71], [56, 70.5], [58, 72], [61, 74.5], [57, 75], [54, 73]],
    [[130, 31], [131.4, 34.4], [132.8, 35.5], [135.4, 35.6], [136.8, 37.3], [140, 39.6], [141.4, 41.4], [141.9, 39], [140.9, 36.8], [140.6, 35.7], [138.8, 34.6], [135.5, 33.5], [132.4, 32.9], [131.4, 31.4]],
    [[140, 41.5], [141.6, 45.4], [145.5, 43.3], [143.3, 42], [141, 41.8]],
    [[120.2, 22.4], [121.6, 25.3], [121.9, 24.6], [120.9, 22]],
    [[79.8, 6.2], [79.9, 9.6], [81.8, 7.3], [81.2, 6.1]],
    [[95.3, 5.6], [97.5, 5.2], [100.4, 2.2], [104.5, -1.8], [106, -3.2], [105.8, -5.8], [102.3, -4], [98.7, 1.7]],
    [[105.2, -6.8], [110, -6.9], [114.5, -7.8], [108, -7.8]],
    [[109, 1.5], [113.5, 3.8], [117, 6.9], [119.2, 5.3], [117.6, 3.2], [118.1, 1], [116.2, -3.9], [111.8, -3.5], [110, -1.6]],
    [[120.6, 18.5], [122.2, 18.5], [121.6, 15.5], [124.1, 13], [121, 14.1], [120, 16.2]],
    [[122, 7], [126.4, 8.6], [126.2, 6.3], [124, 6.2]],
    [[131, -1.2], [137.8, -1.5], [145.7, -4.8], [147.6, -6.1], [150, -10.3], [143.4, -8.8], [139, -8.1], [138, -5.5], [132.7, -4.1]],
    [[113.4, -22], [115, -30], [115, -33.6], [117.9, -35.1], [124, -33], [131.2, -31.5], [135.6, -34.8], [138, -35.6], [140.6, -38], [146.3, -39.1], [150, -37.4], [152.9, -31.5], [153.1, -25.6], [149.2, -21], [145.4, -16.4], [143.6, -14], [142.5, -10.7], [141.6, -15.6], [139.3, -17.4], [135.5, -15], [136.6, -12], [132.6, -11.5], [129.5, -14.9], [126, -14.2], [122.2, -17.4], [118.8, -20.3], [114.6, -21.8]],
    [[172.7, -34.4], [175.9, -37.4], [178.4, -37.7], [176.8, -40], [175.2, -41.6], [173.8, -39.2], [174.5, -36.6]],
    [[172.8, -40.5], [174.3, -41.7], [172.7, -43.8], [170.6, -45.9], [166.6, -46], [168.5, -44], [172, -41]],
  ];
  const WATER = [
    [[-95, 59], [-91, 63], [-87, 64.5], [-82, 64], [-78, 58], [-77, 55.5], [-80, 51.5], [-87, 55.3], [-92, 57]],
    [[47, 45], [51.5, 47], [53, 45.5], [51, 44.5], [52.7, 41.7], [53.9, 40.5], [53.9, 37.3], [51, 36.8], [49, 37.8], [49.5, 40.2], [47.5, 43.5]],
  ];
  const MAP_Y = 20;
  const MAP_H = 128;
  const K = VIEW_W / 390;
  const mx = (lon) => (lon + 20) * K;
  const my = (lat) => MAP_Y + (75 - lat) * K;

  const CITIES = {
    London: [-0.13, 51.5], Suez: [32.55, 29.97], Bombay: [72.88, 19.08], Kalkutta: [88.36, 22.57], Hongkong: [114.17, 22.32],
    Yokohama: [139.64, 35.44], 'San Francisco': [237.58, 37.77], 'New York': [286, 40.71], London2: [359.87, 51.5],
  };
  const LOOKS = {
    fogg: { name: 'Phileas Fogg', look: mkLook('short', 'brown', 'light', '#3a3a4a', '#2b2d42', 'hat') },
    pass: { name: 'Passepartout', look: mkLook('short', 'black', 'light', '#b8453a', '#2b2d42', 'cap') },
    fix: { name: 'Detektiv Fix', look: mkLook('short', 'red', 'light', '#6b5a45', '#3d3a35', 'hat+beard') },
  };
  const LEGS = deepFreeze([
    { from: 'London', to: 'Suez', days: 7, veh: 'zug',
      path: [[-0.13, 51.5], [2.35, 48.86], [7.7, 45.07], [12.5, 42], [17.94, 40.63], [22, 36.5], [28, 33], [32.3, 31.26], [32.55, 29.97]],
      before: [['fogg', 'Ich wette 20.000 Pfund, dass ich in 80 Tagen um die Welt reise. Abfahrt: heute, 2. Oktober 1872, 20:45 Uhr!'], ['pass', 'Mit nur einer Reisetasche, Monsieur? Na gut – allez!']],
      after: [['fix', 'Das ist er! Der Mann, der die Bank von England bestohlen hat. Ich folge ihm, bis ich ihn verhaften kann!'], ['', 'Detektiv Fix hält Fogg für einen Bankräuber und heftet sich an eure Fersen.']] },
    { from: 'Suez', to: 'Bombay', days: 13, veh: 'schiff',
      path: [[32.55, 29.97], [34.5, 27], [38, 21], [42, 15], [44.5, 12.4], [52, 13], [62, 16], [72.88, 19.08]],
      choice: { who: 'fogg', q: 'Der Dampfer Mongolia fährt pünktlich nach Fahrplan. Was tust du?', options: [
        { t: 'Den Heizern eine Prämie versprechen, wenn sie schneller fahren', d: -2, reply: 'Die Heizer schaufeln wie wild. Die Mongolia kommt zwei Tage früher in Bombay an!' },
        { t: 'In Ruhe Whist spielen', d: 0, reply: 'Fogg gewinnt jede Partie Whist. Die Mongolia kommt genau nach Plan an.' },
      ] } },
    { from: 'Bombay', to: 'Kalkutta', days: 3, veh: 'zug',
      path: [[72.88, 19.08], [76, 21], [77.5, 23], [81.85, 25.45], [85, 24.5], [88.36, 22.57]],
      choice: { who: 'pass', q: 'Halt! Mitten im Dschungel endet die Bahnstrecke. Bis Allahabad fehlen 50 Meilen!', options: [
        { t: 'Den Elefanten Kiouni kaufen – für 2000 Pfund', d: 1, veh: 'elefant', reply: 'Auf Kiouni geht es quer durch den Dschungel. Unterwegs rettet ihr die junge Aouda aus großer Gefahr – sie reist von nun an mit euch.' },
        { t: 'Zu Fuß weitergehen', d: 3, reply: 'Drei lange Tage Fußmarsch durch den Dschungel …' },
        { t: 'Warten, bis die Strecke fertig ist', d: 6, reply: 'Die Bauarbeiter lassen sich Zeit. Sehr viel Zeit.' },
      ] } },
    { from: 'Kalkutta', to: 'Hongkong', days: 13, veh: 'schiff',
      path: [[88.36, 22.57], [89, 19], [93, 14], [97, 7.5], [100, 4], [103.85, 1.29], [106.5, 5], [110, 12], [114.17, 22.32]],
      after: [['', 'Sturm im Chinesischen Meer! Der Dampfer Rangoon kämpft sich durch die Wellen.']],
      extra: 1, extraText: 'Durch den Sturm kommt die Rangoon einen Tag zu spät in Hongkong an.' },
    { from: 'Hongkong', to: 'Yokohama', days: 6, veh: 'boot',
      path: [[114.17, 22.32], [118, 24.5], [121, 28], [123, 31.2], [127, 32.5], [131, 33], [135, 33.5], [139.64, 35.44]],
      choice: { who: 'fogg', q: 'Fix hat Passepartout in einer Hafenkneipe aufgehalten – die Carnatic ist ohne euch abgefahren!', options: [
        { t: 'Das kleine Lotsenboot Tankadère mieten', d: 0, reply: 'Die winzige Tankadère trotzt Wind und Wellen. In Yokohama findet Fogg Passepartout wieder – als Akrobat in einem Zirkus!' },
        { t: 'Eine Woche auf das nächste Schiff warten', d: 7, reply: 'Sieben Tage Warten in Hongkong. Fix reibt sich die Hände.' },
      ] } },
    { from: 'Yokohama', to: 'San Francisco', days: 22, veh: 'schiff',
      path: [[139.64, 35.44], [150, 39], [165, 41], [180, 42], [195, 42], [210, 41], [225, 39.5], [237.58, 37.77]],
      choice: { who: 'fogg', q: 'Die General Grant bringt euch über den Pazifik. Soll sie schneller fahren?', options: [
        { t: 'Dem Kapitän Geld für extra Kohle geben', d: -1, reply: 'Volle Kraft voraus! Ein Tag gewonnen.' },
        { t: 'Das Meer genießen', d: 0, reply: 'Aouda und Fogg schauen den Delfinen zu. Wunderschön – aber nicht schneller.' },
      ] } },
    { from: 'San Francisco', to: 'New York', days: 7, veh: 'zug',
      path: [[237.58, 37.77], [240, 39.5], [250, 41], [258, 41.5], [264.07, 41.26], [272.37, 41.88], [280, 41.5], [286, 40.71]],
      choice: { who: 'pass', q: 'In der Prärie bei Fort Kearney fährt der Zug ohne euch ab!', options: [
        { t: 'Mit Mudges Segelschlitten über die gefrorene Prärie', d: 0, veh: 'schlitten', reply: 'Der Wind pfeift, der Schlitten fliegt über das Eis. In Omaha erwischt ihr den nächsten Zug.' },
        { t: 'Auf den nächsten Zug warten', d: 2, reply: 'Zwei Tage im Schnee. Brrr.' },
      ] } },
    { from: 'New York', to: 'London', days: 9, veh: 'schiff',
      path: [[286, 40.71], [300, 44], [320, 48.5], [340, 51], [351.7, 51.85], [353.75, 53.35], [357, 53.41], [359.87, 51.5]],
      choice: { who: 'fogg', q: 'Der Dampfer China nach Liverpool ist seit 45 Minuten weg!', options: [
        { t: 'Das Frachtschiff Henrietta kaufen – zur Not wird das Holz verheizt', d: 0, reply: 'Als die Kohle ausgeht, lässt Fogg Kabinen, Masten und Deck verfeuern. Die Henrietta schafft es bis Irland!' },
        { t: 'Auf den nächsten Dampfer warten', d: 3, reply: 'Drei Tage später geht es endlich los.' },
      ] },
      after: [['fix', 'Im Namen der Königin: Phileas Fogg, Sie sind verhaftet!'], ['', 'Erst nach Stunden stellt sich heraus: Der echte Bankräuber wurde schon vor Tagen gefasst. Fogg nimmt einen Sonderzug nach London.']] },
  ]);
  // Tage einer Etappe: erste Hälfte nach Fahrplan, zweite Hälfte plus/minus der gewählten
  // Option, dazu Verspätungen (Sturm). Der Spielablauf rechnet mit denselben Funktionen.
  const firstHalf = (L) => (L.choice ? Math.floor(L.days / 2) : L.days);
  const secondHalf = (L, o) => (L.choice ? Math.max(0, L.days - Math.floor(L.days / 2) + o.d) : 0);
  function planDays(picks) {
    let sum = 0;
    LEGS.forEach((L, i) => {
      const o = L.choice ? L.choice.options[picks[i] || 0] : null;
      sum += firstHalf(L) + secondHalf(L, o) + (L.extra || 0);
    });
    return sum;
  }
  // Wer nach Osten um die Welt reist, zählt einen Tag mehr, als wirklich vergangen ist.
  // Gewonnen, wenn die echte Ankunft (20:50 Uhr) vor dem 80. Tag liegt.
  const isWon = (counted) => counted - 1 < 80;

  const VEH = {
    zug: buildSprite(['k.........', 'kk.kkkkk..', 'kkkkRRRk..', 'kRRRRRRkk.', 'kRRRRRRRRk', '.kkkkkkkk.', '.kWk.kWk..', '..k...k...']),
    schiff: buildSprite(['....kk....', '....kk..k.', '..kkkkkkk.', 'kkwwwwwwkk', '.kTTTTTTk.', '..kkkkkk..']),
    boot: buildSprite(['....k.....', '...kwk....', '..kwwwk...', '.kwwwwwk..', '....k.....', 'kkkkkkkkk.', '.kTTTTTk..', '..kkkkk...']),
    elefant: buildSprite(['..kkkkkk..', '.kggggggk.', 'kggggggggk', 'kgekggggk.', 'kgkkggggk.', 'kgk.kgggk.', 'kk..kk.kk.', '....k...k.']),
    schlitten: buildSprite(['....k.....', '...kwk....', '..kwwwk...', '.kwwwwwk..', '....k.....', 'kkkkkkkkkk', '.k.....k..']),
  };

  let mapImg = null;
  let phase = 'intro';
  let t = 0;
  let leg = 0;
  let part = 0;
  let prog = 0;
  let days = 0;
  let shownDays = 0;
  let veh = 'zug';
  let travel = null;
  let traveled = [];
  let msg = null;
  let endT = 0;
  let onExit = null;
  let firstTime = true;
  let result = null;

  function inside(poly, x, y) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i];
      const [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  }

  function buildMap() {
    const c = makeCanvas(VIEW_W, MAP_H);
    const g = c.getContext('2d');
    const boxes = LAND.map((p) => {
      let a = 1e9; let b = -1e9; let cc = 1e9; let d = -1e9;
      for (const [x, y] of p) { a = Math.min(a, x); b = Math.max(b, x); cc = Math.min(cc, y); d = Math.max(d, y); }
      return [a, b, cc, d];
    });
    const land = new Uint8Array(VIEW_W * MAP_H);
    for (let py = 0; py < MAP_H; py++) {
      const lat = 75 - (py + 0.5) / K;
      for (let pxx = 0; pxx < VIEW_W; pxx++) {
        let lon = (pxx + 0.5) / K - 20;
        if (lon > 180) lon -= 360;
        let on = false;
        for (let i = 0; i < LAND.length && !on; i++) {
          const bx = boxes[i];
          if (lon < bx[0] || lon > bx[1] || lat < bx[2] || lat > bx[3]) continue;
          if (inside(LAND[i], lon, lat)) on = true;
        }
        if (on) for (const w of WATER) if (inside(w, lon, lat)) on = false;
        land[py * VIEW_W + pxx] = on ? 1 : 0;
      }
    }
    const at = (x, y) => (x < 0 || y < 0 || x >= VIEW_W || y >= MAP_H ? 0 : land[y * VIEW_W + x]);
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < VIEW_W; x++) {
        let col;
        if (at(x, y)) {
          const coast = !at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1);
          col = coast ? '#8a6f45' : (x * 7 + y * 13) % 17 === 0 ? '#d9c38e' : '#e6d3a3';
        } else {
          col = (x + y * 3) % 23 === 0 ? '#93bcc2' : '#9fc6cb';
        }
        rect(g, x, y, 1, 1, col);
      }
    }
    // Gradnetz
    g.fillStyle = 'rgba(90,70,50,0.18)';
    for (let lon = -0; lon <= 360; lon += 30) g.fillRect(Math.round(mx(lon)), 0, 1, MAP_H);
    for (let lat = 60; lat >= -45; lat -= 30) g.fillRect(0, Math.round(my(lat) - MAP_Y), VIEW_W, 1);
    return c;
  }

  function pathPoints(L) {
    return L.path.map(([lo, la]) => [mx(lo), my(la)]);
  }

  function pointAt(pts, k) {
    let total = 0;
    const seg = [];
    for (let i = 1; i < pts.length; i++) {
      const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      seg.push(l);
      total += l;
    }
    let d = clamp(k, 0, 1) * total;
    for (let i = 0; i < seg.length; i++) {
      if (d <= seg[i] || i === seg.length - 1) {
        const f = seg[i] ? clamp(d / seg[i], 0, 1) : 0;
        return [lerp(pts[i][0], pts[i + 1][0], f), lerp(pts[i][1], pts[i + 1][1], f)];
      }
      d -= seg[i];
    }
    return pts[pts.length - 1];
  }

  function page(who, text) {
    return who ? npcPage(LOOKS[who], text) : narr(text);
  }

  function enter(exitCb, first) {
    onExit = exitCb;
    firstTime = first;
    if (!mapImg) mapImg = buildMap();
    phase = 'intro';
    t = 0;
    leg = 0;
    days = 0;
    shownDays = 0;
    veh = 'zug';
    travel = null;
    traveled = [];
    msg = null;
    endT = 0;
    result = null;
    Sound.play('galop');
    const icon = emblemIcon('reise');
    StoryCard.show([
      { title: 'In 80 Tagen um die Welt', sub: 'Jules Verne · 1873', icon, text: 'London, 1872. Im Reform-Club behauptet der überpünktliche Phileas Fogg, man könne in 80 Tagen um die ganze Welt reisen. Seine Clubfreunde lachen – und Fogg wettet 20.000 Pfund.\n\nNoch am selben Abend bricht er mit seinem Diener Passepartout auf.' },
      { title: 'Die Wette gilt!', sub: 'Zug, Schiff oder Elefant?', icon, text: 'Unterwegs geht einiges schief. Du entscheidest, wie es weitergeht.\n\nAm 21. Dezember um 20:45 Uhr muss Fogg wieder im Reform-Club sein. Jeder Tag zählt!\n\n↑↓ wählen · E bestätigen' },
    ], () => startLeg());
  }

  function startLeg() {
    const L = LEGS[leg];
    veh = L.veh;
    phase = 'talk';
    const go = () => beginTravel(0, L.choice ? 0.5 : 1, firstHalf(L));
    if (L.before) Dialog.open(L.before.map(([w, tx]) => page(w, tx)), go);
    else go();
  }

  function beginTravel(from, to, addDays) {
    phase = 'travel';
    travel = { from, to, addDays, startDays: days, t: 0, dur: 1.2 + (to - from) * 2.2 };
    Sound.sfx(veh === 'zug' ? 'whistle' : veh === 'elefant' ? 'call' : 'splash');
  }

  function update(dt) {
    t += dt;
    if (StoryCard.update(dt)) return;
    if (msg) {
      msg.t -= dt;
      if (msg.t <= 0) msg = null;
    }
    if (phase === 'travel') {
      travel.t += dt;
      const k = clamp(travel.t / travel.dur, 0, 1);
      prog = lerp(travel.from, travel.to, k);
      shownDays = travel.startDays + travel.addDays * k;
      if (k >= 1) {
        days = travel.startDays + travel.addDays;
        shownDays = days;
        legPartDone();
      }
    } else if (phase === 'end') {
      updateEnd(dt);
    }
  }

  function legPartDone() {
    const L = LEGS[leg];
    if (travel.to < 1) {
      // Ereignis unterwegs mit Auswahl
      phase = 'talk';
      const c = L.choice;
      Dialog.open([Object.assign(page(c.who, c.q), {
        choices: c.options.map((o) => ({
          t: o.t + (o.d > 0 ? ' (+' + o.d + ' Tage)' : ''),
          fn: () => {
            if (o.veh) veh = o.veh;
            Sound.sfx(o.d <= 0 ? 'correct' : 'wrong');
            Dialog.open([narr(o.reply)], () => beginTravel(0.5, 1, secondHalf(L, o)));
          },
        })),
      })]);
      return;
    }
    traveled.push(leg);
    phase = 'talk';
    const next = () => {
      leg++;
      if (leg < LEGS.length) startLeg();
      else arrive();
    };
    const pages = [narr('Angekommen in ' + L.to + '. Tag ' + days + ' von 80.')];
    if (L.after) for (const [w, tx] of L.after) pages.push(page(w, tx));
    if (L.extra) {
      days += L.extra;
      shownDays = days;
      pages.push(narr(L.extraText + ' Tag ' + days + '.'));
    }
    Dialog.open(pages, next);
  }

  function arrive() {
    phase = 'end';
    endT = 0;
  }

  function updateEnd(dt) {
    endT += dt;
    if (endT > 0.2 && endT - dt <= 0.2) {
      Sound.sfx('ding');
      const late = days >= 80;
      Dialog.open([
        narr('London! Ein Sonderzug bringt Fogg zum Bahnhof. Die Uhr zeigt 20:50 Uhr am ' + days + '. Tag der Reise.'),
        late
          ? npcPage(LOOKS.fogg, 'Fünf Minuten zu spät. Die Wette ist verloren.')
          : npcPage(LOOKS.fogg, 'Noch vor dem 80. Tag! Passepartout, auf in den Reform-Club!'),
      ], () => twist());
    }
  }

  function twist() {
    const real = days - 1;
    const won = isWon(days);
    const pages = [];
    if (days >= 80) {
      pages.push(npcPage(LOOKS.pass, 'Monsieur! Monsieur! Heute ist erst ' + (real === 79 ? 'Samstag' : 'der ' + real + '. Tag') + '! Wir sind immer nach Osten gereist – jeden Tag ging die Sonne ein bisschen früher auf. Wir haben einen ganzen Tag gewonnen!'));
      if (won) pages.push(narr('20:44:57 Uhr: Phileas Fogg betritt den Reform-Club. Drei Sekunden vor Ablauf der Frist!'));
      else pages.push(narr('Doch selbst mit dem geschenkten Tag ist es zu knapp: Fogg kommt fünf Minuten zu spät in den Club.'));
    } else {
      pages.push(npcPage(LOOKS.pass, 'Und wissen Sie was, Monsieur? Wir sind nach Osten gereist und haben dabei sogar einen Tag gewonnen – wir waren noch schneller als gedacht!'));
    }
    Dialog.open(pages, () => (won ? finish(true) : lost()));
  }

  function lost() {
    phase = 'talk';
    Dialog.open([Object.assign(narr('Fogg hat die Wette verloren – aber er gewinnt etwas Schöneres: Aouda wird seine Frau. Möchtest du es nochmal versuchen?'), {
      choices: [
        { t: 'Nochmal um die Welt!', fn: () => enterAgain() },
        { t: 'Zurück in die Bücherei', fn: () => finish(false) },
      ],
    })]);
  }

  function enterAgain() {
    const cb = onExit;
    const f = firstTime;
    enter(cb, f);
    StoryCard.close();
    startLeg();
  }

  function finish(won) {
    phase = 'outro';
    const pts = won ? (days <= 79 ? 30 : 27) : 20;
    result = { world: 'reise', pts };
    const icon = emblemIcon('reise');
    StoryCard.show([
      { title: won ? 'Gewonnen!' : 'Knapp verloren', sub: 'In 80 Tagen um die Welt', icon, text: 'Wer nach Osten um die Erde reist, erlebt einen Sonnenaufgang mehr als die Daheimgebliebenen – und zählt deshalb einen Tag zu viel.\n\nDeine Reise: ' + days + ' Tage nach eigener Zählung, in Wahrheit ' + (days - 1) + '.' },
      { title: 'Und Fogg?', sub: 'Jules Verne', icon, text: 'Das Schönste an der Reise ist für Phileas Fogg am Ende nicht das Geld: Aouda wird seine Frau.\n\nReisebücher für deine eigene Weltreise findest du bei „Länder & Reisen“ im College 2.' + rewardLine(firstTime, pts) },
    ], () => onExit(result));
  }

  // --- Zeichnen ------------------------------------------------------
  function drawRoute(g) {
    // geplante Route (gepunktet) und erledigte Strecken (rot)
    for (let i = 0; i < LEGS.length; i++) {
      const pts = pathPoints(LEGS[i]);
      const done = traveled.includes(i);
      const cur = i === leg && phase !== 'end';
      const steps = 60;
      for (let s = 0; s <= steps; s++) {
        const k = s / steps;
        const [x, y] = pointAt(pts, k);
        if (done || (cur && k <= prog)) rect(g, Math.round(x), Math.round(y), 1, 1, '#b8453a');
        else if (s % 2 === 0) rect(g, Math.round(x), Math.round(y), 1, 1, '#6b4a2e');
      }
    }
    for (const [name, [lo, la]] of Object.entries(CITIES)) {
      const x = Math.round(mx(lo));
      const y = Math.round(my(la));
      rect(g, x - 1, y - 1, 3, 3, PAL.k);
      rect(g, x, y, 1, 1, '#ffd977');
      if (name === 'London2') continue;
      const label = name;
      const w = Font.measure(label);
      let lx = x + 3;
      let ly = y - 11;
      if (name === 'London') { lx = x - 2; ly = y + 2; }
      if (name === 'Bombay' || name === 'Suez') { lx = x - w - 2; ly = y; }
      if (name === 'New York') { lx = x - w / 2; ly = y + 3; }
      if (name === 'San Francisco') { lx = x - w - 3; ly = y + 1; }
      if (name === 'Kalkutta') { lx = x + 2; ly = y - 10; }
      if (name === 'Hongkong') { lx = x - w / 2; ly = y + 3; }
      Font.drawShadow(g, label, Math.round(lx), Math.round(ly), '#3a2a22', 'rgba(255,250,235,0.85)');
    }
  }

  function draw(g) {
    if (phase === 'intro' || (phase === 'outro' && StoryCard.active())) {
      StoryCard.draw(g);
      return;
    }
    rect(g, 0, 0, VIEW_W, VIEW_H, '#3a2a20');
    g.drawImage(mapImg, 0, MAP_Y);
    rect(g, 0, MAP_Y - 1, VIEW_W, 1, '#2b1d1f');
    rect(g, 0, MAP_Y + MAP_H, VIEW_W, 1, '#2b1d1f');
    drawRoute(g);
    if (phase !== 'end' && leg < LEGS.length) {
      const [x, y] = pointAt(pathPoints(LEGS[leg]), prog);
      const spr = VEH[veh] || VEH.zug;
      const bob = phase === 'travel' ? Math.round(Math.sin(t * 10)) : 0;
      g.drawImage(spr, Math.round(x - spr.width / 2), Math.round(y - spr.height - 1 + bob));
    }
    // Kalender
    const d = Math.floor(shownDays + 1e-6);
    drawWorldHud(g, 'In 80 Tagen um die Welt', 'Tag ' + d + ' / 80');
    const frac = clamp(shownDays / 80, 0, 1.2);
    const bx = 8;
    const by = MAP_Y + MAP_H + 6;
    rect(g, bx, by, VIEW_W - 16, 5, '#2b2230');
    rect(g, bx, by, Math.round((VIEW_W - 16) * Math.min(1, frac)), 5, frac > 0.95 ? '#ff8a5b' : '#e0b13c');
    if (!Dialog.active()) {
      if (phase === 'travel') {
        const L = LEGS[leg];
        Font.draw(g, 'Unterwegs: ' + L.from + ' → ' + L.to, 8, by + 10, UI_COL.text);
      }
      Font.draw(g, 'Frist: 21. Dezember 1872, 20:45 Uhr im Reform-Club', 8, by + 24, UI_COL.dim);
    }
    if (msg) drawWorldMsg(g, msg.text);
    if (StoryCard.active()) StoryCard.draw(g);
  }

  return {
    enter, update, draw, planDays, isWon,
    legs: LEGS, cities: CITIES, mapPoint: (lon, lat) => [mx(lon), my(lat)], mapRect: Object.freeze({ y: MAP_Y, h: MAP_H }),
    debug: () => ({ phase, leg, days, prog, veh }),
  };
})();

// ===================================================================
// Buchwelt: Von der Erde zum Mond – Ladung wählen, im richtigen Moment feuern
// ===================================================================
const MondWorld = (() => {
  const CX = 112;
  const MOUTH_Y = 128;
  const MOON_Y = 38;
  const MOON_V = 34;
  const BARBICANE = { name: 'Impey Barbicane', look: mkLook('short', 'black', 'light', '#2b2d42', '#2b2d42', 'hat') };
  const ARDAN = { name: 'Michel Ardan', look: mkLook('long', 'red', 'light', '#b8453a', '#3d3a35', 'beard') };
  const BULLET = buildSprite(['..kk..', '.kggk.', '.kWgk.', 'kgWggk', 'kgWggk', 'kgWggk', 'kgggGk', 'kkkkkk']);

  let phase = 'intro';
  let t = 0;
  let speed = 6;
  let moonX = -30;
  let shot = null;
  let tries = 0;
  let ghost = null;
  let orbit = 0;
  let smoke = [];
  let msg = null;
  let onExit = null;
  let firstTime = true;
  let result = null;

  // Unter ~11 km/s holt die Erde die Kugel zurück, über 13 km/s wäre der Ruck zu heftig
  const chargeVerdict = (v) => (v < 11 ? 'low' : v > 13 ? 'high' : 'ok');
  const moonYAt = (x) => MOON_Y + Math.pow((x - 192) / 210, 2) * 26;
  const pxSpeed = () => 40 + (speed - 11) * 12;

  function enter(exitCb, first) {
    onExit = exitCb;
    firstTime = first;
    phase = 'intro';
    t = 0;
    speed = 6;
    tries = 0;
    shot = null;
    ghost = null;
    orbit = 0;
    smoke = [];
    msg = null;
    result = null;
    moonX = -30;
    Sound.play('space');
    const icon = emblemIcon('mond');
    StoryCard.show([
      { title: 'Von der Erde zum Mond', sub: 'Jules Verne · 1865', icon, text: 'Baltimore, kurz nach dem Bürgerkrieg. Die Mitglieder des Kanonen-Clubs langweilen sich: keine Schlachten, keine Kanonen. Da hat ihr Präsident Impey Barbicane eine kühne Idee:\n\n„Wir schießen eine Kugel zum Mond!“' },
      { title: 'Die Columbiad', sub: 'Florida, 1. Dezember', icon, text: 'In Florida gießen sie eine riesige Kanone direkt in den Boden: die Columbiad, fast 300 Meter lang. Und der Abenteurer Michel Ardan will mitfliegen – in einer hohlen Kugel aus Aluminium!\n\n↑↓ Ladung wählen · E bestätigen · E im richtigen Moment feuern' },
    ], () => {
      phase = 'talk';
      Dialog.open([
        npcPage(BARBICANE, 'Zuerst die Ladung: Wie schnell muss die Kugel die Kanone verlassen? Ist sie zu langsam, holt die Erde sie zurück.'),
        npcPage(ARDAN, 'Und zu schnell bitte auch nicht – ich möchte heil auf dem Mond ankommen!'),
      ], () => { phase = 'charge'; });
    });
  }

  function update(dt) {
    t += dt;
    if (StoryCard.update(dt)) return;
    if (msg) {
      msg.t -= dt;
      if (msg.t <= 0) msg = null;
    }
    for (const s of smoke) { s.t += dt; s.y -= 6 * dt; s.x += s.vx * dt; }
    smoke = smoke.filter((s) => s.t < 2);
    if (phase === 'charge') updateCharge();
    else if (phase === 'aim') updateAim(dt);
    else if (phase === 'flight') updateFlight(dt);
    else if (phase === 'orbit') updateOrbit(dt);
  }

  function updateCharge() {
    if (Input.hit('up')) { speed = Math.min(16, speed + 0.5); Sound.sfx('blip'); }
    if (Input.hit('down')) { speed = Math.max(4, speed - 0.5); Sound.sfx('blip'); }
    if (Input.confirm()) {
      phase = 'talk';
      const verdict = chargeVerdict(speed);
      if (verdict === 'low') {
        Sound.sfx('wrong');
        Dialog.open([npcPage(BARBICANE, 'Zu wenig! Mit ' + fmt(speed) + ' km/s fällt die Kugel zur Erde zurück. Um der Erdanziehung zu entkommen, braucht sie rund 11 Kilometer pro Sekunde.')], () => { phase = 'charge'; });
      } else if (verdict === 'high') {
        Sound.sfx('wrong');
        Dialog.open([npcPage(ARDAN, 'Halt, halt! Bei ' + fmt(speed) + ' km/s wäre der Ruck beim Abschuss viel zu heftig für uns drei. Etwas weniger, bitte!')], () => { phase = 'charge'; });
      } else {
        Sound.sfx('correct');
        Dialog.open([
          npcPage(BARBICANE, fmt(speed) + ' km/s – genau richtig! Jetzt kommt es auf den Zeitpunkt an. Die Kanone steckt fest im Boden und zeigt senkrecht nach oben.'),
          npcPage(BARBICANE, 'Die Kugel braucht eine Weile bis zum Mond. Also feuern wir nicht, wenn der Mond über uns steht – sondern dann, wenn er dort ankommt, sobald die Kugel oben ist!'),
        ], () => startAim());
      }
    }
  }

  function fmt(v) {
    return v.toFixed(1).replace('.', ',');
  }

  function startAim() {
    phase = 'aim';
    moonX = -30;
    shot = null;
    msg = { text: 'Drück E, um die Columbiad abzufeuern!', t: 3 };
  }

  function updateAim(dt) {
    moonX += MOON_V * dt;
    if (moonX > VIEW_W + 30) {
      moonX = -30;
      msg = { text: 'Der Mond ist untergegangen. Nächste Nacht, neues Glück!', t: 3 };
    }
    if (Input.confirm()) {
      tries++;
      phase = 'flight';
      shot = { y: MOUTH_Y, t: 0 };
      Sound.sfx('boom');
      for (let i = 0; i < 26; i++) smoke.push({ x: CX + (Math.random() - 0.5) * 30, y: MOUTH_Y - Math.random() * 14, vx: (Math.random() - 0.5) * 30, t: Math.random() * 0.4, r: 3 + Math.random() * 5 });
    }
  }

  function updateFlight(dt) {
    moonX += MOON_V * dt;
    shot.t += dt;
    shot.y -= pxSpeed() * dt;
    if (Math.random() < dt * 30) smoke.push({ x: CX + (Math.random() - 0.5) * 3, y: shot.y + 8, vx: 0, t: 0.6, r: 1.5 });
    const my = moonYAt(moonX);
    if (shot.y <= my + 2) {
      const dx = moonX - CX;
      if (Math.abs(dx) < 16 || tries >= 4) {
        phase = 'orbit';
        orbit = 0;
        if (Math.abs(dx) >= 16) moonX = CX + 6;
        Sound.sfx('unlock');
      } else {
        phase = 'talk';
        ghost = { x: moonX, y: my };
        Sound.sfx('wrong');
        const early = dx < 0;
        const tip = early ? 'Zu früh gefeuert – der Mond war noch nicht da. Warte etwas länger!' : 'Zu spät – der Mond war schon vorbei. Feuer etwas früher!';
        Dialog.open([npcPage(BARBICANE, 'Daneben! ' + tip + (tries >= 3 ? ' Keine Sorge, die nächste Kugel sitzt – ich rechne mit.' : ''))], () => { ghost = null; startAim(); });
      }
    }
  }

  function updateOrbit(dt) {
    orbit += dt;
    if (orbit > 4.5) {
      phase = 'outro';
      const pts = tries <= 1 ? 30 : tries === 2 ? 26 : tries === 3 ? 23 : 20;
      result = { world: 'mond', pts };
      const icon = emblemIcon('mond');
      StoryCard.show([
        { title: 'Rund um den Mond', sub: 'Von der Erde zum Mond', icon, text: 'Die Kugel verfehlt den Mond um ein Haar – und schwenkt in eine Bahn um ihn ein. Genau so endet Vernes Buch!\n\nIn der Fortsetzung „Reise um den Mond“ kehren Barbicane, Ardan und Nicholl zur Erde zurück und landen im Pazifik.' + (tries > 1 ? '\n\nVersuche: ' + tries : '\n\nGleich beim ersten Schuss!') },
        { title: 'Fast 100 Jahre später', sub: 'Apollo 8 · 1968', icon, text: 'Im Dezember 1968 umkreisten mit Apollo 8 wirklich drei Menschen den Mond – gestartet in Florida, gelandet im Pazifik. Wie bei Verne!\n\nBücher über Raumfahrt und Technik findest du im Know How.' + rewardLine(firstTime, pts) },
      ], () => onExit(result));
    }
  }

  // --- Zeichnen ------------------------------------------------------
  function drawMoon(g, x, y, alpha = 1) {
    g.globalAlpha = alpha;
    for (let yy = -12; yy <= 12; yy++) {
      for (let xx = -12; xx <= 12; xx++) {
        const d = xx * xx + yy * yy;
        if (d > 144) continue;
        let col = d > 120 ? '#c9c3a6' : '#efe9cf';
        if ((xx + 4) * (xx + 4) + (yy + 3) * (yy + 3) < 10 || (xx - 5) * (xx - 5) + (yy - 4) * (yy - 4) < 6 || (xx - 2) * (xx - 2) + (yy + 7) * (yy + 7) < 4) col = '#cfc8a8';
        px(g, Math.round(x + xx), Math.round(y + yy), col);
      }
    }
    g.globalAlpha = 1;
  }

  function drawScene(g) {
    for (let y = 0; y < VIEW_H; y++) rect(g, 0, y, VIEW_W, 1, mixHex('#060a1e', '#26345e', y / VIEW_H));
    drawStars(g, 1865, 120, t, 0, 0, VIEW_W, 140);
    // Erde: gekrümmter Horizont
    for (let x = 0; x < VIEW_W; x++) {
      const h = 142 + Math.pow((x - 192) / 192, 2) * 10;
      rect(g, x, Math.round(h), 1, VIEW_H - Math.round(h), '#2a3a24');
      rect(g, x, Math.round(h), 1, 2, '#3f5a33');
    }
    // Stones Hill mit der Columbiad
    for (let x = CX - 50; x <= CX + 50; x++) {
      const h = MOUTH_Y + Math.pow((x - CX) / 50, 2) * 18;
      rect(g, x, Math.round(h), 1, 160 - Math.round(h), '#5a4a30');
    }
    rect(g, CX - 9, MOUTH_Y - 4, 18, 6, '#1d1a22');
    rect(g, CX - 11, MOUTH_Y - 5, 22, 2, '#6b6b6b');
    rect(g, CX - 6, MOUTH_Y - 3, 12, 3, '#000000');
    // Zuschauer
    const r = makeRng(3);
    for (let i = 0; i < 60; i++) {
      const x = Math.floor(r() * VIEW_W);
      if (Math.abs(x - CX) < 60) continue;
      const y = 150 + Math.floor(r() * 50);
      rect(g, x, y, 2, 3, pick(['#1d1a22', '#2b2230', '#3a2f2a'], r));
      rect(g, x, y - 2, 2, 2, pick(['#d9a27e', '#a46d45', '#f5cba8'], r));
    }
    const bs = charSprites(BARBICANE.look);
    const as = charSprites(ARDAN.look);
    g.drawImage(bs.right[0], CX - 46, MOUTH_Y + 4);
    g.drawImage(as.left[0], CX + 30, MOUTH_Y + 4);
    // Palmen
    for (const x of [300, 340, 24]) {
      rect(g, x, 128, 2, 22, '#3a2618');
      for (let k = -1; k <= 1; k += 2) { rect(g, x + Math.min(0, k * 7), 126, 7, 1, '#2e5a2e'); rect(g, x + (k < 0 ? -9 : 6), 127, 4, 2, '#2e5a2e'); }
    }
  }

  function draw(g) {
    if (phase === 'intro' || (phase === 'outro' && StoryCard.active())) {
      StoryCard.draw(g);
      return;
    }
    drawScene(g);
    if (ghost) drawMoon(g, ghost.x, ghost.y, 0.35);
    if (phase === 'aim' || phase === 'flight' || phase === 'orbit' || ghost) {
      drawMoon(g, phase === 'orbit' ? moonX : moonX, moonYAt(moonX));
      // Zielhilfe: senkrechte Linie über der Kanone
      for (let y = MOON_Y - 16; y < MOUTH_Y - 8; y += 4) rect(g, CX, y, 1, 2, 'rgba(255,217,119,0.35)');
    }
    for (const s of smoke) {
      g.globalAlpha = Math.max(0, 0.55 - s.t * 0.3);
      rect(g, Math.round(s.x - s.r), Math.round(s.y - s.r), Math.round(s.r * 2), Math.round(s.r * 2), '#c9c6bd');
    }
    g.globalAlpha = 1;
    if (phase === 'flight' && shot) g.drawImage(BULLET, CX - 3, Math.round(shot.y));
    if (phase === 'orbit') {
      const a = orbit * 3;
      const x = moonX + Math.cos(a) * 20;
      const y = moonYAt(moonX) + Math.sin(a) * 9;
      if (Math.sin(a) > -0.2 || Math.cos(a) > 0.6 || Math.cos(a) < -0.6) g.drawImage(BULLET, Math.round(x - 3), Math.round(y - 4));
      Font.drawCentered(g, 'In der Mondumlaufbahn!', VIEW_W / 2, 84, '#ffd977', '#1a1220');
    }
    drawWorldHud(g, 'Von der Erde zum Mond', 'Schuss ' + Math.max(1, tries));
    if (phase === 'charge') {
      drawPanel(g, 200, 50, 172, 70);
      Font.draw(g, 'Startgeschwindigkeit', 210, 56, UI_COL.title);
      Font.draw(g, fmt(speed) + ' km/s', 210, 72, '#ffffff', 2);
      Font.draw(g, '↑↓ ändern · E bestätigen', 210, 102, UI_COL.dim);
      // Skala neben der Kanone
      rect(g, 176, 40, 8, 90, '#2b2230');
      const f = (speed - 4) / 12;
      rect(g, 177, 40 + Math.round(90 * (1 - f)), 6, Math.round(90 * f), speed < 11 ? '#5fa8e8' : speed > 13 ? '#ff6b5b' : '#5fbf5f');
    }
    if (msg) drawWorldMsg(g, msg.text);
    if (StoryCard.active()) StoryCard.draw(g);
  }

  return {
    enter, update, draw, chargeVerdict,
    debug: () => ({ phase, speed, moonX, tries, cx: CX, shotY: shot ? shot.y : null, lead: (MOUTH_Y - moonYAt(CX)) / pxSpeed() * MOON_V }),
  };
})();

// ===================================================================
// Buchwelt: Ada Lovelace – die Analytische Maschine mit Lochkarten programmieren
// ===================================================================
const AdaWorld = (() => {
  const ADA = { name: 'Ada Lovelace', look: mkLook('long', 'black', 'light', '#6a4c93', '#4b3569') };
  const BABBAGE = { name: 'Charles Babbage', look: mkLook('short', 'grey', 'light', '#2b2d42', '#3d3a35', 'beard') };
  const OPS = [
    { s: '+', f: (a, b) => a + b, holes: [1, 0, 0, 1, 0] },
    { s: '−', f: (a, b) => a - b, holes: [0, 1, 0, 1, 1] },
    { s: '×', f: (a, b) => a * b, holes: [1, 1, 0, 0, 1] },
    { s: ':', f: (a, b) => a / b, holes: [0, 0, 1, 1, 0] },
  ];
  const LEVELS = deepFreeze([
    { vars: [2, 3], goal: 5, slots: 1, say: 'Im Speicher liegen zwei Zahlen: V1 = 2 und V2 = 3. Welche Rechenkarte brauchen wir, damit 5 herauskommt?' },
    { vars: [4, 6], goal: 24, slots: 1, say: 'Sehr gut! Jetzt liegen 4 und 6 im Speicher. Diesmal wollen wir 24.' },
    { vars: [5, 3, 4], goal: 32, slots: 2, say: 'Jetzt zwei Karten nacheinander: Zuerst rechnet die Maschine mit V1 und V2, dann mit dem Ergebnis und V3. Ziel: 32.' },
    { loop: true, start: 1, goal: 32, say: 'Mein Lieblingstrick: Wir lassen dieselbe Karte immer wieder laufen! Die Karte „× 2“ verdoppelt V1. Wie oft muss sie laufen, damit aus 1 die Zahl 32 wird?' },
  ]);

  let phase = 'intro';
  let t = 0;
  let level = 0;
  let sel = 0;
  let picks = [];
  let reps = 1;
  let run = null;
  let mistakes = 0;
  let notes = [];
  let musicT = 0;
  let onExit = null;
  let firstTime = true;
  let result = null;

  const fmtNum = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace('.', ','));

  function enter(exitCb, first) {
    onExit = exitCb;
    firstTime = first;
    phase = 'intro';
    t = 0;
    level = 0;
    mistakes = 0;
    notes = [];
    result = null;
    run = null;
    Sound.play('engine');
    const icon = emblemIcon('ada');
    StoryCard.show([
      { title: 'Die Analytische Maschine', sub: 'Ada Lovelace · 1843', icon, text: 'London, 1843. Der Erfinder Charles Babbage plant eine gewaltige Rechenmaschine aus Messing und Zahnrädern: die Analytische Maschine. Gebaut wird sie nie.\n\nAber Ada Lovelace versteht sie besser als fast jeder andere.' },
      { title: 'Lochkarten', sub: 'Das erste Programm', icon, text: 'Ada schreibt auf, wie man der Maschine mit Lochkarten Schritt für Schritt Befehle gibt. Ihre Anleitung gilt heute als erstes veröffentlichtes Computerprogramm.\n\nJetzt bist du dran!\n\n←→ Karte wählen · E Karte einlegen' },
    ], () => startLevel());
  }

  function startLevel() {
    const L = LEVELS[level];
    picks = [];
    sel = 0;
    reps = 1;
    run = null;
    phase = 'talk';
    Dialog.open([npcPage(ADA, L.say)], () => { phase = 'pick'; });
  }

  function update(dt) {
    t += dt;
    if (StoryCard.update(dt)) return;
    for (const n of notes) { n.t += dt; n.y -= 18 * dt; n.x += Math.sin(n.t * 3 + n.ph) * 10 * dt; }
    notes = notes.filter((n) => n.t < 2.5);
    if (phase === 'pick') updatePick();
    else if (phase === 'run') updateRun(dt);
    else if (phase === 'music') updateMusic(dt);
  }

  function updatePick() {
    const L = LEVELS[level];
    if (L.loop) {
      if (Input.hit('up') || Input.hit('right')) { reps = Math.min(9, reps + 1); Sound.sfx('blip'); }
      if (Input.hit('down') || Input.hit('left')) { reps = Math.max(1, reps - 1); Sound.sfx('blip'); }
      if (Input.confirm()) startRun();
      return;
    }
    if (Input.hit('left')) { sel = (sel + 3) % 4; Sound.sfx('blip'); }
    if (Input.hit('right')) { sel = (sel + 1) % 4; Sound.sfx('blip'); }
    if (Input.confirm()) {
      picks.push(sel);
      Sound.sfx('punch');
      if (picks.length >= L.slots) startRun();
    }
  }

  // Was rechnet die Maschine mit diesen Karten (bzw. Wiederholungen) aus?
  function evaluate(li, cards, n) {
    const L = LEVELS[li];
    if (L.loop) {
      const seq = [L.start];
      for (let i = 0; i < n; i++) seq.push(seq[seq.length - 1] * 2);
      return { value: seq[seq.length - 1], seq };
    }
    let v = OPS[cards[0]].f(L.vars[0], L.vars[1]);
    if (L.slots > 1) v = OPS[cards[1]].f(v, L.vars[2]);
    return { value: Math.round(v * 100) / 100, seq: null };
  }

  function compute() {
    return evaluate(level, picks, reps);
  }

  function startRun() {
    const c = compute();
    run = { t: 0, dur: c.seq ? 0.45 * (c.seq.length - 1) + 0.6 : 1.6, value: c.value, seq: c.seq, shown: c.seq ? c.seq[0] : null, step: 0 };
    phase = 'run';
    Sound.sfx('gear');
  }

  function updateRun(dt) {
    run.t += dt;
    if (run.seq) {
      const k = Math.min(run.seq.length - 1, Math.floor(run.t / 0.45));
      if (k !== run.step) {
        run.step = k;
        run.shown = run.seq[k];
        Sound.sfx('gear');
      }
    } else if (Math.floor(run.t * 10) % 4 === 0 && Math.random() < 0.3) {
      Sound.sfx('type');
    }
    if (run.t < run.dur) return;
    const L = LEVELS[level];
    const ok = run.value === L.goal;
    phase = 'talk';
    if (ok) {
      Sound.sfx('bell');
      for (let i = 0; i < 4; i++) notes.push({ x: 320 + Math.random() * 30, y: 60, t: 0, ph: Math.random() * 6, s: '★' });
      if (level + 1 < LEVELS.length) {
        Dialog.open([npcPage(ADA, pick(['Genau! ', 'Wunderbar! ', 'Richtig! '], Math.random) + fmtNum(L.goal) + ' – die Maschine rechnet, wie wir es wollen.')], () => {
          level++;
          startLevel();
        });
      } else {
        Dialog.open([
          npcPage(BABBAGE, 'Zweiunddreißig! Ada, Sie haben meiner Maschine eine Schleife beigebracht.'),
          npcPage(ADA, 'Und sie kann noch mehr als rechnen. Wenn wir ihr die Regeln der Musik beibringen, könnte sie eines Tages ganze Musikstücke komponieren. Hören Sie!'),
        ], () => startMusic());
      }
    } else {
      mistakes++;
      Sound.sfx('wrong');
      let tip;
      if (L.loop) tip = 'Da kommt ' + fmtNum(run.value) + ' heraus – ' + (run.value < L.goal ? 'noch zu wenig. Lass die Karte öfter laufen!' : 'zu viel. Lass sie seltener laufen!');
      else tip = 'Hmm, da kommt ' + fmtNum(run.value) + ' heraus. Versuch es mit einer anderen Karte!';
      Dialog.open([npcPage(ADA, tip)], () => {
        picks = [];
        phase = 'pick';
      });
    }
    run.done = true;
  }

  function startMusic() {
    phase = 'music';
    musicT = 0;
    Sound.play('engine', true);
  }

  function updateMusic(dt) {
    musicT += dt;
    if (Math.random() < dt * 4) notes.push({ x: 300 + Math.random() * 60, y: 70, t: 0, ph: Math.random() * 6, s: '♪' });
    if (musicT > 7.5) {
      phase = 'outro';
      const pts = 20 + Math.max(0, 10 - 2 * mistakes);
      result = { world: 'ada', pts };
      const icon = emblemIcon('ada');
      StoryCard.show([
        { title: 'Musik aus Zahnrädern', sub: 'Die Analytische Maschine', icon, text: 'Ada Lovelace sah schon 1843, was in Computern steckt: Sie verarbeiten nicht nur Zahlen, sondern alles, was man in Zahlen ausdrücken kann – Buchstaben, Bilder, Musik.' + (mistakes ? '' : '\n\nAlle Rätsel ohne Fehler gelöst!') },
        { title: 'Und heute?', sub: 'Ada Lovelace', icon, text: 'Eine Programmiersprache trägt ihren Namen: Ada. Und jedes Jahr im Oktober feiert man den Ada-Lovelace-Tag.\n\nBücher über Informatik und das Programmieren findest du im Know How.' + rewardLine(firstTime, pts) },
      ], () => onExit(result));
    }
  }

  // --- Zeichnen ------------------------------------------------------
  function drawRoom(g) {
    rect(g, 0, 0, VIEW_W, 150, '#5a2630');
    for (let y = 6; y < 150; y += 14) for (let x = (y / 14) % 2 ? 8 : 0; x < VIEW_W; x += 16) rect(g, x + 6, y, 3, 3, '#6b3039');
    rect(g, 0, 146, VIEW_W, 4, '#3a2418');
    rect(g, 0, 150, VIEW_W, VIEW_H - 150, '#4a3426');
    for (let y = 154; y < VIEW_H; y += 7) rect(g, 0, y, VIEW_W, 1, '#3d2a1f');
    // Fenster mit Londoner Nebel
    rect(g, 12, 18, 52, 60, '#3a2418');
    rect(g, 15, 21, 46, 54, '#9aa3a8');
    for (let i = 0; i < 6; i++) rect(g, 15, 30 + i * 8, 46, 3, 'rgba(255,255,255,0.18)');
    rect(g, 18, 52, 8, 23, '#6b7276');
    rect(g, 30, 46, 10, 29, '#737a7e');
    rect(g, 44, 56, 12, 19, '#6b7276');
    rect(g, 37, 21, 2, 54, '#3a2418');
    rect(g, 15, 47, 46, 2, '#3a2418');
  }

  function drawWheels(g, x, y, value, label, spin) {
    rect(g, x + 10, y - 4, 4, 92, '#8a6f2e');
    Font.drawCentered(g, label, x + 12, y - 14, '#ffd977');
    const str = spin ? String(Math.floor(Math.random() * 9999)).padStart(4, '0') : value === null ? '----' : fmtNum(value).padStart(4, ' ').slice(-4);
    for (let i = 0; i < 4; i++) {
      const yy = y + i * 22;
      rect(g, x - 1, yy - 1, 26, 18, PAL.k);
      rect(g, x, yy, 24, 16, '#c9a646');
      rect(g, x, yy, 24, 3, '#e8cf7a');
      rect(g, x, yy + 13, 24, 3, '#9c7d2f');
      Font.drawCentered(g, str[i] === ' ' ? '0' : str[i], x + 12, yy + 3, '#2b1d1f');
    }
  }

  function drawGear(g, cx, cy, r, ang) {
    for (let k = 0; k < 10; k++) {
      const a = ang + (k / 10) * TAU;
      rect(g, Math.round(cx + Math.cos(a) * r) - 1, Math.round(cy + Math.sin(a) * r) - 1, 3, 3, '#9c7d2f');
    }
    for (let yy = -r + 1; yy <= r - 1; yy++) for (let xx = -r + 1; xx <= r - 1; xx++) {
      const d = xx * xx + yy * yy;
      if (d <= (r - 1) * (r - 1)) px(g, cx + xx, cy + yy, d < 4 ? '#5a4a20' : '#c9a646');
    }
  }

  function drawCard(g, x, y, op, on, label) {
    const yy = y - (on ? 4 : 0);
    rect(g, x - 1, yy - 1, 36, 28, on ? '#ffd977' : PAL.k);
    rect(g, x, yy, 34, 26, '#f1e6c8');
    op.holes.forEach((h, i) => { if (h) rect(g, x + 4 + i * 6, yy + 3, 3, 3, '#3a2a22'); });
    Font.drawCentered(g, label || op.s, x + 17, yy + 9, '#3a2a22', null, 2);
  }

  function draw(g) {
    if (phase === 'intro' || (phase === 'outro' && StoryCard.active())) {
      StoryCard.draw(g);
      return;
    }
    drawRoom(g);
    const L = LEVELS[Math.min(level, LEVELS.length - 1)];
    const spinning = phase === 'run' || phase === 'music';
    // Maschine
    rect(g, 140, 20, 238, 128, '#2b1d1f');
    rect(g, 142, 22, 234, 124, '#3a2a20');
    const vars = L.loop ? [run && run.seq ? run.shown : L.start, null, null] : [L.vars[0], L.vars[1], L.vars.length > 2 ? L.vars[2] : null];
    drawWheels(g, 152, 44, vars[0], 'V1', false);
    drawWheels(g, 186, 44, vars[1], 'V2', false);
    drawWheels(g, 220, 44, vars[2], 'V3', false);
    const res = phase === 'run' ? (run.seq ? run.shown : null) : run && run.done ? run.value : null;
    drawWheels(g, 300, 44, res, 'Rechenwerk', phase === 'run' && !run.seq && run.t < run.dur - 0.2);
    const ang = spinning ? t * 4 : 0;
    drawGear(g, 270, 60, 9, ang);
    drawGear(g, 284, 82, 7, -ang * 1.3);
    drawGear(g, 266, 104, 8, ang * 1.1);
    drawGear(g, 346, 122, 6, -ang);
    // Ziel
    const goalTxt = 'Ziel: ' + L.goal;
    drawPanel(g, 150, 4, Font.measure(goalTxt) + 16, 15, 'rgba(30,22,34,0.95)', '#ffd977');
    Font.draw(g, goalTxt, 158, 6, '#ffd977');
    // Ada und Babbage
    g.drawImage(charSprites(ADA.look).right[0], 70, 132);
    g.drawImage(charSprites(BABBAGE.look).right[0], 96, 132);
    for (const n of notes) {
      g.globalAlpha = Math.max(0, 1 - n.t / 2.5);
      Font.draw(g, n.s, Math.round(n.x), Math.round(n.y), '#ffd977');
      g.globalAlpha = 1;
    }
    if (phase === 'music') {
      Font.drawCentered(g, '♪ Die Maschine spielt ihre erste Melodie ♪', VIEW_W / 2, 152, '#ffd977', '#1a1220');
      // Lochkarten laufen durch die Maschine
      for (let i = 0; i < 8; i++) {
        const x = ((i * 40 - musicT * 50) % 320 + 320) % 320 + 30;
        drawCard(g, x, 168, OPS[i % 4], false);
      }
    }
    drawWorldHud(g, 'Analytische Maschine', 'Rätsel ' + Math.min(level + 1, LEVELS.length) + ' / ' + LEVELS.length);
    if (!Dialog.active() && phase === 'pick') {
      drawPanel(g, 6, 152, 372, 58);
      if (L.loop) {
        Font.draw(g, 'Wie oft soll die Karte „× 2“ laufen?', 14, 158, UI_COL.title);
        drawCard(g, 150, 178, OPS[2], true, '×2');
        Font.draw(g, 'Wiederhole:', 200, 182, UI_COL.text);
        Font.draw(g, String(reps) + '×', 262, 176, '#ffffff', 2);
        Font.draw(g, '↑↓ ändern · E starten', 14, 196, UI_COL.dim);
      } else {
        const step = L.slots > 1 ? ' (Karte ' + (picks.length + 1) + ' von 2)' : '';
        Font.draw(g, 'Rechenkarte wählen' + step + ':', 14, 156, UI_COL.title);
        OPS.forEach((op, i) => drawCard(g, 120 + i * 42, 176, op, i === sel));
        if (picks.length) Font.draw(g, 'Erste Karte: ' + OPS[picks[0]].s, 14, 186, UI_COL.good);
        Font.draw(g, '←→ · E', 300, 196, UI_COL.dim);
      }
    }
    if (StoryCard.active()) StoryCard.draw(g);
  }

  return {
    enter, update, draw, evaluate, levels: LEVELS, ops: OPS.map((o) => o.s),
    debug: () => ({ phase, level, sel, picks: picks.slice(), reps, mistakes }),
  };
})();

// ===================================================================
// Bücherliste (Taste B): alle Buchwelten, ab wie vielen ★ sie aufgehen.
// grau = noch zu wenig ★ · normal = freigeschaltet · glitzert = erlebt
// ===================================================================
const BOOK_EMBLEMS = (() => {
  const rows = {
    haensel: [
      '.....kkk........', '....kyyyk.......', '...kyykk........', '...kyk..........',
      '...kyk.......k..', '...kyykk....kWk.', '....kyyyk....k..', '.....kkk........',
      '................', '.......kkk......', '......kWWWk.....', '......kggGk.kkk.',
      '.kkk...kkk.kWWWk', 'kWWWk......kggGk', 'kggGk.......kkk.', '.kkk............',
    ],
    moby: [
      '................', '.kk..........kk.', 'kwwk........kwwk', 'kwwwk......kwwwk',
      '.kwwwk....kwwwk.', '..kwwwkkkkwwwk..', '...kkwwwwwwkk...', '.....kwwwwk.....',
      '......kwwk......', '......kwgk......', '......kwgk......', '..bb..kwgk..bb..',
      '.bBBb.kwgk.bBBb.', 'bBbbBbbbbbbBbbBb', 'BBBBBBBBBBBBBBBB', '................',
    ],
    alice: [
      '......kkkk......', '.....kxxxxk.....', '......kkkk......', '....kkkkkkkk....',
      '...kwwwwkwwwk...', '..kwwwwwkwwwwk..', '..kwwwwwkwwwwk..', '..kwwwwwkkkwwk..',
      '..kwwwwwwwwwwk..', '..kwwwwwwwwwwk..', '...kwwwwwwwwk...', '....kkkkkkkk....',
      '................', '..m..........m..', '.mmm........mmm.', '..m..........m..',
    ],
    turing: [
      '....kkkkkkkk....', '...kggggggggk...', '...kgddddddgk...', '...kgdlllldgk...',
      '...kgdlLlldgk...', '...kgdlllldgk...', '...kgddddddgk...', '...kggggggggk...',
      '...kgrggggygk...', '...kkkkkkkkkk...', '..kGGGGGGGGGGk..', '..kgwkwkwkwkgk..',
      '..kgkwkwkwkwgk..', '..kGGGGGGGGGGk..', '..kkkkkkkkkkkk..', '................',
    ],
    gulliver: [
      '.......k........', '......kwk.......', '.....kwwwk......', '....kwwwwwk.....',
      '...kwwwwwwwk....', '.......k........', '..k....k....k...', '..kkkkkkkkkkkk..',
      '...kTTTTTTTTk...', '....kkkkkkkk....', '................', '.b..b..b..b..b..',
      'bBbbBbbBbbBbbBbb', '................', '..ss..ss..ss....', '..kk..kk..kk....',
    ],
    nuss: [
      '................', '.....kkkkkk.....', '....kTtTtTtk....', '...kTtTtkTtTk...',
      '..kTtTtTkTtTtk..', '..ktTtTtkTtTtk..', '..kTtTtTkTtTtk..', '..ktTtTtkTtTtk..',
      '..kTtTtTkTtTtk..', '...kTtTtkTtTk...', '....kTtTtTtk....', '.....kkkkkk.....',
      '................', '..xx..xx..xx....', '.kRRk.kRRkkRRk..', '.kkkk.kkkk.kkk..',
    ],
    reise: [
      '.....kkkkkk.....', '...kkbbllbbkk...', '..kbbblllbbbbk..', '.kbbllllllbbbbk.',
      '.kbblllllbbllbk.', 'kbbbllllbbbllbbk', 'kbbbbllbbbblllbk', 'kbbbbbbbbbbllbbk',
      'kbllbbbbbbbbbbbk', 'kblllbbbbbbbbbbk', '.kblllbbbbbbbbk.', '.kbbllbbbbbbbbk.',
      '..kbbbbbbbbbbk..', '...kkbbbbbbkk...', '.....kkkkkk.....', '................',
    ],
    mond: [
      '.k..........k...', '......kkkkk.....', '.....kwwwgwk....', '....kwwgwwwwk...',
      '....kwwwwwgwk...', '....kgwwwwwwk...', '....kwwwgwwwk...', '.....kwwwwwk....',
      '......kkkkk.....', '..k.............', '....kk......k...', '...kggk.........',
      '...kggk.........', '..krrrrk........', '...kkkk.........', '....oo..........',
    ],
    ada: [
      '......kkkk......', '...kk.kxxk.kk...', '..kxxkkxxkkxxk..', '..kxxxxxxxxxxk..',
      '...kxxkkkkxxk...', '.kkkxk....kxkkk.', '.kxxxk....kxxxk.', '.kxxxk....kxxxk.',
      '.kkkxk....kxkkk.', '...kxxkkkkxxk...', '..kxxxxxxxxxxk..', '..kxxkkxxkkxxk..',
      '...kk.kxxk.kk...', '......kkkk......', '................', '................',
    ],
  };
  const out = {};
  for (const id of Object.keys(rows)) {
    const c = buildSprite(rows[id]);
    // Graue Variante für noch gesperrte Bücher
    const grey = makeCanvas(16, 16);
    const gg = grey.getContext('2d');
    gg.drawImage(c, 0, 0);
    const img = gg.getImageData(0, 0, 16, 16);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.round((d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) * 0.55 + 30);
      d[i] = v; d[i + 1] = v - 4; d[i + 2] = v + 6;
    }
    gg.putImageData(img, 0, 0);
    out[id] = { c, grey };
  }
  return out;
})();

function worldState(id) {
  if (S.worldsDone.includes(id)) return 'done';
  if (Library.worldUnlocked(id)) return 'open';
  return 'locked';
}

// Aufgeschlagenes Cover einer Buchwelt (auch für die Detailansicht)
function drawBookCover(g, id, x, y, state, t) {
  const w = WORLDS[id];
  const col = state === 'locked' ? '#5a5060' : w.color;
  rect(g, x + 2, y + 2, 32, 42, 'rgba(0,0,0,0.35)');
  rect(g, x, y, 32, 42, PAL.k);
  rect(g, x + 1, y + 1, 30, 40, col);
  rect(g, x + 1, y + 1, 4, 40, shade(col, -0.3));
  rect(g, x + 5, y + 1, 1, 40, shade(col, 0.2));
  const gold = state === 'locked' ? '#7d7280' : '#e0b13c';
  rect(g, x + 8, y + 4, 21, 1, gold);
  rect(g, x + 8, y + 37, 21, 1, gold);
  const em = BOOK_EMBLEMS[id];
  if (em) g.drawImage(state === 'locked' ? em.grey : em.c, x + 10, y + 13);
  if (state === 'locked') {
    // kleines Schloss
    rect(g, x + 22, y + 30, 7, 6, '#2b1d1f');
    rect(g, x + 23, y + 31, 5, 4, '#b9aab8');
    rect(g, x + 23, y + 27, 1, 3, '#2b1d1f');
    rect(g, x + 27, y + 27, 1, 3, '#2b1d1f');
    rect(g, x + 24, y + 26, 3, 1, '#2b1d1f');
  }
  if (state === 'done') {
    for (let k = 0; k < 5; k++) {
      const ph = t * 1.3 + k * 0.61;
      const r = makeRng(k * 131 + Math.floor(ph) * 17 + id.length * 7);
      drawTwinkle(g, x - 3 + r() * 38, y - 3 + r() * 48, Math.sin((ph % 1) * Math.PI));
    }
  }
}

const BookList = (() => {
  let sel = 0;
  let t = 0;
  let hooks = null;
  const X0 = 4;
  const Y0 = 20;
  const RH = 19;
  const LW = 214;

  function open(h) {
    hooks = h || null;
    t = 0;
    let i = WORLD_IDS.findIndex((id) => worldState(id) === 'open');
    if (i < 0) i = WORLD_IDS.findIndex((id) => worldState(id) === 'locked');
    sel = i < 0 ? 0 : i;
  }

  // Rückgabe false = schließen
  function update(dt) {
    t += dt;
    if (Input.hit('up')) { sel = (sel + WORLD_IDS.length - 1) % WORLD_IDS.length; Sound.sfx('blip'); }
    if (Input.hit('down')) { sel = (sel + 1) % WORLD_IDS.length; Sound.sfx('blip'); }
    if (Input.hitAny('books', 'menu', 'map', 'tjump')) return false;
    if (Input.confirm()) {
      if (hooks && hooks.showOnMap) {
        Sound.sfx('select');
        hooks.showOnMap(WORLD_IDS[sel]);
        return false;
      }
      return false;
    }
    return true;
  }

  function fit(text, maxW) {
    if (Font.measure(text) <= maxW) return text;
    let s = text;
    while (s.length > 1 && Font.measure(s + '…') > maxW) s = s.slice(0, -1);
    return s.trimEnd() + '…';
  }

  function drawRow(g, id, i) {
    const w = WORLDS[id];
    const st = worldState(id);
    const y = Y0 + i * RH;
    const on = i === sel;
    if (on) {
      rect(g, X0, y, LW, RH - 1, 'rgba(255,217,119,0.17)');
      rect(g, X0, y, 2, RH - 1, UI_COL.title);
    }
    const em = BOOK_EMBLEMS[id];
    g.drawImage(st === 'locked' ? em.grey : em.c, X0 + 4, y + 1);
    let right = '';
    let rcol = '#8d8091';
    if (st === 'locked') { right = w.need + ' ★'; rcol = '#8d8091'; }
    else if (st === 'done') { right = '✓'; rcol = '#ffd977'; }
    else { right = '★'; rcol = Math.floor(t * 3) % 2 ? '#ffd977' : '#fff3b0'; }
    const rw = Font.measure(right);
    const tcol = st === 'locked' ? '#8d8091' : st === 'done' ? '#ffd977' : '#f7f1e3';
    const title = fit(w.title, LW - 23 - rw - 10);
    Font.draw(g, title, X0 + 23, y + 4, on && st !== 'locked' ? '#ffffff' : tcol);
    Font.draw(g, right, X0 + LW - rw - 5, y + 4, rcol);
    if (st === 'done') {
      // Glanz, der über den Titel wandert, und Glitzersterne
      const tw = Font.measure(title);
      const sx = X0 + 23 + ((t * 70 + i * 40) % (tw + 60)) - 30;
      g.save();
      g.beginPath();
      g.rect(sx, y + 2, 9, 12);
      g.clip();
      Font.draw(g, title, X0 + 23, y + 4, '#fffbe6');
      g.restore();
      for (let k = 0; k < 3; k++) {
        const ph = t * 1.1 + k * 0.37 + i * 0.23;
        const r = makeRng(i * 977 + k * 131 + Math.floor(ph) * 29);
        drawTwinkle(g, X0 + 3 + r() * (LW - 8), y + 1 + r() * (RH - 3), Math.sin((ph % 1) * Math.PI));
      }
    }
  }

  // Detailansicht rechts. Die Positionen stehen in einer eigenen Funktion,
  // damit die Unit-Tests prüfen können, dass alle Texte in den Kasten passen.
  const DETAIL = Object.freeze({ x: 222, y: 18, w: 158, h: 182 });
  function detailLayout(id) {
    const w = WORLDS[id];
    const { y, w: pw } = DETAIL;
    const title = Font.wrap(w.title, pw - 50);
    const shelf = Font.wrap('Regal „' + TOPICS[w.topic].name + '“', pw - 22);
    const teaser = Font.wrap(w.teaser, pw - 14);
    const shelfY = y + 77;
    const teaserY = shelfY + shelf.length * 10 + 4;
    const statusY = y + 152;
    return { title, shelf, teaser, shelfY, teaserY, teaserEnd: teaserY + (teaser.length - 1) * 11 + 9, ruleY: statusY - 4, statusY };
  }

  function drawDetail(g, id) {
    const w = WORLDS[id];
    const st = worldState(id);
    const { x, y, w: pw, h } = DETAIL;
    const L = detailLayout(id);
    drawPanel(g, x, y, pw, h, 'rgba(40,30,48,0.96)', st === 'locked' ? '#6b5a70' : st === 'done' ? '#ffd977' : UI_COL.border);
    drawBookCover(g, id, x + 7, y + 8, st, t);
    L.title.slice(0, 4).forEach((l, i) => Font.draw(g, l, x + 45, y + 9 + i * 10, st === 'locked' ? '#cfc3d0' : UI_COL.title));
    Font.draw(g, w.author + ' · ' + w.year, x + 8, y + 55, UI_COL.dim);
    const col = COLLEGES[TOPICS[w.topic].college];
    rect(g, x + 8, y + 69, 6, 6, col.color);
    Font.draw(g, FLOOR_NAMES[w.floor] + ' · College ' + col.num + ' · ' + col.colorName, x + 18, y + 67, UI_COL.text);
    L.shelf.forEach((l, i) => Font.draw(g, l, x + 18, L.shelfY + i * 10, UI_COL.dim));
    L.teaser.slice(0, 4).forEach((l, i) => Font.draw(g, l, x + 8, L.teaserY + i * 11, '#efe6d6'));
    // Status
    const sy = L.statusY;
    rect(g, x + 5, L.ruleY, pw - 10, 1, 'rgba(234,217,181,0.25)');
    if (st === 'locked') {
      const left = Math.max(0, w.need - S.pts);
      Font.draw(g, 'Ab ' + w.need + ' ★ · noch ' + left + ' ★', x + 8, sy, '#ffc95b');
      const bw = pw - 16;
      const f = clamp(S.pts / w.need, 0, 1);
      rect(g, x + 8, sy + 15, bw, 6, '#2b2230');
      rect(g, x + 8, sy + 15, Math.round(bw * f), 6, '#e0b13c');
      rect(g, x + 8, sy + 15, Math.round(bw * f), 1, '#ffe680');
    } else if (st === 'open') {
      Font.draw(g, 'Freigeschaltet!', x + 8, sy, UI_COL.good);
      Font.draw(g, 'Auf zum Regal!', x + 8, sy + 11, UI_COL.text);
    } else {
      Font.draw(g, 'Erlebt ✓', x + 8, sy, UI_COL.title);
      Font.draw(g, 'Nochmal lesen geht immer.', x + 8, sy + 11, UI_COL.text);
    }
  }

  function draw(g) {
    rect(g, 0, 0, VIEW_W, VIEW_H, '#130e18');
    for (let x = 0; x < VIEW_W; x += 3) rect(g, x, 0, 3, 2, pick(SPINES, makeRng(x * 7 + 3)));
    Font.draw(g, 'Bücherwelten', 8, 4, UI_COL.title);
    const done = WORLD_IDS.filter((id) => S.worldsDone.includes(id)).length;
    Font.draw(g, done + ' von ' + WORLD_IDS.length + ' erlebt', 84, 4, UI_COL.dim);
    const pts = '★ ' + S.pts;
    Font.draw(g, pts, VIEW_W - Font.measure(pts) - 8, 4, '#ffd24a');
    WORLD_IDS.forEach((id, i) => drawRow(g, id, i));
    drawDetail(g, WORLD_IDS[sel]);
    const help = Input.touch
      ? (hooks && hooks.showOnMap ? '↑↓ wählen · A Regal auf dem Lageplan · B schließen' : '↑↓ wählen · B schließen')
      : (hooks && hooks.showOnMap ? '↑↓ wählen · E Regal auf dem Lageplan zeigen · B schließen' : '↑↓ wählen · B schließen');
    Font.drawCentered(g, help, VIEW_W / 2, 204, UI_COL.dim);
  }

  return { open, update, draw, detailLayout, get sel() { return sel; }, set sel(v) { sel = v; } };
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
  ['B', 'Bücherwelten: welches Buch ab wie vielen ★'],
  ['M', 'Musik an/aus'],
  ['Esc / P', 'Menü'],
  ['In Buchwelten', 'Leertaste springen · E sprechen · ↑ klettern'],
  ['Touch', 'Steuerkreuz · A Aktion · B rennen/springen · „Bücher“'],
];

function fitText(text, maxW) {
  if (Font.measure(text) <= maxW) return text;
  let s = text;
  while (s.length > 1 && Font.measure(s + '…') > maxW) s = s.slice(0, -1);
  return s.trimEnd() + '…';
}

function drawControls(g, title = 'Steuerung') {
  drawPanel(g, 24, 16, 336, 184);
  Font.drawCentered(g, title, VIEW_W / 2, 24, UI_COL.title, '#1a1220', 2);
  CONTROLS_TEXT.forEach(([k, v], i) => {
    const y = 47 + i * 15;
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
  let target = null;
  const PLAN_COL = { c1: '#f2d64b', c2: '#e0453f', c3: '#a3a3a3', c4: '#f39232', c5: '#3f86d8', c6: '#4cb050' };
  // Legende rechts: Colleges in Zeilen zu 11 px, darunter der Themenkasten (Zeilen zu 9 px)
  const LEGEND = Object.freeze({ listY: 18, rowH: 11, panelY: 86, panelH: 116, topicW: 162, maxLines: Math.floor((116 - 8) / 9) });
  const topicLines = (cid) => Object.keys(TOPICS).filter((k) => TOPICS[k].college === cid).flatMap((k) => Font.wrap('• ' + TOPICS[k].name, LEGEND.topicW));

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

  // opts.target = { floor, tx, ty, label } markiert ein Regal (aus der Bücherliste)
  function open(opts) {
    const info = Library.miniInfo();
    for (const id of ['2', '3']) if (!plans[id]) plans[id] = buildPlan(info.floors[id]);
    const F = Library.floor;
    const p = Library.player;
    const z = ZONE_COLLEGE[zoneAt(F.id, Math.floor(p.x / TS), Math.floor(p.y / TS))];
    sel = z ? COLLEGE_IDS.indexOf(z) : 0;
    target = opts && opts.target ? opts.target : null;
    if (target) {
      const cid = ZONE_COLLEGE[zoneAt(target.floor, target.tx, target.ty)];
      if (cid) sel = COLLEGE_IDS.indexOf(cid);
    }
    t = 0;
  }

  function update(dt) {
    t += dt;
    if (Input.hit('up')) { sel = (sel + 5) % 6; Sound.sfx('blip'); }
    if (Input.hit('down')) { sel = (sel + 1) % 6; Sound.sfx('blip'); }
    if (Input.hitAny('map', 'menu', 'act', 'jump', 'books', 'tjump')) return false;
    return true;
  }

  function draw(g) {
    rect(g, 0, 0, VIEW_W, VIEW_H, 'rgba(14,10,18,0.97)');
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
    // Ziel aus der Bücherliste
    if (target) {
      const y = target.floor === '2' ? 18 : 104;
      const bx = 8 + target.tx * SC;
      const by = y + 14 + target.ty * SC;
      const on = Math.floor(t * 4) % 2 === 0;
      const r = 3 + Math.round((Math.sin(t * 6) + 1) * 1.5);
      g.strokeStyle = on ? '#e0115f' : '#ffffff';
      g.lineWidth = 1;
      g.strokeRect(bx - r + 0.5, by - r + 0.5, 2 * SC + 2 * r - 1, 2 * SC + 2 * r - 1);
      rect(g, bx, by, 2 * SC, 2 * SC, on ? '#ffd977' : '#e0115f');
      drawBubble(g, bx + SC, by - r - 1, '★', '#c98f1c');
    }
    // Legende: die sechs Colleges, darunter alle Themen des gewählten Colleges
    const lx = 210;
    COLLEGE_IDS.forEach((cid, i) => {
      const c = COLLEGES[cid];
      const y = LEGEND.listY + i * LEGEND.rowH;
      const on = i === sel;
      if (on) rect(g, lx - 2, y - 2, 170, LEGEND.rowH, 'rgba(255,217,119,0.18)');
      rect(g, lx, y, 8, 8, PLAN_COL[cid]);
      Font.draw(g, c.num + ' · ' + c.name, lx + 12, y - 1, on ? UI_COL.title : UI_COL.text);
    });
    const cid = COLLEGE_IDS[sel];
    drawPanel(g, lx - 4, LEGEND.panelY, 174, LEGEND.panelH, 'rgba(40,30,48,0.96)', PLAN_COL[cid]);
    topicLines(cid).slice(0, LEGEND.maxLines).forEach((l, i) => Font.draw(g, l, lx + 2, LEGEND.panelY + 4 + i * 9, UI_COL.text));
    if (target) {
      Font.draw(g, fitText('★ ' + target.label, 300), 8, 204, '#ffd977');
      const back = Input.touch ? 'A zurück' : 'E zurück';
      Font.draw(g, back, VIEW_W - 8 - Font.measure(back), 204, UI_COL.dim);
    } else {
      Font.draw(g, Input.touch ? '↑↓ College wählen · A schließen' : '↑↓ College wählen · K schließen', 8, 204, UI_COL.dim);
      Font.draw(g, 'L Lift · i Info · R Rückgabe', 210, 204, UI_COL.dim);
    }
  }

  return { open, update, draw, topicLines, metrics: LEGEND };
})();

// --- Abzeichen --------------------------------------------------------
function drawBadges(g) {
  drawPanel(g, 14, 6, 356, 204);
  Font.drawCentered(g, 'Abzeichen', VIEW_W / 2, 11, UI_COL.title, '#1a1220', 2);
  BADGES.forEach((b, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 24 + col * 174;
    const y = 36 + row * 31;
    const got = S.badges.includes(b.id);
    // Medaille
    for (let yy = -7; yy <= 7; yy++) for (let xx = -7; xx <= 7; xx++) {
      const d = xx * xx + yy * yy;
      if (d <= 49) px(g, x + 8 + xx, y + 10 + yy, d > 36 ? '#2b1d1f' : got ? (d < 12 ? '#ffe680' : '#e0b13c') : '#5a5060');
    }
    if (got) Font.draw(g, '★', x + 5, y + 5, '#b8860b');
    Font.draw(g, b.name, x + 22, y, got ? UI_COL.title : UI_COL.dim);
    Font.wrap(b.desc, 140).slice(0, 2).forEach((l, j) => Font.draw(g, l, x + 22, y + 10 + j * 9, got ? UI_COL.text : '#8d8091'));
  });
  Font.drawCentered(g, S.badges.length + ' von ' + BADGES.length + ' · Weiter mit E', VIEW_W / 2, 197, UI_COL.dim);
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
    if (ctx === 'library') items.push({ id: 'books', label: 'Bücherwelten' });
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
        case 'books': hooks.openBooks(); return false;
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
  let mapReturn = null;

  // Buchwelten: Szene-Name = Welt-ID
  const SCENES = {
    haensel: HaenselWorld, moby: MobyWorld, alice: AliceWorld, turing: TuringWorld, gulliver: GulliverWorld,
    nuss: NussWorld, reise: ReiseWorld, mond: MondWorld, ada: AdaWorld,
  };

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
    const fresh = !Sound.ready;
    Sound.unlock();
    if (fresh && Sound.ready) {
      Sound.setMusic(S.music);
      Sound.setSfx(S.sfx);
    }
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
      SCENES[id].enter(endWorld, first);
    });
  }

  function endWorld(result) {
    const ctx = worldCtx;
    fadeTo(() => {
      Sound.ambience(null);
      scene = 'library';
      Sound.play('library');
      const w = WORLDS[ctx.id];
      const at = Library.shelfFor(ctx.id);
      const shelf = at ? at.shelf : null;
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

  function openBooks() {
    BookList.open({ showOnMap });
    overlay = 'books';
    Sound.sfx('select');
  }

  // Aus der Bücherliste: Regal auf dem Lageplan zeigen, danach zurück zur Liste
  function showOnMap(id) {
    const at = Library.shelfFor(id);
    if (!at) return;
    const w = WORLDS[id];
    MapView.open({ target: { floor: at.floor, tx: at.shelf.tx, ty: at.shelf.ty, label: '„' + w.title + '“ · ' + FLOOR_NAMES[at.floor] + ', ' + TOPICS[w.topic].name } });
    overlay = 'map';
    mapReturn = 'books';
  }

  const pauseHooks = {
    openMap: () => { MapView.open(); overlay = 'map'; mapReturn = null; },
    openBooks,
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
      if (!MapView.update(dt)) {
        overlay = mapReturn;
        mapReturn = null;
      }
      return;
    }
    if (overlay === 'books') {
      if (!BookList.update(dt) && overlay === 'books') overlay = null;
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
        mapReturn = null;
        Sound.sfx('select');
        return;
      }
      if (Input.hit('books')) {
        openBooks();
        return;
      }
      Library.update(dt);
    } else if (SCENES[scene]) SCENES[scene].update(dt);
  }

  function draw() {
    if (scene === 'title') Title.draw(g);
    else if (scene === 'library') Library.draw(g);
    else if (SCENES[scene]) SCENES[scene].draw(g);
    Banner.draw(g);
    Dialog.draw(g);
    Toast.draw(g);
    if (overlay === 'map') MapView.draw(g);
    if (overlay === 'books') BookList.draw(g);
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

  let errShown = false;
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000 || 0);
    last = now;
    acc += dt;
    let steps = 0;
    try {
      while (acc >= STEP && steps < 6) {
        update(STEP);
        Input.endFrame();
        acc -= STEP;
        steps++;
      }
      if (steps >= 6) acc = 0;
      draw();
    } catch (e) {
      // Ein Fehler soll nicht das ganze Spiel anhalten
      Input.endFrame();
      acc = 0;
      if (!errShown) {
        errShown = true;
        console.error(e);
      }
    }
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
      openMap: () => { MapView.open(); overlay = 'map'; mapReturn = null; },
      startWorld,
    });
    Input.attach(window);
    Input.onAny(() => ensureAudio());
    // Ton freischalten: iOS Safari akzeptiert dafür nur touchend/pointerup/click/keydown –
    // nicht touchstart/pointerdown, auf die die Touch-Knöpfe reagieren. Daher zusätzlich hier.
    for (const type of ['touchend', 'pointerup', 'click', 'keydown']) {
      document.addEventListener(type, ensureAudio, { capture: true, passive: true });
    }
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

  return { boot, startWorld, get scene() { return scene; }, get overlay() { return overlay; } };
})();

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', Game.boot);
else Game.boot();

})();
