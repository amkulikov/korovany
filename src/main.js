/**
 * Точка входа.
 * "Здраствуйте. Я, Кирилл. Хотел бы чтобы вы сделали игру, 3Д-экшон..."
 */
import { Game } from './engine/engine.js'

const canvas = document.getElementById('game-canvas')
new Game(canvas)
