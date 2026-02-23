"""
Главный игровой движок на Panda3D.

Запуск:  python main.py
"""
import math
import random
import os

from direct.showbase.ShowBase import ShowBase
from direct.gui.DirectGui import (
    DirectFrame, DirectLabel, DirectButton, DGG,
)
from direct.task import Task
from panda3d.core import (
    WindowProperties, LVector3f, LPoint3f, LColor,
    AmbientLight, DirectionalLight,
    CollisionTraverser, CollisionNode, CollisionSphere, CollisionHandlerPusher,
    BitMask32, NodePath, Fog,
    TextNode,
    KeyboardButton,
)

from game.player import Player
from game.world import World, make_box_geom
from game.combat import CombatLog
from game.hud import HUD
from game import save_load
from game.factions import FACTIONS, ITEMS
from game.trading import Market


# ---------------------------------------------------------------------------
# Цвета скайбокса по фракциям
# ---------------------------------------------------------------------------
SKY_COLORS = {
    'elves':   (0.40, 0.62, 0.85),
    'guards':  (0.45, 0.65, 0.90),
    'villain': (0.12, 0.06, 0.06),
}


class KorovanyGame(ShowBase):
    """Основной класс игры."""

    def __init__(self):
        ShowBase.__init__(self)
        self.disableMouse()
        self._set_window_title('Korova — 3D Action')

        # Шрифт с поддержкой кириллицы
        self._font = self._load_cyrillic_font()

        # Счётчик FPS (для отладки)
        self.setFrameRateMeter(True)

        # Состояния
        self.game_started = False
        self.paused = False
        self.in_shop = False
        self.in_inventory = False
        self.player = None
        self.world = None
        self.hud = None
        self.combat_log = CombatLog(max_lines=6)
        self.market = None
        self._active_korovan = None
        self._korovan_fight = False

        # Клавиши
        self._keys = {}
        self._mouse_locked = False

        # Трекинг мыши (delta между кадрами, без M_relative)
        self._prev_mx = None
        self._prev_my = None

        self.accept('window-event', self._on_window_event)

        # Визуальные представления врагов {enemy_id: NodePath}
        self._enemy_nodes = {}
        # Игровой персонаж (вид со стороны — тело)
        self._player_node = None

        # Оружие от первого лица
        self._weapon_np = None
        self._weapon_attack_t = -1.0   # <0 — не анимируется

        # Ссылка на экран смерти (чтобы уничтожить при рестарте)
        self._death_frame = None

        # Глобально заглушить кириллические клавиши — иначе Panda3D
        # спамит "Unhandled keypress" в лог при русской раскладке
        _silence = 'йцукенгшщзхъфывапролджэячсмитьбю.,!'
        for _ch in _silence:
            self.accept(_ch, lambda: None)

        self._show_main_menu()

    # =====================================================================
    # ГЛАВНОЕ МЕНЮ
    # =====================================================================

    def _show_main_menu(self):
        self._clear_gui()
        self.setBackgroundColor(0.05, 0.05, 0.1)

        self._menu_frame = DirectFrame(
            parent=self.aspect2d,
            frameSize=(-0.8, 0.8, -0.9, 0.9),
            frameColor=(0.05, 0.05, 0.12, 0.92),
        )

        DirectLabel(
            parent=self._menu_frame,
            text='>>> KOROVANY <<<',
            pos=(0, 0, 0.78),
            scale=0.11,
            text_fg=(0.9, 0.7, 0.1, 1),
            frameColor=(0, 0, 0, 0),
        )
        DirectLabel(
            parent=self._menu_frame,
            text='3D Экшон-РПГ',
            pos=(0, 0, 0.64),
            scale=0.055,
            text_fg=(0.75, 0.75, 0.75, 1),
            frameColor=(0, 0, 0, 0),
            **self._fkw(),
        )

        btn_style = dict(
            scale=0.07,
            frameSize=(-6.0, 6.0, -0.6, 0.8),
            text_fg=(1, 1, 1, 1),
            frameColor=(0.1, 0.1, 0.25, 0.9),
            relief=DGG.RAISED,
            rolloverSound=None,
            clickSound=None,
        )

        DirectButton(
            parent=self._menu_frame,
            text='Новая игра',
            pos=(0, 0, 0.35),
            command=self._show_faction_menu,
            **btn_style,
            **self._fkw(),
        )
        DirectButton(
            parent=self._menu_frame,
            text='Загрузить',
            pos=(0, 0, 0.18),
            command=self._show_load_menu,
            **btn_style,
            **self._fkw(),
        )
        DirectButton(
            parent=self._menu_frame,
            text='Выйти',
            pos=(0, 0, 0.01),
            command=self.userExit,
            **btn_style,
            **self._fkw(),
        )

        DirectLabel(
            parent=self._menu_frame,
            text=(
                'WASD — движение   ЛКМ — атака   E — взаимодействие\n'
                'T — торговля   I — инвентарь   J — прыжок   F5 — сохранить   Esc — пауза'
            ),
            pos=(0, 0, -0.78),
            scale=0.038,
            text_fg=(0.6, 0.6, 0.6, 1),
            frameColor=(0, 0, 0, 0),
            **self._fkw(),
        )

    # =====================================================================
    # МЕНЮ ВЫБОРА ФРАКЦИИ
    # =====================================================================

    def _show_faction_menu(self):
        self._clear_gui()
        self.setBackgroundColor(0.05, 0.05, 0.1)

        frame = DirectFrame(
            parent=self.aspect2d,
            frameSize=(-1.3, 1.3, -0.9, 0.9),
            frameColor=(0.03, 0.03, 0.1, 0.95),
        )
        self._menu_frame = frame

        DirectLabel(
            parent=frame, text='Выберите фракцию',
            pos=(0, 0, 0.82), scale=0.08,
            text_fg=(0.9, 0.7, 0.1, 1), frameColor=(0,0,0,0),
            **self._fkw(),
        )

        faction_data = [
            ('elves',   'Лесные эльфы',    (0.1, 0.7, 0.1, 1), -0.86),
            ('guards',  'Охрана дворца',   (0.2, 0.2, 0.85, 1), 0.0),
            ('villain', 'Тёмный Лорд',     (0.75, 0.05, 0.05, 1), 0.86),
        ]

        for fid, fname, fcolor, xpos in faction_data:
            desc = FACTIONS[fid]['desc']
            card = DirectFrame(
                parent=frame,
                frameSize=(-0.38, 0.38, -0.62, 0.62),
                frameColor=(fcolor[0]*0.25, fcolor[1]*0.25, fcolor[2]*0.25, 0.9),
                pos=(xpos, 0, 0.1),
            )
            DirectLabel(
                parent=card, text=fname,
                pos=(0, 0, 0.52), scale=0.06,
                text_fg=fcolor, frameColor=(0,0,0,0),
                **self._fkw(),
            )
            DirectLabel(
                parent=card, text=desc,
                pos=(0, 0, 0.15), scale=0.034,
                text_fg=(0.85, 0.85, 0.85, 1), frameColor=(0,0,0,0),
                text_wordwrap=14,
                **self._fkw(),
            )
            # Статы
            s = FACTIONS[fid]['start_stats']
            stats_text = (f"HP: {s['max_hp']}  Сила: {s['strength']}\n"
                          f"Ловк: {s['agility']}  Инт: {s['intelligence']}\n"
                          f"Золото: {s['gold']}")
            DirectLabel(
                parent=card, text=stats_text,
                pos=(0, 0, -0.30), scale=0.038,
                text_fg=(0.8, 0.8, 0.8, 1), frameColor=(0,0,0,0),
                **self._fkw(),
            )
            DirectButton(
                parent=card,
                text=f'Играть за {fname}',
                pos=(0, 0, -0.52),
                scale=0.042,
                frameSize=(-7, 7, -0.7, 0.9),
                text_fg=(1, 1, 1, 1),
                frameColor=(fcolor[0]*0.5, fcolor[1]*0.5, fcolor[2]*0.5, 1),
                command=self._start_game,
                extraArgs=[fid],
                relief=DGG.RAISED,
                **self._fkw(),
            )

        DirectButton(
            parent=frame, text='← Назад',
            pos=(-1.1, 0, -0.82), scale=0.055,
            frameSize=(-3, 3, -0.6, 0.8),
            text_fg=(0.8, 0.8, 0.8, 1),
            frameColor=(0.15, 0.15, 0.15, 0.9),
            command=self._show_main_menu,
            relief=DGG.RAISED,
            **self._fkw(),
        )

    # =====================================================================
    # МЕНЮ ЗАГРУЗКИ
    # =====================================================================

    def _show_load_menu(self):
        self._clear_gui()
        frame = DirectFrame(
            parent=self.aspect2d,
            frameSize=(-0.7, 0.7, -0.8, 0.8),
            frameColor=(0.04, 0.04, 0.12, 0.95),
        )
        self._menu_frame = frame

        DirectLabel(
            parent=frame, text='Загрузить игру',
            pos=(0, 0, 0.72), scale=0.08,
            text_fg=(0.9, 0.7, 0.1, 1), frameColor=(0,0,0,0),
            **self._fkw(),
        )

        saves = save_load.list_saves()
        if not saves:
            DirectLabel(
                parent=frame, text='Сохранений нет.',
                pos=(0, 0, 0.2), scale=0.06,
                text_fg=(0.6, 0.6, 0.6, 1), frameColor=(0,0,0,0),
                **self._fkw(),
            )
        else:
            for i, sv in enumerate(saves[:6]):
                y = 0.45 - i * 0.14
                lbl = (f'{sv["slot"]}  |  {sv["faction"]}  |  '
                       f'{sv["timestamp"]}')
                DirectButton(
                    parent=frame, text=lbl,
                    pos=(0, 0, y), scale=0.045,
                    frameSize=(-13, 13, -0.7, 0.9),
                    text_fg=(0.9, 0.9, 0.9, 1),
                    frameColor=(0.1, 0.1, 0.2, 0.9),
                    command=self._load_and_start,
                    extraArgs=[sv['slot']],
                    relief=DGG.RAISED,
                    **self._fkw(),
                )

        DirectButton(
            parent=frame, text='← Назад',
            pos=(0, 0, -0.72), scale=0.06,
            frameSize=(-4, 4, -0.6, 0.8),
            text_fg=(0.8, 0.8, 0.8, 1),
            frameColor=(0.15, 0.15, 0.15, 0.9),
            command=self._show_main_menu,
            relief=DGG.RAISED,
            **self._fkw(),
        )

    def _load_and_start(self, slot):
        faction = 'elves'  # Временно
        self._start_game(faction, load_slot=slot)

    # =====================================================================
    # СТАРТ ИГРЫ
    # =====================================================================

    def _start_game(self, faction_id, load_slot=None):
        self._clear_gui()
        self.setBackgroundColor(*SKY_COLORS.get(faction_id, (0.4, 0.55, 0.7)))

        # Инициализация игрока
        self.player = Player(faction_id)
        if load_slot:
            ok, msg = save_load.load_game(self.player, load_slot)
            if not ok:
                print(f'Ошибка загрузки: {msg}')

        # Камера ставится ДО world.setup — иначе скайбокс создаётся
        # в (0,0,0) и первый кадр рендерится неправильно
        self._setup_camera()

        # Мир
        self.world = World(self.render, self)
        self.world.setup(faction_id)

        # Рынок текущей стартовой зоны
        zone_id = FACTIONS[faction_id].get('zone', 'human_zone')
        self.market = Market(zone_id)

        # HUD
        self.hud = HUD(self, font=self._font)

        # Визуальные враги
        self._spawn_enemy_nodes()

        # Оружие от первого лица
        self._create_weapon_view()

        # Задачи (game loop)
        self.taskMgr.add(self._game_loop, 'game_loop')

        # Ввод (сначала сбросить старые привязки)
        self.ignoreAll()
        self._setup_input()

        self.game_started = True

        msg = f'Добро пожаловать, {self.player.get_faction_name()}!'
        self.hud.show_message(msg, color=(0.8, 1.0, 0.4, 1), duration=4.0)
        self.combat_log.add(msg)

        if faction_id == 'elves':
            self.combat_log.add('Лес защищает тебя. Берегись солдат!')
        elif faction_id == 'guards':
            self.combat_log.add('Охраняй дворец. Слушай командира!')
        elif faction_id == 'villain':
            self.combat_log.add('Твои войска ждут приказа. Захвати трон!')

    # =====================================================================
    # КАМЕРА
    # =====================================================================

    def _setup_camera(self):
        p = self.player
        self._cam_h = 0.0    # горизонтальный поворот (градусы)
        self._cam_p = -10.0  # вертикальный наклон

        # Near plane уменьшаем чтобы оружие в руке не обрезалось
        self.camLens.setNear(0.08)

        # Сразу ставим камеру на позицию игрока — иначе первый кадр
        # рендерится из (0,0,0) и видно зелёный рельеф изнутри
        self.camera.setPos(p.pos_x, p.pos_y, p.pos_z + 1.7)
        self.camera.setHpr(self._cam_h, self._cam_p, 0)

        self._lock_mouse()

    def _unlock_mouse(self):
        props = WindowProperties()
        props.setCursorHidden(False)
        self.win.requestProperties(props)
        self._mouse_locked = False

    def _lock_mouse(self):
        props = WindowProperties()
        props.setCursorHidden(True)
        self.win.requestProperties(props)
        self._mouse_locked = True
        # Сбросить трекинг: первый кадр после блокировки не вращает камеру
        self._prev_mx = None
        self._prev_my = None

    def _update_camera(self, dt):
        if not self._mouse_locked:
            return
        md = self.win.getPointer(0)
        if not md:
            return

        mx, my = md.getX(), md.getY()
        w = self.win.getXSize()
        h = self.win.getYSize()
        if w <= 0 or h <= 0:
            return
        cx, cy = w // 2, h // 2

        # Первый кадр после блокировки: просто запомнить позицию
        if self._prev_mx is None:
            self._prev_mx, self._prev_my = mx, my
            return

        dx = mx - self._prev_mx
        dy = my - self._prev_my

        # Ограничиваем дельту: защита от скачков при смене дисплея
        dx = max(-200, min(200, dx))
        dy = max(-200, min(200, dy))

        # Ре-центрирование при приближении к краю окна
        # (без этого камера перестанет вращаться когда курсор упрётся в край)
        margin = max(80, w // 10)
        if mx < margin or mx > w - margin or my < margin or my > h - margin:
            self.win.movePointer(0, cx, cy)
            self._prev_mx, self._prev_my = cx, cy
        else:
            self._prev_mx, self._prev_my = mx, my

        sensitivity = 0.18
        self._cam_h -= dx * sensitivity
        self._cam_p  = max(-75, min(25, self._cam_p - dy * sensitivity))

        p = self.player
        self.camera.setPos(p.pos_x, p.pos_y, p.pos_z + 1.7)
        self.camera.setHpr(self._cam_h, self._cam_p, 0)

    # =====================================================================
    # СМЕНА ДИСПЛЕЯ (macOS)
    # =====================================================================

    def _on_window_event(self, window):
        # movePointer() тоже триггерит этот ивент — ничего не делаем,
        # чтобы не вызывать лишних рендеров и не сбрасывать трекинг мыши.
        pass

    # =====================================================================
    # ВВОД
    # =====================================================================

    def _setup_input(self):
        # Латинская раскладка
        keys = ['w', 'a', 's', 'd', 'j', 'shift']
        for k in keys:
            self.accept(k, self._set_key, [k, True])
            self.accept(f'{k}-up', self._set_key, [k, False])

        # Русская раскладка (WASDJ → ЦФЫВО)
        _ru = {'ц': 'w', 'ф': 'a', 'ы': 's', 'в': 'd', 'о': 'j'}
        for cyr, lat in _ru.items():
            self.accept(cyr, self._set_key, [lat, True])
            self.accept(f'{cyr}-up', self._set_key, [lat, False])

        # Заглушить все остальные кириллические клавиши, чтобы Panda3D
        # не спамила "Unhandled keypress" в лог при русской раскладке
        _all_cyr = 'йцукенгшщзхъфывапролджэячсмитьбю'
        _handled = set(_ru.keys()) | {'у', 'е', 'ш'}
        for ch in _all_cyr:
            if ch not in _handled:
                self.accept(ch, lambda: None)

        # Пробел = прыжок (работает в любой раскладке)
        self.accept('space', self._set_key, ['j', True])
        self.accept('space-up', self._set_key, ['j', False])

        self.accept('mouse1',   self._on_attack)
        self.accept('e',        self._on_interact)
        self.accept('у',        self._on_interact)   # E в русской раскладке
        self.accept('t',        self._toggle_shop)
        self.accept('е',        self._toggle_shop)   # T в русской раскладке
        self.accept('i',        self._toggle_inventory)
        self.accept('ш',        self._toggle_inventory)  # I в русской раскладке
        self.accept('f5',       self._quick_save)
        self.accept('f9',       self._quick_load)
        self.accept('escape',   self._toggle_pause)
        self.accept('1',        self._use_item_slot, [0])
        self.accept('2',        self._use_item_slot, [1])

    def _set_key(self, key, val):
        self._keys[key] = val

    def _key(self, k):
        return self._keys.get(k, False)

    # =====================================================================
    # ОСНОВНОЙ ЦИКЛ
    # =====================================================================

    def _game_loop(self, task):
        dt = globalClock.getDt()
        dt = min(dt, 0.1)  # Защита от больших скачков

        if self.paused or not self.game_started:
            return Task.cont

        player = self.player
        world = self.world

        if player.is_dead:
            self._on_player_death()
            return Task.done

        # --- Камера сначала, чтобы движение использовало актуальный угол ---
        self._update_camera(dt)
        self._handle_movement(dt)
        player.update_jump(dt)

        # Приземление на неровный рельеф (нужно после update_jump)
        if player.is_jumping:
            g = self.world.get_height(player.pos_x, player.pos_y)
            if player.pos_z < g:
                player.pos_z = g + 0.05
                player.is_jumping = False
                player.jump_vel = 0.0

        # --- Тик игрока (кровотечение и т.д.) ---
        bleed = player.tick(dt)
        if bleed > 0:
            self.combat_log.add(f'Кровотечение: -{bleed} HP')
            if player.body.movement_multiplier() <= 0.15:
                self.combat_log.add('Вы ползёте... Вам нужна помощь!')

        # --- Обновить мир ---
        attacks = world.update(dt, player.pos_x, player.pos_y,
                               player.is_dead, player.faction_id)
        for (enemy, raw_dmg) in attacks:
            if player.is_dead:
                break
            actual, events, msgs = player.take_damage(raw_dmg)
            for m in msgs:
                self.combat_log.add(m)
            if msgs:
                self.hud.show_message(msgs[0], color=(1, 0.2, 0.2, 1), duration=1.5)

        # --- Обновить визуальные позиции врагов ---
        self._update_enemy_nodes()

        # --- Обновить корованы ---
        self._update_korovan_nodes()

        # --- Оружие в руке ---
        self._update_weapon_position(dt)

        # --- HUD ---
        self.hud.update(player, world, self.combat_log)
        self.hud.tick_message(dt)

        return Task.cont

    # =====================================================================
    # ДВИЖЕНИЕ ИГРОКА
    # =====================================================================

    def _handle_movement(self, dt):
        player = self.player
        speed = player.move_speed()

        # isButtonDown проверяет физическую позицию клавиши — не зависит от раскладки.
        # self._key() оставлен как запасной вариант для нестандартных сочетаний.
        mw = self.mouseWatcherNode
        ak = KeyboardButton.asciiKey

        player.is_sneaking = (mw.isButtonDown(KeyboardButton.shift())
                               or self._key('shift'))

        # Вычислить направление из угла камеры
        # Panda3D: H=90 → камера смотрит на -X, значит fwd_x = -sin(H)
        h_rad = math.radians(self._cam_h)
        fwd_x = -math.sin(h_rad)
        fwd_y =  math.cos(h_rad)

        move_x, move_y = 0, 0

        if mw.isButtonDown(ak('w')) or self._key('w'):
            move_x += fwd_x
            move_y += fwd_y
        if mw.isButtonDown(ak('s')) or self._key('s'):
            move_x -= fwd_x
            move_y -= fwd_y
        if mw.isButtonDown(ak('a')) or self._key('a'):
            move_x -= fwd_y
            move_y += fwd_x
        if mw.isButtonDown(ak('d')) or self._key('d'):
            move_x += fwd_y
            move_y -= fwd_x

        length = math.sqrt(move_x**2 + move_y**2)
        if length > 0:
            player.pos_x += (move_x / length) * speed * dt
            player.pos_y += (move_y / length) * speed * dt

        # Граница мира
        player.pos_x = max(-340, min(340, player.pos_x))
        player.pos_y = max(-340, min(340, player.pos_y))

        # Высота по ландшафту — прижать персонажа к земле
        ground = self.world.get_height(player.pos_x, player.pos_y)
        if not player.is_jumping:
            player.pos_z = ground + 0.05  # небольшой отступ предотвращает клиппинг

        # Прыжок — физическая клавиша J или Space, не зависит от раскладки
        if ((mw.isButtonDown(ak('j')) or mw.isButtonDown(KeyboardButton.space())
             or self._key('j')) and not player.is_jumping):
            player.jump()
        # Камера обновляется в _update_camera — дублировать не нужно

    # =====================================================================
    # АТАКА ИГРОКА
    # =====================================================================

    def _on_attack(self):
        if not self.game_started or self.paused or self.in_shop:
            return
        player = self.player
        if not player.can_attack():
            self.combat_log.add('Вы не можете атаковать!')
            return

        # Анимация удара оружием
        self._trigger_attack_anim()

        # Найти ближайшего врага
        nearby = self.world.get_nearby_enemies(player.pos_x, player.pos_y, radius=4.0)
        if nearby:
            enemy, dist = nearby[0]
            dmg = player.get_attack_damage()
            actual, killed, crit, part = enemy.take_damage(dmg)
            player.attack_cooldown = 0.8

            if actual > 0:
                msg = f'Удар по {enemy.name} ({part}): {actual} урона'
                if crit:
                    msg += ' [КРИТ!]'
                self.combat_log.add(msg)

                if killed:
                    player.kills += 1
                    loot_items, loot_gold = enemy.get_loot()
                    player.inventory.gold += loot_gold
                    for item_id, qty in loot_items.items():
                        player.inventory.add_item(item_id, qty)
                    self.combat_log.add(f'{enemy.name} убит! Золото: +{loot_gold}')
                    if enemy.node_path:
                        enemy.node_path.setR(90)  # Труп падает
            else:
                self.combat_log.add(f'Уклонился {enemy.name}!')
        else:
            # Попытка ограбить корован
            near_korovans = self.world.get_nearby_korovans(
                player.pos_x, player.pos_y, radius=10.0)
            if near_korovans:
                korovan, _ = near_korovans[0]
                self._attack_korovan(korovan)
            else:
                self.combat_log.add('Нет целей рядом. Подойди ближе.')

    def _attack_korovan(self, korovan):
        player = self.player
        loot, gold, msgs = korovan.attack(
            player.get_attack_damage(), player.agility)
        for m in msgs:
            self.combat_log.add(m)

        # Контратака охраны
        if korovan.guards > 0:
            counter = korovan.guard_counter_attack()
            if counter > 0:
                actual, events, dmg_msgs = player.take_damage(counter)
                for m in dmg_msgs:
                    self.combat_log.add(f'Охрана: {m}')
                self.combat_log.add(f'Охрана наносит {actual} урона!')
            # Показать HP охраны после удара
            self.hud.show_message(
                f'Охрана корована\n'
                f'{korovan.guards} чел.  HP: {korovan.guard_hp}/{korovan.guard_max_hp}',
                color=(1, 0.55, 0.1, 1), duration=2.0
            )

        # Если ограблен — получить добычу
        if korovan.looted:
            player.inventory.gold += gold
            for item_id, qty in loot.items():
                player.inventory.add_item(item_id, qty)
            self.hud.show_message(
                f'Корован ограблен! +{gold} золота',
                color=(1, 0.9, 0.1, 1), duration=3.0
            )

    # =====================================================================
    # ВЗАИМОДЕЙСТВИЕ
    # =====================================================================

    def _on_interact(self):
        if not self.game_started:
            return

        # Проверить наличие корована рядом
        near_korovans = self.world.get_nearby_korovans(
            self.player.pos_x, self.player.pos_y, radius=12.0)
        if near_korovans:
            korovan, _ = near_korovans[0]
            goods_preview = ', '.join(
                f'{v}×{k}' for k, v in list(korovan.goods.items())[:3]
            )
            self.hud.show_message(
                f'[ {korovan.name} ]  {korovan.route_name}\n'
                f'Охрана: {korovan.guards} чел.  '
                f'HP: {korovan.guard_hp}/{korovan.guard_max_hp}\n'
                f'Золото: {korovan.gold}   {goods_preview}\n'
                f'ЛКМ — атаковать',
                color=(1, 0.8, 0.2, 1), duration=4.0
            )
            return

        self.combat_log.add('Нет объектов для взаимодействия')

    # =====================================================================
    # МАГАЗИН
    # =====================================================================

    def _toggle_shop(self):
        if not self.game_started:
            return
        if self.in_shop:
            self._close_shop()
        else:
            self._open_shop()

    def _open_shop(self):
        self.in_shop = True
        self._unlock_mouse()

        zone_id = self.world.get_zone_at(self.player.pos_x, self.player.pos_y)
        self.market = Market(zone_id)

        self._shop_frame = DirectFrame(
            parent=self.aspect2d,
            frameSize=(-1.2, 1.2, -0.88, 0.88),
            frameColor=(0.05, 0.05, 0.15, 0.95),
        )

        DirectLabel(
            parent=self._shop_frame,
            text=f'=== {self.market.zone_name} — Торговля ===',
            pos=(0, 0, 0.80), scale=0.065,
            text_fg=(0.9, 0.7, 0.1, 1), frameColor=(0,0,0,0),
            **self._fkw(),
        )
        DirectLabel(
            parent=self._shop_frame,
            text=f'Ваше золото: {self.player.inventory.gold}',
            pos=(-0.9, 0, 0.68), scale=0.05,
            text_fg=(1, 0.85, 0.2, 1), frameColor=(0,0,0,0),
            text_align=TextNode.ALeft,
            **self._fkw(),
        )

        # Список товаров (кнопки "купить")
        items_list = [(k, v) for k, v in self.market.stock.items() if v > 0]
        for i, (item_id, stock) in enumerate(items_list[:12]):
            y = 0.55 - i * 0.092
            data = ITEMS.get(item_id, {})
            name = data.get('name', item_id)
            price = self.market.buy_price(item_id)
            sell_price = self.market.sell_price(item_id)
            label = f'{name:22s}  {price}g (покупка)  / {sell_price}g (продажа)   [{stock} шт.]'
            DirectButton(
                parent=self._shop_frame,
                text=label,
                pos=(0, 0, y), scale=0.040,
                frameSize=(-28, 28, -0.65, 0.85),
                text_fg=(0.9, 0.9, 0.9, 1),
                frameColor=(0.08, 0.08, 0.18, 0.9),
                command=self._buy_item,
                extraArgs=[item_id],
                relief=DGG.RAISED,
                text_align=TextNode.ALeft,
                **self._fkw(),
            )

        DirectButton(
            parent=self._shop_frame,
            text='Закрыть (T)',
            pos=(0, 0, -0.82), scale=0.058,
            frameSize=(-4, 4, -0.65, 0.85),
            text_fg=(1, 1, 1, 1),
            frameColor=(0.2, 0.05, 0.05, 0.9),
            command=self._close_shop,
            relief=DGG.RAISED,
            **self._fkw(),
        )

    def _buy_item(self, item_id):
        ok, msg = self.market.player_buy(self.player.inventory, item_id)
        self.combat_log.add(msg)
        if ok:
            self._close_shop()
            self._open_shop()  # Обновить витрину

    def _close_shop(self):
        self.in_shop = False
        self._lock_mouse()
        if hasattr(self, '_shop_frame') and self._shop_frame:
            self._shop_frame.destroy()
            self._shop_frame = None

    # =====================================================================
    # ИНВЕНТАРЬ
    # =====================================================================

    def _toggle_inventory(self):
        if not self.game_started:
            return
        if self.in_inventory:
            self._close_inventory()
        else:
            self._open_inventory()

    def _open_inventory(self):
        self.in_inventory = True
        self._unlock_mouse()

        self._inv_frame = DirectFrame(
            parent=self.aspect2d,
            frameSize=(-0.95, 0.95, -0.88, 0.88),
            frameColor=(0.03, 0.08, 0.03, 0.95),
        )
        DirectLabel(
            parent=self._inv_frame,
            text='=== ИНВЕНТАРЬ ===',
            pos=(0, 0, 0.80), scale=0.07,
            text_fg=(0.5, 1, 0.5, 1), frameColor=(0,0,0,0),
            **self._fkw(),
        )

        # Экипированное
        inv = self.player.inventory
        DirectLabel(
            parent=self._inv_frame,
            text=(f'Оружие: {inv.get_weapon_name()}  '
                  f'| Броня: {inv.get_armor_name()}  '
                  f'| Золото: {inv.gold}'),
            pos=(0, 0, 0.67), scale=0.044,
            text_fg=(0.9, 0.85, 0.5, 1), frameColor=(0,0,0,0),
            **self._fkw(),
        )

        # Список предметов с кнопками
        items = list(inv.items.items())
        for i, (item_id, qty) in enumerate(items[:14]):
            data = ITEMS.get(item_id, {})
            name = data.get('name', item_id)
            y = 0.54 - i * 0.075
            label = f'{name} x{qty}'
            DirectButton(
                parent=self._inv_frame,
                text=label,
                pos=(-0.35, 0, y), scale=0.042,
                frameSize=(-9, 9, -0.65, 0.85),
                text_fg=(0.9, 0.9, 0.9, 1),
                frameColor=(0.06, 0.12, 0.06, 0.9),
                command=self._use_or_equip,
                extraArgs=[item_id],
                relief=DGG.RAISED,
                **self._fkw(),
            )

        # Части тела
        DirectLabel(
            parent=self._inv_frame,
            text='\n'.join(self.player.body.get_status_lines()),
            pos=(0.45, 0, 0.45), scale=0.036,
            text_fg=(0.8, 1.0, 0.8, 1), frameColor=(0,0,0,0),
            text_align=TextNode.ALeft,
            **self._fkw(),
        )

        DirectButton(
            parent=self._inv_frame,
            text='Закрыть (I)',
            pos=(0, 0, -0.82), scale=0.058,
            frameSize=(-4, 4, -0.65, 0.85),
            text_fg=(1, 1, 1, 1),
            frameColor=(0.05, 0.15, 0.05, 0.9),
            command=self._close_inventory,
            relief=DGG.RAISED,
            **self._fkw(),
        )

    def _use_or_equip(self, item_id):
        data = ITEMS.get(item_id, {})
        item_type = data.get('type')
        inv = self.player.inventory

        if item_type == 'weapon':
            ok, msg = inv.equip_weapon(item_id)
            if ok:
                self._create_weapon_view()
        elif item_type == 'armor':
            ok, msg = inv.equip_armor(item_id)
        elif item_type == 'consumable':
            heal, msg = inv.use_consumable(item_id, self.player.body)
            ok = True
        elif item_type == 'prosthetic':
            ok, msg, part = self.player.body.fit_prosthetic(item_id)
            if ok:
                inv.remove_item(item_id)
        else:
            ok, msg = False, 'Предмет нельзя использовать'

        self.combat_log.add(msg)
        self._close_inventory()
        self._open_inventory()

    def _use_item_slot(self, slot):
        """Быстрое использование предметов клавишами 1/2."""
        inv = self.player.inventory
        consumables = [(k, v) for k, v in inv.items.items()
                       if ITEMS.get(k, {}).get('type') == 'consumable']
        if slot < len(consumables):
            item_id = consumables[slot][0]
            heal, msg = inv.use_consumable(item_id, self.player.body)
            self.combat_log.add(msg)

    def _close_inventory(self):
        self.in_inventory = False
        self._lock_mouse()
        if hasattr(self, '_inv_frame') and self._inv_frame:
            self._inv_frame.destroy()
            self._inv_frame = None

    # =====================================================================
    # СОХРАНЕНИЕ / ЗАГРУЗКА
    # =====================================================================

    def _quick_save(self):
        if not self.game_started:
            return
        ok, msg = save_load.save_game(self.player, 'quicksave')
        self.combat_log.add(msg)
        self.hud.show_message('Сохранено!', color=(0.5, 1, 0.5, 1), duration=2.0)

    def _quick_load(self):
        if not self.game_started:
            return
        ok, msg = save_load.load_game(self.player, 'quicksave')
        self.combat_log.add(msg)

    # =====================================================================
    # ПАУЗА
    # =====================================================================

    def _toggle_pause(self):
        if not self.game_started:
            return
        self.paused = not self.paused
        if self.paused:
            self._unlock_mouse()
            self._pause_frame = DirectFrame(
                parent=self.aspect2d,
                frameSize=(-0.5, 0.5, -0.55, 0.55),
                frameColor=(0.0, 0.0, 0.0, 0.88),
            )
            DirectLabel(
                parent=self._pause_frame, text='ПАУЗА',
                pos=(0, 0, 0.40), scale=0.12,
                text_fg=(0.9, 0.7, 0.1, 1), frameColor=(0,0,0,0),
                **self._fkw(),
            )
            for i, (label, cmd, args) in enumerate([
                ('Продолжить', self._toggle_pause, []),
                ('Сохранить',  self._quick_save,   []),
                ('Главное меню', self._to_main_menu, []),
            ]):
                DirectButton(
                    parent=self._pause_frame,
                    text=label, pos=(0, 0, 0.15 - i * 0.18),
                    scale=0.07, frameSize=(-4, 4, -0.65, 0.85),
                    text_fg=(1,1,1,1), frameColor=(0.1,0.1,0.2,0.9),
                    command=cmd, extraArgs=args, relief=DGG.RAISED,
                    **self._fkw(),
                )
        else:
            self._lock_mouse()
            if hasattr(self, '_pause_frame'):
                self._pause_frame.destroy()

    def _to_main_menu(self):
        self.paused = False
        self.game_started = False
        self._keys = {}
        self.taskMgr.remove('game_loop')
        if self.hud:
            self.hud.destroy()
            self.hud = None
        if self._weapon_np:
            try:
                self._weapon_np.removeNode()
            except Exception:
                pass
            self._weapon_np = None
        if self.world:
            self.world.cleanup()
            self.world = None
        self._enemy_nodes.clear()
        self._unlock_mouse()
        # Уничтожить экран смерти если есть
        if self._death_frame:
            try:
                self._death_frame.destroy()
            except Exception:
                pass
            self._death_frame = None
        if hasattr(self, '_pause_frame'):
            try:
                self._pause_frame.destroy()
            except Exception:
                pass
        self._show_main_menu()

    # =====================================================================
    # СМЕРТЬ ИГРОКА
    # =====================================================================

    def _on_player_death(self):
        self.game_started = False
        self._unlock_mouse()

        self._death_frame = DirectFrame(
            parent=self.aspect2d,
            frameSize=(-0.7, 0.7, -0.50, 0.50),
            frameColor=(0.3, 0.0, 0.0, 0.92),
        )
        DirectLabel(
            parent=self._death_frame, text='ВЫ ПОГИБЛИ',
            pos=(0, 0, 0.35), scale=0.12,
            text_fg=(1, 0.1, 0.1, 1), frameColor=(0,0,0,0),
            **self._fkw(),
        )
        DirectLabel(
            parent=self._death_frame,
            text=f'Убито врагов: {self.player.kills}\nЗолото: {self.player.inventory.gold}',
            pos=(0, 0, 0.10), scale=0.06,
            text_fg=(0.8, 0.8, 0.8, 1), frameColor=(0,0,0,0),
            **self._fkw(),
        )
        faction = self.player.faction_id
        for i, (text, cmd, args) in enumerate([
            ('Начать заново',  self._restart_same_faction, [faction]),
            ('Главное меню',   self._to_main_menu,         []),
        ]):
            DirectButton(
                parent=self._death_frame, text=text,
                pos=(0, 0, -0.20 - i * 0.16),
                scale=0.068, frameSize=(-4.5, 4.5, -0.65, 0.85),
                text_fg=(1,1,1,1), frameColor=(0.15,0.05,0.05,0.9),
                command=cmd, extraArgs=args, relief=DGG.RAISED,
                **self._fkw(),
            )

    def _restart_same_faction(self, faction_id):
        """Начать заново с той же фракцией без возврата в меню."""
        # Откладываем выполнение на следующий кадр, чтобы кнопка успела завершить callback
        # до того как её DirectFrame будет уничтожен
        def _do(task):
            self._cleanup_for_restart()
            self._start_game(faction_id)
            from direct.task import Task as _Task
            return _Task.done
        self.taskMgr.doMethodLater(0.05, _do, 'restart_game')

    def _cleanup_for_restart(self):
        """Очистить игровое состояние без показа главного меню."""
        self.paused = False
        self.game_started = False
        self._keys = {}
        self.taskMgr.remove('game_loop')
        if self.hud:
            try:
                self.hud.destroy()
            except Exception:
                pass
            self.hud = None
        if self._weapon_np:
            try:
                self._weapon_np.removeNode()
            except Exception:
                pass
            self._weapon_np = None
        if self.world:
            self.world.cleanup()
            self.world = None
        self._enemy_nodes.clear()
        self._unlock_mouse()
        if self._death_frame:
            try:
                self._death_frame.destroy()
            except Exception:
                pass
            self._death_frame = None
        self._clear_gui()

    # =====================================================================
    # ВИЗУАЛЬНЫЕ УЗЛЫ ВРАГОВ
    # =====================================================================

    def _spawn_enemy_nodes(self):
        """Создать 3D-представления врагов в сцене."""
        for enemy in self.world.enemies:
            self._create_enemy_node(enemy)
        for korovan in self.world.korovans:
            self._create_korovan_node(korovan)

    def _create_enemy_node(self, enemy):
        """Создать человекоподобную фигурку врага из нескольких геомов."""
        color = enemy.color
        # Чуть темнее для теней на конечностях
        dark = (max(0, color[0] - 0.18), max(0, color[1] - 0.18),
                max(0, color[2] - 0.18), 1)
        # Лицо чуть светлее
        face = (min(1, color[0] + 0.12), min(1, color[1] + 0.08),
                min(1, color[2] + 0.06), 1)

        root = self.render.attachNewNode(f'enemy_{enemy.id}')

        # --- Ноги (два столбика) ---
        for lx in (-0.13, 0.13):
            leg = make_box_geom('leg', 0.20, 0.20, 0.52, dark)
            root.attachNewNode(leg).setPos(lx, 0, 0.26)

        # --- Туловище ---
        torso = make_box_geom('torso', 0.50, 0.26, 0.56, color)
        root.attachNewNode(torso).setPos(0, 0, 0.84)

        # --- Руки (две тонкие) ---
        for ax in (-0.38, 0.38):
            arm = make_box_geom('arm', 0.17, 0.17, 0.48, dark)
            root.attachNewNode(arm).setPos(ax, 0, 0.78)

        # --- Голова ---
        head = make_box_geom('head', 0.38, 0.38, 0.38, face)
        root.attachNewNode(head).setPos(0, 0, 1.37)

        # --- Оружие в правой руке (небольшой меч/дубина) ---
        blade_col = (0.68, 0.68, 0.72, 1)
        blade = make_box_geom('eblade', 0.05, 0.05, 0.46, blade_col)
        blade_np = root.attachNewNode(blade)
        blade_np.setPos(0.40, 0, 0.60)
        blade_np.setR(20)   # небольшой наклон как при хвате

        root.setPos(enemy.x, enemy.y, enemy.z)
        enemy.node_path = root
        self._enemy_nodes[enemy.id] = root

    # =====================================================================
    # ОРУЖИЕ ОТ ПЕРВОГО ЛИЦА
    # =====================================================================

    def _create_weapon_view(self):
        """Создать/пересоздать вид оружия в руке (пространство камеры)."""
        if self._weapon_np:
            try:
                self._weapon_np.removeNode()
            except Exception:
                pass
            self._weapon_np = None

        inv = self.player.inventory
        wid = inv.equipped_weapon or ''

        # Оружие — дочерний узел camera; X=вправо, Y=вперёд, Z=вверх в camera-space
        # Это гарантирует, что оружие всегда видно независимо от позиции/ориентации
        root = self.camera.attachNewNode('weapon_view')
        # Базовая позиция в покое: правее, вперёд, ниже уровня глаз
        root.setPos(0.22, 0.55, -0.22)
        # P=+25: рукоять к игроку, лезвие направлено вперёд-вверх
        root.setHpr(0, 25, -8)

        if 'sword' in wid or 'blade' in wid or 'dark_sword' in wid:
            handle = make_box_geom('handle', 0.055, 0.055, 0.22, (0.38, 0.24, 0.10, 1))
            root.attachNewNode(handle).setPos(0, 0, -0.11)
            guard = make_box_geom('guard', 0.26, 0.055, 0.07, (0.55, 0.45, 0.15, 1))
            root.attachNewNode(guard).setPos(0, 0, 0.02)
            blade_col = (0.80, 0.82, 0.88, 1) if 'dark' not in wid else (0.35, 0.20, 0.45, 1)
            blade = make_box_geom('blade', 0.055, 0.040, 0.58, blade_col)
            root.attachNewNode(blade).setPos(0, 0, 0.33)
        elif 'axe' in wid:
            shaft = make_box_geom('shaft', 0.050, 0.050, 0.55, (0.35, 0.22, 0.08, 1))
            root.attachNewNode(shaft).setPos(0, 0, 0)
            head_ax = make_box_geom('axehead', 0.28, 0.055, 0.26, (0.72, 0.72, 0.76, 1))
            root.attachNewNode(head_ax).setPos(-0.10, 0, 0.25)
        elif 'dagger' in wid:
            blade = make_box_geom('dblade', 0.050, 0.040, 0.32, (0.82, 0.84, 0.90, 1))
            root.attachNewNode(blade).setPos(0, 0, 0.16)
            handle = make_box_geom('dhandle', 0.052, 0.052, 0.16, (0.30, 0.18, 0.08, 1))
            root.attachNewNode(handle).setPos(0, 0, -0.08)
        elif 'spear' in wid:
            shaft = make_box_geom('shaft', 0.042, 0.042, 0.80, (0.38, 0.24, 0.10, 1))
            root.attachNewNode(shaft).setPos(0, 0, 0)
            tip = make_box_geom('tip', 0.055, 0.040, 0.16, (0.78, 0.78, 0.82, 1))
            root.attachNewNode(tip).setPos(0, 0, 0.48)
        elif 'staff' in wid or 'bow' in wid:
            shaft = make_box_geom('staff', 0.042, 0.042, 0.75, (0.40, 0.26, 0.10, 1))
            root.attachNewNode(shaft).setPos(0, 0, 0)
            orb_col = (0.35, 0.10, 0.70, 1) if 'staff' in wid else (0.55, 0.38, 0.14, 1)
            orb = make_box_geom('orb', 0.12, 0.12, 0.12, orb_col)
            root.attachNewNode(orb).setPos(0, 0, 0.43)
        else:
            fist = make_box_geom('fist', 0.14, 0.12, 0.14, (0.82, 0.62, 0.44, 1))
            root.attachNewNode(fist).setPos(0, 0, 0)

        # Рендеримся поверх всего, без тумана и освещения
        root.setDepthTest(False)
        root.setDepthWrite(False)
        root.setBin('fixed', 100)
        root.setLightOff()
        root.setFogOff()

        self._weapon_np = root
        self._weapon_attack_t = -1.0

    def _trigger_attack_anim(self):
        """Запустить анимацию удара."""
        if self._weapon_attack_t < 0:
            self._weapon_attack_t = 0.0

    def _update_weapon_position(self, dt):
        """Анимация удара оружием в camera-space (позиция относительная камеры)."""
        if not self._weapon_np or not self.player:
            return

        if self._weapon_attack_t >= 0:
            self._weapon_attack_t += dt

        # Базовое положение покоя
        base_y    =  0.55
        base_z    = -0.22
        base_p    =  25.0   # наклон лезвия вперёд
        extra_y   =  0.0
        pitch_add =  0.0

        if self._weapon_attack_t >= 0:
            t = min(1.0, self._weapon_attack_t / 0.30)
            if t < 0.40:
                phase = t / 0.40
                extra_y   =  0.18 * phase
                pitch_add =  35.0 * phase   # лезвие резко идёт вперёд
            else:
                phase = (t - 0.40) / 0.60
                extra_y   =  0.18 * (1.0 - phase)
                pitch_add =  35.0 * (1.0 - phase)
            if t >= 1.0:
                self._weapon_attack_t = -1.0

        self._weapon_np.setPos(0.22, base_y + extra_y, base_z)
        self._weapon_np.setHpr(0, base_p + pitch_add, -8.0)

    def _create_korovan_node(self, korovan):
        """Многосоставная модель корована: повозка + тент + колёса + волы."""
        root = self.render.attachNewNode(f'korovan_{korovan.id}')

        wood  = (0.52, 0.35, 0.12, 1)   # тёмное дерево
        cover = (0.88, 0.84, 0.66, 1)   # грубый холст (тент)
        wheel = (0.22, 0.14, 0.07, 1)   # колёсные обода
        ox    = (0.52, 0.46, 0.34, 1)   # бежево-коричневый скот
        rope  = (0.38, 0.28, 0.12, 1)   # тёмный шест (оглобли)

        # --- Кузов повозки ---
        body = make_box_geom('w_body', 3.4, 1.7, 0.9, wood)
        root.attachNewNode(body).setPos(0, 0, 0.65)

        # --- Дно (усиление снизу) ---
        floor = make_box_geom('w_floor', 3.6, 1.8, 0.14, wood)
        root.attachNewNode(floor).setPos(0, 0, 0.17)

        # --- Тент ---
        tent = make_box_geom('w_tent', 3.0, 1.55, 0.58, cover)
        root.attachNewNode(tent).setPos(0, 0, 1.39)

        # --- 4 колеса (плоские квадраты — грубое приближение) ---
        for wx, wy in ((1.55, 0.82), (-1.55, 0.82),
                       (1.55, -0.82), (-1.55, -0.82)):
            w = make_box_geom('w_wheel', 0.10, 0.55, 0.55, wheel)
            root.attachNewNode(w).setPos(wx, wy, 0.35)

        # --- Ось (две перекладины) ---
        for ax in (1.4, -1.4):
            axle = make_box_geom('w_axle', 0.10, 1.7, 0.10, wood)
            root.attachNewNode(axle).setPos(ax, 0, 0.24)

        # --- Сиденье кучера спереди ---
        seat = make_box_geom('w_seat', 1.0, 1.4, 0.28, wood)
        root.attachNewNode(seat).setPos(2.0, 0, 1.07)

        # --- Оглобли ---
        for oy in (-0.40, 0.40):
            pole = make_box_geom('w_pole', 0.08, 0.08, 1.6, rope)
            pnp = root.attachNewNode(pole)
            pnp.setPos(2.8, oy, 0.30)
            pnp.setP(-12)   # чуть наклонить вперёд

        # --- Два вола ---
        for oy in (-0.65, 0.65):
            # Тело вола
            ob = make_box_geom('ox_body', 0.50, 1.15, 0.46, ox)
            root.attachNewNode(ob).setPos(3.6, oy, 0.48)
            # Голова
            oh = make_box_geom('ox_head', 0.34, 0.42, 0.32, ox)
            root.attachNewNode(oh).setPos(4.30, oy, 0.64)
            # Рога
            horn = make_box_geom('ox_horn', 0.22, 0.05, 0.05, (0.80, 0.76, 0.58, 1))
            root.attachNewNode(horn).setPos(4.30, oy, 0.82)
            # Ноги (2 видимые)
            for lx in (0.18, -0.18):
                leg = make_box_geom('ox_leg', 0.12, 0.12, 0.30, ox)
                root.attachNewNode(leg).setPos(3.6 + lx, oy, 0.15)

        # --- Ярмо (поперечина между волами) ---
        yoke = make_box_geom('w_yoke', 0.08, 1.38, 0.08, rope)
        root.attachNewNode(yoke).setPos(3.6, 0, 0.82)

        gz = self.world.get_height(korovan.x, korovan.y) if self.world else 0.0
        root.setPos(korovan.x, korovan.y, gz)
        korovan._node = root

    def _update_enemy_nodes(self):
        for enemy in self.world.enemies:
            if enemy.node_path:
                if enemy.state != 'dead':
                    # Прижимаем к рельефу ландшафта
                    gz = self.world.get_height(enemy.x, enemy.y)
                    enemy.z = gz
                    enemy.node_path.setPos(enemy.x, enemy.y, gz)
                    enemy.node_path.setH(enemy.heading)
                else:
                    # Труп лежит на земле
                    enemy.node_path.setPos(enemy.x, enemy.y, enemy.z)

    def _update_korovan_nodes(self):
        for korovan in self.world.korovans:
            if hasattr(korovan, '_node') and korovan._node:
                if korovan.alive:
                    gz = self.world.get_height(korovan.x, korovan.y)
                    korovan._node.setPos(korovan.x, korovan.y, gz)
                else:
                    try:
                        korovan._node.removeNode()
                        korovan._node = None
                    except Exception:
                        pass

    # =====================================================================
    # УТИЛИТЫ
    # =====================================================================

    def _fkw(self):
        """Font keyword for DirectGui elements."""
        return {'text_font': self._font} if self._font else {}

    def _load_cyrillic_font(self):
        """Загружает системный шрифт с поддержкой кириллицы."""
        candidates = [
            '/Library/Fonts/Arial Unicode.ttf',           # macOS (установлен)
            '/System/Library/Fonts/Supplemental/Arial.ttf',
            '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',  # Linux
            '/usr/share/fonts/TTF/DejaVuSans.ttf',
        ]
        for path in candidates:
            if os.path.exists(path):
                font = self.loader.loadFont(path)
                if font:
                    TextNode.setDefaultFont(font)
                    return font
        return None

    def _set_window_title(self, title):
        props = WindowProperties()
        props.setTitle(title)
        self.win.requestProperties(props)

    def _clear_gui(self):
        if hasattr(self, '_menu_frame') and self._menu_frame:
            try:
                self._menu_frame.destroy()
            except Exception:
                pass
            self._menu_frame = None
