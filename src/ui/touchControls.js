/**
 * Тач-управление: виртуальный джойстик, свайп-камера, кнопки действий.
 * Всё самописное, без внешних библиотек.
 */

const DEADZONE = 0.2
const CAMERA_SENSITIVITY = 3.0

export class TouchControls {
  constructor() {
    this.container = document.getElementById('touch-controls')

    // Виртуальные клавиши (touchstart → true, touchend → false)
    this.virtualKeys = {}
    this._virtualClick = false

    // Джойстик
    this.axisX = 0
    this.axisY = 0
    this._joystickTouchId = null
    this._joystickCenterX = 0
    this._joystickCenterY = 0
    this._joystickRadius = 60

    // Камера (свайп правой частью экрана)
    this._cameraTouchId = null
    this._cameraLastX = 0
    this._cameraLastY = 0
    this._cameraDx = 0
    this._cameraDy = 0

    // Колбэки
    this.onToggleMinimap = null
    this.onToggleBody = null

    this._buildUI()
    this._bindEvents()
  }

  _buildUI() {
    const c = this.container

    // Невидимая зона камеры (правая половина экрана, под кнопками)
    this._cameraArea = this._el('div', 'touch-camera-area')
    c.appendChild(this._cameraArea)

    // Джойстик
    this._joystickBase = this._el('div', 'touch-joystick-base')
    this._joystickKnob = this._el('div', 'touch-joystick-knob')
    this._joystickBase.appendChild(this._joystickKnob)
    c.appendChild(this._joystickBase)

    // Кнопка атаки
    this._btnAttack = this._makeBtn('touch-btn touch-btn-attack', '\u2694', '_attack')
    c.appendChild(this._btnAttack)

    // Кнопка прыжка
    this._btnJump = this._makeBtn('touch-btn touch-btn-jump', '\u21e7', 'Space')
    c.appendChild(this._btnJump)

    // Кнопка взаимодействия (скрытая по умолчанию)
    this._btnInteract = this._makeBtn('touch-btn touch-btn-interact', 'E', 'KeyE')
    this._btnInteract.style.display = 'none'
    c.appendChild(this._btnInteract)

    // Кнопка паузы
    this._btnPause = this._makeBtn('touch-btn touch-btn-pause', '\u2759\u2759', 'Escape')
    c.appendChild(this._btnPause)

    // Кнопка карты
    const btnMap = this._el('div', 'touch-btn touch-btn-map')
    btnMap.textContent = '\u25A3'
    btnMap.addEventListener('touchstart', (e) => {
      e.preventDefault()
      if (this.onToggleMinimap) this.onToggleMinimap()
    }, { passive: false })
    c.appendChild(btnMap)

    // Кнопка тела
    const btnBody = this._el('div', 'touch-btn touch-btn-body')
    btnBody.textContent = '\u263A'
    btnBody.addEventListener('touchstart', (e) => {
      e.preventDefault()
      if (this.onToggleBody) this.onToggleBody()
    }, { passive: false })
    c.appendChild(btnBody)

    // Тулбар (инвентарь, торговля, зелья)
    const toolbar = this._el('div', 'touch-toolbar')
    toolbar.appendChild(this._makeBtn('touch-btn', 'I', 'KeyI'))
    toolbar.appendChild(this._makeBtn('touch-btn', 'T', 'KeyT'))
    toolbar.appendChild(this._makeBtn('touch-btn', '1', 'Digit1'))
    toolbar.appendChild(this._makeBtn('touch-btn', '2', 'Digit2'))
    c.appendChild(toolbar)
  }

  _el(tag, className) {
    const el = document.createElement(tag)
    if (className) el.className = className
    return el
  }

