#!/usr/bin/env python3
"""
Korovany — 3D Action RPG
========================

Управление:
  WASD       — движение
  Мышь       — вращение камеры
  ЛКМ        — атака / ограбление каравАна
  J          — прыжок
  E          — взаимодействие
  T          — торговля
  I          — инвентарь
  1 / 2      — быстрое использование зелий
  F5         — быстрое сохранение
  F9         — быстрая загрузка
  Esc        — пауза / меню

Требования:
  pip install panda3d
"""

import sys
import os

# Убедиться что директория игры в пути
sys.path.insert(0, os.path.dirname(__file__))

# Задаём размер окна ДО создания ShowBase, иначе на Retina-дисплеях
# Panda3D открывается в 800×600 и текст становится нечитаемо мелким
from panda3d.core import loadPrcFileData
loadPrcFileData('', 'win-size 1440 900')
loadPrcFileData('', 'window-title Korovany')
loadPrcFileData('', 'notify-level-cocoadisplay error')  # Глушим спам "Unhandled keypress"

from game.engine import KorovanyGame


def main():
    game = KorovanyGame()
    game.run()


if __name__ == '__main__':
    main()
