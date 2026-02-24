/**
 * Данные мира Корованов.
 *
 * "Здраствуйте. Я, Кирилл. Хотел бы чтобы вы сделали игру, 3Д-экшон..."
 */
import { MAIN_ROAD, SETTLEMENTS } from './geodata.js'

// Реэкспорт дороги для game-модулей (korovan.js и т.д.)
export { MAIN_ROAD as MAIN_ROAD_WAYPOINTS } from './geodata.js'

// ---- утилиты ----
export const rand = (a, b) => a + Math.random() * (b - a)
export const randInt = (a, b) => Math.floor(rand(a, b + 1))
export const pick = arr => arr[Math.floor(Math.random() * arr.length)]

// ---- Мемные фразы ----

export const MEMES = {
  // Криты
  crit: [
    'Аффтар жжот!',
    'Ваншотнул!',
    'КРИТИКАЛ ХИТ! Это вам не Дагер Фол!',
    'Жёсткий крит, респект и уважуха!',
    'Фаталити!',
  ],
  // Убийства
  kill: [
    'И труп тоже 3д.',
    'EZ Katka.',
    'Гг вп.',
    'Нуб.',
    'Олдскулы свело!',
    'Пацан к успеху шёл... не получилось.',
    'F.',
  ],
  // Убийство слабого врага
  killWeak: [
    'EZ Katka, даже не напрягся.',
    'Это было слишком легко. Типо дагер фол, но лутше.',
    'Нуб.',
  ],
  // Промах / уклонение
  dodge: [
    'Увернулся! Ловкач.',
    'Мимо! Ты чё такой серьёзный?',
    'Промазал, лол.',
    'Не попал, пробуй ещё.',
  ],
  // Игрок получает урон
  playerHit: [
    'Нежданчик!',
    'Ауч!',
    'Больно, блин!',
    'Это фиаско, братан.',
  ],
  // Ранение ноги эльфийским лучником
  arrowToKnee: 'Раньше я тоже был искателем приключений, но потом получил стрелу в колено...',
  // Смерть игрока (вариации подтекста)
  deathSubtitle: [
    'Пацан к успеху шёл. Не получилось, не фартануло.',
    'F в чат, братишки.',
    'git gud',
    'Это фиаско, братан.',
    'Скилл ишью.',
    'Может, попробовать на лёгком?.. А, его нет.',
    'Ну вы поняли.',
  ],
  // Утопление
  drown: [
    'Вы утонули! Это фиаско, братан.',
    'Вы утонули! Плавать не умеем, да?',
    'Вы утонули! Надо было в бассейн ходить.',
  ],
  // Падение в ущелье
  gorge: [
    'Это фиаско, братан! Вы упали в ущелье.',
    'Ущелье оказалось глубже, чем казалось.',
    'Гравитация — жестокая штука.',
  ],
  // Крики врагов (NPC barks)
  enemyBark: {
    villain: ['Раш Б, не стопимся!', 'За Тёмного Лорда!', 'Шта?!', 'Ктулху фхтагн!'],
    elves: ['За лес!', 'Ты в нашем лесу, чужак!', 'Стрела найдёт тебя!', 'Дэнадан!'],
    guards: ['Именем Императора!', 'Стоять! Руки вверх!', 'Защитим дворец!', 'Тревога!'],
    neutral: ['Кошелёк или жизнь!', 'Твоё золото — моё золото!', 'Стой, не двигайся!'],
  },
  // Грабёж корованов
  korobanRob: [
    'Можно грабить корованы!',
    'Корован ограблен! Кирилл бы гордился.',
    'Аааа, наконец-то! Грабёж корованов!',
    'Дагер Фол нервно курит в сторонке.',
  ],
  korobanFail: [
    'Mission failed — we\'ll get \'em next time.',
    'Охрана не дремлет!',
    'Не так-то просто грабить корованы...',
  ],
  // Сохранение
  save: [
    'Прогресс сохранён! Кирилл одобряет.',
    'Сейв создан. Можно грабить корованы дальше.',
    'Сохранено! Типо дагер фол, но лутше.',
    'F5 — лутшая кнопка в игре.',
    'Игра сохранена. Не благодарите.',
    'Сейв записан! Теперь можно умирать спокойно.',
    'Квиксейв! Олдскулы свело.',
    'Сохранено. Savescum\'инг — не баг, а фича.',
    'Прогресс сохранён. Откатиться всегда успеешь.',
    'Записано! Ctrl+S... то есть F5.',
  ],
  // Загрузка
  load: [
    'Загружено! Как будто ничего и не было.',
    'Таймлайн восстановлен. Продолжаем.',
    'Сейв загружен. Второй шанс!',
    'Загрузка завершена. Теперь-то получится.',
    'Квиклоад! Всё по новой.',
  ],
  // Стартовые приветствия
  startGame: [
    'Здраствуйте. Я, Кирилл. Хотел бы чтобы вы сделали игру...',
    'И чтобы можно было грабить корованы.',
    '3Д-экшон от первого лица, типо дагер фол.',
    'И враги 3-хмерные тоже, и труп тоже 3д.',
  ],
  // Загрузочные подсказки
  tips: [
    'Чтобы победить, нужно не умереть. Серьёзно.',
    'Типо Дагер Фол, но лутше.',
    'И чтобы можно было грабить корованы.',
    'И враги 3-хмерные тоже.',
    'Стрела в колено — это не шутка.',
    'Превед! Добро пожаловать в мир Корованов!',
    'Half-Life 3 confirmed.',
    'Британские учёные доказали: грабить корованы полезно для здоровья.',
    'Олдскулы свело? Самое время пограбить корованы.',
    'Нажми F, чтобы отдать дань уважения.',
    'Кирилл, 14 лет, одобряет эту игру.',
    'Раш Б, не стопимся! ...подождите, это не та игра.',
    'Если ты читаешь это — уже поздно.',
    'Респект и уважуха тем, кто дочитал до конца.',
    'Всё, что не убивает, делает тебя сильнее. Кроме лавы. И воды.',
  ],
  // Взаимодействие с пустотой
  noTarget: [
    'Нет целей рядом. Ну и ладно.',
    'Пустота. Зато воздух свежий.',
    'Тут никого. Можно расслабиться.',
  ],
  // 5 убийств подряд
  killstreak: {
    3: 'Тройное убийство!',
    5: 'МУЛЬТИКИЛЛ! 5 звёзд!',
    10: 'РАМПАГА! Ты — машина!',
  },
}
export function weightedChoice(items, weights) {
  const total = weights.reduce((s, w) => s + w, 0)
  let r = Math.random() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

// ---- Фракции ----
export const FACTIONS = {
  elves: {
    name: 'Лесные эльфы',
    desc: 'Живут в густом лесу. Быстрые и ловкие.\nЗащищай лес, грабь корованы, отражай набеги.',
    zone: 'elf_zone',
    startPos: [...SETTLEMENTS.elf_village.spawnPos, 5],
    color: [0.25, 0.40, 0.20],
    enemies: ['guards', 'villain'],
    allies: [],
    objectives: [
      'Защищай лес от солдат дворца',
      'Грабь купеческие корованы',
      'Отражай набеги злодея',
      'Развивай деревню эльфов',
    ],
    stats: { maxHp: 110, str: 7, agi: 10, int: 8, gold: 50, armor: 4 },
  },
  guards: {
    name: 'Охрана дворца',
    desc: 'Элитные солдаты императора. Сильные и дисциплинированные.\nЗащищай дворец, уничтожай шпионов, ходи в рейды.',
    zone: 'palace_zone',
    startPos: [...SETTLEMENTS.palace.spawnPos, 5],
    color: [0.15, 0.15, 0.8],
    enemies: ['villain', 'elves'],
    allies: ['humans'],
    objectives: [
      'Защищай дворец императора',
      'Уничтожай шпионов злодея',
      'Выполняй приказы командира',
      'Ходи в рейды на врагов',
    ],
    stats: { maxHp: 150, str: 9, agi: 6, int: 6, gold: 100, armor: 12 },
  },
  villain: {
    name: 'Тёмный Лорд',
    desc: 'Могущественный злодей в горном форту. Командир армии.\nСобирай войска, шли шпионов, захвати трон!',
    zone: 'villain_zone',
    startPos: [...SETTLEMENTS.fort.spawnPos, 5],
    color: [0.7, 0.05, 0.05],
    enemies: ['guards'],
    allies: [],
    objectives: [
      'Собирай армию тёмных сил',
      'Шли шпионов во дворец',
      'Нападай на дворец императора',
      'Захвати трон и стань императором',
    ],
    stats: { maxHp: 140, str: 10, agi: 8, int: 9, gold: 200, armor: 8 },
  },
}

// ---- Предметы ----
export const ITEMS = {
  // Оружие
  sword:       { name: 'Меч',              type: 'weapon', damage: 14, speed: 1.0, price: 150 },
  dagger:      { name: 'Кинжал',           type: 'weapon', damage: 8,  speed: 1.8, price: 60 },
  axe:         { name: 'Топор',            type: 'weapon', damage: 20, speed: 0.7, price: 200 },
  bow:         { name: 'Лук',              type: 'weapon', damage: 10, range: 40,  price: 100 },
  spear:       { name: 'Копьё',            type: 'weapon', damage: 16, speed: 0.9, price: 120 },
  staff:       { name: 'Посох',            type: 'weapon', damage: 10, magic: true, price: 200 },
  elven_blade: { name: 'Эльфийский клинок', type: 'weapon', damage: 13, speed: 1.3, price: 300 },
  dark_sword:  { name: 'Тёмный меч',       type: 'weapon', damage: 22, speed: 0.8, price: 500 },
  // Броня
  leather_armor: { name: 'Кожаный доспех',    type: 'armor', defense: 10, price: 80 },
  chain_mail:    { name: 'Кольчуга',          type: 'armor', defense: 20, price: 200 },
  plate_armor:   { name: 'Латный доспех',     type: 'armor', defense: 35, price: 500 },
  elven_armor:   { name: 'Эльфийский доспех', type: 'armor', defense: 15, agilityBonus: 2, price: 350 },
  dark_armor:    { name: 'Тёмный доспех',     type: 'armor', defense: 30, price: 450 },
  // Протезы
  wooden_arm: { name: 'Деревянная рука', type: 'prosthetic', slot: 'arm', price: 80 },
  iron_arm:   { name: 'Железная рука',   type: 'prosthetic', slot: 'arm', price: 300 },
  wooden_leg: { name: 'Деревянная нога', type: 'prosthetic', slot: 'leg', price: 100 },
  iron_leg:   { name: 'Железная нога',   type: 'prosthetic', slot: 'leg', price: 350 },
  glass_eye:  { name: 'Стеклянный глаз', type: 'prosthetic', slot: 'eye', price: 150 },
  // Расходники
  healing_potion: { name: 'Зелье лечения', type: 'consumable', heal: 50,  price: 40 },
  bandage:        { name: 'Бинт',          type: 'consumable', heal: 20,  price: 10 },
  strong_potion:  { name: 'Сильное зелье', type: 'consumable', heal: 100, price: 100 },
  antidote:       { name: 'Противоядие',   type: 'consumable', effect: 'cure_poison', price: 30 },
  // Торговля
  grain:    { name: 'Зерно',        type: 'trade', price: 5 },
  spices:   { name: 'Специи',       type: 'trade', price: 50 },
  silk:     { name: 'Шёлк',         type: 'trade', price: 80 },
  iron_ore: { name: 'Железо',       type: 'trade', price: 15 },
  gems:     { name: 'Самоцветы',    type: 'trade', price: 200 },
  timber:   { name: 'Лесоматериал', type: 'trade', price: 12 },
  furs:     { name: 'Меха',         type: 'trade', price: 70 },
  ale:      { name: 'Эль',          type: 'trade', price: 8 },
}

// ---- Зоны карты ----
export const ZONES = {
  human_zone: {
    name: 'Людские земли', center: [0, 0], radius: 120,
    color: [0.8, 0.75, 0.5],
    hasMarket: true,
    marketItems: Object.keys(ITEMS),
  },
  palace_zone: {
    name: 'Земли Императора', center: SETTLEMENTS.palace.center, radius: SETTLEMENTS.palace.zoneRadius,
    color: [0.5, 0.5, 0.9],
    hasMarket: true,
    marketItems: ['sword', 'axe', 'chain_mail', 'plate_armor', 'healing_potion', 'bandage'],
  },
  elf_zone: {
    name: 'Эльфийский лес', center: SETTLEMENTS.elf_village.center, radius: SETTLEMENTS.elf_village.zoneRadius,
    color: [0.1, 0.5, 0.1],
    hasMarket: true,
    marketItems: ['elven_blade', 'elven_armor', 'bow', 'healing_potion', 'antidote', 'furs', 'timber'],
  },
  villain_zone: {
    name: 'Горы Тьмы', center: SETTLEMENTS.fort.center, radius: SETTLEMENTS.fort.zoneRadius,
    color: [0.3, 0.1, 0.1],
    hasMarket: true,
    marketItems: ['dark_sword', 'dark_armor', 'strong_potion', 'iron_ore', 'gems'],
  },
}

// ---- Типы врагов ----
export const ENEMY_TYPES = {
  elf_warrior:      { name: 'Воин-эльф',        faction: 'elves',   hp: 90,  dmg: 16, armor: 5,  agi: 9,  spd: 6,  detectRange: 18, atkRange: 2.5, color: [0.28, 0.42, 0.22], loot: { furs: 1, timber: 1 } },
  elf_archer:       { name: 'Эльф-лучник',      faction: 'elves',   hp: 60,  dmg: 14, armor: 3,  agi: 11, spd: 5,  detectRange: 35, atkRange: 30,  color: [0.22, 0.38, 0.18], loot: { bow: 1 } },
  palace_guard:     { name: 'Гвардеец',          faction: 'guards',  hp: 120, dmg: 18, armor: 12, agi: 5,  spd: 4,  detectRange: 15, atkRange: 2.5, color: [0.15, 0.15, 0.8], loot: { gold: 20, sword: 1 } },
  palace_captain:   { name: 'Капитан гвардии',   faction: 'guards',  hp: 200, dmg: 24, armor: 16, agi: 6,  spd: 4.5,detectRange: 20, atkRange: 3,   color: [0.0, 0.0, 0.6],  loot: { gold: 80, chain_mail: 1 } },
  dark_soldier:     { name: 'Тёмный солдат',     faction: 'villain', hp: 100, dmg: 20, armor: 8,  agi: 7,  spd: 5,  detectRange: 16, atkRange: 2.5, color: [0.5, 0.05, 0.05],loot: { iron_ore: 2 } },
  dark_spy:         { name: 'Шпион',             faction: 'villain', hp: 55,  dmg: 16, armor: 4,  agi: 10, spd: 7,  detectRange: 25, atkRange: 2,   color: [0.2, 0.0, 0.2],  loot: { dagger: 1, gold: 30 } },
  dark_lord_minion: { name: 'Прислужник Лорда',  faction: 'villain', hp: 180, dmg: 26, armor: 14, agi: 8,  spd: 5,  detectRange: 20, atkRange: 2.5, color: [0.6, 0.0, 0.0],  loot: { dark_armor: 1, gold: 50 } },
  neutral_bandit:   { name: 'Разбойник',         faction: 'neutral', hp: 70,  dmg: 12, armor: 3,  agi: 7,  spd: 4,  detectRange: 14, atkRange: 2.5, color: [0.5, 0.35, 0.1], loot: { gold: 25, dagger: 1 } },
  korovan_guard:    { name: 'Охранник каравана', faction: 'neutral', hp: 80,  dmg: 14, armor: 8,  agi: 6,  spd: 6,  detectRange: 20, atkRange: 2.5, color: [0.55, 0.45, 0.25], loot: { gold: 10 } },
}

// Спаун-данные врагов (координаты привязаны к центрам поселений)
const _elf = SETTLEMENTS.elf_village.center
const _pal = SETTLEMENTS.palace.center
const _fortSpawn = SETTLEMENTS.fort.spawnPos // за стенами, на ровной земле
const _fortGate = [SETTLEMENTS.fort.center[0], SETTLEMENTS.fort.center[1] - SETTLEMENTS.fort.wallOffset] // ворота

export const ENEMY_SPAWNS = [
  { type: 'elf_warrior',      cx: _elf[0],      cy: _elf[1],      count: 4 },
  { type: 'elf_archer',       cx: _elf[0] + 20, cy: _elf[1] - 20, count: 3 },
  { type: 'palace_guard',     cx: _pal[0],      cy: _pal[1],      count: 5 },
  { type: 'palace_captain',   cx: _pal[0],      cy: _pal[1] - 5,  count: 1 },
  { type: 'dark_soldier',     cx: _fortSpawn[0],      cy: _fortSpawn[1],      count: 2, spread: 15 },
  { type: 'dark_soldier',     cx: _fortGate[0],       cy: _fortGate[1] - 5,   count: 2, spread: 5 },
  { type: 'dark_spy',         cx: _fortSpawn[0] - 5,  cy: _fortSpawn[1] + 10, count: 2, spread: 12 },
  { type: 'dark_lord_minion', cx: _fortGate[0],       cy: _fortGate[1] - 3,   count: 1, spread: 3 },
  { type: 'neutral_bandit',   cx: 50,  cy: -50, count: 3 },
  { type: 'neutral_bandit',   cx: -50, cy: 50,  count: 2 },
]

// Маршруты корованов — индексы вейпоинтов в MAIN_ROAD_WAYPOINTS
// Корованы ездят по главной дороге, при достижении конца разворачиваются
export const KOROVAN_ROUTES = [
  { startWP: 0,  endWP: 18, name: 'Большой тракт (эльфы↔дворец)' },
  { startWP: 18, endWP: 0,  name: 'Большой тракт (дворец↔эльфы)' },
  { startWP: 0,  endWP: 9,  name: 'Лесной путь (эльфы↔форт)' },
  { startWP: 18, endWP: 9,  name: 'Имперский тракт (дворец↔форт)' },
  { startWP: 9,  endWP: 18, name: 'Торговый путь (форт↔дворец)' },
]

// Цвета неба по зонам (плавно интерполируются по позиции игрока)
export const SKY_COLORS = {
  elves:   { top: [0.26, 0.55, 0.84], horizon: [0.52, 0.74, 0.65], bg: [0.40, 0.62, 0.85] },
  guards:  { top: [0.26, 0.54, 0.92], horizon: [0.62, 0.82, 0.98], bg: [0.45, 0.65, 0.90] },
  villain: { top: [0.03, 0.01, 0.01], horizon: [0.12, 0.04, 0.02], bg: [0.06, 0.02, 0.02] },
  neutral: { top: [0.30, 0.55, 0.88], horizon: [0.58, 0.78, 0.92], bg: [0.50, 0.68, 0.88] },
}

// Получить интерполированные цвета неба по game-координатам
export function getSkyColorsAt(x, y) {
  // Расстояния до центров зон (из SETTLEMENTS через ZONES)
  const ec = ZONES.elf_zone.center, pc = ZONES.palace_zone.center, vc = ZONES.villain_zone.center
  const elfDist = Math.sqrt((x - ec[0]) ** 2 + (y - ec[1]) ** 2)
  const palaceDist = Math.sqrt((x - pc[0]) ** 2 + (y - pc[1]) ** 2)
  const villainDist = Math.sqrt((x - vc[0]) ** 2 + (y - vc[1]) ** 2)

  // Веса: обратная дистанция с затуханием (чем ближе, тем больше влияние)
  const radius = 200 // радиус полного влияния зоны
  const elfW = Math.max(0, 1 - elfDist / radius)
  const palW = Math.max(0, 1 - palaceDist / radius)
  const vilW = Math.max(0, 1 - villainDist / (radius * 0.8)) // мрачное небо дальше расползается
  const neuW = Math.max(0.05, 1 - Math.max(elfW, palW, vilW)) // нейтральный — всё остальное

  const total = elfW + palW + vilW + neuW
  const we = elfW / total, wp = palW / total, wv = vilW / total, wn = neuW / total

  const mix = (arr) => {
    const e = SKY_COLORS.elves[arr], p = SKY_COLORS.guards[arr], v = SKY_COLORS.villain[arr], n = SKY_COLORS.neutral[arr]
    return [
      e[0] * we + p[0] * wp + v[0] * wv + n[0] * wn,
      e[1] * we + p[1] * wp + v[1] * wv + n[1] * wn,
      e[2] * we + p[2] * wp + v[2] * wv + n[2] * wn,
    ]
  }
  return { top: mix('top'), horizon: mix('horizon'), bg: mix('bg') }
}

// Цвета тумана по зонам
export const FOG_SETTINGS = {
  elves:   { color: [0.40, 0.60, 0.50], near: 80, far: 350 },
  guards:  { color: [0.60, 0.75, 0.90], near: 100, far: 450 },
  villain: { color: [0.05, 0.02, 0.02], near: 30, far: 150 },
  neutral: { color: [0.55, 0.68, 0.80], near: 90, far: 400 },
}

export function getFogAt(x, y) {
  const ec = ZONES.elf_zone.center, pc = ZONES.palace_zone.center, vc = ZONES.villain_zone.center
  const elfDist = Math.sqrt((x - ec[0]) ** 2 + (y - ec[1]) ** 2)
  const palaceDist = Math.sqrt((x - pc[0]) ** 2 + (y - pc[1]) ** 2)
  const villainDist = Math.sqrt((x - vc[0]) ** 2 + (y - vc[1]) ** 2)
  const radius = 200
  const elfW = Math.max(0, 1 - elfDist / radius)
  const palW = Math.max(0, 1 - palaceDist / radius)
  const vilW = Math.max(0, 1 - villainDist / (radius * 0.8))
  const neuW = Math.max(0.05, 1 - Math.max(elfW, palW, vilW))
  const total = elfW + palW + vilW + neuW
  const we = elfW / total, wp = palW / total, wv = vilW / total, wn = neuW / total
  const fe = FOG_SETTINGS.elves, fp = FOG_SETTINGS.guards, fv = FOG_SETTINGS.villain, fn = FOG_SETTINGS.neutral
  return {
    color: [
      fe.color[0]*we + fp.color[0]*wp + fv.color[0]*wv + fn.color[0]*wn,
      fe.color[1]*we + fp.color[1]*wp + fv.color[1]*wv + fn.color[1]*wn,
      fe.color[2]*we + fp.color[2]*wp + fv.color[2]*wv + fn.color[2]*wn,
    ],
    near: fe.near*we + fp.near*wp + fv.near*wv + fn.near*wn,
    far: fe.far*we + fp.far*wp + fv.far*wv + fn.far*wn,
  }
}

// Определить зону по координатам
export function getZoneAt(x, y) {
  if (x < -100 && y < -100) return 'elf_zone'
  if (x > 100 && y > 100) return 'palace_zone'
  if (Math.sqrt(x * x + y * y) < 70) return 'villain_zone'
  return 'human_zone'
}
