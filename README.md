# Source Manager (Game Access plugin)

Optional companion plugin for Game Access. It runs a small local server that hands
Game Access the download sources you have configured for a game.
Game Access works without it; links and profiles can also be added by hand.

## Disclaimer

This software does not host, distribute or include any copyrighted content.
You choose and add your own sources and you are solely responsible for how you use them
and for complying with the laws that apply to you.

## Features

- Local HTTP API used by Game Access (`/api/prepare`, `/api/health`, `/api/execution-profile`).
- Matches game titles to your sources and ranks them (see Source ranking).
- Optional execution profiles (archive passwords, pre-play steps) stored only on your machine.

## Source ranking

For each game the plugin returns sources in this order:

1. Sources that support online multiplayer, if the game has any.
2. Torrents with the most seeds first.
3. Everything else, torrents before direct links.

## Install

Windows: use the installer from the Releases page. It finds your Game Access
installation and places the plugin in `%APPDATA%\GameAccess\plugins`.
Game Access starts the plugin automatically.

From source:

    npm install
    npm test
    npm start

## Execution profiles

Active file: `%APPDATA%\GameAccess\plugins\execution-profiles.json`.
The installer creates it from `execution-profiles.default.json` if it does not exist
(it never overwrites an existing one). Never publish or commit your own copy: it may contain
archive passwords.
It has `default`, `sources` (by source name) and `games` (by Steam AppID);
priority is game, then source, then default. Each profile accepts `version: 1`, `id`, `name`,
`archivePasswords` and `beforePlay`. Supported steps: `ini-set` (`glob`, `section`, `key`, `value`)
and `run` (`file`, `args`), limited to the game folder; there is no arbitrary shell.

    {"default":{"version":1,"id":"default","name":"Optional profile","archivePasswords":[],"beforePlay":[]},"sources":{},"games":{}}

## Installer

The Windows installer source is in `installer/` (.NET, WinForms).

## License

Apache-2.0
