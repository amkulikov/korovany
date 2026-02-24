/**
 * 3D-модели врагов, корованов, оружия от первого лица.
 * "И враги 3-хмерные тоже, и труп тоже 3д."
 *
 * Стиль: Minecraft-like (кубики, но узнаваемые пропорции).
 */
import * as THREE from 'three'
import { ITEMS } from '../game/constants.js'
import { toThree } from './worldBuilder.js'

const lam = (r, g, b) => new THREE.MeshLambertMaterial({ color: new THREE.Color(r, g, b) })
const lamHex = (hex) => new THREE.MeshLambertMaterial({ color: hex })

function box(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y, z)
  return m
}

// ---- Враги (Minecraft-style гуманоиды) ----

export function createEnemyMesh(enemy) {
  const c = new THREE.Color(...enemy.color)
  const dark = c.clone().offsetHSL(0, 0, -0.15)
  const light = c.clone().offsetHSL(0, -0.05, 0.12)
  const skin = new THREE.Color(0.82, 0.64, 0.46)

  const root = new THREE.Group()

  // Тело (группа для анимации)
  const body = new THREE.Group()
  root.add(body)

  // Ноги — отдельные группы для анимации ходьбы
  const leftLegPivot = new THREE.Group()
  leftLegPivot.position.set(-0.12, 0.52, 0)
  const leftLeg = box(new THREE.BoxGeometry(0.22, 0.52, 0.22), lam(dark.r, dark.g, dark.b), 0, -0.26, 0)
  leftLegPivot.add(leftLeg)
  body.add(leftLegPivot)

  const rightLegPivot = new THREE.Group()
  rightLegPivot.position.set(0.12, 0.52, 0)
  const rightLeg = box(new THREE.BoxGeometry(0.22, 0.52, 0.22), lam(dark.r, dark.g, dark.b), 0, -0.26, 0)
  rightLegPivot.add(rightLeg)
  body.add(rightLegPivot)

  // Туловище
  const torso = box(new THREE.BoxGeometry(0.48, 0.56, 0.24), lam(c.r, c.g, c.b), 0, 0.80, 0)
  body.add(torso)

  // Руки — отдельные группы для анимации атаки
  const leftArmPivot = new THREE.Group()
  leftArmPivot.position.set(-0.34, 1.04, 0)
  const leftArm = box(new THREE.BoxGeometry(0.18, 0.50, 0.18), lam(dark.r, dark.g, dark.b), 0, -0.25, 0)
  leftArmPivot.add(leftArm)
  body.add(leftArmPivot)

  const rightArmPivot = new THREE.Group()
  rightArmPivot.position.set(0.34, 1.04, 0)
  const rightArm = box(new THREE.BoxGeometry(0.18, 0.50, 0.18), lam(dark.r, dark.g, dark.b), 0, -0.25, 0)
  rightArmPivot.add(rightArm)
  body.add(rightArmPivot)

  // Голова
  const head = box(new THREE.BoxGeometry(0.40, 0.40, 0.40), lam(skin.r, skin.g, skin.b), 0, 1.32, 0)
  body.add(head)

  // Шлем / головной убор (цвет фракции)
  const helmet = box(new THREE.BoxGeometry(0.44, 0.14, 0.44), lam(light.r, light.g, light.b), 0, 1.58, 0)
  body.add(helmet)

  // Глаза
  const eyeMat = lam(0.1, 0.1, 0.1)
  body.add(box(new THREE.BoxGeometry(0.08, 0.06, 0.04), eyeMat, -0.10, 1.35, 0.20))
  body.add(box(new THREE.BoxGeometry(0.08, 0.06, 0.04), eyeMat, 0.10, 1.35, 0.20))

  // Оружие в правой руке
  const weaponMat = lam(0.68, 0.68, 0.72)
  const blade = box(new THREE.BoxGeometry(0.06, 0.50, 0.06), weaponMat, 0, -0.40, 0.10)
  rightArmPivot.add(blade)
  // Рукоять
  const hilt = box(new THREE.BoxGeometry(0.08, 0.14, 0.08), lam(0.35, 0.22, 0.08), 0, -0.12, 0.10)
  rightArmPivot.add(hilt)

  // Сохраняем ссылки на анимируемые части
  // Собираем все MeshLambertMaterial для тонирования
  const allMats = []
  root.traverse(child => {
    if (child.isMesh && child.material && child.material.isMeshLambertMaterial) {
      allMats.push(child.material)
    }
  })

  root.userData = {
    leftLegPivot,
    rightLegPivot,
    leftArmPivot,
    rightArmPivot,
    body,
    walkPhase: Math.random() * Math.PI * 2,
    allMats,
    isRedTinted: false,
  }

  return root
}

