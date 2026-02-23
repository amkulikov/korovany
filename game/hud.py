"""
HUD — интерфейс поверх экрана (DirectGUI).
"""
from direct.gui.DirectGui import (
    DirectLabel, DirectFrame, DirectButton, DirectScrolledList,
    DGG,
)
from panda3d.core import LColor, TransparencyAttrib, TextNode


class HUD:
    """Игровой интерфейс: HP, карта, лог, инвентарь, части тела."""

    def __init__(self, base, font=None):
        self.base = base
        self.aspect2d = base.aspect2d
        self._font = font        # Шрифт с кириллицей
        self._labels = {}
        self._frames = {}
        self._visible_panels = set()
        self._msg_label = None
        self._msg_timer = 0.0
        self._msg_duration = 0.0

        self._build_main_hud()
        self._build_body_panel()
        self._build_combat_log()
        self._build_minimap()
        self._build_crosshair()
        self._build_objectives()
        self._build_enemy_focus()

    # ------------------------------------------------------------------
    # Вспомогательный метод — создать подпись с нужным шрифтом
    # ------------------------------------------------------------------

    def _lbl(self, parent, text, pos, scale=0.045,
             fg=(1, 1, 1, 1), align=TextNode.ALeft):
        kw = {}
        if self._font:
            kw['text_font'] = self._font
        return DirectLabel(
            parent=parent, text=text, pos=pos, scale=scale,
            text_fg=fg, text_align=align,
            frameColor=(0, 0, 0, 0), relief=None,
            **kw,
        )

    def _btn(self, parent, text, pos, scale, frame_size, text_fg,
             frame_color, command, extra_args=None, align=None):
        kw = {}
        if self._font:
            kw['text_font'] = self._font
        if align is not None:
            kw['text_align'] = align
        return DirectButton(
            parent=parent, text=text, pos=pos, scale=scale,
            frameSize=frame_size, text_fg=text_fg,
            frameColor=frame_color,
            command=command, extraArgs=extra_args or [],
            relief=DGG.RAISED,
            rolloverSound=None, clickSound=None,
            **kw,
        )

    # ------------------------------------------------------------------
    # Строительство элементов
    # ------------------------------------------------------------------

    def _build_main_hud(self):
        """Основная панель: HP, оружие, броня, золото, зона."""
        # Привязка к нижнему-левому углу: pos смещает центр на 0.47/0.27 от угла внутрь
        bg = DirectFrame(
            parent=self.base.a2dBottomLeft,
            frameSize=(-0.45, 0.45, -0.25, 0.25),
            frameColor=(0, 0, 0, 0.55),
            pos=(0.47, 0, 0.27),
        )
        self._frames['main'] = bg

        self._labels['hp']      = self._lbl(bg, 'HP: ---',       (-0.42, 0,  0.20), fg=(0.3, 1, 0.3, 1))
        self._labels['faction'] = self._lbl(bg, 'Фракция: ---',  (-0.42, 0,  0.13))
        self._labels['zone']    = self._lbl(bg, 'Зона: ---',     (-0.42, 0,  0.06))
        self._labels['weapon']  = self._lbl(bg, 'Оружие: ---',   (-0.42, 0, -0.01))
        self._labels['armor']   = self._lbl(bg, 'Броня: ---',    (-0.42, 0, -0.08))
        self._labels['gold']    = self._lbl(bg, 'Золото: 0',     (-0.42, 0, -0.15), fg=(1, 0.85, 0.2, 1))
        self._labels['kills']   = self._lbl(bg, 'Убито: 0',      (-0.42, 0, -0.22))

    def _build_body_panel(self):
        """Панель состояния частей тела (правая сторона)."""
        # Привязка к правому краю по центру: pos=(-0.42) → правый край в 0.02 от экрана
        bg = DirectFrame(
            parent=self.base.a2dRightCenter,
            frameSize=(-0.40, 0.40, -0.38, 0.38),
            frameColor=(0.05, 0.05, 0.1, 0.65),
            pos=(-0.42, 0, 0.0),
        )
        self._frames['body'] = bg
        self._lbl(bg, '=== ТЕЛО ===', (-0.37, 0, 0.33), fg=(1, 0.9, 0.5, 1))

        parts_order = [
            'head', 'torso', 'right_arm', 'left_arm',
            'right_leg', 'left_leg', 'right_eye', 'left_eye',
        ]
        for i, part in enumerate(parts_order):
            y = 0.25 - i * 0.08
            self._labels[f'body_{part}'] = self._lbl(
                bg, f'{part}: ?', (-0.37, 0, y), scale=0.038)

        self._labels['bleed_warn'] = self._lbl(
            bg, '', (-0.37, 0, -0.32), fg=(1, 0.1, 0.1, 1), scale=0.048)

    def _build_combat_log(self):
        """Лог боя — внизу по центру."""
        # Привязка к нижнему центру: нижний край в 0.02 от дна экрана
        bg = DirectFrame(
            parent=self.base.a2dBottomCenter,
            frameSize=(-0.65, 0.65, -0.18, 0.18),
            frameColor=(0, 0, 0, 0.45),
            pos=(0, 0, 0.20),
        )
        self._frames['log'] = bg
        self._labels['log'] = self._lbl(bg, '', (-0.62, 0, 0.10), scale=0.038)

    def _build_minimap(self):
        """Мини-карта — правый верхний угол."""
        S = 0.28   # полуразмер карты
        bg = DirectFrame(
            parent=self.base.a2dTopRight,
            frameSize=(-S, S, -S, S),
            frameColor=(0.06, 0.06, 0.10, 0.88),
            pos=(-S - 0.02, 0, -(S + 0.02)),
        )
        self._frames['minimap'] = bg
        self._lbl(bg, 'КАРТА', (0, 0, S - 0.04), scale=0.036,
                  fg=(0.9, 0.9, 0.5, 1), align=TextNode.ACenter)

        # Подложка зон (закрашенные прямоугольники)
        zone_defs = [
            # (label, x_map, y_map, color, описание)
            ('Эльфы',   -250, -250, (0.10, 0.60, 0.10, 1)),
            ('Дворец',   270,  270, (0.25, 0.25, 0.80, 1)),
            ('Злодей',    20,   20, (0.70, 0.10, 0.10, 1)),
            ('Люди',     -40,   80, (0.60, 0.55, 0.30, 1)),
        ]
        scale = (S - 0.05) / 350.0
        for label, xw, yw, col in zone_defs:
            mx = xw * scale
            my = yw * scale
            # Ограничить в пределах карты
            mx = max(-S + 0.05, min(S - 0.05, mx))
            my = max(-S + 0.04, min(S - 0.06, my))
            self._lbl(bg, label, (mx, 0, my), fg=col, scale=0.030,
                      align=TextNode.ACenter)

        # Пул точек врагов (до 20 красных точек)
        self._minimap_enemy_dots = []
        for _ in range(20):
            dot = self._lbl(bg, '•', (0, 0, -999), fg=(1, 0.2, 0.2, 1), scale=0.045)
            self._minimap_enemy_dots.append(dot)

        # Пул точек корованов (до 5 жёлтых точек)
        self._minimap_korovan_dots = []
        for _ in range(5):
            dot = self._lbl(bg, '▲', (0, 0, -999), fg=(1, 0.85, 0.1, 1), scale=0.038)
            self._minimap_korovan_dots.append(dot)

        # Игрок
        self._labels['minimap_player'] = self._lbl(
            bg, '✦', (0, 0, 0), fg=(1, 1, 0, 1), scale=0.060,
            align=TextNode.ACenter)

        # Легенда
        self._lbl(bg, '• враги  ▲ корованы  ✦ ты',
                  (0, 0, -(S - 0.03)), scale=0.026,
                  fg=(0.7, 0.7, 0.7, 1), align=TextNode.ACenter)

    def _build_crosshair(self):
        """Прицел."""
        kw = {'text_font': self._font} if self._font else {}
        self._labels['crosshair'] = DirectLabel(
            parent=self.aspect2d,
            text='+',
            pos=(0, 0, 0),
            scale=0.07,
            text_fg=(1, 1, 1, 0.8),
            frameColor=(0, 0, 0, 0),
            relief=None,
            **kw,
        )

    def _build_objectives(self):
        """Задачи фракции — левый верхний угол."""
        # Привязка к верхнему-левому углу: левый край в 0.02, верхний в 0.03 от угла
        bg = DirectFrame(
            parent=self.base.a2dTopLeft,
            frameSize=(-0.50, 0.50, -0.28, 0.26),
            frameColor=(0, 0.05, 0, 0.55),
            pos=(0.52, 0, -0.29),
        )
        self._frames['objectives'] = bg
        self._lbl(bg, 'ЗАДАЧИ:', (-0.47, 0, 0.21), fg=(0.8, 1, 0.6, 1), scale=0.040)
        for i in range(4):
            self._labels[f'obj_{i}'] = self._lbl(
                bg, '', (-0.47, 0, 0.12 - i * 0.09), scale=0.033)

    def _build_enemy_focus(self):
        """Полоска HP ближайшего врага — по центру вверху."""
        bg = DirectFrame(
            parent=self.base.a2dTopCenter,
            frameSize=(-0.40, 0.40, -0.065, 0.065),
            frameColor=(0, 0, 0, 0.62),
            pos=(0, 0, -0.10),
        )
        self._frames['enemy_focus'] = bg
        kw = {'text_font': self._font} if self._font else {}
        self._labels['enemy_focus_name'] = DirectLabel(
            parent=bg, text='', pos=(0, 0, 0.012), scale=0.040,
            text_fg=(1, 0.5, 0.5, 1), text_align=TextNode.ACenter,
            frameColor=(0, 0, 0, 0), relief=None, **kw,
        )
        self._labels['enemy_focus_bar'] = DirectLabel(
            parent=bg, text='', pos=(0, 0, -0.030), scale=0.032,
            text_fg=(0.3, 1, 0.3, 1), text_align=TextNode.ACenter,
            frameColor=(0, 0, 0, 0), relief=None, **kw,
        )
        bg.hide()

    # ------------------------------------------------------------------
    # Обновление
    # ------------------------------------------------------------------

    def update(self, player, world, combat_log):
        total_hp = player.body.get_total_hp()
        max_hp   = player.body.get_max_total_hp()
        hp_color = (
            (0.3, 1, 0.3, 1) if total_hp > max_hp * 0.5 else
            (1, 0.7, 0.1, 1) if total_hp > max_hp * 0.25 else
            (1, 0.1, 0.1, 1)
        )

        self._labels['hp']['text']      = f'HP: {total_hp}/{max_hp}'
        self._labels['hp']['text_fg']   = hp_color
        self._labels['faction']['text'] = f'Фракция: {player.get_faction_name()}'
        self._labels['zone']['text']    = f'Зона: {world.get_zone_at(player.pos_x, player.pos_y)}'
        self._labels['weapon']['text']  = f'Оружие: {player.inventory.get_weapon_name()}'
        self._labels['armor']['text']   = f'Броня: {player.inventory.get_armor_name()}'
        self._labels['gold']['text']    = f'Золото: {player.inventory.gold}'
        self._labels['kills']['text']   = f'Убито: {player.kills}'

        # Части тела
        names = {
            'head': 'Голова',    'torso': 'Туловище',
            'right_arm': 'П.Рука', 'left_arm': 'Л.Рука',
            'right_leg': 'П.Нога', 'left_leg': 'Л.Нога',
            'right_eye': 'П.Глаз', 'left_eye': 'Л.Глаз',
        }
        for key, display in names.items():
            part = player.body.parts[key]
            icon = part.short_status()
            col = (
                (1, 0.1, 0.1, 1) if icon == 'X' else
                (1, 0.7, 0.1, 1) if icon == '~' else
                (0.5, 0.8, 1.0, 1) if icon == 'P' else
                (0.7, 1, 0.7, 1)
            )
            self._labels[f'body_{key}']['text']    = f'{icon} {display}: {part.hp}/{part.max_hp}'
            self._labels[f'body_{key}']['text_fg'] = col

        # Кровотечение
        bleeding = any(p.bleeding for p in player.body.parts.values())
        self._labels['bleed_warn']['text'] = 'КРОВОТЕЧЕНИЕ!' if bleeding else ''

        # Лог боя
        self._labels['log']['text'] = combat_log.get_text()

        # Задачи
        objectives = player.get_objectives()
        for i in range(4):
            self._labels[f'obj_{i}']['text'] = (
                f'- {objectives[i]}' if i < len(objectives) else '')

        # Мини-карта и HP фокуса
        self._update_minimap(player, world)
        self._update_enemy_focus(world, player)

    # ------------------------------------------------------------------

    def _update_minimap(self, player, world):
        """Обновить позицию игрока, врагов и корованов на миникарте."""
        S = 0.28
        scale = (S - 0.05) / 350.0

        # Игрок
        px = max(-(S-0.04), min(S-0.04, player.pos_x * scale))
        py = max(-(S-0.04), min(S-0.04, player.pos_y * scale))
        self._labels['minimap_player'].setPos(px, 0, py)

        # Враги
        enemies = [e for e in world.enemies if e.state != 'dead']
        for i, dot in enumerate(self._minimap_enemy_dots):
            if i < len(enemies):
                e = enemies[i]
                ex = max(-(S-0.04), min(S-0.04, e.x * scale))
                ey = max(-(S-0.04), min(S-0.04, e.y * scale))
                dot.setPos(ex, 0, ey)
            else:
                dot.setPos(0, 0, -999)   # Спрятать лишние

        # Корованы
        korovans = [k for k in world.korovans if k.alive and not k.looted]
        for i, dot in enumerate(self._minimap_korovan_dots):
            if i < len(korovans):
                k = korovans[i]
                kx = max(-(S-0.04), min(S-0.04, k.x * scale))
                ky = max(-(S-0.04), min(S-0.04, k.y * scale))
                dot.setPos(kx, 0, ky)
            else:
                dot.setPos(0, 0, -999)

    def _update_enemy_focus(self, world, player):
        """Показать HP ближайшего врага (до 15 ед.)."""
        frame = self._frames.get('enemy_focus')
        if not frame:
            return
        nearby = world.get_nearby_enemies(player.pos_x, player.pos_y, radius=15.0)
        if not nearby:
            frame.hide()
            return

        enemy = nearby[0][0]
        frame.show()
        pct = max(0.0, enemy.hp / enemy.max_hp)
        filled = int(round(pct * 14))
        bar = '█' * filled + '░' * (14 - filled)
        col = (
            (0.3, 1.0, 0.3, 1) if pct > 0.5 else
            (1.0, 0.7, 0.1, 1) if pct > 0.25 else
            (1.0, 0.2, 0.2, 1)
        )
        self._labels['enemy_focus_name']['text'] = f'{enemy.name}'
        self._labels['enemy_focus_bar']['text']  = f'{bar}  {enemy.hp}/{enemy.max_hp}'
        self._labels['enemy_focus_bar']['text_fg'] = col

    # ------------------------------------------------------------------

    def show_message(self, text, color=(1, 1, 0, 1), duration=3.0):
        """Показать временное сообщение по центру экрана."""
        if self._msg_label:
            self._msg_label.destroy()
        kw = {'text_font': self._font} if self._font else {}
        self._msg_label = DirectLabel(
            parent=self.aspect2d,
            text=text,
            pos=(0, 0, 0.3),
            scale=0.065,
            text_fg=color,
            frameColor=(0, 0, 0, 0.6),
            text_wordwrap=25,
            **kw,
        )
        self._msg_duration = duration
        self._msg_timer = 0.0

    def tick_message(self, dt):
        if self._msg_label:
            self._msg_timer += dt
            if self._msg_timer >= self._msg_duration:
                self._msg_label.destroy()
                self._msg_label = None

    def destroy(self):
        for frame in self._frames.values():
            try:
                frame.destroy()
            except Exception:
                pass
        for lbl in self._labels.values():
            try:
                lbl.destroy()
            except Exception:
                pass
        if self._msg_label:
            try:
                self._msg_label.destroy()
            except Exception:
                pass
