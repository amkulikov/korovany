/**
 * FPS камера от первого лица.
 */

export class FPSCamera {
  constructor(threeCamera, weaponCamera) {
    this.cam = threeCamera
    this.weaponCam = weaponCamera
    this.yaw = 0       // горизонт (радианы)
    this.pitch = -0.17  // вертикаль (радианы), ~-10°
    this.sensitivity = 0.002
  }

  /** Обновить по дельте мыши */
  rotate(dx, dy) {
    // Ограничить дельту от огромных скачков
    dx = Math.max(-300, Math.min(300, dx))
    dy = Math.max(-300, Math.min(300, dy))
    this.yaw -= dx * this.sensitivity
    this.pitch -= dy * this.sensitivity
    this.pitch = Math.max(-Math.PI / 2 * 0.85, Math.min(Math.PI / 6, this.pitch))
  }

  /** Установить позицию камеры на позицию игрока */
  update(px, py, pz) {
    const eyeHeight = 1.45
    this.cam.position.set(px, pz + eyeHeight, -py) // Three.js: Y вверх, Z на камеру
    this.cam.rotation.order = 'YXZ'
    this.cam.rotation.y = this.yaw
    this.cam.rotation.x = this.pitch

    // Оружейная камера: остаётся в нуле БЕЗ вращения.
    // Оружие — это overlay, всегда на одном месте экрана (как в Doom/Minecraft).
    this.weaponCam.position.set(0, 0, 0)
    this.weaponCam.rotation.set(0, 0, 0)
  }

  /** Направление взгляда для движения (горизонталь) */
  get forwardDir() {
    // Three.js forward after yaw = (-sin(yaw), 0, -cos(yaw))
    // game.x = three.x, game.y = -three.z
    return { x: -Math.sin(this.yaw), y: Math.cos(this.yaw) }
  }

  get rightDir() {
    // Three.js right after yaw = (cos(yaw), 0, -sin(yaw))
    // game.x = three.x, game.y = -three.z
    return { x: Math.cos(this.yaw), y: Math.sin(this.yaw) }
  }
}
