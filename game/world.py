"""
Генерация мира: ландшафт, здания, зоны, NPC.
"""
import math
import random

from panda3d.core import (
    NodePath, GeomNode, Geom,
    GeomVertexFormat, GeomVertexData, GeomVertexWriter,
    GeomTriangles,
    LColor, LPoint3f, LVector3f,
    DirectionalLight, AmbientLight,
    Fog, TransparencyAttrib,
    CardMaker,
)

from game.lod_trees import ForestManager
from game.enemy import Enemy, ENEMY_TYPES
from game.korovan import Korovan


# ---------------------------------------------------------------------------
# Геометрия примитивов
# ---------------------------------------------------------------------------

def make_box_geom(name, w, h, d, color=(0.8, 0.8, 0.8, 1)):
    """Создать закрашенный ящик (GeomNode)."""
    hw, hh, hd = w / 2, h / 2, d / 2
    c = LColor(*color)

    fmt = GeomVertexFormat.getV3n3c4()
    vdata = GeomVertexData(name, fmt, Geom.UHStatic)
    vdata.setNumRows(24)

    vert = GeomVertexWriter(vdata, 'vertex')
    norm = GeomVertexWriter(vdata, 'normal')
    clr  = GeomVertexWriter(vdata, 'color')

    faces = [
        # (vertices 4x, normal)
        ([(-hw,-hd,-hh),(hw,-hd,-hh),(hw,-hd,hh),(-hw,-hd,hh)], (0,-1,0)),  # front
        ([( hw, hd,-hh),(-hw,hd,-hh),(-hw,hd,hh),( hw,hd,hh)], (0, 1,0)),  # back
        ([(-hw, hd,-hh),(-hw,-hd,-hh),(-hw,-hd,hh),(-hw,hd,hh)], (-1,0,0)), # left
        ([( hw,-hd,-hh),( hw,hd,-hh),( hw,hd,hh),( hw,-hd,hh)], ( 1,0,0)), # right
        ([(-hw,-hd,-hh),(-hw,hd,-hh),(hw,hd,-hh),(hw,-hd,-hh)], (0,0,-1)),  # bottom
        ([(-hw,-hd, hh),(hw,-hd,hh),(hw,hd,hh),(-hw,hd,hh)],    (0,0, 1)), # top
    ]

    tris = GeomTriangles(Geom.UHStatic)
    idx = 0
    for verts, n in faces:
        for v in verts:
            vert.addData3(*v)
            norm.addData3(*n)
            clr.addData4(c)
        tris.addVertices(idx, idx+1, idx+2)
        tris.addVertices(idx, idx+2, idx+3)
        idx += 4

    geom = Geom(vdata)
    geom.addPrimitive(tris)
    node = GeomNode(name)
    node.addGeom(geom)
    return node


def make_terrain_geom(size=700, segments=22, height_scale=10.0):
    """Простой процедурный ландшафт с умеренным рельефом."""
    step = size / segments
    half = size / 2

    fmt = GeomVertexFormat.getV3n3c4()
    vdata = GeomVertexData('terrain', fmt, Geom.UHStatic)
    rows = (segments + 1) ** 2
    vdata.setNumRows(rows)

    vert = GeomVertexWriter(vdata, 'vertex')
    norm = GeomVertexWriter(vdata, 'normal')
    clr  = GeomVertexWriter(vdata, 'color')

    def height_at(x, y):
        # Зоны дворца и эльфов — почти плоские (±0.4 ед.),
        # чтобы здания не парили и не проваливались
        if x > 130 and y > 130:   # Дворцовая зона
            return (math.sin(x * 0.018) * math.cos(y * 0.018) * 0.35)
        if x < -130 and y < -130:  # Лесная зона эльфов
            return (math.sin(x * 0.018) * math.cos(y * 0.018) * 0.40)

        # Остальная территория — мягкий рельеф ±1.5 ед.
        h = (math.sin(x * 0.012) * math.cos(y * 0.012) * 1.0
             + math.sin(x * 0.025 + 1.0) * math.sin(y * 0.020) * 0.5)
        # Горы в центре (зона злодея)
        d = math.sqrt(x * x + y * y)
        if 18 < d < 85:
            h += ((85 - d) / 67) * height_scale
        return h

    def color_at(x, y, h):
        if h > height_scale * 0.55:
            return LColor(0.78, 0.78, 0.82, 1)  # Снег
        elif h > height_scale * 0.25:
            return LColor(0.42, 0.32, 0.22, 1)  # Скала
        elif y < -130 and x < -130:
            return LColor(0.06, 0.32, 0.06, 1)  # Лес (эльфы)
        elif y > 130 and x > 130:
            return LColor(0.52, 0.54, 0.68, 1)  # Дворцовая зона
        else:
            return LColor(0.38, 0.58, 0.20, 1)  # Трава

    heights = {}
    for iy in range(segments + 1):
        for ix in range(segments + 1):
            x = -half + ix * step
            y = -half + iy * step
            h = height_at(x, y)
            heights[(ix, iy)] = h
            vert.addData3(x, y, h)
            norm.addData3(0, 0, 1)  # Упрощённые нормали
            clr.addData4(color_at(x, y, h))

    tris = GeomTriangles(Geom.UHStatic)
    for iy in range(segments):
        for ix in range(segments):
            i00 = iy * (segments + 1) + ix
            i10 = i00 + 1
            i01 = i00 + (segments + 1)
            i11 = i01 + 1
            tris.addVertices(i00, i10, i11)
            tris.addVertices(i00, i11, i01)

    geom = Geom(vdata)
    geom.addPrimitive(tris)
    node = GeomNode('terrain')
    node.addGeom(geom)
    return node, heights, step, half


