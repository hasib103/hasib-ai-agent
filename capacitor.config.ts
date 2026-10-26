import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.hasib.aiagent",
  appName: "Hasib AI Agent",
  webDir: "public",
  server: {
    // The installable APK should load the production app, not the test service.
    url: "https://hasib-ai-agent.onrender.com",
    cleartext: false,
    androidScheme: "https",
  },
};

export default config;
