# Sttar Obfuscator — Discord Bot

Adds a `/obfuscate` slash command to your Discord server. Attach a `.lua`
file or paste code, pick a preset, and it calls your deployed Sttar
Obfuscator API to obfuscate it.

## Files

```
sttar-obfuscator-bot/
├── index.js              # bot logic + /obfuscate handler
├── deploy-commands.js    # run once to register the slash command
├── package.json
└── .env.example
```

## 1. Create the Discord application

1. Go to https://discord.com/developers/applications → **New Application**.
2. Under **Bot**, click **Reset Token** and copy it → this is `DISCORD_TOKEN`.
3. Under **OAuth2 → General**, copy the **Client ID** → this is `DISCORD_CLIENT_ID`.
4. Under **OAuth2 → URL Generator**: check `bot` and `applications.commands` scopes,
   then under bot permissions check `Send Messages` and `Attach Files`. Open the
   generated URL to invite the bot to your server.

## 2. Configure

```bash
cp .env.example .env
```

Fill in `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, and (optional) `DISCORD_GUILD_ID`
(your server ID — if set, the command appears instantly; if left blank, it's
registered globally and can take up to an hour to show up).

`OBFUSCATOR_BASE_URL` is already set to your deployed obfuscator.

## 3. Register the command and run

```bash
npm install
npm run deploy-commands   # only needed once, or after changing the command
npm start
```

Try `/obfuscate` in Discord — attach a `.lua` file or use the `code` option.
Default preset is **Strong**.

## Deploying (Render, free tier)

Render's free tier only exists for **Web Service** — Background Workers require
a paid plan. This bot doesn't need HTTP for anything, so `index.js` includes a
tiny health-check server just so Render sees something bound to a port and
treats it as a Web Service.

1. Push this folder to its own GitHub repo (or a subfolder, setting Render's
   root directory to `sttar-obfuscator-bot`).
2. Render → **New → Web Service** → connect the repo.
3. Runtime: **Node**.
4. Build command: `npm install`
5. Start command: `npm start`
6. Add the environment variables from `.env` in Render's dashboard.
7. Deploy. Run `npm run deploy-commands` once locally (with the same `.env`
   values) so the `/obfuscate` command shows up in Discord.

**Important — free tier spin-down:** Render puts free web services to sleep
after about 15 minutes with no HTTP traffic, which will disconnect the bot.
Use a free uptime pinger like [UptimeRobot](https://uptimerobot.com) to hit
your Render URL (e.g. `https://your-bot.onrender.com/`) every 5–10 minutes
and keep it awake.

## Notes

- The bot fetches an API key from your obfuscator's `/api/keys` endpoint
  automatically and re-fetches if it's rejected (demo keys reset when that
  server restarts) — no manual key management needed.
- Max file size accepted: 1MB. Long outputs are sent as a file attachment
  instead of a message to avoid Discord's message length limit.
