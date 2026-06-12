import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';

import {
  getStoredAdminUser,
  clearAdminToken,
  clearStoredAdminUser,
  getBaseUrl,
  apiFetch,
} from '@/utils/api';

export default function SettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [adminUser, setAdminUser] = useState<any>(null);
  const [checkingConn, setCheckingConn] = useState(false);

  // Load admin profile on mount
  useEffect(() => {
    async function loadUser() {
      const user = await getStoredAdminUser();
      setAdminUser(user);
    }
    loadUser();
  }, []);

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out of this terminal?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await clearAdminToken();
            await clearStoredAdminUser();
            queryClient.clear();
            router.replace('/');
          },
        },
      ]
    );
  };

  const handleCheckConnection = async () => {
    setCheckingConn(true);
    try {
      const start = Date.now();
      const res = await apiFetch('/api/orders/admin', { method: 'GET' }).catch(err => {
        // Fallback check on base path if auth fails (which is fine, we just want to verify connectivity)
        return apiFetch('/', { method: 'GET' });
      });
      const end = Date.now();
      
      Alert.alert(
        'Connection Successful',
        `Successfully connected to backend server!\nLatency: ${end - start}ms\nHost: ${getBaseUrl()}`,
        [{ text: 'OK' }]
      );
    } catch (e: any) {
      Alert.alert(
        'Connection Failed',
        `Could not reach backend server at ${getBaseUrl()}.\nError: ${e.message}`,
        [{ text: 'OK' }]
      );
    } finally {
      setCheckingConn(false);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'orders': return 'Orders Manager';
      case 'product_status': return 'Menu Administrator';
      default: return role;
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Profile Section */}
      <View style={styles.section}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={36} color="#3b82f6" />
          </View>
          <View style={styles.profileMeta}>
            <Text style={styles.profileName}>{adminUser?.name || 'Staff User'}</Text>
            <Text style={styles.profileEmail}>{adminUser?.email || 'manager@neobeirut.com'}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Branch Affiliation</Text>
          <Text style={styles.rowVal}>{adminUser?.branch_name || 'All Branches (HQ)'}</Text>
        </View>
      </View>

      {/* Permissions Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Roles & Permissions</Text>
        {adminUser?.roles && adminUser.roles.length > 0 ? (
          adminUser.roles.map((role: string, idx: number) => (
            <View key={role} style={[styles.permissionRow, idx > 0 && styles.borderTop]}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#10b981" />
              <Text style={styles.permissionText}>{getRoleLabel(role)}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.noPermissions}>No administrative roles assigned</Text>
        )}
      </View>

      {/* Diagnostics / Utilities */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>System Diagnostics</Text>
        
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Server URL</Text>
          <Text style={styles.rowVal} numberOfLines={1}>{getBaseUrl()}</Text>
        </View>

        <View style={styles.divider} />

        <TouchableOpacity 
          style={styles.actionRow}
          onPress={handleCheckConnection}
          disabled={checkingConn}
        >
          <View style={styles.actionLeft}>
            <Ionicons name="wifi-outline" size={20} color="#3b82f6" />
            <Text style={styles.actionText}>Check Server Connection</Text>
          </View>
          {checkingConn ? (
            <ActivityIndicator size="small" color="#3b82f6" />
          ) : (
            <Ionicons name="chevron-forward" size={18} color="#64748b" />
          )}
        </TouchableOpacity>
      </View>

      {/* Log Out */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color="#ef4444" />
        <Text style={styles.logoutButtonText}>Log Out Terminal</Text>
      </TouchableOpacity>

      <Text style={styles.versionText}>Terminal Version 1.0.0 (EAS Build Alpha)</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  section: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileMeta: {
    marginLeft: 16,
    flex: 1,
  },
  profileName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  profileEmail: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: {
    color: '#94a3b8',
    fontSize: 14,
  },
  rowVal: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    maxWidth: '65%',
  },
  sectionTitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  permissionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  noPermissions: {
    color: '#64748b',
    fontSize: 14,
    fontStyle: 'italic',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef444415',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 8,
    paddingVertical: 14,
    gap: 8,
    marginTop: 8,
  },
  logoutButtonText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: 'bold',
  },
  versionText: {
    color: '#64748b',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 16,
  },
});
