import { test, expect } from '@playwright/test';
const origin = 'http://localhost:5173';
test('plays every instrument and controls sound without browser errors', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin); await page.locator('#start').click();
  const voices = ['keys', 'bass', 'drums', 'sax', 'vibes', 'guitar', 'synth', 'flute'];
  for (let i = 0; i < voices.length; i++) {
    const button = page.locator(`[data-instrument="${voices[i]}"]`);
    await button.click(); await expect(button).toHaveAttribute('aria-pressed', 'true');
    await page.locator(`[data-note="${i}"]`).click();
    await expect(page.locator('#note-count')).toHaveText(`${String(i + 1).padStart(3, '0')} NOTES INTO THE UNKNOWN`);
  }
  await page.locator('#volume').fill('30'); await expect(page.locator('#volume-value')).toHaveText('30%');
  await page.getByRole('button', { name: 'Mute sound', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Unmute sound', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'How to play' }).click();
  await expect(page.getByRole('dialog', { name: 'Follow your ears.' })).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.reload(); await expect(page.locator('#volume')).toHaveValue('30');
  expect(errors).toEqual([]);
});
test('shares new instruments and scales between tabs while isolating rooms', async ({ context }) => {
  const a = await context.newPage(), b = await context.newPage(), other = await context.newPage();
  await a.goto(`${origin}/?room=duet`); await b.goto(`${origin}/?room=duet`); await other.goto(`${origin}/?room=solo`);
  await b.locator('#start').click(); await a.locator('[data-instrument="sax"]').click();
  await a.locator('#scale').selectOption('minor'); await a.locator('#octave-up').click();
  await a.locator('[data-note="0"]').click();
  await expect(b.locator('#note-count')).toHaveText('001 NOTES INTO THE UNKNOWN');
  await expect(b.locator('#last-note')).toHaveText('Night sax / D');
  await expect(other.locator('#note-count')).toHaveText('000 NOTES INTO THE UNKNOWN');
  // Malformed messages from another tab must not crash audio or increment the count.
  await a.evaluate(() => { const bus = new BroadcastChannel('freeform:duet'); bus.postMessage(null); bus.postMessage({ note: 0, instrument: 'sax', scale: 'constructor' }); bus.postMessage({ note: 1, instrument: 'sax', scale: 'invalid' }); bus.close(); });
  await a.locator('[data-note="1"]').click();
  await expect(b.locator('#note-count')).toHaveText('002 NOTES INTO THE UNKNOWN');
});
test('keyboard activation, drum labels, octave bounds, and room switching work', async ({ page }) => {
  await page.goto(origin); await page.locator('[data-note="0"]').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#note-count')).toHaveText('001 NOTES INTO THE UNKNOWN');
  await page.locator('#scale').selectOption('pentatonic'); await expect(page.locator('[data-note="0"] .note-name')).toHaveText('A');
  await page.locator('#octave-up').click(); await expect(page.locator('#octave-up')).toBeDisabled();
  await page.locator('#octave-down').click(); await page.locator('#octave-down').click();
  await expect(page.locator('#octave-down')).toBeDisabled();
  await page.locator('[data-instrument="drums"]').click(); await expect(page.locator('#scale')).toBeDisabled();
  await expect(page.locator('[data-note="0"] .note-name')).toHaveText('Kick');
  await page.locator('#room-picker').click(); await page.locator('#room-input').fill('late-night');
  await page.getByRole('button', { name: 'Enter room', exact: false }).click();
  await expect(page).toHaveURL(/room=late-night/); await expect(page.locator('#room-name')).toHaveText('late night');
});
for (const [width, height] of [[320, 568], [390, 844], [768, 1024]]) {
  test(`touch layout fits ${width}×${height} and supports dragging across pads`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: width < 700 });
    const page = await context.newPage(); await page.goto(origin);
    await page.getByRole('button', { name: 'Enter focus mode' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    const pads = await page.locator('.pad').evaluateAll(elements => elements.map(el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })));
    for (const pad of pads) { expect(pad.width).toBeGreaterThanOrEqual(44); expect(pad.height).toBeGreaterThanOrEqual(44); }
    if (width < 700) expect(await page.locator('.keyboard').evaluate(el => el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(height);
    const first = await page.locator('[data-note="0"]').boundingBox(), second = await page.locator('[data-note="1"]').boundingBox();
    await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2); await page.mouse.down();
    await expect(page.locator('#note-count')).toHaveText('001 NOTES INTO THE UNKNOWN');
    await page.mouse.move(second.x + second.width / 2, second.y + second.height / 2, { steps: 4 }); await page.mouse.up();
    await expect(page.locator('#note-count')).toHaveText('002 NOTES INTO THE UNKNOWN');
    await context.close();
  });
}
test('simultaneous touch pads play once each, then cancel cleanly', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage(); await page.goto(origin); await page.locator('#focus').click(); await page.locator('#start').click();
  const cdp = await context.newCDPSession(page);
  const pads = await Promise.all([0, 4].map(i => page.locator(`[data-note="${i}"]`).boundingBox()));
  const points = pads.map((p, id) => ({ x: p.x + p.width / 2, y: p.y + p.height / 2, id, radiusX: 2, radiusY: 2, force: 1 }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points });
  await expect(page.locator('#note-count')).toHaveText('002 NOTES INTO THE UNKNOWN');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await page.locator('[data-note="7"]').tap();
  await expect(page.locator('#note-count')).toHaveText('003 NOTES INTO THE UNKNOWN');
  await context.close();
});

