import * as XLSX from 'xlsx';
import { conversionFactor, canonicalUnit } from './inventoryConfiguration';

export interface ParsedRecipeIngredient {
  recipeName?: string;
  item_id: string;
  item_name: string;
  base_quantity: number;
  unit: string;
  location_id?: string;
  waste_percentage: number;
  notes?: string;
  base_unit: string;
  converted_base_qty: number;
}

export interface ParsedPackagingOption {
  item_id: string;
  item_name: string;
  brand?: string;
  supplier_id?: string;
  supplier_name?: string;
  purchase_unit: string;
  pack_size: number;
  base_unit: string;
  price?: number;
  is_default: boolean;
}

/**
 * Generates and downloads an Excel template for recipes/BOM ingredients.
 */
export function generateRecipeTemplate(items: any[] = []): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Recipe Ingredients Template
  const sampleRows = [
    {
      'Recipe Name': 'Caesar Salad',
      'Ingredient Item Name': 'Mayonnaise',
      'Quantity': 80,
      'Unit': 'g',
      'Location': 'Main Kitchen',
      'Waste %': 0,
      'Notes': 'Example: 80 g preferred recipe unit (Base: kg)'
    },
    {
      'Recipe Name': 'Caesar Salad',
      'Ingredient Item Name': 'Chicken Breast',
      'Quantity': 150,
      'Unit': 'g',
      'Location': 'Cold Room / Fridge',
      'Waste %': 2.5,
      'Notes': 'Example: 150 g converts to 0.15 kg base unit'
    },
    {
      'Recipe Name': 'Caesar Salad',
      'Ingredient Item Name': 'Parmesan',
      'Quantity': 30,
      'Unit': 'g',
      'Location': 'Main Kitchen',
      'Waste %': 0,
      'Notes': 'Example: 30 g grated cheese'
    }
  ];

  const wsRecipes = XLSX.utils.json_to_sheet(sampleRows);
  wsRecipes['!cols'] = [
    { wch: 20 },
    { wch: 25 },
    { wch: 12 },
    { wch: 10 },
    { wch: 18 },
    { wch: 10 },
    { wch: 45 }
  ];
  XLSX.utils.book_append_sheet(wb, wsRecipes, 'Recipe Ingredients');

  // Sheet 2: Catalog Items & Units Reference
  const catalogReference = items.map(item => ({
    'Item Name': item.name,
    'Base Unit (Inventory)': item.base_unit || item.unit || 'pcs',
    'Preferred Recipe Unit': item.preferred_recipe_unit || item.base_unit || item.unit || 'pcs',
    'Department': item.department || 'General'
  }));

  const wsReference = XLSX.utils.json_to_sheet(
    catalogReference.length > 0
      ? catalogReference
      : [{ 'Item Name': 'No items found', 'Base Unit (Inventory)': '', 'Preferred Recipe Unit': '', 'Department': '' }]
  );
  wsReference['!cols'] = [{ wch: 28 }, { wch: 22 }, { wch: 22 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsReference, 'Approved Items Reference');

  XLSX.writeFile(wb, `Recipe_Ingredients_Import_Template.xlsx`);
}

/**
 * Parses an Excel or CSV file of recipe ingredients and validates unit conversions against item base units.
 */
export async function parseRecipeExcelOrCsv(
  file: File,
  items: any[],
  conversions: any[] = [],
  packagingOptions: any[] = []
): Promise<{ success: boolean; data: ParsedRecipeIngredient[]; errors: string[]; recipeName?: string }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const wb = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rawRows: any[] = XLSX.utils.sheet_to_json(ws);

    if (!rawRows || rawRows.length === 0) {
      return { success: false, data: [], errors: ['Uploaded spreadsheet is empty or has no data rows.'] };
    }

    const errors: string[] = [];
    const parsedData: ParsedRecipeIngredient[] = [];
    let detectedRecipeName = '';

    rawRows.forEach((row, rowIndex) => {
      const rowNum = rowIndex + 2; // header is row 1
      const recipeName = String(row['Recipe Name'] || row['recipe_name'] || '').trim();
      const itemName = String(
        row['Ingredient Item Name'] || row['Item Name'] || row['item_name'] || row['Ingredient'] || ''
      ).trim();
      const rawQty = row['Quantity'] !== undefined ? row['Quantity'] : row['qty'];
      const rawUnit = String(row['Unit'] || row['unit'] || '').trim();
      const rawWaste = row['Waste %'] !== undefined ? row['Waste %'] : (row['waste_percentage'] || 0);
      const notes = String(row['Notes'] || row['notes'] || '').trim();

      if (!detectedRecipeName && recipeName) {
        detectedRecipeName = recipeName;
      }

      if (!itemName) {
        // Skip blank rows
        return;
      }

      // 1. Locate Item in Catalog
      const itemMatch = items.find(
        i => i.name.trim().toLowerCase() === itemName.toLowerCase()
      );

      if (!itemMatch) {
        errors.push(`Row ${rowNum}: Item "${itemName}" was not found in your inventory catalog.`);
        return;
      }

      // 2. Validate Quantity
      const qtyNum = Number(rawQty);
      if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
        errors.push(`Row ${rowNum} (${itemName}): Quantity must be a positive number (found "${rawQty}").`);
        return;
      }

      // 3. Validate Unit & Conversion
      const targetBaseUnit = itemMatch.base_unit || itemMatch.unit || 'pcs';
      const inputUnit = rawUnit || itemMatch.preferred_recipe_unit || targetBaseUnit;

      const factor = conversionFactor(itemMatch.id, inputUnit, targetBaseUnit, conversions, packagingOptions);
      if (factor === null) {
        errors.push(
          `Row ${rowNum} (${itemName}): Unit "${inputUnit}" cannot convert to inventory base unit "${targetBaseUnit}". Add an item unit conversion or choose a compatible unit.`
        );
        return;
      }

      const wasteNum = Number(rawWaste) || 0;
      const convertedBaseQty = Number((qtyNum * factor).toFixed(4));

      parsedData.push({
        recipeName: recipeName || detectedRecipeName,
        item_id: itemMatch.id,
        item_name: itemMatch.name,
        base_quantity: qtyNum,
        unit: inputUnit,
        waste_percentage: Math.max(0, Math.min(99.9, wasteNum)),
        notes,
        base_unit: targetBaseUnit,
        converted_base_qty: convertedBaseQty
      });
    });

    if (errors.length > 0) {
      return { success: false, data: parsedData, errors, recipeName: detectedRecipeName };
    }

    return { success: true, data: parsedData, errors: [], recipeName: detectedRecipeName };
  } catch (err: any) {
    return { success: false, data: [], errors: [`Failed to parse spreadsheet file: ${err.message}`] };
  }
}

