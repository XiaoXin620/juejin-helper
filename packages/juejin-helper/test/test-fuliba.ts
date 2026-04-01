import assert from "assert";
import JuejinHelper from "../src/index";
import Fuliba, { extractFormhash, parseCheckInResult } from "../src/fuliba";

async function run() {
  const formhashHtml = `<input type="hidden" name="formhash" value="abc12345" />`;
  assert.strictEqual(extractFormhash(formhashHtml), "abc12345");

  const success = parseCheckInResult("<div>签到成功，奖励已发放</div>", "https://www.wnflb.com");
  assert.deepStrictEqual(success, {
    success: true,
    alreadySigned: false,
    message: "签到成功",
    baseUrl: "https://www.wnflb.com"
  });

  const alreadySigned = parseCheckInResult("<div>您今天已经签到过了</div>", "https://www.wnflb.com");
  assert.deepStrictEqual(alreadySigned, {
    success: true,
    alreadySigned: true,
    message: "今日已签到",
    baseUrl: "https://www.wnflb.com"
  });

  const helper = new JuejinHelper();
  helper.setCookie("auth=token; saltkey=value");
  const fuliba = helper.fuliba();

  assert.ok(fuliba instanceof Fuliba);
  assert.strictEqual(helper.getCookie(), "auth=token; saltkey=value");

  console.log("fuliba parser smoke tests passed");
}

async function runCheckInFlowTest() {
  const helper = new JuejinHelper().setCookie("auth=token; saltkey=value");
  const responses: Record<string, string> = {
    "https://www.wnflb99.com": `<html><title>福利吧</title></html>`,
    "https://www.wnflb99.com/plugin.php?id=fx_checkin%3Alist": `<input type="hidden" name="formhash" value="feedbeef" />`,
    "https://www.wnflb99.com/plugin.php?id=fx_checkin%3Acheckin&formhash=feedbeef&feedbeef=&infloat=yes&handlekey=fx_checkin&inajax=1&ajaxtarget=fwin_content_fx_checkin": `<div>签到成功</div>`
  };

  let verifyCount = 0;

  const fuliba = new Fuliba(helper, async url => {
    if (url === "https://www.wnflb2023.com") {
      throw new Error("unreachable");
    }

    if (url === "https://www.wnflb99.com/plugin.php?id=fx_checkin%3Alist" && verifyCount > 0) {
      return `<div>今日已签到 已连续签到 7 天 累计签到 10 天 恭喜您获得 2 积分</div>`;
    }

    if (!responses[url]) {
      throw new Error(`unexpected url: ${url}`);
    }

    if (url === "https://www.wnflb99.com/plugin.php?id=fx_checkin%3Alist") {
      verifyCount++;
    }

    return responses[url];
  });

  const result = await fuliba.checkIn();
  assert.deepStrictEqual(result, {
    success: true,
    alreadySigned: false,
    message: "签到成功",
    baseUrl: "https://www.wnflb99.com"
  });

  console.log("fuliba checkin flow tests passed");
}

run()
  .then(runCheckInFlowTest)
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
