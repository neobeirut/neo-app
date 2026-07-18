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
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';

import { getJson, postJson, getStoredAdminUser } from '@/utils/api';

const STATUS_OPTIONS = ['Available', 'Unavailable Today', 'Unavailable Until Further Notice', 'Hide from Menu'];

const STATUS_COLORS: Record<string, string> = {
  'Available': '#10b981',
  'Unavailable Today': '#f59e0b',
  'Unavailable Until Further Notice': '#ef4444',
  'Hide from Menu': '#64748b',
};

export default function ProductsScreen() {
  const queryClient = useQueryClient();
  const [adminUser, setAdminUser] = useState<any>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  // Track which product is showing the full status picker
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null);
  // Track local QOH draft edits
  const [qohDrafts, setQohDrafts] = useState<Record<number, string>>({});

  useEffect(() => {
    async function loadUser() {
      const user = await getStoredAdminUser();
      setAdminUser(user);
      setUserLoading(false);
    }
    loadUser();
  }, []);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-products', adminUser?.branch_id],
    queryFn: () => {
      if (!adminUser?.branch_id) return { products: [] };
      return getJson(`/api/product-branch-status?branch_id=${adminUser.branch_id}`);
    },
    enabled: !!adminUser?.branch_id,
  });

  const { data: fallbackCategories } = useQuery({
    queryKey: ['branch-categories', adminUser?.branch_id],
    queryFn: () => {
      if (!adminUser?.branch_id) return { categories: [] };
      return getJson(`/api/categories?branch_id=${adminUser.branch_id}`);
    },
    enabled: !!adminUser?.branch_id,
  });

  const categories = fallbackCategories?.categories || [];

  const toggleStatusMutation = useMutation({
    mutationFn: ({ productId, status, quantityOnHand }: { productId: number; status: string; quantityOnHand: number | null }) =>
      postJson('/api/product-branch-status', {
        product_id: productId,
        branch_id: adminUser?.branch_id,
        status,
        quantity_on_hand: quantityOnHand,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products', adminUser?.branch_id] });
      setExpandedProduct(null);
    },
    onError: (err: any) => {
      Alert.alert('Error', `Failed to update product status: ${err?.message || err}`);
    },
  });

  const qohMutation = useMutation({
    mutationFn: ({ productId, quantity, status }: { productId: number; quantity: number | null; status: string }) =>
      postJson('/api/product-branch-status', {
        product_id: productId,
        branch_id: adminUser?.branch_id,
        status,
        quantity_on_hand: quantity,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products', adminUser?.branch_id] });
    },
    onError: (err: any) => {
      Alert.alert('Error', `Failed to update quantity: ${err?.message || err}`);
    },
  });

  const handleStatusChange = (item: any, newStatus: string) => {
    toggleStatusMutation.mutate({
      productId: item.id,
      status: newStatus,
      quantityOnHand: item.quantity_on_hand ?? null,
    });
  };

  const handleQuickToggle = (item: any) => {
    const nextStatus = item.status === 'Available' ? 'Unavailable Today' : 'Available';
    handleStatusChange(item, nextStatus);
  };

  const handleQohBlur = (item: any) => {
    const draft = qohDrafts[item.id];
    if (draft === undefined) return; // not edited
    const parsed = draft === '' ? null : Number(draft);
    if (draft !== '' && isNaN(Number(draft))) return; // invalid
    qohMutation.mutate({ productId: item.id, quantity: parsed, status: item.status });
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
    const statusColor = STATUS_COLORS[item.status] || '#64748b';
    const isExpanded = expandedProduct === item.id;
    const qohValue = qohDrafts[item.id] !== undefined
      ? qohDrafts[item.id]
      : item.quantity_on_hand === null || item.quantity_on_hand === undefined
        ? ''
        : String(item.quantity_on_hand);

    return (
      <View style={styles.card}>
        {/* Top row: image + info + toggle */}
        <View style={styles.cardRow}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.productImage} />
          ) : (
            <View style={styles.productImagePlaceholder}>
              <Ionicons name="fast-food-outline" size={24} color="#64748b" />
            </View>
          )}

          <View style={styles.cardInfo}>
            <Text style={styles.productName}>{item.name}</Text>
            {/* Status badge */}
            <TouchableOpacity
              style={[styles.statusBadge, { borderColor: statusColor }]}
              onPress={() => setExpandedProduct(isExpanded ? null : item.id)}
            >
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusBadgeText, { color: statusColor }]} numberOfLines={1}>
                {item.status}
              </Text>
              <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={12} color={statusColor} />
            </TouchableOpacity>

            {/* QOH row — only for inventory-tracked products */}
            {item.inventory_applies && (
              <View style={styles.qohRow}>
                <Ionicons name="layers-outline" size={13} color="#64748b" />
                <Text style={styles.qohLabel}>QOH:</Text>
                <TextInput
                  style={styles.qohInput}
                  value={qohValue}
                  onChangeText={(t) => setQohDrafts(prev => ({ ...prev, [item.id]: t }))}
                  onBlur={() => handleQohBlur(item)}
                  keyboardType="number-pad"
                  placeholder="—"
                  placeholderTextColor="#475569"
                  selectTextOnFocus
                />
              </View>
            )}
          </View>

          {/* Quick toggle switch */}
          <View style={styles.toggleContainer}>
            <Switch
              value={isAvailable}
              onValueChange={() => handleQuickToggle(item)}
              trackColor={{ false: '#334155', true: '#10b981' }}
              thumbColor={isAvailable ? '#ffffff' : '#94a3b8'}
              disabled={toggleStatusMutation.isPending}
            />

          </View>
        </View>

        {/* Expanded status picker */}
        {isExpanded && (
          <View style={styles.statusPicker}>
            {STATUS_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.statusOption, item.status === opt && styles.statusOptionActive]}
                onPress={() => handleStatusChange(item, opt)}
                disabled={toggleStatusMutation.isPending}
              >
                <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[opt] }]} />
                <Text style={[styles.statusOptionText, item.status === opt && styles.statusOptionTextActive]}>
                  {opt}
                </Text>
                {item.status === opt && (
                  <Ionicons name="checkmark" size={16} color="#3b82f6" style={{ marginLeft: 'auto' }} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  const filteredProducts = getFilteredProducts();

  if (userLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (!adminUser?.branch_id) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={64} color="#f59e0b" />
        <Text style={styles.emptyText}>No branch assigned to your account.</Text>
        <Text style={[styles.emptyText, { fontSize: 13, marginTop: 4 }]}>Please contact your administrator.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search */}
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

      {/* Category filter */}
      {categories.length > 0 && (
        <View style={styles.categoriesWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesContainer}>
            <TouchableOpacity
              style={[styles.categoryBtn, selectedCategory === null && styles.categoryBtnActive]}
              onPress={() => setSelectedCategory(null)}
            >
              <Text style={[styles.categoryBtnText, selectedCategory === null && styles.categoryBtnTextActive]}>All</Text>
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
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  searchBarContainer: { padding: 16, backgroundColor: '#1e293b' },
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
  searchInput: { flex: 1, color: '#ffffff', fontSize: 16, marginLeft: 8 },
  categoriesWrapper: {
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 12,
  },
  categoriesContainer: { paddingHorizontal: 16, gap: 8 },
  categoryBtn: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  categoryBtnActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  categoryBtnText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  categoryBtnTextActive: { color: '#ffffff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { color: '#94a3b8', fontSize: 16, marginTop: 16, textAlign: 'center' },
  listContainer: { padding: 12, paddingBottom: 40, gap: 10 },

  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  productImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#0f172a',
    flexShrink: 0,
  },
  productImagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    flexShrink: 0,
  },
  cardInfo: { flex: 1, gap: 6 },
  productName: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusBadgeText: { fontSize: 11, fontWeight: '600', flexShrink: 1 },
  qohRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  qohLabel: { color: '#64748b', fontSize: 12 },
  qohInput: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    minWidth: 40,
    paddingVertical: 1,
    paddingHorizontal: 4,
  },
  toggleContainer: { alignItems: 'center', gap: 3, paddingLeft: 4 },
  toggleLabel: { fontSize: 10, fontWeight: '700' },

  statusPicker: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingVertical: 4,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  statusOptionActive: { backgroundColor: '#1e3a5f' },
  statusOptionText: { color: '#94a3b8', fontSize: 13, flex: 1 },
  statusOptionTextActive: { color: '#ffffff', fontWeight: '600' },
});
