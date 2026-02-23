/**
 * Построение 3D мира: ландшафт, здания, небо, лес.
 *
 * Panda3D: Y вперёд, Z вверх.
 * Three.js: Y вверх, Z на камеру.
 * Конвертация: three(x, y, z) = panda(x, z, -y)
 *
 * В game-коде все координаты в системе Panda (x,y — горизонталь, z — высота).
 * Конвертируем при создании мешей.
 */
import * as THREE from 'three'
import { SKY_COLORS, getSkyColorsAt, getFogAt, rand, randInt } from '../game/constants.js'

const SIZE = 700, SEGMENTS = 100, HALF = SIZE / 2, STEP = SIZE / SEGMENTS

// ---- Главная дорога, ущелье, река ----
//
// ГЕОГРАФИЯ:
//   Эльфы(-250,-250) ---[дорога]---> Форт(20,20) ---[дорога]---> Дворец(230,230)
//   Дорога идёт по диагонали x≈y, слегка огибая горный форт.
//
//   УЩЕЛЬЕ — поперёк дороги, на полпути эльфы↔форт (около -115,-115).
//            Направление ущелья: перпендикулярно дороге = (1,-1).
//
//   РЕКА   — поперёк дороги, на полпути форт↔дворец (около 145,145).
//            Направление реки: перпендикулярно дороге = (1,-1).

// Главная дорога: эльфы → форт → дворец (чуть петляет, огибает форт с юга)
const MAIN_ROAD = [
  [-250, -250], [-210, -215], [-170, -175], [-130, -128],
  [-115, -115], // мост через ущелье
  [-90, -95], [-50, -45],
  // Кольцевая дорога вокруг Горы Тьмы (dist≥55 от центра (20,20))
  [-35, -15], [-40, 20], [-30, 55], [5, 80], [50, 70], [75, 45],
  [75, 80], [110, 115],
  [145, 145], // мост через реку
  [180, 178], [205, 205], [230, 205],
]

