const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const releaseDir = path.join(rootDir, "release-build");

console.log("=== Packaging ArcRift macOS Portable Bundle ===");

const macDir = path.join(releaseDir, "ArcRift-macOS-Portable-v2.0.0");
if (fs.existsSync(macDir)) {
  fs.rmSync(macDir, { recursive: true, force: true });
}
fs.mkdirSync(macDir, { recursive: true });

// Copy backend build
const backendTarget = path.join(macDir, "backend");
fs.mkdirSync(backendTarget, { recursive: true });
fs.cpSync(path.join(rootDir, "backend", "dist"), path.join(backendTarget, "dist"), { recursive: true });
fs.copyFileSync(path.join(rootDir, "backend", "package.json"), path.join(backendTarget, "package.json"));
if (fs.existsSync(path.join(rootDir, "backend", "node_modules"))) {
  console.log("Copying backend dependencies...");
  fs.cpSync(path.join(rootDir, "backend", "node_modules"), path.join(backendTarget, "node_modules"), { recursive: true });
}
if (fs.existsSync(path.join(rootDir, "backend", ".env.example"))) {
  fs.copyFileSync(path.join(rootDir, "backend", ".env.example"), path.join(backendTarget, ".env.example"));
}

// Copy dashboard static dist
const dashboardTarget = path.join(macDir, "dashboard");
fs.mkdirSync(dashboardTarget, { recursive: true });
fs.cpSync(path.join(rootDir, "dashboard", "dist"), path.join(dashboardTarget, "dist"), { recursive: true });

// Copy mac startup script & docs
fs.copyFileSync(path.join(rootDir, "start-macos.command"), path.join(macDir, "start-macos.command"));
fs.copyFileSync(path.join(rootDir, "start.sh"), path.join(macDir, "start.sh"));
fs.copyFileSync(path.join(rootDir, "README.md"), path.join(macDir, "README.md"));
fs.copyFileSync(path.join(rootDir, "LICENSE"), path.join(macDir, "LICENSE"));

// Compress macOS zip
const macZip = path.join(releaseDir, "ArcRift-macOS-Portable-v2.0.0.zip");
execSync(`powershell -Command "Compress-Archive -Path '${macDir}\\*' -DestinationPath '${macZip}' -Force"`, { stdio: "inherit" });
console.log("-> Created macOS Zip:", macZip);

console.log("✅ ArcRift macOS package created successfully!");
