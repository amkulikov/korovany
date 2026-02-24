/**
 * Ввод: клавиатура + Pointer Lock мышь + тач (мобильные).
 * event.code не зависит от раскладки — кириллица не нужна!
 */
import { isMobile } from './mobile.js'

export class Input {
  constructor(canvas) {
    this.canvas = canvas
    this.keys = {}
    this.mouseX = 0     // delta за текущий кадр
    this.mouseY = 0
    this.lmb = false    // левая кнопка мыши (одноразовое нажатие)
    this.locked = isMobile // На мобильных считаем locked=true всегда

    this._rawMouseX = 0
    this._rawMouseY = 0
    this._touch = null  // ссылка на TouchControls (устанавливается извне)

    document.addEventListener('keydown', e => {
      this.keys[e.code] = true
      // Перехватываем F5/F9 чтобы браузер не обновлял страницу
      if (e.code === 'F5' || e.code === 'F9') e.preventDefault()
    })
    document.addEventListener('keyup', e => { this.keys[e.code] = false })
    document.addEventListener('mousemove', e => {
      if (!this.locked) return
      this._rawMouseX += e.movementX
      this._rawMouseY += e.movementY
    })
    if (!isMobile) {
      document.addEventListener('mousedown', e => {
        if (e.button === 0) this.lmb = true
      })
    }

    if (!isMobile) {
      document.addEventListener('pointerlockchange', () => {
        this.locked = document.pointerLockElement === canvas
        if (this.locked) {
          this._wasLocked = true
          this._hideResumeOverlay()
        } else if (this._wasLocked) {
          // Потеряли pointer lock — ставим на паузу
          if (this.onLockLost) {
            this.onLockLost()
          } else {
            this._showResumeOverlay()
          }
        }
      })
    }

    this._wasLocked = false
    this._resumeOverlay = null

    // Коллбэк на потерю фокуса (engine может повесить авто-паузу)
    this.onLockLost = null

    // Пауза при переключении вкладки
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && (this._wasLocked || isMobile) && this.onLockLost) {
        this.onLockLost()
      }
    })
  }

  /** Установить ссылку на TouchControls */
  setTouchControls(tc) {
    this._touch = tc
  }

  _showResumeOverlay() {
    if (isMobile) return
    if (this._resumeOverlay) return
    const el = document.createElement('div')
    el.id = 'resume-overlay'
    el.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:9999'
    el.innerHTML = '<div style="color:#fff;font-size:22px;text-shadow:0 2px 8px #000;pointer-events:none">Нажмите чтобы продолжить</div>'
    el.addEventListener('click', () => {
      this.canvas.requestPointerLock()
    })
    document.body.appendChild(el)
    this._resumeOverlay = el
  }

  _hideResumeOverlay() {
    if (this._resumeOverlay) {
      this._resumeOverlay.remove()
      this._resumeOverlay = null
    }
  }

  /** Запросить Pointer Lock (нужен пользовательский жест) */
  requestLock() {
    if (isMobile) { this.locked = true; return }
    this.canvas.requestPointerLock()
  }

  exitLock() {
    if (isMobile) return
    this._wasLocked = false // Не показывать оверлей при программном выходе (пауза/меню)
    this._hideResumeOverlay()
    if (document.pointerLockElement) document.exitPointerLock()
  }

  /** Вызывать в начале каждого кадра — забирает накопленные delta мыши */
  consumeMouse() {
    this.mouseX = this._rawMouseX
    this.mouseY = this._rawMouseY
    this._rawMouseX = 0
    this._rawMouseY = 0
    // Добавить дельту камеры от тач-свайпа
    if (this._touch) {
      const cam = this._touch.consumeCamera()
      this.mouseX += cam.dx
      this.mouseY += cam.dy
    }
  }

  /** Забрать одноразовое нажатие ЛКМ / виртуальная атака */
  consumeClick() {
    const v = this.lmb || (this._touch ? this._touch.consumeClick() : false)
    this.lmb = false
    return v
  }

  key(code) { return !!this.keys[code] || (this._touch ? this._touch.isVirtualKeyDown(code) : false) }

  // Удобные алиасы (OR с тач-джойстиком)
  get forward() { return this.key('KeyW') || (this._touch ? this._touch.forward : false) }
  get back() { return this.key('KeyS') || (this._touch ? this._touch.back : false) }
  get left() { return this.key('KeyA') || (this._touch ? this._touch.left : false) }
  get right() { return this.key('KeyD') || (this._touch ? this._touch.right : false) }
  get jump() { return this.key('Space') || this.key('KeyJ') }
  get shift() { return this.key('ShiftLeft') || this.key('ShiftRight') }
  get interact() { return this.key('KeyE') }
  get trade() { return this.key('KeyT') }
  get inv() { return this.key('KeyI') }
}
