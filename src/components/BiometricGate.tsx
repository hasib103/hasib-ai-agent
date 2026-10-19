import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import {
  AndroidBiometryStrength,
  BiometricAuth,
  BiometryError,
  BiometryErrorType,
} from "@aparajita/capacitor-biometric-auth";

type GateState = "checking" | "locked" | "unlocked" | "unavailable";

export function BiometricGate({ children }: { children: ReactNode }) {
  const [nativeApp, setNativeApp] = useState(false);
  const [state, setState] = useState<GateState>("checking");
  const [message, setMessage] = useState("Checking device biometric security…");
  const authenticating = useRef(false);
  const backgrounded = useRef(false);

  const authenticate = useCallback(async () => {
    if (authenticating.current) return;
    authenticating.current = true;
    setState("locked");
    setMessage("Unlock Hasib AI Agent with your enrolled fingerprint.");
    try {
      const info = await BiometricAuth.checkBiometry();
      if (!info.strongBiometryIsAvailable) {
        setState("unavailable");
        setMessage(
          "Strong biometric authentication is unavailable. Enrol a fingerprint in Android Settings and ensure it is available to apps. Protected app access remains locked."
        );
        return;
      }
      await BiometricAuth.authenticate({
        reason: "Unlock your private Hasib AI Agent",
        cancelTitle: "Cancel",
        allowDeviceCredential: false,
        androidTitle: "Hasib AI Agent",
        androidSubtitle: "Verify your fingerprint to continue",
        androidConfirmationRequired: false,
        androidBiometryStrength: AndroidBiometryStrength.strong,
      });
      setState("unlocked");
      setMessage("");
    } catch (error) {
      setState("locked");
      if (error instanceof BiometryError && error.code === BiometryErrorType.userCancel) {
        setMessage("App remains locked. Use fingerprint to unlock.");
      } else {
        setMessage("Fingerprint verification failed or was cancelled. App remains locked.");
      }
    } finally {
      authenticating.current = false;
    }
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      // The public website is not protected by a browser simulation of biometrics.
      setNativeApp(false);
      setState("unlocked");
      return;
    }
    setNativeApp(true);
    void authenticate();
    let disposed = false;
    let handle: { remove: () => Promise<void> } | undefined;
    void App.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) {
        backgrounded.current = true;
        return;
      }
      if (backgrounded.current && !disposed) {
        backgrounded.current = false;
        void authenticate();
      }
    }).then((listener) => {
      if (disposed) void listener.remove();
      else handle = listener;
    }).catch(() => {
      setState("locked");
      setMessage("Could not initialize secure app lifecycle handling. Access remains locked.");
    });
    const lockHandler = () => {
      setState("locked");
      void authenticate();
    };
    window.addEventListener("hasib:lock-app", lockHandler);
    return () => {
      disposed = true;
      void handle?.remove();
      window.removeEventListener("hasib:lock-app", lockHandler);
    };
  }, [authenticate]);

  if (!nativeApp && state === "unlocked") return <>{children}</>;
  if (state === "unlocked") return <>{children}</>;

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <section className="card-surface w-full max-w-sm p-6 space-y-4 text-center" role="status" aria-live="polite">
        <div className="text-4xl" aria-hidden="true">🔐</div>
        <h1 className="text-xl font-semibold">Hasib AI Agent is locked</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        <button
          className="btn btn-primary w-full"
          onClick={() => void authenticate()}
          disabled={authenticating.current || state === "checking"}
        >
          Verify fingerprint
        </button>
        {state === "unavailable" && (
          <p className="text-xs text-muted-foreground">
            This native biometric gate is local app protection only. Server-side account and device authorization are still required to block use of the public website from other phones.
          </p>
        )}
      </section>
    </main>
  );
}
