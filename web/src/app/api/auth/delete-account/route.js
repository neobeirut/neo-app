import sql from "@/app/api/utils/sql";

export async function POST(request) {
  try {
    const { phone } = await request.json();

    if (!phone) {
      return Response.json(
        { error: "Phone number is required" },
        { status: 400 },
      );
    }

    // Get user ID first
    const users = await sql`
      SELECT id FROM auth_users 
      WHERE phone = ${phone} AND is_active = true
    `;

    if (users.length === 0) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const userId = users[0].id;

    console.log(
      `[DELETE ACCOUNT] Starting deletion for user ${userId}, phone: ${phone}`,
    );

    // Delete in correct order to respect foreign key constraints
    // Start with child tables first, then parent tables
    try {
      // 1. Delete user push tokens (depends on auth_users)
      await sql`DELETE FROM user_push_tokens WHERE user_id = ${userId}`;
      console.log(`[DELETE ACCOUNT] Deleted push tokens`);

      // 2. Delete loyalty transactions (depends on auth_users)
      await sql`DELETE FROM loyalty_transactions WHERE user_id = ${userId}`;
      console.log(`[DELETE ACCOUNT] Deleted loyalty transactions`);

      // 3. Delete user reward redemptions (depends on auth_users and rewards)
      await sql`DELETE FROM user_reward_redemptions WHERE user_id = ${userId}`;
      console.log(`[DELETE ACCOUNT] Deleted reward redemptions`);

      // 4. Delete user rewards (depends on auth_users)
      await sql`DELETE FROM user_rewards WHERE user_id = ${userId}`;
      console.log(`[DELETE ACCOUNT] Deleted user rewards`);

      // 5. Delete favorites (depends on auth_users)
      await sql`DELETE FROM user_favorites WHERE user_id = ${userId}`;
      console.log(`[DELETE ACCOUNT] Deleted favorites`);

      // 6. Nullify promo redemptions user reference (keep redemption records for business)
      await sql`
        UPDATE promo_redemptions 
        SET user_id = NULL 
        WHERE user_id = ${userId}
      `;
      console.log(`[DELETE ACCOUNT] Nullified promo redemptions`);

      // 7. Get all address IDs for this user BEFORE nullifying/deleting
      const userAddresses = await sql`
        SELECT id FROM user_addresses WHERE user_id = ${userId}
      `;
      const addressIds = userAddresses.map((addr) => addr.id);
      console.log(
        `[DELETE ACCOUNT] Found ${addressIds.length} addresses to handle`,
      );

      // 8. Nullify orders references (user_id AND address_id) - MUST be before deleting addresses
      // This handles the foreign key constraint from orders.address_id to user_addresses.id
      if (addressIds.length > 0) {
        await sql`
          UPDATE orders 
          SET user_id = NULL, address_id = NULL
          WHERE user_id = ${userId} OR address_id = ANY(${addressIds})
        `;
      } else {
        await sql`
          UPDATE orders 
          SET user_id = NULL
          WHERE user_id = ${userId}
        `;
      }
      console.log(
        `[DELETE ACCOUNT] Nullified orders user and address references`,
      );

      // 9. NOW we can delete user addresses (after nullifying references in orders)
      await sql`DELETE FROM user_addresses WHERE user_id = ${userId}`;
      console.log(`[DELETE ACCOUNT] Deleted addresses`);

      // 10. Delete cart items (depends on auth_users)
      await sql`DELETE FROM cart_items WHERE user_id = ${userId}`;
      console.log(`[DELETE ACCOUNT] Deleted cart items`);

      // 11. Delete product reviews (depends on auth_users)
      await sql`DELETE FROM product_reviews WHERE user_id = ${userId}`;
      console.log(`[DELETE ACCOUNT] Deleted product reviews`);

      // 12. Delete WhatsApp messages (depends on auth_users)
      await sql`DELETE FROM customer_whatsapp_messages WHERE user_id = ${userId}`;
      console.log(`[DELETE ACCOUNT] Deleted WhatsApp messages`);

      // 13. Update WhatsApp conversations to remove customer reference
      await sql`
        UPDATE whatsapp_conversations 
        SET customer_id = NULL 
        WHERE customer_id = ${userId}
      `;
      console.log(`[DELETE ACCOUNT] Updated WhatsApp conversations`);

      // 14. Delete order feedback (depends on auth_users)
      await sql`DELETE FROM order_feedback WHERE user_id = ${userId}`;
      console.log(`[DELETE ACCOUNT] Deleted order feedback`);

      // 15. Delete user sessions (depends on auth_users)
      await sql`DELETE FROM auth_sessions WHERE "userId" = ${userId}`;
      console.log(`[DELETE ACCOUNT] Deleted sessions`);

      // 16. Delete user accounts (OAuth, credentials - depends on auth_users)
      await sql`DELETE FROM auth_accounts WHERE "userId" = ${userId}`;
      console.log(`[DELETE ACCOUNT] Deleted auth accounts`);

      // 17. Delete verification tokens
      await sql`DELETE FROM auth_verification_token WHERE identifier = ${phone}`;
      console.log(`[DELETE ACCOUNT] Deleted verification tokens`);

      // 18. Delete phone verification codes
      await sql`DELETE FROM phone_verification_codes WHERE phone = ${phone}`;
      console.log(`[DELETE ACCOUNT] Deleted phone verification codes`);

      // 19. Delete Bird phone verifications
      await sql`DELETE FROM bird_phone_verifications WHERE phone = ${phone}`;
      console.log(`[DELETE ACCOUNT] Deleted Bird phone verifications`);

      // 20. Finally, anonymize the user record (keep for order history but remove PII)
      await sql`
        UPDATE auth_users 
        SET 
          name = 'Deleted User',
          email = NULL,
          phone = NULL,
          first_name = NULL,
          last_name = NULL,
          birthday = NULL,
          image = NULL,
          push_token = NULL,
          is_active = false,
          "emailVerified" = NULL,
          points = 0,
          total_spent = 0
        WHERE id = ${userId}
      `;
      console.log(`[DELETE ACCOUNT] Anonymized user record`);

      console.log(
        `[DELETE ACCOUNT] Successfully deleted account for user ${userId}`,
      );

      return Response.json({
        success: true,
        message: "Account and personal data deleted successfully",
      });
    } catch (deleteError) {
      console.error(`[DELETE ACCOUNT] Error during deletion:`, deleteError);
      console.error(`[DELETE ACCOUNT] Error details:`, {
        message: deleteError.message,
        stack: deleteError.stack,
        code: deleteError.code,
      });
      throw deleteError;
    }
  } catch (error) {
    console.error("[DELETE ACCOUNT] Top-level error:", error);
    return Response.json(
      {
        error: "Failed to delete account",
        details: error.message,
        hint: "Please contact support if this issue persists",
      },
      { status: 500 },
    );
  }
}
