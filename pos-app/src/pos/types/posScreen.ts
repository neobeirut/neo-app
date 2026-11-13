export interface PosScreenButton {
  id: string;
  label: string;
  type: 'screen' | 'product';
  targetScreenId?: string;
  productId?: string | number;
  color?: string;
  sortOrder: number;
}

export interface PosScreen {
  id: string;
  name: string;
  isRoot?: boolean;
  buttons: PosScreenButton[];
  gridCols?: number; // 4 to 7 (or undefined for dynamic auto)
  gridRows?: number; // 5 to 7 (or undefined for dynamic auto)
}

export interface PosScreenLayoutConfig {
  screens: PosScreen[];
  updatedAt?: string;
  updatedBy?: string;
}