/**
/**
 * Generates and downloads an Excel template for item purchase packaging options,
 * pre-populated with actual catalog items from the database.
 */
export function generatePackagingTemplate(
  items: any[] = [],
  suppliers: any[] = [],
  existingPackaging: any[] = []
): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Packaging Options
  const templateRows: any[] = [];

  if (items.length > 0) {
    items.forEach(item => {
      const itemPacks = existingPackaging.filter((p: any) => p.item_id === item.id);

      if (itemPacks.length > 0) {
        // Export existing packaging options for this item
        itemPacks.forEach((p: any) => {
          const suppName = p.suppliers?.name || suppliers.find((s: any) => s.id === p.supplier_id)?.name || '';
          templateRows.push({
            'Item Name': item.name,
            'Department': item.department || '',
            'Base Unit': item.base_unit || item.unit || 'pcs',
            'Brand': p.brand || '',
            'Supplier Name': suppName,
            'Purchase Unit': p.purchase_unit || '',
            'Pack Size': p.base_quantity_per_purchase_unit !== undefined ? p.base_quantity_per_purchase_unit : 1,
            'Price': p.purchase_unit_price !== undefined ? p.purchase_unit_price : '',
            'Is Default (YES/NO)': p.is_default ? 'YES' : 'NO'
          });
        });
      } else {
        // Pre-fill a row for this catalog item so the user can easily define purchase packaging
        const suppName = suppliers.find((s: any) => s.id === item.supplier_id)?.name || '';
        const baseUnit = item.base_unit || item.unit || 'pcs';
        templateRows.push({
          'Item Name': item.name,
          'Department': item.department || '',
          'Base Unit': baseUnit,
          'Brand': '',
          'Supplier Name': suppName,
          'Purchase Unit': '',
          'Pack Size': '',
          'Price': item.price_usd !== undefined && item.price_usd !== null ? item.price_usd : '',
          'Is Default (YES/NO)': 'YES'
        });
      }
    });
  }

  // Fallback sample if catalog has no items
  const sampleRows = [
    {
      'Item Name': 'Mayonnaise',
      'Department': 'Kitchen',
      'Base Unit': 'kg',
      'Brand': 'Brand A',
      'Supplier Name': suppliers[0]?.name || 'Global Foods',
      'Purchase Unit': 'container',
      'Pack Size': 3.8,
      'Price': 19.00,
      'Is Default (YES/NO)': 'YES'
    },
    {
      'Item Name': 'Olive Oil',
      'Department': 'Kitchen',
      'Base Unit': 'l',
      'Brand': "Terra D'Oro",
      'Supplier Name': suppliers[0]?.name || 'Global Foods',
      'Purchase Unit': 'tin',
      'Pack Size': 5.0,
      'Price': 45.00,
      'Is Default (YES/NO)': 'YES'
    }
  ];

  const wsPackaging = XLSX.utils.json_to_sheet(templateRows.length > 0 ? templateRows : sampleRows);
  wsPackaging['!cols'] = [
    { wch: 28 }, // Item Name
    { wch: 16 }, // Department
    { wch: 14 }, // Base Unit
    { wch: 18 }, // Brand
    { wch: 24 }, // Supplier Name
    { wch: 18 }, // Purchase Unit
    { wch: 14 }, // Pack Size
    { wch: 14 }, // Price
    { wch: 20 }  // Is Default (YES/NO)
  ];
  XLSX.utils.book_append_sheet(wb, wsPackaging, 'Purchase Packaging Options');

  // Sheet 2: Catalog Items Reference
  const catalogReference = items.map(item => ({
    'Item Name': item.name,
    'Department': item.department || '',
    'Sub Department': item.sub_department || '',
    'Base Unit (Inventory)': item.base_unit || item.unit || 'pcs',
    'Preferred Recipe Unit': item.preferred_recipe_unit || item.base_unit || item.unit || 'pcs',
    'Current Base Price ($)': item.price_usd !== undefined && item.price_usd !== null ? item.price_usd : ''
  }));
  const wsItems = XLSX.utils.json_to_sheet(
    catalogReference.length > 0 ? catalogReference : [{ 'Item Name': 'No items', 'Department': '', 'Sub Department': '', 'Base Unit (Inventory)': '', 'Preferred Recipe Unit': '', 'Current Base Price ($)': '' }]
  );
  wsItems['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 18 }, { wch: 22 }, { wch: 22 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsItems, 'Catalog Items Reference');

  // Sheet 3: Suppliers Reference
  const suppliersReference = suppliers.map(s => ({
    'Supplier Name': s.name,
    'Contact Phone': s.phone || '',
    'Delivery Days': s.delivery_days || ''
  }));
  const wsSuppliers = XLSX.utils.json_to_sheet(
    suppliersReference.length > 0 ? suppliersReference : [{ 'Supplier Name': 'No suppliers', 'Contact Phone': '', 'Delivery Days': '' }]
  );
  wsSuppliers['!cols'] = [{ wch: 26 }, { wch: 18 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsSuppliers, 'Suppliers Reference');

  XLSX.writeFile(wb, `Purchase_Packaging_Options_Template.xlsx`);
}

/**
 * Parses an Excel or CSV file of purchase packaging options.
 */
export async function parsePackagingExcelOrCsv(
  file: File,
  items: any[],
  suppliers: any[] = []
): Promise<{ success: boolean; data: ParsedPackagingOption[]; errors: string[] }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const wb = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rawRows: any[] = XLSX.utils.sheet_to_json(ws);

    if (!rawRows || rawRows.length === 0) {
      return { success: false, data: [], errors: ['Uploaded spreadsheet is empty.'] };
    }

    const errors: string[] = [];
    const parsedData: ParsedPackagingOption[] = [];

    rawRows.forEach((row, rowIndex) => {
      const rowNum = rowIndex + 2;
      const itemName = String(row['Item Name'] || row['item_name'] || '').trim();
      const brand = String(row['Brand'] || row['brand'] || '').trim();
      const supplierName = String(row['Supplier Name'] || row['supplier_name'] || '').trim();
      const purchaseUnit = String(row['Purchase Unit'] || row['purchase_unit'] || '').trim();
      const rawPackSize = row['Pack Size'] !== undefined ? row['Pack Size'] : row['pack_size'];
      const rawPrice = row['Price'] !== undefined ? row['Price'] : (row['Price ($)'] !== undefined ? row['Price ($)'] : row['price']);
      const rawDefault = String(row['Is Default (YES/NO)'] || row['is_default'] || '').trim().toUpperCase();

      if (!itemName) return;

      const itemMatch = items.find(
        i => i.name.trim().toLowerCase() === itemName.toLowerCase()
      );

      if (!itemMatch) {
        // If item doesn't exist, check if row has department or base unit to auto-create it
        const dept = String(row['Department'] || row['department'] || '').trim();
        const baseUnit = canonicalUnit(String(row['Base Unit'] || row['Base Unit (Inventory)'] || row['base_unit'] || 'pcs').trim());
        const recipeUnit = canonicalUnit(String(row['Preferred Recipe Unit'] || row['preferred_recipe_unit'] || baseUnit).trim());
        const subDept = String(row['Sub Department'] || row['sub_department'] || 'Other').trim();

        if (dept || baseUnit) {
          const supplierMatch = supplierName
            ? suppliers.find(s => s.name.trim().toLowerCase() === supplierName.toLowerCase())
            : undefined;
          const isDefault = rawDefault === 'YES' || rawDefault === 'TRUE' || rawDefault === '1' || !rawDefault;
          const packSize = Number(rawPackSize) > 0 ? Number(rawPackSize) : 1;
          const pUnit = purchaseUnit || baseUnit;
          const price = rawPrice !== undefined && rawPrice !== '' && !isNaN(Number(rawPrice)) ? Number(rawPrice) : undefined;

          parsedData.push({
            item_name: itemName,
            brand: brand || undefined,
            supplier_id: supplierMatch?.id,
            supplier_name: supplierName || undefined,
            purchase_unit: pUnit,
            pack_size: packSize,
            base_unit: baseUnit,
            price,
            is_default: isDefault,
            autoCreateItem: {
              name: itemName,
              department: dept || 'Kitchen',
              sub_department: subDept,
              base_unit: baseUnit,
              preferred_recipe_unit: recipeUnit,
              price: price || 0
            }
          });
          return;
        }

        errors.push(`Row ${rowNum}: Item "${itemName}" was not found in catalog.`);
        return;
      }

      // If user kept an item row from the template but didn't configure packaging for it, skip it safely
      const hasPurchaseUnit = Boolean(purchaseUnit);
      const hasPackSize = rawPackSize !== undefined && rawPackSize !== '' && rawPackSize !== null;
      if (!hasPurchaseUnit && !hasPackSize) {
        return;
      }

      if (!purchaseUnit) {
        errors.push(`Row ${rowNum} (${itemName}): Purchase Unit is required when Pack Size is provided (e.g. "box", "bag", "container").`);
        return;
      }

      const packSize = Number(rawPackSize);
      if (!Number.isFinite(packSize) || packSize <= 0) {
        errors.push(`Row ${rowNum} (${itemName}): Pack Size must be a positive number (found "${rawPackSize}").`);
        return;
      }

      const supplierMatch = supplierName
        ? suppliers.find(s => s.name.trim().toLowerCase() === supplierName.toLowerCase())
        : undefined;

      const isDefault = rawDefault === 'YES' || rawDefault === 'TRUE' || rawDefault === '1';
      const baseUnit = itemMatch.base_unit || itemMatch.unit || 'pcs';
      const price = rawPrice !== undefined && rawPrice !== '' && !isNaN(Number(rawPrice)) ? Number(rawPrice) : undefined;

      parsedData.push({
        item_id: itemMatch.id,
        item_name: itemMatch.name,
        brand: brand || undefined,
        supplier_id: supplierMatch?.id,
        supplier_name: supplierName || undefined,
        purchase_unit: purchaseUnit,
        pack_size: packSize,
        base_unit: baseUnit,
        price,
        is_default: isDefault
      });
    });

    if (errors.length > 0) {
      return { success: false, data: parsedData, errors };
    }

    return { success: true, data: parsedData, errors: [] };
  } catch (err: any) {
    return { success: false, data: [], errors: [`Failed to parse packaging spreadsheet: ${err.message}`] };
  }
}

