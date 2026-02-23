"""Система ранений и протезов.

Каждая часть тела имеет своё HP.
При потере конечности — персонаж страдает: медленнее ходит, не видит и т.д.
Можно поставить протез или вылечиться.
"""
import random
from enum import Enum, auto


class Status(Enum):
    HEALTHY   = auto()   # Здорова
    INJURED   = auto()   # Ранена
    SEVERED   = auto()   # Утрачена (отрублена)
    PROSTHETIC = auto()  # Протез


class BodyPart:
    def __init__(self, name, max_hp, vital=False, prosthetic_slots=None):
        self.name = name
        self.max_hp = max_hp
        self.hp = max_hp
        self.vital = vital                       # Смерть при уничтожении
        self.prosthetic_slots = prosthetic_slots or []
        self.status = Status.HEALTHY
        self.prosthetic_type = None
        self.bleeding = False                    # Кровотечение

    # ------------------------------------------------------------------
    def take_damage(self, dmg):
        """Нанести урон. Возвращает список событий."""
        events = []
        if self.status == Status.SEVERED:
            return events  # Уже отрублена

        prev_hp = self.hp
        self.hp = max(0, self.hp - dmg)

        # Тяжёлое ранение → кровотечение
        if self.hp < self.max_hp * 0.25 and prev_hp >= self.max_hp * 0.25:
            self.bleeding = True
            events.append(('bleeding', self.name))

        # Утрата конечности (только не-жизненно-важные при 0 HP)
        if self.hp == 0:
            if self.vital:
                events.append(('death', self.name))
            else:
                self.status = Status.SEVERED
                self.bleeding = True
                events.append(('severed', self.name))
        elif self.hp < self.max_hp * 0.4:
            self.status = Status.INJURED
            events.append(('injured', self.name))

        return events

    def heal(self, amount):
        if self.status == Status.SEVERED:
            return False
        self.hp = min(self.max_hp, self.hp + amount)
        self.bleeding = False
        if self.hp >= self.max_hp * 0.9:
            self.status = Status.HEALTHY
        elif self.hp >= self.max_hp * 0.4:
            self.status = Status.INJURED
        return True

    def fit_prosthetic(self, item_type):
        if self.status != Status.SEVERED:
            return False, 'Часть тела не утрачена'
        if item_type not in self.prosthetic_slots:
            return False, f'{item_type} не подходит для {self.name}'
        self.status = Status.PROSTHETIC
        self.prosthetic_type = item_type
        self.bleeding = False
        return True, f'Установлен: {item_type}'

    @property
    def functional(self):
        return self.status in (Status.HEALTHY, Status.INJURED, Status.PROSTHETIC)

    def short_status(self):
        icons = {
            Status.HEALTHY:    '✓',
            Status.INJURED:    '~',
            Status.SEVERED:    'X',
            Status.PROSTHETIC: 'P',
        }
        return icons[self.status]

    def status_text(self):
        if self.status == Status.HEALTHY:
            return f'{self.name}: {self.hp}/{self.max_hp} OK'
        elif self.status == Status.INJURED:
            return f'{self.name}: {self.hp}/{self.max_hp} РАНЕНА'
        elif self.status == Status.SEVERED:
            return f'{self.name}: УТРАЧЕНА {"[кровотечение]" if self.bleeding else ""}'
        elif self.status == Status.PROSTHETIC:
            return f'{self.name}: Протез ({self.prosthetic_type})'


