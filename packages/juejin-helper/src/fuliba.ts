import axios from "axios";
import JuejinHelper from "./index";

type FulibaRequester = (url: string) => Promise<string>;

const BASE_URLS = [
  "https://www.wnflb2023.com",
  "https://www.wnflb99.com",
  "https://www.wnflb.com",
  "https://f.wonderfulday82.evil"
];

const CHECKIN_LIST_PATH = "/plugin.php?id=fx_checkin%3Alist";

export type FuliCheckInResult = {
  success: boolean;
  alreadySigned: boolean;
  message: string;
  baseUrl: string;
};

export function extractFormhash(html: string): string | null {
  const patterns = [
    /name="formhash" value="([^"]+)"/i,
    /formhash=([0-9a-zA-Z]+)/i,
    /"formhash"\s+value="([^"]+)"/i
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match) {
      return match[1];
    }
  }

  return null;
}

export function parseCheckInResult(html: string, baseUrl: string): FuliCheckInResult {
  if (/已经签到|今日已签到|今天已经签到/i.test(html)) {
    return {
      success: true,
      alreadySigned: true,
      message: "今日已签到",
      baseUrl
    };
  }

  if (/签到成功|奖励已发放|恭喜您/i.test(html)) {
    return {
      success: true,
      alreadySigned: false,
      message: "签到成功",
      baseUrl
    };
  }

  const plainText = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  return {
    success: false,
    alreadySigned: false,
    message: plainText || "签到失败",
    baseUrl
  };
}

class Fuliba {
  juejin: JuejinHelper;
  requester?: FulibaRequester;

  /**
   * 福利吧论坛签到
   *
   * const helper = new JuejinHelper();
   * helper.setCookie(process.env.FULI_COOKIE || "");
   * const result = await helper.fuliba().checkIn();
   */
  constructor(juejin: JuejinHelper, requester?: FulibaRequester) {
    this.juejin = juejin;
    this.requester = requester;
  }

  async requestText(url: string) {
    if (this.requester) {
      return this.requester(url);
    }

    const response = await axios.get<string>(url, {
      headers: {
        cookie: this.juejin.getCookie(),
        referer: url,
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36"
      },
      responseType: "text"
    });

    return response.data;
  }

  async detectBaseUrl(): Promise<string> {
    for (const baseUrl of BASE_URLS) {
      try {
        const html = await this.requestText(baseUrl);
        if (/<html|论坛|discuz|门户|福利吧/i.test(html)) {
          return baseUrl;
        }
      } catch (error) {
        continue;
      }
    }

    throw new Error("福利吧论坛域名不可用");
  }

  async getFormhash(baseUrl: string): Promise<string> {
    let html = await this.requestText(`${baseUrl}${CHECKIN_LIST_PATH}`);
    let formhash = extractFormhash(html);

    if (!formhash) {
      html = await this.requestText(baseUrl);
      formhash = extractFormhash(html);
    }

    if (!formhash) {
      throw new Error("福利吧论坛 formhash 提取失败");
    }

    return formhash;
  }

  async checkIn(): Promise<FuliCheckInResult> {
    const baseUrl = await this.detectBaseUrl();
    const formhash = await this.getFormhash(baseUrl);
    const actionHtml = await this.requestText(
      `${baseUrl}/plugin.php?id=fx_checkin%3Acheckin&formhash=${formhash}&${formhash}=&infloat=yes&handlekey=fx_checkin&inajax=1&ajaxtarget=fwin_content_fx_checkin`
    );
    const actionResult = parseCheckInResult(actionHtml, baseUrl);

    if (actionResult.success && actionResult.alreadySigned) {
      return actionResult;
    }

    const html = await this.requestText(`${baseUrl}${CHECKIN_LIST_PATH}`);
    const verifyResult = parseCheckInResult(html, baseUrl);

    if (verifyResult.success && actionResult.success) {
      return {
        ...verifyResult,
        alreadySigned: actionResult.alreadySigned,
        message: actionResult.message
      };
    }

    return verifyResult;
  }
}

export default Fuliba;
