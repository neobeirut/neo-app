import sql from "@/app/api/utils/sql";

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const { name, image_url, display_order, section, is_active } =
      await request.json();

    const [category] = await sql`
      UPDATE categories 
      SET name = ${name}, 
          image_url = ${image_url}, 
          display_order = ${display_order},
          section = ${section || "Store"},
          is_active = ${is_active}
      WHERE id = ${id}
      RETURNING *
    `;

    if (!category) {
      return Response.json({ error: "Category not found" }, { status: 404 });
    }

    return Response.json({ category });
  } catch (error) {
    console.error("Error updating category:", error);
    return Response.json(
      { error: "Failed to update category" },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;

    const [category] = await sql`
      UPDATE categories 
      SET is_active = false
      WHERE id = ${id}
      RETURNING *
    `;

    if (!category) {
      return Response.json({ error: "Category not found" }, { status: 404 });
    }

    return Response.json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("Error deleting category:", error);
    return Response.json(
      { error: "Failed to delete category" },
      { status: 500 },
    );
  }
}
