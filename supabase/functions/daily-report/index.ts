import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TO_EMAIL = "marchin.momo@gmail.com";
const FROM_EMAIL = "onboarding@resend.dev";

interface QueryLog {
  id: number;
  question: string;
  ai_answer: string;
  response_time_ms: number | null;
  created_at: string;
}

function toJSTString(date: Date): string {
  return date.toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function toJSTTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function buildHTML(
  reportDate: string,
  todayLogs: QueryLog[],
  prevDayLogs: QueryLog[],
  totalCount: number
): string {
  const todayCount = todayLogs.length;
  const prevCount = prevDayLogs.length;
  const diff = todayCount - prevCount;
  const diffStr =
    diff > 0 ? `(+${diff})` : diff < 0 ? `(${diff})` : "(±0)";
  const diffColor = diff > 0 ? "#16a34a" : diff < 0 ? "#dc2626" : "#6b7280";

  const avgResponseTime =
    todayCount > 0
      ? Math.round(
          todayLogs.reduce((sum, l) => sum + (l.response_time_ms ?? 0), 0) /
            todayCount
        )
      : 0;

  // No questions case
  if (todayCount === 0) {
    return `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #ea580c, #f97316); padding: 24px; border-radius: 12px 12px 0 0;">
      <h1 style="color: white; margin: 0; font-size: 20px;">🏀 バスケ審判AI 日次レポート</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">${reportDate}</p>
    </div>
    <div style="background: white; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
      <p style="color: #374151; font-size: 16px; text-align: center; padding: 32px 0;">
        昨日の質問はありませんでした
      </p>
      <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 16px;">
        <p style="color: #6b7280; font-size: 13px; margin: 0;">累計質問数: <strong style="color: #374151;">${totalCount.toLocaleString()}件</strong></p>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  // Question list rows
  const questionRows = todayLogs
    .map(
      (log, i) => `
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 10px 12px; color: #9ca3af; font-size: 13px; white-space: nowrap; vertical-align: top;">${i + 1}</td>
        <td style="padding: 10px 12px; color: #6b7280; font-size: 13px; white-space: nowrap; vertical-align: top;">${toJSTTime(log.created_at)}</td>
        <td style="padding: 10px 12px; color: #374151; font-size: 14px;">${escapeHtml(log.question)}</td>
        <td style="padding: 10px 12px; color: #6b7280; font-size: 13px; white-space: nowrap; vertical-align: top;">${log.response_time_ms != null ? `${log.response_time_ms.toLocaleString()}ms` : "-"}</td>
      </tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #ea580c, #f97316); padding: 24px; border-radius: 12px 12px 0 0;">
      <h1 style="color: white; margin: 0; font-size: 20px;">🏀 バスケ審判AI 日次レポート</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">${reportDate}</p>
    </div>

    <div style="background: white; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
      <!-- Summary Cards -->
      <div style="display: flex; gap: 12px; margin-bottom: 24px;">
        <div style="flex: 1; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 16px; text-align: center;">
          <p style="color: #9a3412; font-size: 12px; margin: 0 0 4px;">昨日の質問数</p>
          <p style="color: #ea580c; font-size: 28px; font-weight: bold; margin: 0;">
            ${todayCount}<span style="font-size: 14px; color: ${diffColor}; margin-left: 6px;">${diffStr}</span>
          </p>
        </div>
        <div style="flex: 1; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; text-align: center;">
          <p style="color: #1e40af; font-size: 12px; margin: 0 0 4px;">平均応答時間</p>
          <p style="color: #2563eb; font-size: 28px; font-weight: bold; margin: 0;">
            ${avgResponseTime.toLocaleString()}<span style="font-size: 14px;">ms</span>
          </p>
        </div>
      </div>

      <!-- Question List -->
      <h2 style="color: #374151; font-size: 16px; margin: 0 0 12px; padding-bottom: 8px; border-bottom: 2px solid #f97316;">
        質問一覧
      </h2>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 2px solid #e5e7eb;">
            <th style="padding: 8px 12px; text-align: left; color: #6b7280; font-size: 12px; font-weight: 600;">#</th>
            <th style="padding: 8px 12px; text-align: left; color: #6b7280; font-size: 12px; font-weight: 600;">時刻</th>
            <th style="padding: 8px 12px; text-align: left; color: #6b7280; font-size: 12px; font-weight: 600;">質問</th>
            <th style="padding: 8px 12px; text-align: left; color: #6b7280; font-size: 12px; font-weight: 600;">応答</th>
          </tr>
        </thead>
        <tbody>
          ${questionRows}
        </tbody>
      </table>

      <!-- Footer Stats -->
      <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 24px;">
        <p style="color: #6b7280; font-size: 13px; margin: 0;">累計質問数: <strong style="color: #374151;">${totalCount.toLocaleString()}件</strong></p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

serve(async (req) => {
  try {
    // CORS for manual invocation
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers":
            "authorization, x-client-info, apikey, content-type",
        },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Yesterday in JST: JST = UTC+9
    const now = new Date();
    const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const yesterday = new Date(jstNow);
    yesterday.setDate(yesterday.getDate() - 1);

    // Start/end of yesterday in JST, converted to UTC for query
    const startOfYesterdayJST = new Date(
      yesterday.getFullYear(),
      yesterday.getMonth(),
      yesterday.getDate(),
      0, 0, 0, 0
    );
    const endOfYesterdayJST = new Date(
      yesterday.getFullYear(),
      yesterday.getMonth(),
      yesterday.getDate(),
      23, 59, 59, 999
    );
    // Convert back to UTC
    const startUTC = new Date(startOfYesterdayJST.getTime() - 9 * 60 * 60 * 1000);
    const endUTC = new Date(endOfYesterdayJST.getTime() - 9 * 60 * 60 * 1000);

    // Day before yesterday for comparison
    const dayBeforeYesterday = new Date(startUTC.getTime() - 24 * 60 * 60 * 1000);

    // Fetch yesterday's logs
    const { data: todayLogs, error: todayError } = await supabase
      .from("query_logs")
      .select("id, question, ai_answer, response_time_ms, created_at")
      .gte("created_at", startUTC.toISOString())
      .lte("created_at", endUTC.toISOString())
      .order("created_at", { ascending: true });

    if (todayError) throw new Error(`Query error: ${todayError.message}`);

    // Fetch day-before-yesterday's logs for comparison
    const { data: prevDayLogs, error: prevError } = await supabase
      .from("query_logs")
      .select("id")
      .gte("created_at", dayBeforeYesterday.toISOString())
      .lt("created_at", startUTC.toISOString());

    if (prevError) throw new Error(`Prev day query error: ${prevError.message}`);

    // Fetch total count
    const { count: totalCount, error: countError } = await supabase
      .from("query_logs")
      .select("id", { count: "exact", head: true });

    if (countError) throw new Error(`Count error: ${countError.message}`);

    const reportDate = toJSTString(yesterday);
    const html = buildHTML(
      reportDate,
      (todayLogs as QueryLog[]) || [],
      (prevDayLogs as QueryLog[]) || [],
      totalCount ?? 0
    );

    // Send email via Resend
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [TO_EMAIL],
        subject: `🏀 バスケ審判AI 日次レポート - ${reportDate}`,
        html,
      }),
    });

    if (!emailRes.ok) {
      const errBody = await emailRes.text();
      throw new Error(`Resend API error: ${emailRes.status} ${errBody}`);
    }

    const emailResult = await emailRes.json();

    return new Response(
      JSON.stringify({
        success: true,
        date: reportDate,
        questionCount: (todayLogs || []).length,
        totalCount: totalCount ?? 0,
        emailId: emailResult.id,
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Daily report error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
