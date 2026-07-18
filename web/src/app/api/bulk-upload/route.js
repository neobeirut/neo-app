import Papa from "papaparse";
import sql from "@/app/api/utils/sql";

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const type = formData.get("type"); // 'products' or 'categories'

    if (!file || !type) {
      return Response.json(
        { error: "File and type are required" },
        { status: 400 },
      );
    }

    const fileText = await file.text();

    // Parse CSV data
    const parseResult = Papa.parse(fileText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase(),
    });

    if (parseResult.errors.length > 0) {
      return Response.json(
        { error: "CSV parsing error", details: parseResult.errors },
        { status: 400 },
      );
    }

    const data = parseResult.data;
    let results = { success: 0, errors: [] };

    if (type === "categories") {
      // Process categories
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        try {
          // Expected columns: name, image_url, display_order, is_active, section
          const categoryData = {
            name: row.name || row.category_name,
            image_url: row.image_url || row.image || "",
            display_order: parseInt(row.display_order || row.order || 0),
            is_active:
              row.is_active !== undefined
                ? row.is_active === "true" || row.is_active === "1"
                : true,
            section: row.section || "Store",
          };

          if (!categoryData.name) {
            results.errors.push(`Row ${i + 1}: Missing category name`);
            continue;
          }

          await sql`
            INSERT INTO categories (name, image_url, display_order, is_active, section)
            VALUES (${categoryData.name}, ${categoryData.image_url}, ${categoryData.display_order}, ${categoryData.is_active}, ${categoryData.section})
          `;

          results.success++;
        } catch (error) {
          results.errors.push(`Row ${i + 1}: ${error.message}`);
        }
      }
    } else if (type === "products") {
      // Process products - first get categories for mapping
      const categories = await sql`SELECT id, name FROM categories`;
      const categoryMap = {};
      categories.forEach((cat) => {
        categoryMap[cat.name.toLowerCase()] = cat.id;
      });

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        try {
          // Expected columns: name, description, price, original_price, image_url, category, prep_time, rating, ingredients, nutritional_info, is_featured, is_special, status
          const categoryName = row.category || row.category_name;
          const categoryId = categoryName
            ? categoryMap[categoryName.toLowerCase()]
            : null;

          const productData = {
            name: row.name || row.product_name,
            description: row.description || "",
            price: parseFloat(row.price || 0),
            original_price: row.original_price
              ? parseFloat(row.original_price)
              : null,
            image_url: row.image_url || row.image || "",
            category_id: categoryId,
            prep_time: row.prep_time || row.preparation_time || "",
            rating: row.rating ? parseFloat(row.rating) : 0,
            ingredients: row.ingredients || "",
            nutritional_info: row.nutritional_info || row.nutrition || "",
            is_featured: row.is_featured === "true" || row.is_featured === "1",
            is_special: row.is_special === "true" || row.is_special === "1",
            status: row.status || "Available",
          };

          if (!productData.name) {
            results.errors.push(`Row ${i + 1}: Missing product name`);
            continue;
          }

          if (productData.price <= 0) {
            results.errors.push(`Row ${i + 1}: Invalid price`);
            continue;
          }

          await sql`
            INSERT INTO products (
              name, description, price, original_price, image_url, category_id,
              prep_time, rating, ingredients, nutritional_info,
              is_featured, is_special, status
            ) VALUES (
              ${productData.name}, ${productData.description}, ${productData.price}, 
              ${productData.original_price}, ${productData.image_url}, ${productData.category_id},
              ${productData.prep_time}, ${productData.rating},
              ${productData.ingredients}, ${productData.nutritional_info},
              ${productData.is_featured}, ${productData.is_special}, ${productData.status}
            )
          `;

          results.success++;
        } catch (error) {
          results.errors.push(`Row ${i + 1}: ${error.message}`);
        }
      }
    } else {
      return Response.json(
        { error: 'Invalid type. Must be "products" or "categories"' },
        { status: 400 },
      );
    }

    return Response.json({
      message: `Bulk upload completed`,
      success: results.success,
      errors: results.errors,
      total: data.length,
    });
  } catch (error) {
    console.error("Bulk upload error:", error);
    return Response.json(
      { error: "Failed to process bulk upload", details: error.message },
      { status: 500 },
    );
  }
}
