export const GET = (req) => {
  return Response.json({
    env: {
      AUTH_URL: process.env.AUTH_URL,
      AUTH_SECRET: process.env.AUTH_SECRET ? "exists" : "missing",
      AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    },
    reqInfo: {
      url: req.url,
      method: req.method,
      headers: Object.fromEntries(req.headers.entries()),
    },
    message: "Debug endpoint"
  });
};