/** Расстояние от точки до ломаной */
function distToPath(x, y, path) {
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

const ROAD_WIDTH = 8

function roadInfluence(x, y) {
  const d = distToPath(x, y, MAIN_ROAD)
  if (d < ROAD_WIDTH) return 1 - d / ROAD_WIDTH
  return 0
}

// Ущелье: перпендикулярно дороге через (-115,-115), направление (1,-1)
// От гор до гор (до края карты ~350, центр ущелья на -115)
const GORGE_P1 = [-115 - 220, -115 + 220] // (-335, 105) — до гор NW
const GORGE_P2 = [-115 + 220, -115 - 220] // (105, -335) — до гор SE
const GORGE_WIDTH = 18, GORGE_DEPTH = 45

function _distToSegment(x, y, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay
  const len2 = dx * dx + dy * dy
  let t = len2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / len2 : 0
  t = Math.max(0, Math.min(1, t))
  return Math.sqrt((x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2)
}

function gorgeInfluence(x, y) {
  const d = _distToSegment(x, y, ...GORGE_P1, ...GORGE_P2)
  if (d < GORGE_WIDTH) return 1 - d / GORGE_WIDTH
  return 0
}

// Река: перпендикулярно дороге через (145,145), направление (1,-1), петляет
// Концы уходят к горам и теряются между скал (не поднимаются вверх)
const RIVER_PATH = [
  [145 - 150, 145 + 150], // (-5, 295) — исток в горах NW
  [145 - 120, 145 + 125], // (25, 270)
  [145 - 90, 145 + 95],   // (55, 240)
  [145 - 60, 145 + 65],   // (85, 210)
  [145 - 30, 145 + 35],   // (115, 180)
  [145, 145],              // центр (мост)
  [145 + 35, 145 - 30],   // (180, 115)
  [145 + 65, 145 - 60],   // (210, 85)
  [145 + 95, 145 - 90],   // (240, 55)
  [145 + 125, 145 - 120], // (270, 25)
  [145 + 150, 145 - 150], // (295, -5) — устье в горах SE
]
const RIVER_WIDTH = 10

export function riverInfluence(x, y) {
  if (nearBridge(x, y)) return 0 // Мост перекрывает реку
  const d = distToPath(x, y, RIVER_PATH)
  if (d < RIVER_WIDTH) return 1 - d / RIVER_WIDTH
  return 0
}

export function gorgeInfluenceAt(x, y) {
  if (nearBridge(x, y)) return 0  // На мосту — не в ущелье
  return gorgeInfluence(x, y)
}

// Мосты: на пересечении дороги с ущельем/рекой
export const GORGE_BRIDGE_POS = { x: -115, y: -115 }
export const RIVER_BRIDGE_POS = { x: 145, y: 145 }

/** Проверить, находится ли точка на мосту (вдоль диагональной дороги).
 *  Мост: прямоугольник вдоль направления (1,1), шириной bridgeW, длиной bridgeL.
 *  Проецируем на ось дороги и перпендикуляр. */
function nearBridge(x, y) {
  // halfAlong = вдоль дороги, halfAcross = поперёк
  // Gorge bridge: len=48, deckW=10
  // River bridge: len=34, deckW=8
  return onBridge(x, y, GORGE_BRIDGE_POS, 36, 9) || onBridge(x, y, RIVER_BRIDGE_POS, 26, 8)
}

function onBridge(x, y, bridge, halfAlong, halfAcross) {
  // Ось дороги: (1,1)/sqrt(2)
  const dx = x - bridge.x, dy = y - bridge.y
  const along = (dx + dy) / Math.SQRT2   // проекция на дорогу
  const across = (dx - dy) / Math.SQRT2  // проекция на перпендикуляр
  return Math.abs(along) < halfAlong && Math.abs(across) < halfAcross
}

/** Проверка "стоит ли на проходимой поверхности моста" — для heightAt */
function onBridgeSurface(x, y) {
  // Покрывает всю визуальную длину моста + запас
  if (onBridge(x, y, GORGE_BRIDGE_POS, 36, 9)) return 'gorge'
  if (onBridge(x, y, RIVER_BRIDGE_POS, 26, 8)) return 'river'
  return null
}

/** Ограничить позицию перилами моста (вернуть скорректированные x,y) */
export function clampBridgeRailings(x, y, radius) {
  const INV_SQRT2 = 1 / Math.SQRT2
  for (const [bridge, halfAlong, halfAcross] of [
    [GORGE_BRIDGE_POS, 24, 10 / 2],  // gBridgeLen=48 → half=24, gDeckW=10 → halfWidth=5
    [RIVER_BRIDGE_POS, 17, 8 / 2],   // rBridgeLen=34 → half=17, rDeckW=8  → halfWidth=4
  ]) {
    const dx = x - bridge.x, dy = y - bridge.y
    const along = (dx + dy) * INV_SQRT2
    const across = (dx - dy) * INV_SQRT2
    // На мосту?
    if (Math.abs(along) < halfAlong && Math.abs(across) < halfAcross + radius + 1) {
      // Ограничить поперёк (перила)
      const maxAcross = halfAcross - radius
      if (Math.abs(across) > maxAcross && Math.abs(across) < halfAcross + radius + 1) {
        const clampedAcross = across > 0 ? maxAcross : -maxAcross
        // Обратная проекция: x = bridge.x + (along + across) / sqrt2, y = bridge.y + (along - across) / sqrt2
        // but along/across = (dx+dy)/sqrt2, (dx-dy)/sqrt2
        // dx = (along+across)/sqrt2, dy = (along-across)/sqrt2
        const newDx = (along + clampedAcross) * INV_SQRT2
        const newDy = (along - clampedAcross) * INV_SQRT2
        x = bridge.x + newDx
        y = bridge.y + newDy
      }
    }
  }
  return { x, y }
}

// ---- Ландшафт ----

/** Горы по периметру карты */
function _perimeterMountains(x, y) {
  // Расстояние до ближайшего края карты
  const edgeDist = Math.min(HALF - Math.abs(x), HALF - Math.abs(y))
  if (edgeDist > 100) return 0

  // Подавить горы рядом с поселениями (дворец и эльфы)
  const palaceDist = Math.sqrt((x - 230) ** 2 + (y - 230) ** 2)
  const elfDist = Math.sqrt((x + 250) ** 2 + (y + 250) ** 2)
  const settlementSuppress = Math.max(
    palaceDist < 80 ? 1 - palaceDist / 80 : 0,
    elfDist < 80 ? 1 - elfDist / 80 : 0,
  )
  if (settlementSuppress > 0.95) return 0

  // Крутой подъём к краю
  const f = 1 - edgeDist / 100 // 0 в центре, 1 у края
  const steep = f * f * (3 - 2 * f) // smoothstep
  // Скалистые неровности
  const noise = Math.sin(x * 0.06 + y * 0.04) * 0.4
    + Math.sin(x * 0.12 - y * 0.08) * 0.25
    + Math.sin(x * 0.25 + y * 0.18) * 0.1
  // Высота: до 80 у самого края, с вариацией
  const raw = steep * (55 + noise * 25) + f * f * f * 30
  // Плавно уменьшить рядом с поселениями
  return raw * (1 - settlementSuppress)
}

/** Базовая высота рельефа БЕЗ ущелья и реки (для мостов) */
function _baseTerrain(x, y) {
  let h = 0
  if (x > 130 && y > 130) {
    h = Math.sin(x * 0.018) * Math.cos(y * 0.018) * 0.35
  } else if (x < -130 && y < -130) {
    h = Math.sin(x * 0.018) * Math.cos(y * 0.018) * 0.40
  } else {
    h = Math.sin(x * 0.012) * Math.cos(y * 0.012) * 1.0
      + Math.sin(x * 0.025 + 1.0) * Math.sin(y * 0.020) * 0.5
  }
  // Гора Тьмы: центр (20,20), пик ~55, радиус ~45
  {
    const md = Math.sqrt((x - 20) ** 2 + (y - 20) ** 2)
    if (md < 45) {
      const t = 1 - md / 45
      const peak = t * t * (3 - 2 * t) // smoothstep — крутые склоны
      const noise = Math.sin(x * 0.15) * 0.15 + Math.sin(y * 0.12 + x * 0.08) * 0.1
      h += peak * (55 + noise * 8)
    }
  }
  h += _perimeterMountains(x, y)
  return h
}

/** Высота рельефа для ВИЗУАЛА (terrain mesh) — ущелье/река видны везде, даже под мостом */
function heightAtVisual(x, y) {
  let h = _baseTerrain(x, y)

  // === Ущелье (всегда видно, даже под мостом) ===
  const gInf = gorgeInfluence(x, y)
  if (gInf > 0) {
    const steep = gInf * gInf * (3 - 2 * gInf)
    h -= steep * GORGE_DEPTH
    if (gInf > 0.15 && gInf < 0.85) {
      h += Math.sin(x * 0.8) * Math.cos(y * 0.6) * 1.5
        + Math.sin(x * 1.5 + y * 1.2) * 0.8
    }
  }

  // === Река (всегда видна) ===
  const rInfRaw = (() => {
    const d = distToPath(x, y, RIVER_PATH)
    return d < RIVER_WIDTH ? 1 - d / RIVER_WIDTH : 0
  })()
  if (rInfRaw > 0) {
    const rSteep = rInfRaw * rInfRaw * (3 - 2 * rInfRaw)
    h -= rSteep * 8.0
  }

  return h
}

// Фиксированные высоты мостов (вычисляются один раз при buildTerrain)
let _gorgeBridgeH = 0
let _riverBridgeH = 0
function _initBridgeHeights() {
  _gorgeBridgeH = _baseTerrain(GORGE_BRIDGE_POS.x, GORGE_BRIDGE_POS.y)
  _riverBridgeH = _baseTerrain(RIVER_BRIDGE_POS.x, RIVER_BRIDGE_POS.y)
}

/** Высота для ГЕЙМПЛЕЯ — на мосту возвращает высоту настила */
function heightAt(x, y) {
  // Мост: вернуть фиксированную высоту настила (не зависит от позиции на мосту)
  const bridgeType = onBridgeSurface(x, y)
  if (bridgeType === 'gorge') return _gorgeBridgeH + 0.1
  if (bridgeType === 'river') return _riverBridgeH + 0.1
  return heightAtVisual(x, y)
}

function terrainColor(x, y, h) {
  // === Река (видна везде, даже под мостом) ===
  const rInfRaw = (() => {
    const d = distToPath(x, y, RIVER_PATH)
    return d < RIVER_WIDTH ? 1 - d / RIVER_WIDTH : 0
  })()
  if (rInfRaw > 0.3) {
    const t = (rInfRaw - 0.3) / 0.7
    return [0.12 * t + 0.30 * (1 - t), 0.28 * t + 0.50 * (1 - t), 0.50 * t + 0.30 * (1 - t)]
  }

  // === Ущелье (видно везде, даже под мостом) ===
  const gInf = gorgeInfluence(x, y)
  if (gInf > 0.15) {
    // Вариация цвета по позиции — слоистая скала
    const noise = Math.sin(x * 0.5) * Math.cos(y * 0.7) * 0.08
      + Math.sin(x * 1.3 + y * 0.9) * 0.05
    const depth = gInf * gInf * (3 - 2 * gInf) // того же smoothstep как в heightAt
    // Глубже = темнее
    const darkF = 0.6 + 0.4 * (1 - depth)
    return [
      (0.32 + noise) * darkF,
      (0.25 + noise * 0.7) * darkF,
      (0.20 + noise * 0.5) * darkF,
    ]
  }

  // === Дорога (утоптанная грунтовка) ===
  const roadInf = roadInfluence(x, y)
  if (roadInf > 0.2) {
    const t = Math.min(1, (roadInf - 0.2) / 0.5)
    const base = terrainColorBase(x, y, h)
    // Более контрастный бежево-коричневый цвет дороги
    const roadR = 0.58 + Math.sin(x * 0.3 + y * 0.2) * 0.03
    const roadG = 0.44 + Math.sin(x * 0.4 - y * 0.3) * 0.02
    const roadB = 0.26
    return [
      base[0] * (1 - t) + roadR * t,
      base[1] * (1 - t) + roadG * t,
      base[2] * (1 - t) + roadB * t,
    ]
  }

  return terrainColorBase(x, y, h)
}

function terrainColorBase(x, y, h) {
  // Горы — снежные шапки, скала, каменистые склоны
  const noise = Math.sin(x * 0.3 + y * 0.2) * 0.04 + Math.sin(x * 0.7 - y * 0.5) * 0.02
  if (h > 60)  return [0.95 + noise, 0.95 + noise, 0.98]   // Снег (ярко-белый)
  if (h > 45)  return [0.85 + noise, 0.86 + noise, 0.92]   // Снежный покров
  if (h > 30)  return [0.72 + noise, 0.72 + noise, 0.76]   // Заснеженные скалы
  if (h > 20)  return [0.52 + noise, 0.48 + noise, 0.44]   // Высокогорная скала (серая)
  if (h > 12)  return [0.45 + noise, 0.38 + noise, 0.30]   // Каменистый склон
  if (h > 5)   return [0.42 + noise, 0.35 + noise, 0.24]   // Скала / предгорья

  if (y < -130 && x < -130) return [0.06, 0.32, 0.06] // Лес
  if (y > 130 && x > 130)   return [0.52, 0.54, 0.68] // Дворцовая
  return [0.38, 0.58, 0.20]                  // Трава
}

/** Создать плоскость ландшафта. Возвращает { mesh, getHeight } */
export function buildTerrain() {
  _initBridgeHeights()
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS)
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)

  // heightsGrid[iy][ix] для интерполяции
  const grid = []
  for (let iy = 0; iy <= SEGMENTS; iy++) {
    grid[iy] = []
    for (let ix = 0; ix <= SEGMENTS; ix++) {
      const gx = -HALF + ix * STEP
      const gy = -HALF + iy * STEP
      grid[iy][ix] = heightAt(gx, gy)
    }
  }

  // Записать высоты и цвета в BufferGeometry
  // PlaneGeometry при XZ ориентации: по умолчанию лежит в XY, нам нужно XZ
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i) // -HALF..HALF
    const py = pos.getY(i) // -HALF..HALF (в Three.js plane Y)
    // px соответствует game X, py соответствует game Y
    const hVis = heightAtVisual(px, py) // визуал: ущелье видно везде, даже под мостом
    pos.setZ(i, hVis)
    const c = terrainColor(px, py, hVis)
    colors[i * 3] = c[0]; colors[i * 3 + 1] = c[1]; colors[i * 3 + 2] = c[2]
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()

  const mat = new THREE.MeshLambertMaterial({ vertexColors: true })
  const mesh = new THREE.Mesh(geo, mat)
  // PlaneGeometry создаётся в XY плоскости. Повернём чтобы лежала горизонтально.
  // Three.js Y вверх. Поворачиваем plane на -90° по X.
  mesh.rotation.x = -Math.PI / 2
  mesh.receiveShadow = true

  // Функция для получения высоты по game-координатам (x, y)
  // Мосты проверяются напрямую (не через сетку), чтобы избежать
  // провалов из-за билинейной интерполяции на краях ущелья/реки.
  function getHeight(gx, gy) {
    const bridgeType = onBridgeSurface(gx, gy)
    if (bridgeType === 'gorge') return _gorgeBridgeH + 0.1
    if (bridgeType === 'river') return _riverBridgeH + 0.1

    const fx = (gx + HALF) / STEP
    const fy = (gy + HALF) / STEP
    const ix0 = Math.max(0, Math.min(Math.floor(fx), SEGMENTS - 1))
    const iy0 = Math.max(0, Math.min(Math.floor(fy), SEGMENTS - 1))
    const ix1 = Math.min(ix0 + 1, SEGMENTS)
    const iy1 = Math.min(iy0 + 1, SEGMENTS)
    const tx = fx - Math.floor(fx)
    const ty = fy - Math.floor(fy)
    const h00 = grid[iy0]?.[ix0] ?? 0
    const h10 = grid[iy0]?.[ix1] ?? 0
    const h01 = grid[iy1]?.[ix0] ?? 0
    const h11 = grid[iy1]?.[ix1] ?? 0
    return h00 * (1 - tx) * (1 - ty) + h10 * tx * (1 - ty) + h01 * (1 - tx) * ty + h11 * tx * ty
  }

  return { mesh, getHeight }
}

