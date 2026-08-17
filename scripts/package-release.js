const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const releaseDir = path.join(rootDir, "release-build");

console.log("=== Starting ArcRift v2.0.0 Packaging Process ===");

// 1. Ensure release directory exists
if (fs.existsSync(releaseDir)) {
  fs.rmSync(releaseDir, { recursive: true, force: true });
}
fs.mkdirSync(releaseDir, { recursive: true });

// 2. Build backend
console.log("\n[1/5] Building backend...");
execSync("npm run build", { cwd: path.join(rootDir, "backend"), stdio: "inherit" });

// 3. Build dashboard
console.log("\n[2/5] Building dashboard (Vite + React)...");
execSync("npm run build", { cwd: path.join(rootDir, "dashboard"), stdio: "inherit" });

// 4. Assemble Windows Portable Package
console.log("\n[3/5] Assembling Windows Portable distribution bundle...");
const portableDir = path.join(releaseDir, "ArcRift-Windows-Portable-v2.0.0");
fs.mkdirSync(portableDir, { recursive: true });

// Copy backend build & essentials
const backendTarget = path.join(portableDir, "backend");
fs.mkdirSync(backendTarget, { recursive: true });
fs.cpSync(path.join(rootDir, "backend", "dist"), path.join(backendTarget, "dist"), { recursive: true });
fs.copyFileSync(path.join(rootDir, "backend", "package.json"), path.join(backendTarget, "package.json"));
if (fs.existsSync(path.join(rootDir, "backend", "node_modules"))) {
  console.log("Copying production dependencies for backend...");
  fs.cpSync(path.join(rootDir, "backend", "node_modules"), path.join(backendTarget, "node_modules"), { recursive: true });
}
if (fs.existsSync(path.join(rootDir, "backend", ".env.example"))) {
  fs.copyFileSync(path.join(rootDir, "backend", ".env.example"), path.join(backendTarget, ".env.example"));
}

// Copy dashboard static dist
const dashboardTarget = path.join(portableDir, "dashboard");
fs.mkdirSync(dashboardTarget, { recursive: true });
fs.cpSync(path.join(rootDir, "dashboard", "dist"), path.join(dashboardTarget, "dist"), { recursive: true });

// Copy desktop files
const desktopTarget = path.join(portableDir, "desktop");
fs.mkdirSync(desktopTarget, { recursive: true });
fs.copyFileSync(path.join(rootDir, "desktop", "main.js"), path.join(desktopTarget, "main.js"));
fs.copyFileSync(path.join(rootDir, "desktop", "package.json"), path.join(desktopTarget, "package.json"));
if (fs.existsSync(path.join(rootDir, "desktop", "icon.ico"))) {
  fs.copyFileSync(path.join(rootDir, "desktop", "icon.ico"), path.join(desktopTarget, "icon.ico"));
}
if (fs.existsSync(path.join(rootDir, "desktop", "icon.png"))) {
  fs.copyFileSync(path.join(rootDir, "desktop", "icon.png"), path.join(desktopTarget, "icon.png"));
}

// Copy startup scripts & docs
fs.copyFileSync(path.join(rootDir, "NowledgeMem.bat"), path.join(portableDir, "NowledgeMem.bat"));
fs.copyFileSync(path.join(rootDir, "ChronosMind.vbs"), path.join(portableDir, "ChronosMind.vbs"));
fs.copyFileSync(path.join(rootDir, "README.md"), path.join(portableDir, "README.md"));
fs.copyFileSync(path.join(rootDir, "LICENSE"), path.join(portableDir, "LICENSE"));

// 5. Assemble Browser Extension Package
console.log("\n[4/5] Assembling Chrome/Edge Browser Extension...");
const extensionDir = path.join(releaseDir, "ArcRift-Browser-Extension-v2.0.0");
fs.mkdirSync(extensionDir, { recursive: true });
fs.cpSync(path.join(rootDir, "extension"), extensionDir, { recursive: true });

// 6. Create Zip files using PowerShell
console.log("\n[5/5] Compressing distribution ZIP archives...");
const portableZip = path.join(releaseDir, "ArcRift-Windows-Portable-v2.0.0.zip");
const extensionZip = path.join(releaseDir, "ArcRift-Browser-Extension-v2.0.0.zip");

execSync(`powershell -Command "Compress-Archive -Path '${portableDir}\\*' -DestinationPath '${portableZip}' -Force"`, { stdio: "inherit" });
console.log("-> Created:", portableZip);

execSync(`powershell -Command "Compress-Archive -Path '${extensionDir}\\*' -DestinationPath '${extensionZip}' -Force"`, { stdio: "inherit" });
console.log("-> Created:", extensionZip);

console.log("\n✅ All release artifacts packaged successfully in release-build/!");
