export interface CommerceBranchLink {
  id: string;
  restaurant_id: string;
  flow_branch_id: string;
  platform: 'ovrload' | string;
  external_branch_id: string;
  external_branch_name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
  flow_branch_name?: string;
}

export interface CommerceProductLink {
  id: string;
  restaurant_id: string;
  flow_recipe_id: string | null;
  platform: 'ovrload' | string;
  external_product_id: string;
  external_product_name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}
