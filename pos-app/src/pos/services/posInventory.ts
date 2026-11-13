/** Preserve product-linked modifier identities independently of receipt text. */
export function readModifiers(line: any): any[] {
  let value = line.customizations_json;
  if (!value || (Array.isArray(value) && !value.length)) value = line.selectedCustomizations ?? line.customizations ?? [];
  for (let depth = 0; typeof value === 'string' && depth < 3; depth++) {
    try { value = JSON.parse(value); } catch { value = value.split(',').map((name: string) => name.trim()).filter(Boolean); break; }
  }
  if (!Array.isArray(value)) value = value && typeof value === 'object' ? [value] : [];
  return value.map((option: any) => typeof option === 'string' ? { name: option, quantity: 1 } : { ...option, name: option.name || option.ingredient || '' });
}

function optionalId(value: any): number | null {
  if (value === '' || value === null || value === undefined) return null;
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid modifier identifier. Reload the product options.');
  return id;
}

export function serializeModifiers(value: any[]): any[] {
  return readModifiers({ selectedCustomizations: value }).map(option => {
    const quantity = Number(option.quantity ?? option.qty ?? 1);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Modifier quantity must be greater than zero.');
    return {
      product_customization_id: optionalId(option.product_customization_id ?? option.id),
      customization_item_id: optionalId(option.customization_item_id),
      name: option.name || option.ingredient || '', quantity,
      price: Number(option.price ?? 0),
      customization_type: option.customization_type,
      option_group_name: option.option_group_name
    };
  });
}

export function restoreModifiers(line: any, options: any[] = []): any[] {
  return readModifiers(line).map(saved => {
    const matches = options.filter(option => saved.product_customization_id != null
      ? String(option.product_customization_id ?? option.id) === String(saved.product_customization_id)
      : saved.customization_item_id != null
        ? String(option.customization_item_id) === String(saved.customization_item_id)
        : (option.name || option.ingredient || '').trim().toLowerCase() === saved.name.trim().toLowerCase());
    const current = matches.length === 1 ? matches[0] : undefined;
    return { ...current, ...saved, id: current?.id ?? saved.product_customization_id ?? saved.id,
      product_customization_id: saved.product_customization_id ?? current?.product_customization_id ?? current?.id,
      option_group_name: saved.option_group_name ?? current?.option_group_name,
      customization_type: saved.customization_type ?? current?.customization_type,
      quantity: Number(saved.quantity ?? saved.qty ?? 1) };
  });
}

export function modifierText(options: any[]): string {
  return readModifiers({ selectedCustomizations: options }).map(option => {
    const qty = Number(option.quantity ?? option.qty ?? 1);
    return qty > 1 ? `${option.name} x${qty}` : option.name;
  }).filter(Boolean).join(', ');
}

export function inventoryLines(lines: any[], channel: string): any[] {
  return lines.filter(line => !line.isHoldSeparator && !String(line.product_id).startsWith('hold_')).map(line => {
    const id = line.line_item_id || line.source_line_id || String(line.id || '');
    const productId = Number(line.product_id);
    const quantity = Number(line.quantity ?? line.qty ?? 1);
    if (!id || !Number.isSafeInteger(productId) || productId <= 0 || !Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('A sale line is missing a valid product, quantity or saved line identity. Reload the order before retrying stock.');
    }
    return { source_line_id: String(id), product_id: productId, quantity,
      name: line.name || line.product_name || 'Item', unit_price: Number(line.unit_price ?? 0),
      channel: String(line.channel || channel).toUpperCase(), customizations: serializeModifiers(readModifiers(line)) };
  });
}
