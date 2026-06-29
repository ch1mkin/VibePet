import { Application, Container, Graphics } from 'pixi.js'
import type { DuckAnimationState } from '@shared/types'

const PALETTE = {
  body: 0xffd24c,
  bodyShade: 0xf0b92e,
  beak: 0xff9b2f,
  eye: 0x1a1a1a,
  blush: 0xff8aa0,
  accent: 0x7c5cff
} as const

/**
 * Procedural pixel-duck renderer built on PixiJS.
 *
 * Until real sprite sheets land, the duck is drawn from primitives and animated
 * per-state via the ticker (bobbing, walking, blinking, z's, etc.). The public
 * surface (`setState`, `resize`, `destroy`) stays identical when we swap to
 * AnimatedSprite-based sheets later, so callers won't change.
 */
export class DuckStage {
  private app: Application | null = null
  private duck = new Container()
  private body = new Graphics()
  private face = new Graphics()
  private accessory = new Graphics()
  private state: DuckAnimationState = 'idle'
  private elapsed = 0
  private baseY = 0

  async mount(canvasParent: HTMLElement): Promise<void> {
    const app = new Application()
    await app.init({
      backgroundAlpha: 0,
      antialias: false,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      resizeTo: canvasParent
    })
    canvasParent.appendChild(app.canvas)
    this.app = app

    this.duck.addChild(this.body, this.face, this.accessory)
    app.stage.addChild(this.duck)
    this.center()
    this.drawBody()

    app.ticker.add((ticker) => this.update(ticker.deltaMS))
  }

  setState(state: DuckAnimationState): void {
    if (this.state === state) return
    this.state = state
    this.elapsed = 0
    this.duck.rotation = 0
    this.drawAccessory()
  }

  resize(): void {
    this.center()
  }

  destroy(): void {
    this.app?.destroy(true, { children: true })
    this.app = null
  }

  private center(): void {
    if (!this.app) return
    const { width, height } = this.app.renderer
    const cx = width / this.app.renderer.resolution / 2
    const cy = height / this.app.renderer.resolution / 2
    this.duck.position.set(cx, cy)
    this.baseY = cy
  }

  private update(deltaMs: number): void {
    this.elapsed += deltaMs
    const t = this.elapsed / 1000

    switch (this.state) {
      case 'walking':
      case 'running': {
        const speed = this.state === 'running' ? 2.2 : 1
        this.duck.x += Math.sin(t * 6 * speed) * 0.6
        this.duck.y = this.baseY + Math.abs(Math.sin(t * 10 * speed)) * -4
        this.duck.scale.x = Math.sin(t) > 0 ? 1 : -1
        break
      }
      case 'sleeping':
        this.duck.y = this.baseY + Math.sin(t * 1.5) * 1.5
        break
      case 'thinking':
      case 'coding':
        this.duck.y = this.baseY + Math.sin(t * 8) * 1.2
        break
      case 'celebrating':
      case 'excited':
      case 'happy':
        this.duck.y = this.baseY - Math.abs(Math.sin(t * 8)) * 8
        this.duck.rotation = Math.sin(t * 12) * 0.08
        break
      case 'flying':
        this.duck.y = this.baseY - 10 + Math.sin(t * 6) * 6
        break
      case 'confused':
        this.duck.rotation = Math.sin(t * 6) * 0.12
        break
      default:
        this.duck.y = this.baseY + Math.sin(t * 2) * 2
    }

    this.drawFace(t)
  }

  private drawBody(): void {
    const g = this.body
    g.clear()
    // Body
    g.roundRect(-26, -22, 52, 44, 16).fill(PALETTE.body)
    g.roundRect(-26, 4, 52, 18, 12).fill(PALETTE.bodyShade)
    // Head
    g.circle(0, -30, 18).fill(PALETTE.body)
    // Beak
    g.roundRect(10, -32, 18, 10, 3).fill(PALETTE.beak)
    // Feet
    g.roundRect(-14, 20, 10, 6, 2).fill(PALETTE.beak)
    g.roundRect(6, 20, 10, 6, 2).fill(PALETTE.beak)
  }

  private drawFace(t: number): void {
    const g = this.face
    g.clear()
    const blink = Math.sin(t * 3) > 0.96

    if (this.state === 'sleeping') {
      g.moveTo(-6, -32).lineTo(2, -32).stroke({ width: 2, color: PALETTE.eye })
      // floating Z's
      const zy = -50 - ((t * 8) % 20)
      g.rect(16, zy, 4, 1).fill(PALETTE.accent)
      return
    }

    if (blink) {
      g.rect(-4, -31, 6, 1).fill(PALETTE.eye)
    } else {
      g.circle(-2, -31, 2.4).fill(PALETTE.eye)
    }

    if (this.state === 'happy' || this.state === 'celebrating' || this.state === 'excited') {
      g.circle(-12, -26, 3).fill(PALETTE.blush)
    }
  }

  private drawAccessory(): void {
    const g = this.accessory
    g.clear()
    if (this.state === 'drinkingCoffee') {
      g.roundRect(18, -18, 12, 12, 2).fill(0x6b4226)
      g.rect(30, -16, 4, 6).fill(0x6b4226)
    } else if (this.state === 'coding' || this.state === 'readingDocs') {
      g.roundRect(-30, 6, 28, 16, 2).fill(0x222831)
      g.roundRect(-28, 8, 24, 10, 1).fill(PALETTE.accent)
    } else if (this.state === 'thinking') {
      g.circle(20, -46, 4).fill(0xffffff)
      g.circle(14, -40, 2).fill(0xffffff)
    }
  }
}
