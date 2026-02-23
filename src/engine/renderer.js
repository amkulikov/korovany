/**
 * Three.js сцена, камера, свет, туман.
 */
import * as THREE from 'three'
import { FOG_SETTINGS, SKY_COLORS, getSkyColorsAt, getFogAt } from '../game/constants.js'

export class Renderer {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.shadowMap.enabled = false

    this.scene = new THREE.Scene()

    // Камера
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 1200)

    // Оверлейная сцена для оружия (поверх всего)
    this.weaponScene = new THREE.Scene()
    this.weaponCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 10)

    window.addEventListener('resize', () => this._onResize())
  }

  setupForFaction(factionId) {
    // Начальные цвета — будут обновляться динамически в game loop
    const sky = SKY_COLORS.neutral || SKY_COLORS.guards
    const fog = FOG_SETTINGS.neutral || FOG_SETTINGS.guards

    // Фон
    this.scene.background = new THREE.Color(...sky.bg)

    // Туман
    this.scene.fog = new THREE.Fog(new THREE.Color(...fog.color), fog.near, fog.far)

    // Освещение — очистить старое
    this.scene.children
      .filter(c => c.isLight)
      .forEach(c => this.scene.remove(c))

    // Солнце
    const sun = new THREE.DirectionalLight(0xfff3d9, 1.0)
    sun.position.set(200, 300, 200)
    this.scene.add(sun)

    // Подсветка — достаточно яркая чтобы теневые стороны были видны
    const ambient = new THREE.AmbientLight(0x8899aa, 0.9)
    this.scene.add(ambient)

    // Заполняющий свет с противоположной стороны
    const fill = new THREE.DirectionalLight(0x99aacc, 0.35)
    fill.position.set(-150, 100, -200)
    this.scene.add(fill)
  }

  render() {
    this.renderer.autoClear = true
    this.renderer.render(this.scene, this.camera)
    // Оружие поверх основной сцены
    this.renderer.autoClear = false
    this.renderer.clearDepth()
    this.renderer.render(this.weaponScene, this.weaponCamera)
  }

  _onResize() {
    const w = window.innerWidth, h = window.innerHeight
    this.renderer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.weaponCamera.aspect = w / h
    this.weaponCamera.updateProjectionMatrix()
  }
}