export interface ParsedCatalogItem {
  name: string;
  department: string;
  sub_department: string;
  base_unit: string;
  preferred_recipe_unit: string;
  price_usd: number;
  par_level: number;
  step: number;
  order: 'yes' | 'no';
  purchasing: 'yes' | 'no';
  vat: 'yes' | 'no';
  supplier_name?: string;
  delivery_time?: string;
  inventory_location?: string;
  // Optional packaging fields
  purchase_unit?: string;
  pack_size?: number;
  pack_price?: number;
}

/**
 * Generates and downloads an Excel template for catalog items that 100% matches
 * the Item Catalog Manager table and modal data-entry form.
 */
export function generateItemCatalogTemplate(items: any[] = [], suppliers: any[] = []): void {
  const wb = XLSX.utils.book_new();

  const supplierMap = new Map<string, string>();
  suppliers.forEach(s => {
    if (s.id && s.name) supplierMap.set(s.id, s.name);
  });

  const rows = items.length > 0
    ? items.map(item => ({
        'Item Name': item.name,
        'Department': item.department || 'Kitchen',
        'Sub-Department': item.sub_department || 'Other',
        'Base Unit (Inventory)': item.base_unit || item.unit || 'pcs',
        'Preferred Recipe Unit': item.preferred_recipe_unit || item.base_unit || item.unit || 'pcs',
        'Current Base Price ($)': item.price_usd !== undefined && item.price_usd !== null ? Number(item.price_usd) : 0,
        'Par Level': item.par_level !== undefined && item.par_level !== null ? Number(item.par_level) : 0,
        'Step Size': item.step !== undefined && item.step !== null ? Number(item.step) : 1,
        'Branch Ordering (yes/no)': (item.order === 'yes' || item.order === 'no') ? item.order : 'yes',
        'Procurement (yes/no)': (item.purchasing === 'yes' || item.purchasing === 'no') ? item.purchasing : 'yes',
        'VAT (yes/no)': (item.vat === 'yes' || item.vat === 'no') ? item.vat : 'no',
        'Supplier Name': (item.supplier_id && supplierMap.get(item.supplier_id)) || item.suppliers?.name || '',
        'Delivery Lead Time': item.delivery_time || '',
        'Inventory Locations': item.inventory_location || '',
        'Purchase Pack Unit (Optional)': '',
        'Base Qty in Pack (Optional)': '',
        'Pack Purchase Price ($) (Optional)': ''
      }))
    : [
        {
          'Item Name': 'Olive Oil Extra Virgin',
          'Department': 'Kitchen',
          'Sub-Department': 'Oils & Fats',
          'Base Unit (Inventory)': 'l',
          'Preferred Recipe Unit': 'ml',
          'Current Base Price ($)': 8.5,
          'Par Level': 10,
          'Step Size': 1,
          'Branch Ordering (yes/no)': 'yes',
          'Procurement (yes/no)': 'yes',
          'VAT (yes/no)': 'no',
          'Supplier Name': 'Mediterranean Imports',
          'Delivery Lead Time': '24h',
          'Inventory Locations': 'Dry Store, Main Kitchen',
          'Purchase Pack Unit (Optional)': 'Tin (5L)',
          'Base Qty in Pack (Optional)': 5,
          'Pack Purchase Price ($) (Optional)': 42.5
        },
        {
          'Item Name': 'Flour 00 Tipo',
          'Department': 'Kitchen',
          'Sub-Department': 'Bakery & Grains',
          'Base Unit (Inventory)': 'kg',
          'Preferred Recipe Unit': 'g',
          'Current Base Price ($)': 1.25,
          'Par Level': 25,
          'Step Size': 5,
          'Branch Ordering (yes/no)': 'yes',
          'Procurement (yes/no)': 'yes',
          'VAT (yes/no)': 'no',
          'Supplier Name': 'Bakery Supplies Co',
          'Delivery Lead Time': '48h',
          'Inventory Locations': 'Dry Store',
          'Purchase Pack Unit (Optional)': 'Bag (25kg)',
          'Base Qty in Pack (Optional)': 25,
          'Pack Purchase Price ($) (Optional)': 31.25
        },
        {
          'Item Name': 'Heineken Beer 330ml',
          'Department': 'Beverages',
          'Sub-Department': 'Beer',
          'Base Unit (Inventory)': 'bottle',
          'Preferred Recipe Unit': 'bottle',
          'Current Base Price ($)': 1.1,
          'Par Level': 48,
          'Step Size': 24,
          'Branch Ordering (yes/no)': 'yes',
          'Procurement (yes/no)': 'yes',
          'VAT (yes/no)': 'yes',
          'Supplier Name': 'Beverage Distributors',
          'Delivery Lead Time': 'same day',
          'Inventory Locations': 'Bar, Beverage Walk-in',
          'Purchase Pack Unit (Optional)': 'Case (24x330ml)',
          'Base Qty in Pack (Optional)': 24,
          'Pack Purchase Price ($) (Optional)': 26.4
        }
      ];

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 30 }, // Item Name
    { wch: 18 }, // Department
    { wch: 20 }, // Sub-Department
    { wch: 22 }, // Base Unit
    { wch: 22 }, // Preferred Recipe Unit
    { wch: 22 }, // Base Price
    { wch: 12 }, // Par Level
    { wch: 12 }, // Step Size
    { wch: 24 }, // Ordering
    { wch: 22 }, // Procurement
    { wch: 14 }, // VAT
    { wch: 24 }, // Supplier
    { wch: 18 }, // Delivery Lead Time
    { wch: 28 }, // Inventory Locations
    { wch: 28 }, // Pack Unit
    { wch: 24 }, // Pack Qty
    { wch: 30 }  // Pack Price
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Item Catalog');
  XLSX.writeFile(wb, `Item_Catalog_Template.xlsx`);
}