// ---- Конвертация координат: game(x,y,z) → Three.js(x,z,-y) ----
// НЕТ! Мы кладём plane в XZ (rotation.x = -PI/2), значит:
// game X → three X, game Y → three -Z (или +Z?), game Z (высота) → three Y
// Проще: наш plane лежит в XZ. game(x,y) → plane(x,y) → при rotation.x=-PI/2:
// plane X → world X, plane Y → world -Z
// Т.е. game(x,y,z) → three(x, z, -y)

export function toThree(gx, gy, gz) {
  return new THREE.Vector3(gx, gz, -gy)
}

// ---- Здания ----

function makeBuilding(parent, gx, gy, w, d, h, color, getHeight) {
  // Минимальная высота под пятном здания
  const hw = w / 2, hd = d / 2
  const pts = [[gx, gy], [gx - hw, gy - hd], [gx + hw, gy - hd],
               [gx - hw, gy + hd], [gx + hw, gy + hd]]
  const gz = Math.min(...pts.map(([px, py]) => getHeight(px, py))) - 1.0

  const geo = new THREE.BoxGeometry(w, h, d)
  const mat = new THREE.MeshLambertMaterial({ color: new THREE.Color(...color) })
  const mesh = new THREE.Mesh(geo, mat)
  const pos = toThree(gx, gy, gz + h / 2)
  mesh.position.copy(pos)
  parent.add(mesh)
  return mesh
}

