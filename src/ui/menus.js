/**
 * Меню: главное, фракции, пауза, смерть, загрузка.
 */
import { FACTIONS, ITEMS, MEMES, pick } from '../game/constants.js'
import { Market } from '../game/trading.js'
import * as saveLoad from '../game/saveLoad.js'

const $ = id => document.getElementById(id)

/** Вставляет кнопку звука в .menu-panel и вешает обработчик */
function _addSoundBtn(container, audio) {
  if (!audio) return
  const btn = container.querySelector('.sound-toggle')
  if (!btn) return
  btn.textContent = audio.muted ? '🔇' : '🔊'
  btn.onclick = () => {
    const muted = audio.toggleMute()
    btn.textContent = muted ? '🔇' : '🔊'
  }
}

function hideAll() {
  for (const id of ['menu-main', 'menu-faction', 'menu-pause', 'menu-death', 'menu-load', 'shop-panel', 'inventory-panel']) {
    $(id).classList.add('hidden')
  }
}

// ---- Главное меню ----

export function showMainMenu(onNewGame, onLoad, audio) {
  hideAll()
  const el = $('menu-main')
  el.classList.remove('hidden')
  el.innerHTML = `
    <div class="menu-panel" style="position:relative">
      <button class="sound-toggle" title="Звук вкл/выкл"></button>
      <div class="menu-title">>>> KOROVANY <<<</div>
      <div class="menu-subtitle">3D Экшон-РПГ</div>
      <div class="menu-tip" style="color:#888;font-size:13px;margin:8px 0;font-style:italic">${pick(MEMES.tips)}</div>
      <button class="menu-btn" id="btn-new-game">Новая игра</button>
      <button class="menu-btn" id="btn-load-game">Загрузить</button>
      <div class="menu-controls">
        WASD — движение &nbsp; ЛКМ — атака &nbsp; E — взаимодействие<br>
        T — торговля &nbsp; I — инвентарь &nbsp; Space — прыжок &nbsp; F5 — сохранить &nbsp; Esc — пауза
      </div>
    </div>
  `
  el.querySelector('#btn-new-game').onclick = () => showFactionMenu(onNewGame)
  el.querySelector('#btn-load-game').onclick = () => showLoadMenu(onLoad, () => showMainMenu(onNewGame, onLoad, audio))
  _addSoundBtn(el, audio)
}

// ---- Выбор фракции ----

function showFactionMenu(onSelect) {
  hideAll()
  const el = $('menu-faction')
  el.classList.remove('hidden')

  const factions = [
    { id: 'elves',   color: '#1ab31a', bgColor: 'rgba(4,45,4,0.9)' },
    { id: 'guards',  color: '#3333cc', bgColor: 'rgba(4,4,50,0.9)' },
    { id: 'villain', color: '#c01010', bgColor: 'rgba(50,4,4,0.9)' },
  ]

  let html = '<div class="menu-panel" style="max-width:900px"><div class="menu-title">Выберите фракцию</div><div class="faction-cards">'
  for (const f of factions) {
    const data = FACTIONS[f.id]
    const s = data.stats
    html += `
      <div class="faction-card" style="background:${f.bgColor}" data-faction="${f.id}">
        <h3 style="color:${f.color}">${data.name}</h3>
        <div class="desc">${data.desc}</div>
        <div class="stats">HP: ${s.maxHp}  Сила: ${s.str}  Ловк: ${s.agi}  Инт: ${s.int}<br>Золото: ${s.gold}</div>
        <button class="play-btn" style="background:${f.color}">Играть за ${data.name}</button>
      </div>
    `
  }
  html += '</div><button class="menu-btn" id="btn-back-main" style="margin-top:20px">← Назад</button></div>'
  el.innerHTML = html

  for (const card of el.querySelectorAll('.faction-card')) {
    const fid = card.dataset.faction
    card.querySelector('.play-btn').onclick = () => { hideAll(); onSelect(fid) }
  }
  el.querySelector('#btn-back-main').onclick = () => {
    hideAll()
    // Нужно вернуться к mainMenu, но у нас нет ссылки на onLoad...
    // Просто показываем main-menu заново
    $('menu-main').classList.remove('hidden')
  }
}

