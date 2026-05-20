// Gemini Vision으로 KBO 티켓 이미지에서 경기 정보를 추출.
// 사용 모델: gemini-2.5-flash (한국어 OCR 정확, JSON 구조화 출력 지원, 무료 티어).

import { GoogleGenAI, Type } from "@google/genai";
import { parseTeamCode } from "@/lib/server/kbo/teamCode";

export type TicketParseResult = {
  ok: true;
  gameDate: string;        // YYYY-MM-DD
  homeTeamId: string;      // lg, doosan, ...
  awayTeamId: string;
  stadium: string;
  rawText?: string;        // 디버그 용
} | {
  ok: false;
  reason: string;
  rawPayload?: unknown;
};

const PROMPT = `당신은 KBO 야구 티켓 OCR 전문가입니다. 첨부된 한국 프로야구 티켓 이미지를 분석해 다음 정보를 정확히 추출하세요:

1. 경기 날짜 (YYYY-MM-DD 형식, 예: 2026-05-07)
2. 홈팀 이름 (한글 또는 영문 약자, 예: "두산", "LG", "KIA")
3. 원정팀 이름 (한글 또는 영문 약자)
4. 경기장 이름 (예: "잠실", "고척", "사직")

홈/원정 구분 기준:
- 티켓에 "vs"가 있으면 보통 "원정 vs 홈" 또는 "홈 vs 원정" 표기. 경기장이 어느 팀의 홈구장인지로 판단.
- LG/두산 → 잠실, 키움 → 고척, 롯데 → 사직, KIA → 광주, 삼성 → 대구, 한화 → 대전, NC → 창원, KT → 수원, SSG → 문학
- 좌석 정보(예: "1루 응원석")가 있으면 그 팀이 홈팀.

티켓이 KBO 정규시즌 티켓이 아니거나 정보를 명확히 읽을 수 없으면 fail로 응답하세요.

응답은 JSON으로만, 추가 설명 없이.`;

export async function parseTicketWithGemini(imageBase64: string, mimeType: string): Promise<TicketParseResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: "GEMINI_API_KEY가 설정되지 않았습니다." };
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: PROMPT },
            { inlineData: { mimeType, data: imageBase64 } }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            success: { type: Type.BOOLEAN, description: "추출 성공 여부" },
            gameDate: { type: Type.STRING, description: "YYYY-MM-DD" },
            homeTeamName: { type: Type.STRING, description: "홈팀 이름" },
            awayTeamName: { type: Type.STRING, description: "원정팀 이름" },
            stadium: { type: Type.STRING, description: "경기장 이름" },
            failReason: { type: Type.STRING, description: "실패 시 사유" }
          },
          required: ["success"],
          propertyOrdering: ["success", "gameDate", "homeTeamName", "awayTeamName", "stadium", "failReason"]
        }
      }
    });

    const text = response.text;
    if (!text) {
      return { ok: false, reason: "Gemini 응답이 비어있습니다." };
    }

    const parsed = JSON.parse(text) as {
      success: boolean;
      gameDate?: string;
      homeTeamName?: string;
      awayTeamName?: string;
      stadium?: string;
      failReason?: string;
    };

    if (!parsed.success) {
      return { ok: false, reason: parsed.failReason ?? "티켓 정보를 인식하지 못했습니다.", rawPayload: parsed };
    }

    if (!parsed.gameDate || !parsed.homeTeamName || !parsed.awayTeamName) {
      return { ok: false, reason: "경기 정보가 불완전합니다.", rawPayload: parsed };
    }

    const homeTeamId = parseTeamCode(parsed.homeTeamName);
    const awayTeamId = parseTeamCode(parsed.awayTeamName);

    if (!homeTeamId || !awayTeamId) {
      return {
        ok: false,
        reason: `팀 이름을 인식하지 못했습니다 (홈: ${parsed.homeTeamName}, 원정: ${parsed.awayTeamName})`,
        rawPayload: parsed
      };
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.gameDate)) {
      return { ok: false, reason: `날짜 형식이 올바르지 않습니다: ${parsed.gameDate}`, rawPayload: parsed };
    }

    return {
      ok: true,
      gameDate: parsed.gameDate,
      homeTeamId,
      awayTeamId,
      stadium: parsed.stadium ?? "미정",
      rawText: text
    };
  } catch (err) {
    return { ok: false, reason: `Vision 호출 실패: ${(err as Error).message}` };
  }
}