// Список AABB всех зданий для коллизий: { cx, cy, hw, hd } (game-координаты, полуширины)
let _buildingBoxes = []

export function getBuildingBoxes() { return _buildingBoxes }

export function buildBuildings(parent, getHeight) {
  const gh = getHeight
  _buildingBoxes = []

  // Хелпер: строим здание и запоминаем AABB
  function bld(gx, gy, w, d, h, color) {
    makeBuilding(parent, gx, gy, w, d, h, color, gh)
    _buildingBoxes.push({ cx: gx, cy: gy, hw: w / 2 + 0.5, hd: d / 2 + 0.5 })
  }

  // === Деревня эльфов ===
  // Дома подальше от дороги (дорога идёт от (-250,-250) к (-210,-215))
  const elfPositions = [[-270, -265], [-230, -270], [-265, -225], [-245, -215], [-250, -280], [-218, -260], [-280, -245]]
  for (const [ex, ey] of elfPositions) {
    const w = rand(5, 9), d = rand(5, 9), h = rand(4, 7)
    bld(ex, ey, w, d, h, [0.45, 0.3, 0.15])
    // Крыша (скатная)
    const roofGz = gh(ex, ey) - 1 + h
    // Основание крыши
    const roofBase = new THREE.Mesh(
      new THREE.BoxGeometry(w + 1.0, 0.3, d + 1.0),
      new THREE.MeshLambertMaterial({ color: new THREE.Color(0.3, 0.15, 0.05) })
    )
    roofBase.position.copy(toThree(ex, ey, roofGz + 0.15))
    parent.add(roofBase)
    // Конёк крыши (ступенчатый — minecraft стиль)
    for (let s = 0; s < 3; s++) {
      const sw = w + 0.8 - s * 1.5, sd = d + 0.8 - s * 1.5
      if (sw < 1 || sd < 1) break
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(sw, 0.6, sd),
        new THREE.MeshLambertMaterial({ color: new THREE.Color(0.3 - s * 0.03, 0.15 - s * 0.02, 0.05) })
      )
      step.position.copy(toThree(ex, ey, roofGz + 0.6 + s * 0.6))
      parent.add(step)
    }
    // Дверь
    const doorGz = gh(ex, ey) - 1
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 2.2, 0.12),
      new THREE.MeshLambertMaterial({ color: new THREE.Color(0.25, 0.12, 0.04) })
    )
    door.position.copy(toThree(ex, ey + d / 2, doorGz + 1.1))
    parent.add(door)
  }

  // === Дворец Императора (детализированный) ===
  const pcx = 230, pcy = 230

  // Основное здание
  bld(pcx, pcy, 28, 28, 16, [0.88, 0.86, 0.78])

  // Второй этаж (чуть меньше)
  makeBuilding(parent, pcx, pcy, 22, 22, 8, [0.90, 0.88, 0.80], gh)

  // Угловые башни — высокие с зубцами
  for (const [dx, dy] of [[-16, -16], [16, -16], [-16, 16], [16, 16]]) {
    const tx = pcx + dx, ty = pcy + dy
    bld(tx, ty, 7, 7, 32, [0.92, 0.90, 0.82])
    // Зубцы на башнях
    const towerGz = gh(tx, ty) - 1 + 32
    for (const [bx, by] of [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]]) {
      const battlement = new THREE.Mesh(
        new THREE.BoxGeometry(2.0, 3.0, 2.0),
        new THREE.MeshLambertMaterial({ color: new THREE.Color(0.90, 0.88, 0.80) })
      )
      battlement.position.copy(toThree(tx + bx, ty + by, towerGz + 1.5))
      parent.add(battlement)
    }
    // Конус крыши башни (ступенчатый)
    for (let s = 0; s < 4; s++) {
      const sz = 6.0 - s * 1.5
      if (sz < 1) break
      const roofPiece = new THREE.Mesh(
        new THREE.BoxGeometry(sz, 1.2, sz),
        new THREE.MeshLambertMaterial({ color: new THREE.Color(0.18, 0.22, 0.52) })
      )
      roofPiece.position.copy(toThree(tx, ty, towerGz + 3.5 + s * 1.2))
      parent.add(roofPiece)
    }
  }

  // Стены дворца (между башнями)
  const wallH = 12
  const wallPositions = [
    [pcx - 16, pcy, 2.5, 30, wallH], // Левая стена
    [pcx + 16, pcy, 2.5, 30, wallH], // Правая стена
    [pcx, pcy - 16, 30, 2.5, wallH], // Нижняя стена
    [pcx, pcy + 16, 30, 2.5, wallH], // Верхняя стена
  ]
  for (const [wx, wy, ww, wd, wh] of wallPositions) {
    makeBuilding(parent, wx, wy, ww, wd, wh, [0.82, 0.80, 0.72], gh)
    _buildingBoxes.push({ cx: wx, cy: wy, hw: ww / 2 + 0.5, hd: wd / 2 + 0.5 })
    // Зубцы на стенах
    const wallGz = gh(wx, wy) - 1 + wh
    const bCount = Math.max(2, Math.floor(Math.max(ww, wd) / 4))
    for (let i = 0; i < bCount; i++) {
      const t = (i + 0.5) / bCount - 0.5
      const bx2 = ww > wd ? t * (ww - 2) : 0
      const by2 = wd > ww ? t * (wd - 2) : 0
      const batt = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 2.0, 1.8),
        new THREE.MeshLambertMaterial({ color: new THREE.Color(0.85, 0.83, 0.75) })
      )
      batt.position.copy(toThree(wx + bx2, wy + by2, wallGz + 1.0))
      parent.add(batt)
    }
  }

  // Ворота дворца (пустая арка — просто тёмный блок в стене)
  const gateGz = gh(pcx, pcy - 16) - 1
  const gate = new THREE.Mesh(
    new THREE.BoxGeometry(5.0, 6.0, 3.0),
    new THREE.MeshLambertMaterial({ color: new THREE.Color(0.15, 0.12, 0.08) })
  )
  gate.position.copy(toThree(pcx, pcy - 16, gateGz + 3.0))
  parent.add(gate)

  // Центральная башня (донжон)
  bld(pcx, pcy, 10, 10, 38, [0.94, 0.92, 0.85])
  const donjonGz = gh(pcx, pcy) - 1 + 38
  // Шпиль
  for (let s = 0; s < 5; s++) {
    const sz = 8.0 - s * 1.6
    if (sz < 1) break
    const spire = new THREE.Mesh(
      new THREE.BoxGeometry(sz, 1.5, sz),
      new THREE.MeshLambertMaterial({ color: new THREE.Color(0.15, 0.18, 0.48) })
    )
    spire.position.copy(toThree(pcx, pcy, donjonGz + 1.5 + s * 1.5))
    parent.add(spire)
  }

  // Флаг на шпиле (синий)
  const flagGz = donjonGz + 10
  const flag = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 8.0, 0.15),
    new THREE.MeshLambertMaterial({ color: new THREE.Color(0.30, 0.25, 0.12) })
  )
  flag.position.copy(toThree(pcx, pcy, flagGz + 4.0))
  parent.add(flag)
  const banner = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 0.08, 1.8),
    new THREE.MeshLambertMaterial({ color: new THREE.Color(0.10, 0.10, 0.70) })
  )
  banner.position.copy(toThree(pcx, pcy, flagGz + 7.0))
  parent.add(banner)

  // === Форт злодея (у подножья Горы Тьмы) ===
  const fcx = 0, fcy = 0
  bld(fcx, fcy, 22, 22, 14, [0.28, 0.16, 0.16])
  // Второй уровень
  makeBuilding(parent, fcx, fcy, 16, 16, 8, [0.22, 0.12, 0.12], gh)
  // Башни
  for (const [dx, dy] of [[-13, -13], [13, -13], [-13, 13], [13, 13]]) {
    bld(fcx + dx, fcy + dy, 6, 6, 24, [0.22, 0.10, 0.10])
    // Шипы на башнях
    const ftGz = gh(fcx + dx, fcy + dy) - 1 + 24
    for (let s = 0; s < 3; s++) {
      const spike = new THREE.Mesh(
        new THREE.BoxGeometry(1.2 - s * 0.4, 1.5, 1.2 - s * 0.4),
        new THREE.MeshLambertMaterial({ color: new THREE.Color(0.18, 0.08, 0.08) })
      )
      spike.position.copy(toThree(fcx + dx, fcy + dy, ftGz + 1.5 + s * 1.5))
      parent.add(spike)
    }
  }
  // Тёмные стены
  for (const [wx, wy, ww, wd] of [
    [fcx - 13, fcy, 2, 24], [fcx + 13, fcy, 2, 24],
    [fcx, fcy - 13, 24, 2], [fcx, fcy + 13, 24, 2],
  ]) {
    makeBuilding(parent, wx, wy, ww, wd, 10, [0.20, 0.10, 0.10], gh)
    _buildingBoxes.push({ cx: wx, cy: wy, hw: ww / 2 + 0.5, hd: wd / 2 + 0.5 })
  }

  // === Око Саурона на Горе Тьмы ===
  {
    const eyeX = 20, eyeY = 20
    const mountainH = gh(eyeX, eyeY)

    // Тёмная башня — узкая, от вершины горы вверх
    const towerH = 30
    const towerGz = mountainH
    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(3, towerH, 3),
      new THREE.MeshLambertMaterial({ color: new THREE.Color(0.08, 0.04, 0.04) })
    )
    tower.position.copy(toThree(eyeX, eyeY, towerGz + towerH / 2))
    parent.add(tower)

    // Сужение к вершине (ступенчатая пирамида)
    for (let s = 0; s < 4; s++) {
      const sz = 2.6 - s * 0.5
      const piece = new THREE.Mesh(
        new THREE.BoxGeometry(sz, 2, sz),
        new THREE.MeshLambertMaterial({ color: new THREE.Color(0.06, 0.02, 0.02) })
      )
      piece.position.copy(toThree(eyeX, eyeY, towerGz + towerH + 1 + s * 2))
      parent.add(piece)
    }

    // Глаз — сплюснутый эллипс, emissive оранжево-красный
    const eyeGz = towerGz + towerH + 10
    const eyeMesh = new THREE.Mesh(
      new THREE.BoxGeometry(5, 7, 2),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.35, 0.0) })
    )
    eyeMesh.position.copy(toThree(eyeX, eyeY, eyeGz))
    parent.add(eyeMesh)

    // Зрачок — вертикальная чёрная полоска
    const pupil = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 5, 2.1),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.0, 0.0, 0.0) })
    )
    pupil.position.copy(toThree(eyeX, eyeY, eyeGz))
    parent.add(pupil)

    // Свечение вокруг глаза (полупрозрачный ореол)
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(8, 10, 3),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(1.0, 0.2, 0.0),
        transparent: true,
        opacity: 0.3,
      })
    )
    glow.position.copy(toThree(eyeX, eyeY, eyeGz))
    parent.add(glow)
  }

  // === Деревянные мосты (диагональные — вдоль дороги, поперёк ущелья/реки) ===
  // Дорога идёт по диагонали (1,1), ущелье/река — перпендикулярно (1,-1).
  // Мосты строим axis-aligned внутри Group, затем поворачиваем Group на -45° вокруг Y.
  // Направление (1,1) в game → Three.js: (1,0,-1) → вращение по Y = -PI/4 (−45°)
  {
    // Дорога (1,1) в game → Three.js (1,0,-1) → angle = atan2(-(-1), 1) = PI/4
    const bridgeAngle = Math.PI / 4

    // --- Мост через ущелье ---
    const gBx = GORGE_BRIDGE_POS.x, gBy = GORGE_BRIDGE_POS.y
    const gBridgeH = gh(gBx, gBy) - 0.15 // чуть ниже чтобы настил был вровень
    const gGroup = new THREE.Group()
    gGroup.position.copy(toThree(gBx, gBy, gBridgeH))
    gGroup.rotation.y = bridgeAngle

    const plankMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(0.50, 0.34, 0.16) })
    const logMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(0.38, 0.24, 0.10) })
    const ropeMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(0.55, 0.42, 0.22) })

    // Мост: local X = длина моста (идём вдоль дороги), local Z = ширина
    // После rotation.y = PI/4, local X → game (1,1) = вдоль дороги
    // Ущелье шириной 18 перпендикулярно дороге → мост длиной 28 чтобы перекрыть
    const gBridgeLen = 48 // длина моста вдоль дороги (перекрывает ущелье width=18 + большой запас)
    const gDeckW = 10     // ширина дорожки

    // Продольные брёвна (несущие) — вдоль моста (local X)
    for (const dz of [-gDeckW / 2 + 0.5, gDeckW / 2 - 0.5]) {
      const log = new THREE.Mesh(new THREE.BoxGeometry(gBridgeLen, 0.6, 0.7), logMat)
      log.position.set(0, -0.3, dz)
      gGroup.add(log)
    }
    for (const dz of [-1.0, 1.0]) {
      const log = new THREE.Mesh(new THREE.BoxGeometry(gBridgeLen, 0.4, 0.5), logMat)
      log.position.set(0, -0.3, dz)
      gGroup.add(log)
    }
    // Поперечные доски настила
    for (let dx = -gBridgeLen / 2; dx <= gBridgeLen / 2; dx += 0.8) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.15, gDeckW), plankMat)
      plank.position.set(dx, 0.1, 0)
      gGroup.add(plank)
    }
    // Перила — вдоль длины моста (local X), по краям ширины (local Z)
    for (const dz of [-(gDeckW / 2 + 0.5), gDeckW / 2 + 0.5]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(gBridgeLen, 0.2, 0.2), logMat)
      rail.position.set(0, 1.5, dz)
      gGroup.add(rail)
      const rope = new THREE.Mesh(new THREE.BoxGeometry(gBridgeLen, 0.08, 0.08), ropeMat)
      rope.position.set(0, 0.8, dz)
      gGroup.add(rope)
      for (let dx = -gBridgeLen / 2; dx <= gBridgeLen / 2; dx += 3) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.8, 0.3), logMat)
        post.position.set(dx, 0.9, dz)
        gGroup.add(post)
      }
    }
    // Опорные сваи — глубокие (ущелье ~45 ед. глубиной)
    for (const [dx, dz] of [[-8, -3], [-8, 3], [0, -3], [0, 3], [8, -3], [8, 3]]) {
      const pile = new THREE.Mesh(new THREE.BoxGeometry(0.7, 50, 0.7), logMat)
      pile.position.set(dx, -25, dz)
      gGroup.add(pile)
    }
    // Распорки крестовые
    for (const dx of [-8, 0, 8]) {
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.25, 20, gDeckW), logMat)
      brace.position.set(dx, -12, 0)
      brace.rotation.z = 0.3
      gGroup.add(brace)
      const brace2 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 20, gDeckW), logMat)
      brace2.position.set(dx, -12, 0)
      brace2.rotation.z = -0.3
      gGroup.add(brace2)
    }
    parent.add(gGroup)
    // Мосты НЕ добавляем в buildingBoxes — по ним можно ходить!

    // --- Мост через реку ---
    const rBx = RIVER_BRIDGE_POS.x, rBy = RIVER_BRIDGE_POS.y
    const rBridgeH = gh(rBx, rBy) - 0.15 // чуть ниже чтобы настил был вровень
    const rGroup = new THREE.Group()
    rGroup.position.copy(toThree(rBx, rBy, rBridgeH))
    rGroup.rotation.y = bridgeAngle

    const plankMat2 = new THREE.MeshLambertMaterial({ color: new THREE.Color(0.48, 0.32, 0.15) })
    const logMat2 = new THREE.MeshLambertMaterial({ color: new THREE.Color(0.35, 0.22, 0.09) })
    const ropeMat2 = new THREE.MeshLambertMaterial({ color: new THREE.Color(0.52, 0.40, 0.20) })

    // local X = длина моста (вдоль дороги, перекрывает реку), local Z = ширина
    const rBridgeLen = 34 // длина вдоль дороги (river width=10 + большой запас)
    const rDeckW = 8      // ширина дорожки

    // Продольные брёвна (вдоль моста, local X)
    for (const dz of [-rDeckW / 2 + 0.5, rDeckW / 2 - 0.5]) {
      const log = new THREE.Mesh(new THREE.BoxGeometry(rBridgeLen, 0.4, 0.5), logMat2)
      log.position.set(0, -0.1, dz)
      rGroup.add(log)
    }
    // Поперечные доски настила
    for (let dx = -rBridgeLen / 2; dx <= rBridgeLen / 2; dx += 0.8) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, rDeckW), plankMat2)
      plank.position.set(dx, 0.1, 0)
      rGroup.add(plank)
    }
    // Перила
    for (const dz of [-(rDeckW / 2 + 0.5), rDeckW / 2 + 0.5]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(rBridgeLen, 0.18, 0.15), logMat2)
      rail.position.set(0, 1.2, dz)
      rGroup.add(rail)
      const rope = new THREE.Mesh(new THREE.BoxGeometry(rBridgeLen, 0.06, 0.08), ropeMat2)
      rope.position.set(0, 0.7, dz)
      rGroup.add(rope)
      for (let dx = -rBridgeLen / 2; dx <= rBridgeLen / 2; dx += 3) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.3, 0.22), logMat2)
        post.position.set(dx, 0.7, dz)
        rGroup.add(post)
      }
    }
    // Сваи в воде
    for (const [dx, dz] of [[-5, -2.5], [-5, 2.5], [0, -2.5], [0, 2.5], [5, -2.5], [5, 2.5]]) {
      const pile = new THREE.Mesh(new THREE.BoxGeometry(0.4, 8, 0.4), logMat2)
      pile.position.set(dx, -4, dz)
      rGroup.add(pile)
    }
    parent.add(rGroup)
  }

  // === Людской город ===
  // Дома расставлены ОТ дороги (дорога проходит через кольцо вокруг горы)
  // Координаты проблемных домов сдвинуты от дороги к юго-востоку
  const townBuildings = [
    [52, -18, 8, 7, 6], [-70, -45, 7, 9, 5], [58, 12, 6, 6, 7],
    [-65, -15, 10, 8, 5], [-70, 5, 7, 7, 8], [-18, -55, 9, 6, 4],
    [18, -40, 8, 10, 6], [-60, -50, 6, 8, 5], [55, -28, 7, 7, 6],
    [-55, 70, 8, 6, 5],
  ]
  const townColors = [
    [0.80, 0.75, 0.55], [0.72, 0.68, 0.52], [0.85, 0.78, 0.58],
    [0.75, 0.72, 0.56], [0.82, 0.76, 0.60],
  ]
  for (let i = 0; i < townBuildings.length; i++) {
    const [x, y, w, d, h] = townBuildings[i]
    // Проверка: не строить на дороге
    const roadDist = distToPath(x, y, MAIN_ROAD)
    if (roadDist < ROAD_WIDTH + Math.max(w, d) / 2 + 4) continue
    const col = townColors[i % townColors.length]
    bld(x, y, w, d, h, col)
    // Крыша
    const roofGz = gh(x, y) - 1 + h
    const roofMesh = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.8, 0.5, d + 0.8),
      new THREE.MeshLambertMaterial({ color: new THREE.Color(0.55, 0.25, 0.12) })
    )
    roofMesh.position.copy(toThree(x, y, roofGz + 0.25))
    parent.add(roofMesh)
    // Ступенчатый конёк
    const ridge = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.5, 1.0, d + 0.5),
      new THREE.MeshLambertMaterial({ color: new THREE.Color(0.48, 0.20, 0.08) })
    )
    ridge.position.copy(toThree(x, y, roofGz + 1.0))
    parent.add(ridge)
  }
}

