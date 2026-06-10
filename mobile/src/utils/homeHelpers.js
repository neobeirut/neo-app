export function calculateDiscountedPrice(price, discountPercentage) {
  if (!discountPercentage || discountPercentage <= 0) {
    return null;
  }
  const discount = (parseFloat(price) * parseFloat(discountPercentage)) / 100;
  return parseFloat(price) - discount;
}

export function getProductsForBranch(
  productsData,
  productStatusData,
  selectedBranch,
) {
  if (!productsData?.products || !selectedBranch) return [];

  // Create a map of product statuses and prices from productStatusData
  const branchDataMap = new Map();
  if (productStatusData?.products) {
    productStatusData.products.forEach((product) => {
      branchDataMap.set(product.id, {
        status: product.status,
        price: product.price, // Effective price (branch override or base)
        base_price: product.base_price,
        branch_price: product.branch_price,
        inventory_applies: !!product.inventory_applies,
        quantity_on_hand:
          product.quantity_on_hand === undefined
            ? null
            : product.quantity_on_hand,
      });
    });
  }

  return productsData.products
    .map((product) => {
      const branchData = branchDataMap.get(product.id);
      const inventoryApplies =
        branchData?.inventory_applies ?? !!product.inventory_applies;

      const qoh =
        branchData?.quantity_on_hand === undefined
          ? null
          : branchData?.quantity_on_hand;

      return {
        ...product,
        status: branchData?.status || "Available",
        // Use branch-specific price if available, otherwise use product base price
        price: branchData?.price || product.price,
        base_price: branchData?.base_price || product.price,
        branch_price: branchData?.branch_price || null,
        inventory_applies: inventoryApplies,
        quantity_on_hand: inventoryApplies ? qoh : null,
      };
    })
    .filter((product) => product.status !== "Hide from Menu");
}

export function getDiscountedProducts(products, categories, selectedSection) {
  return products.filter((product) => {
    const productCategory = categories.find(
      (cat) => cat.id === product.category_id,
    );

    const matchesSection =
      !productCategory || productCategory.section === selectedSection;

    const hasDiscount =
      product.original_price &&
      parseFloat(product.original_price) > parseFloat(product.price);
    const isSpecial = product.is_special === true;

    return (
      matchesSection &&
      (hasDiscount || isSpecial) &&
      product.status === "Available"
    );
  });
}

export function getFeaturedProducts(products, categories, selectedSection) {
  return products.filter((product) => {
    const productCategory = categories.find(
      (cat) => cat.id === product.category_id,
    );

    const matchesSection =
      !productCategory || productCategory.section === selectedSection;

    const isFeatured = product.is_featured === true;

    return matchesSection && isFeatured && product.status === "Available";
  });
}

export function getFilteredProducts(
  products,
  categories,
  selectedSection,
  selectedCategory,
  searchQuery,
) {
  return products.filter((product) => {
    const productCategory = categories.find(
      (cat) => cat.id === product.category_id,
    );

    const matchesSection =
      !productCategory || productCategory.section === selectedSection;

    const matchesCategory =
      selectedCategory === "all" || product.category_id === selectedCategory;
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.description &&
        product.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSection && matchesCategory && matchesSearch;
  });
}

export function getStatusColor(status, colors) {
  switch (status) {
    case "Available":
      return colors.success || "#22c55e";
    case "Unavailable Today":
      return "#f59e0b";
    case "Unavailable Until Further Notice":
      return "#ef4444";
    default:
      return colors.textSecondary;
  }
}

export function sortProducts(products, sortType, branchDiscount = 0) {
  // First, separate "On Hold" items from available items
  const onHoldItems = products.filter(
    (p) => p.status === "Unavailable Until Further Notice",
  );
  const availableItems = products.filter(
    (p) => p.status !== "Unavailable Until Further Notice",
  );

  // Sort the available items based on the selected sort type
  let sortedAvailable = [...availableItems];

  switch (sortType) {
    case "price_low":
      sortedAvailable.sort((a, b) => {
        const priceA =
          calculateDiscountedPrice(a.price, branchDiscount) ||
          parseFloat(a.price);
        const priceB =
          calculateDiscountedPrice(b.price, branchDiscount) ||
          parseFloat(b.price);
        return priceA - priceB;
      });
      break;

    case "price_high":
      sortedAvailable.sort((a, b) => {
        const priceA =
          calculateDiscountedPrice(a.price, branchDiscount) ||
          parseFloat(a.price);
        const priceB =
          calculateDiscountedPrice(b.price, branchDiscount) ||
          parseFloat(b.price);
        return priceB - priceA;
      });
      break;

    case "title":
      sortedAvailable.sort((a, b) => a.name.localeCompare(b.name));
      break;

    case "default":
    default:
      // Sort by sort_order (admin-defined order)
      sortedAvailable.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      break;
  }

  // Sort on hold items by the same criteria
  let sortedOnHold = [...onHoldItems];
  switch (sortType) {
    case "price_low":
    case "price_high":
      // Keep the same sort order for consistency
      sortedOnHold = onHoldItems;
      break;
    case "title":
      sortedOnHold.sort((a, b) => a.name.localeCompare(b.name));
      break;
    default:
      sortedOnHold.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      break;
  }

  // Return available items first, then on hold items
  return [...sortedAvailable, ...sortedOnHold];
}
