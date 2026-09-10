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
      // Look up FLOW branch by exact name
      const { data: bData, error: bErr } = await supabase
        .from('branches')
        .select('*')
        .eq('name', flowBranchIdentifier)
        .limit(1);

      if (bErr || !bData || bData.length === 0) {
        return { link: null, flowBranch: null, error: `FLOW branch "${flowBranchIdentifier}" not found` };
      }
      flowBranch = bData[0];
      branchId = flowBranch.id;
    } else {
      const { data: bData } = await supabase
        .from('branches')
        .select('*')
        .eq('id', branchId)
        .limit(1);
      if (bData && bData.length > 0) flowBranch = bData[0];
    }

    // Query explicit ID mapping in commerce_branch_links
    let query = supabase
      .from('commerce_branch_links')
      .select('*')
      .eq('platform', platform)
      .eq('active', true);

    if (isUuid) {
      query = query.eq('flow_branch_id', flowBranchIdentifier);
    } else {
      query = query.ilike('flow_branch_name', flowBranchIdentifier);
    }

    const { data: linkData, error: linkErr } = await query.limit(1);

    if (linkErr) {
      return { link: null, flowBranch: null, error: linkErr.message };
    }

    if (!linkData || linkData.length === 0) {
      return { 
        link: null, 
        flowBranch: null, 
        error: `Branch "${flowBranchIdentifier}" is not mapped to an external commerce branch in commerce_branch_links.` 
      };
    }

    const link: CommerceBranchLink = {
      ...linkData[0],
      flow_branch_name: linkData[0].flow_branch_name || flowBranchIdentifier
    };

    return { link, flowBranch: null };
  } catch (err: any) {
    return { link: null, flowBranch: null, error: err.message || 'Error resolving branch link' };
  }
}
