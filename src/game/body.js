/**
 * Система ранений и протезов.
 *
 * "...чтобы в игре могли не только убить но и отрубить руку
 *  и если пользователя не вылечат то он умрет,
 *  так же выколоть глаз но пользователь может не умереть
 *  а просто пол экрана не видеть, или достать или купить протез..."
 */
import { weightedChoice } from './constants.js'

export const Status = { HEALTHY: 'healthy', INJURED: 'injured', SEVERED: 'severed', PROSTHETIC: 'prosthetic' }

const STATUS_ICON = { [Status.HEALTHY]: '✓', [Status.INJURED]: '~', [Status.SEVERED]: 'X', [Status.PROSTHETIC]: 'P' }

class BodyPart {
  constructor(name, maxHp, { vital = false, prosthetics = [] } = {}) {
    this.name = name
    this.maxHp = maxHp
    this.hp = maxHp
    this.vital = vital
    this.prosthetics = prosthetics // допустимые типы протезов
    this.status = Status.HEALTHY
    this.prostheticType = null
    this.bleeding = false
  }

  hit(dmg) {
    const events = []
    if (this.status === Status.SEVERED) return events
    const prev = this.hp
    this.hp = Math.max(0, this.hp - dmg)

    if (this.hp < this.maxHp * 0.25 && prev >= this.maxHp * 0.25) {
      this.bleeding = true
      events.push({ type: 'bleeding', part: this.name })
    }
    if (this.hp === 0) {
      if (this.vital) {
        events.push({ type: 'death', part: this.name })
      } else {
        this.status = Status.SEVERED
        this.bleeding = true
        events.push({ type: 'severed', part: this.name })
      }
    } else if (this.hp < this.maxHp * 0.4) {
      this.status = Status.INJURED
      events.push({ type: 'injured', part: this.name })
    }
    return events
  }

  heal(amount) {
    if (this.status === Status.SEVERED) return false
    this.hp = Math.min(this.maxHp, this.hp + amount)
    this.bleeding = false
    this.status = this.hp >= this.maxHp * 0.9 ? Status.HEALTHY
      : this.hp >= this.maxHp * 0.4 ? Status.INJURED
      : this.status
    return true
  }

  fitProsthetic(itemId) {
    if (this.status !== Status.SEVERED) return [false, 'Часть тела не утрачена']
    if (!this.prosthetics.includes(itemId)) return [false, `${itemId} не подходит для ${this.name}`]
    this.status = Status.PROSTHETIC
    this.prostheticType = itemId
    this.bleeding = false
    return [true, `Установлен протез: ${itemId}`]
  }

  get functional() {
    return this.status === Status.HEALTHY || this.status === Status.INJURED || this.status === Status.PROSTHETIC
  }

  get icon() { return STATUS_ICON[this.status] }

  statusText() {
    switch (this.status) {
      case Status.HEALTHY: return `${this.name}: ${this.hp}/${this.maxHp} OK`
      case Status.INJURED: return `${this.name}: ${this.hp}/${this.maxHp} РАНЕНА`
      case Status.SEVERED: return `${this.name}: УТРАЧЕНА${this.bleeding ? ' [кровотечение]' : ''}`
      case Status.PROSTHETIC: return `${this.name}: Протез (${this.prostheticType})`
    }
  }

  toJSON() {
    return { hp: this.hp, status: this.status, prostheticType: this.prostheticType, bleeding: this.bleeding }
  }

  fromJSON(d) {
    this.hp = d.hp; this.status = d.status
    this.prostheticType = d.prostheticType; this.bleeding = d.bleeding
  }
}

// ---- Тело персонажа ----

const PARTS_DEF = [
  ['head',      'Голова',       80,  { vital: true }],
  ['torso',     'Туловище',     200, { vital: true }],
  ['right_arm', 'Правая рука',  70,  { prosthetics: ['wooden_arm', 'iron_arm'] }],
  ['left_arm',  'Левая рука',   70,  { prosthetics: ['wooden_arm', 'iron_arm'] }],
  ['right_leg', 'Правая нога',  80,  { prosthetics: ['wooden_leg', 'iron_leg'] }],
  ['left_leg',  'Левая нога',   80,  { prosthetics: ['wooden_leg', 'iron_leg'] }],
  ['right_eye', 'Правый глаз',  30,  { prosthetics: ['glass_eye'] }],
  ['left_eye',  'Левый глаз',   30,  { prosthetics: ['glass_eye'] }],
]

const HIT_WEIGHTS = {
  torso: 40, head: 12, right_arm: 10, left_arm: 10,
  right_leg: 10, left_leg: 10, right_eye: 4, left_eye: 4,
}

export class Body {
  constructor() {
    this.parts = {}
    for (const [key, name, hp, opts] of PARTS_DEF) {
      this.parts[key] = new BodyPart(name, hp, opts)
    }
  }

  /** Нанести удар по случайной или конкретной части. Возвращает [events, partKey] */
  takeHit(damage, targetPart = null) {
    if (!targetPart) {
      const available = Object.keys(this.parts).filter(k => {
        const p = this.parts[k]
        return !(p.status === Status.SEVERED && !p.vital)
      })
      const weights = available.map(k => HIT_WEIGHTS[k] || 5)
      targetPart = weightedChoice(available, weights)
    }
    const part = this.parts[targetPart] || this.parts.torso
    return [part.hit(damage), targetPart]
  }

  bleedTick() {
    let total = 0
    for (const p of Object.values(this.parts)) {
      if (p.bleeding) total += 2
    }
    return total
  }

  applyTreatment(healAmount) {
    for (const p of Object.values(this.parts)) {
      if (p.status === Status.INJURED || p.bleeding) p.heal(healAmount)
    }
  }

  fitProsthetic(itemId) {
    for (const [key, part] of Object.entries(this.parts)) {
      if (part.status === Status.SEVERED && part.prosthetics.includes(itemId)) {
        const [ok, msg] = part.fitProsthetic(itemId)
        return [ok, msg, key]
      }
    }
    return [false, 'Нет подходящей утраченной части тела', null]
  }

  get alive() {
    return !Object.values(this.parts).some(p => p.vital && p.hp === 0)
  }

  get totalHp() {
    return Object.values(this.parts).filter(p => p.vital).reduce((s, p) => s + p.hp, 0)
  }

  get maxTotalHp() {
    return Object.values(this.parts).filter(p => p.vital).reduce((s, p) => s + p.maxHp, 0)
  }

  movementMult() {
    const legs = ['right_leg', 'left_leg'].filter(k => this.parts[k].functional).length
    return legs === 0 ? 0.1 : legs === 1 ? 0.5 : 1.0
  }

  visionMult() {
    const eyes = ['right_eye', 'left_eye'].filter(k => this.parts[k].functional).length
    return eyes === 2 ? 1.0 : eyes === 1 ? 0.6 : 0.2
  }

  canFight() {
    return this.parts.right_arm.functional || this.parts.left_arm.functional
  }

  get anyBleeding() {
    return Object.values(this.parts).some(p => p.bleeding)
  }

  statusLines() {
    return Object.values(this.parts).map(p => p.statusText())
  }

  toJSON() {
    const out = {}
    for (const [k, p] of Object.entries(this.parts)) out[k] = p.toJSON()
    return out
  }

  fromJSON(data) {
    for (const [k, d] of Object.entries(data)) {
      if (this.parts[k]) this.parts[k].fromJSON(d)
    }
  }
}
