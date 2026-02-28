/**
 * Главный игровой движок.
 * Связывает Three.js рендеринг, игровую логику, ввод и UI.
 */
import * as THREE from 'three'
import { Renderer } from './renderer.js'
import { Input } from './input.js'
import { FPSCamera } from './camera.js'
import { buildTerrain, buildBuildings, buildSky, updateSky, buildForest, buildWater, updateWater, toThree, getBuildingBoxes, riverInfluence, gorgeInfluenceAt, clampBridgeRailings, getMountainDarkness } from './worldBuilder.js'
import { createEnemyMesh, updateEnemyMesh, animateEnemyAttack, updateEnemyAttackAnim, createKorovanMesh, updateKorovanMesh, createWeaponMesh, animateWeapon } from './entityRenderer.js'
import { GameAudio } from './audio.js'

import { FACTIONS, ITEMS, ENEMY_SPAWNS, MEMES, pick, getZoneAt, rand, randInt } from '../game/constants.js'
import { Player } from '../game/player.js'
import { Enemy } from '../game/enemy.js'
import { Korovan } from '../game/korovan.js'
import { CombatLog } from '../game/combat.js'
import { Market } from '../game/trading.js'
import * as saveLoad from '../game/saveLoad.js'

import { HUD } from '../ui/hud.js'
import * as menus from '../ui/menus.js'
import { shouldShowOnboarding, showOnboarding } from '../ui/onboarding.js'
import { isMobile } from './mobile.js'
import { TouchControls } from '../ui/touchControls.js'

/** Проверка столкновения точки (x,y) с AABB зданий. Возвращает скорректированную позицию. */
function resolveCollision(newX, newY, radius, oldX, oldY) {
  const boxes = getBuildingBoxes()
  let x = newX, y = newY
  for (const b of boxes) {
    // Расширенный AABB (здание + радиус сущности)
    const minX = b.cx - b.hw - radius
    const maxX = b.cx + b.hw + radius
    const minY = b.cy - b.hd - radius
    const maxY = b.cy + b.hd + radius

    if (x > minX && x < maxX && y > minY && y < maxY) {
      // Внутри AABB — вытолкнуть по наименьшей оси
      const pushLeft = x - minX
      const pushRight = maxX - x
      const pushDown = y - minY
      const pushUp = maxY - y
      const minPush = Math.min(pushLeft, pushRight, pushDown, pushUp)

      if (minPush === pushLeft) x = minX
      else if (minPush === pushRight) x = maxX
      else if (minPush === pushDown) y = minY
      else y = maxY
    }
  }
  return { x, y }
}

export class Game {
  constructor(canvas) {
    this.renderer = new Renderer(canvas)
    this.input = new Input(canvas)
    this.input.onLockLost = () => this._onLockLost()
    this.fpsCam = new FPSCamera(this.renderer.camera, this.renderer.weaponCamera)
    this.hud = new HUD()
    this.combatLog = new CombatLog(6)
    this.audio = new GameAudio()

    // Мобильные тач-контролы
    this.touchControls = null
    if (isMobile) {
      document.body.classList.add('mobile')
      this.touchControls = new TouchControls()
      this.input.setTouchControls(this.touchControls)
      this.touchControls.onToggleMinimap = () => this.hud.toggleMinimap()
      this.touchControls.onToggleBody = () => this.hud.toggleBody()
    }

    this.player = null
    this.enemies = []
    this.korovans = []
    this.market = null
    this.getHeight = () => 0
    this.skyMesh = null
    this.trees = []
    this.worldGroup = null

    // Состояния
    this.running = false
    this.paused = false
    this.inShop = false
    this.inInventory = false

    // Оружие
    this.weaponMesh = null
    this.weaponAtkT = -1

    // Одноразовые нажатия клавиш (debounce)
    this._keyDebounce = {}

    // Запуск
    this.clock = new THREE.Clock()
    this._showMainMenu()
    this._loop()
  }

  // ---- Главное меню ----

  _showMainMenu() {
    this.running = false
    this.audio.stopAmbient()
    this.hud.hide()
    if (this.touchControls) this.touchControls.hide()
    this.input.exitLock()
    menus.showMainMenu(
      (factionId) => this._startGame(factionId),
      (slot) => this._loadAndStart(slot),
      this.audio
    )
  }

