import type { PaymentMethodCategory, SupportedCurrency } from './types';

export interface PaymentMethodOption {
  id: string;
  name: string;
  label: string;
  category: PaymentMethodCategory;
  currency: SupportedCurrency;
  iconName: string;
  badge?: string;
}

export const PAYMENT_METHODS: PaymentMethodOption[] = [
  {
    id: 'cash_usd',
    name: 'Cash USD',
    label: 'Cash ($)',
    category: 'direct',
    currency: 'USD',
    iconName: 'DollarSign'
  },
  {
    id: 'cash_lbp',
    name: 'Cash LBP',
    label: 'Cash (LBP)',
    category: 'direct',
    currency: 'LBP',
    iconName: 'Banknote'
  },
  {
    id: 'card',
    name: 'Card',
    label: 'Credit / Debit Card',
    category: 'direct',
    currency: 'USD',
    iconName: 'CreditCard'
  },
  {
    id: 'whish',
    name: 'Whish',
    label: 'Whish Money',
    category: 'direct',
    currency: 'USD',
    iconName: 'Zap'
  },
  {
    id: 'toters',
    name: 'Toters',
    label: 'Toters (Aggregator)',
    category: 'aggregator',
    currency: 'USD',
    iconName: 'ShoppingBag',
    badge: 'Aggregator'
  },
  {
    id: 'noknok',
    name: 'NokNok',
    label: 'NokNok (Aggregator)',
    category: 'aggregator',
    currency: 'USD',
    iconName: 'ShoppingBag',
    badge: 'Aggregator'
  }
];

export const USD_PRESETS = [5, 10, 20, 50, 100];
export const LBP_PRESETS = [100000, 250000, 500000, 1000000, 2000000];

export const REFUND_REASON_PRESETS = [
  'Customer returned / cancelled item',
  'Wrong item prepared or delivered',
  'Food quality or temperature complaint',
  'Cashier / ringing input mistake',
  'Manager discretionary refund'
];