/**
 * Parses an Excel or CSV file of catalog items.
 * Supports all Item Catalog Manager table and form columns.
 */
export async function parseItemCatalogExcel(file: File): Promise<{
  success: boolean;
  data: ParsedCatalogItem[];
  errors: string[];
}> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const wb = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rawRows: any[] = XLSX.utils.sheet_to_json(ws);

    if (!rawRows || rawRows.length === 0) {
      return { success: false, data: [], errors: ['Uploaded spreadsheet has no data rows.'] };
    }

    const errors: string[] = [];
    const parsedData: ParsedCatalogItem[] = [];
    const seen = new Set<string>();

    rawRows.forEach((row, rowIndex) => {
      const rowNum = rowIndex + 2;
      const name = String(row['Item Name'] || row['item_name'] || row['Name'] || row['name'] || '').trim();
      const dept = String(row['Department'] || row['department'] || 'Kitchen').trim();
      const subDept = String(row['Sub-Department'] || row['Sub Department'] || row['sub_department'] || 'Other').trim();
      const baseUnit = canonicalUnit(String(row['Base Unit (Inventory)'] || row['Base Unit'] || row['base_unit'] || row['Unit'] || 'pcs').trim());
      const recipeUnit = canonicalUnit(String(row['Preferred Recipe Unit'] || row['preferred_recipe_unit'] || baseUnit).trim());
      const rawPrice = row['Current Base Price ($)'] !== undefined ? row['Current Base Price ($)'] : (row['Price'] !== undefined ? row['Price'] : row['price_usd']);
      
      const rawPar = row['Par Level'] !== undefined ? row['Par Level'] : row['par_level'];
      const rawStep = row['Step Size'] !== undefined ? row['Step Size'] : row['step'];
      
      const rawOrder = String(row['Branch Ordering (yes/no)'] || row['Branch Ordering'] || row['Ordering'] || row['order'] || 'yes').trim().toLowerCase();
      const rawPurchasing = String(row['Procurement (yes/no)'] || row['Procurement'] || row['Purchasing'] || row['purchasing'] || 'yes').trim().toLowerCase();
      const rawVat = String(row['VAT (yes/no)'] || row['VAT'] || row['vat'] || 'no').trim().toLowerCase();
      
      const supplierName = String(row['Supplier Name'] || row['Supplier'] || row['supplier_name'] || '').trim();
      const deliveryTime = String(row['Delivery Lead Time'] || row['Delivery Time'] || row['delivery_time'] || '').trim();
      const location = String(row['Inventory Locations'] || row['Inventory Location'] || row['Location'] || row['inventory_location'] || '').trim();

      // Optional packaging fields
      const pUnit = String(row['Purchase Pack Unit (Optional)'] || row['Purchase Pack Unit'] || row['Purchase Unit'] || row['purchase_unit'] || '').trim();
      const rawPackQty = row['Base Qty in Pack (Optional)'] !== undefined ? row['Base Qty in Pack (Optional)'] : (row['Base Qty in Pack'] !== undefined ? row['Base Qty in Pack'] : row['pack_size']);
      const rawPackPrice = row['Pack Purchase Price ($) (Optional)'] !== undefined ? row['Pack Purchase Price ($) (Optional)'] : (row['Pack Purchase Price ($)'] !== undefined ? row['Pack Purchase Price ($)'] : row['pack_price']);

      if (!name) return;

      const key = name.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);

      const price = Number(rawPrice);
      const parLevel = Number(rawPar);
      const step = Number(rawStep);
      const packQty = Number(rawPackQty);
      const packPrice = Number(rawPackPrice);

      const orderVal: 'yes' | 'no' = (rawOrder === 'yes' || rawOrder === 'true' || rawOrder === '1') ? 'yes' : 'no';
      const purchasingVal: 'yes' | 'no' = (rawPurchasing === 'no' || rawPurchasing === 'false' || rawPurchasing === '0') ? 'no' : 'yes';
      const vatVal: 'yes' | 'no' = (rawVat === 'yes' || rawVat === 'true' || rawVat === '1') ? 'yes' : 'no';

      parsedData.push({
        name,
        department: dept,
        sub_department: subDept,
        base_unit: baseUnit,
        preferred_recipe_unit: recipeUnit,
        price_usd: !isNaN(price) && price >= 0 ? price : 0,
        par_level: !isNaN(parLevel) && parLevel >= 0 ? parLevel : 0,
        step: !isNaN(step) && step > 0 ? step : 1,
        order: orderVal,
        purchasing: purchasingVal,
        vat: vatVal,
        supplier_name: supplierName || undefined,
        delivery_time: deliveryTime || undefined,
        inventory_location: location || undefined,
        purchase_unit: pUnit || undefined,
        pack_size: !isNaN(packQty) && packQty > 0 ? packQty : undefined,
        pack_price: !isNaN(packPrice) && packPrice >= 0 ? packPrice : undefined
      });
    });

    return { success: true, data: parsedData, errors };
  } catch (err: any) {
    return { success: false, data: [], errors: [`Failed to parse spreadsheet: ${err.message}`] };
  }
}