  _loadAndStart(slot) {
    // Создаём временного игрока, загружаем данные, стартуем с его фракцией
    const tmpPlayer = new Player('elves')
    const [ok] = saveLoad.loadGame(tmpPlayer, slot)
    if (ok) {
      this._startGame(tmpPlayer.factionId, slot)
    }
  }

  // ---- Старт игры ----

  _startGame(factionId, loadSlot = null) {
    this._cleanup()
    this.combatLog.clear()

    this.player = new Player(factionId)

    // Рендерер
    this.renderer.setupForFaction(factionId)

    // Мир
    this.worldGroup = new THREE.Group()
    this.renderer.scene.add(this.worldGroup)

    const terrain = buildTerrain()
    this.worldGroup.add(terrain.mesh)
    this.getHeight = terrain.getHeight

    // Поставить игрока на рельеф (startPos.z=5 может быть ниже поверхности)
    if (!loadSlot) {
      this.player.z = this.getHeight(this.player.x, this.player.y) + 0.3
    }

    buildBuildings(this.worldGroup, this.getHeight)
    this.waterMeshes = buildWater(this.renderer.scene, this.getHeight)
    this.skyMesh = buildSky(this.renderer.scene, factionId)
    this.trees = buildForest(this.worldGroup, this.getHeight)

    // Враги
    this.enemies = []
    for (const sp of ENEMY_SPAWNS) {
      for (let i = 0; i < sp.count; i++) {
        const s = sp.spread || 25
        const x = sp.cx + rand(-s, s), y = sp.cy + rand(-s, s)
        const z = this.getHeight(x, y) + 1.0
        const enemy = new Enemy(sp.type, x, y, z)
        enemy.mesh = createEnemyMesh(enemy)
        this.worldGroup.add(enemy.mesh)
        this.enemies.push(enemy)
      }
    }

    // Корованы + реальная охрана
    this.korovans = []
    const guardOffsets = [[3, 2], [-3, 2], [3, -2], [-3, -2]]
    for (let i = 0; i < 5; i++) {
      const k = new Korovan(i + 1, rand(0.8, 1.5))
      k.mesh = createKorovanMesh(k)
      this.worldGroup.add(k.mesh)
      // 4 NPC-охранника рядом с телегой
      for (const [ox, oy] of guardOffsets) {
        const guard = new Enemy('korovan_guard', k.x + ox, k.y + oy)
        guard.parentKorovan = k
        guard.escortOffset = [ox, oy]
        guard.patrolR = 5
        guard.mesh = createEnemyMesh(guard)
        this.worldGroup.add(guard.mesh)
        this.enemies.push(guard)
        k.guardEnemies.push(guard)
      }
      this.korovans.push(k)
    }

    // Загрузка — ПОСЛЕ создания врагов и корованов, чтобы восстановить их состояние
    if (loadSlot) {
      saveLoad.loadGame(this.player, loadSlot, this.enemies, this.korovans)
      this._syncWorldAfterLoad()
    }

    // Рынок
    const zoneId = FACTIONS[factionId].zone || 'human_zone'
    this.market = new Market(zoneId)

    // Оружие от первого лица
    this.weaponMesh = createWeaponMesh(this.renderer.weaponScene, this.player.inventory.weapon)

    // Камера на позицию игрока
    this.fpsCam.update(this.player.x, this.player.y, this.player.z)

    // HUD
    this.hud.show()

    // Показать "нажмите чтобы играть"
    this._isNewGame = !loadSlot
    this._showClickToPlay()

    this.running = true
    this.paused = false
    this.inShop = false
    this.inInventory = false
    this._deathShown = false
    this._deathTimer = 0

    this.combatLog.add(pick(MEMES.startGame), 'system')
    if (factionId === 'elves') this.combatLog.add('Лес защищает тебя. Берегись солдат!', 'system')
    else if (factionId === 'guards') this.combatLog.add('Охраняй дворец. Слушай командира!', 'system')
    else if (factionId === 'villain') this.combatLog.add('Твои войска ждут приказа. Захвати трон!', 'system')
    this._killstreak = 0
    this._enemyBarkTimer = 0
  }

