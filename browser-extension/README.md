# Hasib AI Agent Companion (early preview)

This is a lightweight Manifest V3 browser-extension companion for the existing Hasib AI Agent web app.

## What it does

- Reads selected page text only after the user opens the extension popup.
- Lets the user review/edit the prompt before continuing.
- Copies the prompt to the clipboard and opens the official Hasib AI Agent web app.
- Does not read page content in the background, collect browsing history, or include an AI-provider API key.

The current preview intentionally uses a copy-and-paste handoff. It does **not** automatically submit prompts to the web app because the app does not yet expose a dedicated, authenticated extension handoff route. The user must be signed in to the web app and paste the copied prompt into chat.

## Install locally in Chrome or another Chromium browser

1. Open the browser's extensions page (for Chrome: `chrome://extensions`).
2. Enable Developer mode.
3. Choose **Load unpacked** and select this `browser-extension` directory.
4. Open a normal HTTP/HTTPS page, select text, and click the extension icon.
5. Review the prompt and choose **Copy prompt & open Hasib AI**. Paste the prompt into the Hasib AI chat.

## Permissions

- `activeTab`: temporary access to the current tab after the user invokes the extension.
- `scripting`: read the user's current text selection on that tab.
- `storage`: reserved for future settings; not currently used to persist page content.

No broad `<all_urls>` host permission, remote script, telemetry, or API secret is included.

## Before public store release

- Test on supported Chromium browsers and verify keyboard/accessibility behavior.
- Remove the unused `storage` permission if no settings feature is added.
- Add store assets, a privacy policy, and release/versioning documentation.
- Implement a deliberate authenticated deep-link/extension handoff in the web app before claiming one-click AI submission.
- Run manifest/static checks and review the final permissions against the store's policies.
