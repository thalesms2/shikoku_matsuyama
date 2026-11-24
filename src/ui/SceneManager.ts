import type { Container } from "pixi.js";

/** Uma tela do jogo (título, esconderijo, raid, ...) */
export interface Scene {
  readonly view: Container;
  /** Chamado ao entrar e sempre que a tela muda de tamanho */
  resize?(width: number, height: number): void;
  /** Chamado a cada frame com o tempo decorrido em ms */
  update?(deltaMs: number): void;
  /** Chamado ao sair da cena, antes de destruir a view */
  destroy?(): void;
}

/** Troca a cena ativa no stage e repassa resize e update para ela */
export class SceneManager {
  private active: Scene | null = null;
  /** Duração do fade ao entrar numa cena (0 = sem animação) */
  fadeMs = 0;
  private fading = 0;
  private width: number;
  private height: number;

  constructor(
    private readonly stage: Container,
    width: number,
    height: number,
  ) {
    this.width = width;
    this.height = height;
  }

  get current(): Scene | null {
    return this.active;
  }

  /** Substitui a cena atual, destruindo a anterior */
  change(scene: Scene): void {
    this.clear();
    this.active = scene;
    this.stage.addChild(scene.view);
    this.fading = this.fadeMs;
    if (this.fading > 0) scene.view.alpha = 0;
    scene.resize?.(this.width, this.height);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.active?.resize?.(width, height);
  }

  update(deltaMs: number): void {
    const scene = this.active;
    if (scene && this.fading > 0) {
      this.fading = Math.max(0, this.fading - deltaMs);
      scene.view.alpha = 1 - this.fading / this.fadeMs;
    }
    scene?.update?.(deltaMs);
  }

  /** Remove e destrói a cena atual, se houver */
  clear(): void {
    const scene = this.active;
    if (!scene) return;
    this.active = null;
    scene.destroy?.();
    this.stage.removeChild(scene.view);
    scene.view.destroy({ children: true });
  }
}
