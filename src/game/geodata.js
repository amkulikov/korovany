/**
 * Единый источник географических констант мира.
 * Архитектура: первичные параметры → производные значения.
 * Дорога, мосты, ущелье, река вычисляются из геометрии поселений.
 * Нулевые зависимости от остальных модулей проекта.
 */

// ===================== ПЕРВИЧНЫЕ ПАРАМЕТРЫ =====================

// Центры поселений и горы — всё остальное вычисляется из них
const _PAL_CENTER = [230, 230]
const _FORT_CENTER = [20, 20]   // совпадает с горой — форт обступает её
const _ELF_CENTER = [-250, -250]
const _MT_CENTER = [20, 20]     // Гора Тьмы

// Зазоры дороги от стен (корован ~3, + запас)
const _ROAD_CLEARANCE = 15

// ===================== ПОСЕЛЕНИЯ =====================

export const SETTLEMENTS = {
  palace: {
    center: _PAL_CENTER,
    // Основное здание
    mainW: 28, mainD: 28, mainH: 16,
    mainColor: [0.88, 0.86, 0.78],
    // Второй этаж
    floor2W: 22, floor2D: 22, floor2H: 8,
    floor2Color: [0.90, 0.88, 0.80],
    // Угловые башни
    towerW: 7, towerD: 7, towerH: 32,
    towerOffset: 16,
    towerColor: [0.92, 0.90, 0.82],
    towerRoofColor: [0.18, 0.22, 0.52],
    // Стены (между башнями)
    wallH: 12, wallThickness: 2.5, wallSpan: 30,
    wallOffset: 16,
    wallColor: [0.82, 0.80, 0.72],
    wallBattlementColor: [0.85, 0.83, 0.75],
    // Ворота (южная стена)
    gateW: 5, gateH: 6, gateD: 3,
    gateColor: [0.15, 0.12, 0.08],
    // Донжон (центральная башня)
    donjonW: 10, donjonD: 10, donjonH: 38,
    donjonColor: [0.94, 0.92, 0.85],
    donjonRoofColor: [0.15, 0.18, 0.48],
    // Зона
    zoneRadius: 150,
    // Производные
    get southWallY() { return this.center[1] - this.wallOffset - this.wallThickness / 2 },
    get spawnPos() { return [this.center[0], this.southWallY - 4] },
  },

  fort: {
    center: _FORT_CENTER,
    // Основное здание (у подножья горы, SW от центра, всегда внутри стен)
    mainW: 22, mainD: 22, mainH: 14,
    mainColor: [0.28, 0.16, 0.16],
    get mainOffset() { return [-this.towerOffset + 15, -this.towerOffset + 15] },
    // Второй этаж
    floor2W: 16, floor2D: 16, floor2H: 8,
    floor2Color: [0.22, 0.12, 0.12],
    // Башни — по периметру вокруг горы
    towerW: 6, towerD: 6, towerH: 24,
    towerOffset: 40,
    towerColor: [0.22, 0.10, 0.10],
    towerSpikeColor: [0.18, 0.08, 0.08],
    // Стены — соединяют башни (wallSpan вычисляется из towerOffset)
    wallThickness: 2, wallH: 10,
    get wallSpan() { return this.towerOffset * 2 },
    get wallOffset() { return this.towerOffset },
    wallColor: [0.20, 0.10, 0.10],
    // Зона
    zoneRadius: 130,
    // Производные
    get spawnPos() {
      return [this.center[0] - this.wallOffset - 7,
              this.center[1] - this.wallOffset - 7]
    },
  },

  elf_village: {
    center: _ELF_CENTER,
    houses: [
      [-270, -265], [-230, -270], [-265, -225],
      [-245, -215], [-250, -280], [-218, -260], [-280, -245],
    ],
    houseColor: [0.45, 0.3, 0.15],
    roofColor: [0.3, 0.15, 0.05],
    doorColor: [0.25, 0.12, 0.04],
    zoneRadius: 150,
    get spawnPos() { return [...this.center] },
  },
}

// ===================== ГОРА ТЬМЫ =====================

export const DARK_MOUNTAIN = {
  center: _MT_CENTER,
  radius: 45,
  peakH: 55,
}

// ===================== ГЛАВНАЯ ДОРОГА (вычисляется) =====================

// Кольцевая секция вокруг форта/горы.
// Углы (в game coords, CCW от E): от SW (~213°) до ENE (~24°) — дорога огибает с запада и севера.
// Радиус считается от УГЛОВЫХ башен (диагональ √2 * towerOffset + полуширина башни),
// а не от wallOffset — иначе дорога врезается в углы.
const _f = SETTLEMENTS.fort
const _FORT_CORNER_R = Math.ceil(Math.sqrt(2) * _f.towerOffset + _f.towerW / 2)
const _RING_R = _FORT_CORNER_R + _ROAD_CLEARANCE
const _ringAngles = [213, 180, 145, 104, 59, 24]
const _ringPts = _ringAngles.map(a => {
  const r = a * Math.PI / 180
  return [Math.round(_FORT_CENTER[0] + _RING_R * Math.cos(r)),
          Math.round(_FORT_CENTER[1] + _RING_R * Math.sin(r))]
})

