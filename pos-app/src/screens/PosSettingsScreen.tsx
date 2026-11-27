import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRestaurantId, api } from '../api/client';
import { supabase } from '../api/supabase';
import { 
  Settings, Printer, Store, Tag, Monitor, Save, CheckCircle, 
  RefreshCw, ArrowRight, ShieldCheck, Layers, AlertCircle,
  Building2, ExternalLink, Lock, Wifi, Server, Plus, Edit2, Trash2, X, Play
} from 'lucide-react';
import { DiscountManagerModal } from '../pos/components/DiscountManagerModal';
import { 
  loadBranchPrinterConfig,
  type PosPrinter,
  type PosPrinterSectionRoute
} from '../pos/services/ticketRoutingService';

export default function PosSettingsScreen({ user }: { user?: any }) {
  const navigate = useNavigate();
  const currentRestaurantId = user?.restaurant_id || getRestaurantId() || '79256f11-a9f8-4fec-901d-69baf929762d';
  const restaurantName = currentRestaurantId === '4c0ed960-e459-42c4-962f-41229a2d3783' ? 'The Bistro' : 'Neo Beirut';

  // Printer Settings
  const [printServerIP, setPrintServerIP] = useState(() => {
    const stored = localStorage.getItem('flow_pos_print_server_ip');
    if (stored && stored !== '192.168.18.195') return stored;
    return (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== '192.168.18.195') 
      ? window.location.hostname 
      : '127.0.0.1';
  });
  const [printServerPort, setPrintServerPort] = useState(() => {
    return Number(localStorage.getItem('flow_pos_print_server_port')) || 9191;
  });

  // Dynamic Branch Multi-Printer State
  const [branchPrinters, setBranchPrinters] = useState<PosPrinter[]>([]);
  const [sectionRoutes, setSectionRoutes] = useState<PosPrinterSectionRoute[]>([]);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('9c214659-9cc7-4f33-b115-cbbb8a823a94');
  const [bridgeStatus, setBridgeStatus] = useState<'online' | 'offline' | 'checking' | 'unknown'>('unknown');
  const [bridgeLatency, setBridgeLatency] = useState<number | null>(null);

  // Add / Edit Printer Modal State
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<PosPrinter | null>(null);
  const [isSavingPrinter, setIsSavingPrinter] = useState(false);
  const [testingPrinterId, setTestingPrinterId] = useState<string | null>(null);
  const [printerFormData, setPrinterFormData] = useState({
    name: '',
    printer_role: 'kitchen',
    connection_type: 'network_raw',
    windows_printer_name: '',
    ip_address: '192.168.18.',
    port: 9100,
    paper_width_mm: 80,
    is_receipt_printer: false,
    is_fallback: false,
    assignedSections: ['Kitchen'] as string[]
  });

  const loadPrinters = async (branchId: string) => {
    try {
      const cfg = await loadBranchPrinterConfig(branchId, currentRestaurantId);
      setBranchPrinters(cfg.printers);
      setSectionRoutes(cfg.routes);
    } catch (e) {
      console.warn('Could not load printers for branch:', e);
    }
  };

  const handleOpenAddPrinter = () => {
    setEditingPrinter(null);
    setPrinterFormData({
      name: '',
      printer_role: 'kitchen',
      connection_type: 'network_raw',
      windows_printer_name: '',
      ip_address: '192.168.18.',
      port: 9100,
      paper_width_mm: 80,
      is_receipt_printer: false,
      is_fallback: false,
      assignedSections: ['Kitchen']
    });
    setIsPrinterModalOpen(true);
  };

  const handleOpenEditPrinter = (p: PosPrinter) => {
    setEditingPrinter(p);
    const assigned = sectionRoutes
      .filter(r => r.printer_id === p.id)
      .map(r => r.section_key);

    setPrinterFormData({
      name: p.name,
      printer_role: p.printer_role || 'kitchen',
      connection_type: p.connection_type || 'network_raw',
      windows_printer_name: (p as any).windows_printer_name || '',
      ip_address: p.ip_address || '',
      port: p.port || 9100,
      paper_width_mm: p.paper_width_mm || 80,
      is_receipt_printer: p.is_receipt_printer || false,
      is_fallback: p.is_fallback || false,
      assignedSections: assigned.length > 0 ? assigned : []
    });
    setIsPrinterModalOpen(true);
  };

  const handleSavePrinter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!printerFormData.name.trim()) {
      alert('Please enter a printer name');
      return;
    }
    setIsSavingPrinter(true);
    try {
      let printerId = editingPrinter?.id;
      if (editingPrinter) {
        if (printerFormData.is_receipt_printer) {
          await supabase
            .from('pos_printers')
            .update({ is_receipt_printer: false })
            .eq('branch_id', selectedBranchId);
        }
        if (printerFormData.is_fallback) {
          await supabase
            .from('pos_printers')
            .update({ is_fallback: false })
            .eq('branch_id', selectedBranchId);
        }

        const isUsb = printerFormData.connection_type === 'windows_driver' || printerFormData.connection_type === 'usb';
        const { error: updErr } = await supabase
          .from('pos_printers')
          .update({
            name: printerFormData.name.trim(),
            printer_role: printerFormData.printer_role,
            connection_type: printerFormData.connection_type,
            windows_printer_name: printerFormData.windows_printer_name?.trim() || null,
            ip_address: isUsb ? null : printerFormData.ip_address.trim(),
            port: isUsb ? null : (Number(printerFormData.port) || 9100),
            paper_width_mm: Number(printerFormData.paper_width_mm) || 80,
            is_receipt_printer: printerFormData.is_receipt_printer,
            is_fallback: printerFormData.is_fallback,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingPrinter.id);

        if (updErr) throw updErr;
      } else {
        if (printerFormData.is_receipt_printer) {
          await supabase
            .from('pos_printers')
            .update({ is_receipt_printer: false })
            .eq('branch_id', selectedBranchId);
        }
        if (printerFormData.is_fallback) {
          await supabase
            .from('pos_printers')
            .update({ is_fallback: false })
            .eq('branch_id', selectedBranchId);
        }

        const isUsb = printerFormData.connection_type === 'windows_driver' || printerFormData.connection_type === 'usb';
        const { data: newP, error: insErr } = await supabase
          .from('pos_printers')
          .insert({
            restaurant_id: currentRestaurantId,
            branch_id: selectedBranchId,
            name: printerFormData.name.trim(),
            printer_role: printerFormData.printer_role,
            connection_type: printerFormData.connection_type,
            windows_printer_name: printerFormData.windows_printer_name?.trim() || null,
            ip_address: isUsb ? null : printerFormData.ip_address.trim(),
            port: isUsb ? null : (Number(printerFormData.port) || 9100),
            paper_width_mm: Number(printerFormData.paper_width_mm) || 80,
            is_receipt_printer: printerFormData.is_receipt_printer,
            is_fallback: printerFormData.is_fallback,
            is_active: true,
            status: 'online'
          })
          .select()
          .single();

        if (insErr) throw insErr;
        printerId = newP.id;
      }

      if (printerId) {
        // Unset previous routes for this printer
        await supabase
          .from('pos_printer_section_routes')
          .update({ printer_id: null })
          .eq('branch_id', selectedBranchId)
          .eq('printer_id', printerId);

        // Map selected sections to this printer
        for (const secKey of printerFormData.assignedSections) {
          await supabase
            .from('pos_printer_section_routes')
            .upsert({
              restaurant_id: currentRestaurantId,
              branch_id: selectedBranchId,
              section_key: secKey,
              printer_id: printerId,
              print_preparation_ticket: true,
              is_default: true,
              updated_at: new Date().toISOString()
            }, { onConflict: 'branch_id,section_key' });
        }
      }

      setIsPrinterModalOpen(false);
      await loadPrinters(selectedBranchId);
    } catch (err: any) {
      alert(`Error saving printer: ${err.message || 'Database error'}`);
    } finally {
      setIsSavingPrinter(false);
    }
  };

  const handleDeletePrinter = async (p: PosPrinter) => {
    if (!window.confirm(`Are you sure you want to delete printer "${p.name}"?`)) return;
    try {
      await supabase
        .from('pos_printer_section_routes')
        .update({ printer_id: null })
        .eq('printer_id', p.id);

      await supabase
        .from('pos_printers')
        .delete()
        .eq('id', p.id);

      await loadPrinters(selectedBranchId);
    } catch (err: any) {
      alert(`Error deleting printer: ${err.message}`);
    }
  };

  const handleTestPrint = async (printer: PosPrinter) => {
    setTestingPrinterId(printer.id);
    const bridgeUrl = `http://${printServerIP.trim()}:${printServerPort}/print`;
    const isUsb = printer.connection_type === 'windows_driver' || printer.connection_type === 'usb' || (!printer.ip_address && Boolean((printer as any).windows_printer_name));
    const payload = {
      destination: printer.name,
      printer: {
        name: printer.name,
        host: printer.ip_address,
        port: printer.port || 9100,
        connection_type: printer.connection_type,
        windows_printer_name: isUsb ? ((printer as any).windows_printer_name || printer.name) : null
      },
      job_type: 'test_print',
      idempotency_key: `test_${printer.id}_${Date.now()}`,
      content: {
        isKitchenTicket: true,
        title: '*** FLOW TEST CHIT ***',
        printer_name: printer.name,
        printer_ip: printer.ip_address,
        printer_port: printer.port || 9100,
        timestamp: new Date().toLocaleTimeString(),
        items: [
          { name: 'Hardware Connection Verified', qty: 1, note: isUsb ? `USB Spooler: ${(printer as any).windows_printer_name || printer.name}` : `Socket: ${printer.ip_address}:${printer.port}` },
          { name: 'Paper Width: ' + printer.paper_width_mm + 'mm', qty: 1 }
        ]
      }
    };
    try {
      let printSuccess = false;
      try {
        const res = await fetch(bridgeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(3000)
        });
        if (res.ok) {
          printSuccess = true;
          alert(`✅ Test chit successfully sent to ${printer.name} (${isUsb ? `USB: ${(printer as any).windows_printer_name || printer.name}` : `${printer.ip_address}:${printer.port}`}) via Local Bridge!`);
        }
      } catch (e) {
        console.warn('Local LAN bridge unreachable, falling back to Cloud Queue:', e);
      }

      if (!printSuccess) {
        // Queue via Supabase pos_print_jobs
        const { error: qErr } = await supabase.from('pos_print_jobs').insert({
          restaurant_id: currentRestaurantId,
          branch_id: selectedBranchId,
          printer_id: printer.id,
          section_key: 'Test',
          job_type: 'prep_ticket',
          status: 'pending',
          payload: payload.content,
          idempotency_key: payload.idempotency_key
        });

        if (!qErr) {
          alert(`✅ Test chit queued to ${printer.name} via Cloud Print Queue! Print server will cut ticket in ~2 seconds.`);
        } else {
          alert(`❌ Could not dispatch test chit: ${qErr.message}`);
        }
      }
    } catch (err: any) {
      alert(`❌ Test print failed: ${err.message}`);
    } finally {
      setTestingPrinterId(null);
    }
  };

  const checkPrintBridgeConnectivity = async () => {
    setBridgeStatus('checking');
    const start = Date.now();
    try {
      const res = await fetch(`http://${printServerIP.trim()}:${printServerPort}/status`, {
        signal: AbortSignal.timeout(2500)
      });
      if (res.ok) {
        setBridgeStatus('online');
        setBridgeLatency(Date.now() - start);
      } else {
        setBridgeStatus('offline');
        setBridgeLatency(null);
      }
    } catch (e) {
      setBridgeStatus('offline');
      setBridgeLatency(null);
    }
  };

  // Terminal Settings
  const [terminalId, setTerminalId] = useState(() => {
    return localStorage.getItem('flow_pos_terminal_id') || 'FLOW-TERM-01';
  });

  // Store Operational Status
  const [isStoreOpen, setIsStoreOpen] = useState(true);
  const [storeStatusLoading, setStoreStatusLoading] = useState(false);

  // Discount Manager State
  const [isDiscountManagerOpen, setIsDiscountManagerOpen] = useState(false);
  const [discountCount, setDiscountCount] = useState(0);

  // Notification state
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Receipt & Guest Check Information
  const [receiptRestaurantName, setReceiptRestaurantName] = useState(() => {
    return localStorage.getItem('flow_pos_restaurant_name') || 'Neo Beirut';
  });
  const [companyLegalName, setCompanyLegalName] = useState(() => {
    return localStorage.getItem('flow_pos_company_legal_name') || 'Neo Beirut S.A.L.';
  });
  const [mofNumber, setMofNumber] = useState(() => {
    return localStorage.getItem('flow_pos_mof_number') || '382910-601';
  });
  const [receiptFooterText, setReceiptFooterText] = useState(() => {
    return localStorage.getItem('flow_pos_receipt_footer') || 'Thank you for dining with us! Come back soon.';
  });
  const [receiptSettingsSaving, setReceiptSettingsSaving] = useState(false);
  const [receiptSettingsSaved, setReceiptSettingsSaved] = useState(false);

  // System Parameter Settings (Exchange Rate & VAT)
  const [exchangeRate, setExchangeRate] = useState<number>(90000);
  const [vatRate, setVatRate] = useState<number>(11);
  const [isVatSubscribed, setIsVatSubscribed] = useState<boolean>(false);
  const [systemSettingsSaving, setSystemSettingsSaving] = useState(false);
  const [systemSettingsSaved, setSystemSettingsSaved] = useState(false);

  useEffect(() => {
    // Load store status
    const loadStoreStatus = async () => {
      try {
        const { data } = await supabase
          .from('branches')
          .select('is_active')
          .eq('restaurant_id', currentRestaurantId)
          .limit(1);
        if (data && data.length > 0) {
          setIsStoreOpen(data[0].is_active !== false);
        }
      } catch (err) {
        console.warn('Could not fetch store status:', err);
      }
    };
    loadStoreStatus();

    // Load discount count
    const loadDiscounts = async () => {
      try {
        const { data } = await supabase
          .from('pos_discounts')
          .select('id')
          .eq('restaurant_id', currentRestaurantId);
        if (data) {
          setDiscountCount(data.length);
        }
      } catch (err) {
        console.warn('Could not fetch discounts count:', err);
      }
    };
    loadDiscounts();

    // Load System Settings (Exchange Rate & VAT)
    api.getExchangeRate(currentRestaurantId).then(res => {
      if (res.success && res.rate) setExchangeRate(res.rate);
    });
    // Load Receipt Settings from app_settings and restaurants table
    supabase
      .from('app_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['receipt_restaurant_name', 'company_legal_name', 'mof_number', 'receipt_footer_text', 'logo_url'])
      .then(({ data }) => {
        if (data) {
          data.forEach(item => {
            if (item.setting_key === 'receipt_restaurant_name' && item.setting_value) {
              setReceiptRestaurantName(item.setting_value);
              localStorage.setItem('flow_pos_restaurant_name', item.setting_value);
            }
            if (item.setting_key === 'company_legal_name' && item.setting_value) {
              setCompanyLegalName(item.setting_value);
              localStorage.setItem('flow_pos_company_legal_name', item.setting_value);
            }
            if (item.setting_key === 'mof_number' && item.setting_value) {
              setMofNumber(item.setting_value);
              localStorage.setItem('flow_pos_mof_number', item.setting_value);
            }
            if (item.setting_key === 'receipt_footer_text' && item.setting_value) {
              setReceiptFooterText(item.setting_value);
              localStorage.setItem('flow_pos_receipt_footer', item.setting_value);
            }
            if (item.setting_key === 'logo_url' && item.setting_value) {
              localStorage.setItem('flow_pos_logo_url', item.setting_value);
            }
          });
        }
      });

    if (currentRestaurantId) {
      supabase
        .from('restaurants')
        .select('name, logo_url, settings')
        .eq('id', currentRestaurantId)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.logo_url) {
            localStorage.setItem('flow_pos_logo_url', data.logo_url);
          }
          if (data?.settings) {
            const s = data.settings as any;
            if (s.company_legal_name) {
              setCompanyLegalName(s.company_legal_name);
              localStorage.setItem('flow_pos_company_legal_name', s.company_legal_name);
            }
            if (s.mof_number) {
              setMofNumber(s.mof_number);
              localStorage.setItem('flow_pos_mof_number', s.mof_number);
            }
            if (s.receipt_restaurant_name) {
              setReceiptRestaurantName(s.receipt_restaurant_name);
              localStorage.setItem('flow_pos_restaurant_name', s.receipt_restaurant_name);
            } else if (data.name) {
              setReceiptRestaurantName(data.name);
            }
            if (s.receipt_footer_text) {
              setReceiptFooterText(s.receipt_footer_text);
              localStorage.setItem('flow_pos_receipt_footer', s.receipt_footer_text);
            }
          }
        });
    }

    api.getVatSettings(currentRestaurantId).then(res => {
      if (res.success) {
        setIsVatSubscribed(res.isVatSubscribed === true);
        setVatRate(typeof res.vatRate === 'number' ? res.vatRate : 11);
      }
    });

    // Load Branches & Multi-Printer Configuration
    supabase.from('branches').select('id, name').order('name').then(({ data }) => {
      if (data && data.length > 0) {
        setBranches(data);
      }
    });

    loadPrinters(selectedBranchId);
  }, [currentRestaurantId, selectedBranchId]);

  const handleSaveSystemSettings = async () => {
    setSystemSettingsSaving(true);
    try {
      const res = await api.updateSystemSettings(currentRestaurantId, {
        exchangeRate: Number(exchangeRate) || 90000,
        vatRate: Number(vatRate) || 0,
        isVatSubscribed: Boolean(isVatSubscribed)
      });
      if (res.success) {
        setSystemSettingsSaved(true);
        setTimeout(() => setSystemSettingsSaved(false), 3000);
      } else {
        alert('Failed to save system settings: ' + (res.error || ''));
      }
    } catch (e: any) {
      alert('Error saving system settings: ' + e.message);
    } finally {
      setSystemSettingsSaving(false);
    }
  };

  const handleSaveReceiptSettings = async () => {
    setReceiptSettingsSaving(true);
    try {
      localStorage.setItem('flow_pos_restaurant_name', receiptRestaurantName.trim());
      localStorage.setItem('flow_pos_company_legal_name', companyLegalName.trim());
      localStorage.setItem('flow_pos_mof_number', mofNumber.trim());
      localStorage.setItem('flow_pos_receipt_footer', receiptFooterText.trim());

      const updates = [
        { key: 'receipt_restaurant_name', val: receiptRestaurantName.trim() },
        { key: 'company_legal_name', val: companyLegalName.trim() },
        { key: 'mof_number', val: mofNumber.trim() },
        { key: 'receipt_footer_text', val: receiptFooterText.trim() }
      ];

      for (const u of updates) {
        await supabase
          .from('app_settings')
          .upsert({
            setting_key: u.key,
            setting_value: u.val,
            restaurant_id: currentRestaurantId,
            updated_at: new Date().toISOString()
          }, { onConflict: 'setting_key' });
      }

      setReceiptSettingsSaved(true);
      setTimeout(() => setReceiptSettingsSaved(false), 3000);
    } catch (err: any) {
      alert('Error saving receipt settings: ' + err.message);
    } finally {
      setReceiptSettingsSaving(false);
    }
  };

  const handleSaveSettings = () => {
    localStorage.setItem('flow_pos_print_server_ip', printServerIP.trim());
    localStorage.setItem('flow_pos_print_server_port', String(printServerPort));
    localStorage.setItem('flow_pos_terminal_id', terminalId.trim());

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleToggleStoreStatus = async () => {
    setStoreStatusLoading(true);
    try {
      const nextStatus = !isStoreOpen;
      const { error } = await supabase
        .from('branches')
        .update({ is_active: nextStatus })
        .eq('restaurant_id', currentRestaurantId);
      if (!error) {
        setIsStoreOpen(nextStatus);
      }
    } catch (err) {
      console.error('Error toggling store status:', err);
    } finally {
      setStoreStatusLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F6F4] text-slate-900 p-6 md:p-8 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-[#1e5c4f] flex items-center justify-center font-bold text-2xl shadow-xs">
              ⚙️
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">
                POS System Settings
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Hardware, Thermal Printing, Operational Store Status & Branch Discounts • {restaurantName}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/pos-screens')}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 font-bold text-xs rounded-xl border border-slate-200 flex items-center gap-2 transition cursor-pointer shadow-xs"
          >
            <Layers size={16} className="text-[#1e5c4f]" />
            <span>Screen Builder</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/pos')}
            className="px-4 py-2.5 bg-[#1e5c4f] hover:bg-[#16473D] text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-2 transition cursor-pointer"
          >
            <Monitor size={16} />
            <span>Open POS Register</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs font-bold flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle size={18} className="text-[#1e5c4f]" />
          <span>POS Settings successfully saved to terminal hardware storage!</span>
        </div>
      )}

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Thermal Printer & Hardware */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#1e5c4f] border border-emerald-200 flex items-center justify-center font-bold">
              <Printer size={20} />
            </div>
            <div>
              <h2 className="font-black text-base text-slate-900">
                Thermal LAN Printer Configuration
              </h2>
              <p className="text-xs text-slate-500 font-medium">ESC/POS LAN receipt and kitchen ticket printing</p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Print Server IP Address
              </label>
              <input
                type="text"
                value={printServerIP}
                onChange={(e) => setPrintServerIP(e.target.value)}
                placeholder="192.168.18.195"
                className="w-full bg-slate-50 border border-slate-300 focus:border-[#1e5c4f] focus:ring-1 focus:ring-[#1e5c4f] rounded-xl px-3.5 py-2.5 text-slate-900 font-mono font-bold text-xs outline-hidden transition"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Local IP of the Ethernet thermal receipt printer or print bridge server.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Print Server Port
              </label>
              <input
                type="number"
                inputMode="numeric"
                value={printServerPort}
                onChange={(e) => setPrintServerPort(Number(e.target.value))}
                placeholder="9191"
                className="w-full bg-slate-50 border border-slate-300 focus:border-[#1e5c4f] focus:ring-1 focus:ring-[#1e5c4f] rounded-xl px-3.5 py-2.5 text-slate-900 font-mono font-bold text-xs outline-hidden transition"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Default raw socket port (typically 9191 or 9100).
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Terminal Identifier
              </label>
              <input
                type="text"
                value={terminalId}
                onChange={(e) => setTerminalId(e.target.value)}
                placeholder="FLOW-TERM-01"
                className="w-full bg-slate-50 border border-slate-300 focus:border-[#1e5c4f] focus:ring-1 focus:ring-[#1e5c4f] rounded-xl px-3.5 py-2.5 text-slate-900 font-mono font-bold text-xs outline-hidden transition"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Hardware station code assigned to this register terminal.
              </span>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleSaveSettings}
                className="flex-1 py-3 bg-[#1e5c4f] hover:bg-[#16473D] text-white font-bold text-xs rounded-xl transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save size={16} />
                <span>Save Hardware Configuration</span>
              </button>
              <button
                type="button"
                onClick={checkPrintBridgeConnectivity}
                className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 transition flex items-center justify-center gap-2 cursor-pointer"
                title="Ping local print bridge server status"
              >
                {bridgeStatus === 'checking' ? (
                  <RefreshCw size={15} className="animate-spin text-slate-600" />
                ) : bridgeStatus === 'online' ? (
                  <Wifi size={15} className="text-emerald-600" />
                ) : bridgeStatus === 'offline' ? (
                  <AlertCircle size={15} className="text-rose-600" />
                ) : (
                  <Server size={15} className="text-slate-600" />
                )}
                <span>
                  {bridgeStatus === 'checking'
                    ? 'Testing...'
                    : bridgeStatus === 'online'
                    ? `Online (${bridgeLatency}ms)`
                    : bridgeStatus === 'offline'
                    ? 'Bridge Offline'
                    : 'Test Bridge'}
                </span>
              </button>
            </div>

            {/* Dynamic Multi-Printer Fleet Overview */}
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-black text-xs text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <span>Branch Multi-Printer Fleet</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-[#1e5c4f]">
                      {branchPrinters.length} active
                    </span>
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    {branches.length > 0 && (
                      <select
                        value={selectedBranchId}
                        onChange={e => setSelectedBranchId(e.target.value)}
                        className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-800 outline-hidden"
                      >
                        {branches.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleOpenAddPrinter}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1e5c4f] hover:bg-[#16473D] text-white font-bold text-xs shadow-xs transition cursor-pointer"
                    title="Add a new physical printer to this branch"
                  >
                    <Plus size={14} />
                    <span>Add Printer</span>
                  </button>

                  <a
                    href="http://localhost:5173/#/pos/printers"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold text-xs border border-slate-300 transition"
                    title="Open FLOW Admin Routing Matrix"
                  >
                    <ExternalLink size={12} />
                    <span>Matrix</span>
                  </a>
                </div>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {branchPrinters.length === 0 ? (
                  <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-center space-y-2">
                    <p className="text-xs text-slate-600 font-bold">No printers registered for this branch yet.</p>
                    <button
                      type="button"
                      onClick={handleOpenAddPrinter}
                      className="px-3 py-1.5 bg-[#1e5c4f] hover:bg-[#16473D] text-white rounded-xl text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={13} />
                      <span>Add First Printer</span>
                    </button>
                  </div>
                ) : (
                  branchPrinters.map(p => {
                    const assignedSections = sectionRoutes
                      .filter(r => r.printer_id === p.id)
                      .map(r => r.section_key);

                    return (
                      <div
                        key={p.id}
                        className="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100/70 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs transition"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 font-bold text-slate-900">
                            <span className="font-black text-sm">{p.name}</span>
                            {p.is_receipt_printer && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-indigo-100 text-indigo-800">
                                🧾 Main Bill
                              </span>
                            )}
                            {p.is_fallback && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-800">
                                ⚠️ Fallback
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {p.connection_type === 'windows_driver' || p.connection_type === 'usb' || Boolean((p as any).windows_printer_name)
                              ? `🔌 USB: ${(p as any).windows_printer_name || p.name}`
                              : `${p.ip_address}:${p.port || 9100}`} • {p.paper_width_mm}mm • role: {p.printer_role}
                          </div>
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {assignedSections.length > 0 ? (
                              assignedSections.map(sec => (
                                <span key={sec} className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-[#1e5c4f]">
                                  {sec}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">No preparation sections mapped</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            disabled={testingPrinterId === p.id}
                            onClick={() => handleTestPrint(p)}
                            className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-emerald-50 text-[#1e5c4f] border border-slate-200 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                            title="Print test chit on this physical printer"
                          >
                            <Play size={11} className={testingPrinterId === p.id ? 'animate-spin' : ''} />
                            <span>{testingPrinterId === p.id ? 'Testing...' : 'Test'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditPrinter(p)}
                            className="p-1.5 rounded-lg bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 transition cursor-pointer"
                            title="Edit printer settings and section routes"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePrinter(p)}
                            className="p-1.5 rounded-lg bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 transition cursor-pointer"
                            title="Delete printer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Store Operational Status & Discounts */}
        <div className="space-y-6">
          {/* Store Status Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#1e5c4f] border border-emerald-200 flex items-center justify-center font-bold">
                <Store size={20} />
              </div>
              <div>
                <h2 className="font-black text-base text-slate-900">
                  Store Operational Control
                </h2>
                <p className="text-xs text-slate-500 font-medium">Master branch opening and online ordering availability</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div>
                <div className="text-xs font-black text-slate-900">Current Branch Status</div>
                <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                  {isStoreOpen ? 'Branch is actively OPEN and accepting orders' : 'Branch is currently CLOSED'}
                </div>
              </div>
              <button
                type="button"
                disabled={storeStatusLoading}
                onClick={handleToggleStoreStatus}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  isStoreOpen 
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-rose-50 hover:text-rose-800 hover:border-rose-300' 
                    : 'bg-rose-50 text-rose-800 border border-rose-300 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300'
                }`}
              >
                {storeStatusLoading ? <RefreshCw size={14} className="animate-spin" /> : null}
                <span>{isStoreOpen ? '🟢 OPEN (Click to Close)' : '🔴 CLOSED (Click to Open)'}</span>
              </button>
            </div>
          </div>

          {/* Restaurant & Branch Discounts Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#1e5c4f] border border-emerald-200 flex items-center justify-center font-bold">
                <Tag size={20} />
              </div>
              <div>
                <h2 className="font-black text-base text-slate-900">
                  Restaurant & Branch Discounts
                </h2>
                <p className="text-xs text-slate-500 font-medium">{discountCount} active discounts configured for {restaurantName}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Define authorized cashier discounts, manager comp rules, and staff meal policies across all branches or specific pilot locations.
            </p>

            <button
              type="button"
              onClick={() => setIsDiscountManagerOpen(true)}
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <Tag size={16} className="text-[#1e5c4f]" />
              <span>🏷️ Manage Discounts & Branch Scopes</span>
            </button>
          </div>

          {/* Card 4: System Parameter Settings (Exchange Rate & VAT) */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#1e5c4f] border border-emerald-200 flex items-center justify-center font-bold text-lg">
                  💵
                </div>
                <div>
                  <h2 className="font-black text-base text-slate-900">
                    System Parameters & VAT
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">Exchange rate and VAT configuration for {restaurantName}</p>
                </div>
              </div>
              {systemSettingsSaved && (
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg animate-fade-in">
                  ✓ Saved
                </span>
              )}
            </div>

            <div className="space-y-4 text-xs">
              {/* USD to LBP Exchange Rate */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  USD to LBP Exchange Rate
                </label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(Number(e.target.value) || 0)}
                    placeholder="90000"
                    className="w-full bg-slate-50 border border-slate-300 focus:border-[#1e5c4f] focus:ring-1 focus:ring-[#1e5c4f] rounded-xl px-3.5 py-2.5 text-slate-900 font-mono font-bold text-sm outline-hidden transition"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs text-slate-500 font-bold">
                    LBP / $1
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block font-medium">
                  Synchronized with Admin System Settings for checkout conversions.
                </span>
              </div>

              {/* VAT Percentage & VAT Subscribed Switch */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    VAT Percentage (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={vatRate}
                      onChange={(e) => setVatRate(Number(e.target.value) || 0)}
                      placeholder="11"
                      className="w-full bg-slate-50 border border-slate-300 focus:border-[#1e5c4f] focus:ring-1 focus:ring-[#1e5c4f] rounded-xl px-3.5 py-2.5 text-slate-900 font-mono font-bold text-sm outline-hidden transition"
                    />
                    <span className="absolute right-3.5 top-2.5 text-xs text-slate-500 font-bold">
                      %
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    VAT Subscribed (Yes/No)
                  </label>
                  <div className="flex items-center gap-2.5 h-[42px] px-3 bg-slate-50 rounded-xl border border-slate-300">
                    <span className={`text-xs font-bold ${!isVatSubscribed ? 'text-slate-900' : 'text-slate-400'}`}>NO</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isVatSubscribed}
                        onChange={(e) => setIsVatSubscribed(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#1e5c4f]"></div>
                    </label>
                    <span className={`text-xs font-bold ${isVatSubscribed ? 'text-[#1e5c4f]' : 'text-slate-400'}`}>YES</span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  disabled={systemSettingsSaving}
                  onClick={handleSaveSystemSettings}
                  className="w-full py-3 bg-[#1e5c4f] hover:bg-[#16473D] text-white font-bold text-xs rounded-xl transition shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Save size={16} />
                  <span>{systemSettingsSaving ? 'Saving...' : '💾 Save System Parameters'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Card: Fiscal & Legal Registration (Managed in FLOW Admin) */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-sm md:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#1e5c4f] border border-emerald-200 flex items-center justify-center font-bold text-lg">
                <Building2 size={20} />
              </div>
              <div>
                <h2 className="font-black text-base text-slate-900">
                  Fiscal & Company Legal Registration
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Centrally administered in FLOW Admin &bull; Automatically synced to all POS receipts & chits
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-[#1e5c4f]" /> Synced from FLOW Admin
              </span>
              <a
                href="http://localhost:5173/#/company-settings"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-[#1e5c4f] bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition"
              >
                <span>Edit in Admin</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Company Legal Name
              </span>
              <div className="font-black text-slate-900 text-sm">
                {companyLegalName || 'Neo Beirut S.A.L.'}
              </div>
              <span className="text-[10px] text-slate-400 block">
                Official entity name on bills
              </span>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                MOF Number (Ministry of Finance)
              </span>
              <div className="font-mono font-black text-[#1e5c4f] text-sm">
                {mofNumber || '382910-601'}
              </div>
              <span className="text-[10px] text-slate-400 block">
                Tax registration number
              </span>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Restaurant Header Brand
              </span>
              <div className="font-black text-slate-900 text-sm">
                {receiptRestaurantName || 'Neo Beirut'}
              </div>
              <span className="text-[10px] text-slate-400 block">
                Bold headline on guest check
              </span>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Receipt Appreciation Note
              </span>
              <div className="font-medium text-slate-800 text-xs truncate">
                "{receiptFooterText || 'Thank you for dining with us!'}"
              </div>
              <span className="text-[10px] text-slate-400 block">
                Footer appreciation message
              </span>
            </div>
          </div>

          <div className="p-3.5 bg-slate-100 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <Lock size={15} className="text-slate-500 shrink-0" />
              <span>
                <strong>Admin Centralized Control:</strong> MOF number and company legal name cannot be modified from POS terminals. Configure them in <strong>FLOW Admin &rarr; Company &amp; Fiscal Settings</strong>.
              </span>
            </div>
            <a
              href="http://localhost:5173/#/company-settings"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 font-bold text-[11px] rounded-lg border border-slate-300 transition shrink-0 inline-flex items-center gap-1.5"
            >
              <span>Open Company Settings</span>
              <ExternalLink size={12} className="text-[#1e5c4f]" />
            </a>
          </div>
        </div>
      </div>

      {/* Discount Manager Modal */}
      <DiscountManagerModal
        isOpen={isDiscountManagerOpen}
        onClose={() => setIsDiscountManagerOpen(false)}
        restaurantId={currentRestaurantId}
        restaurantName={restaurantName}
        currentBranchId=""
        currentBranchName=""
        onDiscountsUpdated={() => {
          // Refresh discount count
          supabase
            .from('pos_discounts')
            .select('id')
            .eq('restaurant_id', currentRestaurantId)
            .then(({ data }) => {
              if (data) setDiscountCount(data.length);
            });
        }}
      />

      {/* Add / Edit Physical Printer Modal */}
      {isPrinterModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#1e5c4f] border border-emerald-200 flex items-center justify-center font-bold">
                  <Printer size={18} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">
                    {editingPrinter ? 'Edit Physical Printer' : 'Add New Physical Printer'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    ESC/POS Thermal Socket Configuration for {branches.find(b => b.id === selectedBranchId)?.name || 'Branch'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPrinterModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSavePrinter} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Printer Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kitchen Printer, Bar Printer, Main"
                  value={printerFormData.name}
                  onChange={e => setPrinterFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-[#1e5c4f] rounded-xl px-3 py-2 text-slate-900 font-bold outline-hidden transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Connection Protocol
                  </label>
                  <select
                    value={printerFormData.connection_type || 'network_raw'}
                    onChange={e => setPrinterFormData(prev => ({ ...prev, connection_type: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-[#1e5c4f] rounded-xl px-3 py-2 text-slate-900 font-bold outline-hidden transition cursor-pointer"
                  >
                    <option value="network_raw">Network Raw Socket (LAN 9100)</option>
                    <option value="windows_driver">Direct USB / Windows Driver (winspool.drv)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Printer Role
                  </label>
                  <select
                    value={printerFormData.printer_role}
                    onChange={e => setPrinterFormData(prev => ({ ...prev, printer_role: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-[#1e5c4f] rounded-xl px-3 py-2 text-slate-900 font-bold outline-hidden transition cursor-pointer"
                  >
                    <option value="kitchen">Kitchen</option>
                    <option value="bar">Bar</option>
                    <option value="pastry">Pastry</option>
                    <option value="bakery">Bakery</option>
                    <option value="main_bill">Main Bill / Cashier</option>
                    <option value="expo">Expo</option>
                  </select>
                </div>
              </div>

              {/* Conditional: USB Windows Spooler vs LAN IP Address */}
              {printerFormData.connection_type === 'windows_driver' || printerFormData.connection_type === 'usb' ? (
                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#1e5c4f] mb-1">
                    Windows USB Printer Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Generic / Text Only, EPSON TM-T20III, POS-80"
                    value={printerFormData.windows_printer_name || ''}
                    onChange={e => setPrinterFormData(prev => ({ ...prev, windows_printer_name: e.target.value }))}
                    className="w-full bg-white border border-emerald-300 focus:border-[#1e5c4f] rounded-xl px-3 py-2 text-slate-900 font-mono font-bold outline-hidden transition"
                  />
                  <p className="text-[10px] text-emerald-800">
                    Matches Windows <strong>Printers & Scanners</strong> device name. FLOW Print Server streams raw binary ESC/POS directly to the USB cable.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                      LAN IP Address *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="192.168.18.11"
                      value={printerFormData.ip_address}
                      onChange={e => setPrinterFormData(prev => ({ ...prev, ip_address: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-300 focus:border-[#1e5c4f] rounded-xl px-3 py-2 text-slate-900 font-mono font-bold outline-hidden transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Socket Port
                    </label>
                    <input
                      type="number"
                      value={printerFormData.port}
                      onChange={e => setPrinterFormData(prev => ({ ...prev, port: Number(e.target.value) }))}
                      className="w-full bg-slate-50 border border-slate-300 focus:border-[#1e5c4f] rounded-xl px-3 py-2 text-slate-900 font-mono font-bold outline-hidden transition"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Paper Width
                </label>
                <select
                  value={printerFormData.paper_width_mm}
                  onChange={e => setPrinterFormData(prev => ({ ...prev, paper_width_mm: Number(e.target.value) }))}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-[#1e5c4f] rounded-xl px-3 py-2 text-slate-900 font-bold outline-hidden transition cursor-pointer"
                >
                  <option value={80}>80 mm (Standard Thermal)</option>
                  <option value={58}>58 mm (Compact)</option>
                </select>
              </div>

              {/* Roles & Designations */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={printerFormData.is_receipt_printer}
                    onChange={e => setPrinterFormData(prev => ({ ...prev, is_receipt_printer: e.target.checked }))}
                    className="rounded text-[#1e5c4f] focus:ring-[#1e5c4f]"
                  />
                  <span>Designate as Main Customer Bill Printer</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={printerFormData.is_fallback}
                    onChange={e => setPrinterFormData(prev => ({ ...prev, is_fallback: e.target.checked }))}
                    className="rounded text-[#1e5c4f] focus:ring-[#1e5c4f]"
                  />
                  <span>Designate as Preparation Fallback Printer</span>
                </label>
              </div>

              {/* Assigned Preparation Sections */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Route Preparation Sections to This Printer:
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl">
                  {['Kitchen', 'Bar', 'Pastry', 'Bakery', 'Cold Kitchen', 'Hot Kitchen'].map(sec => {
                    const isChecked = printerFormData.assignedSections.includes(sec);
                    return (
                      <label key={sec} className="flex items-center gap-2 cursor-pointer text-[11px] font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            if (e.target.checked) {
                              setPrinterFormData(prev => ({ ...prev, assignedSections: [...prev.assignedSections, sec] }));
                            } else {
                              setPrinterFormData(prev => ({ ...prev, assignedSections: prev.assignedSections.filter(s => s !== sec) }));
                            }
                          }}
                          className="rounded text-[#1e5c4f] focus:ring-[#1e5c4f]"
                        />
                        <span>{sec}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsPrinterModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingPrinter}
                  className="px-5 py-2.5 rounded-xl bg-[#1e5c4f] hover:bg-[#16473D] text-white font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSavingPrinter ? 'Saving...' : editingPrinter ? 'Update Printer' : 'Save Printer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
