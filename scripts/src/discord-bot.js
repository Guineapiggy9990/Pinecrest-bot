import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
} from "discord.js";

// BOT_TOKEN should be stored as a Replit Secret.
const BOT_TOKEN = process.env.BOT_TOKEN ?? "YOUR_BOT_TOKEN_HERE";
const CHANNEL_ID = "1550646097976758333";
const CONNECT4_CHANNEL_ID = "1552499102082670612";

const OPEN_CHANNEL_NAME = "🟢┃hospital-open";
const CLOSED_CHANNEL_NAME = "🔴┃hospital-closed";
const OPEN_ANNOUNCEMENT =
  "**Pinecrest International Hospital is now open! Come on in and attend today's session! 🟢**";
const CLOSED_ANNOUNCEMENT =
  "**Pinecrest International Hospital is now closed. Thanks for attending today's session! If you missed SSU or would like another, please contact admin and we will let you know when the next one is! 🔴**";

const BOARD_ROWS = 6;
const BOARD_COLUMNS = 7;
const games = new Map();

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

async function getConnect4Channel() {
  if (CONNECT4_CHANNEL_ID === "YOUR_CONNECT4_CHANNEL_ID_HERE") {
    throw new Error("Set CONNECT4_CHANNEL_ID before using !connect4.");
  }

  const channel = await client.channels.fetch(CONNECT4_CHANNEL_ID);

  if (!channel || !channel.isTextBased() || !channel.guild) {
    throw new Error(
      `Connect 4 channel ${CONNECT4_CHANNEL_ID} was not found or is not a server text channel.`,
    );
  }

  return channel;
}

function isModerator(member) {
  return (
    member?.permissions.has(PermissionFlagsBits.Administrator) ||
    member?.permissions.has(PermissionFlagsBits.ManageGuild)
  );
}

function createBoard() {
  return Array.from({ length: BOARD_ROWS }, () =>
    Array(BOARD_COLUMNS).fill(null),
  );
}

function getPlayerColor(game, playerId) {
  return playerId === game.player1 ? "🔴" : "🟡";
}

function getPlayerLabel(game, playerId) {
  if (playerId === client.user?.id) return "the bot";
  return `<@${playerId}>`;
}

function getCurrentPlayerLabel(game) {
  return getPlayerLabel(game, game.turn);
}

function renderBoard(game) {
  const board = game.board
    .map((row) =>
      row
        .map((cell) => (cell === null ? "⚪" : getPlayerColor(game, cell)))
        .join(" "),
    )
    .join("\n");

  let status;
  if (game.status === "waiting") {
    status = `Waiting for another member to join ${getPlayerLabel(game, game.player1)}.`;
  } else if (game.status === "finished") {
    status = game.winner
      ? `Winner: ${getPlayerLabel(game, game.winner)} ${getPlayerColor(game, game.winner)}`
      : "Draw game.";
  } else {
    status = `Turn: ${getCurrentPlayerLabel(game)} ${getPlayerColor(game, game.turn)}`;
  }

  const opponentLine =
    game.mode === "bot"
      ? `Opponent: ${getPlayerLabel(game, client.user?.id)}`
      : game.player2
        ? `Players: ${getPlayerLabel(game, game.player1)} vs ${getPlayerLabel(game, game.player2)}`
        : "Players: one member vs another member";

  return `**Connect 4**\n${opponentLine}\n\n${board}\n\n${status}`;
}

function getLobbyComponents() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("connect4:member")
        .setLabel("Play a member")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("connect4:bot")
        .setLabel("Play the bot")
        .setStyle(ButtonStyle.Success),
    ),
  ];
}

function getWaitingComponents(game) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`connect4:join:${game.id}`)
        .setLabel("Join this game")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`connect4:end:${game.id}`)
        .setLabel("Cancel game")
        .setStyle(ButtonStyle.Danger),
    ),
  ];
}

