import { supabase } from '../../api/supabase';
import type { CommerceBranchLink } from '../types/commerce';

/**
 * Resolves a FLOW branch ID or name to its mapped external commerce branch.
 */
export async function resolveCommerceBranchLink(
  flowBranchIdentifier: string,
  platform?: string
): Promise<{ link: CommerceBranchLink | null; flowBranch: any | null; error?: string }> {
  try {
    if (!flowBranchIdentifier || flowBranchIdentifier === 'All') {
      // Return first active branch link as default
      const { data: firstLink } = await supabase
        .from('commerce_branch_links')
        .select('*')
        .eq('active', true)
        .limit(1);

      if (firstLink && firstLink.length > 0) {
        return { link: firstLink[0], flowBranch: null };
      }
      return { link: null, flowBranch: null, error: 'No active branch selected' };
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(flowBranchIdentifier);
    let branchId = flowBranchIdentifier;
    let flowBranch: any = null;

    if (!isUuid) {
      const { data: bData } = await supabase
        .from('branches')
        .select('*')
        .ilike('name', `%${flowBranchIdentifier.trim()}%`)
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

    let query = supabase
      .from('commerce_branch_links')
      .select('*')
      .eq('active', true);

    if (platform) {
      query = query.eq('platform', platform);
    }

    const { data: linkData, error: linkErr } = await query;

    if (linkData && linkData.length > 0) {
      const matched = linkData.find(l => 
        l.flow_branch_id === branchId ||
        l.external_branch_id === String(branchId) ||
        (l.flow_branch_name && l.flow_branch_name.toLowerCase().includes(flowBranchIdentifier.toLowerCase())) ||
        (l.external_branch_name && l.external_branch_name.toLowerCase().includes(flowBranchIdentifier.toLowerCase()))
      ) || linkData[0];

      const link: CommerceBranchLink = {
        ...matched,
        flow_branch_name: matched.flow_branch_name || flowBranchIdentifier
      };
      return { link, flowBranch };
    }

    // Default fallback link if branch has no link
    return {
      link: {
        id: 'default-link',
        restaurant_id: flowBranch?.restaurant_id || '',
        flow_branch_id: String(branchId),
        flow_branch_name: flowBranch?.name || flowBranchIdentifier,
        external_branch_id: '1',
        external_branch_name: flowBranch?.name || flowBranchIdentifier,
        platform: 'flow',
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      flowBranch
    };
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

export async function getBranchCapabilities(
  branchIdentifier?: string
): Promise<{ success: boolean; capabilities: BranchCapabilities | null; error?: string }> {
  try {
    return {
      success: true,
      capabilities: {
        branchId: branchIdentifier || '1',
        branchName: branchIdentifier || 'Main Branch',
        dine_in: true,
        table_service: true
      }
    };
  } catch (err: any) {
    return { success: false, capabilities: null, error: err.message };
  }
}