// Конечная точка дороги у дворца: южнее южной стены + зазор
const _palRoadEnd = [
  _PAL_CENTER[0],
  _PAL_CENTER[1] - SETTLEMENTS.palace.wallOffset - _ROAD_CLEARANCE,
]

export const MAIN_ROAD = [
  [..._ELF_CENTER],                                    // старт у эльфов
  [-210, -215], [-170, -175], [-130, -128],
  [-115, -115],                                        // мост через ущелье
  [-90, -95], [-50, -45],
  // Кольцевая дорога вокруг форта (вычислена из wallOffset + clearance)
  ..._ringPts,
  [75, 80], [110, 115],
  [145, 145],                                          // мост через реку
  [180, 178], [205, 205],
  _palRoadEnd,                                         // финиш у дворца
]

export const ROAD_WIDTH = 8

// ===================== РАССТОЯНИЕ ДО ЛОМАНОЙ =====================

/** Расстояние от точки (x,y) до ломаной path */
export function distToPath(x, y, path) {
  let minD = Infinity
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, ay] = path[i], [bx, by] = path[i + 1]
    const dx = bx - ax, dy = by - ay
    const len2 = dx * dx + dy * dy
    let t = len2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / len2 : 0
    t = Math.max(0, Math.min(1, t))
    const px = ax + t * dx, py = ay + t * dy
    const d = Math.sqrt((x - px) ** 2 + (y - py) ** 2)
    if (d < minD) minD = d
  }
  return minD
}

// ===================== МОСТЫ (привязаны к дороге) =====================

export const BRIDGES = {
  gorge: {
    pos: { x: -115, y: -115 },
    meshLength: 48,
    deckWidth: 10,
    get halfAlong() { return 36 },
    get halfAcross() { return 9 },
    get railHalfAlong() { return this.meshLength / 2 },
    get railHalfAcross() { return this.deckWidth / 2 },
  },
  river: {
    pos: { x: 145, y: 145 },
    meshLength: 34,
    deckWidth: 8,
    get halfAlong() { return 26 },
    get halfAcross() { return 8 },
    get railHalfAlong() { return this.meshLength / 2 },
    get railHalfAcross() { return this.deckWidth / 2 },
  },
}

// ===================== УЩЕЛЬЕ (привязано к мосту) =====================

const _gorgeC = [BRIDGES.gorge.pos.x, BRIDGES.gorge.pos.y]

export const GORGE = {
  center: _gorgeC,
  // Перпендикулярно дороге (1,-1)
  p1: [_gorgeC[0] - 220, _gorgeC[1] + 220],
  p2: [_gorgeC[0] + 220, _gorgeC[1] - 220],
  width: 18,
  depth: 45,
}

// ===================== РЕКА (привязана к мосту) =====================

const _riverC = [BRIDGES.river.pos.x, BRIDGES.river.pos.y]

export const RIVER_PATH = [
  [_riverC[0] - 150, _riverC[1] + 150],
  [_riverC[0] - 120, _riverC[1] + 125],
  [_riverC[0] - 90, _riverC[1] + 95],
  [_riverC[0] - 60, _riverC[1] + 65],
  [_riverC[0] - 30, _riverC[1] + 35],
  _riverC,
  [_riverC[0] + 35, _riverC[1] - 30],
  [_riverC[0] + 65, _riverC[1] - 60],
  [_riverC[0] + 95, _riverC[1] - 90],
  [_riverC[0] + 125, _riverC[1] - 120],
  [_riverC[0] + 150, _riverC[1] - 150],
]

export const RIVER_WIDTH = 10

// ===================== ЛЮДСКИЕ ДОМА =====================

export const TOWN_BUILDINGS = [
  { x: 52, y: -18, w: 8, d: 7, h: 6 },
  { x: -70, y: -45, w: 7, d: 9, h: 5 },
  { x: 58, y: 12, w: 6, d: 6, h: 7 },
  { x: -65, y: -15, w: 10, d: 8, h: 5 },
  { x: -70, y: 5, w: 7, d: 7, h: 8 },
  { x: -18, y: -55, w: 9, d: 6, h: 4 },
  { x: 18, y: -40, w: 8, d: 10, h: 6 },
  { x: -60, y: -50, w: 6, d: 8, h: 5 },
  { x: 55, y: -28, w: 7, d: 7, h: 6 },
  { x: -55, y: 70, w: 8, d: 6, h: 5 },
]

export const TOWN_COLORS = [
  [0.80, 0.75, 0.55], [0.72, 0.68, 0.52], [0.85, 0.78, 0.58],
  [0.75, 0.72, 0.56], [0.82, 0.76, 0.60],
]

export const TOWN_ROOF_COLOR = [0.55, 0.25, 0.12]
export const TOWN_RIDGE_COLOR = [0.48, 0.20, 0.08]
