const http = require("http");

const data = JSON.stringify({
  sessionId: "BeBeBus",
  title: "OTA 升级接口参数改造与错误码定位",
  content: `# BeBeBus OTA 升级接口参数改造方案

## 1. OTA 开始升级接口传参改造 (POST /api/v2/device/ota/start)
- 在 AiMqttOtaChannel.java 中将 triggerUpgradeTask() 的 .postAsync(...) 改为 .postBodyAsync(...)，将 deviceId 作为 JSON Request Body ({"deviceId":"xxx"}) 提交。

## 2. OTA 错误码机制与协议定位
- 依据 BeBeBus 硬件通信协议文档 2026-08-03.md，设备通过 MQTT cmd=2020 (CMD_OTA_PROGRESS) 上报进度与错误 (status="failed", errorCode, errorMsg)；
- 记录了实测中捕获的硬件真实错误码：errorCode: 12 (安装校验失败) 与 errorCode: 8 (目标版本未升高)；
- 明确了“电量低”与“使用中”未抓取到实际码表的原因及双通道拦截流转机制。

## 3. OTA 状态判定与实时性优化沉淀
- 移除了 15 秒失败超时等待 (2ms 内即时反馈)；
- 根除了 installing 100% 假成功 Bug；
- 修复了重试按钮切回下载状态时文字颜色白色残留的 UI 缺陷。`,
  importance: "critical",
  category: "Architecture",
  tags: ["OTA", "BLE", "MQTT", "Android"],
  source: "mcp"
});

const req = http.request(
  {
    hostname: "127.0.0.1",
    port: 3001,
    path: "/api/memories",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(data),
    },
  },
  (res) => {
    let body = "";
    res.on("data", (d) => (body += d));
    res.on("end", () => {
      console.log("POST /api/memories Response:", res.statusCode, body);
    });
  }
);

req.on("error", (e) => console.error("Request error:", e));
req.write(data);
req.end();
