"""Инвентарь персонажа."""
from game.factions import ITEMS


class Inventory:
    def __init__(self, gold=0, max_weight=100):
        self.items = {}          # {item_id: count}
        self.gold = gold
        self.max_weight = max_weight
        self.equipped_weapon = None
        self.equipped_armor = None

    # ------------------------------------------------------------------
    def add_item(self, item_id, count=1):
        if item_id not in ITEMS:
            return False, f'Неизвестный предмет: {item_id}'
        self.items[item_id] = self.items.get(item_id, 0) + count
        name = ITEMS[item_id]['name']
        return True, f'Получено: {name} x{count}'

    def remove_item(self, item_id, count=1):
        if self.items.get(item_id, 0) < count:
            return False, 'Недостаточно предметов'
        self.items[item_id] -= count
        if self.items[item_id] == 0:
            del self.items[item_id]
        return True, 'Предмет убран'

    def has_item(self, item_id, count=1):
        return self.items.get(item_id, 0) >= count

    # ------------------------------------------------------------------
    def equip_weapon(self, item_id):
        if not self.has_item(item_id):
            return False, 'Предмет не в инвентаре'
        data = ITEMS.get(item_id, {})
        if data.get('type') != 'weapon':
            return False, 'Это не оружие'
        self.equipped_weapon = item_id
        return True, f'Экипировано: {data["name"]}'

    def equip_armor(self, item_id):
        if not self.has_item(item_id):
            return False, 'Предмет не в инвентаре'
        data = ITEMS.get(item_id, {})
        if data.get('type') != 'armor':
            return False, 'Это не броня'
        self.equipped_armor = item_id
        return True, f'Надето: {data["name"]}'

    # ------------------------------------------------------------------
    def get_weapon_damage(self):
        if self.equipped_weapon:
            return ITEMS[self.equipped_weapon].get('damage', 10)
        return 8  # Кулаки

    def get_armor_defense(self):
        if self.equipped_armor:
            return ITEMS[self.equipped_armor].get('defense', 0)
        return 0

    def get_weapon_name(self):
        if self.equipped_weapon:
            return ITEMS[self.equipped_weapon]['name']
        return 'Кулаки'

    def get_armor_name(self):
        if self.equipped_armor:
            return ITEMS[self.equipped_armor]['name']
        return 'Без брони'

    # ------------------------------------------------------------------
    def use_consumable(self, item_id, body_system):
        """Использовать расходник. Возвращает (hp_healed, message)."""
        data = ITEMS.get(item_id, {})
        if data.get('type') != 'consumable':
            return 0, 'Нельзя использовать'
        if not self.has_item(item_id):
            return 0, 'Предмет не найден'

        heal = data.get('heal', 0)
        if heal > 0:
            body_system.apply_treatment(item_id, heal)
        self.remove_item(item_id)
        return heal, f'Использовано: {data["name"]} (+{heal} HP)'

    # ------------------------------------------------------------------
    def total_value(self):
        total = self.gold
        for item_id, count in self.items.items():
            total += ITEMS.get(item_id, {}).get('price', 0) * count
        return total

    def item_list_text(self):
        lines = [f'  Золото: {self.gold}']
        if self.equipped_weapon:
            lines.append(f'  [Оружие] {self.get_weapon_name()}')
        if self.equipped_armor:
            lines.append(f'  [Броня]  {self.get_armor_name()}')
        lines.append('  Инвентарь:')
        for item_id, count in self.items.items():
            name = ITEMS.get(item_id, {}).get('name', item_id)
            lines.append(f'    {name} x{count}')
        return '\n'.join(lines)

    # ------------------------------------------------------------------
    def to_dict(self):
        return {
            'items': dict(self.items),
            'gold': self.gold,
            'equipped_weapon': self.equipped_weapon,
            'equipped_armor': self.equipped_armor,
        }

    def from_dict(self, data):
        self.items = data.get('items', {})
        self.gold = data.get('gold', 0)
        self.equipped_weapon = data.get('equipped_weapon')
        self.equipped_armor = data.get('equipped_armor')