// ---- Вода (река) ----

export function buildWater(parent, getHeight) {
  const waterMat = new THREE.MeshPhongMaterial({
    color: 0x1a6688,
    transparent: true,
    opacity: 0.72,
    shininess: 140,
    specular: 0x88ccee,
    side: THREE.DoubleSide,
  })

  const waterMeshes = []

  // Интерполируем RIVER_PATH чтобы получить много промежуточных точек (гладкая река)
  const smoothPath = []
  for (let i = 0; i < RIVER_PATH.length - 1; i++) {
    const [ax, ay] = RIVER_PATH[i], [bx, by] = RIVER_PATH[i + 1]
    const segLen = Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2)
    const steps = Math.max(4, Math.ceil(segLen / 3)) // точка каждые ~3 юнита
    for (let s = 0; s < steps; s++) {
      const t = s / steps
      smoothPath.push([ax + (bx - ax) * t, ay + (by - ay) * t])
    }
  }
  smoothPath.push(RIVER_PATH[RIVER_PATH.length - 1])

  // Для каждой точки — левый и правый край
  const halfW = RIVER_WIDTH * 0.95
  const leftPts = [], rightPts = []

  for (let i = 0; i < smoothPath.length; i++) {
    const [px, py] = smoothPath[i]
    let dx = 0, dy = 0
    if (i < smoothPath.length - 1) {
      dx += smoothPath[i + 1][0] - px; dy += smoothPath[i + 1][1] - py
    }
    if (i > 0) {
      dx += px - smoothPath[i - 1][0]; dy += py - smoothPath[i - 1][1]
    }
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const perpX = -dy / len, perpY = dx / len
    leftPts.push([px - perpX * halfW, py - perpY * halfW])
    rightPts.push([px + perpX * halfW, py + perpY * halfW])
  }

  // Triangle strip с высотой воды по каждой точке
  const vertCount = smoothPath.length * 2
  const positions = new Float32Array(vertCount * 3)

  // Вычислить базовую высоту воды в центре реки (без гор)
  const centerBank = _baseTerrain(145, 145) - _perimeterMountains(145, 145)
  const baseWaterH = centerBank - 2.0

  for (let i = 0; i < smoothPath.length; i++) {
    const [cx, cy] = smoothPath[i]
    // Высота воды: берег без гор минус небольшое погружение
    // Не поднимаем выше базового уровня (река не лезет в горы)
    const flatBank = _baseTerrain(cx, cy) - _perimeterMountains(cx, cy)
    const waterH = Math.min(flatBank - 1.5, baseWaterH + 1.0)

    const lp = toThree(leftPts[i][0], leftPts[i][1], waterH)
    const rp = toThree(rightPts[i][0], rightPts[i][1], waterH)
    positions[i * 6]     = lp.x; positions[i * 6 + 1] = lp.y; positions[i * 6 + 2] = lp.z
    positions[i * 6 + 3] = rp.x; positions[i * 6 + 4] = rp.y; positions[i * 6 + 5] = rp.z
  }

  const indices = []
  for (let i = 0; i < smoothPath.length - 1; i++) {
    const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1
    indices.push(a, c, b, b, c, d)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()

  const mesh = new THREE.Mesh(geo, waterMat)
  parent.add(mesh)
  waterMeshes.push(mesh)

  return waterMeshes
}

