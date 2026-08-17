const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const distChrome = path.join(rootDir, 'dist', 'chrome');
const distFirefox = path.join(rootDir, 'dist', 'firefox');

// Clean dist directories
fs.rmSync(path.join(rootDir, 'dist'), { recursive: true, force: true });
fs.mkdirSync(distChrome, { recursive: true });
fs.mkdirSync(distFirefox, { recursive: true });

async function main() {
  const esbuildBin = path.join(rootDir, '..', 'dashboard', 'node_modules', '.bin', 'esbuild.cmd');

  async function bundle(entry, outfile, targetPlatform = 'browser') {
    const cmd = fs.existsSync(esbuildBin)
      ? `"${esbuildBin}" "${entry}" --bundle --outfile="${outfile}" --platform=${targetPlatform} --target=es2020`
      : `npx esbuild "${entry}" --bundle --outfile="${outfile}" --platform=${targetPlatform} --target=es2020`;
    execSync(cmd, { stdio: 'inherit', cwd: rootDir });
  }

  // 1. Run esbuild for Chrome
  console.log('Building for Chrome...');
  await bundle(path.join(rootDir, 'src/content.ts'), path.join(distChrome, 'content.js'));
  await bundle(path.join(rootDir, 'src/background.ts'), path.join(distChrome, 'background.js'));
  await bundle(path.join(rootDir, 'popup/popup.ts'), path.join(distChrome, 'popup/popup.js'));

  // 2. Run esbuild for Firefox
  console.log('Building for Firefox...');
  await bundle(path.join(rootDir, 'src/content.ts'), path.join(distFirefox, 'content.js'));
  await bundle(path.join(rootDir, 'src/background.ts'), path.join(distFirefox, 'background.js'));
  await bundle(path.join(rootDir, 'popup/popup.ts'), path.join(distFirefox, 'popup/popup.js'));

// 3. Copy static assets (icons, popup html/css)
const copyAssets = (targetDir) => {
  if (fs.existsSync(path.join(rootDir, 'icons'))) {
    fs.cpSync(path.join(rootDir, 'icons'), path.join(targetDir, 'icons'), { recursive: true });
  }
  fs.mkdirSync(path.join(targetDir, 'popup'), { recursive: true });
  fs.copyFileSync(path.join(rootDir, 'popup', 'popup.html'), path.join(targetDir, 'popup', 'popup.html'));
  if (fs.existsSync(path.join(rootDir, 'popup', 'popup.css'))) {
    fs.copyFileSync(path.join(rootDir, 'popup', 'popup.css'), path.join(targetDir, 'popup', 'popup.css'));
  }
};

copyAssets(distChrome);
copyAssets(distFirefox);

// 4. Generate manifest.json for both
const baseManifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'manifest.json'), 'utf8'));

delete baseManifest.background;

// Chrome manifest
const chromeManifest = {
  ...baseManifest,
  background: {
    service_worker: 'background.js',
  },
};
chromeManifest.content_scripts[0].js = ['content.js'];
fs.writeFileSync(path.join(distChrome, 'manifest.json'), JSON.stringify(chromeManifest, null, 2));

// Firefox manifest
const firefoxManifest = {
  ...baseManifest,
  background: {
    scripts: ['background.js'],
  },
  browser_specific_settings: {
    gecko: {
      id: 'arcrift@eshaan.nair',
      strict_min_version: '140.0',
      data_collection_permissions: {
        required: ['websiteContent'],
      },
    },
  },
};
firefoxManifest.content_scripts[0].js = ['content.js'];
fs.writeFileSync(path.join(distFirefox, 'manifest.json'), JSON.stringify(firefoxManifest, null, 2));

  console.log('Build complete! Extensions are in dist/chrome and dist/firefox');
}

main().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
