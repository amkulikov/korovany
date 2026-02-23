"""Система сохранения и загрузки игры (JSON)."""
import json
import os
import time

SAVE_DIR = os.path.join(os.path.dirname(__file__), '..', 'saves')


def ensure_save_dir():
    os.makedirs(SAVE_DIR, exist_ok=True)


def list_saves():
    ensure_save_dir()
    saves = []
    for fn in sorted(os.listdir(SAVE_DIR)):
        if fn.endswith('.json'):
            path = os.path.join(SAVE_DIR, fn)
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                saves.append({
                    'filename': fn,
                    'slot': fn.replace('.json', ''),
                    'faction': data.get('faction', '?'),
                    'play_time': data.get('play_time', 0),
                    'timestamp': data.get('timestamp', ''),
                })
            except Exception:
                pass
    return saves


def save_game(player, slot_name='quicksave'):
    ensure_save_dir()
    path = os.path.join(SAVE_DIR, f'{slot_name}.json')

    data = {
        'version': '1.0',
        'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
        'faction': player.faction_id,
        'play_time': player.play_time,
        'pos_x': player.pos_x,
        'pos_y': player.pos_y,
        'pos_z': player.pos_z,
        'heading': player.heading,
        'hp': player.hp,
        'max_hp': player.max_hp,
        'body_parts': player.body.to_dict(),
        'inventory': player.inventory.to_dict(),
        'kills': player.kills,
        'quests_completed': player.quests_completed,
        'reputation': player.reputation,
        'in_wheelchair': player.in_wheelchair,
    }

    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    return True, f'Сохранено в слот: {slot_name}'


def load_game(player, slot_name='quicksave'):
    path = os.path.join(SAVE_DIR, f'{slot_name}.json')
    if not os.path.exists(path):
        return False, f'Сохранение не найдено: {slot_name}'

    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        player.faction_id = data['faction']
        player.play_time = data.get('play_time', 0)
        player.pos_x = data.get('pos_x', 0)
        player.pos_y = data.get('pos_y', 0)
        player.pos_z = data.get('pos_z', 5)
        player.heading = data.get('heading', 0)
        player.hp = data.get('hp', player.max_hp)
        player.kills = data.get('kills', 0)
        player.quests_completed = data.get('quests_completed', [])
        player.reputation = data.get('reputation', {})
        player.in_wheelchair = data.get('in_wheelchair', False)

        player.body.from_dict(data.get('body_parts', {}))
        player.inventory.from_dict(data.get('inventory', {}))

        return True, 'Загружено успешно'
    except Exception as e:
        return False, f'Ошибка загрузки: {e}'


def delete_save(slot_name):
    path = os.path.join(SAVE_DIR, f'{slot_name}.json')
    if os.path.exists(path):
        os.remove(path)
        return True, f'Сохранение удалено: {slot_name}'
    return False, 'Сохранение не найдено'