/** Анимировать воду (вызывать каждый кадр) */
let _waterBaseY = null
export function updateWater(waterMeshes, time) {
  if (!waterMeshes || waterMeshes.length === 0) return
  if (!_waterBaseY) {
    _waterBaseY = waterMeshes.map(m => m.position.y)
  }
  for (let i = 0; i < waterMeshes.length; i++) {
    const base = _waterBaseY[i] || 0
    waterMeshes[i].position.y = base + Math.sin(time * 1.5 + i * 0.7) * 0.08
  }
}

// ---- Небо ----

export function buildSky(scene, factionId) {
  const sky = getSkyColorsAt(0, 0)

  // Купол неба — большая сфера с градиентом
  const skyGeo = new THREE.SphereGeometry(900, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)
  const skyColors = new Float32Array(skyGeo.attributes.position.count * 3)
  const skyPos = skyGeo.attributes.position

  // Сохраняем нормализованные высоты для быстрого обновления
  const vertexTs = new Float32Array(skyPos.count)
  for (let i = 0; i < skyPos.count; i++) {
    vertexTs[i] = Math.max(0, Math.min(1, 1 - skyPos.getY(i) / 900))
  }

  _applySkyColors(skyColors, vertexTs, sky)
  skyGeo.setAttribute('color', new THREE.BufferAttribute(skyColors, 3))
  const skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })
  const skyMesh = new THREE.Mesh(skyGeo, skyMat)
  skyMesh.renderOrder = -1000
  skyMesh.userData = { vertexTs }
  scene.add(skyMesh)

  // Солнце
  const sunGeo = new THREE.CircleGeometry(28, 20)
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff8b8, fog: false })
  const sunMesh = new THREE.Mesh(sunGeo, sunMat)
  sunMesh.position.copy(toThree(550, 550, 600))
  sunMesh.lookAt(0, 300, 0)
  scene.add(sunMesh)

  // Облака
  for (let i = 0; i < 18; i++) {
    const w = rand(70, 160), d = rand(50, 110)
    const cx = rand(-500, 500), cy = rand(-500, 500), cz = rand(160, 230)
    const alpha = rand(0.30, 0.55)
    const geo = new THREE.BoxGeometry(w, 3, d)
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true, opacity: alpha, fog: false,
    })
    const cloud = new THREE.Mesh(geo, mat)
    cloud.position.copy(toThree(cx, cy, cz))
    scene.add(cloud)
  }

  return skyMesh
}

