import { corsJson, corsOptions } from "@/app/api/utils/cors";
import fs from "node:fs";
import path from "node:path";

const PING_VERSION = "2026-06-10-ping-v4";

export async function OPTIONS(request) {
  return corsOptions(request);
}

export async function GET(request) {
  const cwd = process.cwd();
  const { searchParams } = new URL(request.url);
  const checkFile = searchParams.get("file");
  
  const fileDiagnostics = {};
  if (checkFile) {
    try {
      const resolved = path.resolve(cwd, checkFile);
      fileDiagnostics.resolvedPath = resolved;
      fileDiagnostics.exists = fs.existsSync(resolved);
      if (fileDiagnostics.exists) {
        const stats = fs.statSync(resolved);
        fileDiagnostics.isDirectory = stats.isDirectory();
        fileDiagnostics.size = stats.size;
        fileDiagnostics.mode = stats.mode;
        
        // Try reading first 100 bytes
        if (!fileDiagnostics.isDirectory) {
          const fd = fs.openSync(resolved, 'r');
          const buffer = Buffer.alloc(100);
          fs.readSync(fd, buffer, 0, 100, 0);
          fs.closeSync(fd);
          fileDiagnostics.readSuccess = true;
          fileDiagnostics.headBytes = [...buffer];
        }
      }
    } catch (e) {
      fileDiagnostics.error = e.message;
    }
  }

  const listDir = (dirPath) => {
    try {
      const resolved = path.resolve(cwd, dirPath);
      if (!fs.existsSync(resolved)) {
        return { exists: false, error: "Path does not exist" };
      }
      const stats = fs.statSync(resolved);
      if (!stats.isDirectory()) {
        return { exists: true, isDirectory: false };
      }
      const files = fs.readdirSync(resolved);
      return {
        exists: true,
        isDirectory: true,
        count: files.length,
        sample: files.slice(0, 15),
      };
    } catch (e) {
      return { error: e.message };
    }
  };

  const metaEnv = {};
  try {
    for (const key in import.meta.env) {
      metaEnv[key] = import.meta.env[key];
    }
  } catch (e) {
    metaEnv.error = e.message;
  }

  return corsJson(request, {
    ok: true,
    version: PING_VERSION,
    now: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    cwd,
    metaEnv,
    fileDiagnostics,
    diagnostics: {
      buildClientImages: listDir("build/client/images"),
      buildClient: listDir("build/client"),
    },
    env: {
      INFOBIP_API_KEY: process.env.INFOBIP_API_KEY,
      INFOBIP_BASE_URL: process.env.INFOBIP_BASE_URL,
      INFOBIP_WHATSAPP_SENDER: process.env.INFOBIP_WHATSAPP_SENDER,
    }
  });
}
