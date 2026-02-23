"""
Деревья — простые оси-билборды (быстро и без LOD-оверхеда).

Для видеокарты: каждое дерево = один ColoredCard + BillboardAxis.
При желании переключается на 3D-геометрию вблизи через LODNode,
но по умолчанию используем только billboard для производительности.
"""
import math
import random

from panda3d.core import (
    NodePath, LODNode,
    GeomNode, Geom,
    GeomVertexFormat, GeomVertexData, GeomVertexWriter,
    GeomTriangles,
    CardMaker,
    LColor, LVector3f,
)


# ---------------------------------------------------------------------------
# 3D-геометрия (только для деревьев ближнего LOD-уровня)
# ---------------------------------------------------------------------------

def _make_cylinder(name, radius, height, sides=6, color=(0.4, 0.25, 0.1, 1)):
    fmt = GeomVertexFormat.getV3n3c4()
    vdata = GeomVertexData(name, fmt, Geom.UHStatic)
    vdata.setNumRows(sides * 2)
    vert = GeomVertexWriter(vdata, 'vertex')
    norm = GeomVertexWriter(vdata, 'normal')
    clr  = GeomVertexWriter(vdata, 'color')
    c = LColor(*color)
    for i in range(sides):
        a = 2 * math.pi * i / sides
        x, y = math.cos(a) * radius, math.sin(a) * radius
        for z in (0.0, height):
            vert.addData3(x, y, z)
            norm.addData3(math.cos(a), math.sin(a), 0)
            clr.addData4(c)
    tris = GeomTriangles(Geom.UHStatic)
    for i in range(sides):
        n = (i + 1) % sides
        b0, b1, t0, t1 = i*2, n*2, i*2+1, n*2+1
        tris.addVertices(b0, b1, t0)
        tris.addVertices(b1, t1, t0)
    geom = Geom(vdata); geom.addPrimitive(tris)
    node = GeomNode(name); node.addGeom(geom)
    return NodePath(node)


def _make_cone(name, radius, height, sides=6, color=(0.1, 0.55, 0.1, 1)):
    fmt = GeomVertexFormat.getV3n3c4()
    vdata = GeomVertexData(name, fmt, Geom.UHStatic)
    vdata.setNumRows(sides + 1)
    vert = GeomVertexWriter(vdata, 'vertex')
    norm = GeomVertexWriter(vdata, 'normal')
    clr  = GeomVertexWriter(vdata, 'color')
    c = LColor(*color)
    for i in range(sides):
        a = 2 * math.pi * i / sides
        vert.addData3(math.cos(a) * radius, math.sin(a) * radius, 0.0)
        norm.addData3(math.cos(a), math.sin(a), 0.5)
        clr.addData4(c)
    vert.addData3(0, 0, height); norm.addData3(0, 0, 1); clr.addData4(c)
    apex = sides
    tris = GeomTriangles(Geom.UHStatic)
    for i in range(sides):
        tris.addVertices(i, (i+1) % sides, apex)
    geom = Geom(vdata); geom.addPrimitive(tris)
    node = GeomNode(name); node.addGeom(geom)
    return NodePath(node)


# ---------------------------------------------------------------------------
# Билборд-дерево (основной быстрый вариант)
# ---------------------------------------------------------------------------

def _make_billboard(parent, x, y, w, h, color):
    cm = CardMaker('tree')
    cm.setFrame(-w / 2, w / 2, 0, h)
    np = parent.attachNewNode(cm.generate())
    np.setPos(x, y, 0)
    np.setColor(*color)
    np.setBillboardAxis()      # Всегда смотрит на камеру по вертикальной оси
    return np


# ---------------------------------------------------------------------------
# Одно дерево с опциональным LOD
# ---------------------------------------------------------------------------