# ---------------------------------------------------------------------------
# Небо
# ---------------------------------------------------------------------------

def make_sky_dome(faction_id='guards', radius=900, h_segs=16, v_segs=8):
    """Полусфера неба с вертикальным градиентом цвета."""
    if faction_id == 'villain':
        top_col   = LColor(0.07, 0.03, 0.03, 1)
        horiz_col = LColor(0.20, 0.08, 0.06, 1)
    elif faction_id == 'elves':
        top_col   = LColor(0.26, 0.55, 0.84, 1)
        horiz_col = LColor(0.52, 0.74, 0.65, 1)
    else:
        top_col   = LColor(0.26, 0.54, 0.92, 1)
        horiz_col = LColor(0.62, 0.82, 0.98, 1)

    fmt   = GeomVertexFormat.getV3n3c4()
    vdata = GeomVertexData('sky_dome', fmt, Geom.UHStatic)
    vdata.setNumRows((h_segs + 1) * (v_segs + 1))
    vert = GeomVertexWriter(vdata, 'vertex')
    norm = GeomVertexWriter(vdata, 'normal')
    clr  = GeomVertexWriter(vdata, 'color')

    for vi in range(v_segs + 1):
        t    = vi / v_segs              # 0 = зенит, 1 = горизонт
        elev = math.pi * 0.5 * (1.0 - t)
        cos_e = math.cos(elev)
        sin_e = math.sin(elev)
        r = top_col[0] + (horiz_col[0] - top_col[0]) * t
        g = top_col[1] + (horiz_col[1] - top_col[1]) * t
        b = top_col[2] + (horiz_col[2] - top_col[2]) * t
        for hi in range(h_segs + 1):
            angle = 2.0 * math.pi * hi / h_segs
            x = radius * cos_e * math.cos(angle)
            y = radius * cos_e * math.sin(angle)
            z = radius * sin_e
            vert.addData3(x, y, z)
            norm.addData3(0, 0, -1)  # Нормали внутрь (смотрим изнутри)
            clr.addData4(r, g, b, 1.0)

    tris = GeomTriangles(Geom.UHStatic)
    for vi in range(v_segs):
        for hi in range(h_segs):
            i00 = vi       * (h_segs + 1) + hi
            i10 = vi       * (h_segs + 1) + hi + 1
            i01 = (vi + 1) * (h_segs + 1) + hi
            i11 = (vi + 1) * (h_segs + 1) + hi + 1
            # Обратный порядок = видим изнутри купола
            tris.addVertices(i00, i11, i10)
            tris.addVertices(i00, i01, i11)

    geom = Geom(vdata)
    geom.addPrimitive(tris)
    node = GeomNode('sky_dome')
    node.addGeom(geom)
    return node


