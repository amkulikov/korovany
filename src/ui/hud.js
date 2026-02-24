/**
 * HTML/CSS HUD: HP, части тела, лог, миникарта, цели, прицел.
 */
import * as THREE from 'three'
import { getZoneAt, ZONES } from '../game/constants.js'
import { Status } from '../game/body.js'
import { toThree } from '../engine/worldBuilder.js'
import {
  MAIN_ROAD, RIVER_PATH, GORGE, BRIDGES,
  SETTLEMENTS, TOWN_BUILDINGS, DARK_MOUNTAIN,
  distToPath, RIVER_WIDTH,
} from '../game/geodata.js'

const $ = id => document.getElementById(id)

export class HUD {
  constructor() {
    this.el = $('hud')
    this.mainEl = $('hud-main')
    this.bodyEl = $('hud-body')
    this.logEl = $('hud-log')
    this.objEl = $('hud-objectives')
    this.focusEl = $('hud-enemy-focus')
    this.msgEl = $('hud-message')
    this.minimapCanvas = $('minimap-canvas')
    this.minimapCtx = this.minimapCanvas.getContext('2d')
    this._msgTimer = 0
    this._msgDuration = 0
    this._terrainImage = null
    this._buildTerrainImage()

    // Контейнер для плавающих лейблов NPC
    this._labelContainer = document.createElement('div')
    this._labelContainer.id = 'npc-labels'
    this._labelContainer.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:50'
    document.body.appendChild(this._labelContainer)
    this._labels = new Map() // enemy.id → DOM element
  }

  show() { this.el.classList.remove('hidden') }
  hide() { this.el.classList.add('hidden') }