// ---- Загрузка ----

function showLoadMenu(onLoad, onBack) {
  hideAll()
  const el = $('menu-load')
  el.classList.remove('hidden')

  const saves = saveLoad.listSaves()
  let html = '<div class="menu-panel"><div class="menu-title">Загрузить игру</div>'
  if (saves.length === 0) {
    html += '<div style="color:#888;margin:20px">Сохранений нет.</div>'
  } else {
    for (const sv of saves.slice(0, 6)) {
      html += `<button class="save-slot" data-slot="${sv.slot}">${sv.slot} | ${sv.faction} | ${sv.timestamp}</button>`
    }
  }
  html += '<button class="menu-btn" id="btn-back-load">← Назад</button></div>'
  el.innerHTML = html

  for (const btn of el.querySelectorAll('.save-slot')) {
    btn.onclick = () => { hideAll(); onLoad(btn.dataset.slot) }
  }
  el.querySelector('#btn-back-load').onclick = onBack
}

// ---- Пауза ----

export function showPause(onResume, onSave, onMainMenu, audio) {
  hideAll()
  const el = $('menu-pause')
  el.classList.remove('hidden')
  el.innerHTML = `
    <div class="menu-panel" style="position:relative">
      <button class="sound-toggle" title="Звук вкл/выкл"></button>
      <div class="menu-title">ПАУЗА</div>
      <div id="pause-toast" style="min-height:24px;margin-bottom:8px"></div>
      <button class="menu-btn" id="btn-resume">Продолжить</button>
      <button class="menu-btn" id="btn-save">Сохранить</button>
      <button class="menu-btn" id="btn-to-menu">Главное меню</button>
    </div>
  `
  el.querySelector('#btn-resume').onclick = () => { hideAll(); onResume() }
  el.querySelector('#btn-save').onclick = () => {
    onSave()
    const toast = el.querySelector('#pause-toast')
    toast.textContent = pick(MEMES.save)
    toast.style.color = '#4dff4d'
    toast.style.transition = 'opacity 0.5s'
    toast.style.opacity = '1'
    setTimeout(() => { toast.style.opacity = '0' }, 2500)
  }
  el.querySelector('#btn-to-menu').onclick = () => { hideAll(); onMainMenu() }
  _addSoundBtn(el, audio)
}

export function hidePause() { $('menu-pause').classList.add('hidden') }

// ---- Смерть ----

export function showDeath(player, onRestart, onMainMenu) {
  hideAll()
  const el = $('menu-death')
  el.classList.remove('hidden')
  el.innerHTML = `
    <div class="menu-panel death-panel">
      <div class="menu-title" style="color:#ff1a1a">ПОТРАЧЕНО</div>
      <div style="margin:12px 0;color:#aaa;font-style:italic;font-size:14px">${pick(MEMES.deathSubtitle)}</div>
      <div style="margin:16px 0;color:#ccc">Убито врагов: ${player.kills}<br>Золото: ${player.inventory.gold}</div>
      <button class="menu-btn" id="btn-restart">Начать заново</button>
      <button class="menu-btn" id="btn-death-menu">Главное меню</button>
    </div>
  `
  el.querySelector('#btn-restart').onclick = () => { hideAll(); onRestart(player.factionId) }
  el.querySelector('#btn-death-menu').onclick = () => { hideAll(); onMainMenu() }
}

// ---- Магазин ----

