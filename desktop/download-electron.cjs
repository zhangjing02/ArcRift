const https = require("https");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const version = "34.5.8";
const url = `https://npmmirror.com/mirrors/electron/v${version}/electron-v${version}-win32-x64.zip`;
const desktopDir = path.resolve(__dirname);
const targetDir = path.resolve(desktopDir, "node_modules/electron/dist");
const zipFile = path.resolve(desktopDir, "electron.zip");

console.log("Downloading Electron binary from mirror:", url);

function download(downloadUrl) {
  const file = fs.createWriteStream(zipFile);
  https.get(downloadUrl, (res) => {
    if (res.statusCode === 302 || res.statusCode === 301) {
      console.log("Redirecting to:", res.headers.location);
      download(res.headers.location);
      return;
    }
    
    let downloadedBytes = 0;
    const totalBytes = parseInt(res.headers["content-length"] || "0", 10);
    
    res.on("data", (chunk) => {
      downloadedBytes += chunk.length;
      if (totalBytes > 0 && downloadedBytes % (10 * 1024 * 1024) < chunk.length) {
        console.log(`Progress: ${(downloadedBytes / 1024 / 1024).toFixed(1)} MB / ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
      }
    });

    res.pipe(file);
    file.on("finish", () => {
      file.close();
      console.log("Download completed. Extracting to:", targetDir);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      execSync(`tar -xf "${zipFile}" -C "${targetDir}"`);
      fs.unlinkSync(zipFile);

      // Create path.txt in node_modules/electron
      const electronPkgDir = path.resolve(desktopDir, "node_modules/electron");
      fs.writeFileSync(path.resolve(electronPkgDir, "path.txt"), "dist/electron.exe");

      console.log("Electron setup completed successfully!");
    });
  }).on("error", (err) => {
    console.error("Download failed:", err);
  });
}

download(url);
