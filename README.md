<p align="center">
  <img src="assets/icon.png" width="128" height="128" alt="Irisflow icon">
</p>

<h1 align="center">Irisflow</h1>

<p align="center"><b>Free, open source video meetings. Share a link, talk, share your screen, draw on it.</b></p>

Irisflow is part of the FlowApps suite. It is a Google Meet-style meeting app you host yourself, with no accounts.

## What it does

- **Start a meeting, share the link or the code.** Guests need no account.
- **Host controls.** A waiting room (the host lets people in), mute, remove, and end the meeting.
- **Screen sharing, with drawing.** Draw on the shared screen. Draw switches on once someone is sharing.
- **Chat, raised hands and reactions.**
- **Works on phones.** The bottom bar folds into a More menu on small screens.
- **Desktop app** for Mac and Windows (Tauri), plus any modern browser.

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

## Run it from source

You need Node 20+, a [LiveKit server](https://docs.livekit.io/home/self-hosting/local/), and Rust if you want the desktop shell.

```bash
livekit-server --dev                 # LiveKit on :7880 (dev keys)
cd app/server && npm install && npm start   # token server on :8787
cd app/web && npm install && npm run dev    # web app on :5173
cd app/desktop && cargo run                 # optional desktop shell, loads :5173
```

For a real deployment set `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` and `LIVEKIT_HTTP_URL` on the token server. The built-in
`devkey` and `secret` values are for local testing only.

## Credits and license

Apache 2.0. Built on LiveKit, Tauri, React and more. Full credits in `NOTICE`. Brand font: Firjar (OFL).
