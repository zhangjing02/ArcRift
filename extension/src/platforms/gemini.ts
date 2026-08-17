import { INPUT_SELECTOR_STRATEGIES } from "../platform/resolver";

export const gemini = {
  name: "gemini" as const,
  hostname: "gemini.google.com",
  userSelectors: [
    // Gemini uses obfuscated classes & custom web components — multi-level cascade
    '.query-text',
    '.user-query',
    '.query-content',
    'user-query',                          // custom web component tag
    'message-content[data-query-text]',    // data attribute variant
    '[data-message-author="user"]',
    '.conversation-turn-user',
    'user-message',                         // custom element tag
    'div[data-test-id="user-query"]',
    'div[data-testid="user-turn"]',
    '.user-query-container',
    'div[aria-label*="User prompt" i]',
    'div[aria-label*="用户提示" i]',
  ],
  responseSelectors: [
    ".response-content",
    "model-response",
    ".model-response-text",
    "message-content",                      // custom element tag for responses
    'div[data-test-id="model-response"]',
    'div[data-testid="assistant-turn"]',
    '.model-response-container',
    'div[aria-label*="Model response" i]',
    'div[aria-label*="Gemini response" i]',
    'div[aria-label*="回答" i]',
  ],
  // Multi-strategy selectors via resolver — survives platform UI updates
  inputSelectors: INPUT_SELECTOR_STRATEGIES.gemini,
  sendButtonSelectors: [
    'button[aria-label="Send message"]',
    'button[aria-label*="Send" i]',
    'button[aria-label*="发送" i]',
    'button[aria-label*="Submit" i]',
    ".send-button",
    'button.send-button',
    'button[mat-icon-button][aria-label*="Send" i]',
    'button.send-button-container',
    'button:has(mat-icon[data-mat-icon-name="send"])',
    'button:has(svg[data-icon="send"])',
  ],
};
