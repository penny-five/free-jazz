import { test, expect } from '@playwright/test';
test('plays instruments, adjusts volume, and explains controls',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5173');await page.getByRole('button',{name:"Let's make some noise"}).click();
 await page.keyboard.press('a');await expect(page.locator('#note-count')).toHaveText('001 NOTES INTO THE UNKNOWN');
 await page.locator('[data-instrument="bass"]').click();await page.locator('[data-note="3"]').click();
 await page.locator('[data-instrument="drums"]').click();await page.keyboard.press('k');
 await expect(page.locator('#note-count')).toHaveText('003 NOTES INTO THE UNKNOWN');
 await page.locator('#volume').fill('30');await page.getByRole('button',{name:'How to play'}).click();await expect(page.locator('dialog')).toBeVisible();await page.getByRole('button',{name:'Close',exact:true}).click();expect(errors).toEqual([]);
});
test('local room broadcasts to another tab and isolates different rooms',async({context})=>{
 const a=await context.newPage(),b=await context.newPage(),other=await context.newPage();
 await a.goto('http://localhost:5173/?room=duet');await b.goto('http://localhost:5173/?room=duet');await other.goto('http://localhost:5173/?room=solo');
 await b.locator('#start').click();await a.locator('[data-note="0"]').click();
 await expect(b.locator('#note-count')).toHaveText('001 NOTES INTO THE UNKNOWN');await expect(other.locator('#note-count')).toHaveText('000 NOTES INTO THE UNKNOWN');
});
test('mobile pads fit viewport',async({page})=>{await page.setViewportSize({width:390,height:844});await page.goto('http://localhost:5173');await page.locator('[data-note="7"]').click();await expect(page.locator('#note-count')).toHaveText('001 NOTES INTO THE UNKNOWN');expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);await page.screenshot({path:'/tmp/freeform-mobile.png',fullPage:true});});