  /** Предварительно рисуем рельеф в оффскрин-канвас (один раз) */
  _buildTerrainImage() {
    const S = 200
    const canvas = document.createElement('canvas')
    canvas.width = S
    canvas.height = S
    const ctx = canvas.getContext('2d')
    const imageData = ctx.createImageData(S, S)
    const data = imageData.data
    const HALF = 350, scale = 700 / S

    // Данные из geodata (единый источник)
    const roadPaths = [MAIN_ROAD]
    const gorgeP1 = GORGE.p1, gorgeP2 = GORGE.p2

    for (let py = 0; py < S; py++) {
      for (let px = 0; px < S; px++) {
        const gx = (px - S / 2) * scale
        const gy = -(py - S / 2) * scale

        // Высота
        let h = 0
        if (gx > 130 && gy > 130) h = Math.sin(gx * 0.018) * Math.cos(gy * 0.018) * 0.35
        else if (gx < -130 && gy < -130) h = Math.sin(gx * 0.018) * Math.cos(gy * 0.018) * 0.40
        else {
          h = Math.sin(gx * 0.012) * Math.cos(gy * 0.012) * 1.0
            + Math.sin(gx * 0.025 + 1.0) * Math.sin(gy * 0.020) * 0.5
        }
        // Гора Тьмы
        { const md = Math.sqrt((gx - 20) ** 2 + (gy - 20) ** 2)
          if (md < 45) { const t = 1 - md / 45; h += t * t * (3 - 2 * t) * 55 }
        }
        // Горная гряда по периметру карты (как в мире)
        const edgeDist = Math.min(HALF - Math.abs(gx), HALF - Math.abs(gy))
        if (edgeDist < 100) {
          // Подавить рядом с дворцом и эльфами
          const _pc = SETTLEMENTS.palace.center, _ec = SETTLEMENTS.elf_village.center
          const palD = Math.sqrt((gx - _pc[0]) ** 2 + (gy - _pc[1]) ** 2)
          const elfD = Math.sqrt((gx - _ec[0]) ** 2 + (gy - _ec[1]) ** 2)
          const suppress = Math.max(
            palD < 80 ? 1 - palD / 80 : 0,
            elfD < 80 ? 1 - elfD / 80 : 0,
          )
          if (suppress < 0.95) {
            const f = 1 - edgeDist / 100
            const steep = f * f * (3 - 2 * f)
            const noise = Math.sin(gx * 0.06 + gy * 0.04) * 0.4
              + Math.sin(gx * 0.12 - gy * 0.08) * 0.25
            h += (steep * (55 + noise * 25) + f * f * f * 30) * (1 - suppress)
          }
        }

        // Река и ущелье
        const riverD = distToPath(gx, gy, RIVER_PATH)
        const gorgeDx = gorgeP2[0] - gorgeP1[0], gorgeDy = gorgeP2[1] - gorgeP1[1]
        const gorgeL2 = gorgeDx * gorgeDx + gorgeDy * gorgeDy
        let gorgeT = gorgeL2 > 0 ? ((gx - gorgeP1[0]) * gorgeDx + (gy - gorgeP1[1]) * gorgeDy) / gorgeL2 : 0
        gorgeT = Math.max(0, Math.min(1, gorgeT))
        const gorgeD = Math.sqrt((gx - gorgeP1[0] - gorgeT * gorgeDx) ** 2 + (gy - gorgeP1[1] - gorgeT * gorgeDy) ** 2)

        // Цвет рельефа
        let r, g, b
        const isRiver = riverD < RIVER_WIDTH
        const isGorge = gorgeD < GORGE.width

        if (isRiver && riverD < 7) {
          r = 30; g = 70; b = 130 // Река
        } else if (isGorge && gorgeD < 14) {
          // Каменистое ущелье — темнее к центру
          const depthF = 1 - gorgeD / 14
          r = Math.round(80 * (1 - depthF * 0.5))
          g = Math.round(63 * (1 - depthF * 0.5))
          b = Math.round(50 * (1 - depthF * 0.5))
        } else if (h > 18)        { r = 230; g = 230; b = 242 }
        else if (h > 12)          { r = 200; g = 200; b = 210 }
        else if (h > 5.5)         { r = 158; g = 153; b = 148 }
        else if (h > 2.5)         { r = 107; g = 82; b = 56 }
        else if (gy < -130 && gx < -130) { r = 20; g = 80; b = 20 }
        else if (gy > 130 && gx > 130)   { r = 120; g = 125; b = 160 }
        else                       { r = 85; g = 130; b = 50 }

        // Дороги — более заметные (шире и контрастнее)
        let roadBest = 0
        for (const path of roadPaths) {
          const d = distToPath(gx, gy, path)
          if (d < 8) roadBest = Math.max(roadBest, 1 - d / 8)
        }
        if (roadBest > 0.2 && !isRiver && !isGorge) {
          const t = Math.min(1, (roadBest - 0.2) / 0.5)
          r = Math.round(r * (1 - t) + 148 * t)
          g = Math.round(g * (1 - t) + 112 * t)
          b = Math.round(b * (1 - t) + 66 * t)
        }

        // Подсветка по высоте
        const bright = Math.min(30, Math.max(-20, h * 2))
        r = Math.max(0, Math.min(255, r + bright))
        g = Math.max(0, Math.min(255, g + bright))
        b = Math.max(0, Math.min(255, b + bright))

        const idx = (py * S + px) * 4
        data[idx] = r
        data[idx + 1] = g
        data[idx + 2] = b
        data[idx + 3] = 255
      }
    }

    ctx.putImageData(imageData, 0, 0)

    // Рисуем здания поверх
    ctx.globalAlpha = 0.7
    const toM = (gx, gy) => [S / 2 + gx / scale, S / 2 - gy / scale]

    // Мосты (диагональные — вдоль дороги)
    ctx.fillStyle = '#8a6a3e'
    ctx.save()
    const [gbx, gby] = toM(BRIDGES.gorge.pos.x, BRIDGES.gorge.pos.y)
    ctx.translate(gbx, gby)
    ctx.rotate(-Math.PI / 4) // 45° для диагональной дороги
    ctx.fillRect(-4, -2, 8, 4)
    ctx.restore()
    ctx.save()
    const [rbx, rby] = toM(BRIDGES.river.pos.x, BRIDGES.river.pos.y)
    ctx.translate(rbx, rby)
    ctx.rotate(-Math.PI / 4)
    ctx.fillRect(-4, -2, 8, 4)
    ctx.restore()

    // Эльфийская деревня
    ctx.fillStyle = '#5a3a1e'
    for (const [ex, ey] of SETTLEMENTS.elf_village.houses) {
      const [mx, my] = toM(ex, ey)
      ctx.fillRect(mx - 2, my - 2, 4, 4)
    }

    // Дворец
    const palC = SETTLEMENTS.palace.center, palOff = SETTLEMENTS.palace.towerOffset
    ctx.fillStyle = '#c8c8b8'
    const [pcx, pcy] = toM(palC[0], palC[1])
    ctx.fillRect(pcx - 6, pcy - 6, 12, 12)
    ctx.fillStyle = '#d0d0c0'
    for (const [dx, dy] of [[-palOff, -palOff], [palOff, -palOff], [-palOff, palOff], [palOff, palOff]]) {
      const [tx, ty] = toM(palC[0] + dx, palC[1] + dy)
      ctx.fillRect(tx - 2, ty - 2, 4, 4)
    }

    // Гора Тьмы (тёмный кружок)
    const [mtx, mty] = toM(DARK_MOUNTAIN.center[0], DARK_MOUNTAIN.center[1])
    ctx.fillStyle = '#2a1a1a'
    ctx.beginPath()
    ctx.arc(mtx, mty, 11, 0, Math.PI * 2)
    ctx.fill()

    // Форт злодея — стены обступают гору со всех сторон
    ctx.strokeStyle = '#4a1a1a'
    ctx.lineWidth = 3
    // Внешняя стена
    ctx.beginPath()
    ctx.arc(mtx, mty, 15, 0, Math.PI * 2)
    ctx.stroke()
    // 8 башен равномерно по периметру
    ctx.fillStyle = '#2a0e0e'
    for (let a = 0; a < 8; a++) {
      const ang = a * Math.PI / 4
      const tx = mtx + Math.cos(ang) * 15
      const ty = mty + Math.sin(ang) * 15
      ctx.fillRect(tx - 2, ty - 2, 4, 4)
    }
    // Внутренняя стена (ближе к горе)
    ctx.strokeStyle = '#3a1212'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(mtx, mty, 9, 0, Math.PI * 2)
    ctx.stroke()

    // Око — эллипс вдоль NE-SW (смотрит на дворец и эльфов)
    ctx.save()
    ctx.translate(mtx, mty)
    ctx.rotate(-Math.PI / 4) // NE-SW диагональ
    // Эллипс глаза
    ctx.fillStyle = '#ff3300'
    ctx.beginPath()
    ctx.ellipse(0, 0, 5, 2, 0, 0, Math.PI * 2)
    ctx.fill()
    // Зрачок-щель (вытянут вдоль той же оси)
    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.ellipse(0, 0, 2.5, 0.7, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // Людские дома
    ctx.fillStyle = '#a09060'
    for (const { x, y } of TOWN_BUILDINGS) {
      const [mx, my] = toM(x, y)
      ctx.fillRect(mx - 2, my - 2, 3, 3)
    }

    ctx.globalAlpha = 1.0
    this._terrainImage = canvas
  }

  update(player, enemies, korovans, combatLog, getHeight, cameraYaw = 0, camera = null) {
    this._updateMain(player)
    this._updateBody(player)
    this._updateLog(combatLog)
    this._updateObjectives(player)
    this._updateFloatingLabels(player, enemies, camera)
    this._updateMinimap(player, enemies, korovans, cameraYaw)
  }

  _updateMain(player) {
    const hp = player.body.totalHp, maxHp = player.body.maxTotalHp
    const hpClass = hp > maxHp * 0.5 ? 'hp-high' : hp > maxHp * 0.25 ? 'hp-mid' : 'hp-low'
    const zone = getZoneAt(player.x, player.y)
    const zoneName = ZONES[zone]?.name || zone

    this.mainEl.innerHTML = `
      <div class="${hpClass}">HP: ${hp}/${maxHp}</div>
      <div>Фракция: ${player.factionName}</div>
      <div>Зона: ${zoneName}</div>
      <div>Оружие: ${player.inventory.weaponName}</div>
      <div>Броня: ${player.inventory.armorName}</div>
      <div class="gold-color">Золото: ${player.inventory.gold}</div>
      <div>Убито: ${player.kills}</div>
    `
  }

  _updateBody(player) {
    const names = {
      head: 'Голова', torso: 'Туловище',
      right_arm: 'П.Рука', left_arm: 'Л.Рука',
      right_leg: 'П.Нога', left_leg: 'Л.Нога',
      right_eye: 'П.Глаз', left_eye: 'Л.Глаз',
    }
    let html = '<div style="color:#e6c84d">=== ТЕЛО ===</div>'
    for (const [key, display] of Object.entries(names)) {
      const part = player.body.parts[key]
      const icon = part.icon
      const cls = part.status === Status.SEVERED ? 'bp-severed'
        : part.status === Status.INJURED ? 'bp-injured'
        : part.status === Status.PROSTHETIC ? 'bp-prosthetic'
        : 'bp-healthy'
      html += `<div class="${cls}">${icon} ${display}: ${part.hp}/${part.maxHp}</div>`
    }
    if (player.body.anyBleeding) {
      html += '<div class="bp-bleeding">КРОВОТЕЧЕНИЕ!</div>'
    }
    this.bodyEl.innerHTML = html
  }

  _updateLog(combatLog) {
    this.logEl.textContent = combatLog.text
  }

  _updateObjectives(player) {
    const objs = player.objectives
    let html = '<div style="color:#cdfca0">ЗАДАЧИ:</div>'
    for (const obj of objs) html += `<div>- ${obj}</div>`
    this.objEl.innerHTML = html
  }

  _updateFloatingLabels(player, enemies, camera) {
    // Скрываем старый фокус-элемент
    this.focusEl.classList.add('hidden')

    if (!camera) return

    const SHOW_DIST = 25 // Начать показывать с этого расстояния
    const _v = new THREE.Vector3()
    const w = window.innerWidth, h = window.innerHeight

    const visibleIds = new Set()

    for (const e of enemies) {
      if (e.state === 'dead') continue
      const dist = Math.sqrt((e.x - player.x) ** 2 + (e.y - player.y) ** 2)
      if (dist > SHOW_DIST) continue

      // Проецируем позицию головы NPC на экран
      const pos = toThree(e.x, e.y, (e.z || 0) + 2.0)
      _v.copy(pos)
      _v.project(camera)

      // Позади камеры
      if (_v.z > 1) continue

      const sx = (0.5 + _v.x * 0.5) * w
      const sy = (0.5 - _v.y * 0.5) * h

      // За пределами экрана
      if (sx < -100 || sx > w + 100 || sy < -50 || sy > h + 50) continue

      visibleIds.add(e.id)

      let el = this._labels.get(e.id)
      if (!el) {
        el = document.createElement('div')
        el.style.cssText = 'position:absolute;text-align:center;transform:translate(-50%,-100%);white-space:nowrap;text-shadow:0 1px 3px #000, 0 0 6px #000;font-family:monospace;pointer-events:none'
        this._labelContainer.appendChild(el)
        this._labels.set(e.id, el)
      }

      // Масштаб: ближе = крупнее
      const scale = Math.max(0.5, Math.min(1.2, 8 / Math.max(1, dist)))
      const fontSize = Math.round(12 * scale)

      const pct = Math.max(0, e.hp / e.maxHp)
      const barLen = 10
      const filled = Math.round(pct * barLen)
      const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barLen - filled)
      const barCol = pct > 0.5 ? '#4dff4d' : pct > 0.25 ? '#ffb31a' : '#ff3333'

      const isHostile = player.isHostileTo(e.faction) || e.state === 'chase'
      const nameCol = isHostile ? '#ff6666' : '#66ff66'

      el.style.left = sx + 'px'
      el.style.top = sy + 'px'
      el.style.fontSize = fontSize + 'px'
      el.style.opacity = Math.min(1, (SHOW_DIST - dist) / 5)
      el.innerHTML = `<div style="color:${nameCol}">${e.name}</div><div style="color:${barCol};font-size:${Math.round(fontSize * 0.85)}px">${bar} ${e.hp}/${e.maxHp}</div>`
    }

    // Удаляем лейблы для NPC, которые больше не видны
    for (const [id, el] of this._labels) {
      if (!visibleIds.has(id)) {
        el.remove()
        this._labels.delete(id)
      }
    }
  }

