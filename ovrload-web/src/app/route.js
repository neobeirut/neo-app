export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
    },
  });
}