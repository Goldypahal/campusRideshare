import type { Express } from "express";
import http from "node:http";
import { PassThrough } from "node:stream";

export interface TestResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  json: () => Promise<any>;
  text: () => Promise<string>;
}

export function createTestClient(app: Express) {
  return async function testFetch(
    urlPath: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: string | object;
    } = {}
  ): Promise<TestResponse> {
    const url = new URL(urlPath, "http://127.0.0.1");
    const method = (options.method || "GET").toUpperCase();
    const headers: Record<string, string> = {
      host: "127.0.0.1",
      ...(options.headers || {}),
    };

    let bodyBuffer: Buffer | null = null;
    if (options.body) {
      if (typeof options.body === "string") {
        bodyBuffer = Buffer.from(options.body, "utf-8");
      } else {
        bodyBuffer = Buffer.from(JSON.stringify(options.body), "utf-8");
        headers["content-type"] = headers["content-type"] || "application/json";
      }
      headers["content-length"] = String(bodyBuffer.length);
    }

    return new Promise<TestResponse>((resolve, reject) => {
      const socket = new PassThrough();
      const req = new http.IncomingMessage(socket as any);
      req.method = method;
      req.url = url.pathname + url.search;
      for (const [key, value] of Object.entries(headers)) {
        req.headers[key.toLowerCase()] = value;
      }

      const resSocket = new PassThrough();
      const res = new http.ServerResponse(req);
      res.assignSocket(resSocket as any);

      const chunks: Buffer[] = [];
      resSocket.on("data", (chunk: Buffer) => chunks.push(chunk));

      res.on("finish", () => {
        const fullRaw = Buffer.concat(chunks).toString("utf-8");
        // Separate HTTP headers from body
        const headerEndIndex = fullRaw.indexOf("\r\n\r\n");
        const bodyStr = headerEndIndex !== -1 ? fullRaw.slice(headerEndIndex + 4) : fullRaw;

        const resHeaders: Record<string, string> = {};
        for (const [k, v] of Object.entries(res.getHeaders())) {
          if (v !== undefined) {
            resHeaders[k.toLowerCase()] = Array.isArray(v) ? v.join(", ") : String(v);
          }
        }

        resolve({
          status: res.statusCode,
          statusText: res.statusMessage || "",
          headers: resHeaders,
          json: async () => (bodyStr.trim() ? JSON.parse(bodyStr) : null),
          text: async () => bodyStr,
        });
      });

      res.on("error", reject);

      // Invoke Express handle directly
      (app as any).handle(req, res);

      // Write body to socket
      if (bodyBuffer) {
        req.push(bodyBuffer);
      }
      req.push(null);
    });
  };
}
