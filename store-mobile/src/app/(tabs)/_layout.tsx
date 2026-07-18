import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOrdersStore } from '@/store/ordersStore';
import { View, Text, StyleSheet, Vibration, Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getJson } from '@/utils/api';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { useEffect } from 'react';

function IconWithBadge({ icon, color, badgeCount }: { icon: any, color: any, badgeCount: number }) {
  return (
    <View style={{ width: 24, height: 24, margin: 5 }}>
      <Ionicons name={icon} size={24} color={color} />
      {badgeCount > 0 && (
        <View style={styles.badgeContainer}>
          <Text style={styles.badgeText}>{badgeCount}</Text>
        </View>
      )}
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const pendingCount = useOrdersStore((state) => state.pendingCount);
  const setPendingCount = useOrdersStore((state) => state.setPendingCount);

  // Configure audio mode on mount
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'duckOthers',
    }).catch((err) => {
      console.warn('[TabLayout] Failed to configure audio mode:', err);
    });
  }, []);

  // Setup sound alert player
  const player = useAudioPlayer('https://assets.mixkit.co/active_storage/sfx/2869/2869-600.wav', {
    downloadFirst: true,
  });
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    if (player) {
      player.loop = true;
    }
  }, [player]);

  // Poll for orders globally so the tab badge updates and sound/vibrate plays globally
  const { data } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: () => getJson('/api/orders/admin'),
    refetchInterval: 8000, // Poll every 8 seconds
  });

  // Handle continuous alarm/ringing and repeated vibration for pending orders
  useEffect(() => {
    if (data?.orders) {
      const pendingOrders = data.orders.filter((o: any) => o.status === 'pending');
      const count = pendingOrders.length;
      
      // Update badge count globally
      setPendingCount(count);

      if (count > 0) {
        console.log(`[TabLayout Global] ${count} pending orders detected. Alarm ringing...`);
        try {
          if (player) {
            player.loop = true; // Ensure looping is active
            player.play();
          }
        } catch (e) {
          console.warn('[TabLayout] Failed to play alarm sound:', e);
        }
        // Vibrate repeatedly with pattern: wait 0ms, vibrate 500ms, wait 250ms, vibrate 500ms, and repeat (loop = true)
        Vibration.vibrate([0, 500, 250, 500], true);
      } else {
        console.log('[TabLayout Global] No pending orders. Alarm stopped.');
        try {
          if (player) {
            player.pause();
            player.seekTo(0);
          }
        } catch (e) {
          console.warn('[TabLayout] Failed to stop/reset audio player:', e);
        }
        Vibration.cancel();
      }
    }

    return () => {
      // Clean up vibration when component unmounts or status changes
      Vibration.cancel();
    };
  }, [data, player, setPendingCount]);

  // Fallback manual loop in case native loop does not fire/work correctly
  useEffect(() => {
    if (status && status.didJustFinish && pendingCount > 0 && player) {
      console.log('[TabLayout Global] Audio finished, manual loop replay.');
      try {
        player.play();
      } catch (e) {
        console.warn('[TabLayout] Failed to replay sound:', e);
      }
    }
  }, [status?.didJustFinish, pendingCount, player]);

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: '#0f172a',
          borderBottomWidth: 1,
          borderBottomColor: '#1e293b',
        },
        headerTitleStyle: {
          color: '#ffffff',
          fontWeight: 'bold',
          fontSize: 18,
        },
        tabBarStyle: {
          backgroundColor: '#0f172a',
          borderTopWidth: 1,
          borderTopColor: '#1e293b',
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#64748b',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          headerTitle: 'Orders Dashboard',
          tabBarIcon: ({ color }) => (
            <IconWithBadge icon="receipt-outline" color={color} badgeCount={pendingCount} />
          ),
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'Products',
          headerTitle: 'Product Stock Toggling',
          tabBarIcon: ({ color }) => (
            <Ionicons name="fast-food-outline" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          headerTitle: 'WhatsApp Inbox',
          tabBarIcon: ({ color }) => (
            <Ionicons name="chatbubbles-outline" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerTitle: 'Terminal Settings',
          tabBarIcon: ({ color }) => (
            <Ionicons name="settings-outline" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badgeContainer: {
    position: 'absolute',
    right: -6,
    top: -3,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
