import { Client, GatewayIntentBits } from "discord.js";

// Replace these placeholders before starting the bot.
const BOT_TOKEN = "MTU1MjQ2OTIyNTcyODM4NTEzNQ.GN5XsO.Q4Bj7w9U9uWf40HbUDjsTBfkB9bZbNBx0ZO9m8";
const CHANNEL_ID = "1550646097976758333";

const OPEN_CHANNEL_NAME = "🟢┃hospital-open";
const CLOSED_CHANNEL_NAME = "🔴┃hospital-closed";
const OPEN_ANNOUNCEMENT =
  "**Pinecrest International Hospital is now open! Come on in and attend today's session! 🟢**";
const CLOSED_ANNOUNCEMENT =
  "**Pinecrest International Hospital is now closed. Thanks for attending today's session! If you missed SSU or would like another, please contact admin and we will let you know when the next one is! 🔴**";

if (BOT_TOKEN === "YOUR_BOT_TOKEN_HERE" || CHANNEL_ID === "YOUR_CHANNEL_ID_HERE") {
  throw new Error(
    "Replace BOT_TOKEN and CHANNEL_ID at the top of scripts/src/discord-bot.js before starting the bot.",
  );
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

async function getConfiguredChannel() {
  const channel = await client.channels.fetch(CHANNEL_ID);

  if (!channel || !channel.isTextBased() || typeof channel.setName !== "function") {
    throw new Error(
      `Configured channel ${CHANNEL_ID} was not found or is not a renamable text channel.`,
    );
  }

  return channel;
}

client.once("ready", (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const command = message.content.trim().toLowerCase();
  if (command !== "!open" && command !== "!close") return;

  try {
    const channel = await getConfiguredChannel();

    if (command === "!open") {
      await channel.setName(OPEN_CHANNEL_NAME);
      await channel.send(OPEN_ANNOUNCEMENT);
      return;
    }

    await channel.setName(CLOSED_CHANNEL_NAME);
    await channel.bulkDelete(5, true);
    await channel.send(CLOSED_ANNOUNCEMENT);
  } catch (error) {
    console.error("Unable to update the hospital status channel.", error);
  }
});

client.login(BOT_TOKEN);