import * as pixiSound from "@pixi/sound";

/** Volume dos efeitos (0 a 1), vindo das configurações */
let volume = 0.5;

export function setVolume(value: number): void {
  volume = value;
}

export function getVolume(): number {
  return volume;
}

/** O módulo de som, se estiver disponível (pode faltar ou ser simulado) */
function soundLibrary(): typeof pixiSound.sound | undefined {
  try {
    return pixiSound.sound;
  } catch {
    return undefined;
  }
}

/**
 * Toca um efeito carregado em `assets.ts`. Sem volume, sem o módulo de som
 * ou com erro do navegador, não faz nada.
 */
export function playSound(alias: string): void {
  const sound = soundLibrary();
  if (volume <= 0 || !sound?.exists?.(alias)) return;
  try {
    sound.play(alias, { volume });
  } catch {
    // navegador sem áudio liberado: ignora
  }
}
