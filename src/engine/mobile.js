/**
 * Определение мобильного устройства.
 * Тач-устройства получают виртуальные контролы вместо pointer lock.
 */
export const isMobile = ('ontouchstart' in window) && (window.innerWidth < 1024)
