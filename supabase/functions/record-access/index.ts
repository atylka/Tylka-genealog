import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const encoder = new TextEncoder();
async function hashToken(token: string) {
  const bytes = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return Array.from(new Uint8Array(bytes)).map(b => b.toString(16).padStart(2, "0")).join("");
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ownerId = "7a8cd586-c68f-4078-b61d-a87f3842b07e";
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  try {
    const body = await req.json();
    if (body.action === "request") {
      const name = String(body.name || "").trim().slice(0, 100);
      if (!name || !body.recordId) return json({ error: "Enter your name to request this attachment." }, 400);
      const { data: record } = await admin.from("archive_records").select("id,owner_id,file_path").eq("id", body.recordId).maybeSingle();
      if (!record?.file_path) return json({ error: "This record has no viewable attachment." }, 404);
      const requestToken = crypto.randomUUID() + crypto.randomUUID();
      const { data, error } = await admin.from("record_access_requests").insert({
        record_id: record.id, owner_id: record.owner_id, visitor_name: name,
        request_token_hash: await hashToken(requestToken)
      }).select("id").single();
      if (error) throw error;
      return json({ requestId: data.id, requestToken });
    }
    if (body.action === "status") {
      const requestToken = String(body.requestToken || "");
      if (requestToken.length < 40) return json({ error: "Invalid request token." }, 400);
      const { data: request } = await admin.from("record_access_requests")
        .select("id,status,record_id,archive_records(title,file_path,mime_type)")
        .eq("request_token_hash", await hashToken(requestToken)).maybeSingle();
      if (!request) return json({ error: "Request not found." }, 404);
      if (request.status !== "approved") return json({ status: request.status });
      const record = Array.isArray(request.archive_records) ? request.archive_records[0] : request.archive_records;
      if (!record?.file_path) return json({ error: "Attachment unavailable." }, 404);
      const { data: signed, error } = await admin.storage.from("family-archive").createSignedUrl(record.file_path, 180);
      if (error) throw error;
      return json({ status: "approved", title: record.title, signedUrl: signed.signedUrl, mimeType: record.mime_type });
    }
    if (body.action === "inbox" || body.action === "decide") {
      const { data: authData, error: authError } = await userClient.auth.getUser(token);
      if (authError || authData.user?.id !== ownerId) return json({ error: "Owner sign-in required." }, 401);
      if (body.action === "inbox") {
        const { data, error } = await admin.from("record_access_requests")
          .select("id,visitor_name,status,created_at,record_id,archive_records(title)")
          .eq("owner_id", ownerId).order("created_at", { ascending: false }).limit(100);
        if (error) throw error;
        return json({ requests: data || [] });
      }
      if (!["approved", "denied"].includes(body.decision) || !body.requestId) return json({ error: "Invalid decision." }, 400);
      const { data, error } = await admin.from("record_access_requests")
        .update({ status: body.decision, decided_at: new Date().toISOString() })
        .eq("id", body.requestId).eq("owner_id", ownerId).eq("status", "pending").select("id").maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "Request not found or already decided." }, 404);
      return json({ success: true });
    }
    return json({ error: "Unknown action." }, 400);
  } catch (error) {
    return json({ error: error?.message || "Request failed." }, 500);
  }
});