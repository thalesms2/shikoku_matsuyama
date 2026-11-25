import { joinBalanceRoom } from "./balanceSync.ts";
import { startGame } from "./game.ts";

await startGame(document.getElementById("pixi-container")!, {
  joinBalance: joinBalanceRoom,
});
