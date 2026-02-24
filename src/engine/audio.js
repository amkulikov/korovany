/**
 * Процедурные звуки через Web Audio API.
 * Все звуки генерируются на лету — без внешних файлов.
 */
export class GameAudio {
  constructor() {
    this._ctx = null
    this._masterGain = null
    this._ambientTimer = null
    this.muted = false
  }

  /** Лениво создаёт AudioContext (браузер требует user gesture) */
  _ensureCtx() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)()
      this._masterGain = this._ctx.createGain()
      this._masterGain.connect(this._ctx.destination)
    }
    if (this._ctx.state === 'suspended') {
      this._ctx.resume()
    }
    return this._ctx
  }

  /** Итоговый узел, к которому подключаются все звуки */
  get _dest() {
    return this._masterGain || this._ctx.destination
  }

  toggleMute() {
    this.muted = !this.muted
    if (this._masterGain) {
      this._masterGain.gain.value = this.muted ? 0 : 1
    }
    return this.muted
  }

  /** Создаёт буфер белого шума заданной длительности */
  _noiseBuffer(duration) {
    const ctx = this._ctx
    const len = Math.floor(ctx.sampleRate * duration)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    return buf
  }

  // ---- 1. Ambient music ----

  playAmbient() {
    this._ensureCtx()
    if (this._ambientTimer) return
    this._ambientPlaying = true
    this._scheduleNote()
  }

  stopAmbient() {
    this._ambientPlaying = false
    if (this._ambientTimer) {
      clearTimeout(this._ambientTimer)
      this._ambientTimer = null
    }
  }

  _scheduleNote() {
    if (!this._ambientPlaying) { this._ambientTimer = null; return }
    const ctx = this._ctx
    const notes = [262, 294, 330, 392, 440]
    const freq = notes[Math.floor(Math.random() * notes.length)]
    const dur = 3 + Math.random() * 3
    const vol = 0.015 + Math.random() * 0.015

    this._playAmbientNote(ctx, freq, dur, vol)
    // Иногда аккорд — вторая нота
    if (Math.random() < 0.3) {
      const freq2 = notes[Math.floor(Math.random() * notes.length)]
      this._playAmbientNote(ctx, freq2, dur, vol * 0.8)
    }

    const pause = 2 + Math.random() * 2
    this._ambientTimer = setTimeout(() => this._scheduleNote(), pause * 1000)
  }

  _playAmbientNote(ctx, freq, dur, vol) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 1)
    gain.gain.setValueAtTime(vol, ctx.currentTime + dur - 1.5)
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + dur)
    osc.connect(gain).connect(this._dest)
    osc.start()
    osc.stop(ctx.currentTime + dur)
  }

  // ---- 2. Footstep ----

  playFootstep() {
    const ctx = this._ensureCtx()
    const src = ctx.createBufferSource()
    src.buffer = this._noiseBuffer(0.08)
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 800 + Math.random() * 400
    filter.Q.value = 1
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.08)
    src.connect(filter).connect(gain).connect(this._dest)
    src.start()
    src.stop(ctx.currentTime + 0.08)
  }

  // ---- 3. Weapon swing ----

  playSwing() {
    const ctx = this._ensureCtx()
    const src = ctx.createBufferSource()
    src.buffer = this._noiseBuffer(0.2)
    const filter = ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.setValueAtTime(400, ctx.currentTime)
    filter.frequency.linearRampToValueAtTime(2000, ctx.currentTime + 0.15)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.12, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2)
    src.connect(filter).connect(gain).connect(this._dest)
    src.start()
    src.stop(ctx.currentTime + 0.2)
  }

  // ---- 4. Hit enemy ----

  playHitEnemy() {
    const ctx = this._ensureCtx()
    const t = ctx.currentTime
    // Слой 1: шум
    const src = ctx.createBufferSource()
    src.buffer = this._noiseBuffer(0.1)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 300
    bp.Q.value = 2
    const g1 = ctx.createGain()
    g1.gain.setValueAtTime(0.2, t)
    g1.gain.linearRampToValueAtTime(0, t + 0.1)
    src.connect(bp).connect(g1).connect(this._dest)
    src.start()
    src.stop(t + 0.1)
    // Слой 2: тон
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(150, t)
    osc.frequency.linearRampToValueAtTime(80, t + 0.12)
    const g2 = ctx.createGain()
    g2.gain.setValueAtTime(0.15, t)
    g2.gain.linearRampToValueAtTime(0, t + 0.12)
    osc.connect(g2).connect(this._dest)
    osc.start()
    osc.stop(t + 0.12)
  }

  // ---- 5. Hit player ----

  playHitPlayer() {
    const ctx = this._ensureCtx()
    const t = ctx.currentTime
    // Тон
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(200, t)
    osc.frequency.linearRampToValueAtTime(100, t + 0.15)
    const g1 = ctx.createGain()
    g1.gain.setValueAtTime(0.25, t)
    g1.gain.linearRampToValueAtTime(0, t + 0.15)
    osc.connect(g1).connect(this._dest)
    osc.start()
    osc.stop(t + 0.15)
    // Шум
    const src = ctx.createBufferSource()
    src.buffer = this._noiseBuffer(0.12)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 400
    const g2 = ctx.createGain()
    g2.gain.setValueAtTime(0.15, t)
    g2.gain.linearRampToValueAtTime(0, t + 0.12)
    src.connect(lp).connect(g2).connect(this._dest)
    src.start()
    src.stop(t + 0.12)
  }

  // ---- 6. Enemy death ----

  playEnemyDeath() {
    const ctx = this._ensureCtx()
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(300, t)
    osc.frequency.linearRampToValueAtTime(80, t + 0.4)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.12, t)
    gain.gain.linearRampToValueAtTime(0, t + 0.5)
    osc.connect(gain).connect(this._dest)
    osc.start()
    osc.stop(t + 0.5)
  }

  // ---- 7. Aggro ----

  playAggro() {
    const ctx = this._ensureCtx()
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.setValueAtTime(200, t)
    osc.frequency.linearRampToValueAtTime(400, t + 0.2)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.08, t)
    gain.gain.linearRampToValueAtTime(0, t + 0.25)
    osc.connect(gain).connect(this._dest)
    osc.start()
    osc.stop(t + 0.25)
  }

  // ---- 8. Player death ----

  playPlayerDeath() {
    const ctx = this._ensureCtx()
    const t = ctx.currentTime
    const freqs = [[200, 100], [250, 130], [300, 150]]
    for (const [start, end] of freqs) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(start, t)
      osc.frequency.linearRampToValueAtTime(end, t + 1.5)
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.1, t)
      gain.gain.linearRampToValueAtTime(0, t + 2)
      osc.connect(gain).connect(this._dest)
      osc.start()
      osc.stop(t + 2)
    }
  }

  // ---- 9. Drown ----

  playDrown() {
    const ctx = this._ensureCtx()
    const t = ctx.currentTime
    // Несущая с AM-модуляцией
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(300, t)
    osc.frequency.linearRampToValueAtTime(150, t + 0.8)
    // LFO для амплитудной модуляции
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 8
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.5
    lfo.connect(lfoGain)
    // Основной gain
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.12, t)
    gain.gain.linearRampToValueAtTime(0, t + 0.8)
    lfoGain.connect(gain.gain)
    osc.connect(gain).connect(this._dest)
    osc.start()
    lfo.start()
    osc.stop(t + 0.8)
    lfo.stop(t + 0.8)
  }

  // ---- 10. Gorge fall ----

  playGorgeFall() {
    const ctx = this._ensureCtx()
    const t = ctx.currentTime
    // Свист ветра (шум + highpass sweep)
    const src = ctx.createBufferSource()
    src.buffer = this._noiseBuffer(0.6)
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.setValueAtTime(1000, t)
    hp.frequency.linearRampToValueAtTime(200, t + 0.6)
    const g1 = ctx.createGain()
    g1.gain.setValueAtTime(0.15, t)
    g1.gain.linearRampToValueAtTime(0, t + 0.6)
    src.connect(hp).connect(g1).connect(this._dest)
    src.start()
    src.stop(t + 0.6)
    // Удар о дно (через 0.5s)
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 80
    const g2 = ctx.createGain()
    g2.gain.setValueAtTime(0, t)
    g2.gain.setValueAtTime(0.2, t + 0.5)
    g2.gain.linearRampToValueAtTime(0, t + 0.65)
    osc.connect(g2).connect(this._dest)
    osc.start(t + 0.5)
    osc.stop(t + 0.65)
  }
}