function getGameComponents(game) {
  const dropButtons = Array.from({ length: BOARD_COLUMNS }, (_, column) =>
    new ButtonBuilder()
      .setCustomId(`connect4:drop:${game.id}:${column}`)
      .setLabel(`${column + 1}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(
        game.status !== "playing" || game.board[0][column] !== null,
      ),
  );

  return [
    new ActionRowBuilder().addComponents(dropButtons.slice(0, 4)),
    new ActionRowBuilder().addComponents(dropButtons.slice(4)),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`connect4:end:${game.id}`)
        .setLabel("End game")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(game.status === "finished"),
    ),
  ];
}

function findOpenRow(board, column) {
  for (let row = BOARD_ROWS - 1; row >= 0; row -= 1) {
    if (board[row][column] === null) return row;
  }
  return -1;
}

function hasWinner(board, row, column, player) {
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  return directions.some(([rowStep, columnStep]) => {
    let count = 1;

    for (const direction of [-1, 1]) {
      let nextRow = row + rowStep * direction;
      let nextColumn = column + columnStep * direction;

      while (
        nextRow >= 0 &&
        nextRow < BOARD_ROWS &&
        nextColumn >= 0 &&
        nextColumn < BOARD_COLUMNS &&
        board[nextRow][nextColumn] === player
      ) {
        count += 1;
        nextRow += rowStep * direction;
        nextColumn += columnStep * direction;
      }
    }

    return count >= 4;
  });
}

function isBoardFull(board) {
  return board[0].every((cell) => cell !== null);
}

function makeMove(game, column, player) {
  const row = findOpenRow(game.board, column);
  if (row === -1) return { row: -1, won: false, draw: false };

  game.board[row][column] = player;
  return {
    row,
    won: hasWinner(game.board, row, column, player),
    draw: !hasWinner(game.board, row, column, player) && isBoardFull(game.board),
  };
}

function getAvailableColumns(board) {
  const center = Math.floor(BOARD_COLUMNS / 2);

  return Array.from({ length: BOARD_COLUMNS }, (_, index) => index)
    .filter((column) => findOpenRow(board, column) !== -1)
    .sort(
      (left, right) =>
        Math.abs(left - center) - Math.abs(right - center),
    );
}

function hasAnyWinner(board, player) {
  for (let row = 0; row < BOARD_ROWS; row += 1) {
    for (let column = 0; column < BOARD_COLUMNS; column += 1) {
      if (board[row][column] === player && hasWinner(board, row, column, player)) {
        return true;
      }
    }
  }

  return false;
}

function scoreWindow(window, botId, userId) {
  const botPieces = window.filter((cell) => cell === botId).length;
  const userPieces = window.filter((cell) => cell === userId).length;
  const emptySpaces = window.filter((cell) => cell === null).length;

  if (botPieces === 4) return 100000;
  if (userPieces === 4) return -100000;
  if (botPieces === 3 && emptySpaces === 1) return 120;
  if (botPieces === 2 && emptySpaces === 2) return 15;
  if (userPieces === 3 && emptySpaces === 1) return -150;
  if (userPieces === 2 && emptySpaces === 2) return -20;
  return 0;
}

function evaluateBoard(board, botId, userId) {
  let score = 0;
  const centerColumn = Math.floor(BOARD_COLUMNS / 2);

  for (let row = 0; row < BOARD_ROWS; row += 1) {
    if (board[row][centerColumn] === botId) score += 6;
    if (board[row][centerColumn] === userId) score -= 6;
  }

  for (let row = 0; row < BOARD_ROWS; row += 1) {
    for (let column = 0; column <= BOARD_COLUMNS - 4; column += 1) {
      score += scoreWindow(
        board[row].slice(column, column + 4),
        botId,
        userId,
      );
    }
  }

  for (let row = 0; row <= BOARD_ROWS - 4; row += 1) {
    for (let column = 0; column < BOARD_COLUMNS; column += 1) {
      score += scoreWindow(
        [0, 1, 2, 3].map((offset) => board[row + offset][column]),
        botId,
        userId,
      );
    }
  }

  for (let row = 0; row <= BOARD_ROWS - 4; row += 1) {
    for (let column = 0; column <= BOARD_COLUMNS - 4; column += 1) {
      score += scoreWindow(
        [0, 1, 2, 3].map((offset) => board[row + offset][column + offset]),
        botId,
        userId,
      );
    }
  }

  for (let row = 0; row <= BOARD_ROWS - 4; row += 1) {
    for (let column = 3; column < BOARD_COLUMNS; column += 1) {
      score += scoreWindow(
        [0, 1, 2, 3].map((offset) => board[row + offset][column - offset]),
        botId,
        userId,
      );
    }
  }

  return score;
}

function simulateMove(board, column, player) {
  const row = findOpenRow(board, column);
  if (row === -1) return null;

  const nextBoard = board.map((boardRow) => [...boardRow]);
  nextBoard[row][column] = player;
  return {
    board: nextBoard,
    row,
    won: hasWinner(nextBoard, row, column, player),
  };
}

function minimax(board, depth, alpha, beta, maximizing, botId, userId) {
  if (hasAnyWinner(board, botId)) return 1000000 + depth;
  if (hasAnyWinner(board, userId)) return -1000000 - depth;

  const available = getAvailableColumns(board);
  if (depth === 0 || available.length === 0) {
    return evaluateBoard(board, botId, userId);
  }

  if (maximizing) {
    let bestScore = -Infinity;

    for (const column of available) {
      const move = simulateMove(board, column, botId);
      const score = minimax(
        move.board,
        depth - 1,
        alpha,
        beta,
        false,
        botId,
        userId,
      );
      bestScore = Math.max(bestScore, score);
      alpha = Math.max(alpha, bestScore);
      if (beta <= alpha) break;
    }

    return bestScore;
  }

  let bestScore = Infinity;

  for (const column of available) {
    const move = simulateMove(board, column, userId);
    const score = minimax(
      move.board,
      depth - 1,
      alpha,
      beta,
      true,
      botId,
      userId,
    );
    bestScore = Math.min(bestScore, score);
    beta = Math.min(beta, bestScore);
    if (beta <= alpha) break;
  }

  return bestScore;
}

function chooseBotColumn(game) {
  const available = getAvailableColumns(game.board);
  if (available.length === 0) return -1;

  const botId = client.user.id;
  const userId = game.player1;
  const searchDepth = 5;
  let bestColumn = available[0];
  let bestScore = -Infinity;

  for (const column of available) {
    const move = simulateMove(game.board, column, botId);
    const score = move.won
      ? 1000000 + searchDepth
      : minimax(
          move.board,
          searchDepth - 1,
          -Infinity,
          Infinity,
          false,
          botId,
          userId,
        );

    if (score > bestScore) {
      bestScore = score;
      bestColumn = column;
    }
  }

  return bestColumn;
}

function channelSlug(username) {
  return (
    username.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 18) ||
    "player"
  );
}

async function createGameChannel(interaction, mode) {
  const guild = interaction.guild;
  const lobbyChannel = await getConnect4Channel();
  const gameId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const playerId = interaction.user.id;
  const botId = client.user.id;
  const everyoneId = guild.roles.everyone.id;
  const waitingForMember = mode === "member";

  const permissionOverwrites = [
    {
      id: everyoneId,
      allow: waitingForMember ? [PermissionFlagsBits.ViewChannel] : [],
      deny: waitingForMember
        ? [PermissionFlagsBits.SendMessages]
        : [PermissionFlagsBits.ViewChannel],
    },
    {
      id: playerId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
    {
      id: botId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
      ],
    },
  ];

  const channel = await guild.channels.create({
    name: `connect-4-${channelSlug(interaction.user.username)}-${gameId.slice(-4)}`,
    type: ChannelType.GuildText,
    parent: lobbyChannel.parentId ?? undefined,
    permissionOverwrites,
  });

  const game = {
    id: gameId,
    mode,
    status: waitingForMember ? "waiting" : "playing",
    guildId: guild.id,
    channelId: channel.id,
    channel,
    player1: playerId,
    player2: mode === "bot" ? botId : null,
    turn: playerId,
    board: createBoard(),
    winner: null,
  };

  games.set(gameId, game);
  return game;
}

async function handleConnect4Button(interaction) {
  const [, action, value, columnText] = interaction.customId.split(":");

  if (action === "member" || action === "bot") {
    if (!interaction.guild) {
      await interaction.reply({
        content: "Connect 4 games are only available inside a server.",
        ephemeral: true,
      });
      return;
    }

    try {
      const game = await createGameChannel(interaction, action === "bot" ? "bot" : "member");
      await interaction.reply({
        content: `Your private Connect 4 channel is ready: <#${game.channelId}>`,
        ephemeral: true,
      });
      await game.channel.send({
        content: renderBoard(game),
        components:
          game.status === "waiting"
            ? getWaitingComponents(game)
            : getGameComponents(game),
      });
    } catch (error) {
      console.error("Unable to create the Connect 4 game channel.", error);
      await interaction.reply({
        content: "I could not create the private game channel. Check my channel permissions and try again.",
        ephemeral: true,
      });
    }
    return;
  }

  const game = games.get(value);
  if (!game) {
    await interaction.reply({
      content: "That game is no longer active. Start a new one from the Connect 4 lobby.",
      ephemeral: true,
    });
    return;
  }

  if (action === "join") {
    if (game.status !== "waiting") {
      await interaction.reply({ content: "That game has already started.", ephemeral: true });
      return;
    }
    if (interaction.user.id === game.player1) {
      await interaction.reply({ content: "You already created this game.", ephemeral: true });
      return;
    }

    game.player2 = interaction.user.id;
    game.status = "playing";
    game.turn = game.player1;

    await game.channel.permissionOverwrites.edit(game.guildId, {
      ViewChannel: false,
    });
    await game.channel.permissionOverwrites.edit(game.player2, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
    });
    await interaction.update({
      content: renderBoard(game),
      components: getGameComponents(game),
    });
    return;
  }

  if (action === "end") {
    const canEnd =
      interaction.user.id === game.player1 ||
      interaction.user.id === game.player2 ||
      isModerator(interaction.member);

    if (!canEnd) {
      await interaction.reply({
        content: "Only the players or a server moderator can end this game.",
        ephemeral: true,
      });
      return;
    }

    game.status = "finished";
    await interaction.update({
      content: `${renderBoard(game)}\n\n**Game ended.**`,
      components: getGameComponents(game),
    });
    games.delete(game.id);
    return;
  }

  if (action !== "drop") return;

  const column = Number(columnText);
  if (
    game.status !== "playing" ||
    !Number.isInteger(column) ||
    column < 0 ||
    column >= BOARD_COLUMNS
  ) {
    await interaction.reply({ content: "That move is no longer available.", ephemeral: true });
    return;
  }
  if (interaction.channelId !== game.channelId) {
    await interaction.reply({ content: "Moves must be made in the private game channel.", ephemeral: true });
    return;
  }
  if (interaction.user.id !== game.turn) {
    await interaction.reply({
      content: `It is ${getCurrentPlayerLabel(game)}'s turn.`,
      ephemeral: true,
    });
    return;
  }

  const currentPlayer = game.turn;
  const move = makeMove(game, column, currentPlayer);

  if (move.row === -1) {
    await interaction.reply({ content: "That column is full. Choose another one.", ephemeral: true });
    return;
  }

  if (move.won) {
    game.status = "finished";
    game.winner = currentPlayer;
  } else if (move.draw) {
    game.status = "finished";
  } else if (game.mode === "bot") {
    game.turn = client.user.id;
    const botColumn = chooseBotColumn(game);
    const botMove = makeMove(game, botColumn, client.user.id);

    if (botMove.won) {
      game.status = "finished";
      game.winner = client.user.id;
    } else if (botMove.draw) {
      game.status = "finished";
    } else {
      game.turn = game.player1;
    }
  } else {
    game.turn = game.turn === game.player1 ? game.player2 : game.player1;
  }

  await interaction.update({
    content: renderBoard(game),
    components: getGameComponents(game),
  });
}