# ---------------------------------------------------------------------------
class BodySystem:
    """Полная система частей тела персонажа."""

    def __init__(self):
        self.parts = {
            'head':      BodyPart('Голова',       80,  vital=True),
            'torso':     BodyPart('Туловище',     200, vital=True),
            'right_arm': BodyPart('Правая рука',  70,  prosthetic_slots=['wooden_arm', 'iron_arm']),
            'left_arm':  BodyPart('Левая рука',   70,  prosthetic_slots=['wooden_arm', 'iron_arm']),
            'right_leg': BodyPart('Правая нога',  80,  prosthetic_slots=['wooden_leg', 'iron_leg']),
            'left_leg':  BodyPart('Левая нога',   80,  prosthetic_slots=['wooden_leg', 'iron_leg']),
            'right_eye': BodyPart('Правый глаз',  30,  prosthetic_slots=['glass_eye']),
            'left_eye':  BodyPart('Левый глаз',   30,  prosthetic_slots=['glass_eye']),
        }
        # Веса для случайного попадания (голова и туловище чаще)
        self._hit_weights = {
            'torso':     40,
            'head':      12,
            'right_arm': 10,
            'left_arm':  10,
            'right_leg': 10,
            'left_leg':  10,
            'right_eye': 4,
            'left_eye':  4,
        }

    # ------------------------------------------------------------------
    def take_hit(self, damage, target_part=None):
        """
        Нанести удар. target_part — конкретная часть или None (случайная).
        Возвращает (events, part_name).
        """
        if target_part is None:
            available = [p for p, part in self.parts.items() if not (part.status == Status.SEVERED and not part.vital)]
            weights = [self._hit_weights.get(p, 5) for p in available]
            target_part = random.choices(available, weights=weights)[0]

        part = self.parts.get(target_part, self.parts['torso'])
        events = part.take_damage(damage)
        return events, target_part

    def bleed_tick(self):
        """Кровотечение за тик. Возвращает общий урон от кровотечения."""
        total = 0
        for part in self.parts.values():
            if part.bleeding:
                total += 2
        return total

    def apply_treatment(self, item_type, heal_amount):
        """Лечение всех раненых частей."""
        healed = []
        for name, part in self.parts.items():
            if part.status in (Status.INJURED,) or part.bleeding:
                if part.heal(heal_amount):
                    healed.append(name)
        return healed

    def fit_prosthetic(self, item_type):
        """Подобрать подходящую утраченную часть и установить протез."""
        for name, part in self.parts.items():
            if part.status == Status.SEVERED and item_type in part.prosthetic_slots:
                ok, msg = part.fit_prosthetic(item_type)
                return ok, msg, name
        return False, 'Нет подходящей утраченной части тела', None

    # ------------------------------------------------------------------
    def is_alive(self):
        for part in self.parts.values():
            if part.vital and part.hp == 0:
                return False
        return True

    def movement_multiplier(self):
        """Скорость передвижения (0.1 — ползком, 1.0 — норма)."""
        legs_ok = sum(1 for k in ('right_leg', 'left_leg') if self.parts[k].functional)
        if legs_ok == 0:
            return 0.1   # Ползёт
        elif legs_ok == 1:
            return 0.5   # Хромает
        return 1.0

    def vision_multiplier(self):
        """Коэффициент обзора (0.3 — почти слеп)."""
        eyes_ok = sum(1 for k in ('right_eye', 'left_eye') if self.parts[k].functional)
        return 1.0 if eyes_ok == 2 else (0.6 if eyes_ok == 1 else 0.2)

    def can_fight(self):
        """Может ли драться (хоть одна рука)."""
        return self.parts['right_arm'].functional or self.parts['left_arm'].functional

    def is_crawling(self):
        return self.movement_multiplier() <= 0.15

    def needs_wheelchair(self):
        """Обе ноги утрачены, но нет протезов."""
        both_severed = all(
            self.parts[k].status == Status.SEVERED
            for k in ('right_leg', 'left_leg')
        )
        return both_severed

    def get_total_hp(self):
        """Суммарное HP жизненно-важных частей."""
        return sum(p.hp for p in self.parts.values() if p.vital)

    def get_max_total_hp(self):
        return sum(p.max_hp for p in self.parts.values() if p.vital)

    def get_status_lines(self):
        return [part.status_text() for part in self.parts.values()]

    def to_dict(self):
        result = {}
        for name, part in self.parts.items():
            result[name] = {
                'hp': part.hp,
                'status': part.status.name,
                'prosthetic_type': part.prosthetic_type,
                'bleeding': part.bleeding,
            }
        return result

    def from_dict(self, data):
        for name, d in data.items():
            if name in self.parts:
                part = self.parts[name]
                part.hp = d['hp']
                part.status = Status[d['status']]
                part.prosthetic_type = d['prosthetic_type']
                part.bleeding = d['bleeding']