const _redEmissive = new THREE.Color(0.35, 0.0, 0.0)
const _noEmissive = new THREE.Color(0, 0, 0)

export function updateEnemyMesh(enemy, getHeight, dt = 0, isHostile = false) {
  if (!enemy.mesh) return
  const ud = enemy.mesh.userData

  if (enemy.state !== 'dead') {
    const gz = getHeight(enemy.x, enemy.y)
    enemy.z = gz
    const pos = toThree(enemy.x, enemy.y, gz)
    enemy.mesh.position.copy(pos)

    // heading → rotation.y = PI - heading_rad
    const headingRad = enemy.heading * Math.PI / 180
    enemy.mesh.rotation.y = Math.PI - headingRad

    // Снять красную подсветку если осталась (устаревшая)
    if (ud.isRedTinted && ud.allMats) {
      for (const mat of ud.allMats) mat.emissive = _noEmissive
      ud.isRedTinted = false
    }

    // Анимация ходьбы
    const isMoving = enemy.state === 'patrol' || enemy.state === 'chase'
    if (isMoving && ud && dt > 0) {
      const walkSpeed = enemy.state === 'chase' ? 10 : 6
      ud.walkPhase += dt * walkSpeed
      const swing = Math.sin(ud.walkPhase) * 0.6

      ud.leftLegPivot.rotation.x = swing
      ud.rightLegPivot.rotation.x = -swing
      ud.leftArmPivot.rotation.x = -swing * 0.5
      ud.rightArmPivot.rotation.x = swing * 0.5
    } else if (ud) {
      ud.leftLegPivot.rotation.x = 0
      ud.rightLegPivot.rotation.x = 0
      ud.leftArmPivot.rotation.x = 0
      ud.rightArmPivot.rotation.x = 0
    }
  } else {
    // Труп лежит на боку
    const gz = getHeight?.(enemy.x, enemy.y) || 0
    const pos = toThree(enemy.x, enemy.y, gz)
    enemy.mesh.position.copy(pos)
    enemy.mesh.position.y = gz + 0.3
    enemy.mesh.rotation.z = Math.PI / 2

    // Убираем красную подсветку у трупа
    if (ud.isRedTinted && ud.allMats) {
      for (const mat of ud.allMats) mat.emissive = _noEmissive
      ud.isRedTinted = false
    }
  }
}

/** Анимация удара NPC — качнуть правую руку вперёд */
export function animateEnemyAttack(enemy) {
  if (!enemy.mesh || !enemy.mesh.userData) return
  const ud = enemy.mesh.userData
  // Запустить анимацию атаки
  ud.attackTimer = 0
  ud.attacking = true
}

export function updateEnemyAttackAnim(enemy, dt) {
  if (!enemy.mesh || !enemy.mesh.userData) return
  const ud = enemy.mesh.userData
  if (!ud.attacking) return

  ud.attackTimer += dt
  const t = ud.attackTimer

  if (t < 0.12) {
    // Замах — рука назад (+ = от лица)
    const p = t / 0.12
    ud.rightArmPivot.rotation.x = 1.0 * p
  } else if (t < 0.25) {
    // Удар — рука вперёд, остриём к цели (- = к лицу/вперёд)
    const p = (t - 0.12) / 0.13
    ud.rightArmPivot.rotation.x = 1.0 - 2.2 * p
  } else if (t < 0.5) {
    // Возврат в исходное
    const p = (t - 0.25) / 0.25
    ud.rightArmPivot.rotation.x = -1.2 * (1 - p)
  } else {
    ud.attacking = false
    ud.rightArmPivot.rotation.x = 0
  }
}

// ---- Корованы ----

