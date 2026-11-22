import ngswConfig from '../../ngsw-config.json';

interface ManifestIcon {
  src: string;
  sizes: string;
  purpose: string;
}

interface WebManifest {
  name: string;
  short_name: string;
  theme_color: string;
  background_color: string;
  display: string;
  start_url: string;
  icons: ManifestIcon[];
}

describe('PWA configuration', () => {
  it('declares no dataGroups so API traffic is never cached', () => {
    expect(Object.keys(ngswConfig)).not.toContain('dataGroups');
  });

  it('caches only same-origin app files', () => {
    const files = ngswConfig.assetGroups.flatMap(group => group.resources.files);
    expect(files.some(pattern => pattern.includes('http'))).toBe(false);
    expect(ngswConfig.assetGroups.every(group => !('urls' in group.resources))).toBe(true);
  });

  it('ships a manifest with the required installable fields', async () => {
    const response = await fetch('/manifest.webmanifest');
    const manifest = (await response.json()) as WebManifest;
    expect(manifest.name).toBe('ShopDesk');
    expect(manifest.short_name).toBe('ShopDesk');
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toBe('#4A4DB0');
    expect(manifest.background_color).toBeTruthy();
    expect(manifest.start_url).toBeTruthy();
    const sizes = manifest.icons.map(icon => icon.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    expect(manifest.icons.some(icon => icon.purpose === 'maskable')).toBe(true);
  });
});
