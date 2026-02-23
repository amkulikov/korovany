/**
 * Враги и AI.
 * "И враги 3-хмерные тоже, и труп тоже 3д."
 *
 * Конечный автомат: patrol → chase → attack → flee → dead
 */
import { ENEMY_TYPES, rand, randInt } from './constants.js'
import { resolveAttack } from './combat.js'

let _nextId = 0

export class Enemy {
  constructor(typeId, x, y, z = 5) {
    this.id = ++_nextId
    const def = ENEMY_TYPES[typeId] || ENEMY_TYPES.neutral_bandit
    this.typeId = typeId
    this.name = def.name
    this.faction = def.faction
    this.maxHp = def.hp
    this.hp = def.hp
    this.dmg = def.dmg
    this.armor = def.armor
    this.agi = def.agi
    this.speed = def.spd
    this.detectRange = def.detectRange
    this.atkRange = def.atkRange
    this.color = def.color
    this.loot = { ...def.loot }

    // Позиция
    this.x = x; this.y = y; this.z = z
    this.heading = rand(0, 360)

    // AI
    this.state = 'patrol'
    this.stateTimer = 0
    this.atkCooldown = 0

    // Патруль
    this.patrolCx = x; this.patrolCy = y
    this.patrolR = rand(8, 20)
    this.targetX = x; this.targetY = y
    this._pickPatrolTarget()

    // Для рендерера
    this.mesh = null
  }

  update(dt, px, py, playerDead, hostile) {
    if (this.state === 'dead') return null
    this.atkCooldown = Math.max(0, this.atkCooldown - dt)
    this.stateTimer += dt

    const dist = this._dist(px, py)

    // Обнаружение
    if (hostile && dist < this.detectRange && !playerDead) {
      if (this.state === 'patrol' || this.state === 'idle') this.state = 'chase'
    }

    if (this.state === 'patrol') {
      this._doPatrol(dt)
    } else if (this.state === 'chase') {
      const r = this._doChase(dt, px, py, dist)
      if (r) return r
    }

    if (this.state === 'chase' && dist > this.detectRange * 2.5) this.state = 'patrol'
    return null
  }

  _doPatrol(dt) {
    const dx = this.targetX - this.x, dy = this.targetY - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 1) { this._pickPatrolTarget(); return }
    const move = this.speed * 0.5 * dt
    this.x += (dx / dist) * move
    this.y += (dy / dist) * move
    this.heading = Math.atan2(dx, dy) * 180 / Math.PI
  }

  _pickPatrolTarget() {
    const a = rand(0, Math.PI * 2), r = rand(0, this.patrolR)
    this.targetX = this.patrolCx + Math.cos(a) * r
    this.targetY = this.patrolCy + Math.sin(a) * r
  }

  _doChase(dt, px, py, dist) {
    const dx = px - this.x, dy = py - this.y
    const minGap = this.atkRange * 0.85
    if (dist > minGap) {
      const move = Math.min(this.speed * dt, dist - minGap)
      this.x += (dx / dist) * move
      this.y += (dy / dist) * move
      this.heading = Math.atan2(dx, dy) * 180 / Math.PI
    }
    if (dist <= this.atkRange && this.atkCooldown <= 0) {
      this.atkCooldown = 1.1
      return { type: 'attack', damage: this.dmg + randInt(-2, 4) }
    }
    return null
  }

  _doFlee(dt, px, py) {
    const dx = this.x - px, dy = this.y - py
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist > 0.1) {
      const move = this.speed * 1.2 * dt
      this.x += (dx / dist) * move
      this.y += (dy / dist) * move
    }
  }

  takeDamage(damage) {
    const r = resolveAttack(damage, 8, this.armor, this.agi)
    if (r.hit) {
      this.hp = Math.max(0, this.hp - r.damage)
      if (this.hp <= 0) { this.die(); return { ...r, killed: true } }
      // Получив урон — всегда агрится (friendly fire → chase)
      if (this.state !== 'dead') this.state = 'chase'
    }
    return { ...r, killed: false }
  }

  die() {
    this.state = 'dead'
    // Визуальная "смерть" делается рендерером
  }

  getLoot() {
    const gold = this.loot.gold || 0
    delete this.loot.gold
    return { items: { ...this.loot }, gold }
  }

  _dist(x, y) { return Math.sqrt((this.x - x) ** 2 + (this.y - y) ** 2) }
}
