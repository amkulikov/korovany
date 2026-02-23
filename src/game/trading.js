/**
 * Торговля — как в Daggerfall.
 */
import { ITEMS, ZONES } from './constants.js'

export class Market {
  constructor(zoneId, markup = 1.3, sellback = 0.6) {
    const zone = ZONES[zoneId] || {}
    this.zoneName = zone.name || 'Рынок'
    this.markup = markup
    this.sellback = sellback
    this.stock = {}
    for (const id of (zone.marketItems || [])) {
      this.stock[id] = 10
    }
  }

  buyPrice(id) { return Math.floor((ITEMS[id]?.price || 0) * this.markup) }
  sellPrice(id) { return Math.floor((ITEMS[id]?.price || 0) * this.sellback) }

  playerBuy(inventory, id, count = 1) {
    if (!this.stock[id]) return [false, 'Товар недоступен']
    if (this.stock[id] < count) return [false, `В наличии: ${this.stock[id]}`]
    const total = this.buyPrice(id) * count
    if (inventory.gold < total) return [false, `Не хватает золота (${total} нужно, ${inventory.gold} есть)`]
    inventory.gold -= total
    const [ok, msg] = inventory.add(id, count)
    if (ok) this.stock[id] -= count
    return [ok, msg]
  }

  playerSell(inventory, id, count = 1) {
    if (!inventory.has(id, count)) return [false, 'Нет предмета']
    const total = this.sellPrice(id) * count
    const [ok] = inventory.remove(id, count)
    if (ok) {
      inventory.gold += total
      this.stock[id] = (this.stock[id] || 0) + count
      return [true, `Продано: ${ITEMS[id].name} x${count} за ${total} золота`]
    }
    return [false, 'Ошибка']
  }
}