export function createKorovanMesh(korovan) {
  const group = new THREE.Group()

  const wood = lam(0.55, 0.38, 0.14)
  const woodDark = lam(0.40, 0.25, 0.10)
  const cover = lam(0.90, 0.86, 0.70)
  const coverStripe = lam(0.72, 0.28, 0.12)
  const wheelMat = lam(0.25, 0.16, 0.08)
  const ironMat = lam(0.45, 0.45, 0.48)
  const oxBody = lam(0.58, 0.50, 0.36)
  const oxDark = lam(0.42, 0.35, 0.22)
  const rope = lam(0.42, 0.32, 0.15)

  // === Кузов (платформа) ===
  group.add(box(new THREE.BoxGeometry(3.2, 0.14, 1.7), wood, 0, 0.42, 0)) // дно
  // Борта
  group.add(box(new THREE.BoxGeometry(3.2, 0.70, 0.10), wood, 0, 0.77, 0.80))  // правый борт
  group.add(box(new THREE.BoxGeometry(3.2, 0.70, 0.10), wood, 0, 0.77, -0.80)) // левый борт
  group.add(box(new THREE.BoxGeometry(0.10, 0.70, 1.60), wood, -1.55, 0.77, 0)) // задний борт
  // Планки на бортах (детали)
  for (let i = -1; i <= 1; i++) {
    group.add(box(new THREE.BoxGeometry(0.08, 0.70, 0.12), woodDark, i * 1.0, 0.77, 0.82))
    group.add(box(new THREE.BoxGeometry(0.08, 0.70, 0.12), woodDark, i * 1.0, 0.77, -0.82))
  }

  // === Тент (полукруг из коробок) ===
  const tentPieces = 7
  for (let i = 0; i < tentPieces; i++) {
    const t = i / (tentPieces - 1) // 0..1
    const angle = (t - 0.5) * Math.PI // -PI/2..PI/2
    const ty = Math.cos(angle) * 0.55 + 1.12 + 0.55
    const tz = Math.sin(angle) * 0.80
    const mat = i % 3 === 1 ? coverStripe : cover
    const piece = box(new THREE.BoxGeometry(2.6, 0.08, 0.30), mat, 0, ty, tz)
    piece.rotation.x = angle
    group.add(piece)
  }
  // Дуги тента (деревянные рёбра)
  for (const dx of [-0.9, 0, 0.9]) {
    for (let i = 0; i < 5; i++) {
      const t = i / 4
      const angle = (t - 0.5) * Math.PI
      const ty = Math.cos(angle) * 0.50 + 1.67
      const tz = Math.sin(angle) * 0.75
      const rib = box(new THREE.BoxGeometry(0.06, 0.06, 0.12), woodDark, dx, ty, tz)
      rib.rotation.x = angle
      group.add(rib)
    }
  }

  // === Колёса (круглые из кубов — в XY плоскости, ось Z) ===
  const _wheels = []
  for (const [wx, wz] of [[1.10, 0.90], [-1.10, 0.90], [1.10, -0.90], [-1.10, -0.90]]) {
    const wheelGroup = new THREE.Group()
    wheelGroup.position.set(wx, 0.30, wz)
    // Спицы — в плоскости XY (перпендикулярно оси Z)
    const spokeCount = 8
    for (let i = 0; i < spokeCount; i++) {
      const a = (i / spokeCount) * Math.PI * 2
      const spoke = box(
        new THREE.BoxGeometry(0.24, 0.05, 0.05), wheelMat,
        Math.cos(a) * 0.20, Math.sin(a) * 0.20, 0
      )
      spoke.rotation.z = a
      wheelGroup.add(spoke)
    }
    // Ступица
    wheelGroup.add(box(new THREE.BoxGeometry(0.10, 0.10, 0.10), ironMat))
    // Шина (внешний обод) — в XY плоскости
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      wheelGroup.add(box(
        new THREE.BoxGeometry(0.06, 0.06, 0.06), wheelMat,
        Math.cos(a) * 0.26, Math.sin(a) * 0.26, 0
      ))
    }
    group.add(wheelGroup)
    _wheels.push(wheelGroup)
  }

  // Оси
  for (const ax of [1.10, -1.10]) {
    group.add(box(new THREE.BoxGeometry(0.08, 0.08, 1.80), ironMat, ax, 0.30, 0))
  }

  // === Сиденье кучера ===
  group.add(box(new THREE.BoxGeometry(0.80, 0.12, 1.20), wood, 1.70, 0.90, 0))
  group.add(box(new THREE.BoxGeometry(0.10, 0.50, 1.20), wood, 1.85, 1.15, 0))

  // === Оглобли ===
  for (const oz of [-0.35, 0.35]) {
    group.add(box(new THREE.BoxGeometry(1.80, 0.06, 0.06), rope, 2.50, 0.42, oz))
  }

  // === Два вола ===
  const _oxLegs = []
  for (const oz of [-0.55, 0.55]) {
    const oxGroup = new THREE.Group()
    oxGroup.position.set(3.60, 0, oz)

    // Тело
    oxGroup.add(box(new THREE.BoxGeometry(0.90, 0.55, 0.50), oxBody, 0, 0.55, 0))
    // Голова
    oxGroup.add(box(new THREE.BoxGeometry(0.38, 0.36, 0.38), oxBody, 0.50, 0.72, 0))
    // Морда (темнее)
    oxGroup.add(box(new THREE.BoxGeometry(0.18, 0.14, 0.24), oxDark, 0.68, 0.62, 0))
    // Рога
    oxGroup.add(box(new THREE.BoxGeometry(0.04, 0.04, 0.14), lam(0.85, 0.80, 0.60), 0.52, 0.92, -0.14))
    oxGroup.add(box(new THREE.BoxGeometry(0.04, 0.04, 0.14), lam(0.85, 0.80, 0.60), 0.52, 0.92, 0.14))
    // Уши
    oxGroup.add(box(new THREE.BoxGeometry(0.04, 0.10, 0.08), oxDark, 0.46, 0.88, -0.18))
    oxGroup.add(box(new THREE.BoxGeometry(0.04, 0.10, 0.08), oxDark, 0.46, 0.88, 0.18))
    // Глаза
    oxGroup.add(box(new THREE.BoxGeometry(0.05, 0.05, 0.03), lam(0.08, 0.08, 0.08), 0.62, 0.76, -0.12))
    oxGroup.add(box(new THREE.BoxGeometry(0.05, 0.05, 0.03), lam(0.08, 0.08, 0.08), 0.62, 0.76, 0.12))
    // 4 ноги — через pivot для анимации
    for (const [lx, lz] of [[-0.25, -0.14], [-0.25, 0.14], [0.25, -0.14], [0.25, 0.14]]) {
      const legPivot = new THREE.Group()
      legPivot.position.set(lx, 0.35, lz)
      legPivot.add(box(new THREE.BoxGeometry(0.12, 0.35, 0.12), oxDark, 0, -0.17, 0))
      oxGroup.add(legPivot)
      _oxLegs.push(legPivot)
    }
    // Хвост
    oxGroup.add(box(new THREE.BoxGeometry(0.04, 0.30, 0.04), oxDark, -0.50, 0.50, 0))

    group.add(oxGroup)
  }

  // === Ярмо ===
  group.add(box(new THREE.BoxGeometry(0.08, 0.08, 1.20), rope, 3.60, 0.88, 0))
  // Верёвки от ярма к оглоблям
  for (const oz of [-0.35, 0.35]) {
    group.add(box(new THREE.BoxGeometry(0.60, 0.04, 0.04), rope, 3.10, 0.65, oz))
  }

  // === Груз в кузове ===
  // Мешки
  group.add(box(new THREE.BoxGeometry(0.50, 0.40, 0.40), lam(0.68, 0.62, 0.42), -0.6, 0.70, 0.20))
  group.add(box(new THREE.BoxGeometry(0.45, 0.35, 0.45), lam(0.72, 0.66, 0.46), -0.2, 0.66, -0.25))
  group.add(box(new THREE.BoxGeometry(0.55, 0.30, 0.35), lam(0.64, 0.58, 0.38), 0.3, 0.63, 0.10))
  // Бочка (кубическая, minecraft-стиль)
  group.add(box(new THREE.BoxGeometry(0.40, 0.50, 0.40), lam(0.50, 0.32, 0.14), 0.8, 0.67, -0.30))

  // Сохраняем ссылки для анимации
  group.userData = {
    wheels: _wheels,
    oxLegs: _oxLegs,
    wheelPhase: Math.random() * Math.PI * 2,
    oxLegPhase: Math.random() * Math.PI * 2,
  }

  return group
}

