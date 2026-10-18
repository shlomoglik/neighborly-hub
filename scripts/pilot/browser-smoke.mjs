import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const modulePath = process.env.PLAYWRIGHT_MODULE_PATH;
if (!modulePath || !process.env.PILOT_FIXTURE_DIRECTORY)
  throw new Error("Use the isolated pilot workflow and fixture directory");
const { chromium } = await import(pathToFileURL(modulePath).href);
const fixture = JSON.parse(
  await readFile(join(process.env.PILOT_FIXTURE_DIRECTORY, "identities.json"), "utf8"),
);
const { origin, identities, labels: t } = fixture;
assert.equal(origin, "https://127.0.0.1:3443");
const output = process.env.PILOT_REPORT_DIRECTORY;
if (!output) throw new Error("PILOT_REPORT_DIRECTORY is required");
const report = {
  origin: "isolated HTTPS loopback",
  googleConsent: "not exercised; requires real Google credentials and a device",
  checks: [],
  passed: false,
};
const browser = await chromium.launch();
const contexts = [];
const runtimeErrors = [];
async function context(role, mobile = false) {
  const c = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: mobile ? 390 : 1280, height: 900 },
    isMobile: mobile,
    hasTouch: mobile,
  });
  contexts.push(c);
  if (role) await c.addCookies(identities[role].cookies);
  await c.addCookies([{ name: "neighborly_lang", value: "en", url: origin }]);
  c.on("page", (page) => page.on("pageerror", () => runtimeErrors.push("Browser runtime error")));
  return c;
}
async function check(name, action) {
  try {
    await action();
  } catch (error) {
    process.stderr.write(`FAIL ${name}\n`);
    for (const c of contexts)
      for (const page of c.pages()) {
        process.stderr.write(
          JSON.stringify({
            route: new URL(page.url()).pathname
              .replace(/\/[0-9a-f-]{36}/g, "/:id")
              .replace(/\/join\/.+/, "/join/:token"),
            headings: await page.getByRole("heading").allTextContents(),
            feedback: await page.locator('[role="alert"], [role="status"]').allTextContents(),
            labels: await page.locator("label > span").allTextContents(),
            visibility: await page.evaluate(() => document.visibilityState),
          }) + "\n",
        );
      }
    throw error;
  }
  report.checks.push({ name, passed: true });
  process.stdout.write(`PASS ${name}\n`);
}
async function ready(c) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try {
      const response = await c.request.get(`${origin}/api/me`);
      if (response.status() === 401) return;
    } catch {
      /* Wait for the real app and TLS bridge. */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Pilot app did not become ready");
}
const button = (page, key) => page.getByRole("button", { name: t[key], exact: true });
async function createLink(page) {
  await page.bringToFront();
  const responsePromise = page.waitForResponse(
    (r) => r.request().method() === "POST" && /\/invitations$/.test(new URL(r.url()).pathname),
  );
  await button(page, "inviteCreate").click();
  const response = await responsePromise;
  assert.equal(response.status(), 201);
  const data = await response.json();
  await page.getByRole("img", { name: t.inviteQrAlt }).waitFor();
  assert.match(
    await page.getByRole("link", { name: t.inviteWhatsApp, exact: true }).getAttribute("href"),
    /^https:\/\/wa\.me\//,
  );
  assert.match(
    await page.getByRole("link", { name: t.inviteEmail, exact: true }).getAttribute("href"),
    /^mailto:/,
  );
  return data.url;
}
async function approve(page, name) {
  await page.bringToFront();
  await button(page, "refreshManagement").click();
  const row = page.locator("li").filter({ has: page.locator("bdi").filter({ hasText: name }) });
  await row.getByRole("button", { name: t.inviteApprove, exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: t.confirm, exact: true }).click();
  await row.getByText(t.inviteApproved, { exact: true }).waitFor();
}
try {
  const anonymous = await context();
  await ready(anonymous);
  await check("anonymous API and production development-route boundaries", async () => {
    assert.equal((await anonymous.request.get(`${origin}/api/me`)).status(), 401);
    assert.equal((await anonymous.request.get(`${origin}/api/management/projects`)).status(), 401);
    assert.equal(
      (await anonymous.request.post(`${origin}/api/dev/project-structure`, { data: {} })).status(),
      404,
    );
    const page = await anonymous.newPage();
    await page.goto(`${origin}/account`);
    assert.equal(new URL(page.url()).pathname, "/auth");
    await page.close();
  });
  await check(
    "Google OAuth start uses the configured HTTPS callback; no real consent claimed",
    async () => {
      const response = await anonymous.request.post(`${origin}/api/auth/sign-in/social`, {
        headers: { Origin: origin },
        data: { provider: "google", callbackURL: `${origin}/directory` },
      });
      assert.equal(response.status(), 200);
      const data = await response.json();
      const url = new URL(data.url);
      assert.equal(url.protocol, "https:");
      assert.equal(url.hostname, "accounts.google.com");
      assert.equal(url.searchParams.get("redirect_uri"), `${origin}/api/auth/callback/google`);
    },
  );
  const admin = await context("admin");
  const adminPage = await admin.newPage();
  let projectId, householdId, residentLink;
  const projectName = `Pilot ${crypto.randomUUID().slice(0, 8)}`;
  await check(
    "desktop: create project/building/apartments through the real setup wizard",
    async () => {
      await adminPage.goto(`${origin}/manage/setup`);
      await adminPage.getByLabel(t.projectName, { exact: true }).fill(projectName);
      await adminPage.getByLabel(t.city, { exact: true }).fill("Sderot");
      await button(adminPage, "buildings").click();
      await adminPage.getByLabel(t.building, { exact: true }).fill("Pilot A");
      await adminPage.getByLabel(t.unitsPerFloor, { exact: true }).fill("2");
      await button(adminPage, "stepReview").click();
      await button(adminPage, "create").click();
      await adminPage.getByRole("link", { name: t.openProjectManagement, exact: true }).click();
      await adminPage.waitForURL(
        (url) => url.pathname === "/manage" && !!url.searchParams.get("project"),
      );
      projectId = new URL(adminPage.url()).searchParams.get("project");
      assert.match(projectId, /^[0-9a-f-]{36}$/);
      await adminPage.getByRole("link", { name: t.inviteManagement, exact: true }).click();
      await adminPage.waitForURL(`${origin}/manage/invitations/${projectId}`);
    },
  );
  await check(
    "desktop: issue a restricted resident invitation with local QR and share links",
    async () => {
      await adminPage.bringToFront();
      await adminPage
        .locator("label")
        .filter({ has: adminPage.getByText(t.building, { exact: true }) })
        .locator("select")
        .selectOption({ label: "Pilot A" });
      await adminPage
        .locator("label")
        .filter({ has: adminPage.getByText(t.apartment, { exact: true }) })
        .locator("select")
        .selectOption({ label: `${t.floor} 0 · ${t.apartment} 1` });
      await adminPage
        .getByLabel(t.inviteRecipientEmail, { exact: true })
        .fill(identities.resident.email);
      residentLink = await createLink(adminPage);
    },
  );
  const resident = await context("resident", true);
  const residentPage = await resident.newPage();
  await check(
    "mobile: claim invitation and remain unauthorized until manager approval",
    async () => {
      await residentPage.goto(residentLink);
      await residentPage.getByLabel(t.fullName, { exact: true }).fill("Pilot Resident");
      await residentPage.getByLabel(t.familyName, { exact: true }).fill("Pilot Household");
      await button(residentPage, "inviteSubmit").click();
      await residentPage.getByText(t.invitePending, { exact: true }).waitFor();
      const response = await resident.request.get(`${origin}/api/directory/projects`);
      assert.equal(response.status(), 200);
      assert.deepEqual((await response.json()).projects, []);
    },
  );
  await check(
    "desktop: manager approval creates residency without granting management rights",
    async () => {
      await approve(adminPage, "Pilot Resident");
      const response = await resident.request.get(`${origin}/api/households`);
      assert.equal(response.status(), 200);
      householdId = (await response.json()).households[0].id;
      assert.equal(
        (await resident.request.get(`${origin}/api/management/projects/${projectId}`)).status(),
        404,
      );
    },
  );
  await check("mobile: edit own contact details and persist visibility", async () => {
    await residentPage.goto(`${origin}/household/${householdId}`);
    await button(residentPage, "homeAddContact").click();
    await residentPage.getByLabel(t.phone, { exact: true }).fill("0501234567");
    await residentPage
      .locator("label")
      .filter({ has: residentPage.getByRole("radio", { name: t.vis_project, exact: true }) })
      .click();
    assert.equal(
      await residentPage.getByRole("radio", { name: t.vis_project, exact: true }).isChecked(),
      true,
    );
    await button(residentPage, "save").click();
    await residentPage.getByText(t.homeSaved, { exact: true }).waitFor();
    const data = await (
      await resident.request.get(`${origin}/api/households/${householdId}`)
    ).json();
    assert.equal(data.ownContacts[0].visibility, "project");
  });
  let familyLink;
  await check(
    "mobile: create a private child and issue an adult household invitation",
    async () => {
      await residentPage.getByRole("link", { name: t.familyManage, exact: true }).click();
      await button(residentPage, "familyAddChild").click();
      await residentPage.getByLabel(t.fullName, { exact: true }).fill("Private Pilot Child");
      await button(residentPage, "save").click();
      await residentPage.getByText("Private Pilot Child", { exact: true }).waitFor();
      await residentPage
        .getByLabel(t.inviteRecipientEmail, { exact: true })
        .fill(identities.family.email);
      familyLink = await createLink(residentPage);
      const directory = await (
        await resident.request.get(`${origin}/api/projects/${projectId}/directory`)
      ).json();
      assert.ok(!JSON.stringify(directory).includes("Private Pilot Child"));
    },
  );
  const family = await context("family", true);
  const familyPage = await family.newPage();
  await check("mobile: join the existing household by name-only request", async () => {
    await familyPage.goto(familyLink);
    await familyPage.getByLabel(t.fullName, { exact: true }).fill("Pilot Adult");
    assert.equal(await familyPage.getByLabel(t.familyName, { exact: true }).count(), 0);
    await button(familyPage, "inviteSubmit").click();
    await familyPage.getByText(t.invitePending, { exact: true }).waitFor();
    await approve(adminPage, "Pilot Adult");
    const mine = await (await family.request.get(`${origin}/api/households`)).json();
    assert.equal(mine.households[0].id, householdId);
    assert.equal(
      (await family.request.get(`${origin}/api/households/${householdId}/members`)).status(),
      404,
    );
  });
  await check(
    "mobile: search live directory and open the household without exposing child data",
    async () => {
      await familyPage.goto(`${origin}/directory`);
      await familyPage.getByLabel(t.search, { exact: true }).fill("Pilot Resident");
      await familyPage.getByRole("heading", { name: "Pilot Resident", exact: true }).waitFor();
      await familyPage.getByRole("link", { name: t.homeOpen, exact: true }).click();
      await familyPage.getByRole("heading", { name: "Pilot Household", exact: true }).waitFor();
      assert.equal(await familyPage.getByText("Private Pilot Child", { exact: true }).count(), 0);
    },
  );
  await check(
    "unlinked account and cross-origin writes cannot read or mutate the pilot household",
    async () => {
      const outsider = await context("outsider", true);
      const response = await outsider.request.get(`${origin}/api/households/${householdId}`);
      assert.equal(response.status(), 404);
      assert.equal(response.headers()["cache-control"], "private, no-store");
      assert.equal(
        (
          await resident.request.patch(`${origin}/api/households/${householdId}`, {
            headers: { Origin: "https://attacker.example" },
            data: { action: "rename", name: "Denied", expected: "Pilot Household" },
          })
        ).status(),
        403,
      );
    },
  );
  await check("no browser runtime errors in the full desktop/mobile journey", async () => {
    assert.deepEqual(runtimeErrors, []);
  });
  report.passed = true;
} finally {
  await Promise.all(contexts.map((c) => c.close()));
  await browser.close();
  await mkdir(output, { recursive: true });
  await writeFile(join(output, "pilot-smoke.json"), JSON.stringify(report, null, 2));
}