export interface ParsedProductionRecipeIngredient {
  item_id: string;
  item_name: string;
  quantity: number;
  unit: string;
  waste_percentage: number;
  source_location_id?: string;
  source_location_name?: string;
  notes?: string;
}

export interface ParsedProductionRecipe {
  recipe_code: string;
  name: string;
  output_item_id: string;
  output_item_name: string;
  target_yield_quantity: number;
  yield_unit: string;
  default_location_id?: string;
  default_location_name?: string;
  shelf_life_days?: number;
  prep_time_minutes?: number;
  instructions?: string;
  items: ParsedProductionRecipeIngredient[];
}

/**
 * Generates and downloads an Excel template for production recipes and their batch ingredients.
 */
export function generateProductionRecipeTemplate(items: any[] = [], locations: any[] = []): void {
  const wb = XLSX.utils.book_new();

  // Find sample items and locations for helpful demonstration
  const sampleOutputItem = items[0]?.name || 'Fresh Tomato Sauce (Batch)';
  const sampleOutputUnit = items[0]?.preferred_recipe_unit || items[0]?.base_unit || items[0]?.unit || 'L';
  const sampleIngredient1 = items[1]?.name || 'Plum Tomatoes';
  const sampleIng1Unit = items[1]?.preferred_recipe_unit || items[1]?.base_unit || items[1]?.unit || 'kg';
  const sampleIngredient2 = items[2]?.name || 'Olive Oil';
  const sampleIng2Unit = items[2]?.preferred_recipe_unit || items[2]?.base_unit || items[2]?.unit || 'L';
  const sampleIngredient3 = items[3]?.name || 'Fresh Garlic';
  const sampleIng3Unit = items[3]?.preferred_recipe_unit || items[3]?.base_unit || items[3]?.unit || 'kg';
  const sampleLocation = locations[0]?.name || 'Main Kitchen Chiller';
  const sampleSourceLoc = locations[1]?.name || locations[0]?.name || 'Dry Storage';

  // Sheet 1: Production Recipes Template
  const sampleRows = [
    {
      'Recipe Code': 'BATCH-SAUCE-01',
      'Recipe Name': 'Signature Tomato Sauce (10L)',
      'Output Item Name': sampleOutputItem,
      'Batch Yield': 10,
      'Yield Unit': sampleOutputUnit,
      'Output Location': sampleLocation,
      'Shelf Life (Days)': 5,
      'Prep Time (Mins)': 45,
      'Instructions': 'Simmer crushed tomatoes with aromatics for 45 mins. Cool and portion into containers.',
      'Ingredient Item Name': sampleIngredient1,
      'Ingredient Quantity': 12,
      'Ingredient Unit': sampleIng1Unit,
      'Waste %': 5,
      'Source Location': sampleSourceLoc,
      'Ingredient Notes': 'Washed and trimmed'
    },
    {
      'Recipe Code': 'BATCH-SAUCE-01',
      'Recipe Name': 'Signature Tomato Sauce (10L)',
      'Output Item Name': sampleOutputItem,
      'Batch Yield': 10,
      'Yield Unit': sampleOutputUnit,
      'Output Location': sampleLocation,
      'Shelf Life (Days)': 5,
      'Prep Time (Mins)': 45,
      'Instructions': '',
      'Ingredient Item Name': sampleIngredient2,
      'Ingredient Quantity': 0.5,
      'Ingredient Unit': sampleIng2Unit,
      'Waste %': 0,
      'Source Location': sampleSourceLoc,
      'Ingredient Notes': 'Extra virgin'
    },
    {
      'Recipe Code': 'BATCH-SAUCE-01',
      'Recipe Name': 'Signature Tomato Sauce (10L)',
      'Output Item Name': sampleOutputItem,
      'Batch Yield': 10,
      'Yield Unit': sampleOutputUnit,
      'Output Location': sampleLocation,
      'Shelf Life (Days)': 5,
      'Prep Time (Mins)': 45,
      'Instructions': '',
      'Ingredient Item Name': sampleIngredient3,
      'Ingredient Quantity': 0.2,
      'Ingredient Unit': sampleIng3Unit,
      'Waste %': 2,
      'Source Location': sampleSourceLoc,
      'Ingredient Notes': 'Peeled and minced'
    }
  ];

  const wsRecipes = XLSX.utils.json_to_sheet(sampleRows);
  wsRecipes['!cols'] = [
    { wch: 18 }, // Recipe Code
    { wch: 30 }, // Recipe Name
    { wch: 28 }, // Output Item Name
    { wch: 12 }, // Batch Yield
    { wch: 12 }, // Yield Unit
    { wch: 22 }, // Output Location
    { wch: 16 }, // Shelf Life (Days)
    { wch: 16 }, // Prep Time (Mins)
    { wch: 40 }, // Instructions
    { wch: 26 }, // Ingredient Item Name
    { wch: 18 }, // Ingredient Quantity
    { wch: 15 }, // Ingredient Unit
    { wch: 10 }, // Waste %
    { wch: 20 }, // Source Location
    { wch: 25 }  // Ingredient Notes
  ];
  XLSX.utils.book_append_sheet(wb, wsRecipes, 'Production Recipes');

  // Sheet 2: Approved Items Reference
  const catalogReference = items.map(item => ({
    'Item Name': item.name,
    'Base Unit (Inventory)': item.base_unit || item.unit || 'pcs',
    'Preferred Recipe Unit': item.preferred_recipe_unit || item.base_unit || item.unit || 'pcs',
    'Department': item.department || 'General'
  }));

  const wsReference = XLSX.utils.json_to_sheet(
    catalogReference.length > 0
      ? catalogReference
      : [{ 'Item Name': 'No items found', 'Base Unit (Inventory)': '', 'Preferred Recipe Unit': '', 'Department': '' }]
  );
  wsReference['!cols'] = [{ wch: 28 }, { wch: 22 }, { wch: 22 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsReference, 'Approved Items Reference');

  // Sheet 3: Locations Reference
  const locationsReference = locations.map(loc => ({
    'Location Name': loc.name,
    'Department': loc.department || ''
  }));

  const wsLocations = XLSX.utils.json_to_sheet(
    locationsReference.length > 0
      ? locationsReference
      : [{ 'Location Name': 'No locations found', 'Department': '' }]
  );
  wsLocations['!cols'] = [{ wch: 28 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsLocations, 'Locations Reference');

  XLSX.writeFile(wb, `Production_Recipes_Template.xlsx`);
}

/**
 * Parses an Excel spreadsheet of production recipes and their ingredients.
 */
export async function parseProductionRecipeExcel(
  file: File,
  items: any[],
  conversions: any[] = [],
  locations: any[] = [],
  packagingOptions: any[] = []
): Promise<{
  success: boolean;
  recipes: ParsedProductionRecipe[];
  errors: string[];
  totalRowsParsed: number;
}> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const wb = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rawRows: any[] = XLSX.utils.sheet_to_json(ws);

    if (!rawRows || rawRows.length === 0) {
      return {
        success: false,
        recipes: [],
        errors: ['Uploaded spreadsheet is empty or has no data rows in the first sheet.'],
        totalRowsParsed: 0
      };
    }

    const errors: string[] = [];

    type RecipeGroup = {
      code: string;
      name: string;
      outputItemName: string;
      batchYield: any;
      yieldUnit: string;
      outputLocationName?: string;
      shelfLife?: any;
      prepTime?: any;
      instructions?: string;
      rawRows: { row: any; rowNum: number }[];
    };

    const recipeGroups = new Map<string, RecipeGroup>();
    let lastActiveCode = '';

    rawRows.forEach((row, rowIndex) => {
      const rowNum = rowIndex + 2; // Row 1 is header

      const recipeCode = String(
        row['Recipe Code'] || row['recipe_code'] || row['Code'] || row['code'] || ''
      ).trim();
      const recipeName = String(
        row['Recipe Name'] || row['recipe_name'] || row['Name'] || row['name'] || ''
      ).trim();
      const ingredientItemName = String(
        row['Ingredient Item Name'] || row['Ingredient'] || row['ingredient'] || row['ingredient_item_name'] || ''
      ).trim();

      // Check if this row is completely empty
      if (!recipeCode && !recipeName && !ingredientItemName) {
        return;
      }

      // If Recipe Code is omitted, inherit from preceding row if present
      const effectiveCode = recipeCode || lastActiveCode;
      if (!effectiveCode) {
        errors.push(`Row ${rowNum}: Missing "Recipe Code". Each recipe must have a unique recipe code.`);
        return;
      }
      lastActiveCode = effectiveCode;

      if (!recipeGroups.has(effectiveCode)) {
        recipeGroups.set(effectiveCode, {
          code: effectiveCode,
          name: recipeName,
          outputItemName: String(
            row['Output Item Name'] || row['Output Item'] || row['output_item_name'] || row['output_item'] || ''
          ).trim(),
          batchYield: row['Batch Yield'] !== undefined ? row['Batch Yield'] : (row['target_yield_quantity'] !== undefined ? row['target_yield_quantity'] : row['yield_quantity']),
          yieldUnit: String(row['Yield Unit'] || row['yield_unit'] || '').trim(),
          outputLocationName: String(row['Output Location'] || row['output_location'] || row['default_location'] || '').trim() || undefined,
          shelfLife: row['Shelf Life (Days)'] !== undefined ? row['Shelf Life (Days)'] : row['shelf_life_days'],
          prepTime: row['Prep Time (Mins)'] !== undefined ? row['Prep Time (Mins)'] : row['prep_time_minutes'],
          instructions: String(row['Instructions'] || row['instructions'] || '').trim() || undefined,
          rawRows: []
        });
      } else {
        const group = recipeGroups.get(effectiveCode)!;
        if (!group.name && recipeName) group.name = recipeName;
        if (!group.outputItemName) {
          group.outputItemName = String(
            row['Output Item Name'] || row['Output Item'] || row['output_item_name'] || row['output_item'] || ''
          ).trim();
        }
        if (group.batchYield === undefined && (row['Batch Yield'] !== undefined || row['target_yield_quantity'] !== undefined)) {
          group.batchYield = row['Batch Yield'] !== undefined ? row['Batch Yield'] : row['target_yield_quantity'];
        }
        if (!group.yieldUnit && (row['Yield Unit'] || row['yield_unit'])) {
          group.yieldUnit = String(row['Yield Unit'] || row['yield_unit']).trim();
        }
        if (!group.outputLocationName && (row['Output Location'] || row['output_location'])) {
          group.outputLocationName = String(row['Output Location'] || row['output_location']).trim();
        }
        if (group.shelfLife === undefined && (row['Shelf Life (Days)'] !== undefined || row['shelf_life_days'] !== undefined)) {
          group.shelfLife = row['Shelf Life (Days)'] !== undefined ? row['Shelf Life (Days)'] : row['shelf_life_days'];
        }
        if (group.prepTime === undefined && (row['Prep Time (Mins)'] !== undefined || row['prep_time_minutes'] !== undefined)) {
          group.prepTime = row['Prep Time (Mins)'] !== undefined ? row['Prep Time (Mins)'] : row['prep_time_minutes'];
        }
        if (!group.instructions && (row['Instructions'] || row['instructions'])) {
          group.instructions = String(row['Instructions'] || row['instructions']).trim();
        }
      }

      if (ingredientItemName) {
        recipeGroups.get(effectiveCode)!.rawRows.push({ row, rowNum });
      }
    });

    const parsedRecipes: ParsedProductionRecipe[] = [];

    // Validate each recipe group
    for (const [code, group] of recipeGroups.entries()) {
      const groupPrefix = `Recipe "${code}" (${group.name || 'Unnamed'})`;

      if (!group.name) {
        errors.push(`${groupPrefix}: Missing recipe name.`);
      }

      // Output Item lookup
      if (!group.outputItemName) {
        errors.push(`${groupPrefix}: Missing "Output Item Name". Specify which catalog item this recipe produces.`);
        continue;
      }
      const outputItem = items.find(
        i => i.name.trim().toLowerCase() === group.outputItemName.toLowerCase()
      );
      if (!outputItem) {
        errors.push(`${groupPrefix}: Output item "${group.outputItemName}" was not found in catalog.`);
        continue;
      }

      // Batch yield validation
      const yieldQty = Number(group.batchYield);
      if (!Number.isFinite(yieldQty) || yieldQty <= 0) {
        errors.push(`${groupPrefix}: Batch Yield must be a positive number (found "${group.batchYield}").`);
      }

      // Yield unit validation
      const outputBaseUnit = outputItem.base_unit || outputItem.unit || 'pcs';
      const yieldUnit = group.yieldUnit || outputItem.preferred_recipe_unit || outputBaseUnit;
      const yieldFactor = conversionFactor(outputItem.id, yieldUnit, outputBaseUnit, conversions, packagingOptions);
      if (yieldFactor === null) {
        errors.push(`${groupPrefix}: Yield unit "${yieldUnit}" cannot convert to output item base unit "${outputBaseUnit}".`);
      }

      // Output location validation
      let defaultLocationId: string | undefined = undefined;
      let defaultLocationName: string | undefined = undefined;
      if (group.outputLocationName) {
        const loc = locations.find(
          l => l.name.trim().toLowerCase() === group.outputLocationName!.toLowerCase()
        );
        if (!loc) {
          errors.push(`${groupPrefix}: Output location "${group.outputLocationName}" was not found.`);
        } else {
          defaultLocationId = loc.id;
          defaultLocationName = loc.name;
        }
      }

      // Shelf life
      let shelfLifeDays: number | undefined = undefined;
      if (group.shelfLife !== undefined && group.shelfLife !== '') {
        const days = Number(group.shelfLife);
        if (!Number.isInteger(days) || days <= 0) {
          errors.push(`${groupPrefix}: Shelf life must be a positive whole number of days.`);
        } else {
          shelfLifeDays = days;
        }
      }

      // Prep time
      let prepTimeMins: number | undefined = undefined;
      if (group.prepTime !== undefined && group.prepTime !== '') {
        const mins = Number(group.prepTime);
        if (!Number.isInteger(mins) || mins < 0) {
          errors.push(`${groupPrefix}: Preparation time must be a non-negative whole number of minutes.`);
        } else {
          prepTimeMins = mins;
        }
      }

      // Ingredients validation
      if (!group.rawRows.length) {
        errors.push(`${groupPrefix}: Must have at least one ingredient row.`);
        continue;
      }

      const parsedIngredients: ParsedProductionRecipeIngredient[] = [];
      const seenIngredientItemIds = new Set<string>();

      for (const { row, rowNum } of group.rawRows) {
        const ingItemName = String(
          row['Ingredient Item Name'] || row['Ingredient'] || row['ingredient'] || row['ingredient_item_name'] || ''
        ).trim();
        const rawQty = row['Ingredient Quantity'] !== undefined ? row['Ingredient Quantity'] : (row['Quantity'] !== undefined ? row['Quantity'] : row['qty']);
        const rawUnit = String(row['Ingredient Unit'] || row['Unit'] || row['unit'] || '').trim();
        const rawWaste = row['Waste %'] !== undefined ? row['Waste %'] : (row['waste_percentage'] || 0);
        const sourceLocName = String(row['Source Location'] || row['source_location'] || '').trim();
        const notes = String(row['Ingredient Notes'] || row['Notes'] || row['notes'] || '').trim();

        const ingItem = items.find(
          i => i.name.trim().toLowerCase() === ingItemName.toLowerCase()
        );
        if (!ingItem) {
          errors.push(`Row ${rowNum} (${groupPrefix}): Ingredient item "${ingItemName}" was not found in catalog.`);
          continue;
        }

        if (ingItem.id === outputItem.id) {
          errors.push(`Row ${rowNum} (${groupPrefix}): The output item "${outputItem.name}" cannot be an ingredient in its own recipe.`);
          continue;
        }

        if (seenIngredientItemIds.has(ingItem.id)) {
          errors.push(`Row ${rowNum} (${groupPrefix}): Duplicate ingredient "${ingItem.name}". Combine its quantities into one row.`);
          continue;
        }
        seenIngredientItemIds.add(ingItem.id);

        const qty = Number(rawQty);
        if (!Number.isFinite(qty) || qty <= 0) {
          errors.push(`Row ${rowNum} (${groupPrefix} - ${ingItem.name}): Quantity must be a positive number (found "${rawQty}").`);
          continue;
        }

        const ingBaseUnit = ingItem.base_unit || ingItem.unit || 'pcs';
        const unit = rawUnit || ingItem.preferred_recipe_unit || ingBaseUnit;
        const ingFactor = conversionFactor(ingItem.id, unit, ingBaseUnit, conversions, packagingOptions);
        if (ingFactor === null) {
          errors.push(`Row ${rowNum} (${groupPrefix} - ${ingItem.name}): Unit "${unit}" cannot convert to base unit "${ingBaseUnit}".`);
          continue;
        }

        const waste = Number(rawWaste);
        if (!Number.isFinite(waste) || waste < 0 || waste >= 100) {
          errors.push(`Row ${rowNum} (${groupPrefix} - ${ingItem.name}): Waste % must be from 0 to less than 100.`);
          continue;
        }

        let sourceLocationId: string | undefined = undefined;
        let effectiveSourceLocName: string | undefined = undefined;
        if (sourceLocName) {
          const sLoc = locations.find(
            l => l.name.trim().toLowerCase() === sourceLocName.toLowerCase()
          );
          if (!sLoc) {
            errors.push(`Row ${rowNum} (${groupPrefix} - ${ingItem.name}): Source location "${sourceLocName}" was not found.`);
          } else {
            sourceLocationId = sLoc.id;
            effectiveSourceLocName = sLoc.name;
          }
        }

        parsedIngredients.push({
          item_id: ingItem.id,
          item_name: ingItem.name,
          quantity: qty,
          unit,
          waste_percentage: waste,
          source_location_id: sourceLocationId,
          source_location_name: effectiveSourceLocName,
          notes: notes || undefined
        });
      }

      parsedRecipes.push({
        recipe_code: group.code,
        name: group.name,
        output_item_id: outputItem.id,
        output_item_name: outputItem.name,
        target_yield_quantity: yieldQty,
        yield_unit: yieldUnit,
        default_location_id: defaultLocationId,
        default_location_name: defaultLocationName,
        shelf_life_days: shelfLifeDays,
        prep_time_minutes: prepTimeMins,
        instructions: group.instructions,
        items: parsedIngredients
      });
    }

    if (errors.length > 0) {
      return {
        success: false,
        recipes: parsedRecipes,
        errors,
        totalRowsParsed: rawRows.length
      };
    }

    return {
      success: true,
      recipes: parsedRecipes,
      errors: [],
      totalRowsParsed: rawRows.length
    };
  } catch (err: any) {
    return {
      success: false,
      recipes: [],
      errors: [`Failed to parse spreadsheet: ${err.message}`],
      totalRowsParsed: 0
    };
  }
}

