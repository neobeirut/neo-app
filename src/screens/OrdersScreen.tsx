import React, { useState, useEffect, useMemo } from 'react';
import { 
  ClipboardList, 
  Truck, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  RefreshCw,
  AlertTriangle,
  X
} from 'lucide-react';
import { api } from '../api/client';
import './DashboardScreen.css';

export default function OrdersScreen({ user }: { user: any }) {
  const [loading, setLoading] = useState(true);

  // Lists
  const [orders, setOrders] = useState<any[]>([]);
  const [branches, setBranches] = useState<string[]>([]);

  // Order Filters
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterFromBranch, setFilterFromBranch] = useState('All');
  const [filterToBranch, setFilterToBranch] = useState('All');
  const [filterUrgent, setFilterUrgent] = useState(false);

  // Modal / Editor states
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);

  // KPI counts
  const [kpis, setKpis] = useState({
    pendingSubmitted: 0,
    pendingSent: 0,
    completed: 0
  });

  // Grouping logic for orders by branch, to_branch, to_department, and status
  const groupedOrders = useMemo(() => {
    const groups: Record<string, {
      key: string;
      id: string;
      branch: string;
      to_branch: string;
      to_department: string;
      status: string;
      urgent: boolean;
      placed_by: string;
      date_submitted: string;
      comments: string;
      originalOrders: any[];
    }> = {};

    orders.forEach(ord => {
      const key = `${ord.branch}_${ord.to_branch}_${ord.to_department}_${ord.status}`;
      if (!groups[key]) {
        groups[key] = {
          key,
          id: `${ord.to_department} Group`,
          branch: ord.branch,
          to_branch: ord.to_branch,
          to_department: ord.to_department,
          status: ord.status,
          urgent: ord.urgent || false,
          placed_by: ord.placed_by || '',
          date_submitted: ord.date_submitted || '',
          comments: ord.comments || '',
          originalOrders: []
        };
      }
      
      groups[key].originalOrders.push(ord);
      
      if (ord.urgent) {
        groups[key].urgent = true;
      }
      
      if (ord.placed_by && !groups[key].placed_by.includes(ord.placed_by)) {
        groups[key].placed_by = groups[key].placed_by 
          ? `${groups[key].placed_by}, ${ord.placed_by}` 
          : ord.placed_by;
      }
      
      if (ord.date_submitted && (!groups[key].date_submitted || ord.date_submitted > groups[key].date_submitted)) {
        groups[key].date_submitted = ord.date_submitted;
      }

      if (ord.comments) {
        groups[key].comments = groups[key].comments 
          ? `${groups[key].comments} | ${ord.comments}` 
          : ord.comments;
      }
    });

    return Object.values(groups);
  }, [orders]);

  useEffect(() => {
    const pendingSubmitted = groupedOrders.filter((r: any) => r.status === 'Submitted').length;
    const pendingSent = groupedOrders.filter((r: any) => r.status === 'Sent').length;
    const completed = groupedOrders.filter((r: any) => r.status === 'Received').length;
    setKpis({ pendingSubmitted, pendingSent, completed });
  }, [groupedOrders]);

  useEffect(() => {
    loadFilterOptions();
  }, []);

  const loadFilterOptions = async () => {
    try {
      const branchRes = await api.getBranchesList();
      if (branchRes.success && branchRes.data) {
        setBranches(branchRes.data.map((b: any) => typeof b === 'string' ? b : b.name));
      }
    } catch (e) {
      console.error('Error loading filter options:', e);
    }
  };

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await api.getOrders({
        status: filterStatus === 'All' ? undefined : filterStatus,
        branch: filterFromBranch === 'All' ? undefined : filterFromBranch,
        to_branch: filterToBranch === 'All' ? undefined : filterToBranch,
        urgent: filterUrgent ? true : undefined
      });
      if (res.success && res.data) {
        setOrders(res.data);
      } else {
        setOrders([]);
      }
    } catch (e) {
      console.error('Error loading orders:', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadOrders();
  }, [filterStatus, filterFromBranch, filterToBranch, filterUrgent]);

  const num = (val: any) => Number(val) || 0;

  const handleOpenOrder = async (group: any) => {
    setSelectedOrder(group);
    setOrderItems([]);
    setShowOrderModal(true);
    
    const combinedItemsMap: Record<string, {
      item_name: string;
      unit: string;
      quantity: number;
      qty_sent: number;
      qty_received: number;
      fulfillment_reason: string;
      originalItemRows: any[];
    }> = {};

    group.originalOrders.forEach((ord: any) => {
      if (ord.order_items) {
        ord.order_items.forEach((item: any) => {
          const name = item.item_name;
          if (!combinedItemsMap[name]) {
            combinedItemsMap[name] = {
              item_name: name,
              unit: item.unit || 'Pcs',
              quantity: 0,
              qty_sent: 0,
              qty_received: 0,
              fulfillment_reason: item.fulfillment_reason || '',
              originalItemRows: []
            };
          }
          
          const entry = combinedItemsMap[name];
          entry.quantity += num(item.quantity);
          entry.qty_sent += num(item.qty_sent);
          entry.qty_received += num(item.qty_received);
          entry.originalItemRows.push(item);
          
          if (item.fulfillment_reason && !entry.fulfillment_reason) {
            entry.fulfillment_reason = item.fulfillment_reason;
          }
        });
      }
    });

    const combinedItems = Object.values(combinedItemsMap).map(entry => {
      let inputQtyVal = 0;
      if (group.status === 'Submitted') {
        inputQtyVal = entry.originalItemRows.reduce((sum, item) => {
          return sum + (item.qty_sent !== null ? num(item.qty_sent) : num(item.quantity));
        }, 0);
      } else {
        inputQtyVal = entry.originalItemRows.reduce((sum, item) => {
          return sum + (item.qty_received !== null ? num(item.qty_received) : (item.qty_sent !== null ? num(item.qty_sent) : num(item.quantity)));
        }, 0);
      }

      return {
        ...entry,
        id: entry.item_name,
        inputQty: String(inputQtyVal)
      };
    });

    setOrderItems(combinedItems);
  };

  const handleSendOrder = async () => {
    if (!selectedOrder) return;
    
    // Check if reasons are provided for 0 quantities
    const missingReason = orderItems.find(i => {
      const val = parseFloat(i.inputQty) || 0;
      return val === 0 && !i.fulfillment_reason;
    });

    if (missingReason) {
      alert(`Please specify a fulfillment reason for "${missingReason.item_name}" since quantity to send is 0.`);
      return;
    }

    setSubmittingAction(true);
    try {
      for (const origOrd of selectedOrder.originalOrders) {
        const origOrdItemUpdates: any[] = [];
        
        orderItems.forEach((combinedItem: any) => {
          const totalInputQty = Number(combinedItem.inputQty) || 0;
          
          let remaining = totalInputQty;
          combinedItem.originalItemRows.forEach((origItem: any) => {
            const needed = Number(origItem.quantity) || 0;
            const allocated = Math.min(needed, remaining);
            remaining -= allocated;
            
            if (origItem.order_id === origOrd.id) {
              origOrdItemUpdates.push({
                id: origItem.id,
                updates: {
                  qty_sent: allocated,
                  fulfillment_reason: allocated === 0 ? (combinedItem.fulfillment_reason || 'Out of Stock') : null
                }
              });
            }
          });
        });

        const headerUpdate = {
          status: 'Sent',
          date_sent: new Date().toISOString(),
          sent_by: user.name
        };

        const res = await api.updateOrder(origOrd.id, headerUpdate, origOrdItemUpdates);
        if (!res.success) {
          throw new Error(res.error);
        }
      }

      alert('Orders successfully marked as Sent.');
      setShowOrderModal(false);
      loadOrders();
    } catch (e: any) {
      alert('Error updating orders: ' + e.message);
    }
    setSubmittingAction(false);
  };

  const handleReceiveOrder = async () => {
    if (!selectedOrder) return;

    // Check if reasons are provided for 0 quantities received (when sent quantity was > 0)
    const missingReason = orderItems.find(i => {
      const val = parseFloat(i.inputQty) || 0;
      const qtySent = Number(i.qty_sent) || 0;
      return qtySent > 0 && val === 0 && !i.fulfillment_reason;
    });

    if (missingReason) {
      alert(`Please specify a fulfillment reason for "${missingReason.item_name}" since quantity received is 0.`);
      return;
    }

    setSubmittingAction(true);
    let followUpCreated = false;
    try {
      for (const origOrd of selectedOrder.originalOrders) {
        const origOrdItemUpdates: any[] = [];
        
        orderItems.forEach((combinedItem: any) => {
          const totalInputQtyReceived = Number(combinedItem.inputQty) || 0;
          
          let remaining = totalInputQtyReceived;
          combinedItem.originalItemRows.forEach((origItem: any) => {
            const sent = Number(origItem.qty_sent) || 0;
            const allocated = Math.min(sent, remaining);
            remaining -= allocated;
            
            if (origItem.order_id === origOrd.id) {
              origOrdItemUpdates.push({
                id: origItem.id,
                updates: {
                  qty_received: allocated,
                  fulfillment_reason: allocated === 0 ? (combinedItem.fulfillment_reason || 'Not Received') : (combinedItem.fulfillment_reason || null)
                }
              });
            }
          });
        });

        const headerUpdate = {
          status: 'Received',
          date_received: new Date().toISOString(),
          received_by: user.name
        };

        const res = await api.updateOrder(origOrd.id, headerUpdate, origOrdItemUpdates);
        if (res.success) {
          const origOrdNotSentItems = origOrdItemUpdates.filter(i => {
            const origItem = origOrd.order_items.find((oi: any) => oi.id === i.id);
            return origItem && Number(origItem.qty_sent) === 0 && i.updates.fulfillment_reason;
          }).map(i => {
            const origItem = origOrd.order_items.find((oi: any) => oi.id === i.id);
            return {
              ...origItem,
              qty_sent: 0,
              fulfillment_reason: i.updates.fulfillment_reason
            };
          });

          const origOrdNotReceivedItems = origOrdItemUpdates.filter(i => {
            const origItem = origOrd.order_items.find((oi: any) => oi.id === i.id);
            return origItem && (Number(origItem.qty_sent) || 0) > 0 && i.updates.qty_received === 0 && i.updates.fulfillment_reason;
          }).map(i => {
            const origItem = origOrd.order_items.find((oi: any) => oi.id === i.id);
            return {
              ...origItem,
              qty_received: 0,
              fulfillment_reason: i.updates.fulfillment_reason
            };
          });

          if (origOrdNotSentItems.length > 0) {
            await api.createFollowUpOrder(origOrd, origOrdNotSentItems, 'Not Sent');
            followUpCreated = true;
          }
          if (origOrdNotReceivedItems.length > 0) {
            await api.createFollowUpOrder(origOrd, origOrdNotReceivedItems, 'Not Received/Damaged');
            followUpCreated = true;
          }
        } else {
          throw new Error(res.error);
        }
      }

      if (followUpCreated) {
        alert('Orders successfully marked as Received. Follow-up orders created automatically for missing items.');
      } else {
        alert('Orders successfully marked as Received.');
      }

      setShowOrderModal(false);
      loadOrders();
    } catch (e: any) {
      alert('Error updating orders: ' + e.message);
    }
    setSubmittingAction(false);
  };

  const handleDeleteOrder = async (group: any) => {
    const ids = group.originalOrders.map((o: any) => o.id).join(', ');
    if (!window.confirm(`Are you sure you want to delete/cancel orders: ${ids}? This action is irreversible.`)) return;
    setSubmittingAction(true);
    try {
      for (const origOrd of group.originalOrders) {
        const res = await api.deleteOrder(origOrd.id, user.name);
        if (!res.success) {
          throw new Error(res.error);
        }
      }
      alert('Orders successfully deleted.');
      setShowOrderModal(false);
      loadOrders();
    } catch (e: any) {
      alert('Error deleting orders: ' + e.message);
    }
    setSubmittingAction(false);
  };


  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Submitted':
        return 'kpi-status-neutral';
      case 'Sent':
        return 'kpi-status-warning';
      case 'Received':
        return 'kpi-status-success';
      case 'Deleted':
        return 'kpi-status-danger';
      default:
        return '';
    }
  };

  return (
    <div className="dashboard-container">
      {/* Title Header */}
      <div className="dashboard-title-row">
        <div>
          <h1>Branch Orders Management</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Process branch-to-branch stock transfers and fulfill requests.
          </p>
        </div>
      </div>
        <>
          {/* Summary KPIs */}
          <div className="kpi-grid">
            <div className="kpi-card kpi-status-neutral" style={{ cursor: 'default' }}>
              <div className="kpi-card-header">
                <span className="kpi-card-title">Pending Fulfillment</span>
                <div className="kpi-card-icon-wrapper" style={{ backgroundColor: '#e2e8f0', color: '#64748b' }}>
                  <ClipboardList size={20} />
                </div>
              </div>
              <div className="kpi-card-body">
                <span className="kpi-card-value">{kpis.pendingSubmitted}</span>
                <span className="kpi-card-label">Submitted branch orders</span>
              </div>
            </div>

            <div className="kpi-card kpi-status-warning" style={{ cursor: 'default' }}>
              <div className="kpi-card-header">
                <span className="kpi-card-title">In Transit</span>
                <div className="kpi-card-icon-wrapper" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                  <Truck size={20} />
                </div>
              </div>
              <div className="kpi-card-body">
                <span className="kpi-card-value">{kpis.pendingSent}</span>
                <span className="kpi-card-label">Orders sent & pending receipt</span>
              </div>
            </div>

            <div className="kpi-card kpi-status-success" style={{ cursor: 'default' }}>
              <div className="kpi-card-header">
                <span className="kpi-card-title">Completed Today</span>
                <div className="kpi-card-icon-wrapper" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
                  <CheckCircle2 size={20} />
                </div>
              </div>
              <div className="kpi-card-body">
                <span className="kpi-card-value">{kpis.completed}</span>
                <span className="kpi-card-label">Fully received orders</span>
              </div>
            </div>
          </div>

          {/* Filters Card */}
          <div className="filters-card" style={{ marginTop: '16px' }}>
            <div className="filters-row">
              <div className="filter-group">
                <label>Status</label>
                <select 
                  className="filter-select"
                  value={filterStatus} 
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="All">All Statuses</option>
                  <option value="Submitted">Submitted (Pending)</option>
                  <option value="Sent">Sent (In Transit)</option>
                  <option value="Received">Received (Completed)</option>
                </select>
              </div>

              <div className="filter-group">
                <label>From Branch</label>
                <select 
                  className="filter-select"
                  value={filterFromBranch} 
                  onChange={(e) => setFilterFromBranch(e.target.value)}
                >
                  <option value="All">All Origin Branches</option>
                  {branches.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label>To Branch</label>
                <select 
                  className="filter-select"
                  value={filterToBranch} 
                  onChange={(e) => setFilterToBranch(e.target.value)}
                >
                  <option value="All">All Destination Branches</option>
                  {branches.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group" style={{ minWidth: '120px', flexDirection: 'row', alignItems: 'center', gap: '8px', paddingBottom: '2px' }}>
                <input 
                  type="checkbox" 
                  id="filterUrgent" 
                  checked={filterUrgent}
                  onChange={(e) => setFilterUrgent(e.target.checked)}
                  style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                />
                <label htmlFor="filterUrgent" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'none', fontSize: '14px', color: 'var(--danger)', fontWeight: 700 }}>
                  <AlertTriangle size={16} /> Urgent Only
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '2px' }}>
                <button 
                  onClick={() => {
                    setFilterStatus('All');
                    setFilterFromBranch('All');
                    setFilterToBranch('All');
                    setFilterUrgent(false);
                  }}
                  className="auth-btn"
                  style={{ width: 'auto', height: '40px', padding: '0 16px', backgroundColor: '#eef2f5', color: '#495057', border: 'none' }}
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* Orders Queue Table */}
          <div style={{ 
            backgroundColor: 'var(--surface)', 
            borderRadius: '12px', 
            border: '1px solid var(--border)', 
            boxShadow: 'var(--shadow)',
            overflow: 'hidden',
            marginTop: '16px'
          }}>
            {loading ? (
              <div className="loading-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', gap: '8px' }}>
                <RefreshCw className="spin" size={24} style={{ color: 'var(--primary)' }} />
                <p style={{ color: 'var(--text-muted)' }}>Loading orders...</p>
              </div>
            ) : groupedOrders.length === 0 ? (
              <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', textAlign: 'center', gap: '8px' }}>
                <AlertCircle size={36} style={{ color: 'var(--text-muted)' }} />
                <span className="empty-state-title" style={{ fontWeight: 700, fontSize: '16px' }}>No Orders Found</span>
                <span className="empty-state-desc" style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Try adjusting your filters.</span>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '950px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                      <th style={tableHeaderStyle}>Orders</th>
                      <th style={tableHeaderStyle}>From Branch</th>
                      <th style={tableHeaderStyle}>To Branch / Dept</th>
                      <th style={tableHeaderStyle}>Placed By</th>
                      <th style={tableHeaderStyle}>Date Placed</th>
                      <th style={tableHeaderStyle}>Urgent</th>
                      <th style={tableHeaderStyle}>Status</th>
                      <th style={tableHeaderStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedOrders.map((group) => (
                      <tr key={group.key} style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 0.15s' }}>
                        <td style={{ ...tableCellStyle, fontWeight: 700, color: 'var(--primary)' }}>
                          {group.originalOrders.length} {group.originalOrders.length === 1 ? 'Order' : 'Orders'}
                        </td>
                        <td style={{ ...tableCellStyle, fontWeight: 600 }}>{group.branch}</td>
                        <td style={tableCellStyle}>{group.to_branch} / {group.to_department}</td>
                        <td style={tableCellStyle}>{group.placed_by || '—'}</td>
                        <td style={tableCellStyle}>{group.date_submitted ? new Date(group.date_submitted).toLocaleString().split(',')[0] : '—'}</td>
                        <td style={tableCellStyle}>
                          {group.urgent ? (
                            <span style={{ color: 'var(--danger)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <AlertTriangle size={14} /> Yes
                            </span>
                          ) : 'No'}
                        </td>
                        <td style={tableCellStyle}>
                          <span className={`kpi-card ${getStatusBadgeClass(group.status)}`} style={{
                            padding: '4px 8px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            display: 'inline-block',
                            margin: 0,
                            boxShadow: 'none',
                            border: 'none',
                            cursor: 'default'
                          }}>
                            {group.status}
                          </span>
                        </td>
                        <td style={tableCellStyle}>
                          <button 
                            onClick={() => handleOpenOrder(group)} 
                            className="auth-btn" 
                            style={{ 
                              width: 'auto', 
                              padding: '6px 12px', 
                              fontSize: '12px', 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '6px',
                              backgroundColor: 'var(--primary)'
                            }}
                          >
                            <Eye size={14} /> View / Process
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>

      {/* ORDER DETAIL MODAL */}
      {showOrderModal && selectedOrder && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '850px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Group Order: <span style={{ color: 'var(--primary)' }}>{selectedOrder.to_department}</span> ({selectedOrder.originalOrders.length} {selectedOrder.originalOrders.length === 1 ? 'order' : 'orders'})
                  {selectedOrder.urgent && (
                    <span style={{ fontSize: '12px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '2px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertTriangle size={12} /> Urgent
                    </span>
                  )}
                </h2>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  From: <strong>{selectedOrder.branch}</strong> | To: <strong>{selectedOrder.to_branch} ({selectedOrder.to_department})</strong> | Created by: <strong>{selectedOrder.placed_by}</strong>
                </p>
              </div>
              <button 
                onClick={() => setShowOrderModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* Meta details */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Status</span>
                    <strong style={{ fontSize: '14px', color: 'var(--primary)' }}>{selectedOrder.status}</strong>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Requested Date</span>
                    <strong style={{ fontSize: '14px' }}>{selectedOrder.date_submitted ? new Date(selectedOrder.date_submitted).toLocaleString() : '—'}</strong>
                  </div>
                  {selectedOrder.sent_by && (
                    <div>
                      <span style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Sent By</span>
                      <strong style={{ fontSize: '14px' }}>{selectedOrder.sent_by} ({new Date(selectedOrder.date_sent).toLocaleString().split(',')[0]})</strong>
                    </div>
                  )}
                  {selectedOrder.received_by && (
                    <div>
                      <span style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Received By</span>
                      <strong style={{ fontSize: '14px' }}>{selectedOrder.received_by} ({new Date(selectedOrder.date_received).toLocaleString().split(',')[0]})</strong>
                    </div>
                  )}
                </div>

                {/* Items list */}
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>Order Items List</h3>
                  <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                    <table style={{ minWidth: 'auto', width: '100%' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc' }}>
                          <th style={{ padding: '10px 14px', fontSize: '12px' }}>Item Name</th>
                          <th style={{ padding: '10px 14px', fontSize: '12px', textAlign: 'center' }}>Unit</th>
                          <th style={{ padding: '10px 14px', fontSize: '12px', textAlign: 'right' }}>Requested</th>
                          {selectedOrder.status !== 'Submitted' && (
                            <th style={{ padding: '10px 14px', fontSize: '12px', textAlign: 'right' }}>Qty Sent</th>
                          )}
                          {selectedOrder.status !== 'Submitted' && selectedOrder.status !== 'Sent' && (
                            <th style={{ padding: '10px 14px', fontSize: '12px', textAlign: 'right' }}>Qty Received</th>
                          )}
                          {/* Input columns for processing */}
                          {selectedOrder.status === 'Submitted' && (
                            <th style={{ padding: '10px 14px', fontSize: '12px', width: '130px', textAlign: 'right' }}>Qty to Send</th>
                          )}
                          {selectedOrder.status === 'Sent' && (
                            <th style={{ padding: '10px 14px', fontSize: '12px', width: '130px', textAlign: 'right' }}>Qty Received</th>
                          )}
                          {/* Reason Selector */}
                          {(selectedOrder.status === 'Submitted' || selectedOrder.status === 'Sent') && (
                            <th style={{ padding: '10px 14px', fontSize: '12px', width: '160px', textAlign: 'left' }}>Reason (If Qty is 0)</th>
                          )}
                          {selectedOrder.status !== 'Submitted' && selectedOrder.status !== 'Sent' && (
                            <th style={{ padding: '10px 14px', fontSize: '12px', textAlign: 'left' }}>Reason</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {orderItems.map((item, index) => {
                          const val = parseFloat(item.inputQty) || 0;
                          const showReasonSelector = (selectedOrder.status === 'Submitted' && val === 0) || (selectedOrder.status === 'Sent' && val === 0 && Number(item.qty_sent) > 0);
                          
                          return (
                            <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '10px 14px', fontWeight: 600 }}>{item.item_name}</td>
                              <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                <span style={{ fontSize: '11px', padding: '2px 6px', background: '#f1f5f9', borderRadius: '4px' }}>{item.unit}</span>
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>{item.quantity}</td>
                              
                              {/* Read only displays */}
                              {selectedOrder.status !== 'Submitted' && (
                                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>{item.qty_sent}</td>
                              )}
                              {selectedOrder.status !== 'Submitted' && selectedOrder.status !== 'Sent' && (
                                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>{item.qty_received}</td>
                              )}

                              {/* Editable Inputs based on Status */}
                              {selectedOrder.status === 'Submitted' && (
                                <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                                  <input 
                                    type="number"
                                    style={{ width: '80px', height: '32px', textAlign: 'right', padding: '4px 8px' }}
                                    value={item.inputQty}
                                    min="0"
                                    max={item.quantity}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const updated = [...orderItems];
                                      updated[index].inputQty = val;
                                      // Clear reason if qty is > 0
                                      if (parseFloat(val) > 0) {
                                        updated[index].fulfillment_reason = '';
                                      }
                                      setOrderItems(updated);
                                    }}
                                  />
                                </td>
                              )}

                              {selectedOrder.status === 'Sent' && (
                                <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                                  <input 
                                    type="number"
                                    style={{ width: '80px', height: '32px', textAlign: 'right', padding: '4px 8px' }}
                                    value={item.inputQty}
                                    min="0"
                                    max={item.qty_sent || item.quantity}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const updated = [...orderItems];
                                      updated[index].inputQty = val;
                                      // Clear reason if qty is > 0
                                      if (parseFloat(val) > 0) {
                                        updated[index].fulfillment_reason = '';
                                      }
                                      setOrderItems(updated);
                                    }}
                                  />
                                </td>
                              )}

                              {/* Reason Column */}
                              {(selectedOrder.status === 'Submitted' || selectedOrder.status === 'Sent') && (
                                <td style={{ padding: '8px 14px', textAlign: 'left' }}>
                                  {showReasonSelector ? (
                                    <select
                                      style={{ height: '32px', padding: '2px 8px', width: '100%' }}
                                      value={item.fulfillment_reason || ''}
                                      onChange={(e) => {
                                        const updated = [...orderItems];
                                        updated[index].fulfillment_reason = e.target.value;
                                        setOrderItems(updated);
                                      }}
                                    >
                                      <option value="">Select Reason...</option>
                                      {selectedOrder.status === 'Submitted' ? (
                                        <>
                                          <option value="Out of Stock">Out of Stock</option>
                                          <option value="Send Later">Send Later</option>
                                        </>
                                      ) : (
                                        <>
                                          <option value="Not Received">Not Received</option>
                                          <option value="Damaged">Damaged</option>
                                        </>
                                      )}
                                    </select>
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>
                                  )}
                                </td>
                              )}

                              {selectedOrder.status !== 'Submitted' && selectedOrder.status !== 'Sent' && (
                                <td style={{ padding: '10px 14px', color: 'var(--danger)', fontWeight: 600 }}>
                                  {item.fulfillment_reason || '—'}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Comments Display */}
                {selectedOrder.comments && (
                  <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fef3c7', padding: '12px', borderRadius: '8px', color: '#b45309', fontSize: '13px', fontStyle: 'italic' }}>
                    <strong>Note / Comment:</strong> {selectedOrder.comments}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer / Actions */}
            <div style={{
              padding: '20px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f8fafc'
            }}>
              {/* Delete / Cancel order button */}
              {selectedOrder.status !== 'Received' && selectedOrder.status !== 'Deleted' ? (
                <button
                  onClick={() => handleDeleteOrder(selectedOrder)}
                  className="auth-btn"
                  style={{ width: 'auto', padding: '10px 18px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: 'none', fontWeight: 600 }}
                  disabled={submittingAction}
                >
                  Cancel Order
                </button>
              ) : <div />}

              {/* Action operations buttons */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setShowOrderModal(false)}
                  className="auth-btn"
                  style={{ width: 'auto', padding: '10px 18px', backgroundColor: '#ffffff', color: 'var(--text-main)', border: '1px solid var(--border)' }}
                >
                  Close
                </button>
                
                {selectedOrder.status === 'Submitted' && (
                  <button
                    onClick={handleSendOrder}
                    className="auth-btn"
                    style={{ width: 'auto', padding: '10px 18px', backgroundColor: 'var(--primary)', color: 'white', border: 'none' }}
                    disabled={submittingAction}
                  >
                    {submittingAction ? 'Processing...' : 'Mark as Sent'}
                  </button>
                )}

                {selectedOrder.status === 'Sent' && (
                  <button
                    onClick={handleReceiveOrder}
                    className="auth-btn"
                    style={{ width: 'auto', padding: '10px 18px', backgroundColor: 'var(--success)', color: 'white', border: 'none' }}
                    disabled={submittingAction}
                  >
                    {submittingAction ? 'Processing...' : 'Mark as Received'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

const tableHeaderStyle: React.CSSProperties = {
  padding: '12px 16px',
  color: 'var(--text-muted)',
  fontWeight: 700,
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  borderBottom: '2px solid var(--border)',
  backgroundColor: '#f8fafc',
};

const tableCellStyle: React.CSSProperties = {
  padding: '12px 16px',
  verticalAlign: 'middle',
  fontSize: '13.5px',
  color: 'var(--text-main)',
  fontWeight: 500,
};
