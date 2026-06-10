"use client";

import { useState, useEffect } from "react";
import useUser from "@/utils/useUser";

export default function ShopPage() {
  const { user, loading: userLoading } = useUser();
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [branches, setBranches] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [cartCount, setCartCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showBranchModal, setShowBranchModal] = useState(false);

  // Load branch from localStorage on mount
  useEffect(() => {
    const savedBranch = localStorage.getItem("selectedBranch");
    if (savedBranch) {
      try {
        const branch = JSON.parse(savedBranch);
        setSelectedBranch(branch);
      } catch (e) {
        console.error("Failed to parse saved branch:", e);
      }
    }
    fetchBranches();
  }, []);

  // Fetch data when branch changes
  useEffect(() => {
    if (selectedBranch) {
      fetchCategories();
      fetchProducts();
      fetchCart();
    }
  }, [selectedBranch, selectedCategory]);

  const fetchBranches = async () => {
    try {
      const response = await fetch("/api/branches?is_active=true");
      const data = await response.json();
      setBranches(data.branches || []);

      // If no branch selected, show modal
      if (!selectedBranch && data.branches?.length > 0) {
        setShowBranchModal(true);
      }
    } catch (error) {
      console.error("Error fetching branches:", error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch(
        `/api/categories${selectedBranch ? `?branch_id=${selectedBranch.id}` : ""}`,
      );
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedBranch) params.append("branch_id", selectedBranch.id);
      if (selectedCategory) params.append("category_id", selectedCategory.id);
      params.append("available_only", "true");

      const response = await fetch(`/api/products?${params}`);
      const data = await response.json();
      setProducts(data.products || []);
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCart = async () => {
    if (!selectedBranch) return;

    try {
      const response = await fetch(`/api/cart?branch_id=${selectedBranch.id}`);
      const data = await response.json();
      const count =
        data.cart_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
      setCartCount(count);
    } catch (error) {
      console.error("Error fetching cart:", error);
    }
  };

  const handleBranchSelect = (branch) => {
    setSelectedBranch(branch);
    localStorage.setItem("selectedBranch", JSON.stringify(branch));
    setShowBranchModal(false);
  };

  const handleAddToCart = async (product) => {
    if (!user) {
      if (confirm("You need to sign in to add items to cart. Sign in now?")) {
        window.location.href =
          "/account/signin?callbackUrl=" +
          encodeURIComponent(window.location.pathname);
      }
      return;
    }

    if (!selectedBranch) {
      alert("Please select a branch first");
      return;
    }

    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // ✅ Include cookies for JWT auth
        body: JSON.stringify({
          product_id: product.id,
          branch_id: selectedBranch.id,
          quantity: 1,
        }),
      });

      if (response.ok) {
        fetchCart();
        alert("Added to cart!");
      } else {
        const error = await response.json();
        alert(error.error || "Failed to add to cart");
      }
    } catch (error) {
      console.error("Error adding to cart:", error);
      alert("Failed to add to cart");
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header with Overlapping Floating Logo */}
      <header className="sticky top-0 z-50 bg-white border-b border-[#E0E0E0] overflow-visible">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative overflow-visible">
          <div className="flex items-center justify-between h-24">
            {/* Overlapping Logo - positioned to float and overlap content below */}
            <a
              href="/"
              className="absolute -bottom-8 left-4 sm:left-6 lg:left-8 z-[60] hover:opacity-80 transition-opacity duration-300"
            >
              <img
                src="https://ucarecdn.com/4f78cc02-ceb3-4858-bff8-6b70095dc4b8/-/format/auto/"
                alt="NEO Beirut"
                className="h-24 w-auto rounded-lg"
              />
            </a>

            {/* Spacer for logo */}
            <div className="w-32"></div>

            {/* Branch Selector and Cart */}
            <div className="flex items-center gap-4 ml-auto">
              <button
                onClick={() => setShowBranchModal(true)}
                className="hidden md:flex items-center gap-2 px-4 py-2 border-2 border-[#235b4e] text-[#235b4e] rounded-lg hover:bg-[#F0F5F3] transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span className="font-medium">
                  {selectedBranch ? selectedBranch.name : "Select Branch"}
                </span>
              </button>

              {/* Cart */}
              <a
                href="/shop/cart"
                className="relative p-3 bg-[#235b4e] text-white rounded-lg hover:bg-[#2B6B5C] transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#B8935A] text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Category Tabs - adjusted for overlapping logo */}
      {selectedBranch && categories.length > 0 && (
        <div className="sticky top-24 z-40 bg-white border-b border-[#E0E0E0] pt-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex gap-2 overflow-x-auto py-4 scrollbar-hide">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-6 py-2 rounded-full font-medium whitespace-nowrap transition-colors ${
                  !selectedCategory
                    ? "bg-[#235b4e] text-white"
                    : "bg-[#F9F9F9] text-[#1A1A1A] hover:bg-[#F0F5F3]"
                }`}
              >
                All
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-6 py-2 rounded-full font-medium whitespace-nowrap transition-colors ${
                    selectedCategory?.id === category.id
                      ? "bg-[#235b4e] text-white"
                      : "bg-[#F9F9F9] text-[#1A1A1A] hover:bg-[#F0F5F3]"
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content - padding top to clear overlapping logo */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-12">
        {!selectedBranch ? (
          <div className="text-center py-20">
            <svg
              className="w-24 h-24 mx-auto text-[#E0E0E0] mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <h2 className="text-2xl font-bold text-[#1A1A1A] mb-2">
              Select a Branch
            </h2>
            <p className="text-[#666666] mb-6">
              Choose your preferred branch to start shopping
            </p>
            <button
              onClick={() => setShowBranchModal(true)}
              className="bg-[#235b4e] text-white px-8 py-3 rounded-lg hover:bg-[#2B6B5C] transition-colors font-medium"
            >
              Select Branch
            </button>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-[#F9F9F9] aspect-square rounded-xl mb-4"></div>
                <div className="h-4 bg-[#F9F9F9] rounded mb-2"></div>
                <div className="h-4 bg-[#F9F9F9] rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <svg
              className="w-24 h-24 mx-auto text-[#E0E0E0] mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
            <h2 className="text-2xl font-bold text-[#1A1A1A] mb-2">
              No Products Found
            </h2>
            <p className="text-[#666666]">Try selecting a different category</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <div
                key={product.id}
                className="group bg-white border border-[#E0E0E0] rounded-xl overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer"
                onClick={() => setSelectedProduct(product)}
              >
                {/* Product Image */}
                <div className="aspect-square bg-[#F9F9F9] relative overflow-hidden">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg
                        className="w-20 h-20 text-[#E0E0E0]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                  )}
                  {product.is_special && (
                    <div className="absolute top-3 left-3 bg-[#B8935A] text-white px-3 py-1 rounded-full text-xs font-bold">
                      Special
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-[#1A1A1A] mb-1 line-clamp-2 group-hover:text-[#235b4e] transition-colors">
                    {product.name}
                  </h3>
                  {product.description && (
                    <p className="text-sm text-[#666666] mb-3 line-clamp-2">
                      {product.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xl font-bold text-[#235b4e]">
                        ${product.price}
                      </span>
                      {product.original_price &&
                        product.original_price > product.price && (
                          <span className="text-sm text-[#999999] line-through ml-2">
                            ${product.original_price}
                          </span>
                        )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToCart(product);
                      }}
                      className="p-2 bg-[#235b4e] text-white rounded-lg hover:bg-[#2B6B5C] transition-colors"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Branch Selection Modal */}
      {showBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-[#E0E0E0]">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-[#235b4e]">
                  Select Branch
                </h2>
                {selectedBranch && (
                  <button
                    onClick={() => setShowBranchModal(false)}
                    className="p-2 hover:bg-[#F9F9F9] rounded-lg transition-colors"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            <div className="p-6">
              <div className="grid gap-4">
                {branches.map((branch) => (
                  <button
                    key={branch.id}
                    onClick={() => handleBranchSelect(branch)}
                    className={`text-left p-6 rounded-xl border-2 transition-all ${
                      selectedBranch?.id === branch.id
                        ? "border-[#235b4e] bg-[#F0F5F3]"
                        : "border-[#E0E0E0] hover:border-[#235b4e] hover:bg-[#F9F9F9]"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {branch.image_url && (
                        <img
                          src={branch.image_url}
                          alt={branch.name}
                          className="w-20 h-20 rounded-lg object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <h3 className="font-bold text-lg text-[#1A1A1A] mb-1">
                          {branch.name}
                        </h3>
                        {branch.address && (
                          <p className="text-[#666666] text-sm mb-2">
                            {branch.address}
                          </p>
                        )}
                        {branch.phone && (
                          <p className="text-[#666666] text-sm">
                            {branch.phone}
                          </p>
                        )}
                      </div>
                      {selectedBranch?.id === branch.id && (
                        <svg
                          className="w-6 h-6 text-[#235b4e]"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-[#E0E0E0] p-6 flex items-center justify-between z-10">
              <h2 className="text-2xl font-bold text-[#235b4e]">
                {selectedProduct.name}
              </h2>
              <button
                onClick={() => setSelectedProduct(null)}
                className="p-2 hover:bg-[#F9F9F9] rounded-lg transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="p-6">
              {selectedProduct.image_url && (
                <img
                  src={selectedProduct.image_url}
                  alt={selectedProduct.name}
                  className="w-full h-64 object-cover rounded-xl mb-6"
                />
              )}
              <div className="mb-6">
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-3xl font-bold text-[#235b4e]">
                    ${selectedProduct.price}
                  </span>
                  {selectedProduct.original_price &&
                    selectedProduct.original_price > selectedProduct.price && (
                      <span className="text-xl text-[#999999] line-through">
                        ${selectedProduct.original_price}
                      </span>
                    )}
                </div>
                {selectedProduct.description && (
                  <p className="text-[#666666] mb-4">
                    {selectedProduct.description}
                  </p>
                )}
                {selectedProduct.ingredients && (
                  <div className="mb-4">
                    <h3 className="font-semibold text-[#1A1A1A] mb-2">
                      Ingredients
                    </h3>
                    <p className="text-[#666666]">
                      {selectedProduct.ingredients}
                    </p>
                  </div>
                )}
                {selectedProduct.nutritional_info && (
                  <div className="mb-4">
                    <h3 className="font-semibold text-[#1A1A1A] mb-2">
                      Nutritional Info
                    </h3>
                    <p className="text-[#666666]">
                      {selectedProduct.nutritional_info}
                    </p>
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  handleAddToCart(selectedProduct);
                  setSelectedProduct(null);
                }}
                className="w-full bg-[#235b4e] text-white px-6 py-4 rounded-lg hover:bg-[#2B6B5C] transition-colors font-medium text-lg"
              >
                Add to Cart - ${selectedProduct.price}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
