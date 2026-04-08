import { sql } from '@vercel/postgres';

export interface ServiceFeeConfig {
  id: string;
  tier_value: number;
  service_fee: number;
}

/**
 * Fetch service fee configuration from database
 */
export async function getServiceFeeConfig(): Promise<ServiceFeeConfig[]> {
  try {
    const result = await sql`
      SELECT id, tier_value, service_fee 
      FROM service_fee_config 
      ORDER BY tier_value ASC
    `;
    return result.rows as ServiceFeeConfig[];
  } catch (error) {
    console.error('Error fetching service fee config:', error);
    // Return default config if database fails
    return getDefaultServiceFeeConfig();
  }
}

/**
 * Get default service fee configuration
 */
export function getDefaultServiceFeeConfig(): ServiceFeeConfig[] {
  return [
    { id: 'tier-1', tier_value: 1000, service_fee: 100 },
    { id: 'tier-2', tier_value: 3000, service_fee: 200 },
    { id: 'tier-3', tier_value: 7000, service_fee: 300 },
    { id: 'tier-4', tier_value: 15000, service_fee: 500 },
    { id: 'tier-5', tier_value: 22000, service_fee: 700 },
    { id: 'tier-6', tier_value: 30000, service_fee: 1000 },
  ];
}

/**
 * Calculate service fee based on order total and configuration
 * Supports dynamic ₦100 for every ₦10,000 above 30,000
 */
export function calculateServiceFee(subtotal: number, config: ServiceFeeConfig[]): number {
  if (subtotal < 1000) return 0;

  // Sort config by tier value
  const sortedConfig = [...config].sort((a, b) => b.tier_value - a.tier_value);

  // Find matching tier
  for (const tier of sortedConfig) {
    if (subtotal >= tier.tier_value) {
      // For amounts above 30,000, add ₦100 for every ₦10,000
      if (tier.tier_value === 30000) {
        const baseAmount = 30000;
        const additionalAmount = Math.floor((subtotal - baseAmount) / 10000);
        return tier.service_fee + additionalAmount * 100;
      }
      return tier.service_fee;
    }
  }

  return 0;
}

/**
 * Get all orders with legacy 7.5% fees marked for migration tracking
 */
export async function markLegacyOrders(): Promise<void> {
  try {
    // Mark all orders without service fee info as legacy
    await sql`
      INSERT INTO order_service_fees (order_id, service_fee_amount, service_fee_type)
      SELECT id, ROUND(total_amount * 0.075, 2), 'legacy_percentage'
      FROM orders
      WHERE id NOT IN (SELECT order_id FROM order_service_fees)
      AND status = 'completed'
      AND paid_at IS NOT NULL
    `;
  } catch (error) {
    console.error('Error marking legacy orders:', error);
  }
}

/**
 * Save service fee for an order
 */
export async function saveOrderServiceFee(
  orderId: string,
  serviceFeeAmount: number,
  serviceFeeType: 'tiered' | 'legacy_percentage' = 'tiered'
): Promise<void> {
  try {
    await sql`
      INSERT INTO order_service_fees (order_id, service_fee_amount, service_fee_type)
      VALUES (${orderId}, ${serviceFeeAmount}, ${serviceFeeType})
      ON CONFLICT (order_id) DO UPDATE
      SET service_fee_amount = EXCLUDED.service_fee_amount,
          service_fee_type = EXCLUDED.service_fee_type
    `;
  } catch (error) {
    console.error('Error saving order service fee:', error);
    throw error;
  }
}

/**
 * Update service fee configuration
 */
export async function updateServiceFeeConfig(tiers: ServiceFeeConfig[]): Promise<void> {
  try {
    // Delete existing config
    await sql`DELETE FROM service_fee_config`;

    // Insert new config
    for (const tier of tiers) {
      await sql`
        INSERT INTO service_fee_config (tier_value, service_fee)
        VALUES (${tier.tier_value}, ${tier.service_fee})
      `;
    }
  } catch (error) {
    console.error('Error updating service fee config:', error);
    throw error;
  }
}
