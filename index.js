require("dotenv").config();
const http = require("http");
const {
  Client,
  GatewayIntentBits,
  AttachmentBuilder,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
} = require("discord.js");

const BASE_URL = (process.env.OBFUSCATOR_BASE_URL || "").replace(/\/$/, "");
const DEFAULT_PRESET = "Strong";

if (!BASE_URL) {
  console.error("OBFUSCATOR_BASE_URL is not set in .env");
  process.exit(1);
}

// ---- register the /obfuscate command on every boot ----
// Registering the same command again just overwrites it, so it's safe to
// run this on every startup instead of requiring a separate manual step.
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("obfuscate")
      .setDescription("Obfuscate a Lua script using Sttar Obfuscator")
      .addAttachmentOption((opt) =>
        opt.setName("file").setDescription("A .lua file to obfuscate").setRequired(false)
      )
      .addStringOption((opt) =>
        opt.setName("code").setDescription("Paste Lua code directly instead of a file").setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName("preset")
          .setDescription("Obfuscation strength (default: Strong)")
          .setRequired(false)
          .addChoices(
            { name: "Minify", value: "Minify" },
            { name: "Weak", value: "Weak" },
            { name: "Medium", value: "Medium" },
            { name: "Strong", value: "Strong" }
          )
      ),
  ].map((c) => c.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
  const clientId = process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.DISCORD_GUILD_ID;

  try {
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
      console.log(`/obfuscate registered to guild ${guildId} (instant).`);
    } else {
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log("/obfuscate registered globally (can take up to 1 hour to appear).");
    }
  } catch (err) {
    console.error("Failed to register /obfuscate command:", err.message);
  }
}

// ---- tiny HTTP server ----
// Render's free tier only exists for "Web Service" instances, which require
// something bound to $PORT. This bot doesn't need HTTP for anything, so this
// server only exists to satisfy that requirement and to give an uptime
// pinger (e.g. UptimeRobot) something to hit so Render doesn't spin it down.
const PORT = process.env.PORT || 3000;
http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(client.isReady() ? "Sttar Obfuscator bot: online" : "Sttar Obfuscator bot: starting...");
  })
  .listen(PORT, () => console.log(`Health check server listening on port ${PORT}`));

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ---- API key handling ----
// Sttar Obfuscator's demo keys live in memory on the server and reset
// whenever that server restarts, so the bot fetches a fresh one lazily
// and re-fetches automatically if a call comes back unauthorized.
let apiKey = null;

async function getApiKey(forceNew = false) {
  if (apiKey && !forceNew) return apiKey;
  const res = await fetch(`${BASE_URL}/api/keys`, { method: "POST" });
  if (!res.ok) throw new Error("Could not get an API key from the obfuscator server.");
  const data = await res.json();
  apiKey = data.key;
  return apiKey;
}

async function obfuscateCode(code, preset) {
  let key = await getApiKey();

  const call = async (k) =>
    fetch(`${BASE_URL}/api/v1/obfuscate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": k },
      body: JSON.stringify({ code, preset }),
    });

  let res = await call(key);
  if (res.status === 401) {
    key = await getApiKey(true); // key rotated/reset server-side, get a fresh one
    res = await call(key);
  }

  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `Obfuscation failed (status ${res.status}).`);
  }
  return data.output;
}

// ---- slash command handler ----
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "obfuscate") return;

  await interaction.deferReply();

  const preset = interaction.options.getString("preset") || DEFAULT_PRESET;
  const pastedCode = interaction.options.getString("code");
  const attachment = interaction.options.getAttachment("file");

  try {
    let sourceCode;
    let filenameHint = "obfuscated.lua";

    if (attachment) {
      if (!attachment.name.toLowerCase().endsWith(".lua")) {
        return interaction.editReply("Only `.lua` files are supported.");
      }
      if (attachment.size > 1024 * 1024) {
        return interaction.editReply("That file is too big (max 1MB).");
      }
      const fileRes = await fetch(attachment.url);
      sourceCode = await fileRes.text();
      filenameHint = attachment.name.replace(/\.lua$/i, ".obf.lua");
    } else if (pastedCode) {
      sourceCode = pastedCode;
    } else {
      return interaction.editReply("Attach a `.lua` file or paste code with the `code` option.");
    }

    const output = await obfuscateCode(sourceCode, preset);

    const embed = new EmbedBuilder()
      .setTitle("Obfuscation complete")
      .setDescription(`Preset: **${preset}**`)
      .setColor(0xededf0);

    // Discord messages cap at ~2000 chars — attach as a file if it's long
    // or if the output has a code block that would blow past that anyway.
    if (output.length > 1500) {
      const file = new AttachmentBuilder(Buffer.from(output, "utf8"), { name: filenameHint });
      await interaction.editReply({ embeds: [embed], files: [file] });
    } else {
      embed.addFields({ name: "Output", value: "```lua\n" + output + "\n```" });
      await interaction.editReply({ embeds: [embed] });
    }
  } catch (err) {
    await interaction.editReply(`Something went wrong: ${err.message}`);
  }
});

client.once("clientReady", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

registerCommands().then(() => client.login(process.env.DISCORD_TOKEN));
