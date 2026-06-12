import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  Image,
  ScrollView,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';

import { getJson, postJson, getStoredAdminUser } from '@/utils/api';

export default function ProductsScreen() {
  const queryClient = useQueryClient();
  const [adminUser, setAdminUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  // Load admin user profile
  useEffect(() => {
    async function loadUser() {
      const user = await getStoredAdminUser();
      setAdminUser(user);
    }
    loadUser();
  }, []);

  // Fetch branch products overrides
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-products', adminUser?.branch_id],
    queryFn: () => {
      if (!adminUser?.branch_id) return { products: [] };
      return getJson(`/api/product-branch-status?branch_id=${adminUser.branch_id}`);
    },
    enabled: !!adminUser?.branch_id,
  });

  // Fetch categories (to show category filters)
  const { data: categoriesData } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => getJson('/api/branches/route').catch(() => getJson('/api/orders/admin').then(() => ({ categories: [] }))), // fallback
    // Wait, let's check how to fetch categories. In customer app we used `/api/categories?branch_id=...`
    // Let's fetch categories for this branch
    enabled: !!adminUser?.branch_id,
  });

  // Fallback to fetch categories dynamically
  const { data: fallbackCategories } = useQuery({
    queryKey: ['branch-categories', adminUser?.branch_id],
    queryFn: () => {
      if (!adminUser?.branch_id) return { categories: [] };
      return getJson(`/api/categories?branch_id=${adminUser.branch_id}`);
    },
    enabled: !!adminUser?.branch_id,
  });

  const categories = fallbackCategories?.categories || categoriesData?.categories || [];

  // Mutation to toggle product availability
  const toggleStatusMutation = useMutation({
    mutationFn: ({ productId, status }: { productId: number; status: string }) =>
      postJson('/api/product-branch-status', {
        product_id: productId,
        branch_id: adminUser?.branch_id,
        status: status,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products', adminUser?.branch_id] });
    },
    onError: (err: any) => {
      alert(`Failed to update product status: ${err?.message || err}`);
    },
  });

  const handleToggleProduct = (productId: number, currentStatus: string) => {
    const nextStatus = currentStatus === 'Available' ? 'Unavailable Today' : 'Available';
    toggleStatusMutation.mutate({ productId, status: nextStatus });
  };

  const getFilteredProducts = () => {
    if (!data?.products) return [];

    let list = data.products;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p: any) => p.name?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
    }

    if (selectedCategory !== null) {
      list = list.filter((p: any) => p.category_id === selectedCategory);
    }

    return list;
  };

  const renderProductCard = ({ item }: { item: any }) => {
    const isAvailable = item.status === 'Available';
    
    return (
      <View style={styles.card}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.productImage} />
        ) : (
          <View style={styles.productImagePlaceholder}>
            <Ionicons name="fast-food-outline" size={24} color="#64748b" />
          </View>
        )}

        <View style={styles.cardInfo}>
          <Text style={styles.productName}>{item.name}</Text>
          {item.description ? (
            <Text style={styles.productDesc} numberOfLines={2}>{item.description}</Text>
          ) : null}
          <Text style={styles.productPrice}>${Number(item.price).toFixed(2)}</Text>
        </View>

        <View style={styles.toggleContainer}>
          <Text style={[styles.toggleLabel, isAvailable ? styles.textAvailable : styles.textUnavailable]}>
            {isAvailable ? 'In Stock' : 'Out of Stock'}
          </Text>
          <Switch
            value={isAvailable}
            onValueChange={() => handleToggleProduct(item.id, item.status)}
            trackColor={{ false: '#334155', true: '#10b981' }}
            thumbColor={isAvailable ? '#ffffff' : '#94a3b8'}
          />
        </View>
      </View>
    );
  };

  const filteredProducts = getFilteredProducts();

  return (
    <View style={styles.container}>
      {/* Search and Filter Section */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={20} color="#64748b" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search products..."
            placeholderTextColor="#64748b"
            style={styles.searchInput}
            autoCapitalize="none"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle-outline" size={20} color="#64748b" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Category Scroll Filter */}
      {categories.length > 0 && (
        <View style={styles.categoriesWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesContainer}>
            <TouchableOpacity
              style={[styles.categoryBtn, selectedCategory === null && styles.categoryBtnActive]}
              onPress={() => setSelectedCategory(null)}
            >
              <Text style={[styles.categoryBtnText, selectedCategory === null && styles.categoryBtnTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            
            {categories.map((cat: any) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryBtn, selectedCategory === cat.id && styles.categoryBtnActive]}
                onPress={() => setSelectedCategory(cat.id)}
              >
                <Text style={[styles.categoryBtnText, selectedCategory === cat.id && styles.categoryBtnTextActive]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Loading state */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : filteredProducts.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="fast-food-outline" size={64} color="#334155" />
          <Text style={styles.emptyText}>No products found</Text>
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          renderItem={renderProductCard}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContainer}
          onRefresh={refetch}
          refreshing={isFetching}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  searchBarContainer: {
    padding: 16,
    backgroundColor: '#1e293b',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
    marginLeft: 8,
  },
  categoriesWrapper: {
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 12,
  },
  categoriesContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryBtn: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  categoryBtnActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  categoryBtnText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  categoryBtnTextActive: {
    color: '#ffffff',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 16,
    marginTop: 16,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    alignItems: 'center',
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#0f172a',
  },
  productImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  productName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  productDesc: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  productPrice: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 4,
  },
  toggleContainer: {
    alignItems: 'center',
    gap: 4,
    minWidth: 70,
  },
  toggleLabel: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  textAvailable: {
    color: '#10b981',
  },
  textUnavailable: {
    color: '#ef4444',
  },
});
