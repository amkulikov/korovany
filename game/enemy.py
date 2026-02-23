"""Враги и их ИИ — конечный автомат состояний."""
import random
import math


# ---------------------------------------------------------------------------
# Состояния ИИ
# ---------------------------------------------------------------------------
IDLE    = 'idle'
PATROL  = 'patrol'
ALERT   = 'alert'
CHASE   = 'chase'
ATTACK  = 'attack'
DEAD    = 'dead'
FLEE    = 'flee'

ENEMY_TYPES = {
    'elf_warrior': {
        'name': 'Воин-эльф',    'faction': 'elves',
        'hp': 80,  'damage': 14, 'armor': 8,  'agility': 9,
        'speed': 14, 'detect_range': 18, 'attack_range': 2.5,
        'color': (0.1, 0.7, 0.1, 1), 'loot': {'furs': 1, 'timber': 1},
    },
    'elf_archer': {
        'name': 'Эльф-лучник',  'faction': 'elves',
        'hp': 60,  'damage': 18, 'armor': 4,  'agility': 10,
        'speed': 12, 'detect_range': 35, 'attack_range': 30,
        'color': (0.15, 0.6, 0.15, 1), 'loot': {'bow': 1},
    },
    'palace_guard': {
        'name': 'Гвардеец',     'faction': 'guards',
        'hp': 110, 'damage': 18, 'armor': 20, 'agility': 6,
        'speed': 10, 'detect_range': 15, 'attack_range': 2.5,
        'color': (0.15, 0.15, 0.8, 1), 'loot': {'gold': 20, 'sword': 1},
    },
    'palace_captain': {
        'name': 'Капитан гвардии', 'faction': 'guards',
        'hp': 180, 'damage': 28, 'armor': 30, 'agility': 7,
        'speed': 11, 'detect_range': 20, 'attack_range': 3,
        'color': (0.0, 0.0, 0.6, 1), 'loot': {'gold': 80, 'chain_mail': 1},
    },
    'dark_soldier': {
        'name': 'Тёмный солдат', 'faction': 'villain',
        'hp': 90,  'damage': 20, 'armor': 15, 'agility': 7,
        'speed': 11, 'detect_range': 16, 'attack_range': 2.5,
        'color': (0.5, 0.05, 0.05, 1), 'loot': {'iron_ore': 2},
    },
    'dark_spy': {
        'name': 'Шпион',        'faction': 'villain',
        'hp': 55,  'damage': 22, 'armor': 5,  'agility': 10,
        'speed': 16, 'detect_range': 25, 'attack_range': 2,
        'color': (0.2, 0.0, 0.2, 1), 'loot': {'dagger': 1, 'gold': 30},
    },
    'dark_lord_minion': {
        'name': 'Прислужник Лорда', 'faction': 'villain',
        'hp': 150, 'damage': 25, 'armor': 20, 'agility': 8,
        'speed': 12, 'detect_range': 20, 'attack_range': 2.5,
        'color': (0.6, 0.0, 0.0, 1), 'loot': {'dark_armor': 1, 'gold': 50},
    },
    'neutral_bandit': {
        'name': 'Разбойник',    'faction': 'neutral',
        'hp': 70,  'damage': 15, 'armor': 5,  'agility': 7,
        'speed': 8, 'detect_range': 14, 'attack_range': 2.5,
        'color': (0.5, 0.35, 0.1, 1), 'loot': {'gold': 25, 'dagger': 1},
    },
}


