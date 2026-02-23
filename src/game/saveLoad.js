/**
 * Сохранение / загрузка через localStorage.
 * "Сохранятся можно..."
 */

const PREFIX = 'korovany_save_'

export function saveGame(player, slot = 'quicksave') {
  const data = {
    version: '1.0',
    timestamp: new Date().toLocaleString('ru-RU'),
    ...player.toJSON(),
  }
  localStorage.setItem(PREFIX + slot, JSON.stringify(data))
  return [true, `Сохранено: ${slot}`]
}

export function loadGame(player, slot = 'quicksave') {
  const raw = localStorage.getItem(PREFIX + slot)
  if (!raw) return [false, `Сохранение не найдено: ${slot}`]
  try {
    const data = JSON.parse(raw)
    player.fromJSON(data)
    return [true, 'Загружено']
  } catch (e) {
    return [false, `Ошибка загрузки: ${e.message}`]
  }
}

export function listSaves() {
  const saves = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key.startsWith(PREFIX)) continue
    try {
      const data = JSON.parse(localStorage.getItem(key))
      saves.push({
        slot: key.slice(PREFIX.length),
        faction: data.factionId || '?',
        timestamp: data.timestamp || '',
      })
    } catch { /* skip */ }
  }
  return saves.sort((a, b) => a.slot.localeCompare(b.slot))
}

export function deleteSave(slot) {
  localStorage.removeItem(PREFIX + slot)
}
