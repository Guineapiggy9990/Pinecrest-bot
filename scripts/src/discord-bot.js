import { Client, GatewayIntentBits, PermissionFlagsBits } from "discord.js";

// BOT_TOKEN should be stored as a Replit Secret.
const BOT_TOKEN = process.env.BOT_TOKEN ?? "YOUR_BOT_TOKEN_HERE";
const CHANNEL_ID = "1550646097976758333";

const OPEN_CHANNEL_NAME = "🟢┃hospital-open";
const CLOSED_CHANNEL_NAME = "🔴┃hospital-closed";
const OPEN_ANNOUNCEMENT =
  "**Pinecrest International Hospital is now open! Come on in and attend today's session! 🟢**";
const CLOSED_ANNOUNCEMENT =
  "**Pinecrest International Hospital is now closed. Thanks for attending today's session! If you missed SSU or would like another, please contact admin and we will let you know when the next one is! 🔴**";

if (BOT_TOKEN === "YOUR_BOT_TOKEN_HERE") {
  throw new Error(
    "Add BOT_TOKEN as a Replit Secret before starting the bot.",
  );
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

async function getStatusChannel() {
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

  const content = message.content.trim();
  const command = content.toLowerCase();

  if (command.startsWith("!announce")) {
    const announcement = content.slice("!announce".length).trim();
    const isModerator =
      message.member?.permissions.has(PermissionFlagsBits.Administrator) ||
      message.member?.permissions.has(PermissionFlagsBits.ManageGuild);

    if (!isModerator) {
      await message.reply("Only server moderators can send official announcements.");
      return;
    }

    if (!announcement) {
      await message.reply("Usage: `!announce <your announcement>`");
      return;
    }

    try {
      await message.channel.send(announcement);
      if (message.deletable) {
        await message.delete();
      }
    } catch (error) {
      console.error("Unable to send the custom announcement.", error);
    }
    return;
  }

  if (command !== "!open" && command !== "!close") return;

  try {
    const channel = await getStatusChannel();

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