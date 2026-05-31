import { expect, test } from '@playwright/test';

const CBOX_RGB_URL = 'https://elerac.github.io/openexr_viewer/cbox_rgb.exr';

test('serves the project page with app and desktop download calls to action @smoke', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'OpenEXR Viewer', level: 1 })).toBeVisible();

  const heroAppLink = page.getByRole('link', { name: 'Open Web App', exact: true }).first();
  await expect(heroAppLink).toBeVisible();
  await expect(heroAppLink).toHaveAttribute('href', 'app/');
  await expect(page.getByRole('link', { name: 'Gallery', exact: true })).toHaveAttribute('href', '#gallery');

  const desktopButton = page.getByRole('button', { name: 'Desktop App Coming Later', exact: true }).first();
  await expect(desktopButton).toBeDisabled();

  const preview = page.getByRole('img', { name: /OpenEXR Viewer interface/ });
  await expect(preview).toBeVisible();
  await expect.poll(async () => (
    await preview.evaluate((image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0)
  )).toBe(true);

  await expect(page.getByRole('heading', { name: 'Features', level: 2 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Gallery', level: 2 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'cbox_rgb.exr', exact: true })).toHaveAttribute(
    'href',
    CBOX_RGB_URL
  );

  const sectionOrder = await page.evaluate(() => {
    const features = document.querySelector('#features');
    const gallery = document.querySelector('#gallery');
    if (!features || !gallery) {
      return false;
    }
    return Boolean(features.compareDocumentPosition(gallery) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(sectionOrder).toBe(true);

  await page.locator('#gallery').scrollIntoViewIfNeeded();
  const embed = page.locator('openexr-viewer');
  await expect(embed).toHaveAttribute('src', CBOX_RGB_URL);
  await expect(embed).toHaveAttribute('name', 'Cornell Box');
  await expect(embed).toHaveAttribute('width', '100%');
  await expect(embed).toHaveAttribute('height', '420');

  const iframeSrc = await embed.evaluate((element) => {
    const iframe = element.shadowRoot?.querySelector('iframe');
    return iframe instanceof HTMLIFrameElement ? iframe.src : '';
  });
  expect(iframeSrc).toContain('/app/?ui=embed');
  expect(iframeSrc).toContain(`src=${encodeURIComponent(CBOX_RGB_URL)}`);
  expect(iframeSrc).toContain('name=Cornell+Box');

  const embeddedViewer = page.frameLocator('openexr-viewer iframe');
  await expect(embeddedViewer.locator('#gl-canvas')).toBeVisible({
    timeout: 30000
  });
  await expect(embeddedViewer.getByRole('button', { name: 'Open full viewer', exact: true })).toBeEnabled();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(embed).toHaveAttribute('height', '320');
  await expect.poll(async () => (
    await embed.evaluate((element) => {
      const iframe = element.shadowRoot?.querySelector('iframe');
      return iframe instanceof HTMLIFrameElement ? iframe.style.height : '';
    })
  )).toBe('320px');
});
