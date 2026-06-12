import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  Linking,
  Platform,
  Vibration,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { useOrdersStore } from '@/store/ordersStore';
import { useAudioPlayer } from 'expo-audio';
import Ionicons from '@expo/vector-icons/Ionicons';

import { getJson, patchJson, getStoredAdminUser } from '@/utils/api';

export default function OrdersScreen() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'new' | 'progress' | 'ready' | 'history'>('new');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [adminUser, setAdminUser] = useState<any>(null);
  const [knownOrderIds, setKnownOrderIds] = useState<string[]>([]);

  // Setup sound alert player
  let player: any = null;
  try {
    player = useAudioPlayer('https://assets.mixkit.co/active_storage/sfx/2869/2869-600.wav');
  } catch (e) {
    console.warn('Failed to initialize audio player:', e);
  }

  const triggerAlert = () => {
    try {
      Vibration.vibrate([0, 500, 250, 500, 250, 500]);
      if (player) {
        player.play();
      }
    } catch (e) {
      console.warn('Failed to trigger alert:', e);
    }
  };

  // Load admin user profile
  useEffect(() => {
    async function loadUser() {
      const user = await getStoredAdminUser();
      setAdminUser(user);
    }
    loadUser();
  }, []);

  // Fetch branch orders (automatically filters by branch_id on backend if not HQ admin)
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: () => getJson('/api/orders/admin'),
    refetchInterval: 8000, // Poll every 8 seconds
  });

  // Detect new orders and trigger sound/vibration
  useEffect(() => {
    if (data?.orders) {
      const allOrders = data.orders;
      const currentIds = allOrders.map((o: any) => String(o.id));

      // Filter to pending (new) orders
      const pendingOrders = allOrders.filter((o: any) => o.status === 'pending');
      const pendingIds = pendingOrders.map((o: any) => String(o.id));

      // Trigger alert if there is a new pending order we haven't seen yet
      const hasNewPending = pendingIds.some((id: string) => !knownOrderIds.includes(id));
      if (knownOrderIds.length > 0 && hasNewPending) {
        console.log('[Orders] New order detected, triggering alert!');
        triggerAlert();
      }

      // Update known order IDs
      setKnownOrderIds(currentIds);
    }
  }, [data]);

  // Mutation to update order status
  const updateStatusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: number; status: string }) =>
      patchJson(`/api/orders/admin/${orderId}`, { status }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      // Update local selected order state if modal is open
      if (selectedOrder) {
        setSelectedOrder((prev: any) => (prev?.id === res.order_id || prev?.id === selectedOrder.id ? { ...prev, status: res.status } : prev));
      }
      // Re-fetch immediately
      refetch();
    },
    onError: (err: any) => {
      alert(`Failed to update status: ${err?.message || err}`);
    },
  });

  const handleUpdateStatus = (orderId: number, status: string) => {
    updateStatusMutation.mutate({ orderId, status });
  };

  // Filter orders by active tab
  const getFilteredOrders = () => {
    if (!data?.orders) return [];
    
    return data.orders.filter((order: any) => {
      switch (activeTab) {
        case 'new':
          return order.status === 'pending';
        case 'progress':
          return ['accepted', 'preparing'].includes(order.status);
        case 'ready':
          return ['ready', 'out_for_delivery'].includes(order.status);
        case 'history':
          return ['completed', 'cancelled'].includes(order.status);
        default:
          return false;
      }
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#f59e0b'; // Amber
      case 'accepted':
      case 'preparing':
        return '#3b82f6'; // Blue
      case 'ready':
      case 'out_for_delivery':
        return '#10b981'; // Green
      case 'completed':
        return '#64748b'; // Slate
      case 'cancelled':
        return '#ef4444'; // Red
      default:
        return '#94a3b8';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'New';
      case 'accepted': return 'Accepted';
      case 'preparing': return 'Preparing';
      case 'ready': return 'Ready';
      case 'out_for_delivery': return 'Out for Delivery';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  const makeCall = (phone: string) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`);
  };

  const openMap = (address: string) => {
    if (!address) return;
    const url = Platform.select({
      ios: `maps:0,0?q=${encodeURIComponent(address)}`,
      android: `geo:0,0?q=${encodeURIComponent(address)}`,
      default: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
    });
    Linking.openURL(url);
  };

  const renderOrderCard = ({ item }: { item: any }) => {
    const statusColor = getStatusColor(item.status);
    const itemsCount = item.items?.reduce((sum: number, i: any) => sum + i.quantity, 0) || 0;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => setSelectedOrder(item)}
      >
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.orderNumber}>Order #{item.id}</Text>
            <Text style={styles.orderTime}>
              {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '15', borderColor: statusColor }]}>
            <Text style={[styles.statusBadgeText, { color: statusColor }]}>
              {getStatusLabel(item.status)}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={16} color="#94a3b8" />
            <Text style={styles.infoText}>{item.customer_name || 'Walk-in Customer'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name={item.order_type === 'delivery' ? 'bicycle-outline' : 'storefront-outline'} size={16} color="#94a3b8" />
            <Text style={styles.infoText}>
              {item.order_type === 'delivery' ? 'Delivery' : 'Pickup'} • {itemsCount} Item{itemsCount !== 1 ? 's' : ''}
            </Text>
          </View>
          {item.special_instructions ? (
            <View style={styles.instructionRow}>
              <Text style={styles.instructionLabel}>Note:</Text>
              <Text style={styles.instructionText} numberOfLines={1}>
                {item.special_instructions}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.orderTotal}>${Number(item.total_amount).toFixed(2)}</Text>
          
          <View style={styles.actionRow}>
            {item.status === 'pending' && (
              <TouchableOpacity
                style={[styles.smallButton, { backgroundColor: '#3b82f6' }]}
                onPress={() => handleUpdateStatus(item.id, 'preparing')}
              >
                <Text style={styles.smallButtonText}>Accept</Text>
              </TouchableOpacity>
            )}
            {item.status === 'preparing' && (
              <TouchableOpacity
                style={[styles.smallButton, { backgroundColor: '#10b981' }]}
                onPress={() => handleUpdateStatus(item.id, 'ready')}
              >
                <Text style={styles.smallButtonText}>Mark Ready</Text>
              </TouchableOpacity>
            )}
            {item.status === 'ready' && (
              <TouchableOpacity
                style={[styles.smallButton, { backgroundColor: '#64748b' }]}
                onPress={() => handleUpdateStatus(item.id, 'completed')}
              >
                <Text style={styles.smallButtonText}>Complete</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const filteredOrders = getFilteredOrders();

  return (
    <View style={styles.container}>
      {/* Header Info */}
      <View style={styles.header}>
        <View>
          <Text style={styles.branchName}>{adminUser?.branch_name || 'All Branches'}</Text>
          <Text style={styles.managerRole}>Manager: {adminUser?.name || 'Staff'}</Text>
        </View>
        {isFetching && (
          <ActivityIndicator size="small" color="#3b82f6" />
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {(['new', 'progress', 'ready', 'history'] as const).map((tab) => {
          const tabOrdersCount = data?.orders ? data.orders.filter((order: any) => {
            if (tab === 'new') return order.status === 'pending';
            if (tab === 'progress') return ['accepted', 'preparing'].includes(order.status);
            if (tab === 'ready') return ['ready', 'out_for_delivery'].includes(order.status);
            if (tab === 'history') return ['completed', 'cancelled'].includes(order.status);
            return false;
          }).length : 0;

          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab.toUpperCase()}
              </Text>
              {tabOrdersCount > 0 && (
                <View style={[styles.tabBadge, activeTab === tab ? styles.tabBadgeActive : styles.tabBadgeInactive]}>
                  <Text style={styles.tabBadgeText}>{tabOrdersCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : filteredOrders.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="receipt-outline" size={64} color="#334155" />
          <Text style={styles.emptyText}>No orders in this section</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={() => refetch()}>
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          renderItem={renderOrderCard}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContainer}
          onRefresh={refetch}
          refreshing={isFetching}
        />
      )}

      {/* Detailed Modal */}
      {selectedOrder && (
        <Modal
          visible={true}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setSelectedOrder(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Order Details #{selectedOrder.id}</Text>
                <TouchableOpacity onPress={() => setSelectedOrder(null)}>
                  <Ionicons name="close-circle-outline" size={28} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                {/* Status Section */}
                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Order Status</Text>
                  <View style={styles.modalStatusRow}>
                    <Text style={[styles.modalStatusText, { color: getStatusColor(selectedOrder.status) }]}>
                      {getStatusLabel(selectedOrder.status).toUpperCase()}
                    </Text>
                    
                    <View style={styles.modalStatusActions}>
                      {selectedOrder.status === 'pending' && (
                        <>
                          <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: '#3b82f6' }]}
                            onPress={() => handleUpdateStatus(selectedOrder.id, 'preparing')}
                          >
                            <Text style={styles.actionBtnText}>Accept</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: '#ef4444' }]}
                            onPress={() => handleUpdateStatus(selectedOrder.id, 'cancelled')}
                          >
                            <Text style={styles.actionBtnText}>Cancel</Text>
                          </TouchableOpacity>
                        </>
                      )}
                      {selectedOrder.status === 'preparing' && (
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: '#10b981' }]}
                          onPress={() => handleUpdateStatus(selectedOrder.id, 'ready')}
                        >
                          <Text style={styles.actionBtnText}>Mark Ready</Text>
                        </TouchableOpacity>
                      )}
                      {selectedOrder.status === 'ready' && (
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: '#64748b' }]}
                          onPress={() => handleUpdateStatus(selectedOrder.id, 'completed')}
                        >
                          <Text style={styles.actionBtnText}>Complete</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>

                {/* Customer Section */}
                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Customer Details</Text>
                  <Text style={styles.modalDetailLabel}>Name:</Text>
                  <Text style={styles.modalDetailVal}>{selectedOrder.customer_name || 'Walk-in Customer'}</Text>
                  
                  {selectedOrder.customer_phone ? (
                    <View style={styles.phoneActionRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.modalDetailLabel}>Phone:</Text>
                        <Text style={styles.modalDetailVal}>{selectedOrder.customer_phone}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.circlePhoneButton}
                        onPress={() => makeCall(selectedOrder.customer_phone)}
                      >
                        <Ionicons name="call" size={20} color="#ffffff" />
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>

                {/* Delivery details if applicable */}
                {selectedOrder.order_type === 'delivery' && (
                  <View style={styles.modalSection}>
                    <Text style={styles.sectionTitle}>Delivery Address</Text>
                    <Text style={styles.addressText}>{selectedOrder.delivery_address || 'No address provided'}</Text>
                    {selectedOrder.special_instructions ? (
                      <View style={{ marginTop: 8 }}>
                        <Text style={styles.modalDetailLabel}>Instructions:</Text>
                        <Text style={styles.instructionVal}>{selectedOrder.special_instructions}</Text>
                      </View>
                    ) : null}
                    <TouchableOpacity
                      style={styles.mapButton}
                      onPress={() => openMap(selectedOrder.delivery_address)}
                    >
                      <Ionicons name="map-outline" size={18} color="#3b82f6" />
                      <Text style={styles.mapButtonText}>View on Map</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Items Section */}
                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Order Items</Text>
                  {selectedOrder.items?.map((item: any) => (
                    <View key={item.id} style={styles.orderItemRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemName}>
                          {item.quantity}x {item.product_name}
                        </Text>
                        {item.customizations ? (
                          <Text style={styles.itemCustoms}>
                            {item.customizations}
                          </Text>
                        ) : null}
                        {item.comment ? (
                          <Text style={styles.itemComment}>
                            "{item.comment}"
                          </Text>
                        ) : null}
                      </View>
                      <Text style={styles.itemPrice}>
                        ${Number(item.total_price).toFixed(2)}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Pricing summary */}
                <View style={styles.modalSection}>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Subtotal</Text>
                    <Text style={styles.priceVal}>${Number(selectedOrder.subtotal_amount).toFixed(2)}</Text>
                  </View>
                  {Number(selectedOrder.discount_amount) > 0 && (
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>Loyalty Discount</Text>
                      <Text style={[styles.priceVal, { color: '#ef4444' }]}>-${Number(selectedOrder.discount_amount).toFixed(2)}</Text>
                    </View>
                  )}
                  {Number(selectedOrder.promo_discount) > 0 && (
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>Promo Discount</Text>
                      <Text style={[styles.priceVal, { color: '#ef4444' }]}>-${Number(selectedOrder.promo_discount).toFixed(2)}</Text>
                    </View>
                  )}
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Delivery Fee</Text>
                    <Text style={styles.priceVal}>${Number(selectedOrder.delivery_fee).toFixed(2)}</Text>
                  </View>
                  <View style={[styles.priceRow, { borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 8, marginTop: 8 }]}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalVal}>${Number(selectedOrder.total_amount).toFixed(2)}</Text>
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1e293b',
  },
  branchName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  managerRole: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#1e293b',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    flexDirection: 'row',
    gap: 4,
  },
  tabButtonActive: {
    borderBottomColor: '#3b82f6',
  },
  tabText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: 'bold',
  },
  tabTextActive: {
    color: '#3b82f6',
  },
  tabBadge: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  tabBadgeActive: {
    backgroundColor: '#3b82f6',
  },
  tabBadgeInactive: {
    backgroundColor: '#334155',
  },
  tabBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: 'bold',
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
    marginBottom: 20,
  },
  refreshButton: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  refreshButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 12,
  },
  orderNumber: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  orderTime: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  cardBody: {
    paddingVertical: 12,
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    color: '#e2e8f0',
    fontSize: 14,
  },
  instructionRow: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 6,
    padding: 8,
    marginTop: 4,
    gap: 4,
  },
  instructionLabel: {
    color: '#f59e0b',
    fontWeight: 'bold',
    fontSize: 12,
  },
  instructionText: {
    color: '#cbd5e1',
    fontSize: 12,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 12,
    marginTop: 4,
  },
  orderTotal: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  smallButton: {
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  smallButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalBody: {
    padding: 20,
  },
  modalSection: {
    marginBottom: 20,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sectionTitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  modalStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalStatusText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalStatusActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  actionBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  modalDetailLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
  modalDetailVal: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 2,
  },
  phoneActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  circlePhoneButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressText: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 22,
  },
  instructionVal: {
    color: '#cbd5e1',
    fontSize: 14,
    marginTop: 2,
    backgroundColor: '#0f172a',
    padding: 10,
    borderRadius: 8,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 16,
  },
  mapButtonText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: 'bold',
  },
  orderItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingVertical: 10,
  },
  itemName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  itemCustoms: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  itemComment: {
    color: '#cbd5e1',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2,
  },
  itemPrice: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  priceLabel: {
    color: '#94a3b8',
    fontSize: 14,
  },
  priceVal: {
    color: '#ffffff',
    fontSize: 14,
  },
  totalLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalVal: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
});