export function showShop(player, market, combatLog, onClose) {
  hideAll()
  const el = $('shop-panel')
  el.classList.remove('hidden')
  let html = `<div class="menu-panel">
    <div class="menu-title">${market.zoneName} — Торговля</div>
    <div class="gold-color" style="margin-bottom:12px">Золото: ${player.inventory.gold}</div>`

  const items = Object.entries(market.stock).filter(([, v]) => v > 0)
  for (const [id, stock] of items.slice(0, 12)) {
    const data = ITEMS[id] || {}
    const buyP = market.buyPrice(id), sellP = market.sellPrice(id)
    html += `<div class="shop-item">
      <span>${data.name || id} — ${buyP}g (куп) / ${sellP}g (прод) [${stock}шт]</span>
      <span>
        <button data-action="buy" data-id="${id}">Купить</button>
        <button data-action="sell" data-id="${id}">Продать</button>
      </span>
    </div>`
  }
  html += `<button class="menu-btn" id="btn-close-shop" style="margin-top:12px">Закрыть (T)</button></div>`
  el.innerHTML = html

  el.querySelector('#btn-close-shop').onclick = onClose
  for (const btn of el.querySelectorAll('[data-action="buy"]')) {
    btn.onclick = () => {
      const [ok, msg] = market.playerBuy(player.inventory, btn.dataset.id)
      combatLog.add(msg, 'trade')
      if (ok) showShop(player, market, combatLog, onClose) // Обновить
    }
  }
  for (const btn of el.querySelectorAll('[data-action="sell"]')) {
    btn.onclick = () => {
      const [ok, msg] = market.playerSell(player.inventory, btn.dataset.id)
      combatLog.add(msg, 'trade')
      if (ok) showShop(player, market, combatLog, onClose)
    }
  }
}

export function hideShop() { $('shop-panel').classList.add('hidden') }

// ---- Инвентарь ----

export function showInventory(player, combatLog, onClose, onWeaponChanged) {
  hideAll()
  const el = $('inventory-panel')
  el.classList.remove('hidden')
  const inv = player.inventory
  let html = `<div class="menu-panel">
    <div class="menu-title">=== ИНВЕНТАРЬ ===</div>
    <div style="color:#e6c84d;margin-bottom:12px">
      Оружие: ${inv.weaponName} | Броня: ${inv.armorName} | Золото: ${inv.gold}
    </div>`

  const items = Object.entries(inv.items)
  for (const [id, qty] of items.slice(0, 14)) {
    const data = ITEMS[id] || {}
    html += `<div class="inv-item">
      <span>${data.name || id} x${qty}</span>
      <button data-id="${id}">Использовать</button>
    </div>`
  }

  // Части тела
  html += '<div style="margin-top:16px;color:#b3ffb3;font-size:12px">'
  for (const line of player.body.statusLines()) html += `<div>${line}</div>`
  html += '</div>'

  html += `<button class="menu-btn" id="btn-close-inv" style="margin-top:12px">Закрыть (I)</button></div>`
  el.innerHTML = html

  el.querySelector('#btn-close-inv').onclick = onClose
  for (const btn of el.querySelectorAll('.inv-item button')) {
    btn.onclick = () => {
      const id = btn.dataset.id
      const data = ITEMS[id] || {}
      let msg = ''
      if (data.type === 'weapon') {
        const [, m] = inv.equipWeapon(id); msg = m
        onWeaponChanged?.()
      } else if (data.type === 'armor') {
        const [, m] = inv.equipArmor(id); msg = m
      } else if (data.type === 'consumable') {
        const [heal, m] = inv.useConsumable(id, player.body); msg = m
        if (heal > 0) player.hp = player.body.totalHp
      } else if (data.type === 'prosthetic') {
        const [ok, m] = player.body.fitProsthetic(id)
        msg = m
        if (ok) inv.remove(id)
      } else { msg = 'Нельзя использовать' }
      combatLog.add(msg, 'system')
      showInventory(player, combatLog, onClose, onWeaponChanged)
    }
  }
}

export function hideInventory() { $('inventory-panel').classList.add('hidden') }
