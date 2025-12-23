// ============================================================================
// LINE Notify AQHI - Supabase Edge Function
// ============================================================================
// Sends AQHI updates to LINE Official Account users
// Triggered by cron or manually via HTTP request
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LINE_CHANNEL_ACCESS_TOKEN = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN")!;

interface CommunityAQHI {
  community_id: number;
  community_name: string;
  community_name_th: string;
  avg_aqhi: number;
  max_aqhi: number;
  min_aqhi: number;
  station_count: number;
  category: string;
  category_th: string;
  health_advice_th: string;
  last_updated: string;
}

// AQHI color mapping
function getAQHIColor(aqhi: number): string {
  if (aqhi <= 3) return "#10b981"; // green - Low Risk
  if (aqhi <= 6) return "#f59e0b"; // yellow - Moderate Risk
  if (aqhi <= 9) return "#f97316"; // orange - High Risk
  return "#ef4444"; // red - Very High Risk
}

// AQHI emoji mapping
function getAQHIEmoji(aqhi: number): string {
  if (aqhi <= 3) return "😊";
  if (aqhi <= 6) return "😐";
  if (aqhi <= 9) return "😷";
  return "🚨";
}

// Create LINE Flex Message for community AQHI
function createCommunityFlexMessage(data: CommunityAQHI) {
  const color = getAQHIColor(data.avg_aqhi);
  const emoji = getAQHIEmoji(data.avg_aqhi);

  return {
    type: "bubble",
    size: "kilo",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: `${emoji} ${data.community_name_th}`,
          weight: "bold",
          size: "lg",
          color: "#ffffff",
        },
      ],
      backgroundColor: color,
      paddingAll: "15px",
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            {
              type: "text",
              text: "AQHI",
              size: "sm",
              color: "#999999",
              flex: 0,
            },
            {
              type: "text",
              text: data.avg_aqhi.toFixed(1),
              size: "xxl",
              weight: "bold",
              align: "end",
              color: color,
            },
          ],
        },
        {
          type: "box",
          layout: "vertical",
          margin: "lg",
          spacing: "sm",
          contents: [
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "ระดับ",
                  size: "sm",
                  color: "#555555",
                  flex: 0,
                },
                {
                  type: "text",
                  text: data.category_th,
                  size: "sm",
                  color: "#111111",
                  align: "end",
                  weight: "bold",
                },
              ],
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "สูงสุด",
                  size: "sm",
                  color: "#555555",
                  flex: 0,
                },
                {
                  type: "text",
                  text: data.max_aqhi.toFixed(1),
                  size: "sm",
                  color: "#111111",
                  align: "end",
                },
              ],
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "ต่ำสุด",
                  size: "sm",
                  color: "#555555",
                  flex: 0,
                },
                {
                  type: "text",
                  text: data.min_aqhi.toFixed(1),
                  size: "sm",
                  color: "#111111",
                  align: "end",
                },
              ],
            },
          ],
        },
        {
          type: "separator",
          margin: "lg",
        },
        {
          type: "box",
          layout: "vertical",
          margin: "lg",
          contents: [
            {
              type: "text",
              text: "คำแนะนำ",
              size: "xs",
              color: "#999999",
              margin: "none",
            },
            {
              type: "text",
              text: data.health_advice_th,
              size: "sm",
              color: "#111111",
              wrap: true,
              margin: "sm",
            },
          ],
        },
      ],
      paddingAll: "15px",
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: `อัพเดท: ${new Date(data.last_updated).toLocaleString("th-TH", {
            timeZone: "Asia/Bangkok",
            hour: "2-digit",
            minute: "2-digit",
          })}`,
          size: "xxs",
          color: "#999999",
          align: "center",
        },
      ],
      paddingAll: "10px",
    },
  };
}

// Create summary message for all communities
function createSummaryFlexMessage(communities: CommunityAQHI[]) {
  const now = new Date().toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
    timeStyle: "short",
  });

  // Sort by AQHI level
  const sorted = [...communities].sort((a, b) => b.avg_aqhi - a.avg_aqhi);

  const contents = sorted.map((c) => ({
    type: "box" as const,
    layout: "horizontal" as const,
    contents: [
      {
        type: "text" as const,
        text: `${getAQHIEmoji(c.avg_aqhi)} ${c.community_name_th}`,
        size: "sm" as const,
        flex: 3,
        wrap: true,
      },
      {
        type: "text" as const,
        text: c.avg_aqhi.toFixed(1),
        size: "sm" as const,
        align: "end" as const,
        color: getAQHIColor(c.avg_aqhi),
        weight: "bold" as const,
        flex: 1,
      },
    ],
    margin: "md" as const,
  }));

  return {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "📊 สรุป AQHI กรุงเทพฯ",
          weight: "bold",
          size: "lg",
          color: "#ffffff",
        },
      ],
      backgroundColor: "#1e40af",
      paddingAll: "15px",
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: `${now}`,
          size: "xs",
          color: "#999999",
          margin: "none",
        },
        {
          type: "separator",
          margin: "lg",
        },
        ...contents,
      ],
      paddingAll: "15px",
    },
  };
}

// Send LINE message
async function sendLINEMessage(message: any, to?: string) {
  const url = to
    ? "https://api.line.me/v2/bot/message/push"
    : "https://api.line.me/v2/bot/message/broadcast";

  const body = to
    ? { to, messages: [message] }
    : { messages: [message] };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LINE API error: ${error}`);
  }

  return response.json();
}

serve(async (req) => {
  try {
    // Handle CORS
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    // Parse request
    const { communityId, messageType = "summary", userId } = await req.json();

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (messageType === "community" && communityId) {
      // Send specific community AQHI
      const { data, error } = await supabase.rpc("get_community_aqhi_summary", {
        target_community_id: communityId,
      });

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error(`No data for community ${communityId}`);
      }

      const flexMessage = {
        type: "flex",
        altText: `AQHI: ${data[0].community_name_th}`,
        contents: createCommunityFlexMessage(data[0]),
      };

      await sendLINEMessage(flexMessage, userId);

      return new Response(
        JSON.stringify({ success: true, community: data[0].community_name_th }),
        { headers: { "Content-Type": "application/json" } }
      );
    } else {
      // Send summary of all communities
      const { data, error } = await supabase.rpc("get_all_communities_aqhi");

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("No community data available");
      }

      const flexMessage = {
        type: "flex",
        altText: "สรุป AQHI กรุงเทพฯ",
        contents: createSummaryFlexMessage(data),
      };

      await sendLINEMessage(flexMessage, userId);

      return new Response(
        JSON.stringify({ success: true, communities: data.length }),
        { headers: { "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