def make_sun_disc(radius=28, segments=20, color=(1.0, 0.97, 0.72, 1.0)):
    """Диск солнца (XZ-плоскость, смотрит на камеру через billboard)."""
    fmt   = GeomVertexFormat.getV3n3c4()
    vdata = GeomVertexData('sun_disc', fmt, Geom.UHStatic)
    vdata.setNumRows(segments + 1)
    vert = GeomVertexWriter(vdata, 'vertex')
    norm = GeomVertexWriter(vdata, 'normal')
    clr  = GeomVertexWriter(vdata, 'color')

    vert.addData3(0, 0, 0)
    norm.addData3(0, -1, 0)
    clr.addData4(*color)
    for i in range(segments):
        angle = 2.0 * math.pi * i / segments
        vert.addData3(radius * math.cos(angle), 0, radius * math.sin(angle))
        norm.addData3(0, -1, 0)
        clr.addData4(*color)

    tris = GeomTriangles(Geom.UHStatic)
    for i in range(segments):
        tris.addVertices(0, i + 1, (i + 1) % segments + 1)

    geom = Geom(vdata)
    geom.addPrimitive(tris)
    node = GeomNode('sun_disc')
    node.addGeom(geom)
    return node


# ---------------------------------------------------------------------------
# Здания
# ---------------------------------------------------------------------------

def _building_gz(gh, x, y, w, d):
    """Минимальная высота земли под пятном здания (9 точек).
    Здание ставится на минимум - 1.0, чтобы «вросло» в любой рельеф."""
    hw, hd = w / 2, d / 2
    pts = [
        (x,       y      ),
        (x - hw,  y - hd ), (x + hw,  y - hd ),
        (x - hw,  y + hd ), (x + hw,  y + hd ),
        (x,       y - hd ), (x,       y + hd ),
        (x - hw,  y      ), (x + hw,  y      ),
    ]
    return min(gh(px, py) for px, py in pts) - 1.0


def _add_building(parent, x, y, w, d, h, color, name='building', gz=0.0):
    """gz — минимальная высота земли под зданием.
    Основание здания ставится на gz, центр по Z = gz + h/2."""
    node = make_box_geom(name, w, d, h, color)
    np = parent.attachNewNode(node)
    np.setPos(x, y, gz + h / 2)
    return np


def build_elf_village(parent, cx, cy, get_height=None):
    """Деревянные домики эльфов."""
    gh = get_height or (lambda x, y: 0.0)
    positions = [
        (cx - 20, cy - 15), (cx + 20, cy - 10),
        (cx - 10, cy + 25), (cx + 15, cy + 20),
        (cx,      cy - 30), (cx + 30, cy + 5),
        (cx - 30, cy + 5),
    ]
    nodes = []
    for x, y in positions:
        w, d = random.uniform(5, 9), random.uniform(5, 9)
        h  = random.uniform(4, 7)
        gz = _building_gz(gh, x, y, w, d)
        col = (0.45, 0.3, 0.15, 1)
        np = _add_building(parent, x, y, w, d, h, col, 'elf_house', gz)
        nodes.append(np)
        # Крыша — ставится на вершину стен
        roof_gz = _building_gz(gh, x, y, w + 0.5, d + 0.5)
        roof = make_box_geom('roof', w + 0.5, d + 0.5, 2.5, (0.3, 0.15, 0.05, 1))
        roof_np = parent.attachNewNode(roof)
        roof_np.setPos(x, y, roof_gz + h + 1.25 + 1.0)
        nodes.append(roof_np)
    return nodes


def build_palace(parent, cx, cy, get_height=None):
    """Дворец."""
    gh = get_height or (lambda x, y: 0.0)
    nodes = []
    gz = _building_gz(gh, cx, cy, 30, 30)
    np = _add_building(parent, cx, cy, 30, 30, 20, (0.85, 0.85, 0.75, 1), 'palace_main', gz)
    nodes.append(np)
    for ddx, ddy in ((-15, -15), (15, -15), (-15, 15), (15, 15)):
        tx, ty = cx + ddx, cy + ddy
        tgz = _building_gz(gh, tx, ty, 8, 8)
        tower = _add_building(parent, tx, ty, 8, 8, 28,
                              (0.9, 0.88, 0.78, 1), 'tower', tgz)
        nodes.append(tower)
    for i in range(8):
        angle = i * math.pi / 4
        wx = cx + math.cos(angle) * 22
        wy = cy + math.sin(angle) * 22
        wgz = _building_gz(gh, wx, wy, 3, 8)
        wall = _add_building(parent, wx, wy, 3, 8, 10,
                             (0.75, 0.72, 0.65, 1), 'wall', wgz)
        nodes.append(wall)
    return nodes


