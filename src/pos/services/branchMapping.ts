import { supabase } from '../../api/supabase';
import type { CommerceBranchLink } from '../types/commerce';

/**
 * Resolves a FLOW branch ID or name to its mapped external commerce branch.
 * Does NOT use branch names as integration keys; matches strictly via flow_branch_id
 * or resolves the branch name to its FLOW branch UUID first, then queries commerce_branch_links.
 */
export async function resolveCommerceBranchLink(
  flowBranchIdentifier: string,
  platform: string = 'ovrload'
): Promise<{ link: CommerceBranchLink | null; flowBranch: any | null; error?: string }> {
  try {
    if (!flowBranchIdentifier || flowBranchIdentifier === 'All') {
      return { link: null, flowBranch: null, error: 'No active branch selected' };
    }

    // Check if identifier is already a UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(flowBranchIdentifier);
    let branchId = flowBranchIdentifier;
    let flowBranch: any = null;

    if (!isUuid) {
      // Look up FLOW branch by name (case-insensitive)
      const { data: bData, error: bErr } = await supabase
        .from('branches')
        .select('*')
        .ilike('name', flowBranchIdentifier.trim())
        .limit(1);

      if (bData && bData.length > 0) {
        flowBranch = bData[0];
        branchId = flowBranch.id;
      }
    } else {
      const { data: bData } = await supabase
        .from('branches')
        .select('*')
        .eq('id', branchId)
        .limit(1);
      if (bData && bData.length > 0) flowBranch = bData[0];
    }

    // Query explicit mapping in commerce_branch_links
    let query = supabase
      .from('commerce_branch_links')
      .select('*')
      .eq('platform', platform)
      .eq('active', true);

    if (isUuid) {
      query = query.eq('flow_branch_id', branchId);
    } else if (flowBranch?.id) {
      query = query.or(`flow_branch_id.eq.${flowBranch.id},flow_branch_name.ilike.%${flowBranchIdentifier.trim()}%,external_branch_name.ilike.%${flowBranchIdentifier.trim()}%`);
    } else {
      query = query.or(`flow_branch_name.ilike.%${flowBranchIdentifier.trim()}%,external_branch_name.ilike.%${flowBranchIdentifier.trim()}%,location_key.ilike.%${flowBranchIdentifier.trim()}%`);
    }

    const { data: linkData, error: linkErr } = await query.limit(1);

    if (linkErr) {
      return { link: null, flowBranch, error: linkErr.message };
    }

    if (!linkData || linkData.length === 0) {
      return { 
        link: null, 
        flowBranch, 
        error: `Branch "${flowBranchIdentifier}" is not mapped to an external commerce branch in commerce_branch_links.` 
      };
    }

    const link: CommerceBranchLink = {
      ...linkData[0],
      flow_branch_name: linkData[0].flow_branch_name || flowBranchIdentifier
    };

    return { link, flowBranch };
  } catch (err: any) {
    return { link: null, flowBranch: null, error: err.message || 'Error resolving branch link' };
  }
}

export interface BranchCapabilities {
  branchId: string;
  branchName: string;
  dine_in: boolean;
  table_service: boolean;
}

/**
 * Queries branch capabilities by explicit FLOW branch UUID (or name fallback).
 * Authoritatively determines whether table_service and dine_in are active for the terminal.
 */
export async function getBranchCapabilities(
  branchIdentifier?: string
): Promise<{ success: boolean; capabilities: BranchCapabilities | null; error?: string }> {
  try {
    if (!branchIdentifier) {
      return { success: false, capabilities: null, error: 'No branch identifier provided' };
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(branchIdentifier);
    let query = supabase.from('branches').select('id, name, dine_in, table_service, total_tables');

    if (isUuid) {
      query = query.eq('id', branchIdentifier);
    } else {
      query = query.ilike('name', branchIdentifier);
    }

    const { data, error } = await query.limit(1);
    if (error || !data || data.length === 0) {
      // Fallback: check commerce_branch_links
      let linkQuery = supabase.from('commerce_branch_links').select('*').eq('active', true);
      if (isUuid) {
        linkQuery = linkQuery.eq('flow_branch_id', branchIdentifier);
      } else {
        linkQuery = linkQuery.or(`flow_branch_name.ilike.%${branchIdentifier}%,external_branch_name.ilike.%${branchIdentifier}%`);
      }
      const { data: linkData } = await linkQuery.limit(1);
      if (linkData && linkData.length > 0) {
        const link = linkData[0];
        const isCloudKitchen = link.location_key === 'cloud-kitchen' || String(link.flow_branch_name || '').toLowerCase().includes('cloud kitchen');
        return {
          success: true,
          capabilities: {
            branchId: link.flow_branch_id,
            branchName: link.flow_branch_name,
            dine_in: !isCloudKitchen,
            table_service: !isCloudKitchen
          }
        };
      }

      if (String(branchIdentifier).toLowerCase().includes('cloud kitchen')) {
        return {
          success: true,
          capabilities: {
            branchId: 'b6657434-9c49-43f6-8d8d-aeec69a261db',
            branchName: 'Cloud Kitchen',
            dine_in: false,
            table_service: false
          }
        };
      }
      return { success: false, capabilities: null, error: error?.message || 'Branch not found' };
    }

    const b = data[0];
    return {
      success: true,
      capabilities: {
        branchId: b.id,
        branchName: b.name,
        dine_in: Boolean(b.dine_in),
        table_service: Boolean(b.table_service)
      }
    };
  } catch (err: any) {
    return { success: false, capabilities: null, error: err.message };
  }
}
