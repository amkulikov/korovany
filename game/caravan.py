"""Торговые каравАны — можно грабить."""
import random
import math
from game.factions import ITEMS


class Caravan:
    """
    КаравАн движется по заданному маршруту между точками.
    Охраняется стражей. Можно атаковать и ограбить.
    """

    ROUTES = [
        # (start_x, start_y, end_x, end_y, name)
        (-50,  -50,  200,  200, 'Торговый путь Север-Юг'),
        (200,  -50, -200,   50, 'Западный тракт'),
        (-100, 150,  150, -150, 'Путь специй'),
        (  0,    0,  280,  280, 'Имперский тракт'),
        (  0,    0, -280, -280, 'Эльфийская дорога'),
    ]

    def __init__(self, caravan_id, difficulty=1.0):
        self.id = caravan_id
        self.difficulty = difficulty
        route = random.choice(self.ROUTES)
        self.route_name = route[4]
        self.start = (route[0], route[1])
        self.end = (route[2], route[3])
        self.name = f'КаравАн {caravan_id}'

        # Позиция
        self.x, self.y = self.start
        self.speed = random.uniform(4, 8)

        # Состояние
        self.alive = True
        self.looted = False
        self.hp = int(50 * difficulty)
        self.max_hp = self.hp
        self.guards = int(3 * difficulty)   # Количество охранников
        self.guard_hp = 60
        self.guard_damage = 12
        self.guard_armor = 8

        # Товары
        self._generate_goods()

    def _generate_goods(self):
        self.goods = {}
        self.gold = random.randint(40, 200)
        num_types = random.randint(2, 5)
        trade_items = [k for k, v in ITEMS.items() if v.get('type') == 'trade']
        for _ in range(num_types):
            item_id = random.choice(trade_items)
            qty = random.randint(3, 15)
            self.goods[item_id] = self.goods.get(item_id, 0) + qty

    # ------------------------------------------------------------------
    def update(self, dt):
        if not self.alive:
            return
        # Движение к конечной точке
        dx = self.end[0] - self.x
        dy = self.end[1] - self.y
        dist = math.sqrt(dx*dx + dy*dy)
        if dist < 5:
            # Достиг конца — разворачивается
            self.start, self.end = self.end, self.start
        else:
            self.x += (dx / dist) * self.speed * dt
            self.y += (dy / dist) * self.speed * dt

    def distance_to(self, px, py):
        return math.sqrt((self.x - px)**2 + (self.y - py)**2)

    # ------------------------------------------------------------------
    def attack(self, player_damage, player_agility):
        """Игрок атакует каравАн. Возвращает (loot_dict, gold, messages)."""
        from game.combat import resolve_attack
        messages = []

        if self.looted:
            return {}, 0, ['КаравАн уже ограблен']

        # Сначала нужно победить охрану
        if self.guards > 0:
            # Атака игрока по охраннику
            dmg, hit, crit, _ = resolve_attack(
                player_damage, player_agility,
                self.guard_armor, 5
            )
            if hit:
                self.guard_hp -= dmg
                msg = f'Удар по охраннику: {dmg} урона'
                if crit:
                    msg += ' [КРИТ!]'
                messages.append(msg)
                if self.guard_hp <= 0:
                    self.guards -= 1
                    self.guard_hp = 60
                    messages.append(f'Охранник убит! Осталось: {self.guards}')

            # Контратака охраны
            if self.guards > 0:
                counter_dmg = self.guard_damage * self.guards
                messages.append(f'Охрана атакует в ответ: возможный урон {counter_dmg}')
                return {}, 0, messages   # Бой продолжается

        # Все охранники побеждены — грабим!
        self.looted = True
        self.alive = False
        loot = dict(self.goods)
        gold = self.gold
        messages.append(f'КаравАн ограблен! Получено: {gold} золота')
        for item_id, qty in loot.items():
            name = ITEMS[item_id]['name']
            messages.append(f'  + {name} x{qty}')
        return loot, gold, messages

    def guard_counter_attack(self):
        """Ответная атака охраны (вызывается в engine)."""
        if self.guards <= 0 or self.looted:
            return 0
        dmg = self.guard_damage + random.randint(-3, 5)
        return dmg * max(1, self.guards // 2)

    # ------------------------------------------------------------------
    def info_text(self):
        lines = [
            f'=== {self.name} ===',
            f'Маршрут: {self.route_name}',
            f'Охрана: {self.guards} чел.',
            f'Товары:',
        ]
        for item_id, qty in self.goods.items():
            name = ITEMS[item_id]['name']
            lines.append(f'  {name} x{qty}')
        lines.append(f'Золото: {self.gold}')
        return '\n'.join(lines)
