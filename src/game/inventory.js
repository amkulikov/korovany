/**
 * Инвентарь: предметы, экипировка, расходники.
 * "Можно покупать и т.п. возможности как в Daggerfall."
 */
import { ITEMS } from './constants.js'

export class Inventory {
  constructor(gold = 0, startWeapon = null) {
    this.items = {}       // { itemId: count }
    this.gold = gold
    this.weapon = null    // экипированное оружие (itemId)
    this.armor = null     // экипированная броня (itemId)
    if (startWeapon) {
      this.items[startWeapon] = 1
      this.weapon = startWeapon
    }
  }

  add(id, n = 1) {
    if (!ITEMS[id]) return [false, `Неизвестный предмет: ${id}`]
    this.items[id] = (this.items[id] || 0) + n
    return [true, `Получено: ${ITEMS[id].name} x${n}`]
  }

  remove(id, n = 1) {
    if ((this.items[id] || 0) < n) return [false, 'Недостаточно предметов']
    this.items[id] -= n
    if (this.items[id] <= 0) delete this.items[id]
    return [true, 'OK']
  }

  has(id, n = 1) { return (this.items[id] || 0) >= n }

  equipWeapon(id) {
    if (!this.has(id)) return [false, 'Нет в инвентаре']
    if (ITEMS[id]?.type !== 'weapon') return [false, 'Это не оружие']
    this.weapon = id
    return [true, `Экипировано: ${ITEMS[id].name}`]
  }

  equipArmor(id) {
    if (!this.has(id)) return [false, 'Нет в инвентаре']
    if (ITEMS[id]?.type !== 'armor') return [false, 'Это не броня']
    this.armor = id
    return [true, `Надето: ${ITEMS[id].name}`]
  }

  get weaponDamage() { return this.weapon ? (ITEMS[this.weapon].damage || 10) : 8 }
  get armorDefense() { return this.armor ? (ITEMS[this.armor].defense || 0) : 0 }
  get weaponName() { return this.weapon ? ITEMS[this.weapon].name : 'Кулаки' }
  get armorName() { return this.armor ? ITEMS[this.armor].name : 'Без брони' }

  useConsumable(id, body) {
    const data = ITEMS[id]
    if (!data || data.type !== 'consumable') return [0, 'Нельзя использовать']
    if (!this.has(id)) return [0, 'Нет предмета']
    const heal = data.heal || 0
    if (heal > 0) body.applyTreatment(heal)
    this.remove(id)
    return [heal, `Использовано: ${data.name} (+${heal} HP)`]
  }

  toJSON() {
    return { items: { ...this.items }, gold: this.gold, weapon: this.weapon, armor: this.armor }
  }

  fromJSON(d) {
    this.items = d.items || {}
    this.gold = d.gold || 0
    this.weapon = d.weapon || null
    this.armor = d.armor || null
  }
}
