import { spawn } from "node:child_process";

const env = {
  ...process.env,
};

console.log("[Render] Starting API server...");
console.log("[Render] Starting Discord bot...");
console.log(
  "[Render] DISCORD_TOKEN present:",
  Boolean(process.env.DISCORD_TOKEN),
);

const api = spawn(
  "node",
  ["artifacts/api-server/dist/index.mjs"],
  {
    env,
    stdio: "inherit",
  },
);

const bot = spawn(
  "node",
  ["scripts/src/discord-bot.js"],
  {
    env,
    stdio: "inherit",
  },
);

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;

  shuttingDown = true;

  console.log(`[Render] Shutting down (${signal})...`);

  api.kill(signal);
  bot.kill(signal);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

bot.on("exit", (code, signal) => {
  if (shuttingDown) return;

  console.error(
    `[Discord] Bot process exited. code=${code} signal=${signal}`,
  );

  api.kill("SIGTERM");
  process.exit(code ?? 1);
});

api.on("exit", (code, signal) => {
  if (shuttingDown) return;

  console.error(
    `[API] API process exited. code=${code} signal=${signal}`,
  );

  bot.kill("SIGTERM");
  process.exit(code ?? 1);
});
