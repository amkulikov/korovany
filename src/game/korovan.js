/**
 * Корованы.
 * "Можно грабить корованы..."
 *
 * Корован едет по маршруту (вейпоинтам дороги), охраняется стражей.
 * Игрок может подойти и грабить — если победит охрану.
 */
import { KOROVAN_ROUTES, MAIN_ROAD_WAYPOINTS, ITEMS, rand, randInt } from './constants.js'
import { resolveAttack } from './combat.js'

export class Korovan {
  constructor(id, difficulty = 1.0) {
    this.id = id
    this.difficulty = difficulty
    const route = KOROVAN_ROUTES[Math.floor(Math.random() * KOROVAN_ROUTES.length)]
    this.routeName = route.name
    this.name = `Корован ${id}`

    // Вейпоинты
    this._waypoints = MAIN_ROAD_WAYPOINTS
    this._startWP = route.startWP
    this._endWP = route.endWP
    this._direction = this._startWP < this._endWP ? 1 : -1
    this._currentWP = this._startWP

    // Начальная позиция = первый вейпоинт
    const wp0 = this._waypoints[this._startWP]
    this.x = wp0[0]; this.y = wp0[1]
    this.speed = rand(4, 8)

    this.alive = true
    this.looted = false
    this.hp = Math.floor(50 * difficulty)
    this.maxHp = this.hp
    this.guards = Math.floor(3 * difficulty)
    this.guardHp = 60
    this.guardMaxHp = 60
    this.guardDmg = 12
    this.guardArmor = 8

    // Товары
    this.goods = {}
    this.gold = randInt(40, 200)
    const tradeItems = Object.entries(ITEMS).filter(([, v]) => v.type === 'trade').map(([k]) => k)
    for (let i = 0; i < randInt(2, 5); i++) {
      const item = tradeItems[Math.floor(Math.random() * tradeItems.length)]
      this.goods[item] = (this.goods[item] || 0) + randInt(3, 15)
    }

    // Направление движения (градусы, как у enemy)
    this.heading = 0

    // Для рендерера
    this.mesh = null
  }

  update(dt) {
    if (!this.alive) return

    const target = this._waypoints[this._currentWP + this._direction]
    if (!target) {
      // Достигли конца маршрута — разворот
      ;[this._startWP, this._endWP] = [this._endWP, this._startWP]
      this._direction = -this._direction
      return
    }

    const tx = target[0], ty = target[1]
    const dx = tx - this.x, dy = ty - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < 2) {
      // Достигли вейпоинта — перейти к следующему
      this._currentWP += this._direction
      return
    }

    const move = Math.min(this.speed * dt, dist)
    this.x += (dx / dist) * move
    this.y += (dy / dist) * move
    // Запоминаем heading как atan2(dx,dy) в градусах
    this.heading = Math.atan2(dx, dy) * 180 / Math.PI
  }

  distTo(px, py) { return Math.sqrt((this.x - px) ** 2 + (this.y - py) ** 2) }

  /** Атака игрока по корову. Возвращает { loot, gold, messages } */
  attack(playerDmg, playerAgi) {
    const messages = []
    if (this.looted) return { loot: {}, gold: 0, messages: ['Корован уже ограблен'] }

    if (this.guards > 0) {
      const r = resolveAttack(playerDmg, playerAgi, this.guardArmor, 5)
      if (r.hit) {
        this.guardHp -= r.damage
        let msg = `Удар по охраннику: ${r.damage} урона`
        if (r.crit) msg += ' [КРИТ!]'
        messages.push(msg)
        if (this.guardHp <= 0) {
          this.guards--
          this.guardHp = this.guardMaxHp
          messages.push(`Охранник убит! Осталось: ${this.guards}`)
        }
      }
      if (this.guards > 0) {
        messages.push(`Охрана атакует в ответ!`)
        return { loot: {}, gold: 0, messages }
      }
    }

    // Все охранники побеждены — грабим!
    this.looted = true
    this.alive = false
    messages.push(`Корован ограблен! +${this.gold} золота`)
    for (const [id, qty] of Object.entries(this.goods)) {
      messages.push(`  + ${ITEMS[id]?.name || id} x${qty}`)
    }
    return { loot: { ...this.goods }, gold: this.gold, messages }
  }

  guardCounterDamage() {
    if (this.guards <= 0 || this.looted) return 0
    return (this.guardDmg + randInt(-3, 5)) * Math.max(1, Math.floor(this.guards / 2))
  }

  infoText() {
    const lines = [
      `=== ${this.name} ===`,
      `Маршрут: ${this.routeName}`,
      `Охрана: ${this.guards} чел. | HP: ${this.guardHp}/${this.guardMaxHp}`,
      `Товары:`,
    ]
    for (const [id, qty] of Object.entries(this.goods)) {
      lines.push(`  ${ITEMS[id]?.name || id} x${qty}`)
    }
    lines.push(`Золото: ${this.gold}`)
    return lines.join('\n')
  }
}
