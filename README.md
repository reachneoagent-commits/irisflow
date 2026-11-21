<p align="left">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/header-dark.png">
    <img src="assets/header-light.png" width="600" height="160" alt="Irisflow logo and name">
  </picture>
</p>

<p align="center"><b>Free, open source video meetings. Share a link, talk, share your screen, draw on it.</b></p>

Irisflow is part of the FlowApps suite. It is a Google Meet-style meeting app you host yourself, with no accounts.

## Why Irisflow?

- **Free and open source**, Apache 2.0
- **No accounts**: guests join from a link or a code
- **Hosted by you**: run it on your own LiveKit server
- **Works on phones and desktops**: a desktop app for Mac and Windows, or any modern browser

## Features

- **Start a meeting, share the link or the code.** Guests need no account.
- **Host controls.** A waiting room (the host lets people in), mute, remove, and end the meeting.
- **Screen sharing, with drawing.** Draw on the shared screen. Draw switches on once someone is sharing.
- **Chat, raised hands and reactions.**
- **Works on phones.** The bottom bar folds into a More menu on small screens.

## Download and install

Installers for Mac and Windows are being built and will appear on the
[latest release](https://github.com/reachneoagent-commits/irisflow/releases/latest). It is also coming to the
[FlowApps launcher](https://github.com/reachneoagent-commits/FlowApps-Launcher/releases/latest).

| Platform | Installer |
|---|---|
| macOS, Apple silicon (M1 or newer) | [DMG](https://github.com/reachneoagent-commits/irisflow/releases/latest) (`Irisflow-<version>-macos-arm64.dmg`) |
| Windows x64 | [Installer](https://github.com/reachneoagent-commits/irisflow/releases/latest) (`Irisflow-<version>-windows-x64-setup.exe`) |

The app is not code-signed with a paid certificate, so macOS and Windows warn you the first time you open it.
Every release lists SHA-256 checksums to check the files against.

## Supported platforms

- **Desktop app:** macOS on Apple silicon, and Windows x64
- **Browser:** any modern browser, on desktop or phone

## Build from source

You need Node 20+, a [LiveKit server](https://docs.livekit.io/home/self-hosting/local/), and Rust if you want the desktop shell.

```bash
livekit-server --dev                 # LiveKit on :7880 (dev keys)
cd app/server && npm install && npm start   # token server on :8787
cd app/web && npm install && npm run dev    # web app on :5173
cd app/desktop && cargo run                 # optional desktop shell, loads :5173
```

For a real deployment set `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` and `LIVEKIT_HTTP_URL` on the token server. The built-in
`devkey` and `secret` values are for local testing only.

## About this fork

Irisflow is built on [LiveKit](https://livekit.io), [Tauri](https://tauri.app), [React](https://react.dev) and more.

### Credits

Full credits are in `NOTICE`. Brand font: Firjar (SIL Open Font License).

## License

Apache 2.0.
