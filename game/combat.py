"""Система боя."""
import random


def resolve_attack(attacker_dmg, attacker_agility, target_armor, target_agility):
    """
    Рассчитать результат атаки.
    Возвращает (damage_dealt, hit, crit, target_part).
    """
    # Шанс уклонения зависит от ловкости защитника
    dodge_chance = min(0.4, target_agility * 0.03)
    if random.random() < dodge_chance:
        return 0, False, False, None   # Уклонился

    # Критический удар
    crit = random.random() < 0.1
    base_dmg = attacker_dmg * (2.0 if crit else 1.0)

    # Снижение от брони
    effective_dmg = max(1, int(base_dmg - target_armor + random.randint(-3, 3)))

    # Целевая часть тела
    target_part = _random_target_part(attacker_agility)

    return effective_dmg, True, crit, target_part


def _random_target_part(attacker_agility):
    """
    Более ловкий атакующий имеет больший шанс ударить по уязвимым местам.
    """
    aimed_chance = min(0.35, attacker_agility * 0.03)
    if random.random() < aimed_chance:
        # Прицельный удар: голова, руки, ноги, глаза
        aimed_parts = ['head', 'right_arm', 'left_arm', 'right_leg', 'left_leg',
                        'right_eye', 'left_eye']
        weights = [20, 15, 15, 15, 15, 10, 10]
        return random.choices(aimed_parts, weights=weights)[0]
    # Обычный удар — преимущественно туловище
    parts = ['torso', 'torso', 'torso', 'head', 'right_arm', 'left_arm',
             'right_leg', 'left_leg']
    return random.choice(parts)


# ---------------------------------------------------------------------------
class CombatLog:
    """Лог боевых сообщений (последние N строк)."""

    def __init__(self, max_lines=8):
        self.lines = []
        self.max_lines = max_lines

    def add(self, msg):
        self.lines.append(msg)
        if len(self.lines) > self.max_lines:
            self.lines.pop(0)

    def clear(self):
        self.lines.clear()

    def get_text(self):
        return '\n'.join(self.lines)


# ---------------------------------------------------------------------------
# Формат атакующего / цели для нпс-vs-нпс боёв
# ---------------------------------------------------------------------------

def npc_vs_npc(attacker, defender):
    """
    Упрощённый бой NPC против NPC.
    attacker/defender: dict с ключами 'damage', 'armor', 'agility', 'hp'
    Возвращает (damage, killed).
    """
    dmg_dealt, hit, crit, _ = resolve_attack(
        attacker['damage'], attacker['agility'],
        defender['armor'], defender['agility']
    )
    if hit:
        defender['hp'] = max(0, defender['hp'] - dmg_dealt)
    killed = defender['hp'] <= 0
    return dmg_dealt if hit else 0, killed