def build_villain_fort(parent, cx, cy, get_height=None):
    """Старый горный форт злодея."""
    gh = get_height or (lambda x, y: 0.0)
    nodes = []
    gz = _building_gz(gh, cx, cy, 25, 25)
    np = _add_building(parent, cx, cy, 25, 25, 15,
                       (0.25, 0.15, 0.15, 1), 'fort_main', gz)
    nodes.append(np)
    for ddx, ddy in ((-13, -13), (13, -13), (-13, 13), (13, 13)):
        tx, ty = cx + ddx, cy + ddy
        tgz = _building_gz(gh, tx, ty, 6, 6)
        t = _add_building(parent, tx, ty, 6, 6, 22,
                          (0.2, 0.1, 0.1, 1), 'dark_tower', tgz)
        nodes.append(t)
    return nodes


def build_human_town(parent, cx, cy, get_height=None):
    """Нейтральный торговый город."""
    gh = get_height or (lambda x, y: 0.0)
    nodes = []
    for i in range(10):
        angle = i * 2 * math.pi / 10
        x = cx + math.cos(angle) * random.uniform(12, 25)
        y = cy + math.sin(angle) * random.uniform(12, 25)
        w, d = random.uniform(5, 12), random.uniform(5, 12)
        h  = random.uniform(4, 9)
        gz = _building_gz(gh, x, y, w, d)
        col = (random.uniform(0.7, 0.9), random.uniform(0.65, 0.85),
               random.uniform(0.5, 0.7), 1)
        np = _add_building(parent, x, y, w, d, h, col, f'house_{i}', gz)
        nodes.append(np)
    return nodes


# ---------------------------------------------------------------------------
# Мир
# ---------------------------------------------------------------------------

