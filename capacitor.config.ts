import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.hasib.aiagent",
  appName: "Hasib AI Agent",
  webDir: "public",
  server: {
    url: "https://hasib-ai-agent-test.onrender.com",
    cleartext: false,
    androidScheme: "https",
  },
};

export default config;
