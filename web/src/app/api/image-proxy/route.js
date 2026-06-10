import { corsHeaders, corsOptions } from "@/app/api/utils/cors";

function isHttpUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (e) {
    return false;
  }
}

function sniffImageContentType(bytes) {
  try {
    if (!bytes || bytes.length < 12) {
      return null;
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    const isPng =
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47;
    if (isPng) return "image/png";

    // JPEG: FF D8 FF
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (isJpeg) return "image/jpeg";

    // GIF: 47 49 46 38
    const isGif =
      bytes[0] === 0x47 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x38;
    if (isGif) return "image/gif";

    // WEBP: "RIFF"...."WEBP"
    const isRiff =
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46;
    const isWebp =
      isRiff &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50;
    if (isWebp) return "image/webp";

    // SVG: starts with <svg / xml (best-effort)
    const asText = new TextDecoder("utf-8", { fatal: false }).decode(
      bytes.slice(0, 256),
    );
    const trimmed = asText.trimStart().toLowerCase();
    const looksLikeSvg =
      trimmed.startsWith("<svg") ||
      trimmed.startsWith("<?xml") ||
      trimmed.includes("<svg");
    if (looksLikeSvg) return "image/svg+xml";

    return null;
  } catch (e) {
    return null;
  }
}

export async function OPTIONS(request) {
  return corsOptions(request);
}

export async function GET(request) {
  const headers = corsHeaders(request);

  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");

    if (!url) {
      return new Response("Missing url", { status: 400, headers });
    }

    if (!isHttpUrl(url)) {
      return new Response("Invalid url", { status: 400, headers });
    }

    const origin = new URL(request.url).origin;

    // Some CDNs (including raw.createusercontent.com) block non-browser UAs.
    // Use a normal browser UA + typical accept headers.
    const upstream = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: origin,
      },
    });

    if (!upstream.ok) {
      return new Response(
        `Upstream error: ${upstream.status} ${upstream.statusText}`,
        {
          status: 502,
          headers: {
            ...headers,
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const upstreamContentType =
      upstream.headers.get("content-type") || "application/octet-stream";

    // If the upstream sent back HTML, it is usually a CDN block page. In that case,
    // return a clear error instead of HTML pretending to be an image.
    const isProbablyHtml = upstreamContentType
      .toLowerCase()
      .includes("text/html");
    if (isProbablyHtml) {
      return new Response(
        `Upstream returned non-image content-type: ${upstreamContentType}`,
        {
          status: 502,
          headers: {
            ...headers,
            "Cache-Control": "no-store",
          },
        },
      );
    }

    // Important: some sources return application/octet-stream even for images.
    // For <img> tags in modern browsers, having the correct image/* content-type matters.
    const arrayBuffer = await upstream.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const sniffedType = sniffImageContentType(bytes);
    const isAlreadyImage = upstreamContentType
      .toLowerCase()
      .startsWith("image/");
    const finalContentType = isAlreadyImage
      ? upstreamContentType
      : sniffedType || upstreamContentType;

    const responseHeaders = {
      ...headers,
      "Content-Type": finalContentType,
      "Content-Disposition": "inline",
      // Allow the image to be used by pages on our domain (and embedded in general).
      "Cross-Origin-Resource-Policy": "cross-origin",
      // We already send a cache-busting "v" param from /api/logo.
      // Keep cache short and avoid serving stale content in production.
      "Cache-Control": "public, max-age=60",
    };

    return new Response(bytes, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("/api/image-proxy error", error);
    return new Response("Image proxy failed", {
      status: 500,
      headers: {
        ...headers,
        "Cache-Control": "no-store",
      },
    });
  }
}
