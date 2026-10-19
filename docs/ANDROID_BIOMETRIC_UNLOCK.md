# Android biometric unlock for Hasib AI Agent

## Goal
Use Android's system biometric prompt on the owner's enrolled device (including the owner's Oppo A58) to unlock the app locally. The app must never collect, transmit, store, or compare fingerprint images/templates.

## Required behavior
- Use AndroidX BiometricPrompt through a maintained Capacitor native biometric plugin, with an Android implementation that delegates verification to the OS/TEE.
- Require a strong biometric where the device supports it; permit device credential fallback only if explicitly chosen in product policy. For the requested fingerprint-only behavior, do not silently treat a generic browser prompt as equivalent.
- On first enrollment, require the owner to authenticate with the device's system biometric and bind enrollment to a cryptographically random key generated/stored in Android Keystore. Never use model name, IMEI, serial number, Android ID, user-agent, IP address, or a client-supplied identifier as proof of device identity.
- Gate the app's local sensitive screens with a native biometric prompt. For server-protected actions, require a server-validated session plus proof using a device-bound private key that is non-exportable and usable only after biometric authentication; a local UI flag alone is not authorization.
- Handle no biometric hardware, no enrolled biometric, lockout, cancellation, invalidation after biometric enrollment changes, and plugin errors with fail-closed behavior for protected actions and a clear setup message.
- Never cache a permanent `unlocked=true` flag in localStorage. On app resume/reload or after a short inactivity timeout, require re-authentication.
- Add tests for success, failure, cancel, lockout, missing enrollment, biometric-set change, and calls from a second device.

## Current repository constraints (verified from source snapshot)
- `capacitor.config.ts` points the native shell at the hosted Render URL.
- `package.json` does not currently declare Capacitor core/CLI or a biometric plugin.
- `android/` native project files were not found at the expected paths during inspection.
- The Settings screen currently states that protection is not configured and the app has no account login or enrolled-device lock.
- The existing authorized-device SQL migration is only a schema foundation; it is not applied to a live Supabase project and does not enforce authorization by itself.

## Status
**Not implemented or enabled.** This document is an implementation specification only. A biometric prompt must not be advertised as active until the native plugin and Android project are wired into the APK build, the app's protected entry points are gated, device-bound key verification is enforced server-side, and an APK is installed and tested on the owner's phone.
