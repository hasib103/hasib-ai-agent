const APP_URL = "https://hasib-ai-agent.onrender.com/";
const promptField = document.getElementById("prompt");
const statusField = document.getElementById("status");
const sendButton = document.getElementById("send");

async function loadSelection() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url || !/^https?:/.test(tab.url)) {
      statusField.textContent = "Open a regular web page and try again.";
      return;
    }
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection()?.toString().trim() ?? "",
    });
    const selection = results[0]?.result ?? "";
    if (selection && !promptField.value.trim()) {
      promptField.value = "Please explain or summarize this selected text in Bengali unless another language is requested:\n\n" + selection;
      statusField.textContent = "Selected text loaded. Review it before sending.";
    }
  } catch {
    statusField.textContent = "This page does not allow text selection access. You can type a prompt manually.";
  }
}

sendButton.addEventListener("click", async () => {
  const prompt = promptField.value.trim();
  if (!prompt) {
    statusField.textContent = "Select text or enter a prompt first.";
    promptField.focus();
    return;
  }

  sendButton.disabled = true;
  try {
    await navigator.clipboard.writeText(prompt);
    await chrome.tabs.create({ url: APP_URL });
    statusField.textContent = "Prompt copied. In Hasib AI, paste it into the chat and submit.";
  } catch {
    statusField.textContent = "Could not copy automatically. Select and copy the prompt, then open Hasib AI.";
    promptField.focus();
  } finally {
    sendButton.disabled = false;
  }
});

void loadSelection();