class World:
    def __init__(self, render, base):
        self.render = render
        self.base = base
        self.terrain_node = None
        self.heights = {}
        self.step = 1
        self.half = 350
        self.buildings = []
        self.forest_manager = None
        self.enemies = []
        self.korovans = []
        self._light_nodes = []
        self._sky_dome_np = None  # следует за камерой каждый кадр
        self._sky_nodes   = []    # солнце, облака и т.п.

    # ------------------------------------------------------------------
    def setup(self, faction_id='elves'):
        self._setup_lighting()
        self._setup_fog(faction_id)
        self._setup_terrain()
        self._setup_buildings()
        self._setup_forest(faction_id)
        self._setup_sky(faction_id)
        self._spawn_enemies(faction_id)
        self._spawn_korovans()

    # ------------------------------------------------------------------
    def _setup_lighting(self):
        dlight = DirectionalLight('sun')
        dlight.setColor(LColor(1.0, 0.95, 0.85, 1))
        dlnp = self.render.attachNewNode(dlight)
        dlnp.setHpr(45, -60, 0)
        self.render.setLight(dlnp)
        self._light_nodes.append(dlnp)

        alight = AmbientLight('sky')
        alight.setColor(LColor(0.3, 0.35, 0.4, 1))
        alnp = self.render.attachNewNode(alight)
        self.render.setLight(alnp)
        self._light_nodes.append(alnp)

    def _setup_fog(self, faction_id):
        fog = Fog('world_fog')
        if faction_id == 'elves':
            fog.setColor(0.40, 0.60, 0.50)   # атмосферный лесной дымок (не зелёный)
            fog.setLinearRange(50, 200)
        elif faction_id == 'villain':
            fog.setColor(0.10, 0.05, 0.05)
            fog.setLinearRange(30, 150)
        else:
            fog.setColor(0.60, 0.75, 0.90)   # лёгкий голубоватый туман
            fog.setLinearRange(60, 320)
        self.render.setFog(fog)

    def _setup_sky(self, faction_id):
        """Купол неба, солнце и облака."""
        # --- Купол ---
        sky_node = make_sky_dome(faction_id)
        sky_np = self.render.attachNewNode(sky_node)
        sky_np.setPos(self.base.camera.getPos())   # сразу на позицию камеры
        sky_np.setTwoSided(True)     # видим изнутри
        sky_np.setLightOff()
        sky_np.setFogOff()
        sky_np.setDepthTest(False)
        sky_np.setDepthWrite(False)
        sky_np.setBin('background', 1)
        self._sky_dome_np = sky_np
        self._sky_nodes.append(sky_np)

        if faction_id != 'villain':
            # --- Солнце ---
            sun_node = make_sun_disc()
            sun_np = self.render.attachNewNode(sun_node)
            # Фиксированная мировая позиция высоко на СВ — совпадает с направлением DirectionalLight
            sun_np.setPos(550, 550, 600)
            sun_np.setBillboardPointEye()   # всегда смотрит на камеру
            sun_np.setLightOff()
            sun_np.setFogOff()
            sun_np.setDepthTest(False)
            sun_np.setDepthWrite(False)
            sun_np.setBin('background', 2)
            self._sky_nodes.append(sun_np)

            # --- Облака ---
            rng = random.Random(42)
            for i in range(18):
                w  = rng.uniform(70, 160)
                d  = rng.uniform(50, 110)
                cx = rng.uniform(-500, 500)
                cy = rng.uniform(-500, 500)
                cz = rng.uniform(160, 230)
                if faction_id == 'elves':
                    a = rng.uniform(0.25, 0.50)
                    col = (0.92, 0.97, 0.92, a)
                else:
                    a = rng.uniform(0.35, 0.65)
                    col = (1.0, 1.0, 1.0, a)
                c_node = make_box_geom(f'cloud_{i}', w, d, 3.0, col)
                c_np = self.render.attachNewNode(c_node)
                c_np.setPos(cx, cy, cz)
                c_np.setLightOff()
                c_np.setFogOff()
                c_np.setTransparency(TransparencyAttrib.MAlpha)
                c_np.setBin('transparent', 10)
                self._sky_nodes.append(c_np)

    def _setup_terrain(self):
        geom_node, self.heights, self.step, self.half = make_terrain_geom()
        self.terrain_node = self.render.attachNewNode(geom_node)
        # Объединить ландшафт в минимум draw-calls
        self.terrain_node.flattenStrong()

    def _setup_buildings(self):
        gh = self.get_height   # передаём метод высоты
        self.buildings += build_elf_village(self.render, -250, -250, gh)
        self.buildings += build_palace(self.render, 270, 270, gh)
        self.buildings += build_villain_fort(self.render, 20, 20, gh)
        self.buildings += build_human_town(self.render, 0, 0, gh)

    def _setup_forest(self, faction_id):
        self.forest_manager = ForestManager(self.render, faction_id)
        # Густой эльфийский лес — максимум 200 деревьев
        self.forest_manager.generate_dense_forest(-250, -250, 140,
                                                   density=0.006, max_trees=200)
        # Редкий лес в нейтральной зоне — до 50 деревьев
        self.forest_manager.generate_sparse_forest(0, 0, 100,
                                                    density=0.002, max_trees=50)
        # Мёртвые деревья у злодея — до 40
        self.forest_manager.generate_zone_forest(
            20, 20, 80, density=0.003, max_trees=40,
            tree_types=['dead', 'dead', 'pine'])

    def _spawn_enemies(self, player_faction):
        """Расставить врагов по зонам."""
        spawn_data = [
            # (type, cx, cy, count)
            ('elf_warrior',     -250, -250, 4),
            ('elf_archer',      -230, -270, 3),
            ('palace_guard',     270,  270, 5),
            ('palace_captain',   270,  265, 1),
            ('dark_soldier',      20,   20, 4),
            ('dark_spy',          10,   15, 2),
            ('dark_lord_minion',  25,   25, 1),
            ('neutral_bandit',    50,  -50, 3),
            ('neutral_bandit',   -50,   50, 2),
        ]
        for etype, cx, cy, count in spawn_data:
            for _ in range(count):
                x = cx + random.uniform(-25, 25)
                y = cy + random.uniform(-25, 25)
                z = self.get_height(x, y) + 1.0
                enemy = Enemy(etype, x, y, z)
                self.enemies.append(enemy)

    def _spawn_korovans(self):
        for i in range(5):
            korovan = Korovan(i + 1, difficulty=random.uniform(0.8, 1.5))
            self.korovans.append(korovan)

    # ------------------------------------------------------------------
    def cleanup(self):
        """Удалить все узлы мира из сцены (без затрагивания камеры)."""
        if self.terrain_node:
            self.terrain_node.removeNode()
            self.terrain_node = None

        for b in self.buildings:
            try:
                b.removeNode()
            except Exception:
                pass
        self.buildings.clear()

        if self.forest_manager:
            self.forest_manager.clear()
            self.forest_manager = None

        for ln in self._light_nodes:
            try:
                self.render.clearLight(ln)
                ln.removeNode()
            except Exception:
                pass
        self._light_nodes.clear()

        self.render.clearFog()

        for sn in self._sky_nodes:
            try:
                sn.removeNode()
            except Exception:
                pass
        self._sky_nodes.clear()
        self._sky_dome_np = None

        for e in self.enemies:
            if e.node_path:
                try:
                    e.node_path.removeNode()
                except Exception:
                    pass
                e.node_path = None
        self.enemies.clear()

        for k in self.korovans:
            if hasattr(k, '_node') and k._node:
                try:
                    k._node.removeNode()
                except Exception:
                    pass
                k._node = None
        self.korovans.clear()

    # ------------------------------------------------------------------
    def get_height(self, x, y):
        """Билинейная интерполяция высоты ландшафта в точке (x, y)."""
        max_idx = int(self.half * 2 / self.step)

        fx = (x + self.half) / self.step
        fy = (y + self.half) / self.step

        ix0 = max(0, min(int(fx),     max_idx - 1))
        iy0 = max(0, min(int(fy),     max_idx - 1))
        ix1 = max(0, min(ix0 + 1,     max_idx))
        iy1 = max(0, min(iy0 + 1,     max_idx))

        tx = fx - int(fx)   # дробная часть [0..1]
        ty = fy - int(fy)

        h00 = self.heights.get((ix0, iy0), 0.0)
        h10 = self.heights.get((ix1, iy0), 0.0)
        h01 = self.heights.get((ix0, iy1), 0.0)
        h11 = self.heights.get((ix1, iy1), 0.0)

        return (h00 * (1 - tx) * (1 - ty)
                + h10 * tx * (1 - ty)
                + h01 * (1 - tx) * ty
                + h11 * tx * ty)

    def update(self, dt, player_x, player_y, player_dead, player_faction):
        # Купол неба следует за камерой (остаётся всегда вокруг игрока)
        if self._sky_dome_np:
            self._sky_dome_np.setPos(self.base.camera.getPos())

        # Обновить корованы
        for k in self.korovans:
            k.update(dt)

        # Обновить врагов
        attacks = []
        for enemy in self.enemies:
            if enemy.state == 'dead':
                continue
            hostile = self._is_hostile(enemy.faction, player_faction)
            result = enemy.update(dt, player_x, player_y, player_dead, hostile)
            if result and result[0] == 'attack':
                attacks.append((enemy, result[1]))

        # Разделить слипшихся врагов (separation steering)
        live = [e for e in self.enemies if e.state != 'dead']
        for i in range(len(live)):
            for j in range(i + 1, len(live)):
                a, b = live[i], live[j]
                dx, dy = a.x - b.x, a.y - b.y
                dist = math.sqrt(dx * dx + dy * dy)
                if 0 < dist < 1.2:
                    push = (1.2 - dist) * 0.5
                    nx, ny = dx / dist, dy / dist
                    a.x += nx * push
                    a.y += ny * push
                    b.x -= nx * push
                    b.y -= ny * push

        return attacks

    def _is_hostile(self, enemy_faction, player_faction):
        from game.factions import FACTIONS
        pdata = FACTIONS.get(player_faction, {})
        return enemy_faction in pdata.get('enemies', [])

    def get_nearby_enemies(self, x, y, radius=5.0):
        result = []
        for e in self.enemies:
            if e.state != 'dead':
                import math
                d = math.sqrt((e.x - x)**2 + (e.y - y)**2)
                if d <= radius:
                    result.append((e, d))
        return sorted(result, key=lambda t: t[1])

    def get_nearby_korovans(self, x, y, radius=15.0):
        result = []
        for k in self.korovans:
            if k.alive and not k.looted:
                d = math.sqrt((k.x - x)**2 + (k.y - y)**2)
                if d <= radius:
                    result.append((k, d))
        return sorted(result, key=lambda t: t[1])

    def get_zone_at(self, x, y):
        """Определить зону по координатам."""
        import math
        # Эльфийский лес — нижний-левый квадрант
        if x < -100 and y < -100:
            return 'elf_zone'
        # Дворец — верхний-правый квадрант
        if x > 100 and y > 100:
            return 'palace_zone'
        # Горы — центр (злодей поднялся на горы)
        if math.sqrt(x**2 + y**2) < 70:
            return 'villain_zone'
        # Остальное — нейтраль
        return 'human_zone'