export function updateKorovanMesh(korovan, getHeight, dt = 0) {
  if (!korovan.mesh) return
  if (korovan.alive) {
    const gz = getHeight(korovan.x, korovan.y)
    const pos = toThree(korovan.x, korovan.y, gz)
    korovan.mesh.position.copy(pos)
    // Повернуть по направлению движения (heading хранится в градусах, как у enemy)
    // Модель корована длинная вдоль +X, поэтому дополнительный -PI/2
    const headingRad = korovan.heading * Math.PI / 180
    korovan.mesh.rotation.y = Math.PI - headingRad - Math.PI / 2

    // Подстраховка: не ниже рельефа
    if (korovan.mesh.position.y < gz - 2) {
      korovan.mesh.position.y = gz
    }

    // Анимация колёс и ног волов
    const ud = korovan.mesh.userData
    if (ud && dt > 0) {
      ud.wheelPhase = (ud.wheelPhase || 0) - dt * korovan.speed * 0.5
      // Колёса крутятся вокруг Z (ось колеса), отрицательное — вперёд
      if (ud.wheels) {
        for (const w of ud.wheels) {
          w.rotation.z = ud.wheelPhase
        }
      }
      // Ноги волов качаются
      ud.oxLegPhase = (ud.oxLegPhase || 0) + dt * korovan.speed * 1.2
      if (ud.oxLegs) {
        const swing = Math.sin(ud.oxLegPhase) * 0.3
        for (let i = 0; i < ud.oxLegs.length; i++) {
          // Чередование: передние/задние ноги в противофазе
          ud.oxLegs[i].rotation.z = (i % 2 === 0 ? swing : -swing)
        }
      }
    }
  } else {
    korovan.mesh.visible = false
  }
}