  _updateMinimap(player, enemies, korovans, cameraYaw) {
    const ctx = this.minimapCtx
    const S = 200
    const scale = (S - 20) / 700

    // Рисуем предрассчитанный рельеф
    if (this._terrainImage) {
      ctx.drawImage(this._terrainImage, 0, 0)
    }

    // Слегка затемняем для контраста с маркерами
    ctx.fillStyle = 'rgba(0,0,0,0.15)'
    ctx.fillRect(0, 0, S, S)

    const half = S / 2

    // Враги
    for (const e of enemies) {
      if (e.state === 'dead') continue
      const mx = half + e.x * scale, my = half - e.y * scale
      ctx.fillStyle = (player.isHostileTo(e.faction) || e.state === 'chase') ? '#ff3333' : '#33cc33'
      ctx.fillRect(mx - 1.5, my - 1.5, 3, 3)
    }

    // Корованы
    ctx.fillStyle = '#ffd944'
    for (const k of korovans) {
      if (!k.alive || k.looted) continue
      const mx = half + k.x * scale, my = half - k.y * scale
      ctx.beginPath()
      ctx.moveTo(mx, my - 4)
      ctx.lineTo(mx - 3, my + 2)
      ctx.lineTo(mx + 3, my + 2)
      ctx.fill()
    }

    // Игрок
    const px = half + player.x * scale, py = half - player.y * scale

    // Направление взгляда (линия + конус)
    // camera yaw: 0 = вдоль game +Y → minimap вверх
    // На миникарте: game +Y → my уменьшается (вверх)
    // game +X → mx увеличивается (вправо)
    // forwardDir: x = -sin(yaw), y = cos(yaw)
    const dirX = -Math.sin(cameraYaw)
    const dirY = Math.cos(cameraYaw)
    const viewLen = 18

    // FOV конус
    ctx.fillStyle = 'rgba(255, 255, 100, 0.12)'
    ctx.beginPath()
    ctx.moveTo(px, py)
    const fov = 0.5 // ~60°
    const ldx = Math.cos(Math.atan2(-dirY, dirX) - fov) * viewLen * 1.5
    const ldy = Math.sin(Math.atan2(-dirY, dirX) - fov) * viewLen * 1.5
    const rdx = Math.cos(Math.atan2(-dirY, dirX) + fov) * viewLen * 1.5
    const rdy = Math.sin(Math.atan2(-dirY, dirX) + fov) * viewLen * 1.5
    ctx.lineTo(px + ldx, py + ldy)
    ctx.lineTo(px + rdx, py + rdy)
    ctx.closePath()
    ctx.fill()

    // Линия направления
    ctx.strokeStyle = '#ffff66'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(px, py)
    ctx.lineTo(px + dirX * viewLen, py - dirY * viewLen)
    ctx.stroke()

    // Точка игрока
    ctx.fillStyle = '#ffff00'
    ctx.beginPath()
    ctx.arc(px, py, 3.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 1
    ctx.stroke()

    // Рамка
    ctx.strokeStyle = '#444'
    ctx.lineWidth = 1
    ctx.strokeRect(0, 0, S, S)
  }

  showPotracheno() {
    if (!this._potrachenoEl) {
      this._potrachenoEl = document.createElement('div')
      this._potrachenoEl.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;z-index:200;pointer-events:none;background:rgba(80,0,0,0.4)'
      this._potrachenoEl.innerHTML = '<div style="font-size:72px;font-weight:900;color:#ff0000;text-shadow:0 0 20px #ff0000, 0 0 60px #880000, 0 4px 8px #000;font-family:Impact,sans-serif;letter-spacing:8px">ПОТРАЧЕНО</div>'
      document.body.appendChild(this._potrachenoEl)
    }
    this._potrachenoEl.style.display = 'flex'
  }

  hidePotracheno() {
    if (this._potrachenoEl) this._potrachenoEl.style.display = 'none'
  }

  showMessage(text, color = '#ffff00', duration = 3) {
    this.msgEl.classList.remove('hidden')
    this.msgEl.style.color = color
    this.msgEl.textContent = text
    this._msgTimer = 0
    this._msgDuration = duration
  }

  tickMessage(dt) {
    if (this._msgDuration <= 0) return
    this._msgTimer += dt
    if (this._msgTimer >= this._msgDuration) {
      this.msgEl.classList.add('hidden')
      this._msgDuration = 0
    }
  }
}