class Enemy:
    """Один враг на сцене."""

    _id_counter = 0

    def __init__(self, enemy_type, x, y, z=5.0):
        Enemy._id_counter += 1
        self.id = Enemy._id_counter

        self.type_id = enemy_type
        data = ENEMY_TYPES.get(enemy_type, ENEMY_TYPES['neutral_bandit'])
        self.name = data['name']
        self.faction = data['faction']
        self.max_hp = data['hp']
        self.hp = self.max_hp
        self.damage = data['damage']
        self.armor = data['armor']
        self.agility = data['agility']
        self.speed = data['speed']
        self.detect_range = data['detect_range']
        self.attack_range = data['attack_range']
        self.loot = dict(data.get('loot', {}))
        self.color = data.get('color', (1, 1, 1, 1))

        # Позиция
        self.x, self.y, self.z = x, y, z
        self.heading = random.uniform(0, 360)

        # ИИ-состояние
        self.state = PATROL
        self.state_timer = 0.0
        self.attack_cooldown = 0.0
        self.alert_timer = 0.0

        # Патруль
        self.patrol_center = (x, y)
        self.patrol_radius = random.uniform(8, 20)
        self.patrol_target_x = x
        self.patrol_target_y = y
        self._pick_patrol_target()

        # Визуальные
        self.node_path = None      # Установится в engine
        self.corpse = False

    # ------------------------------------------------------------------
    def update(self, dt, player_x, player_y, player_dead, hostile):
        """Обновить ИИ. Возвращает ('attack', damage) или None."""
        if self.state == DEAD:
            return None

        self.attack_cooldown = max(0, self.attack_cooldown - dt)
        self.state_timer += dt

        dist = self._dist(player_x, player_y)

        # --- Обнаружение игрока ---
        if hostile and dist < self.detect_range and not player_dead:
            if self.state in (PATROL, IDLE, ALERT):
                self.state = CHASE
                self.alert_timer = 0

        # --- Машина состояний ---
        if self.state == PATROL:
            self._do_patrol(dt)
        elif self.state == ALERT:
            self._do_alert(dt)
        elif self.state == CHASE:
            result = self._do_chase(dt, player_x, player_y, dist)
            if result:
                return result
        elif self.state == FLEE:
            self._do_flee(dt, player_x, player_y)

        # Если игрок ушёл далеко — вернуться к патрулю
        if self.state == CHASE and dist > self.detect_range * 2:
            self.state = PATROL

        return None

    # ------------------------------------------------------------------
    def _do_patrol(self, dt):
        tx, ty = self.patrol_target_x, self.patrol_target_y
        dx, dy = tx - self.x, ty - self.y
        dist = math.sqrt(dx*dx + dy*dy)
        if dist < 1.0:
            self._pick_patrol_target()
        else:
            move = self.speed * 0.5 * dt
            self.x += (dx / dist) * move
            self.y += (dy / dist) * move
            self.heading = math.degrees(math.atan2(dx, dy))

    def _pick_patrol_target(self):
        angle = random.uniform(0, 2 * math.pi)
        r = random.uniform(0, self.patrol_radius)
        self.patrol_target_x = self.patrol_center[0] + math.cos(angle) * r
        self.patrol_target_y = self.patrol_center[1] + math.sin(angle) * r

    def _do_alert(self, dt):
        self.alert_timer += dt
        if self.alert_timer > 3.0:
            self.state = PATROL

    def _do_chase(self, dt, px, py, dist):
        dx, dy = px - self.x, py - self.y
        # Останавливаемся у края attack_range — персонажи не сливаются текстурами
        min_gap = self.attack_range * 0.85
        if dist > min_gap:
            move = min(self.speed * dt, dist - min_gap)
            self.x += (dx / dist) * move
            self.y += (dy / dist) * move
            self.heading = math.degrees(math.atan2(dx, dy))

        # Атака
        if dist <= self.attack_range and self.attack_cooldown <= 0:
            self.attack_cooldown = 1.5
            dmg = self.damage + random.randint(-3, 5)
            return ('attack', dmg)
        return None

    def _do_flee(self, dt, px, py):
        dx, dy = self.x - px, self.y - py
        dist = math.sqrt(dx*dx + dy*dy)
        if dist > 0.1:
            move = self.speed * 1.2 * dt
            self.x += (dx / dist) * move
            self.y += (dy / dist) * move

    # ------------------------------------------------------------------
    def take_damage(self, damage, target_part=None):
        from game.combat import resolve_attack
        dmg, hit, crit, part = resolve_attack(damage, 8, self.armor, self.agility)
        if hit:
            self.hp = max(0, self.hp - dmg)
            if self.hp <= 0:
                self.die()
                return dmg, True, crit, part
            # При низком HP — убегает
            if self.hp < self.max_hp * 0.2:
                self.state = FLEE
        return (dmg if hit else 0), self.hp <= 0, crit, part

    def die(self):
        self.state = DEAD
        self.corpse = True
        if self.node_path:
            try:
                # Визуально "опустить" труп (наклон)
                self.node_path.setR(90)
                self.node_path.setZ(0.5)
            except Exception:
                pass

    # ------------------------------------------------------------------
    def _dist(self, x, y):
        return math.sqrt((self.x - x)**2 + (self.y - y)**2)

    def get_loot(self):
        """Добыча после убийства."""
        gold = self.loot.pop('gold', 0)
        return dict(self.loot), gold
