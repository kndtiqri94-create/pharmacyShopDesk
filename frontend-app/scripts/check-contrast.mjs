import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/styles/_tokens.scss', import.meta.url), 'utf8');

function readBlock(selector) {
  const start = source.indexOf(selector);
  const open = source.indexOf('{', start);
  const close = source.indexOf('}', open);
  const tokens = {};
  for (const line of source.slice(open + 1, close).split('\n')) {
    const parts = line.trim().split(':');
    if (parts.length === 2 && parts[0].startsWith('--sd-') && parts[1].trim().startsWith('#')) {
      tokens[parts[0].trim().slice(5)] = parts[1].trim().replace(';', '');
    }
  }
  return tokens;
}

function luminance(hex) {
  const channels = [1, 3, 5].map(index => {
    const value = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function ratio(foreground, background) {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

const textPairs = [
  ['ink', 'app-bg'],
  ['ink', 'surface'],
  ['ink', 'surface-sunken'],
  ['ink-muted', 'app-bg'],
  ['ink-muted', 'surface'],
  ['ink-muted', 'surface-sunken'],
  ['ink-subtle', 'app-bg'],
  ['ink-subtle', 'surface'],
  ['ink-subtle', 'surface-sunken'],
  ['primary', 'surface'],
  ['primary', 'app-bg'],
  ['primary', 'primary-soft'],
  ['on-primary', 'primary'],
  ['on-primary', 'primary-hover'],
  ['success', 'success-soft'],
  ['success', 'surface'],
  ['warning', 'warning-soft'],
  ['warning', 'surface'],
  ['danger', 'danger-soft'],
  ['danger', 'surface'],
  ['info', 'info-soft'],
  ['info', 'surface'],
  ['sidebar-ink', 'sidebar-bg'],
  ['sidebar-ink', 'sidebar-hover'],
  ['sidebar-label', 'sidebar-bg'],
  ['sidebar-ink-strong', 'sidebar-bg'],
  ['sidebar-ink-strong', 'sidebar-hover'],
  ['sidebar-accent-ink', 'sidebar-accent'],
];

const controlPairs = [
  ['border-strong', 'surface'],
  ['border-strong', 'app-bg'],
  ['focus-ring', 'surface'],
  ['focus-ring', 'app-bg'],
  ['focus-ring-inverse', 'sidebar-bg'],
  ['primary', 'surface'],
  ['danger', 'surface'],
];

const light = readBlock(':root');
const themes = { light, dark: { ...light, ...readBlock("[data-theme='dark']") } };
let failures = 0;

for (const [themeName, tokens] of Object.entries(themes)) {
  for (const [group, pairs, minimum] of [
    ['text', textPairs, 4.5],
    ['control', controlPairs, 3],
  ]) {
    for (const [foreground, background] of pairs) {
      const value = ratio(tokens[foreground], tokens[background]);
      const passed = value >= minimum;
      if (!passed) failures += 1;
      process.stdout.write(
        `${passed ? 'PASS' : 'FAIL'} ${themeName} ${group} ${foreground} on ${background}: ${value.toFixed(2)} (min ${minimum})\n`
      );
    }
  }
}

process.stdout.write(`\n${failures === 0 ? 'All pairs pass.' : `${failures} pair(s) fail.`}\n`);
process.exitCode = failures === 0 ? 0 : 1;
