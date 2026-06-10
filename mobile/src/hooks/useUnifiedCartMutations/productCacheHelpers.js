export const getBestCachedProduct = (queryClient, productId, branchId) => {
  const pid = Number(productId);

  // Product detail query (when user is on product detail screen)
  const detailA = queryClient.getQueryData(["product", String(pid), branchId]);
  const detailB = queryClient.getQueryData(["product", pid, branchId]);
  const detail = detailA || detailB;
  if (detail) return detail;

  // Products list query (home/menu)
  const productsData = queryClient.getQueryData(["products"]);
  const list = productsData?.products || [];
  return list.find((p) => Number(p.id) === pid) || null;
};

export const getBestCachedProductAddons = (queryClient, productId) => {
  const pid = String(Number(productId));

  const keyA = ["product-addons", pid];
  const keyB = ["product-addons", Number(productId)];

  const a = queryClient.getQueryData(keyA);
  const b = queryClient.getQueryData(keyB);

  const list = a || b;
  return Array.isArray(list) ? list : [];
};
