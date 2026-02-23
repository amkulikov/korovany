"""Данные фракций и предметов."""

FACTIONS = {
    'elves': {
        'name': 'Лесные эльфы',
        'desc': 'Живут в густом лесу. Быстрые и ловкие.\nЗащищай лес, грабь корованы, отражай набеги.',
        'zone': 'elf_zone',
        'start_pos': (-250, -250, 5),
        'color': (0.15, 0.7, 0.15, 1),
        'enemies': ['guards', 'villain'],
        'allies': [],
        'neutral': ['humans'],
        'objectives': [
            'Защищай лес от солдат дворца',
            'Грабь купеческие корованы',
            'Отражай набеги злодея',
            'Развивай деревню эльфов',
        ],
        'start_stats': {
            'max_hp': 120, 'strength': 7, 'agility': 10,
            'intelligence': 8, 'gold': 50, 'armor': 5,
        },
    },
    'guards': {
        'name': 'Охрана дворца',
        'desc': 'Элитные солдаты императора. Сильные и дисциплинированные.\nЗащищай дворец, уничтожай шпионов, ходи в рейды.',
        'zone': 'palace_zone',
        'start_pos': (250, 250, 5),
        'color': (0.15, 0.15, 0.8, 1),
        'enemies': ['villain', 'elves'],
        'allies': ['humans'],
        'neutral': [],
        'objectives': [
            'Защищай дворец императора',
            'Уничтожай шпионов злодея',
            'Выполняй приказы командира',
            'Ходи в рейды на врагов',
        ],
        'start_stats': {
            'max_hp': 160, 'strength': 9, 'agility': 7,
            'intelligence': 6, 'gold': 100, 'armor': 20,
        },
    },
    'villain': {
        'name': 'Тёмный Лорд',
        'desc': 'Могущественный злодей в горном форту. Командир армии.\nСобирай войска, шли шпионов, захвати трон!',
        'zone': 'villain_zone',
        'start_pos': (0, 0, 60),
        'color': (0.7, 0.05, 0.05, 1),
        'enemies': ['guards'],
        'allies': [],
        'neutral': ['elves'],
        'objectives': [
            'Собирай армию тёмных сил',
            'Шли шпионов во дворец',
            'Нападай на дворец императора',
            'Захвати трон и стань императором',
        ],
        'start_stats': {
            'max_hp': 200, 'strength': 10, 'agility': 8,
            'intelligence': 9, 'gold': 200, 'armor': 15,
        },
    },
}

ITEMS = {
    # Оружие
    'sword':        {'name': 'Меч',           'type': 'weapon',     'damage': 25, 'speed': 1.0,  'price': 150},
    'dagger':       {'name': 'Кинжал',        'type': 'weapon',     'damage': 12, 'speed': 1.8,  'price': 60},
    'axe':          {'name': 'Топор',          'type': 'weapon',     'damage': 35, 'speed': 0.7,  'price': 200},
    'bow':          {'name': 'Лук',            'type': 'weapon',     'damage': 18, 'range': 40,   'price': 100},
    'spear':        {'name': 'Копьё',          'type': 'weapon',     'damage': 28, 'speed': 0.9,  'price': 120},
    'staff':        {'name': 'Посох',          'type': 'weapon',     'damage': 15, 'magic': True, 'price': 200},
    'elven_blade':  {'name': 'Эльфийский клинок','type': 'weapon',  'damage': 22, 'speed': 1.5,  'price': 300},
    'dark_sword':   {'name': 'Тёмный меч',    'type': 'weapon',     'damage': 40, 'speed': 0.8,  'price': 500},

    # Броня
    'leather_armor': {'name': 'Кожаный доспех', 'type': 'armor', 'defense': 10, 'price': 80},
    'chain_mail':    {'name': 'Кольчуга',        'type': 'armor', 'defense': 20, 'price': 200},
    'plate_armor':   {'name': 'Латный доспех',   'type': 'armor', 'defense': 35, 'price': 500},
    'elven_armor':   {'name': 'Эльфийский доспех','type': 'armor', 'defense': 15, 'agility_bonus': 2, 'price': 350},
    'dark_armor':    {'name': 'Тёмный доспех',   'type': 'armor', 'defense': 30, 'price': 450},

    # Протезы
    'wooden_arm':   {'name': 'Деревянная рука', 'type': 'prosthetic', 'slot': 'arm', 'price': 80},
    'iron_arm':     {'name': 'Железная рука',   'type': 'prosthetic', 'slot': 'arm', 'price': 300},
    'wooden_leg':   {'name': 'Деревянная нога', 'type': 'prosthetic', 'slot': 'leg', 'price': 100},
    'iron_leg':     {'name': 'Железная нога',   'type': 'prosthetic', 'slot': 'leg', 'price': 350},
    'glass_eye':    {'name': 'Стеклянный глаз', 'type': 'prosthetic', 'slot': 'eye', 'price': 150},

    # Расходники
    'healing_potion': {'name': 'Зелье лечения',   'type': 'consumable', 'heal': 50,  'price': 40},
    'bandage':        {'name': 'Бинт',             'type': 'consumable', 'heal': 20,  'price': 10},
    'strong_potion':  {'name': 'Сильное зелье',    'type': 'consumable', 'heal': 100, 'price': 100},
    'antidote':       {'name': 'Противоядие',      'type': 'consumable', 'effect': 'cure_poison', 'price': 30},

    # Товары для торговли
    'grain':    {'name': 'Зерно',       'type': 'trade', 'price': 5},
    'spices':   {'name': 'Специи',      'type': 'trade', 'price': 50},
    'silk':     {'name': 'Шёлк',        'type': 'trade', 'price': 80},
    'iron_ore': {'name': 'Железо',      'type': 'trade', 'price': 15},
    'gems':     {'name': 'Самоцветы',   'type': 'trade', 'price': 200},
    'timber':   {'name': 'Лесоматериал','type': 'trade', 'price': 12},
    'furs':     {'name': 'Меха',        'type': 'trade', 'price': 70},
    'ale':      {'name': 'Эль',         'type': 'trade', 'price': 8},
}

ZONE_DATA = {
    'human_zone': {
        'name': 'Людские земли',
        'color': (0.8, 0.75, 0.5),
        'center': (0, 0),
        'radius': 120,
        'description': 'Нейтральная торговая зона',
        'has_market': True,
        'market_items': list(ITEMS.keys()),
    },
    'palace_zone': {
        'name': 'Земли Императора',
        'color': (0.5, 0.5, 0.9),
        'center': (280, 280),
        'radius': 150,
        'description': 'Резиденция императора и его гвардии',
        'has_market': True,
        'market_items': ['sword', 'axe', 'chain_mail', 'plate_armor', 'healing_potion', 'bandage'],
    },
    'elf_zone': {
        'name': 'Эльфийский лес',
        'color': (0.1, 0.5, 0.1),
        'center': (-280, -280),
        'radius': 150,
        'description': 'Густой непроходимый лес, дом эльфов',
        'has_market': True,
        'market_items': ['elven_blade', 'elven_armor', 'bow', 'healing_potion', 'antidote', 'furs', 'timber'],
    },
    'villain_zone': {
        'name': 'Горы Тьмы',
        'color': (0.3, 0.1, 0.1),
        'center': (0, 0),   # mountain center
        'radius': 130,
        'description': 'Горный форт тёмного лорда',
        'has_market': True,
        'market_items': ['dark_sword', 'dark_armor', 'strong_potion', 'iron_ore', 'gems'],
    },
}
