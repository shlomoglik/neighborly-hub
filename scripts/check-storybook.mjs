import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

// Keep browser tooling outside the application's dependencies, as in the screenshot workflow.
const modulePath = process.env.PLAYWRIGHT_MODULE_PATH;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : "playwright");
const base = process.env.STORYBOOK_URL ?? "http://127.0.0.1:6006";
const response = await fetch(`${base}/index.json`);
assert(response.ok, `Storybook index returned ${response.status}`);
const { entries } = await response.json();
const stories = Object.values(entries).filter((entry) => entry.type === "story");
assert(stories.length, "Storybook index contains no stories");
const browser = await chromium.launch();
try {
  for (const story of stories) {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    // Storybook catches render errors, so pageerror alone cannot detect failed stories.
    await page.addInitScript(() => {
      window.addEventListener("message", (event) => {
        let data = event.data;
        if (typeof data === "string") {
          try {
            data = JSON.parse(data);
          } catch {
            return;
          }
        }
        if (
          ["storyRendered", "storyErrored", "storyThrewException", "storyMissing"].includes(
            data?.event?.type,
          )
        ) {
          window.__storyResult = data.event;
        }
      });
    });
    try {
      // Provide a parent window: the preview emits its lifecycle events to its parent.
      await page.goto(`${base}/index.json`);
      await page.evaluate(
        (url) => {
          const frame = document.createElement("iframe");
          frame.src = url;
          document.body.replaceChildren(frame);
        },
        `${base}/iframe.html?id=${encodeURIComponent(story.id)}&viewMode=story`,
      );
      await page.waitForFunction(() => window.__storyResult, null, { timeout: 15000 });
      const result = await page.evaluate(() => window.__storyResult);
      assert.equal(result.type, "storyRendered", JSON.stringify(result));
      assert.deepEqual(errors, [], errors.join("\n"));
      console.log(`Rendered ${story.id}`);
    } catch (error) {
      throw new Error(`${story.id}: ${error.message}`, { cause: error });
    } finally {
      await page.close();
    }
  }
  console.log(`Verified ${stories.length} stories`);
} finally {
  await browser.close();
}