async function setQuickLoop(page) {
  await page.getByRole('button', { name: 'Loop settings', exact: true }).click();
  await page.getByLabel('Tempo in BPM').fill('180');
  await page.getByLabel('Loop length', { exact: true }).selectOption('4');
  await page.getByLabel('Note timing', { exact: true }).selectOption('0.25');
  await page.getByRole('button', { name: 'Ready to play' }).click();
}
async function recordOne(page) {
  await page.getByRole('button', { name: 'Record loop', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Finish recording', exact: true })).toBeVisible({ timeout: 10000 });
  await page.keyboard.press('a');
  await expect(page.locator('[data-owner="you"]')).toHaveCount(1, { timeout: 10000 });
}
test('a recorded layer repeats, a partner receives it, and a late joiner inherits it', async ({ context }) => {
  const a = await context.newPage(), b = await context.newPage();
  await a.goto(`${origin}/?room=loop-band`); await b.goto(`${origin}/?room=loop-band`);
  await b.locator('#start').click(); await setQuickLoop(a); await a.locator('[data-instrument="drums"]').click();
  await recordOne(a);
  await a.locator('#loop-station').evaluate(el => { el.open = true; });
  await b.locator('#loop-station').evaluate(el => { el.open = true; });
  await expect(b.locator('[data-owner="partner"]')).toHaveCount(1);
  const first = await b.locator('#note-count').textContent();
  await expect.poll(async () => (await b.locator('#note-count').textContent()) !== first, { timeout: 5000 }).toBe(true);
  const newcomer = await context.newPage(); await newcomer.goto(`${origin}/?room=loop-band`);
  await expect(newcomer.locator('#layer-count')).toHaveText('1 layer');
  await a.getByRole('button', { name: 'Mute Loose drums loop', exact: true }).click();
  await expect(b.locator('.partner-loop-status')).toHaveText('MUTED');
  await a.getByRole('button', { name: 'Remove Loose drums loop', exact: true }).click();
  await expect(b.locator('#layer-count')).toHaveText('0 layers'); await expect(newcomer.locator('#layer-count')).toHaveText('0 layers');
});
test('overdubbing adds a new instrument, undo restores the take, and settings keep room tempo fixed', async ({ page }) => {
  await page.goto(`${origin}/?room=overdub`); await setQuickLoop(page); await recordOne(page);
  await page.locator('#loop-station').evaluate(el => { el.open = true; });
  await page.locator('[data-instrument="sax"]').click();
  await page.getByRole('button', { name: 'Overdub Soft keys loop', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Finish recording', exact: true })).toBeVisible({ timeout: 10000 });
  await page.keyboard.press('f');
  await expect(page.locator('.loop-layer-info strong')).toHaveText('Mixed voices', { timeout: 10000 });
  await page.getByRole('button', { name: 'Undo last take', exact: true }).click();
  await expect(page.locator('.loop-layer-info strong')).toHaveText('Soft keys');
  await page.getByRole('button', { name: 'Loop settings', exact: true }).click();
  await expect(page.getByLabel('Tempo in BPM')).toBeDisabled();
  await page.getByRole('button', { name: 'Close loop settings' }).click();
  await page.getByRole('button', { name: 'Pause loops on this device', exact: true }).click();
  await expect(page.locator('#loop-status')).toHaveText('Paused here');
  await page.getByRole('button', { name: 'Resume loops on this device', exact: true }).click();
  await expect(page.locator('#loop-status')).toContainText('180 BPM');
});
test('recording can be canceled and loop controls stay usable on a small phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 }); await page.goto(origin); await page.locator('#focus').click();
  await page.getByRole('button', { name: 'Record loop', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel count-in', exact: true }).click();
  await expect(page.locator('#layer-count')).toHaveText('0 layers');
  const size = await page.locator('#record-loop').boundingBox(); expect(size.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  expect(await page.locator('.keyboard').evaluate(el => el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(568);
  await expect(page.locator('.brand svg').first()).toBeVisible();
});
test('a phone can record a layer with the pads without leaving focus mode', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true });
  const page = await context.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${origin}/?room=phone-loop`); await page.locator('#focus').tap(); await setQuickLoop(page);
  await page.getByRole('button', { name: 'Record loop', exact: true }).tap();
  await expect(page.getByRole('button', { name: 'Finish recording', exact: true })).toBeVisible({ timeout: 10000 });
  await page.locator('[data-note="0"]').tap();
  await expect(page.locator('#layer-count')).toHaveText('1 layer', { timeout: 10000 });
  expect(await page.locator('.keyboard').evaluate(el => el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(568);
  expect(errors).toEqual([]); await context.close();
});
