/**
 * Онбординг — пошаговое обучение для новых игроков.
 * Показывается один раз при первом запуске новой игры.
 */

const ONBOARDING_KEY = 'korovany_onboarding_seen'

const STEPS = [
  {
    key: 'WASD',
    title: 'Движение',
    text: 'WASD — перемещение по миру\nSpace — прыжок\nShift — подкрадывание',
  },
  {
    key: '\u{1F5B1}',
    title: 'Обзор и атака',
    text: 'Мышь — вращение камеры\nЛКМ — удар по ближайшему врагу\nДальнобойное оружие бьёт по направлению взгляда',
  },
  {
    key: 'E',
    title: 'Корованы',
    text: 'Подойди к коровану и нажми E\nчтобы узнать маршрут, груз и охрану\nЛКМ — атаковать и ограбить!',
  },
  {
    key: 'I',
    title: 'Инвентарь',
    text: 'I — открыть инвентарь\nЭкипируй оружие и броню\nИспользуй зелья и бинты\n1, 2 — быстрые слоты зелий',
  },
  {
    key: 'T',
    title: 'Торговля',
    text: 'T — открыть лавку\nПокупай оружие, броню и зелья\nПродавай трофеи с врагов',
  },
  {
    key: '\u{1FA78}',
    title: 'Система ранений',
    text: 'Враги могут ранить и отрубить конечности!\nОтрубленная часть тела вызывает кровотечение\nИспользуй бинты и протезы для лечения',
  },
  {
    key: 'F5',
    title: 'Сохранение',
    text: 'F5 — быстрое сохранение\nF9 — быстрая загрузка\nEsc — пауза и ручное сохранение',
  },
]

export function shouldShowOnboarding() {
  return !localStorage.getItem(ONBOARDING_KEY)
}

export function showOnboarding(onComplete) {
  let step = 0
  const overlay = document.getElementById('onboarding-overlay')
  overlay.classList.remove('hidden')

  function render() {
    const s = STEPS[step]
    const isLast = step === STEPS.length - 1
    overlay.innerHTML = `
      <div class="onboarding-card">
        <div class="onboarding-key">${s.key}</div>
        <div class="onboarding-title">${s.title}</div>
        <div class="onboarding-text">${s.text}</div>
        <div class="onboarding-nav">
          <span class="onboarding-dots">${step + 1} / ${STEPS.length}</span>
          <button class="onboarding-btn" id="onboarding-next">${isLast ? 'В бой!' : 'Далее \u2192'}</button>
        </div>
        <button class="onboarding-skip" id="onboarding-skip">Пропустить</button>
      </div>
    `
    overlay.querySelector('#onboarding-next').onclick = next
    overlay.querySelector('#onboarding-skip').onclick = finish
  }

  function next() {
    step++
    if (step >= STEPS.length) {
      finish()
    } else {
      render()
    }
  }

  function finish() {
    localStorage.setItem(ONBOARDING_KEY, '1')
    overlay.classList.add('hidden')
    document.removeEventListener('keydown', onKey)
    onComplete()
  }

  function onKey(e) {
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault()
      next()
    } else if (e.code === 'Escape') {
      e.preventDefault()
      finish()
    }
  }

  document.addEventListener('keydown', onKey)
  render()
}
