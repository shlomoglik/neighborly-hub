import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// CI installs the capture tool in a temporary directory, outside application dependencies.
const modulePath = process.env.PLAYWRIGHT_MODULE_PATH;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : "playwright");
const output = resolve(process.env.SCREENSHOT_DIRECTORY ?? "artifacts/storybook");
const base = process.env.STORYBOOK_URL ?? "http://127.0.0.1:6006";
await mkdir(output, { recursive: true });
const cases = [
  ["01-household-he-mobile", "features-community-building-blocks--household", "he", 390],
  ["02-privacy-he-mobile", "features-community-building-blocks--privacy", "he", 390],
  ["03-member-form-ru-mobile", "features-community-composites--member-form", "ru", 390],
  ["04-apartment-map-he-desktop", "features-community-building-blocks--building-map", "he", 1280],
  ["05-directory-en-desktop", "features-directory-filters--interactive", "en", 1280],
  ["06-child-privacy-he-mobile", "features-community-composites--child-privacy", "he", 390],
  ["07-navigation-ru-mobile", "features-community-composites--manager-navigation", "ru", 390],
  ["08-loading-details-he-mobile", "features-community-loading-and-motion--details", "he", 390],
  ["09-loading-map-en-desktop", "features-community-loading-and-motion--building-map", "en", 1280],
  ["10-details-he-mobile", "features-community-composites--responsive-details", "he", 390, true],
  ["11-details-en-tablet", "features-community-composites--responsive-details", "en", 768, true],
  ["12-details-en-desktop", "features-community-composites--responsive-details", "en", 1280, true],
  ["13-setup-project-he-mobile", "features-management-project-setup--interactive", "he", 390],
  [
    "14-setup-buildings-he-mobile",
    "features-management-project-setup--interactive",
    "he",
    390,
    false,
    1,
  ],
  [
    "15-setup-review-he-mobile",
    "features-management-project-setup--interactive",
    "he",
    390,
    false,
    2,
  ],
  [
    "16-setup-review-en-desktop",
    "features-management-project-setup--interactive",
    "en",
    1280,
    false,
    2,
  ],
  ["17-setup-project-ru-mobile", "features-management-project-setup--interactive", "ru", 390],
];

// Finish the initial Storybook render before interactions unmount animated steps.
async function settleAnimations(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    // Entry transitions may start after React effects or the detail panel mounts.
    // Let finite animations settle; never wait for an infinite skeleton pulse.
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime))
        .map((animation) => animation.finished.catch(() => {})),
    );
  });
}

const browser = await chromium.launch();
const manifest = [];
try {
  for (const [name, story, lang, width, openDetails, setupStep] of cases) {
    const page = await browser.newPage({ viewport: { width, height: 960 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.stack ?? error.message));
    const url = `${base}/iframe.html?id=${story}&viewMode=story&globals=locale:${lang}`;
    await page.goto(url);
    await page.waitForFunction(() => document.querySelector("#storybook-root")?.textContent.trim());
    await settleAnimations(page);
    if (setupStep) {
      const main = page.getByRole("main");
      await main.getByRole("textbox").nth(0).fill("Neighborly Demo");
      await main.getByRole("textbox").nth(1).fill("Sderot");
      await main.getByRole("button").last().click();
      await main.getByRole("spinbutton").first().waitFor();
      await main.getByRole("textbox").fill("A");
      await main.getByRole("spinbutton").nth(0).fill("4");
      await main.getByRole("spinbutton").nth(1).fill("3");
      await settleAnimations(page);
      if (setupStep === 2) {
        await main.getByRole("button").last().click();
        await main.getByRole("heading", { level: 2 }).waitFor();
      }
    }
    if (openDetails) {
      await page.getByRole("button").first().click();
      await page.getByRole(width < 1024 ? "dialog" : "complementary").waitFor();
    }
    await settleAnimations(page);
    if (errors.length) throw new Error(`${name}: ${errors.join("; ")}`);
    if (await page.locator(".sb-errordisplay").isVisible())
      throw new Error(`Story failed: ${story}`);
    await page.screenshot({
      path: resolve(output, `${name}.png`),
      fullPage: true,
      animations: "disabled",
    });
    manifest.push({ file: `${name}.png`, story, lang, width });
    console.log(`Captured ${name}`);
    await page.close();
  }
  await writeFile(resolve(output, "manifest.json"), JSON.stringify(manifest, null, 2));
} finally {
  await browser.close();
}