// ---- Оружие от первого лица ----

export function createWeaponMesh(weaponScene, weaponId) {
  // Очистить сцену оружия
  while (weaponScene.children.length > 0) weaponScene.remove(weaponScene.children[0])

  // Подсветка для оружия
  weaponScene.add(new THREE.AmbientLight(0xffffff, 0.7))
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.9)
  dirLight.position.set(1, 2, 1)
  weaponScene.add(dirLight)

  const group = new THREE.Group()

  const wid = weaponId || ''

  if (wid.includes('sword') || wid.includes('blade')) {
    const isDark = wid.includes('dark')
    const isElven = wid.includes('elven')
    // Рукоять
    group.add(box(new THREE.BoxGeometry(0.055, 0.24, 0.055), lam(0.38, 0.24, 0.10), 0, -0.12, 0))
    // Навершие
    group.add(box(new THREE.BoxGeometry(0.08, 0.06, 0.08),
      isDark ? lam(0.45, 0.10, 0.10) : (isElven ? lam(0.10, 0.50, 0.20) : lam(0.70, 0.65, 0.20)),
      0, -0.26, 0))
    // Гарда
    group.add(box(new THREE.BoxGeometry(0.28, 0.06, 0.055), lam(0.55, 0.50, 0.18), 0, 0.02, 0))
    // Клинок
    const bCol = isDark ? [0.40, 0.18, 0.50] : (isElven ? [0.55, 0.85, 0.60] : [0.82, 0.84, 0.90])
    group.add(box(new THREE.BoxGeometry(0.050, 0.62, 0.035), lam(...bCol), 0, 0.35, 0))
    // Лезвие (тоньше, светлее) — ребро
    const edgeCol = isDark ? [0.55, 0.30, 0.65] : (isElven ? [0.70, 0.95, 0.75] : [0.92, 0.94, 0.98])
    group.add(box(new THREE.BoxGeometry(0.015, 0.60, 0.038), lam(...edgeCol), 0.028, 0.35, 0))
    // Остриё
    group.add(box(new THREE.BoxGeometry(0.035, 0.08, 0.030), lam(...bCol), 0, 0.68, 0))
  } else if (wid.includes('axe')) {
    // Древко
    group.add(box(new THREE.BoxGeometry(0.050, 0.60, 0.050), lam(0.38, 0.24, 0.10), 0, 0, 0))
    // Лезвие топора
    group.add(box(new THREE.BoxGeometry(0.30, 0.22, 0.050), lam(0.72, 0.72, 0.76), -0.12, 0.25, 0))
    group.add(box(new THREE.BoxGeometry(0.22, 0.18, 0.050), lam(0.78, 0.78, 0.82), -0.16, 0.25, 0))
    // Обух
    group.add(box(new THREE.BoxGeometry(0.08, 0.18, 0.06), lam(0.50, 0.50, 0.55), 0.06, 0.25, 0))
  } else if (wid.includes('dagger')) {
    // Рукоять
    group.add(box(new THREE.BoxGeometry(0.048, 0.18, 0.048), lam(0.32, 0.20, 0.10), 0, -0.09, 0))
    // Гарда
    group.add(box(new THREE.BoxGeometry(0.14, 0.04, 0.04), lam(0.60, 0.55, 0.20), 0, 0.02, 0))
    // Клинок
    group.add(box(new THREE.BoxGeometry(0.040, 0.30, 0.030), lam(0.82, 0.84, 0.90), 0, 0.19, 0))
    // Остриё
    group.add(box(new THREE.BoxGeometry(0.025, 0.06, 0.025), lam(0.85, 0.87, 0.92), 0, 0.36, 0))
  } else if (wid.includes('spear')) {
    // Древко
    group.add(box(new THREE.BoxGeometry(0.042, 0.90, 0.042), lam(0.38, 0.24, 0.10), 0, 0, 0))
    // Наконечник
    group.add(box(new THREE.BoxGeometry(0.055, 0.18, 0.040), lam(0.78, 0.78, 0.82), 0, 0.54, 0))
    group.add(box(new THREE.BoxGeometry(0.035, 0.06, 0.030), lam(0.82, 0.82, 0.86), 0, 0.65, 0))
    // Обмотка
    group.add(box(new THREE.BoxGeometry(0.050, 0.06, 0.050), lam(0.42, 0.32, 0.15), 0, 0.42, 0))
  } else if (wid.includes('staff')) {
    // Посох
    group.add(box(new THREE.BoxGeometry(0.042, 0.80, 0.042), lam(0.42, 0.28, 0.12), 0, 0, 0))
    // Навершие
    group.add(box(new THREE.BoxGeometry(0.06, 0.06, 0.06), lam(0.42, 0.28, 0.12), 0, 0.42, 0))
    // Магический орб
    group.add(box(new THREE.BoxGeometry(0.14, 0.14, 0.14), lam(0.40, 0.12, 0.75), 0, 0.50, 0))
    // Свечение (полупрозрачный куб побольше)
    const glowMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.50, 0.15, 0.90), transparent: true, opacity: 0.25,
    })
    group.add(box(new THREE.BoxGeometry(0.22, 0.22, 0.22), glowMat, 0, 0.50, 0))
  } else if (wid.includes('bow')) {
    // Дуга лука (из кубов)
    for (let i = -4; i <= 4; i++) {
      const a = (i / 4) * 0.8
      const bx = Math.sin(a) * 0.08
      const by = i * 0.09
      group.add(box(new THREE.BoxGeometry(0.04, 0.10, 0.04), lam(0.42, 0.28, 0.12), bx, by, 0))
    }
    // Тетива
    group.add(box(new THREE.BoxGeometry(0.015, 0.70, 0.015), lam(0.80, 0.76, 0.60), 0.02, 0, 0))
  } else {
    // Кулак — Minecraft-style: рука от первого лица
    // Рука идёт снизу-справа, немного под углом, видна "сверху"
    const skinMat = lam(0.82, 0.64, 0.46)
    const skinDark = lam(0.74, 0.56, 0.38)
    const sleeveMat = lam(0.45, 0.35, 0.25) // рукав одежды

    // Рукав (ближе к нам, снизу)
    group.add(box(new THREE.BoxGeometry(0.20, 0.20, 0.35), sleeveMat, 0, 0, -0.10))
    // Предплечье (кожа)
    group.add(box(new THREE.BoxGeometry(0.18, 0.18, 0.22), skinMat, 0, 0, 0.18))
    // Кисть/кулак — четыре пальца сверху
    group.add(box(new THREE.BoxGeometry(0.18, 0.10, 0.10), skinDark, 0, 0.05, 0.33))
    // Большой палец сбоку
    group.add(box(new THREE.BoxGeometry(0.08, 0.08, 0.10), skinMat, -0.11, 0.02, 0.25))
  }

  // Позиция в пространстве оружейной камеры
  if (!wid) {
    // Рука — из нижнего правого угла, чуть наклонена
    group.position.set(0.30, -0.42, -0.50)
    group.rotation.set(-0.15, -0.2, 0.08)
    group.userData = { isFist: true }
  } else {
    // Оружие — по центру, чуть правее и ниже
    group.position.set(0.28, -0.28, -0.52)
    group.rotation.set(0.40, -0.05, -0.12)
  }

  weaponScene.add(group)
  return group
}

