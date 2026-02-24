/**
 * Корованы.
 * "Можно грабить корованы..."
 *
 * Корован едет по маршруту (вейпоинтам дороги), охраняется 4 NPC-охранниками.
 * Игрок может бить телегу (150 HP) — при hp=0 корован лутится.
 * Атака на телегу или любого охранника триггерит всю охрану.
 */
import { KOROVAN_ROUTES, MAIN_ROAD_WAYPOINTS, ITEMS, rand, randInt } from './constants.js'

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
    this.hp = 150
    this.maxHp = 150

    // Реальные охранники (заполняются при спавне в engine.js)
    this.guardEnemies = []
    this.underAttack = false

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

    // Проверить, можно ли возобновить движение
    if (this.underAttack) {
      const allCalm = this.guardEnemies.every(g =>
        g.state === 'dead' || g.state === 'patrol' || g.state === 'idle'
      )
      if (allCalm) this.underAttack = false
    }

    // Стоять если под атакой
    if (this.underAttack) return

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
      this._currentWP += this._direction
      return
    }

    const move = Math.min(this.speed * dt, dist)
    this.x += (dx / dist) * move
    this.y += (dy / dist) * move
    this.heading = Math.atan2(dx, dy) * 180 / Math.PI
  }

  distTo(px, py) { return Math.sqrt((this.x - px) ** 2 + (this.y - py) ** 2) }

  /** Тревога — все живые охранники агрятся, телега останавливается */
  alertGuards() {
    this.underAttack = true
    for (const g of this.guardEnemies) {
      if (g.state !== 'dead') g.state = 'chase'
    }
  }

  /** Атака по телеге. Возвращает { damage, loot, gold, messages } */
  attack(damage) {
    const messages = []
    if (this.looted) return { loot: {}, gold: 0, messages: ['Корован уже ограблен'] }

    this.hp = Math.max(0, this.hp - damage)
    messages.push(`Удар по телеге: ${damage} урона (${this.hp}/${this.maxHp})`)

    // Тревога охране
    this.alertGuards()

    if (this.hp <= 0) {
      this.looted = true
      this.alive = false
      messages.push(`Корован разбит! +${this.gold} золота`)
      for (const [id, qty] of Object.entries(this.goods)) {
        messages.push(`  + ${ITEMS[id]?.name || id} x${qty}`)
      }
      return { loot: { ...this.goods }, gold: this.gold, messages }
    }

    return { loot: {}, gold: 0, messages }
  }

  /** Количество живых охранников */
  get aliveGuards() {
    return this.guardEnemies.filter(g => g.state !== 'dead').length
  }

  infoText() {
    const lines = [
      `=== ${this.name} ===`,
      `Маршрут: ${this.routeName}`,
      `Телега: ${this.hp}/${this.maxHp} HP`,
      `Охрана: ${this.aliveGuards} из ${this.guardEnemies.length}`,
      `Товары:`,
    ]
    for (const [id, qty] of Object.entries(this.goods)) {
      lines.push(`  ${ITEMS[id]?.name || id} x${qty}`)
    }
    lines.push(`Золото: ${this.gold}`)
    return lines.join('\n')
  }
}