client.once("ready", (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const content = message.content.trim();
  const command = content.toLowerCase();

  if (command === "!connect4") {
    if (!isModerator(message.member)) {
      await message.reply("Only server moderators can post the Connect 4 lobby.");
      return;
    }

    try {
      const channel = await getConnect4Channel();
      await channel.send({
        content:
          "**Connect 4 lobby**\nChoose a game below. Your selection will open a private channel for the match.",
        components: getLobbyComponents(),
      });
      if (message.deletable) await message.delete();
    } catch (error) {
      console.error("Unable to post the Connect 4 lobby.", error);
      await message.reply(
        "Set CONNECT4_CHANNEL_ID to the lobby channel ID, then restart the bot.",
      );
    }
    return;
  }

  if (command.startsWith("!announce")) {
    const announcement = content.slice("!announce".length).trim();

    if (!isModerator(message.member)) {
      await message.reply("Only server moderators can send official announcements.");
      return;
    }

    if (!announcement) {
      await message.reply("Usage: `!announce <your announcement>`");
      return;
    }

    try {
      await message.channel.send(announcement);
      if (message.deletable) await message.delete();
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

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton() || !interaction.customId.startsWith("connect4:")) {
    return;
  }

  try {
    await handleConnect4Button(interaction);
  } catch (error) {
    console.error("Unable to handle a Connect 4 interaction.", error);
    const response = {
      content: "Something went wrong with that game action. Please try again.",
      ephemeral: true,
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(response);
    } else {
      await interaction.reply(response);
    }
  }
});

client.login(BOT_TOKEN);