  _makeBtn(className, label, keyCode) {
    const btn = this._el('div', className)
    btn.textContent = label
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault()
      btn.classList.add('active')
      this.virtualKeys[keyCode] = true
      if (keyCode === '_attack') this._virtualClick = true
    }, { passive: false })
    btn.addEventListener('touchend', (e) => {
      e.preventDefault()
      btn.classList.remove('active')
      this.virtualKeys[keyCode] = false
    }, { passive: false })
    btn.addEventListener('touchcancel', () => {
      btn.classList.remove('active')
      this.virtualKeys[keyCode] = false
    })
    return btn
  }

  _bindEvents() {
    // Джойстик
    this._joystickBase.addEventListener('touchstart', (e) => {
      e.preventDefault()
      if (this._joystickTouchId !== null) return
      const touch = e.changedTouches[0]
      this._joystickTouchId = touch.identifier
      const rect = this._joystickBase.getBoundingClientRect()
      this._joystickCenterX = rect.left + rect.width / 2
      this._joystickCenterY = rect.top + rect.height / 2
      this._updateJoystick(touch.clientX, touch.clientY)
    }, { passive: false })

    this._joystickBase.addEventListener('touchmove', (e) => {
      e.preventDefault()
      for (const touch of e.changedTouches) {
        if (touch.identifier === this._joystickTouchId) {
          this._updateJoystick(touch.clientX, touch.clientY)
          break
        }
      }
    }, { passive: false })

    const joystickEnd = (e) => {
      for (const touch of e.changedTouches) {
        if (touch.identifier === this._joystickTouchId) {
          this._joystickTouchId = null
          this.axisX = 0
          this.axisY = 0
          this._joystickKnob.style.transform = 'translate(-50%, -50%)'
          break
        }
      }
    }
    this._joystickBase.addEventListener('touchend', joystickEnd)
    this._joystickBase.addEventListener('touchcancel', joystickEnd)

    // Камера (свайп правой половиной)
    this._cameraArea.addEventListener('touchstart', (e) => {
      e.preventDefault()
      if (this._cameraTouchId !== null) return
      const touch = e.changedTouches[0]
      this._cameraTouchId = touch.identifier
      this._cameraLastX = touch.clientX
      this._cameraLastY = touch.clientY
    }, { passive: false })

    this._cameraArea.addEventListener('touchmove', (e) => {
      e.preventDefault()
      for (const touch of e.changedTouches) {
        if (touch.identifier === this._cameraTouchId) {
          this._cameraDx += (touch.clientX - this._cameraLastX) * CAMERA_SENSITIVITY
          this._cameraDy += (touch.clientY - this._cameraLastY) * CAMERA_SENSITIVITY
          this._cameraLastX = touch.clientX
          this._cameraLastY = touch.clientY
          break
        }
      }
    }, { passive: false })

    const cameraEnd = (e) => {
      for (const touch of e.changedTouches) {
        if (touch.identifier === this._cameraTouchId) {
          this._cameraTouchId = null
          break
        }
      }
    }
    this._cameraArea.addEventListener('touchend', cameraEnd)
    this._cameraArea.addEventListener('touchcancel', cameraEnd)
  }

  _updateJoystick(tx, ty) {
    let dx = tx - this._joystickCenterX
    let dy = ty - this._joystickCenterY
    const dist = Math.sqrt(dx * dx + dy * dy)
    const maxDist = this._joystickRadius

    if (dist > maxDist) {
      dx = (dx / dist) * maxDist
      dy = (dy / dist) * maxDist
    }

    // Визуальное перемещение ручки
    this._joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`

    // Нормализованные оси (-1..1)
    this.axisX = dx / maxDist
    this.axisY = -dy / maxDist // инвертируем Y: вверх = положительное значение (forward)
  }

  /** Забрать дельту камеры (аналог consumeMouse) */
  consumeCamera() {
    const dx = this._cameraDx
    const dy = this._cameraDy
    this._cameraDx = 0
    this._cameraDy = 0
    return { dx, dy }
  }

  /** Забрать одноразовый клик атаки */
  consumeClick() {
    const v = this._virtualClick
    this._virtualClick = false
    return v
  }

  /** Проверить виртуальную клавишу */
  isVirtualKeyDown(code) {
    return !!this.virtualKeys[code]
  }

  // Геттеры движения (с учётом deadzone)
  get forward() { return this.axisY > DEADZONE }
  get back() { return this.axisY < -DEADZONE }
  get left() { return this.axisX < -DEADZONE }
  get right() { return this.axisX > DEADZONE }

  /** Показать/скрыть кнопку E */
  setInteractVisible(visible) {
    this._btnInteract.style.display = visible ? 'flex' : 'none'
  }

  show() {
    this.container.classList.remove('hidden')
  }

  hide() {
    this.container.classList.add('hidden')
    // Сбросить все нажатия при скрытии
    this.axisX = 0
    this.axisY = 0
    this._joystickTouchId = null
    this._cameraTouchId = null
    this._cameraDx = 0
    this._cameraDy = 0
    this.virtualKeys = {}
    this._virtualClick = false
    this._joystickKnob.style.transform = 'translate(-50%, -50%)'
  }
}
