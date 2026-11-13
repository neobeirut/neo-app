import { supabase, getRestaurantId } from './supabase';

export interface PosPrinter {
  id: string;
  restaurant_id: string;
  branch_id: string;
  name: string;
  printer_role: string;
  connection_type: string;
  windows_printer_name?: string | null;
  ip_address: string;
  port: number;
  is_active: boolean;
  is_receipt_printer: boolean;
  is_fallback: boolean;
  paper_width_mm: number;
  status: 'online' | 'offline' | 'unknown' | 'error';
  last_seen_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PosPrinterSectionRoute {
  id: string;
  restaurant_id: string;
  branch_id: string;
  section_key: string;
  print_preparation_ticket: boolean;
  printer_id: string | null;
  is_default: boolean;
  printer?: PosPrinter;
}

export interface PosPrintJob {
  id: string;
  restaurant_id: string;
  branch_id: string;
  order_id?: number;
  printer_id?: string;
  section_key: string;
  job_type: 'prep_ticket' | 'modification' | 'cancellation' | 'reprint' | 'receipt' | 'pre_check' | 'test';
  ticket_number?: string;
  status: 'pending' | 'sent' | 'confirmed' | 'failed' | 'cancelled';
  payload: any;
  retry_count: number;
  error_message?: string;
  idempotency_key?: string;
  created_by?: string;
  completed_at?: string;
  created_at: string;
  printer?: PosPrinter;
}

export interface CatalogProductCoverage {
  id: number;
  name: string;
  category_id: number | null;
  category_name: string;
  category_section: string | null;
  explicit_section: string | null;
  resolved_section: string;
  prep_print_override: 'PRINT' | 'NO_PRINT' | null;
  is_no_print: boolean;
  assigned_printer_name: string | null;
  assigned_printer_id: string | null;
  is_unassigned: boolean;
  is_fallback: boolean;
}

export const printerApi = {
  // --- Printers CRUD ---
  getPrinters: async (branchId?: string, user?: any): Promise<{ success: boolean; data: PosPrinter[]; error?: string }> => {
    try {
      const rId = getRestaurantId(user);
      let query = supabase
        .from('pos_printers')
        .select('*')
        .eq('restaurant_id', rId)
        .order('name');

      if (branchId && branchId !== 'all') {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return { success: true, data: (data || []) as PosPrinter[] };
    } catch (err: any) {
      console.error('getPrinters error:', err);
      return { success: false, data: [], error: err.message };
    }
  },

  createPrinter: async (printer: Partial<PosPrinter>, user?: any): Promise<{ success: boolean; data?: PosPrinter; error?: string }> => {
    try {
      const rId = getRestaurantId(user);
      const payload: any = {
        restaurant_id: rId,
        branch_id: printer.branch_id,
        name: printer.name?.trim(),
        printer_role: printer.printer_role || 'kitchen',
        connection_type: printer.connection_type || 'network_raw',
        ip_address: printer.ip_address?.trim() || null,
        port: Number(printer.port) || 9100,
        is_active: printer.is_active !== false,
        is_receipt_printer: Boolean(printer.is_receipt_printer),
        is_fallback: Boolean(printer.is_fallback),
        paper_width_mm: Number(printer.paper_width_mm) || 80,
        status: printer.status || 'unknown'
      };

      // If set as receipt printer or fallback, manage single flag per branch if requested
      if (payload.is_receipt_printer && payload.branch_id) {
        await supabase
          .from('pos_printers')
          .update({ is_receipt_printer: false })
          .eq('branch_id', payload.branch_id)
          .eq('restaurant_id', rId);
      }

      const { data, error } = await supabase
        .from('pos_printers')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data: data as PosPrinter };
    } catch (err: any) {
      console.error('createPrinter error:', err);
      return { success: false, error: err.message };
    }
  },

  updatePrinter: async (id: string, printer: Partial<PosPrinter>, user?: any): Promise<{ success: boolean; data?: PosPrinter; error?: string }> => {
    try {
      const rId = getRestaurantId(user);
      const payload: any = {
        updated_at: new Date().toISOString()
      };

      if (printer.name !== undefined) payload.name = printer.name.trim();
      if (printer.printer_role !== undefined) payload.printer_role = printer.printer_role;
      if (printer.connection_type !== undefined) payload.connection_type = printer.connection_type;
      if (printer.ip_address !== undefined) payload.ip_address = printer.ip_address?.trim() || null;
      if (printer.port !== undefined) payload.port = Number(printer.port);
      if (printer.is_active !== undefined) payload.is_active = Boolean(printer.is_active);
      if (printer.is_receipt_printer !== undefined) payload.is_receipt_printer = Boolean(printer.is_receipt_printer);
      if (printer.is_fallback !== undefined) payload.is_fallback = Boolean(printer.is_fallback);
      if (printer.paper_width_mm !== undefined) payload.paper_width_mm = Number(printer.paper_width_mm);
      if (printer.status !== undefined) payload.status = printer.status;
      if (printer.branch_id !== undefined) payload.branch_id = printer.branch_id;

      if (payload.is_receipt_printer && printer.branch_id) {
        await supabase
          .from('pos_printers')
          .update({ is_receipt_printer: false })
          .eq('branch_id', printer.branch_id)
          .eq('restaurant_id', rId)
          .neq('id', id);
      }

      const { data, error } = await supabase
        .from('pos_printers')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data: data as PosPrinter };
    } catch (err: any) {
      console.error('updatePrinter error:', err);
      return { success: false, error: err.message };
    }
  },

