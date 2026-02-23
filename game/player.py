"""Класс игрока."""
from game.body_parts import BodySystem
from game.inventory import Inventory
from game.factions import FACTIONS


class Player:
    """Данные и логика игрока (без привязки к движку)."""

    def __init__(self, faction_id='elves'):
        self.faction_id = faction_id
        faction = FACTIONS[faction_id]
        stats = faction['start_stats']

        # Позиция (синхронизируется с NodePath в движке)
        start = faction['start_pos']
        self.pos_x, self.pos_y, self.pos_z = start
        self.heading = 0.0      # Угол поворота (градусы)
        self.pitch = 0.0

        # Основные характеристики
        self.max_hp = stats['max_hp']
        self.hp = self.max_hp
        self.strength = stats['strength']
        self.agility = stats['agility']
        self.intelligence = stats['intelligence']
        self.base_armor = stats.get('armor', 0)

        # Системы
        self.body = BodySystem()
        self.inventory = Inventory(gold=stats['gold'])

        # Состояния
        self.is_dead = False
        self.in_wheelchair = False
        self.is_sneaking = False
        self.is_jumping = False
        self.jump_vel = 0.0

        # Статистика
        self.kills = 0
        self.play_time = 0.0     # Секунды
        self.quests_completed = []
        self.reputation = {
            'humans': 0, 'elves': 0, 'guards': 0, 'villain': 0,
        }

        # Боевое состояние
        self.attack_cooldown = 0.0
        self.hurt_timer = 0.0    # Время мигания при ударе
        self.bleed_timer = 0.0   # Тик кровотечения

    # ------------------------------------------------------------------
    # Движение
    # ------------------------------------------------------------------
    def move_speed(self):
        base = 15.0 * (self.agility / 10.0)
        base *= self.body.movement_multiplier()
        if self.is_sneaking:
            base *= 0.4
        return base

    def jump(self):
        if not self.is_jumping and self.body.movement_multiplier() > 0.15:
            self.is_jumping = True
            self.jump_vel = 14.0

    def update_jump(self, dt):
        if self.is_jumping:
            self.pos_z += self.jump_vel * dt
            self.jump_vel -= 30.0 * dt  # Гравитация
            if self.pos_z <= 5.0:
                self.pos_z = 5.0
                self.is_jumping = False
                self.jump_vel = 0.0

    # ------------------------------------------------------------------
    # Бой
    # ------------------------------------------------------------------
    def get_attack_damage(self):
        weapon_dmg = self.inventory.get_weapon_damage()
        bonus = (self.strength - 5) * 2
        import random
        return max(1, weapon_dmg + bonus + random.randint(-3, 3))

    def get_effective_armor(self):
        return self.base_armor + self.inventory.get_armor_defense()

    def take_damage(self, raw_damage, target_part=None):
        """
        Принять урон. Возвращает (actual_damage, events, messages).
        """
        armor = self.get_effective_armor()
        actual = max(1, raw_damage - armor)

        events, part_hit = self.body.take_hit(actual, target_part)
        messages = []

        self.hurt_timer = 0.3

        for event_type, part_name in events:
            if event_type == 'death':
                self.is_dead = True
                messages.append(f'СМЕРТЬ! Уничтожено: {part_name}')
            elif event_type == 'severed':
                messages.append(f'Отрублено: {part_name}!')
                self._on_severed(part_name)
            elif event_type == 'injured':
                messages.append(f'Ранено: {part_name}')
            elif event_type == 'bleeding':
                messages.append(f'Кровотечение: {part_name}')

        # Обновить общее HP
        self.hp = self.body.get_total_hp()
        if self.hp <= 0:
            self.is_dead = True

        return actual, events, messages

    def _on_severed(self, part_name):
        if part_name in ('right_leg', 'left_leg'):
            if self.body.needs_wheelchair():
                self.in_wheelchair = True

    def heal(self, amount):
        self.body.apply_treatment('bandage', amount)
        self.hp = min(self.max_hp, self.hp + amount)
        self.hp = self.body.get_total_hp()

    def tick(self, dt):
        """Игровой тик: кровотечение, таймеры."""
        self.play_time += dt
        self.attack_cooldown = max(0, self.attack_cooldown - dt)
        self.hurt_timer = max(0, self.hurt_timer - dt)

        # Кровотечение раз в секунду
        self.bleed_timer += dt
        if self.bleed_timer >= 1.0:
            self.bleed_timer = 0.0
            bleed_dmg = self.body.bleed_tick()
            if bleed_dmg > 0:
                self.hp = max(0, self.hp - bleed_dmg)
                if self.hp <= 0:
                    self.is_dead = True
                return bleed_dmg
        return 0

    # ------------------------------------------------------------------
    # Репутация и фракции
    # ------------------------------------------------------------------
    def change_reputation(self, faction, delta):
        self.reputation[faction] = self.reputation.get(faction, 0) + delta

    def is_hostile_to(self, faction_id):
        faction_data = FACTIONS.get(self.faction_id, {})
        return faction_id in faction_data.get('enemies', [])

    def is_allied_with(self, faction_id):
        faction_data = FACTIONS.get(self.faction_id, {})
        return faction_id in faction_data.get('allies', [])

    # ------------------------------------------------------------------
    def get_faction_name(self):
        return FACTIONS.get(self.faction_id, {}).get('name', '?')

    def get_objectives(self):
        return FACTIONS.get(self.faction_id, {}).get('objectives', [])

    def can_attack(self):
        return self.attack_cooldown <= 0 and self.body.can_fight() and not self.is_dead