function _applySkyColors(colors, vertexTs, sky) {
  for (let i = 0; i < vertexTs.length; i++) {
    const t = vertexTs[i]
    colors[i * 3]     = sky.top[0] + (sky.horizon[0] - sky.top[0]) * t
    colors[i * 3 + 1] = sky.top[1] + (sky.horizon[1] - sky.top[1]) * t
    colors[i * 3 + 2] = sky.top[2] + (sky.horizon[2] - sky.top[2]) * t
  }
}

/** Обновить цвет неба и тумана по позиции игрока */
export function updateSky(skyMesh, scene, px, py) {
  if (!skyMesh) return
  const sky = getSkyColorsAt(px, py)
  const fog = getFogAt(px, py)

  // Обновить вершины купола
  const colors = skyMesh.geometry.attributes.color.array
  const vertexTs = skyMesh.userData.vertexTs
  _applySkyColors(colors, vertexTs, sky)
  skyMesh.geometry.attributes.color.needsUpdate = true

  // Фон сцены
  scene.background.setRGB(sky.bg[0], sky.bg[1], sky.bg[2])

  // Туман
  if (scene.fog) {
    scene.fog.color.setRGB(fog.color[0], fog.color[1], fog.color[2])
    scene.fog.near = fog.near
    scene.fog.far = fog.far
  }
}