  deletePrinter: async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('pos_printers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('deletePrinter error:', err);
      return { success: false, error: err.message };
    }
  },

  // --- Section Routes ---
  getSectionRoutes: async (branchId?: string, user?: any): Promise<{ success: boolean; data: PosPrinterSectionRoute[]; error?: string }> => {
    try {
      const rId = getRestaurantId(user);
      let query = supabase
        .from('pos_printer_section_routes')
        .select('*, printer:pos_printers(*)')
        .eq('restaurant_id', rId)
        .order('section_key');

      if (branchId && branchId !== 'all') {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return { success: true, data: (data || []) as PosPrinterSectionRoute[] };
    } catch (err: any) {
      console.error('getSectionRoutes error:', err);
      return { success: false, data: [], error: err.message };
    }
  },

  upsertSectionRoute: async (route: {
    branch_id: string;
    section_key: string;
    print_preparation_ticket: boolean;
    printer_id: string | null;
  }, user?: any): Promise<{ success: boolean; error?: string }> => {
    try {
      const rId = getRestaurantId(user);
      const { error } = await supabase
        .from('pos_printer_section_routes')
        .upsert({
          restaurant_id: rId,
          branch_id: route.branch_id,
          section_key: route.section_key,
          print_preparation_ticket: Boolean(route.print_preparation_ticket),
          printer_id: route.print_preparation_ticket ? route.printer_id : null,
          is_default: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'branch_id,section_key'
        });

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('upsertSectionRoute error:', err);
      return { success: false, error: err.message };
    }
  },

  // --- Catalog Preparation Section Coverage ---
  getCatalogCoverage: async (branchId?: string, user?: any): Promise<{
    success: boolean;
    totalProducts: number;
    routedCount: number;
    noPrintCount: number;
    unassignedCount: number;
    products: CatalogProductCoverage[];
    fallbackPrinter?: PosPrinter | null;
    mainBillPrinter?: PosPrinter | null;
    error?: string;
  }> => {
    try {
      const rId = getRestaurantId(user);
      const [prodsRes, catsRes, printersRes, routesRes] = await Promise.all([
        supabase.from('products').select('id, name, category_id, preparation_section, prep_print_override, is_active').eq('restaurant_id', rId).order('name'),
        supabase.from('categories').select('id, name, section').order('id'),
        supabase.from('pos_printers').select('*').eq('restaurant_id', rId),
        supabase.from('pos_printer_section_routes').select('*, printer:pos_printers(*)').eq('restaurant_id', rId)
      ]);

      if (prodsRes.error) throw prodsRes.error;
      const products = prodsRes.data || [];
      const categories = catsRes.data || [];
      const printers: PosPrinter[] = printersRes.data || [];
      const allRoutes: PosPrinterSectionRoute[] = routesRes.data || [];

      const targetBranch = branchId && branchId !== 'all' ? branchId : printers[0]?.branch_id;
      const branchRoutes = allRoutes.filter(r => !targetBranch || r.branch_id === targetBranch);
      const branchPrinters = printers.filter(p => !targetBranch || p.branch_id === targetBranch);

      const fallbackPrinter = branchPrinters.find(p => p.is_fallback) || branchPrinters.find(p => p.name.toLowerCase().includes('kitchen')) || null;
      const mainBillPrinter = branchPrinters.find(p => p.is_receipt_printer) || branchPrinters.find(p => p.name.toLowerCase() === 'main') || null;

      const catMap = new Map<number, { name: string; section: string | null }>();
      categories.forEach(c => catMap.set(c.id, { name: c.name, section: c.section }));

      const routeMap = new Map<string, PosPrinterSectionRoute>();
      branchRoutes.forEach(r => routeMap.set(r.section_key.toLowerCase(), r));

      let routedCount = 0;
      let noPrintCount = 0;
      let unassignedCount = 0;

      const mappedProducts: CatalogProductCoverage[] = products.map((p: any) => {
        const cat = p.category_id ? catMap.get(p.category_id) : null;
        const catName = cat?.name || 'Uncategorized';
        const catSection = cat?.section || null;

        // Resolve preparation section
        let resolved = p.preparation_section || '';
        if (!resolved) {
          const lowerName = (p.name + ' ' + catName).toLowerCase();
          if (/\b(coffee|espresso|latte|cappuccino|tea|teas|juice|drinks|beverage|cocktail|beer|wine|vodka|gin|whisky|mocktail|tonic|water|soda)\b/i.test(lowerName)) {
            resolved = 'Bar';
          } else if (/\b(cake|cakes|pastry|croissant|croissants|cookie|cookies|brownie|eclair|tart|tarte|dessert|bakery)\b/i.test(lowerName)) {
            resolved = 'Pastry';
          } else if (catSection === 'Store' || catSection === 'Retail' || /\b(pack|retail|merch|beans)\b/i.test(lowerName)) {
            resolved = 'Store';
          } else if (catSection === 'Bar') {
            resolved = 'Bar';
          } else if (catSection === 'Kitchen' || catSection === 'Bistro' || /\b(salad|sandwich|starter|omelette|wrap|burger|fries|main)\b/i.test(lowerName)) {
            resolved = 'Kitchen';
          } else {
            resolved = 'Unassigned';
          }
        }

        // Determine No-Print rule
        const isStoreOrRetail = resolved.toLowerCase() === 'store' || resolved.toLowerCase() === 'retail';
        const route = routeMap.get(resolved.toLowerCase());

        let isNoPrint = false;
        if (p.prep_print_override === 'NO_PRINT') {
          isNoPrint = true;
        } else if (p.prep_print_override === 'PRINT') {
          isNoPrint = false;
        } else if (route) {
          isNoPrint = route.print_preparation_ticket === false;
        } else if (isStoreOrRetail) {
          isNoPrint = true;
        }

        // Determine destination printer
        let assignedPrinterName = null;
        let assignedPrinterId = null;
        let isFallback = false;
        let isUnassigned = false;

        if (isNoPrint) {
          noPrintCount++;
        } else if (route && route.printer) {
          assignedPrinterName = route.printer.name;
          assignedPrinterId = route.printer.id;
          routedCount++;
        } else if (resolved !== 'Unassigned') {
          // Has section, but no printer route defined in this branch -> uses fallback
          isFallback = true;
          assignedPrinterName = fallbackPrinter ? `${fallbackPrinter.name} (Fallback)` : 'Unconfigured';
          assignedPrinterId = fallbackPrinter?.id || null;
          routedCount++;
        } else {
          isUnassigned = true;
          unassignedCount++;
          assignedPrinterName = fallbackPrinter ? `${fallbackPrinter.name} (Warning: Fallback)` : 'None';
          assignedPrinterId = fallbackPrinter?.id || null;
        }

        return {
          id: p.id,
          name: p.name,
          category_id: p.category_id,
          category_name: catName,
          category_section: catSection,
          explicit_section: p.preparation_section || null,
          resolved_section: resolved,
          prep_print_override: p.prep_print_override || null,
          is_no_print: isNoPrint,
          assigned_printer_name: assignedPrinterName,
          assigned_printer_id: assignedPrinterId,
          is_unassigned: isUnassigned,
          is_fallback: isFallback
        };
      });

      return {
        success: true,
        totalProducts: products.length,
        routedCount,
        noPrintCount,
        unassignedCount,
        products: mappedProducts,
        fallbackPrinter,
        mainBillPrinter
      };
    } catch (err: any) {
      console.error('getCatalogCoverage error:', err);
      return {
        success: false,
        totalProducts: 0,
        routedCount: 0,
        noPrintCount: 0,
        unassignedCount: 0,
        products: [],
        error: err.message
      };
    }
  },

  batchAssignProductSections: async (
    productIds: number[], 
    section: string, 
    override?: 'PRINT' | 'NO_PRINT' | null,
    user?: any
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const updates: any = {
        preparation_section: section,
        updated_at: new Date().toISOString()
      };
      if (override !== undefined) {
        updates.prep_print_override = override;
      }

      const { error } = await supabase
        .from('products')
        .update(updates)
        .in('id', productIds);

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('batchAssignProductSections error:', err);
      return { success: false, error: err.message };
    }
  },

  // --- Print Jobs Queue & Audit ---
  getPrintJobs: async (filters?: {
    branchId?: string;
    status?: string;
    jobType?: string;
    limit?: number;
  }, user?: any): Promise<{ success: boolean; data: PosPrintJob[]; error?: string }> => {
    try {
      const rId = getRestaurantId(user);
      let query = supabase
        .from('pos_print_jobs')
        .select('*, printer:pos_printers(*)')
        .eq('restaurant_id', rId)
        .order('created_at', { ascending: false });

      if (filters?.branchId && filters.branchId !== 'all') {
        query = query.eq('branch_id', filters.branchId);
      }
      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters?.jobType && filters.jobType !== 'all') {
        query = query.eq('job_type', filters.jobType);
      }

      const limit = filters?.limit || 50;
      query = query.limit(limit);

      const { data, error } = await query;
      if (error) throw error;
      return { success: true, data: (data || []) as PosPrintJob[] };
    } catch (err: any) {
      console.error('getPrintJobs error:', err);
      return { success: false, data: [], error: err.message };
    }
  },

  retryPrintJob: async (jobId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data: job, error: getErr } = await supabase
        .from('pos_print_jobs')
        .select('*, printer:pos_printers(*)')
        .eq('id', jobId)
        .single();

      if (getErr || !job) throw new Error(getErr?.message || 'Job not found');

      // Update retry count and set back to pending
      await supabase
        .from('pos_print_jobs')
        .update({
          status: 'pending',
          retry_count: (job.retry_count || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      // Attempt immediate dispatch via print server if reachable
      if (job.printer && job.payload) {
        const ip = localStorage.getItem('flow_pos_print_server_ip') || '192.168.18.195';
        const port = localStorage.getItem('flow_pos_print_server_port') || '9191';
        try {
          const res = await fetch(`http://${ip}:${port}/print`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              destination: job.printer.name,
              printer: { host: job.printer.ip_address, port: job.printer.port },
              content: job.payload,
              job_type: job.job_type,
              idempotency_key: job.idempotency_key + '_retry_' + (job.retry_count + 1)
            }),
            signal: AbortSignal.timeout(3000)
          });
          if (res.ok) {
            await supabase
              .from('pos_print_jobs')
              .update({ status: 'confirmed', completed_at: new Date().toISOString() })
              .eq('id', jobId);
            return { success: true };
          }
        } catch (e: any) {
          await supabase
            .from('pos_print_jobs')
            .update({ status: 'failed', error_message: e.message })
            .eq('id', jobId);
        }
      }

      return { success: true };
    } catch (err: any) {
      console.error('retryPrintJob error:', err);
      return { success: false, error: err.message };
    }
  },

  testPrinterConnection: async (printer: {
    id?: string;
    branch_id?: string;
    ip_address?: string;
    port?: number;
    name?: string;
    connection_type?: string;
    windows_printer_name?: string;
  }): Promise<{ success: boolean; message: string }> => {
    try {
      const isUsb = printer.connection_type === 'windows_driver' || printer.connection_type === 'usb' || Boolean(printer.windows_printer_name);
      if (!isUsb && !printer.ip_address) {
        return { success: false, message: 'Printer IP address or Windows printer name is required.' };
      }

      const defaultHost = (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== '192.168.18.195') ? window.location.hostname : '127.0.0.1';
      let storedIp = localStorage.getItem('flow_pos_print_server_ip');
      if (storedIp === '192.168.18.195') storedIp = null; // Clean legacy placeholder
      const bridgeIp = storedIp || defaultHost;
      const bridgePort = localStorage.getItem('flow_pos_print_server_port') || '9191';

      // Send a test chit payload through the print bridge
      const testPayload = {
        printer: {
          name: printer.name || 'Test Printer',
          host: printer.ip_address,
          port: printer.port || 9100,
          connection_type: printer.connection_type || (isUsb ? 'windows_driver' : 'network_raw'),
          windows_printer_name: printer.windows_printer_name || printer.name
        },
        destination: printer.name || 'Test Printer',
        job_type: 'test_print',
        idempotency_key: `test_${printer.id || 'manual'}_${Date.now()}`,
        content: {
          type: 'test_chit',
          isKitchenTicket: true,
          title: '*** FLOW TEST CHIT ***',
          printer_name: printer.name || 'Test Printer',
          printer_ip: printer.ip_address,
          printer_port: printer.port || 9100,
          timestamp: new Date().toLocaleString(),
          items: [
            { name: 'Hardware Connection Verified', qty: 1, note: isUsb ? `USB Spooler: ${printer.windows_printer_name || printer.name}` : `Socket: ${printer.ip_address}:${printer.port || 9100}` },
            { name: 'Status: ONLINE & RESPONSIVE', qty: 1 }
          ]
        }
      };

      try {
        const res = await fetch(`http://${bridgeIp}:${bridgePort}/print`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testPayload),
          signal: AbortSignal.timeout(3000)
        });

        if (res.ok) {
          return { success: true, message: `Successfully sent test ticket to ${printer.name || printer.ip_address} via Local Bridge!` };
        }
      } catch (localErr) {
        console.warn('Local LAN bridge direct fetch failed, failing over to Cloud Queue:', localErr);
      }

      // Failover: Queue to Cloud pos_print_jobs table
      if (printer.id) {
        const { error: queueErr } = await supabase.from('pos_print_jobs').insert({
          restaurant_id: getRestaurantId(),
          branch_id: printer.branch_id || '9c214659-9cc7-4f33-b115-cbbb8a823a94',
          printer_id: printer.id,
          section_key: 'Test',
          job_type: 'prep_ticket',
          status: 'pending',
          payload: testPayload.content,
          idempotency_key: testPayload.idempotency_key
        });

        if (!queueErr) {
          return {
            success: true,
            message: `Dispatched test ticket to ${printer.name} via Cloud Print Queue! Physical cut will complete in ~2s.`
          };
        }
      }

      return {
        success: false,
        message: `Could not reach printer via print server bridge on http://${bridgeIp}:${bridgePort}. Ensure FLOW Print Server is running.`
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Test print error: ${err.message}`
      };
    }
  }
};
