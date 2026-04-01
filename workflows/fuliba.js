import notification from "./utils/notification-kit";
const env = require("./utils/env");
const utils = require("./utils/utils");

function loadJuejinHelper() {
  try {
    const localModule = require("../packages/juejin-helper/src/index");
    return localModule.default || localModule;
  } catch (error) {
    const publishedModule = require("juejin-helper");
    return publishedModule.default || publishedModule;
  }
}

const JuejinHelper = loadJuejinHelper();

function getFulibaCookies() {
  if (!env.FULI_COOKIE) {
    return [];
  }

  return String(env.FULI_COOKIE)
    .split("@")
    .map(cookie => cookie.trim())
    .filter(Boolean);
}

class FuliCheckIn {
  constructor(cookie) {
    this.cookie = cookie;
    this.result = null;
  }

  async run() {
    const helper = new JuejinHelper();
    helper.setCookie(this.cookie);
    this.result = await helper.fuliba().checkIn();
    return this.result;
  }

  toString() {
    if (!this.result) {
      return "福利吧论坛：未执行";
    }

    return [
      `站点: ${this.result.baseUrl}`,
      `结果: ${this.result.message}`,
      `状态: ${this.result.success ? (this.result.alreadySigned ? "已签到" : "成功") : "失败"}`
    ].join("\n");
  }
}

async function run() {
  const cookies = getFulibaCookies();

  if (cookies.length === 0) {
    throw new Error("未配置 FULI_COOKIE");
  }

  const messageList = [];
  let hasError = false;

  for (const cookie of cookies) {
    const checkin = new FuliCheckIn(cookie);
    await utils.wait(utils.randomRangeNumber(1000, 3000));

    try {
      await checkin.run();
    } catch (error) {
      hasError = true;
      checkin.result = {
        success: false,
        alreadySigned: false,
        message: error.message,
        baseUrl: "-"
      };
    }

    const content = checkin.toString();
    console.log(content);
    messageList.push(content);
  }

  const message = messageList.join(`\n${"-".repeat(15)}\n`);

  await notification.pushMessage({
    title: "福利吧论坛签到",
    content: hasError ? `<strong>执行异常提醒</strong><pre>${message}</pre>` : message,
    msgtype: hasError ? "html" : "text"
  });
}

run().catch(error => {
  console.log(error.message);
  notification.pushMessage({
    title: "福利吧论坛签到",
    content: `<strong>Error</strong><pre>${error.message}</pre>`,
    msgtype: "html"
  });
});
