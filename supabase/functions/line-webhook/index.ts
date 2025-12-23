// ============================================================================
// LINE Webhook Handler - Interactive Bot
// ============================================================================
// Handles incoming messages from LINE users for interactive AQHI queries
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LINE_CHANNEL_ACCESS_TOKEN = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN")!;
const LINE_CHANNEL_SECRET = Deno.env.get("LINE_CHANNEL_SECRET")!;

// Community name mapping (Thai)
const COMMUNITY_KEYWORDS: Record<string, number> = {
  "พระนคร": 1,
  "ธนบุรี": 2,
  "บางกอกใหญ่": 3,
  "คลองสาน": 4,
  "บางกอกน้อย": 5,
  "หนองแขม": 6,
  "ราษฎร์บูรณะ": 7,
  "ดินแดง": 8,
  "พระโขนง": 9,
  "หนองจอก": 10,
  "ปทุมวัน": 11,
  "ป้อมปราบศัตรูพ่าย": 12,
  "สัมพันธวงศ์": 13,
  "บางพลัด": 14,
  "จตุจักร": 15,
};

// Verify LINE signature
async function verifySignature(body: string, signature: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(LINE_CHANNEL_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(body)
  );

  const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signed)));
  return base64Signature === signature;
}

// Reply to LINE message
async function replyMessage(replyToken: string, messages: any[]) {
  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LINE Reply API error: ${error}`);
  }

  return response.json();
}

// Create quick reply buttons for communities
function createCommunityQuickReply() {
  return {
    items: [
      { type: "action", action: { type: "message", label: "ปทุมวัน", text: "ปทุมวัน" } },
      { type: "action", action: { type: "message", label: "จตุจักร", text: "จตุจักร" } },
      { type: "action", action: { type: "message", label: "ดินแดง", text: "ดินแดง" } },
      { type: "action", action: { type: "message", label: "พระนคร", text: "พระนคร" } },
      { type: "action", action: { type: "message", label: "ธนบุรี", text: "ธนบุรี" } },
      { type: "action", action: { type: "message", label: "สรุปทุกเขต", text: "สรุป" } },
    ],
  };
}

// Handle text message
async function handleTextMessage(text: string, userId: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Check for greeting
  if (text.match(/สวัสดี|hello|hi|เฮ้|หวัดดี/i)) {
    return [
      {
        type: "text",
        text: "สวัสดีค่ะ! 👋\n\nฉันเป็นบอทแจ้งเตือนคุณภาพอากาศ AQHI กรุงเทพฯ\n\nคุณสามารถ:\n• พิมพ์ชื่อเขตเพื่อดู AQHI (เช่น ปทุมวัน, จตุจักร)\n• พิมพ์ 'สรุป' เพื่อดูสรุปทุกเขต\n• พิมพ์ 'ช่วยเหลือ' เพื่อดูคำแนะนำ",
        quickReply: createCommunityQuickReply(),
      },
    ];
  }

  // Check for help
  if (text.match(/ช่วยเหลือ|help|คำสั่ง/i)) {
    return [
      {
        type: "text",
        text: "📖 คำแนะนำการใช้งาน\n\n" +
          "🔹 พิมพ์ชื่อเขต: ปทุมวัน, จตุจักร, ดินแดง ฯลฯ\n" +
          "🔹 พิมพ์ 'สรุป' เพื่อดูทุกเขต\n\n" +
          "📊 ระดับ AQHI:\n" +
          "1-3: เสี่ยงต่ำ 😊\n" +
          "4-6: เสี่ยงปานกลาง 😐\n" +
          "7-9: เสี่ยงสูง 😷\n" +
          "10+: เสี่ยงสูงมาก 🚨",
        quickReply: createCommunityQuickReply(),
      },
    ];
  }

  // Check for summary
  if (text.match(/สรุป|ทั้งหมด|all|summary/i)) {
    const { data, error } = await supabase.rpc("get_all_communities_aqhi");

    if (error || !data || data.length === 0) {
      return [
        {
          type: "text",
          text: "❌ ขออภัย ไม่สามารถดึงข้อมูลได้ในขณะนี้\nกรุณาลองใหม่อีกครั้งค่ะ",
        },
      ];
    }

    // Return via Edge Function (to get proper Flex Message)
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/line-notify-aqhi`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          messageType: "summary",
          userId,
        }),
      }
    );

    if (!response.ok) {
      return [{ type: "text", text: "❌ เกิดข้อผิดพลาดในการดึงข้อมูล" }];
    }

    return []; // Message already sent by Edge Function
  }

  // Check for community name
  const communityId = COMMUNITY_KEYWORDS[text.trim()];

  if (communityId) {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/line-notify-aqhi`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          communityId,
          messageType: "community",
          userId,
        }),
      }
    );

    if (!response.ok) {
      return [
        {
          type: "text",
          text: `❌ ไม่พบข้อมูลสำหรับเขต${text}\nกรุณาลองใหม่อีกครั้งค่ะ`,
          quickReply: createCommunityQuickReply(),
        },
      ];
    }

    return []; // Message already sent by Edge Function
  }

  // Unknown command
  return [
    {
      type: "text",
      text: "❓ ขออภัย ฉันไม่เข้าใจคำสั่งนี้\n\nลองพิมพ์:\n• ชื่อเขต (เช่น ปทุมวัน)\n• 'สรุป' เพื่อดูทุกเขต\n• 'ช่วยเหลือ' เพื่อดูคำแนะนำ",
      quickReply: createCommunityQuickReply(),
    },
  ];
}

serve(async (req) => {
  try {
    // Verify signature
    const signature = req.headers.get("x-line-signature");
    const body = await req.text();

    if (!signature || !(await verifySignature(body, signature))) {
      return new Response("Invalid signature", { status: 401 });
    }

    const data = JSON.parse(body);
    const events = data.events || [];

    for (const event of events) {
      if (event.type === "message" && event.message.type === "text") {
        const replyMessages = await handleTextMessage(
          event.message.text,
          event.source.userId
        );

        if (replyMessages.length > 0) {
          await replyMessage(event.replyToken, replyMessages);
        }
      }
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
});
