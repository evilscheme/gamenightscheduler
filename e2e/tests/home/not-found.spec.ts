import { test, expect } from '@playwright/test';
import { TEST_TIMEOUTS } from '../../constants';

test.describe('404 page dice roll', () => {
  test('rolls a physics d20 and shows the matching message', async ({
    page,
  }) => {
    await page.goto('/this-page-does-not-exist');

    await expect(page.getByRole('heading', { name: '404' })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // The die canvas advertises the rolled number
    const die = page.locator('canvas[aria-label^="D20 showing"]');
    await expect(die).toBeVisible();
    const label = await die.getAttribute('aria-label');
    const rolled = Number(label?.replace('D20 showing ', ''));
    expect(rolled).toBeGreaterThanOrEqual(1);
    expect(rolled).toBeLessThanOrEqual(20);

    // After the roll animation settles, the message names the same number
    await expect(page.getByText(`You rolled a ${rolled}!`)).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
  });

  test('a natural 20 erupts in a gold celebration burst', async ({ page }) => {
    // ?roll=20 forces the crit deterministically
    await page.goto('/this-page-does-not-exist?roll=20');

    await expect(page.getByText('You rolled a 20!')).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // While the burst plays, the canvas holds far more gold than the die's
    // single gold "20" glyph; after it ends, the gold count drops back
    const countGold = () =>
      page.evaluate(() => {
        const c = document.querySelector(
          'canvas[aria-label^="D20"]'
        ) as HTMLCanvasElement;
        const data = c
          .getContext('2d')!
          .getImageData(0, 0, c.width, c.height).data;
        let gold = 0;
        for (let i = 0; i < data.length; i += 4) {
          const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
          if (a > 50 && r > 180 && g > 120 && b < 120) gold++;
        }
        return gold;
      });

    const duringBurst = await countGold();
    await page.waitForTimeout(3000); // burst lasts ~2.2s
    const afterBurst = await countGold();

    expect(duringBurst).toBeGreaterThan(afterBurst * 2);
  });

  test('Roll Again re-rolls and shows a fresh result', async ({ page }) => {
    await page.goto('/this-page-does-not-exist');

    await expect(page.getByText(/You rolled a \d+!/)).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    await page.getByRole('button', { name: 'Roll Again' }).click();

    // Message clears while the new roll is in flight, then returns
    await expect(page.getByText(/You rolled a \d+!/)).toBeHidden();
    await expect(page.getByText(/You rolled a \d+!/)).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // The message must match the (possibly new) die label
    const label = await page
      .locator('canvas[aria-label^="D20 showing"]')
      .getAttribute('aria-label');
    const rolled = Number(label?.replace('D20 showing ', ''));
    await expect(page.getByText(`You rolled a ${rolled}!`)).toBeVisible();
  });
});