/** Анимация удара оружия. t: 0..1 — прогресс анимации, <0 = нет анимации */
export function animateWeapon(weaponMesh, t) {
  if (!weaponMesh) return

  // Определяем, кулак это или оружие
  if (weaponMesh.userData && weaponMesh.userData.isFist) {
    const baseX = 0.30, baseY = -0.42, baseZ = -0.50
    const baseRx = -0.15, baseRy = -0.2, baseRz = 0.08

    if (t >= 0 && t < 1) {
      if (t < 0.15) {
        // Отводим кулак назад — кисть наклоняется к камере (+rotation.x)
        const p = t / 0.15
        weaponMesh.position.set(baseX, baseY + 0.06 * p, baseZ + 0.10 * p)
        weaponMesh.rotation.set(baseRx + 0.20 * p, baseRy, baseRz)
      } else if (t < 0.4) {
        // Удар — кулак вперёд, костяшками в экран (-rotation.x)
        const p = (t - 0.15) / 0.25
        weaponMesh.position.set(baseX - 0.04 * p, baseY + 0.06 * (1 - p), baseZ + 0.10 - 0.35 * p)
        weaponMesh.rotation.set(baseRx + 0.20 - 0.50 * p, baseRy, baseRz)
      } else {
        // Возврат
        const p = (t - 0.4) / 0.6
        weaponMesh.position.set(baseX - 0.04 * (1 - p), baseY, baseZ - 0.25 * (1 - p))
        weaponMesh.rotation.set(baseRx - 0.30 * (1 - p), baseRy, baseRz)
      }
    } else {
      weaponMesh.position.set(baseX, baseY, baseZ)
      weaponMesh.rotation.set(baseRx, baseRy, baseRz)
    }
    return
  }

  const baseX = 0.28, baseY = -0.28, baseZ = -0.52
  const basePitch = 0.40, baseYaw = -0.05, baseRoll = -0.12

  let extraX = 0, extraY = 0, extraZ = 0, pitchAdd = 0, yawAdd = 0, rollAdd = 0

  if (t >= 0 && t < 1) {
    if (t < 0.15) {
      // Замах — отвести вправо-назад, остриё к камере (+pitch)
      const p = t / 0.15
      extraY = 0.10 * p
      extraZ = 0.08 * p
      extraX = 0.05 * p
      pitchAdd = 0.45 * p
      rollAdd = 0.25 * p
    } else if (t < 0.4) {
      // Удар — рубануть вперёд, остриё в экран (-pitch)
      const p = (t - 0.15) / 0.25
      extraY = 0.10 - 0.28 * p
      extraZ = 0.08 - 0.32 * p
      extraX = 0.05 - 0.16 * p
      pitchAdd = 0.45 - 1.15 * p
      rollAdd = 0.25 - 0.65 * p
    } else {
      // Возврат
      const p = (t - 0.4) / 0.6
      extraY = -0.18 * (1 - p)
      extraZ = -0.24 * (1 - p)
      extraX = -0.11 * (1 - p)
      pitchAdd = -0.70 * (1 - p)
      rollAdd = -0.40 * (1 - p)
    }
  }

  weaponMesh.position.set(baseX + extraX, baseY + extraY, baseZ + extraZ)
  weaponMesh.rotation.set(basePitch + pitchAdd, baseYaw + yawAdd, baseRoll + rollAdd)
}
