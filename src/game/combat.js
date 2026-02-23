/**
 * Боевая система.
 * Удары, уклонения, криты, части тела.
 */
import { weightedChoice, randInt } from './constants.js'

/** Рассчитать атаку. Возвращает { damage, hit, crit, part } */
export function resolveAttack(atkDmg, atkAgi, defArmor, defAgi) {
  // Шанс уклонения
  const dodgeChance = Math.min(0.4, defAgi * 0.03)
  if (Math.random() < dodgeChance) return { damage: 0, hit: false, crit: false, part: null }

  const crit = Math.random() < 0.1
  const base = atkDmg * (crit ? 2.0 : 1.0)
  const damage = Math.max(1, Math.floor(base - defArmor + randInt(-3, 3)))
  const part = randomTargetPart(atkAgi)

  return { damage, hit: true, crit, part }
}

function randomTargetPart(agi) {
  const aimedChance = Math.min(0.35, agi * 0.03)
  if (Math.random() < aimedChance) {
    return weightedChoice(
      ['head', 'right_arm', 'left_arm', 'right_leg', 'left_leg', 'right_eye', 'left_eye'],
      [20, 15, 15, 15, 15, 10, 10]
    )
  }
  // Обычный удар — в основном туловище
  const parts = ['torso', 'torso', 'torso', 'head', 'right_arm', 'left_arm', 'right_leg', 'left_leg']
  return parts[Math.floor(Math.random() * parts.length)]
}

/** Лог боевых сообщений */
export class CombatLog {
  constructor(maxLines = 8) {
    this.lines = []
    this.maxLines = maxLines
  }

  add(msg) {
    this.lines.push(msg)
    if (this.lines.length > this.maxLines) this.lines.shift()
  }

  clear() { this.lines = [] }
  get text() { return this.lines.join('\n') }
}
