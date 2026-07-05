require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

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

(async () => {
  try {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const guildId = process.env.DISCORD_GUILD_ID;

    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
      console.log(`Registered /obfuscate to guild ${guildId} (instant).`);
    } else {
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log("Registered /obfuscate globally (can take up to 1 hour to appear).");
    }
  } catch (err) {
    console.error("Failed to register commands:", err);
    process.exit(1);
  }
})();
