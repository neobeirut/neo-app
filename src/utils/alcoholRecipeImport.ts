import * as XLSX from 'xlsx';
import { supabase } from '../api/supabase';
import { DEFAULT_RESTAURANT_ID } from '../api/client';

export interface ImportResult {
  success: boolean;
  totalProducts: number;
  totalIngredients: number;
  createdProducts: string[];
  warnings: string[];
  errors: string[];
}

/**
 * Initiates direct download of the clean Menu Products template (headers only).
 */
export function downloadMenuProductsTemplate(): void {
  const headers = [
    'Product Name',
    'Category',
    'Price ($)',
    'Status',
    'Prep Time (min)',
    'Show in Mobile (TRUE/FALSE)',
    'Image URL',
    'Description'
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  XLSX.utils.book_append_sheet(wb, ws, 'Menu Products');
  XLSX.writeFile(wb, 'Menu_Products_Template.xlsx');
}

/**
 * Initiates direct download of the clean Product Recipes template (headers only).
 */
export function downloadProductRecipesTemplate(): void {
  const headers = [
    'Product Name',
    'Section',
    'Glassware',
    'Yield Quantity',
    'Yield Unit',
    'Preparation Method',
    'Garnish',
    'Ingredient Item Name',
    'Quantity',
    'Unit',
    'Waste %',
    'Ingredient Notes'
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  XLSX.utils.book_append_sheet(wb, ws, 'Product Recipes');
  XLSX.writeFile(wb, 'Product_Recipes_Template.xlsx');
}

/**
 * Initiates direct download of the Combined Alcohol Products & Recipes template.
 */
export function downloadAlcoholTemplate(): void {
  downloadProductRecipesTemplate();
}

function determineSubDeptAndUnit(name: string, unit: string) {
  const n = name.toLowerCase();
  const u = (unit || '').toLowerCase();

  if (n.includes('syrup') || n.includes('honey') || n.includes('grenadine') || n.includes('falernum') || n.includes('orgeat')) {
    return { dept: 'Bar', sub: 'Syrups', unit: 'l', base_unit: 'l', pref: 'ml', step: 0.05 };
  }
  if (n.includes('juice') || n.includes('purée') || n.includes('puree') || n.includes('lemonade') || n.includes('soda') || n.includes('tonic') || n.includes('water') || n.includes('cola') || n.includes('beer')) {
    return { dept: 'Bar', sub: 'Beverages', unit: 'l', base_unit: 'l', pref: 'ml', step: 0.1 };
  }
  if (n.includes('gin') || n.includes('vodka') || n.includes('rum') || n.includes('tequila') || n.includes('whiskey') || n.includes('whisky') || n.includes('bourbon') || n.includes('scotch') || n.includes('mezcal') || n.includes('brandy') || n.includes('cognac') || n.includes('vermouth') || n.includes('liqueur') || n.includes('bitters') || n.includes('campari') || n.includes('aperol') || n.includes('cointreau') || n.includes('curacao') || n.includes('curaçao') || n.includes('chartreuse') || n.includes('drambuie') || n.includes('amaretto') || n.includes('kahlua') || n.includes('sambuca') || n.includes('absinthe') || n.includes('schnapps') || n.includes('wine') || n.includes('champagne') || n.includes('port') || n.includes('pisco') || n.includes('cachaça') || n.includes('cachaca') || n.includes('triple sec') || n.includes('fernet') || n.includes('crème') || n.includes('creme') || n.includes('galliano') || n.includes('bénédictine') || n.includes('benedictine') || n.includes('lillet') || n.includes('limoncello') || n.includes('nonino')) {
    return { dept: 'Bar', sub: 'Alcohol', unit: 'l', base_unit: 'l', pref: u === 'dash' ? 'dash' : 'ml', step: 0.05 };
  }
  if (u === 'pcs' || n.includes('leaf') || n.includes('leaves') || n.includes('wedge') || n.includes('slice') || n.includes('twist') || n.includes('fruit') || n.includes('peel') || n.includes('cube')) {
    return { dept: 'Bar', sub: 'Garnish', unit: 'pcs', base_unit: 'pcs', pref: 'pcs', step: 1 };
  }
  if (u === 'g' || n.includes('salt') || n.includes('sugar') || n.includes('spice') || n.includes('sorbet') || n.includes('cream')) {
    return { dept: 'Bar', sub: 'Others', unit: 'kg', base_unit: 'kg', pref: u || 'g', step: 0.01 };
  }
  return { dept: 'Bar', sub: 'Others', unit: 'l', base_unit: 'l', pref: u || 'ml', step: 0.05 };
}

/**
 * Parses an Excel spreadsheet with alcohol menu products, recipes, or both,
 * creates or updates the products, links the recipes, and associates BOM components.
 */
export async function parseAndImportAlcoholSpreadsheet(file: File): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    totalProducts: 0,
    totalIngredients: 0,
    createdProducts: [],
    warnings: [],
    errors: []
  };

  try {
    const arrayBuffer = await file.arrayBuffer();
    const wb = XLSX.read(arrayBuffer, { type: 'array' });
    
    // Choose target sheet
    const targetSheetName = wb.SheetNames.find(n => 
      n.toLowerCase().includes('product') || 
      n.toLowerCase().includes('recipe') || 
      n.toLowerCase().includes('alcohol') || 
      n.toLowerCase().includes('menu')
    ) || wb.SheetNames[0];

    const ws = wb.Sheets[targetSheetName];
    if (!ws) {
      result.errors.push('No readable worksheet found in the uploaded file.');
      return result;
    }

    const rawRows: any[] = XLSX.utils.sheet_to_json(ws);
    if (!rawRows || rawRows.length === 0) {
      result.errors.push('Spreadsheet has no data rows to import.');
      return result;
    }

    // 1. Fetch reference data from database
    const [catsRes, sectionsRes, itemsRes] = await Promise.all([
      supabase.from('categories').select('id, name, section').eq('restaurant_id', DEFAULT_RESTAURANT_ID),
      supabase.from('menu_sections').select('id, name, department').eq('restaurant_id', DEFAULT_RESTAURANT_ID),
      supabase.from('items').select('id, name, unit, base_unit, department, sub_department, price_usd')
    ]);

    const categories = catsRes.data || [];
    const sections = sectionsRes.data || [];
    const items = itemsRes.data || [];

    // Fallback Bar section
    const defaultSection = sections.find(s => 
      s.name.toLowerCase() === 'cocktails' || 
      s.name.toLowerCase() === 'drinks' || 
      s.department?.toLowerCase() === 'bar'
    ) || sections[0];

    // 2. Group spreadsheet rows by Product Name
    const productGroups = new Map<string, any[]>();

    rawRows.forEach((row, idx) => {
      const rowNum = idx + 2;
      const rawProdName = 
        row['Product Name'] || 
        row['product_name'] || 
        row['Product / Recipe Name'] || 
        row['Recipe Name'] || 
        row['recipe_name'] || 
        row['Drink Name'] || 
        row['Name'];

      if (!rawProdName) {
        // Skip empty rows
        return;
      }
      const prodName = String(rawProdName).trim();
      if (!prodName) return;

      const group = productGroups.get(prodName) || [];
      group.push({ ...row, _rowNum: rowNum });
      productGroups.set(prodName, group);
    });

    if (productGroups.size === 0) {
      result.errors.push('Could not find any products in the spreadsheet. Please verify the "Product Name" or "Product / Recipe Name" column header.');
      return result;
    }

    // 3. Process each product group
    for (const [productName, rows] of productGroups.entries()) {
      const firstRow = rows[0];

      // A. Category resolution or creation
      const categoryName = String(firstRow['Category'] || firstRow['category'] || 'Cocktails').trim();
      let category = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());

      if (!category && categoryName) {
        // Create category
        const { data: newCat, error: catErr } = await supabase
          .from('categories')
          .insert({
            restaurant_id: DEFAULT_RESTAURANT_ID,
            name: categoryName,
            section: 'Bar',
            is_active: true,
            display_order: categories.length + 1
          })
          .select()
          .single();

        if (catErr) {
          result.warnings.push(`Could not create category "${categoryName}" for product "${productName}": ${catErr.message}`);
        } else if (newCat) {
          category = newCat;
          categories.push(newCat);
        }
      }

      // B. Section resolution
      const rawSectionName = String(firstRow['Section'] || firstRow['section'] || '').trim();
      let matchedSection = rawSectionName 
        ? sections.find(s => s.name.toLowerCase() === rawSectionName.toLowerCase())
        : defaultSection;

      if (!matchedSection) {
        matchedSection = defaultSection;
      }

      // C. Product Details
      const rawPrice = firstRow['Price ($)'] ?? firstRow['Selling Price ($)'] ?? firstRow['Price'] ?? firstRow['price'];
      const price = rawPrice !== undefined && rawPrice !== null ? Number(rawPrice) : null;
      const prepTime = String(firstRow['Prep Time (min)'] ?? firstRow['prep_time'] ?? '3').trim();
      const glassware = String(firstRow['Glassware'] ?? firstRow['Plate Type'] ?? firstRow['plate_type'] ?? 'Glass').trim();
      const prepMethod = String(firstRow['Preparation Method'] ?? firstRow['Prep Method'] ?? firstRow['recipe_text'] ?? '').trim();
      const garnish = String(firstRow['Garnish / Plating'] ?? firstRow['Garnish'] ?? firstRow['Plating'] ?? firstRow['plating_instructions'] ?? '').trim();
      const description = String(firstRow['Description'] ?? firstRow['description'] ?? '').trim();
      const status = String(firstRow['Status'] ?? firstRow['status'] ?? 'Available').trim();
      const imageUrl = String(firstRow['Image URL'] ?? firstRow['image_url'] ?? '').trim();
      const rawMobile = firstRow['Show in Mobile (TRUE/FALSE)'] ?? firstRow['Show in Mobile'] ?? firstRow['show_in_mobile'] ?? firstRow['Mobile'] ?? firstRow['mobile'];
      const showInMobile = rawMobile !== undefined && rawMobile !== null && String(rawMobile).trim() !== ''
        ? String(rawMobile).toLowerCase().trim() !== 'false' && String(rawMobile).toLowerCase().trim() !== '0' && String(rawMobile).toLowerCase().trim() !== 'no'
        : true;

      // Check if this spreadsheet has ingredients
      const hasIngredients = rows.some(r => Boolean(
        r['Ingredient Item Name'] || r['Ingredient'] || r['Item Name'] || r['item_name']
      ));

      // D. Find or create Product
      const { data: existingProd } = await supabase
        .from('products')
        .select('id, name, price, category_id')
        .eq('restaurant_id', DEFAULT_RESTAURANT_ID)
        .ilike('name', productName)
        .maybeSingle();

      let productId: number;

      const productPayload: any = {
        name: productName,
        category_id: category?.id || existingProd?.category_id || null,
        prep_time: prepTime,
        status: status || 'Available',
        is_active: status === 'Available',
        show_in_mobile: showInMobile
      };

      if (price !== null && !isNaN(price)) {
        productPayload.price = price;
      }
      if (description) {
        productPayload.description = description;
      }
      if (imageUrl) {
        productPayload.image_url = imageUrl;
      }
      if (hasIngredients) {
        productPayload.inventory_mode = 'RECIPE';
      }

      if (existingProd) {
        productId = existingProd.id;
        if (price !== undefined && price !== null) {
          productPayload.unit_price_usd = price;
        }
        await supabase
          .from('products')
          .update(productPayload)
          .eq('id', productId);
      } else {
        const { data: newProd, error: prodErr } = await supabase
          .from('products')
          .insert({
            restaurant_id: DEFAULT_RESTAURANT_ID,
            price: price ?? 0,
            unit_price_usd: price ?? 0,
            inventory_mode: hasIngredients ? 'RECIPE' : 'NONE',
            ...productPayload
          })
          .select()
          .single();

        if (prodErr || !newProd) {
          result.errors.push(`Failed to create product "${productName}": ${prodErr?.message || 'Unknown error'}`);
          continue;
        }
        productId = newProd.id;
      }

      // E. If has ingredients or recipe info, find or create Recipe in menu_recipes
      if (hasIngredients || prepMethod || glassware) {
        const { data: existingRecipe } = await supabase
          .from('menu_recipes')
          .select('id')
          .eq('restaurant_id', DEFAULT_RESTAURANT_ID)
          .eq('product_id', productId)
          .maybeSingle();

        let recipeId = existingRecipe?.id;

        const recipePayload: any = {
          restaurant_id: DEFAULT_RESTAURANT_ID,
          product_id: productId,
          item_name: productName,
          section_id: matchedSection?.id || null,
          plate_type: glassware,
          recipe_text: prepMethod || 'Preparation instructions in recipe specifications',
          plating_instructions: garnish,
          prep_time: prepTime,
          yield_quantity: Number(firstRow['Yield Quantity'] || 1),
          yield_unit: String(firstRow['Yield Unit'] || 'drink').trim(),
          bom_status: 'ACTIVE',
          is_production: false
        };

        if (price !== null && !isNaN(price)) {
          recipePayload.selling_price = price;
        }

        if (recipeId) {
          await supabase.from('menu_recipes').update(recipePayload).eq('id', recipeId);
        } else {
          const { data: newRecipe, error: recErr } = await supabase
            .from('menu_recipes')
            .insert(recipePayload)
            .select()
            .single();

          if (recErr || !newRecipe) {
            result.warnings.push(`Could not create recipe header for "${productName}": ${recErr?.message || 'Unknown error'}`);
          } else {
            recipeId = newRecipe.id;
          }
        }

        // F. Parse Ingredients (Recipe Components)
        if (recipeId && hasIngredients) {
          const validComponents: any[] = [];

          for (const row of rows) {
            const itemName = String(
              row['Ingredient Item Name'] || 
              row['Ingredient'] || 
              row['Item Name'] || 
              row['item_name'] || 
              ''
            ).trim();

            if (!itemName) continue; // Skip blank ingredient rows

            const rawQty = row['Quantity'] ?? row['qty'] ?? 1;
            const qty = Number(rawQty);
            const rawUnit = String(row['Unit'] || row['unit'] || 'ml').trim();
            const rawWaste = row['Waste %'] ?? row['waste'] ?? 0;
            const waste = Number(rawWaste) || 0;
            const notes = String(row['Ingredient Notes'] ?? row['Notes'] ?? row['notes'] ?? '').trim();

            // Locate Item in items catalog (case-insensitive exact or substring match)
            let matchedItem = items.find(i => i.name.trim().toLowerCase() === itemName.toLowerCase())
              || items.find(i => i.name.toLowerCase().includes(itemName.toLowerCase()));

            if (!matchedItem) {
              const meta = determineSubDeptAndUnit(itemName, rawUnit);
              const newItemPayload: any = {
                name: itemName,
                department: meta.dept,
                sub_department: meta.sub,
                unit: meta.unit,
                base_unit: meta.base_unit,
                preferred_recipe_unit: meta.pref,
                step: meta.step,
                par_level: 1,
                delivery_time: '',
                order: 'yes',
                purchasing: 'yes',
                price_usd: 0,
                vat: 'yes',
                restaurant_id: DEFAULT_RESTAURANT_ID
              };
              const { data: createdItem, error: itmErr } = await supabase
                .from('items')
                .insert(newItemPayload)
                .select()
                .single();

              if (!itmErr && createdItem) {
                matchedItem = createdItem;
                items.push(createdItem);
              } else {
                result.warnings.push(`Row ${row._rowNum} ("${productName}"): Item "${itemName}" could not be auto-created: ${itmErr?.message || 'unknown error'}`);
                continue;
              }
            }

            validComponents.push({
              recipe_id: recipeId,
              item_id: matchedItem.id,
              base_quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
              unit: rawUnit || matchedItem.base_unit || matchedItem.unit || 'ml',
              waste_percentage: Math.max(0, Math.min(99, waste)),
              notes: notes || null,
              sort_order: validComponents.length
            });
          }

          // Save BOM components to recipe_components
          if (validComponents.length > 0) {
            await supabase.from('recipe_components').delete().eq('recipe_id', recipeId);

            const { error: compErr } = await supabase
              .from('recipe_components')
              .insert(validComponents);

            if (compErr) {
              result.warnings.push(`Error saving ingredients for "${productName}": ${compErr.message}`);
            } else {
              result.totalIngredients += validComponents.length;
            }
          }
        }
      }

      result.createdProducts.push(productName);
      result.totalProducts++;
    }

    result.success = result.createdProducts.length > 0;
    return result;
  } catch (err: any) {
    result.errors.push(`Spreadsheet processing error: ${err.message}`);
    return result;
  }
}
