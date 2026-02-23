/**
 * Игрок.
 * "Пользователь может играть лесными эльфами, охраной дворца и злодеем."
 */
import { FACTIONS, randInt } from './constants.js'
import { Body } from './body.js'
import { Inventory } from './inventory.js'

export class Player {
  constructor(factionId) {
    const f = FACTIONS[factionId]
    const s = f.stats
    this.factionId = factionId

    // Позиция
    this.x = f.startPos[0]
    this.y = f.startPos[1]
    this.z = f.startPos[2]
    this.heading = 0

    // Характеристики
    this.maxHp = s.maxHp
    this.hp = s.maxHp
    this.str = s.str
    this.agi = s.agi
    this.int = s.int
    this.baseArmor = s.armor

    // Стартовое оружие по фракции
    const startWeapons = { elves: 'elven_blade', guards: 'sword', villain: 'dark_sword' }

    // Системы
    this.body = new Body()
    this.inventory = new Inventory(s.gold, startWeapons[factionId] || 'dagger')

    // Состояния
    this.dead = false
    this.sneaking = false
    this.jumping = false
    this.jumpVel = 0

    // Таймеры
    this.attackCooldown = 0
    this.hurtTimer = 0
    this.bleedTimer = 0

    // Статистика
    this.kills = 0
    this.playTime = 0
  }

  get factionName() { return FACTIONS[this.factionId].name }
  get objectives() { return FACTIONS[this.factionId].objectives }

  // ---- Движение ----
  moveSpeed() {
    let base = 10.0 * (this.agi / 10.0)
    base *= this.body.movementMult()
    if (this.sneaking) base *= 0.4
    return base
  }

  jump() {
    if (!this.jumping && this.body.movementMult() > 0.15) {
      this.jumping = true
      this.jumpVel = 14.0
    }
  }

  updateJump(dt) {
    if (!this.jumping) return
    this.z += this.jumpVel * dt
    this.jumpVel -= 30.0 * dt
  }

  // ---- Бой ----
  attackDamage() {
    const wepDmg = this.inventory.weaponDamage
    const bonus = (this.str - 5) * 2
    return Math.max(1, wepDmg + bonus + randInt(-3, 3))
  }

  get effectiveArmor() { return this.baseArmor + this.inventory.armorDefense }

  canAttack() { return this.attackCooldown <= 0 && this.body.canFight() && !this.dead }

  takeDamage(rawDmg, targetPart = null) {
    const actual = Math.max(1, rawDmg - this.effectiveArmor)
    const [events, partHit] = this.body.takeHit(actual, targetPart)
    const messages = []
    this.hurtTimer = 0.3

    for (const ev of events) {
      if (ev.type === 'death') { this.dead = true; messages.push(`СМЕРТЬ! Уничтожено: ${ev.part}`) }
      else if (ev.type === 'severed') { messages.push(`Отрублено: ${ev.part}!`) }
      else if (ev.type === 'injured') { messages.push(`Ранено: ${ev.part}`) }
      else if (ev.type === 'bleeding') { messages.push(`Кровотечение: ${ev.part}`) }
    }

    this.hp = this.body.totalHp
    if (this.hp <= 0) this.dead = true
    return { actual, events, messages }
  }

  // ---- Тик ----
  tick(dt) {
    this.playTime += dt
    this.attackCooldown = Math.max(0, this.attackCooldown - dt)
    this.hurtTimer = Math.max(0, this.hurtTimer - dt)

    this.bleedTimer += dt
    if (this.bleedTimer >= 1.0) {
      this.bleedTimer = 0
      const bleed = this.body.bleedTick()
      if (bleed > 0) {
        this.hp = Math.max(0, this.hp - bleed)
        if (this.hp <= 0) this.dead = true
        return bleed
      }
    }
    return 0
  }

  isHostileTo(factionId) {
    return (FACTIONS[this.factionId].enemies || []).includes(factionId)
  }

  // ---- Сериализация ----
  toJSON() {
    return {
      factionId: this.factionId, playTime: this.playTime,
      x: this.x, y: this.y, z: this.z, heading: this.heading,
      hp: this.hp, maxHp: this.maxHp, kills: this.kills,
      body: this.body.toJSON(), inventory: this.inventory.toJSON(),
    }
  }

  fromJSON(d) {
    this.playTime = d.playTime || 0
    this.x = d.x; this.y = d.y; this.z = d.z
    this.heading = d.heading || 0
    this.hp = d.hp; this.kills = d.kills || 0
    this.body.fromJSON(d.body || {})
    this.inventory.fromJSON(d.inventory || {})
  }
}
