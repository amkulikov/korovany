"""Система торговли — как в Daggerfall."""
from game.factions import ITEMS, ZONE_DATA


class Market:
    """Рыночный торговец. Покупает и продаёт товары."""

    def __init__(self, zone_id, markup=1.3, sellback=0.6):
        zone = ZONE_DATA.get(zone_id, {})
        self.zone_name = zone.get('name', 'Рынок')
        self.markup = markup          # Наценка магазина
        self.sellback = sellback      # Процент выкупа у игрока

        # Товары в продаже {item_id: stock_count}
        self.stock = {}
        for item_id in zone.get('market_items', []):
            self.stock[item_id] = 10  # Стандартный запас

    # ------------------------------------------------------------------
    def buy_price(self, item_id):
        """Цена покупки у торговца."""
        base = ITEMS.get(item_id, {}).get('price', 0)
        return int(base * self.markup)

    def sell_price(self, item_id):
        """Цена продажи игроком торговцу."""
        base = ITEMS.get(item_id, {}).get('price', 0)
        return int(base * self.sellback)

    # ------------------------------------------------------------------
    def player_buy(self, inventory, item_id, count=1):
        """Игрок покупает у торговца."""
        if item_id not in self.stock:
            return False, 'Товар недоступен'
        if self.stock[item_id] < count:
            return False, f'В наличии только: {self.stock[item_id]}'

        total_price = self.buy_price(item_id) * count
        if inventory.gold < total_price:
            return False, f'Не хватает золота ({total_price} нужно, {inventory.gold} есть)'

        inventory.gold -= total_price
        ok, msg = inventory.add_item(item_id, count)
        if ok:
            self.stock[item_id] -= count
        return ok, msg

    def player_sell(self, inventory, item_id, count=1):
        """Игрок продаёт торговцу."""
        if not inventory.has_item(item_id, count):
            return False, 'Предмет не в инвентаре'

        total_price = self.sell_price(item_id) * count
        ok, msg = inventory.remove_item(item_id, count)
        if ok:
            inventory.gold += total_price
            self.stock[item_id] = self.stock.get(item_id, 0) + count
            name = ITEMS[item_id]['name']
            return True, f'Продано: {name} x{count} за {total_price} золота'
        return ok, msg

    # ------------------------------------------------------------------
    def get_catalog_text(self):
        lines = [f'=== {self.zone_name} ===']
        for item_id, stock in self.stock.items():
            if stock > 0:
                data = ITEMS.get(item_id, {})
                name = data.get('name', item_id)
                price = self.buy_price(item_id)
                lines.append(f'  {name:25s} {price:4d}g  (в наличии: {stock})')
        return '\n'.join(lines)

    # ------------------------------------------------------------------
    def restock(self):
        """Пополнение запасов (раз в игровой день)."""
        for item_id in self.stock:
            if self.stock[item_id] < 5:
                self.stock[item_id] += 3

    def to_dict(self):
        return {'stock': dict(self.stock)}

    def from_dict(self, data):
        self.stock.update(data.get('stock', {}))


# ---------------------------------------------------------------------------
class CaravanLoot:
    """Добыча с ограбленного каравАна."""

    CARAVAN_GOODS = [
        ('grain', 5, 15), ('spices', 2, 8), ('silk', 1, 5),
        ('iron_ore', 3, 10), ('gems', 1, 3), ('furs', 2, 6), ('ale', 3, 12),
    ]

    @classmethod
    def generate(cls, difficulty=1.0):
        """Генерирует случайную добычу с каравАна."""
        import random
        loot = {}
        gold = int(random.randint(30, 150) * difficulty)

        num_items = random.randint(2, 5)
        for _ in range(num_items):
            item_id, min_q, max_q = random.choice(cls.CARAVAN_GOODS)
            qty = random.randint(min_q, max_q)
            loot[item_id] = loot.get(item_id, 0) + qty

        return loot, gold
