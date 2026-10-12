import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

async function boot(page: Page) {
  await page.goto('./');
  await expect(page.getByText('Next in rotation')).toBeVisible();
}

const heading = (page: Page, name: string) => page.getByRole('heading', { level: 1, name, exact: true });

test.describe('subpath deployment and PWA', () => {
  test('every asset resolves under /REP/ with no failed requests', async ({ page }) => {
    const failures: string[] = [];
    const outside: string[] = [];
    page.on('response', (r) => {
      const u = new URL(r.url());
      if (u.hostname === 'localhost' && !u.pathname.startsWith('/REP/')) outside.push(u.pathname);
      if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`);
    });
    page.on('requestfailed', (r) => failures.push(`failed ${r.url()}`));
    await boot(page);
    expect(failures).toEqual([]);
    expect(outside).toEqual([]);
  });

  test('manifest is valid and every icon loads', async ({ page, request }) => {
    await boot(page);
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    const res = await request.get(new URL(href!, page.url()).toString());
    expect(res.status()).toBe(200);
    const m = await res.json();
    expect(m).toMatchObject({ name: 'REP', short_name: 'REP', display: 'standalone', start_url: './', scope: './' });
    const sizes = m.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
    expect(m.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true);
    for (const icon of m.icons) {
      const r = await request.get(new URL(icon.src, res.url()).toString());
      expect(r.status(), icon.src).toBe(200);
      expect(r.headers()['content-type']).toBe('image/png');
    }
    const apple = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
    expect((await request.get(new URL(apple!, page.url()).toString())).status()).toBe(200);
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
  });

  test('service worker registers with the subpath scope and the app works offline', async ({ page, context }) => {
    await boot(page);
    const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
    expect(new URL(scope).pathname).toBe('/REP/');
    // Wait for precache to finish and the SW to control the page.
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByText('Next in rotation')).toBeVisible();
    await page.getByRole('button', { name: 'Start Workout A' }).click();
    await expect(heading(page, 'Hyperextensions')).toBeVisible();
    await page.getByRole('button', { name: 'Next exercise' }).click();
    await expect(heading(page, 'Barbell incline bench press')).toBeVisible();
    await expect(page.getByText(/No demonstration bundled/)).toBeVisible();
    await page.getByRole('button', { name: /Log set/ }).click();
    await expect(page.getByText('Set 1', { exact: true })).toBeVisible();
    await page.reload();
    await expect(heading(page, 'Barbell incline bench press')).toBeVisible();
    await expect(page.getByText('Set 1', { exact: true })).toBeVisible();
    await context.setOffline(false);
  });

  test('direct navigation and refresh on a deep route works', async ({ page }) => {
    await page.goto('./#/library/leg-curl');
    await expect(heading(page, 'Leg curls')).toBeVisible();
    await page.reload();
    await expect(heading(page, 'Leg curls')).toBeVisible();
  });
});

test.describe('training flow', () => {
  test('start A, log sets, complete a block, reload, resume, finish, see history', async ({ page }) => {
    await boot(page);
    await page.getByRole('button', { name: 'Start Workout A' }).click();
    await expect(heading(page, 'Hyperextensions')).toBeVisible();

    // Round 1: log an actual set for each exercise.
    for (const name of ['Hyperextensions', 'Barbell incline bench press', 'Leg extensions']) {
      await expect(heading(page, name)).toBeVisible();
      await page.getByRole('button', { name: /Log set/ }).click();
      await expect(page.getByText('Set 1', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Next', exact: true }).click();
    }
    // Rounds 2–3: quick complete without numbers.
    for (let i = 0; i < 6; i++) {
      await page.getByRole('button', { name: 'Complete', exact: true }).click();
      await page.getByRole('button', { name: 'Mark done, no numbers' }).click();
    }
    await expect(heading(page, 'Seated cable row')).toBeVisible();
    await expect(page.getByText(/Block\s*02/).or(page.locator('.position__line').first())).toBeVisible();

    await page.reload();
    await expect(heading(page, 'Seated cable row')).toBeVisible();
    await page.goto('./');
    await page.getByRole('link', { name: 'Continue workout' }).click();
    await expect(heading(page, 'Seated cable row')).toBeVisible();

    await page.getByRole('button', { name: 'End workout' }).click();
    await expect(page.getByRole('dialog', { name: 'End workout?' })).toContainText("18 of 27 exercise rounds aren't logged");
    await page.getByRole('button', { name: 'Finish and save' }).click();
    await expect(page.getByText('Workout complete')).toBeVisible();
    await expect(page.locator('.tally')).toContainText('Completed9');
    await expect(page.locator('.tally')).toContainText('Sets logged3');

    await page.goto('./#/history');
    await expect(page.locator('.session-list li')).toHaveCount(1);
    await page.goto('./');
    await expect(page.getByText('Next in rotation')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('B');
  });

  test('edit a prescribed weight; it shows in the next session', async ({ page }) => {
    await boot(page);
    await page.goto('./#/workouts/workout-a');
    await page.getByRole('button', { name: 'Edit Barbell incline bench press' }).click();
    await page.getByRole('button', { name: 'Increase Prescribed weight by 5' }).click();
    await page.getByRole('button', { name: 'Done' }).click();
    await page.getByRole('button', { name: 'Save workout' }).click();
    await expect(page.getByText('All changes saved')).toBeVisible();
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.getByRole('button', { name: 'Next exercise' }).click();
    await expect(page.locator('.rx')).toContainText('80 lb');
  });

  test('create a custom exercise', async ({ page }) => {
    await boot(page);
    await page.goto('./#/library/new');
    await page.getByRole('textbox', { name: 'Name' }).fill('Landmine press');
    await page.getByRole('button', { name: 'Create exercise' }).click();
    await expect(heading(page, 'Landmine press')).toBeVisible();
    await page.goto('./#/library');
    await expect(page.getByRole('link', { name: /Landmine press/ })).toBeVisible();
  });

  test('export a backup and import it into a fresh device', async ({ page, browser }) => {
    await boot(page);
    await page.getByRole('button', { name: 'Start Workout A' }).click();
    await page.getByRole('button', { name: /Log set/ }).click();
    await page.getByRole('button', { name: 'End workout' }).click();
    await page.getByRole('button', { name: 'Finish and save' }).click();
    await expect(page.getByText('Workout complete')).toBeVisible();
    await page.goto('./#/settings');
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Download backup/ }).click()]);
    const path = await download.path();
    const json = JSON.parse(readFileSync(path!, 'utf8'));
    expect(json).toMatchObject({ app: 'REP', schemaVersion: 1 });
    expect(json.sessions).toHaveLength(1);
    expect(json.setLogs).toHaveLength(1);

    const fresh = await browser.newContext();
    const p2 = await fresh.newPage();
    await p2.goto('http://localhost:4173/REP/#/settings');
    await p2.getByLabel('Restore from a backup file').setInputFiles(path!);
    await expect(p2.getByRole('dialog', { name: 'Restore this backup?' })).toContainText('sessions');
    await p2.getByRole('button', { name: 'Replace all' }).click();
    await p2.getByRole('button', { name: 'Replace all data' }).click();
    await expect(p2.getByText(/Backup restored/)).toBeVisible();
    await p2.goto('http://localhost:4173/REP/#/history');
    await expect(p2.locator('.session-list li')).toHaveCount(1);
    await fresh.close();
  });

  test('Workout B never pairs its rack bench press with the seated cable row', async ({ page }) => {
    await boot(page);
    await page.goto('./#/workouts/workout-b');
    // Seeded block 1 has no blocking conflict.
    const block1 = page.locator('.block-edit').first();
    await expect(block1.locator('.conflict--blocked')).toHaveCount(0);
    await expect(block1).not.toContainText('Seated cable row');
    // Adding the row to block 1 is not possible.
    await block1.getByRole('button', { name: 'Add exercise' }).click();
    const row = page.getByRole('dialog').getByRole('button', { name: /Seated cable row/ });
    await expect(row).toBeDisabled();
    await expect(row).toContainText('lowered into the rack');
    await page.getByRole('button', { name: 'Close' }).click();
    // Moving the row from block 2 into block 1 blocks saving.
    const rowSlot = page.locator('.block-edit').nth(1).locator('.slot').first();
    await rowSlot.getByLabel(/Move Seated cable row to block/).selectOption('0');
    await expect(block1.locator('.conflict--blocked')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save workout' })).toBeDisabled();
  });
});

test.describe('service worker update', () => {
  test('a new version waits for the user, keeps the active workout, and never deletes data', async ({ page }) => {
    const { writeFileSync } = await import('node:fs');
    const swPath = 'docs/sw.js';
    const original = readFileSync(swPath, 'utf8');
    try {
      await boot(page);
      await page.reload();
      await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
      await page.getByRole('button', { name: 'Start Workout A' }).click();
      await page.getByRole('button', { name: /Log set/ }).click();
      await expect(page.getByText('Set 1', { exact: true })).toBeVisible();

      // Simulate a new deployment.
      writeFileSync(swPath, original.replace(/const VERSION = '([^']+)'/, "const VERSION = '$1-next'"));
      await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
      const banner = page.getByText(/A new version of REP is ready\. Update after your workout/);
      await expect(banner).toBeVisible();
      // No surprise reload: still mid-workout with the logged set on screen.
      await expect(heading(page, 'Hyperextensions')).toBeVisible();
      await expect(page.getByText('Set 1', { exact: true })).toBeVisible();

      await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Update' }).click()]);
      await expect(heading(page, 'Hyperextensions')).toBeVisible();
      await expect(page.getByText('Set 1', { exact: true })).toBeVisible();
      const caches = await page.evaluate(() => window.caches.keys());
      expect(caches.filter((k) => k.startsWith('rep-shell-'))).toHaveLength(1);
      expect(caches[0]).toMatch(/-next$/);
    } finally {
      writeFileSync(swPath, original);
    }
  });
});
