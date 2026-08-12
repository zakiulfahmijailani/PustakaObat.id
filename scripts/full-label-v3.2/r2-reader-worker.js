/* eslint-disable import/no-anonymous-default-export */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const authorization = request.headers.get("Authorization") || "";
    if (authorization !== `Bearer ${env.READER_TOKEN}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    if (!url.pathname.startsWith("/objects/")) {
      return new Response("Not Found", { status: 404 });
    }

    const key = decodeURIComponent(url.pathname.slice("/objects/".length));

    const isSourceShard =
      /^label_sections_shard_[0-9]{2}\.jsonl\.gz$/.test(key);

    const isTranslationOverlay =
      /^pustakaobat\/full-label\/v3\.2\/translations\/[a-f0-9]{64}\/[a-f0-9]{3}\.jsonl\.gz$/.test(key);

    const isMaterializedLabel =
      /^pustakaobat\/full-label\/v3\.2\/labels\/[a-f0-9]{2}\/[a-f0-9]{64}\.json\.gz$/.test(key);

    const isBilingualLabel =
      /^pustakaobat\/full-label\/v3\.2\/bilingual\/[a-f0-9]{64}\/[a-f0-9]{2}\/[a-f0-9]{64}\.json\.gz$/.test(key);

    if (
      !isSourceShard &&
      !isTranslationOverlay &&
      !isMaterializedLabel &&
      !isBilingualLabel
    ) {
      return new Response("Invalid object key", { status: 400 });
    }

    const object = request.method === "HEAD"
      ? await env.BUCKET.head(key)
      : await env.BUCKET.get(key);

    if (!object) {
      return new Response("Object Not Found", { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("content-type", "application/gzip");
    headers.set("cache-control", "private, max-age=300");

    return new Response(
      request.method === "HEAD" ? null : object.body,
      { headers },
    );
  },
};
