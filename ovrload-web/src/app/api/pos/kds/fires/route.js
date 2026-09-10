import sql from '../../../utils/sql';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const locationKey = (searchParams.get('location_key') || 'cloud-kitchen').toLowerCase();
    const stationKey = searchParams.get('station_key');
    const isExpo = searchParams.get('is_expo') === 'true' || stationKey === 'EXPO';
    const statusFilter = searchParams.get('status') || 'active';

    // Fetch active fires for this location
    const fires = await sql`
      SELECT 
        f.id, f.operation_id, f.order_id, f.fire_number, f.location_key,
        f.service_type, f.table_label_snapshot, f.guest_count_snapshot,
        f.waiter_reference_snapshot, f.fired_by_reference, f.terminal_id,
        f.status, f.fired_at, f.created_at,
        o.order_source, o.status as commerce_order_status
      FROM kitchen_fires f
      LEFT JOIN orders o ON f.order_id = o.id
      WHERE f.location_key = ${locationKey}
        AND f.status = ${statusFilter}
      ORDER BY f.fired_at ASC;
    `;

    if (fires.length === 0) {
      return Response.json({ success: true, location_key: locationKey, fires: [] });
    }

    const fireIds = fires.map(f => f.id);

    // Fetch fire items
    let itemsQuery;
    if (isExpo || !stationKey) {
      // Rule 10: Expo reads all production station items without duplicate rows
      itemsQuery = sql`
        SELECT 
          kfi.*,
          oi.customizations as raw_customizations,
          oi.comment as raw_comment
        FROM kitchen_fire_items kfi
        LEFT JOIN order_items oi ON kfi.order_item_id = oi.id
        WHERE kfi.fire_id = ANY(${fireIds}::int[])
        ORDER BY kfi.id ASC;
      `;
    } else {
      // Prep station: only items assigned to this specific station
      itemsQuery = sql`
        SELECT 
          kfi.*,
          oi.customizations as raw_customizations,
          oi.comment as raw_comment
        FROM kitchen_fire_items kfi
        LEFT JOIN order_items oi ON kfi.order_item_id = oi.id
        WHERE kfi.fire_id = ANY(${fireIds}::int[])
          AND kfi.station_key = ${stationKey.toUpperCase()}
        ORDER BY kfi.id ASC;
      `;
    }

    const items = await itemsQuery;

    // Group items by fire_id
    const itemsByFire = {};
    for (const it of items) {
      if (!itemsByFire[it.fire_id]) itemsByFire[it.fire_id] = [];
      itemsByFire[it.fire_id].push(it);
    }

    const resultFires = fires.map(f => {
      const fItems = itemsByFire[f.id] || [];
      const nonVoided = fItems.filter(i => i.status !== 'voided');
      const allReady = nonVoided.length > 0 && nonVoided.every(i => i.status === 'ready' || i.status === 'bumped');
      const allBumped = nonVoided.length > 0 && nonVoided.every(i => i.status === 'bumped');
      const readyCount = nonVoided.filter(i => i.status === 'ready' || i.status === 'bumped').length;

      return {
        ...f,
        items: fItems,
        item_count: fItems.length,
        ready_count: readyCount,
        total_active_items: nonVoided.length,
        all_ready: allReady,
        all_bumped: allBumped,
        expo_status: allBumped ? 'served' : allReady ? 'ready_to_serve' : 'in_prep'
      };
    }).filter(f => isExpo ? true : f.items.length > 0);

    return Response.json({
      success: true,
      location_key: locationKey,
      station_key: stationKey || 'ALL',
      is_expo: isExpo,
      fires: resultFires
    });
  } catch (err) {
    console.error("Error in GET /api/pos/kds/fires:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