TREE_PARAMS = {
    'pine': dict(
        trunk_h=(1.5, 2.5), crown_h=(4.0, 7.0), crown_r=(1.2, 2.2),
        trunk_r=0.22,
        trunk_col=(0.35, 0.20, 0.08, 1), crown_col=(0.05, 0.42, 0.05, 1),
        bb_col=(0.08, 0.50, 0.08, 1),
    ),
    'oak': dict(
        trunk_h=(1.5, 2.8), crown_h=(3.5, 5.5), crown_r=(1.8, 3.2),
        trunk_r=0.30,
        trunk_col=(0.30, 0.18, 0.06, 1), crown_col=(0.20, 0.48, 0.08, 1),
        bb_col=(0.20, 0.55, 0.10, 1),
    ),
    'dead': dict(
        trunk_h=(2.0, 4.5), crown_h=(0.3, 0.6), crown_r=(0.3, 0.6),
        trunk_r=0.18,
        trunk_col=(0.20, 0.14, 0.10, 1), crown_col=(0.15, 0.12, 0.10, 1),
        bb_col=(0.28, 0.18, 0.10, 1),
    ),
}


class LodTree:
    """
    Дерево с двумя LOD-уровнями:
      - ближний (< near_dist): 3D ствол + крона
      - дальний (near_dist … far_dist): плоский билборд
    """

    def __init__(self, parent, x, y, tree_type='pine',
                 near_dist=22.0, far_dist=120.0):
        self.x, self.y = x, y
        p = TREE_PARAMS.get(tree_type, TREE_PARAMS['pine'])

        trunk_h = random.uniform(*p['trunk_h'])
        crown_h = random.uniform(*p['crown_h'])
        crown_r = random.uniform(*p['crown_r'])
        total_h = trunk_h + crown_h
        bb_w    = crown_r * 2.0

        lod_node = LODNode(f'tree_{x:.0f}_{y:.0f}')
        lod_np   = parent.attachNewNode(lod_node)
        lod_np.setPos(x, y, 0)

        # ---- Уровень 0: 3D (вблизи) ----
        near_root = lod_np.attachNewNode('near')
        trunk = _make_cylinder('trunk', p['trunk_r'], trunk_h,
                               sides=5, color=p['trunk_col'])
        trunk.reparentTo(near_root)
        crown = _make_cone('crown', crown_r, crown_h,
                           sides=6, color=p['crown_col'])
        crown.setZ(trunk_h)
        crown.reparentTo(near_root)
        sc = random.uniform(0.9, 1.1)
        near_root.setScale(sc)

        # ---- Уровень 1: Billboard (вдали) ----
        far_root = lod_np.attachNewNode('far')
        _make_billboard(far_root, 0, 0, bb_w, total_h, p['bb_col'])

        lod_node.addSwitch(near_dist, 0)          # near при 0 … near_dist
        lod_node.addSwitch(far_dist,  near_dist)  # far  при near_dist … far_dist

        self.node = lod_np

    def remove(self):
        if self.node:
            self.node.removeNode()
            self.node = None


# ---------------------------------------------------------------------------
# Менеджер леса
# ---------------------------------------------------------------------------

class ForestManager:
    def __init__(self, parent_node, zone_id='elf_zone'):
        self.parent    = parent_node
        self.zone_id   = zone_id
        self.trees     = []

    def generate_zone_forest(self, center_x, center_y, radius,
                             density=0.003, tree_types=None,
                             max_trees=250, min_radius=18):
        """min_radius — зона без деревьев у центра (точка спавна игрока)."""
        if tree_types is None:
            tree_types = ['pine', 'oak', 'pine']
        area  = math.pi * radius * radius
        count = min(int(area * density), max_trees)

        for _ in range(count):
            a = random.uniform(0, 2 * math.pi)
            r = random.uniform(min_radius, radius)
            x = center_x + math.cos(a) * r
            y = center_y + math.sin(a) * r
            tt = random.choice(tree_types)
            self.trees.append(LodTree(self.parent, x, y, tree_type=tt))

        return count

    def generate_dense_forest(self, cx, cy, radius, density=0.006, max_trees=220,
                              min_radius=40):
        """Густой лес (эльфы). min_radius=40 — без деревьев у точки спавна."""
        return self.generate_zone_forest(
            cx, cy, radius, density=density, max_trees=max_trees,
            tree_types=['pine', 'pine', 'oak', 'pine'], min_radius=min_radius)

    def generate_sparse_forest(self, cx, cy, radius, density=0.002, max_trees=60):
        """Редкий лес (нейтральная зона)."""
        return self.generate_zone_forest(
            cx, cy, radius, density=density, max_trees=max_trees,
            tree_types=['oak', 'pine', 'dead'])

    def clear(self):
        for t in self.trees:
            t.remove()
        self.trees.clear()