  _showClickToPlay() {
    const el = document.getElementById('click-to-play')
    el.classList.remove('hidden')
    const handler = () => {
      el.classList.add('hidden')
      el.removeEventListener('click', handler)
      el.removeEventListener('touchend', handler)

      if (this._isNewGame && shouldShowOnboarding()) {
        this.paused = true
        showOnboarding(() => {
          this.paused = false
          this._activateGameplay()
        })
      } else {
        this._activateGameplay()
      }
    }
    el.addEventListener('click', handler)
    el.addEventListener('touchend', handler)
  }

  _activateGameplay() {
    if (isMobile) {
      // Fullscreen API — скрывает адресную строку и панели браузера
      const doc = document.documentElement
      const rfs = doc.requestFullscreen || doc.webkitRequestFullscreen
      if (rfs) rfs.call(doc).catch(() => {})
      if (this.touchControls) this.touchControls.show()
    } else {
      this.input.requestLock()
    }
    this.audio.playAmbient()
  }

  // ---- Очистка ----

  _cleanup() {
    if (this.worldGroup) {
      this.renderer.scene.remove(this.worldGroup)
      // Dispose all geometries/materials
      this.worldGroup.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose()
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose())
          else obj.material.dispose()
        }
      })
      this.worldGroup = null
    }
    if (this.skyMesh) {
      this.renderer.scene.remove(this.skyMesh)
      this.skyMesh = null
    }
    // Очистить оружейную сцену
    while (this.renderer.weaponScene.children.length > 0) {
      this.renderer.weaponScene.remove(this.renderer.weaponScene.children[0])
    }
    this.enemies = []
    this.korovans = []
    this.trees = []
  }

  // ---- Главный цикл ----

  _loop() {
    requestAnimationFrame(() => this._loop())

    const dt = Math.min(this.clock.getDelta(), 0.1)

    if (!this.running || this.paused) {
      this.renderer.render()
      return
    }

    const player = this.player
    if (player.dead) {
      // Показать "ПОТРАЧЕНО" с задержкой перед меню смерти
      if (!this._deathShown) {
        this._deathShown = true
        this._deathTimer = 0
        this.audio.playPlayerDeath()
        this.audio.stopAmbient()
        this.hud.showPotracheno()
      }
      this._deathTimer += dt
      if (this._deathTimer > 2.5) {
        this._deathShown = false
        this.running = false
        this.input.exitLock()
        if (this.touchControls) this.touchControls.hide()
        this.hud.hidePotracheno()
        menus.showDeath(player,
          (fid) => this._startGame(fid),
          () => this._showMainMenu()
        )
      }
      this.renderer.render()
      return
    }

    // Ввод
    this._handleInput(dt)

    // Камера
    this.input.consumeMouse()
    if (this.input.locked) {
      this.fpsCam.rotate(this.input.mouseX, this.input.mouseY)
    }

    // Движение
    this._handleMovement(dt)
    player.updateJump(dt)

    // Приземление на рельеф
    if (player.jumping) {
      const g = this.getHeight(player.x, player.y) + 0.3
      if (player.z < g) {
        player.z = g
        player.jumping = false
        player.jumpVel = 0
      }
    }

    // Подстраховка: если провалился под рельеф — вернуть на поверхность
    {
      const groundH = this.getHeight(player.x, player.y) + 0.3
      if (player.z < groundH - 2 && !player.jumping) {
        player.z = groundH
      }
    }

    // Проверка на воду: если в реке — смерть "ПОТРАЧЕНО"
    {
      const rInf = riverInfluence(player.x, player.y)
      if (rInf > 0.5 && !player.dead) {
        this.audio.playDrown()
        player.dead = true
        player.hp = 0
        this.combatLog.add(pick(MEMES.drown), 'system')
      }
    }

    // Проверка на ущелье: если в глубине — смерть
    {
      const gInf = gorgeInfluenceAt(player.x, player.y)
      if (gInf > 0.5 && !player.dead) {
        this.audio.playGorgeFall()
        player.dead = true
        player.hp = 0
        this.combatLog.add(pick(MEMES.gorge), 'system')
      }
    }

    // Тик игрока (кровотечение)
    const bleed = player.tick(dt)
    if (bleed > 0) {
      this._bleedMsgTimer = (this._bleedMsgTimer || 0) - dt
      if (this._bleedMsgTimer <= 0) {
        this.combatLog.add(`Кровотечение: -${bleed} HP`, 'body')
        this._bleedMsgTimer = 3
      }
    }

    // Враги AI
    if (this._enemyBarkTimer > 0) this._enemyBarkTimer -= dt
    this._updateEnemies(dt)

    // Корованы
    for (const k of this.korovans) {
      const oldKx = k.x, oldKy = k.y
      k.update(dt)
      // Коллизия со зданиями (радиус побольше — корован крупный)
      const res = resolveCollision(k.x, k.y, 3.0, oldKx, oldKy)
      const korBlocked = (Math.abs(res.x - k.x) > 0.01 || Math.abs(res.y - k.y) > 0.01)
      k.x = res.x
      k.y = res.y
      // Если корован застрял, сдвигаем перпендикулярно
      if (korBlocked && k.alive) {
        const dx2 = k.x - oldKx, dy2 = k.y - oldKy
        const slide = k.speed * dt * 0.9
        const perpX = -dy2, perpY = dx2
        const norm = Math.sqrt(perpX * perpX + perpY * perpY) || 1
        const tryX = k.x + (perpX / norm) * slide
        const tryY = k.y + (perpY / norm) * slide
        const tryRes = resolveCollision(tryX, tryY, 3.0, k.x, k.y)
        if (Math.abs(tryRes.x - tryX) < 0.01 && Math.abs(tryRes.y - tryY) < 0.01) {
          k.x = tryX; k.y = tryY
        } else {
          k.x -= (perpX / norm) * slide
          k.y -= (perpY / norm) * slide
          const tryRes2 = resolveCollision(k.x, k.y, 3.0, res.x, res.y)
          k.x = tryRes2.x; k.y = tryRes2.y
        }
      }
      // Корован сдвигает игрока при столкновении
      if (k.alive) {
        const dxK = player.x - k.x, dyK = player.y - k.y
        const distK = Math.sqrt(dxK * dxK + dyK * dyK)
        const minDistK = 3.5
        if (distK < minDistK && distK > 0.01) {
          const push = (minDistK - distK)
          player.x += (dxK / distK) * push
          player.y += (dyK / distK) * push
        }
      }

      updateKorovanMesh(k, this.getHeight, dt)
    }

    // Korovan-korovan separation (не слипаются)
    for (let i = 0; i < this.korovans.length; i++) {
      const a = this.korovans[i]
      if (!a.alive) continue
      for (let j = i + 1; j < this.korovans.length; j++) {
        const b = this.korovans[j]
        if (!b.alive) continue
        const dx = a.x - b.x, dy = a.y - b.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > 0 && dist < 8) {
          const push = Math.min((8 - dist) * 0.15, dt * 3)
          const nx = dx / dist, ny = dy / dist
          a.x += nx * push; a.y += ny * push
          b.x -= nx * push; b.y -= ny * push
        }
      }
    }

    // Обновить видимость кнопки E на мобильных (рядом ли корован)
    if (this.touchControls) {
      let nearK = false
      for (const k of this.korovans) {
        if (!k.alive || k.looted) continue
        if (k.distTo(player.x, player.y) < 12) { nearK = true; break }
      }
      this.touchControls.setInteractVisible(nearK)
    }

    // Камера (до рендера оружия, чтобы рука двигалась синхронно с мышью)
    this.fpsCam.update(player.x, player.y, player.z)

    // Оружие анимация
    if (this.weaponAtkT >= 0) {
      this.weaponAtkT += dt
      if (this.weaponAtkT > 0.4) this.weaponAtkT = -1
    }
    animateWeapon(this.weaponMesh, this.weaponAtkT >= 0 ? this.weaponAtkT / 0.4 : -1)

    // Купол неба следует за камерой + динамический цвет по локации
    if (this.skyMesh) {
      this.skyMesh.position.copy(this.renderer.camera.position)
      updateSky(this.skyMesh, this.renderer.scene, player.x, player.y)
    }
    // Затемнение окружения вблизи Горы Тьмы
    this.renderer.setLightBrightness(getMountainDarkness(player.x, player.y))
    // Анимация воды
    updateWater(this.waterMeshes, this.clock.elapsedTime)

    // HUD
    this.hud.update(player, this.enemies, this.korovans, this.combatLog, this.getHeight, this.fpsCam.yaw, this.renderer.camera)
    this.hud.tickMessage(dt)

    this.renderer.render()
  }

  // ---- Ввод ----

  _keyOnce(code) {
    if (this.input.key(code)) {
      if (!this._keyDebounce[code]) { this._keyDebounce[code] = true; return true }
    } else { this._keyDebounce[code] = false }
    return false
  }

  _handleInput(dt) {
    // Атака (ЛКМ)
    if (this.input.consumeClick() && this.input.locked) this._onAttack()

    // Прыжок
    if (this.input.jump && !this.player.jumping) this.player.jump()

    // Подкрадывание
    this.player.sneaking = this.input.shift

    // Взаимодействие
    if (this._keyOnce('KeyE')) this._onInteract()

    // Торговля
    if (this._keyOnce('KeyT')) this._toggleShop()

    // Инвентарь
    if (this._keyOnce('KeyI')) this._toggleInventory()

    // Быстрые зелья
    if (this._keyOnce('Digit1')) this._useQuickSlot(0)
    if (this._keyOnce('Digit2')) this._useQuickSlot(1)

    // Сохранение/загрузка
    if (this._keyOnce('F5')) this._quickSave()
    if (this._keyOnce('F9')) this._quickLoad()

    // Пауза
    if (this._keyOnce('Escape')) this._togglePause()
  }

  _handleMovement(dt) {
    const player = this.player
    const speed = player.moveSpeed()
    const fwd = this.fpsCam.forwardDir
    const rgt = this.fpsCam.rightDir
    let mx = 0, my = 0

    if (this.input.forward) { mx += fwd.x; my += fwd.y }
    if (this.input.back) { mx -= fwd.x; my -= fwd.y }
    if (this.input.left) { mx -= rgt.x; my -= rgt.y }
    if (this.input.right) { mx += rgt.x; my += rgt.y }

    const len = Math.sqrt(mx * mx + my * my)
    if (len > 0) {
      this._footstepTimer = (this._footstepTimer || 0) - dt
      if (this._footstepTimer <= 0) {
        this.audio.playFootstep()
        this._footstepTimer = player.sneaking ? 0.6 : 0.35
      }
      let newX = player.x + (mx / len) * speed * dt
      let newY = player.y + (my / len) * speed * dt

      // Столкновение со зданиями
      const resolved = resolveCollision(newX, newY, 0.5, player.x, player.y)
      newX = resolved.x
      newY = resolved.y

      // Перила мостов
      const bridgeClamped = clampBridgeRailings(newX, newY, 0.4)
      newX = bridgeClamped.x
      newY = bridgeClamped.y

      // Столкновение с NPC
      for (const e of this.enemies) {
        if (e.state === 'dead') continue
        const dx = newX - e.x, dy = newY - e.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const minDist = 0.8
        if (dist < minDist && dist > 0.001) {
          const push = (minDist - dist)
          newX += (dx / dist) * push
          newY += (dy / dist) * push
        }
      }

      player.x = newX
      player.y = newY
    }

    if (len === 0) this._footstepTimer = 0

    // Границы карты
    player.x = Math.max(-340, Math.min(340, player.x))
    player.y = Math.max(-340, Math.min(340, player.y))

    // Высота рельефа (0.3 чтобы не проваливаться на холмах)
    if (!player.jumping) {
      player.z = this.getHeight(player.x, player.y) + 0.3
    }
  }

  // ---- Атака ----

  _onAttack() {
    if (!this.running || this.paused || this.inShop) return
    const player = this.player
    if (!player.canAttack()) return

    this.weaponAtkT = 0 // Анимация
    this.audio.playSwing()

    // Дальность атаки: у дальнобойного оружия — range, у ближнего — 4.0
    const weaponData = ITEMS[player.inventory.weapon]
    const attackRange = weaponData?.range || 4.0
    const isRanged = attackRange > 5

    let closest = null, closestDist = attackRange
    for (const e of this.enemies) {
      if (e.state === 'dead') continue
      const dx = e.x - player.x, dy = e.y - player.y
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d >= closestDist) continue
      // Дальнобойное оружие: проверка направления (конус ~45°)
      if (isRanged && d > 4.0) {
        const fwd = this.fpsCam.forwardDir
        const dot = (dx / d) * fwd.x + (dy / d) * fwd.y
        if (dot < 0.7) continue
      }
      closest = e
      closestDist = d
    }

    if (closest) {
      const dmg = player.attackDamage()
      const result = closest.takeDamage(dmg)
      player.attackCooldown = 0.8

      if (result.hit) {
        this.audio.playHitEnemy()
        let msg = `Удар по ${closest.name} (${result.part}): ${result.damage} урона`
        if (result.crit) msg += ` [КРИТ! ${pick(MEMES.crit)}]`
        this.combatLog.add(msg, 'player')

        if (result.killed) {
          this.audio.playEnemyDeath()
          player.kills++
          this._killstreak++
          const loot = closest.getLoot()
          player.inventory.gold += loot.gold
          for (const [id, qty] of Object.entries(loot.items)) player.inventory.add(id, qty)
          const killMsg = closest.hp <= 30 ? pick(MEMES.killWeak) : pick(MEMES.kill)
          this.combatLog.add(`${closest.name} убит! +${loot.gold} золота. ${killMsg}`, 'loot')
          if (closest.mesh) { closest.mesh.rotation.z = Math.PI / 2; closest.mesh.position.y = 0.3 }

          // Killstreak
          const ksMsg = MEMES.killstreak[this._killstreak]
          if (ksMsg) this.hud.showMessage(ksMsg, '#ff9900', 3)
        }
      } else {
        this.combatLog.add(`${closest.name} уклонился! ${pick(MEMES.dodge)}`, 'player')
      }
      return
    }

    // Попытка ограбить корован
    let nearK = null, nearKD = 10
    for (const k of this.korovans) {
      if (!k.alive || k.looted) continue
      const d = k.distTo(player.x, player.y)
      if (d < nearKD) { nearK = k; nearKD = d }
    }
    if (nearK) {
      this._attackKorovan(nearK)
    }
  }

  _attackKorovan(korovan) {
    const player = this.player
    const dmg = player.attackDamage()
    const { loot, gold, messages } = korovan.attack(dmg)
    for (const m of messages) this.combatLog.add(m, 'korovan')
    player.attackCooldown = 0.8

    if (korovan.looted) {
      player.inventory.gold += gold
      for (const [id, qty] of Object.entries(loot)) player.inventory.add(id, qty)
      this.combatLog.add(pick(MEMES.korobanRob), 'loot')
      this.hud.showMessage(`Корован разбит! +${gold} золота`, '#ffd944', 3)
    } else {
      this.hud.showMessage(
        `Телега: ${korovan.hp}/${korovan.maxHp} HP | Охрана: ${korovan.aliveGuards}`,
        '#ff8c1a', 2
      )
    }
  }

  // ---- Взаимодействие ----

  _onInteract() {
    if (!this.running) return
    let nearK = null, nearKD = 12
    for (const k of this.korovans) {
      if (!k.alive || k.looted) continue
      const d = k.distTo(this.player.x, this.player.y)
      if (d < nearKD) { nearK = k; nearKD = d }
    }
    if (nearK) {
      const goods = Object.entries(nearK.goods).slice(0, 3).map(([k, v]) => `${v}×${k}`).join(', ')
      this.hud.showMessage(
        `[ ${nearK.name} ] ${nearK.routeName}\nТелега: ${nearK.hp}/${nearK.maxHp} HP | Охрана: ${nearK.aliveGuards} чел.\nЗолото: ${nearK.gold} ${goods}\nЛКМ — атаковать`,
        '#ffcc33', 4
      )
      return
    }
    // Нет объектов — ничего не делаем
  }

  // ---- Торговля ----

  _toggleShop() {
    if (this.inShop) { this._closeShop(); return }
    this.inShop = true
    if (this.touchControls) this.touchControls.hide()
    this.input.exitLock()
    const zoneId = getZoneAt(this.player.x, this.player.y)
    this.market = new Market(zoneId)
    menus.showShop(this.player, this.market, this.combatLog, () => this._closeShop())
  }

  _closeShop() {
    this.inShop = false
    menus.hideShop()
    this.input.requestLock()
    if (this.touchControls) this.touchControls.show()
  }

  // ---- Инвентарь ----

  _toggleInventory() {
    if (this.inInventory) { this._closeInventory(); return }
    this.inInventory = true
    if (this.touchControls) this.touchControls.hide()
    this.input.exitLock()
    menus.showInventory(this.player, this.combatLog, () => this._closeInventory(), () => {
      this.weaponMesh = createWeaponMesh(this.renderer.weaponScene, this.player.inventory.weapon)
    })
  }

  _closeInventory() {
    this.inInventory = false
    menus.hideInventory()
    this.input.requestLock()
    if (this.touchControls) this.touchControls.show()
  }

  // ---- Сохранение ----

  _quickSave() {
    const [, msg] = saveLoad.saveGame(this.player, 'quicksave', this.enemies, this.korovans)
    this.combatLog.add(msg, 'save')
    this.hud.showMessage(pick(MEMES.save), '#4dff4d', 2.5)
  }

  _quickLoad() {
    const [ok, msg] = saveLoad.loadGame(this.player, 'quicksave', this.enemies, this.korovans)
    this.combatLog.add(msg, 'save')
    if (ok) {
      this._syncWorldAfterLoad()
      this.hud.showMessage(pick(MEMES.load), '#4dff4d', 2.5)
    }
  }

  /** Синхронизирует визуал мира с данными после загрузки */
  _syncWorldAfterLoad() {
    for (const e of this.enemies) {
      if (!e.mesh) continue
      if (e.state === 'dead') {
        e.mesh.rotation.z = Math.PI / 2
        e.mesh.position.y = 0.3
      } else {
        e.mesh.rotation.z = 0
      }
    }
    for (const k of this.korovans) {
      if (k.mesh) k.mesh.visible = k.alive
    }
  }

  // ---- Пауза ----

  _togglePause() {
    if (this.inShop || this.inInventory) return
    this.paused = !this.paused
    if (this.paused) {
      this.audio.stopAmbient()
      if (this.touchControls) this.touchControls.hide()
      this.input.exitLock()
      menus.showPause(
        () => { this.paused = false; this.audio.playAmbient(); this.input.requestLock(); if (this.touchControls) this.touchControls.show() },
        () => this._quickSave(),
        () => { this.paused = false; this._cleanup(); this._showMainMenu() },
        this.audio
      )
    } else {
      menus.hidePause()
      this.input.requestLock()
      if (this.touchControls) this.touchControls.show()
    }
  }

  /** Потеря pointer lock или фокуса вкладки → авто-пауза */
  _onLockLost() {
    if (!this.running || this.paused || this.inShop || this.inInventory) return
    this.paused = true
    this.audio.stopAmbient()
    if (this.touchControls) this.touchControls.hide()
    menus.showPause(
      () => { this.paused = false; this.audio.playAmbient(); this.input.requestLock(); if (this.touchControls) this.touchControls.show() },
      () => this._quickSave(),
      () => { this.paused = false; this._cleanup(); this._showMainMenu() },
      this.audio
    )
  }

  // ---- Быстрые зелья ----

  _useQuickSlot(slot) {
    const inv = this.player.inventory
    const consumables = Object.entries(inv.items).filter(([id]) => ITEMS[id]?.type === 'consumable')
    if (slot < consumables.length) {
      const [id] = consumables[slot]
      const [heal, msg] = inv.useConsumable(id, this.player.body)
      if (heal > 0) this.player.hp = this.player.body.totalHp
      this.combatLog.add(msg, 'system')
    }
  }

  // ---- Враги ----

  _updateEnemies(dt) {
    const player = this.player
    for (const enemy of this.enemies) {
      if (enemy.state === 'dead') continue
      const oldX = enemy.x, oldY = enemy.y
      const hostile = player.isHostileTo(enemy.faction)
      const result = enemy.update(dt, player.x, player.y, player.dead, hostile)
      if (enemy.state === 'chase' && enemy._prevState !== 'chase') {
        this.audio.playAggro()
      }
      enemy._prevState = enemy.state
      if (result?.type === 'attack') {
        const { actual, messages } = player.takeDamage(result.damage)
        for (const m of messages) this.combatLog.add(`${enemy.name}: ${m}`, 'enemy')
        if (actual > 0) {
          this.audio.playHitPlayer()
          this.combatLog.add(pick(MEMES.playerHit), 'body')
          this._killstreak = 0
        }
        if (messages.length > 0) this.hud.showMessage(messages[0], '#ff3333', 1.5)
        animateEnemyAttack(enemy)

        // Enemy bark (не чаще раза в 4 секунды)
        this._enemyBarkTimer = (this._enemyBarkTimer || 0)
        if (this._enemyBarkTimer <= 0) {
          const barks = MEMES.enemyBark[enemy.faction] || MEMES.enemyBark.neutral
          this.combatLog.add(`${enemy.name}: "${pick(barks)}"`, 'enemy')
          this._enemyBarkTimer = 4
        }
      }
      // Коллизия со зданиями
      const resolved = resolveCollision(enemy.x, enemy.y, 0.4, oldX, oldY)
      const wasBlocked = (Math.abs(resolved.x - enemy.x) > 0.01 || Math.abs(resolved.y - enemy.y) > 0.01)
      enemy.x = resolved.x
      enemy.y = resolved.y

      // Проверяем реальное перемещение (включая push от всех источников)
      const realDx = enemy.x - oldX, realDy = enemy.y - oldY
      const realMoveDist = Math.sqrt(realDx * realDx + realDy * realDy)
      const expectedMove = enemy.speed * dt * (enemy.state === 'patrol' ? 0.5 : 1.0) * 0.3

      // Если NPC заблокирован и пытался двигаться — обходим препятствие
      if ((wasBlocked || realMoveDist < expectedMove * 0.1) &&
          enemy.state !== 'dead' && enemy.state !== 'idle') {
        enemy._stuckTimer = (enemy._stuckTimer || 0) + dt
        if (enemy._stuckTimer > 0.5) {
          if (enemy.state === 'patrol') {
            // Просто выбрать новую цель поближе
            enemy._pickPatrolTarget()
            enemy._stuckTimer = 0
          } else if (wasBlocked) {
            // Обход стены: перпендикулярный сдвиг
            const dx2 = enemy.x - oldX, dy2 = enemy.y - oldY
            const slide = enemy.speed * dt * 0.8
            const perpX = -dy2, perpY = dx2
            const norm = Math.sqrt(perpX * perpX + perpY * perpY) || 1
            const tryX = enemy.x + (perpX / norm) * slide
            const tryY = enemy.y + (perpY / norm) * slide
            const tryRes = resolveCollision(tryX, tryY, 0.4, enemy.x, enemy.y)
            if (Math.abs(tryRes.x - tryX) < 0.01 && Math.abs(tryRes.y - tryY) < 0.01) {
              enemy.x = tryX; enemy.y = tryY
            } else {
              enemy.x -= (perpX / norm) * slide
              enemy.y -= (perpY / norm) * slide
              const tryRes2 = resolveCollision(enemy.x, enemy.y, 0.4, resolved.x, resolved.y)
              enemy.x = tryRes2.x; enemy.y = tryRes2.y
            }
          }
        }
      } else {
        enemy._stuckTimer = 0
      }

      // Коллизия NPC с игроком
      const dxP = enemy.x - player.x, dyP = enemy.y - player.y
      const distP = Math.sqrt(dxP * dxP + dyP * dyP)
      if (distP < 0.8 && distP > 0.001) {
        const push = (0.8 - distP) * 0.5
        enemy.x += (dxP / distP) * push
        enemy.y += (dyP / distP) * push
      }

      // Подстраховка: NPC не должны проваливаться под рельеф
      {
        const eGround = this.getHeight(enemy.x, enemy.y)
        if (enemy.z < eGround - 2) enemy.z = eGround
      }

      const isHostile = player.isHostileTo(enemy.faction)
      updateEnemyMesh(enemy, this.getHeight, dt, isHostile)
      updateEnemyAttackAnim(enemy, dt)
    }

    // Separation steering (мягкий, чтобы не застревали)
    const live = this.enemies.filter(e => e.state !== 'dead')
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i], b = live[j]
        const dx = a.x - b.x, dy = a.y - b.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > 0 && dist < 1.2) {
          // Мягкий push, ограниченный dt
          const push = Math.min((1.2 - dist) * 0.3, dt * 2)
          const nx = dx / dist, ny = dy / dist
          a.x += nx * push; a.y += ny * push
          b.x -= nx * push; b.y -= ny * push
        }
      }
    }
  }
}
