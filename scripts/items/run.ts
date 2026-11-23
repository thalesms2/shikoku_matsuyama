import { main } from "./cli.ts";
import { openDb } from "./db.ts";

// Ponto de entrada de `npm run items -- <comando>`
process.exitCode = await main(process.argv.slice(2), {
  root: process.cwd(),
  openDb,
  fetchFn: fetch,
  now: () => new Date().toISOString(),
  log: (message) => console.log(message),
  error: (message) => console.error(message),
});
