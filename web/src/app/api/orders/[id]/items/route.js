import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

// Update order items
export async function PUT(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const { id } = params;
    const { items } = await request.json(); // Array of { id?, product_id, quantity, selected_addons }

    // Recalculate total
    let totalAmount = 0;

    for (const item of items) {
      // Get product price
      const product = await sql`
        SELECT * FROM products WHERE id = ${item.product_id}
      `;

      if (product.length === 0) {
        return Response.json(
          { error: `Product with ID ${item.product_id} not found` },
          { status: 400 },
        );
      }

      const productPrice = parseFloat(product[0].price);
      let itemTotal = productPrice * item.quantity;

      // Calculate addon costs
      if (item.selected_addons && item.selected_addons.length > 0) {
        const addons = await sql`
          SELECT * FROM product_addons 
          WHERE id = ANY(${item.selected_addons})
        `;
        const addonTotal =
          addons.reduce((sum, addon) => sum + parseFloat(addon.price), 0) *
          item.quantity;
        itemTotal += addonTotal;
      }

      totalAmount += itemTotal;

      if (item.id) {
        // Update existing item
        await sql`
          UPDATE order_items 
          SET quantity = ${item.quantity},
              unit_price = ${productPrice},
              total_price = ${itemTotal}
          WHERE id = ${item.id} AND order_id = ${id}
        `;

        // Delete old addons
        await sql`
          DELETE FROM order_item_addons WHERE order_item_id = ${item.id}
        `;

        // Add new addons
        if (item.selected_addons && item.selected_addons.length > 0) {
          for (const addonId of item.selected_addons) {
            const addon =
              await sql`SELECT * FROM product_addons WHERE id = ${addonId}`;
            if (addon.length > 0) {
              await sql`
                INSERT INTO order_item_addons (order_item_id, product_addon_id, quantity, price)
                VALUES (${item.id}, ${addonId}, 1, ${addon[0].price})
              `;
            }
          }
        }
      } else {
        // Add new item
        const result = await sql`
          INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price)
          VALUES (${id}, ${item.product_id}, ${item.quantity}, ${productPrice}, ${itemTotal})
          RETURNING id
        `;

        const orderItemId = result[0].id;

        // Add addons for new item
        if (item.selected_addons && item.selected_addons.length > 0) {
          for (const addonId of item.selected_addons) {
            const addon =
              await sql`SELECT * FROM product_addons WHERE id = ${addonId}`;
            if (addon.length > 0) {
              await sql`
                INSERT INTO order_item_addons (order_item_id, product_addon_id, quantity, price)
                VALUES (${orderItemId}, ${addonId}, 1, ${addon[0].price})
              `;
            }
          }
        }
      }
    }

    // Update order total
    await sql`
      UPDATE orders 
      SET total_amount = ${totalAmount}
      WHERE id = ${id}
    `;

    return Response.json({
      message: "Order items updated successfully",
      total_amount: totalAmount,
    });
  } catch (error) {
    console.error("Error updating order items:", error);
    return Response.json(
      { error: "Failed to update order items", details: error.message },
      { status: 500 },
    );
  }
}

// Delete order item
export async function DELETE(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const { id } = params;
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get("item_id");

    if (!itemId) {
      return Response.json({ error: "Item ID is required" }, { status: 400 });
    }

    // Delete the item
    await sql`
      DELETE FROM order_items WHERE id = ${itemId} AND order_id = ${id}
    `;

    // Recalculate order total
    const items = await sql`
      SELECT total_price FROM order_items WHERE order_id = ${id}
    `;

    const newTotal = items.reduce(
      (sum, item) => sum + parseFloat(item.total_price),
      0,
    );

    await sql`
      UPDATE orders 
      SET total_amount = ${newTotal}
      WHERE id = ${id}
    `;

    return Response.json({
      message: "Order item deleted successfully",
      total_amount: newTotal,
    });
  } catch (error) {
    console.error("Error deleting order item:", error);
    return Response.json(
      { error: "Failed to delete order item", details: error.message },
      { status: 500 },
    );
  }
}