// ---- Деревья (LOD) ----

const TREE_DEFS = {
  pine: {
    trunkH: [1.5, 2.5], crownH: [4, 7], crownR: [1.2, 2.2], trunkR: 0.22,
    trunkCol: 0x5a3414, crownCol: 0x0d6b0d, bbCol: 0x148014,
  },
  oak: {
    trunkH: [1.5, 2.8], crownH: [3.5, 5.5], crownR: [1.8, 3.2], trunkR: 0.30,
    trunkCol: 0x4d2e0f, crownCol: 0x337a14, bbCol: 0x338c1a,
  },
  dead: {
    trunkH: [2, 4.5], crownH: [0.3, 0.6], crownR: [0.3, 0.6], trunkR: 0.18,
    trunkCol: 0x33231a, crownCol: 0x261e1a, bbCol: 0x472e1a,
  },
}

// Reusable geometries for merging
const _trunkGeo = new THREE.CylinderGeometry(0.22, 0.22, 2, 5)
const _crownGeo = new THREE.ConeGeometry(1.5, 5, 6)

function makeTree(parent, gx, gy, getHeight, type = 'pine') {
  const def = TREE_DEFS[type] || TREE_DEFS.pine
  const tH = rand(...def.trunkH)
  const cH = rand(...def.crownH)
  const cR = rand(...def.crownR)
  const gz = getHeight(gx, gy)
  const sc = rand(0.9, 1.1)

  // Three.js LOD
  const lod = new THREE.LOD()

  // Near: 3D ствол + крона
  const near = new THREE.Group()
  const trunkGeo = new THREE.CylinderGeometry(def.trunkR * sc, def.trunkR * sc, tH * sc, 5)
  const trunk = new THREE.Mesh(trunkGeo, new THREE.MeshLambertMaterial({ color: def.trunkCol }))
  trunk.position.y = tH * sc / 2
  near.add(trunk)

  const crownGeo = new THREE.ConeGeometry(cR * sc, cH * sc, 6)
  const crown = new THREE.Mesh(crownGeo, new THREE.MeshLambertMaterial({ color: def.crownCol }))
  crown.position.y = tH * sc + cH * sc / 2
  near.add(crown)
  lod.addLevel(near, 0)

  // Far: простой спрайт (плоский quad) — LambertMaterial чтобы совпадало с 3D по яркости
  const totalH = (tH + cH) * sc
  const bbW = cR * 2 * sc
  const farGeo = new THREE.PlaneGeometry(bbW, totalH)
  const far = new THREE.Mesh(farGeo, new THREE.MeshLambertMaterial({ color: def.bbCol, side: THREE.DoubleSide }))
  far.position.y = totalH / 2
  const farGroup = new THREE.Group()
  farGroup.add(far)
  lod.addLevel(farGroup, 60)

  // Пустой для очень далёких (не рисовать)
  lod.addLevel(new THREE.Group(), 350)

  const pos = toThree(gx, gy, gz)
  lod.position.copy(pos)
  parent.add(lod)
  return lod
}

/** Проверить, не слишком ли близко к дороге */
function tooCloseToRoad(x, y) {
  return distToPath(x, y, MAIN_ROAD) < 10
}

export function buildForest(parent, getHeight) {
  const trees = []

  // Густой лес у эльфов (min_radius=35 от спавна, больше деревьев)
  for (let i = 0; i < 500; i++) {
    const a = rand(0, Math.PI * 2), r = rand(35, 160)
    const x = -250 + Math.cos(a) * r, y = -250 + Math.sin(a) * r
    if (tooCloseToRoad(x, y)) continue
    // Не спавнить в ущелье
    if (gorgeInfluence(x, y) > 0.3) continue
    const type = Math.random() < 0.65 ? 'pine' : 'oak'
    trees.push(makeTree(parent, x, y, getHeight, type))
  }

  // Редкий лес в нейтральной зоне (не на горе)
  for (let i = 0; i < 50; i++) {
    const a = rand(0, Math.PI * 2), r = rand(18, 100)
    const x = Math.cos(a) * r, y = Math.sin(a) * r
    if (tooCloseToRoad(x, y) || gorgeInfluence(x, y) > 0.1) continue
    // Не спавнить на склоне Горы Тьмы
    if (Math.sqrt((x - 20) ** 2 + (y - 20) ** 2) < 50) continue
    const types = ['oak', 'pine', 'dead']
    trees.push(makeTree(parent, x, y, getHeight, types[Math.floor(Math.random() * 3)]))
  }

  // Мёртвые деревья у злодея (вокруг горы, не на склоне)
  for (let i = 0; i < 40; i++) {
    const a = rand(0, Math.PI * 2), r = rand(50, 90)
    const x = 20 + Math.cos(a) * r, y = 20 + Math.sin(a) * r
    if (tooCloseToRoad(x, y) || gorgeInfluence(x, y) > 0.1) continue
    const type = Math.random() < 0.7 ? 'dead' : 'pine'
    trees.push(makeTree(parent, x, y, getHeight, type))
  }

  return trees
}
