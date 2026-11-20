import React, { useState, useEffect } from 'react';
import {
  Building2,
  Receipt,
  Coins,
  ShieldCheck,
  CheckCircle,
  Save,
  RefreshCw,
  ExternalLink,
  Store,
  Info,
  Palette,
  FileText
} from 'lucide-react';
import { supabase } from '../api/supabase';
import { api, getRestaurantId } from '../api/client';

interface CompanySettingsProps {
  user?: any;
  onUpdateUser?: () => void;
}

export default function CompanySettingsScreen({ user, onUpdateUser }: CompanySettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Legal & Fiscal Settings
  const [companyLegalName, setCompanyLegalName] = useState('Neo Beirut S.A.L.');
  const [mofNumber, setMofNumber] = useState('382910-601');
  const [commercialRegister, setCommercialRegister] = useState('');

  // Receipt & Bill Customization
  const [receiptRestaurantName, setReceiptRestaurantName] = useState('Neo Beirut');
  const [receiptFooterText, setReceiptFooterText] = useState('Thank you for dining with us! Come back soon.');

  // Currency & Tax Parameters
  const [exchangeRate, setExchangeRate] = useState<number>(89500);
  const [vatRate, setVatRate] = useState<number>(11);
  const [isVatSubscribed, setIsVatSubscribed] = useState<boolean>(true);

  // Brand Identity
  const [restaurantName, setRestaurantName] = useState('Neo Beirut');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#1e5c4f');

  const currentRestaurantId = user?.restaurant_id || getRestaurantId();

  useEffect(() => {
    loadSettings();
  }, [currentRestaurantId]);

  const loadSettings = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      // 1. Fetch from app_settings
      const { data: appData, error: appErr } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value')
        .in('setting_key', [
          'company_legal_name',
          'mof_number',
          'commercial_register',
          'receipt_restaurant_name',
          'receipt_footer_text',
          'exchange_rate',
          'vat_rate',
          'logo_url'
        ]);

      if (appErr) {
        console.warn('Error loading app_settings:', appErr);
      }

      const settingsMap: Record<string, string> = {};
      if (appData) {
        appData.forEach(row => {
          if (row.setting_key && row.setting_value !== undefined) {
            settingsMap[row.setting_key] = row.setting_value;
          }
        });
      }

      // 2. Fetch from restaurants table
      let restoData: any = null;
      if (currentRestaurantId) {
        const { data: rData } = await supabase
          .from('restaurants')
          .select('*')
          .eq('id', currentRestaurantId)
          .maybeSingle();
        restoData = rData;
      }

      const rSettings = restoData?.settings || {};

      // Prioritize explicit app_settings or restaurants.settings
      const resolvedLegalName = settingsMap['company_legal_name'] || rSettings.company_legal_name || 'Neo Beirut S.A.L.';
      const resolvedMof = settingsMap['mof_number'] || rSettings.mof_number || '382910-601';
      const resolvedCR = settingsMap['commercial_register'] || rSettings.commercial_register || '';
      const resolvedHeader = settingsMap['receipt_restaurant_name'] || rSettings.receipt_restaurant_name || restoData?.name || 'Neo Beirut';
      const resolvedFooter = settingsMap['receipt_footer_text'] || rSettings.receipt_footer_text || 'Thank you for dining with us! Come back soon.';
      const resolvedExchange = settingsMap['exchange_rate'] 
        ? parseFloat(settingsMap['exchange_rate']) 
        : (rSettings.exchange_rate ? parseFloat(rSettings.exchange_rate) : 89500);
      const resolvedVat = settingsMap['vat_rate'] 
        ? parseFloat(settingsMap['vat_rate']) 
        : (rSettings.vat_rate !== undefined ? parseFloat(rSettings.vat_rate) : 11);
      const resolvedVatSub = rSettings.is_vat_subscribed !== undefined ? Boolean(rSettings.is_vat_subscribed) : true;

      setCompanyLegalName(resolvedLegalName);
      setMofNumber(resolvedMof);
      setCommercialRegister(resolvedCR);
      setReceiptRestaurantName(resolvedHeader);
      setReceiptFooterText(resolvedFooter);
      setExchangeRate(resolvedExchange || 89500);
      setVatRate(resolvedVat || 11);
      setIsVatSubscribed(resolvedVatSub);

      if (restoData?.name) setRestaurantName(restoData.name);
      if (settingsMap['logo_url']) setLogoUrl(settingsMap['logo_url']);
      else if (restoData?.logo_url) setLogoUrl(restoData.logo_url);
      if (restoData?.primary_color) setPrimaryColor(restoData.primary_color);

    } catch (err: any) {
      console.error('Error loading company settings:', err);
      setErrorMessage(err.message || 'Failed to load company settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setErrorMessage('');
    setSavedSuccess(false);

    try {
      const trimmedLegal = companyLegalName.trim();
      const trimmedMof = mofNumber.trim();
      const trimmedCR = commercialRegister.trim();
      const trimmedHeader = receiptRestaurantName.trim();
      const trimmedFooter = receiptFooterText.trim();
      const trimmedName = restaurantName.trim();

      // 1. Upsert into app_settings (batch)
      const settingsPayload = [
        { setting_key: 'company_legal_name', setting_value: trimmedLegal, updated_at: new Date().toISOString() },
        { setting_key: 'mof_number', setting_value: trimmedMof, updated_at: new Date().toISOString() },
        { setting_key: 'commercial_register', setting_value: trimmedCR, updated_at: new Date().toISOString() },
        { setting_key: 'receipt_restaurant_name', setting_value: trimmedHeader, updated_at: new Date().toISOString() },
        { setting_key: 'receipt_footer_text', setting_value: trimmedFooter, updated_at: new Date().toISOString() },
        { setting_key: 'exchange_rate', setting_value: exchangeRate.toString(), updated_at: new Date().toISOString() },
        { setting_key: 'vat_rate', setting_value: vatRate.toString(), updated_at: new Date().toISOString() },
        { setting_key: 'logo_url', setting_value: logoUrl.trim(), updated_at: new Date().toISOString() }
      ];

      const { error: upsertErr } = await supabase
        .from('app_settings')
        .upsert(settingsPayload, { onConflict: 'setting_key' });

      if (upsertErr) {
        console.warn('Upsert to app_settings warning:', upsertErr);
      }

      // 2. Also update restaurants table if restaurant_id is present
      if (currentRestaurantId) {
        const { data: existingResto } = await supabase
          .from('restaurants')
          .select('settings')
          .eq('id', currentRestaurantId)
          .maybeSingle();

        const currentSettings = existingResto?.settings || {};
        const updatedSettings = {
          ...currentSettings,
          company_legal_name: trimmedLegal,
          mof_number: trimmedMof,
          commercial_register: trimmedCR,
          receipt_restaurant_name: trimmedHeader,
          receipt_footer_text: trimmedFooter,
          exchange_rate: exchangeRate,
          vat_rate: vatRate,
          is_vat_subscribed: isVatSubscribed
        };

        const updatePayload: any = {
          settings: updatedSettings
        };
        if (trimmedName) updatePayload.name = trimmedName;
        if (logoUrl !== undefined) updatePayload.logo_url = logoUrl.trim();
        if (primaryColor) updatePayload.primary_color = primaryColor;

        const { error: restoErr } = await supabase
          .from('restaurants')
          .update(updatePayload)
          .eq('id', currentRestaurantId);

        if (restoErr) {
          console.warn('Update restaurants table warning:', restoErr);
        }
      }

      // 3. Cache to localStorage for immediate client-side resilience
      localStorage.setItem('flow_pos_restaurant_name', trimmedHeader);
      localStorage.setItem('flow_pos_company_legal_name', trimmedLegal);
      localStorage.setItem('flow_pos_mof_number', trimmedMof);
      localStorage.setItem('flow_pos_receipt_footer', trimmedFooter);
      localStorage.setItem('flow_pos_logo_url', logoUrl.trim());

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);

      if (onUpdateUser) {
        onUpdateUser();
      }
    } catch (err: any) {
      console.error('Error saving company settings:', err);
      setErrorMessage(err.message || 'Failed to save company settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner / Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#1e5c4f] border border-emerald-200 flex items-center justify-center font-bold shadow-sm">
            <Building2 size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Company & Fiscal Settings
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                FLOW Admin
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Centrally manage Company Legal Name, MOF Tax Registration, Bill Header & Receipt Footer, and Exchange Rate.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadSettings}
            disabled={loading || saving}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 flex items-center gap-2 transition cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Reload</span>
          </button>

          <a
            href="http://localhost:4173/#/pos-settings"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 flex items-center gap-2 transition cursor-pointer"
          >
            <ExternalLink size={14} className="text-[#1e5c4f]" />
            <span>View POS Hardware</span>
          </a>

          <button
            type="button"
            onClick={() => handleSave()}
            disabled={saving || loading}
            className="px-5 py-2.5 bg-[#1e5c4f] hover:bg-[#16473D] text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            <span>{saving ? 'Saving Settings...' : 'Save Company Settings'}</span>
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs font-bold flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle size={18} className="text-[#1e5c4f] shrink-0" />
          <span>
            Company and fiscal settings successfully saved to cloud database! All POS terminals and receipt printers will automatically reflect these changes.
          </span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 text-xs font-bold flex items-center gap-2.5">
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Grid: Form on Left, Live Thermal Bill Preview on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form: 8 cols */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card 1: Fiscal & Legal Registration */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#1e5c4f] border border-emerald-200 flex items-center justify-center font-bold">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h2 className="font-black text-base text-slate-900">
                  Fiscal & Legal Registration
                </h2>
                <p className="text-xs text-slate-500 font-medium">Official Ministry of Finance tax data and legal entity status</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Company Legal Entity Name *
                </label>
                <input
                  type="text"
                  value={companyLegalName}
                  onChange={(e) => setCompanyLegalName(e.target.value)}
                  placeholder="e.g. Neo Beirut S.A.L."
                  className="w-full bg-slate-50 border border-slate-300 focus:border-[#1e5c4f] focus:ring-1 focus:ring-[#1e5c4f] rounded-xl px-3.5 py-2.5 text-slate-900 font-bold text-xs outline-none transition"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Official commercial name registered with the government. Printed at bottom of all bills and receipts.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Ministry of Finance (MOF) Number *
                  </label>
                  <input
                    type="text"
                    value={mofNumber}
                    onChange={(e) => setMofNumber(e.target.value)}
                    placeholder="e.g. 382910-601"
                    className="w-full bg-slate-50 border border-slate-300 focus:border-[#1e5c4f] focus:ring-1 focus:ring-[#1e5c4f] rounded-xl px-3.5 py-2.5 text-slate-900 font-mono font-bold text-xs outline-none transition"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Tax registration number (M.O.F) printed directly above the exchange rate.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Commercial Register (R.C.)
                  </label>
                  <input
                    type="text"
                    value={commercialRegister}
                    onChange={(e) => setCommercialRegister(e.target.value)}
                    placeholder="e.g. 1024567"
                    className="w-full bg-slate-50 border border-slate-300 focus:border-[#1e5c4f] focus:ring-1 focus:ring-[#1e5c4f] rounded-xl px-3.5 py-2.5 text-slate-900 font-mono text-xs outline-none transition"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Register of Commerce reference number (optional).
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Receipt & Guest Bill Customization */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#1e5c4f] border border-emerald-200 flex items-center justify-center font-bold">
                <Receipt size={20} />
              </div>
              <div>
                <h2 className="font-black text-base text-slate-900">
                  Customer Receipt & Bill Configuration
                </h2>
                <p className="text-xs text-slate-500 font-medium">Headline brand name and appreciation footer on paper slips</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Restaurant Header Brand Name *
                </label>
                <input
                  type="text"
                  value={receiptRestaurantName}
                  onChange={(e) => setReceiptRestaurantName(e.target.value)}
                  placeholder="e.g. Neo Beirut"
                  className="w-full bg-slate-50 border border-slate-300 focus:border-[#1e5c4f] focus:ring-1 focus:ring-[#1e5c4f] rounded-xl px-3.5 py-2.5 text-slate-900 font-bold text-xs outline-none transition"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Printed in large bold centered characters at the top of guest checks and chits.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Receipt Customer Appreciation Footer
                </label>
                <textarea
                  rows={2}
                  value={receiptFooterText}
                  onChange={(e) => setReceiptFooterText(e.target.value)}
                  placeholder="e.g. Thank you for dining with us! Come back soon."
                  className="w-full bg-slate-50 border border-slate-300 focus:border-[#1e5c4f] focus:ring-1 focus:ring-[#1e5c4f] rounded-xl px-3.5 py-2.5 text-slate-900 text-xs outline-none transition resize-none"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Closing thank you or promotional note printed at the very end of customer receipts.
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Currency & Fiscal Tax Parameters */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#1e5c4f] border border-emerald-200 flex items-center justify-center font-bold">
                <Coins size={20} />
              </div>
              <div>
                <h2 className="font-black text-base text-slate-900">
                  Currency & Fiscal Tax Parameters
                </h2>
                <p className="text-xs text-slate-500 font-medium">USD/LBP dual currency conversion rate and VAT policy</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  USD to LBP Exchange Rate
                </label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(Number(e.target.value) || 0)}
                    placeholder="89500"
                    className="w-full bg-slate-50 border border-slate-300 focus:border-[#1e5c4f] focus:ring-1 focus:ring-[#1e5c4f] rounded-xl px-3.5 py-2.5 text-slate-900 font-mono font-bold text-sm outline-none transition"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs text-slate-500 font-bold">
                    LBP / $1
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Printed directly beneath M.O.F on receipts and used for POS dual-currency checkout totals.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Standard VAT Percentage (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={vatRate}
                      onChange={(e) => setVatRate(Number(e.target.value) || 0)}
                      placeholder="11"
                      className="w-full bg-slate-50 border border-slate-300 focus:border-[#1e5c4f] focus:ring-1 focus:ring-[#1e5c4f] rounded-xl px-3.5 py-2.5 text-slate-900 font-mono font-bold text-sm outline-none transition"
                    />
                    <span className="absolute right-3.5 top-2.5 text-xs text-slate-500 font-bold">
                      %
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    VAT Subscribed Entity (Yes/No)
                  </label>
                  <div className="flex items-center gap-2.5 h-[42px] px-3.5 bg-slate-50 rounded-xl border border-slate-300">
                    <span className={`text-xs font-bold ${!isVatSubscribed ? 'text-slate-900' : 'text-slate-400'}`}>NO</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isVatSubscribed}
                        onChange={(e) => setIsVatSubscribed(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#1e5c4f]"></div>
                    </label>
                    <span className={`text-xs font-bold ${isVatSubscribed ? 'text-[#1e5c4f]' : 'text-slate-400'}`}>YES</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: Brand Identity */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#1e5c4f] border border-emerald-200 flex items-center justify-center font-bold">
                <Palette size={20} />
              </div>
              <div>
                <h2 className="font-black text-base text-slate-900">
                  Brand Identity & Theme
                </h2>
                <p className="text-xs text-slate-500 font-medium">Display name, logo asset, and admin theme color</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Display Restaurant Name
                </label>
                <input
                  type="text"
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  placeholder="Neo Beirut"
                  className="w-full bg-slate-50 border border-slate-300 focus:border-[#1e5c4f] focus:ring-1 focus:ring-[#1e5c4f] rounded-xl px-3.5 py-2.5 text-slate-900 font-bold text-xs outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Logo URL
                </label>
                <input
                  type="text"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="w-full bg-slate-50 border border-slate-300 focus:border-[#1e5c4f] focus:ring-1 focus:ring-[#1e5c4f] rounded-xl px-3.5 py-2.5 text-slate-900 text-xs outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Theme Primary Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-10 h-10 rounded-xl border border-slate-300 p-0.5 cursor-pointer bg-white"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-300 focus:border-[#1e5c4f] rounded-xl px-3.5 py-2.5 text-slate-900 font-mono text-xs outline-none uppercase"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Save Action Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={saving || loading}
              className="w-full py-3.5 bg-[#1e5c4f] hover:bg-[#16473D] text-white font-bold text-sm rounded-2xl shadow-sm flex items-center justify-center gap-2.5 transition cursor-pointer disabled:opacity-50"
            >
              {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
              <span>{saving ? 'Saving Changes to Cloud...' : '💾 Save Company & Fiscal Settings'}</span>
            </button>
          </div>
        </div>

        {/* Right Preview: 5 cols */}
        <div className="lg:col-span-5 space-y-4">
          <div className="sticky top-6">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <FileText size={14} className="text-[#1e5c4f]" /> Live Bill & Receipt Slip Preview
              </span>
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                Real-Time
              </span>
            </div>

            {/* Authentic Thermal Receipt Paper Slip */}
            <div className="bg-[#faf8f5] border-2 border-dashed border-slate-300 rounded-2xl p-6 font-mono text-slate-800 text-xs shadow-md select-none space-y-3">
              {/* Slip Header */}
              <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-300">
                {logoUrl ? (
                  <div className="flex justify-center mb-1">
                    <img
                      src={logoUrl}
                      alt={receiptRestaurantName || 'Logo'}
                      className="max-h-12 max-w-[160px] object-contain filter grayscale contrast-125"
                    />
                  </div>
                ) : (
                  <div className="text-base font-black uppercase tracking-wider text-slate-900">
                    {receiptRestaurantName || 'NEO BEIRUT'}
                  </div>
                )}
                <div className="text-[12px] font-bold text-slate-700 mt-1">
                  *** RECEIPT ***
                </div>
                <div className="text-[11px] text-slate-600 font-sans">
                  Branch: Downtown Beirut • Register #01
                </div>
                <div className="text-[10px] text-slate-500">
                  Date: {new Date().toLocaleDateString()} • {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="text-[11px] font-bold text-slate-700 pt-1">
                  ORDER #1042 • DINE-IN (TABLE 12)
                </div>
              </div>

              {/* Sample Items - Increased Font */}
              <div className="space-y-1.5 py-1 text-[13px]">
                <div className="flex justify-between font-bold text-slate-900">
                  <span>1x Double Espresso</span>
                  <span>$4.00</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900">
                  <span>1x Chicken Avocado Salad</span>
                  <span>$12.50</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900">
                  <span>1x Sparkling Water</span>
                  <span>$2.50</span>
                </div>
              </div>

              {/* Totals Section */}
              <div className="border-t border-dashed border-slate-300 pt-2 space-y-1 text-[11px]">
                <div className="flex justify-between text-slate-600">
                  <span>SUBTOTAL:</span>
                  <span>$19.00</span>
                </div>
                {isVatSubscribed && (
                  <div className="flex justify-between text-slate-600">
                    <span>VAT ({vatRate}%):</span>
                    <span>${((19 * vatRate) / 100).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-sm text-slate-900 pt-1 border-t border-slate-200">
                  <span>TOTAL USD:</span>
                  <span>${isVatSubscribed ? (19 + (19 * vatRate) / 100).toFixed(2) : '19.00'}</span>
                </div>
                <div className="flex justify-between font-black text-xs text-slate-900">
                  <span>TOTAL LBP:</span>
                  <span>
                    {(Math.round((isVatSubscribed ? 19 + (19 * vatRate) / 100 : 19) * exchangeRate)).toLocaleString()} LBP
                  </span>
                </div>
              </div>

              {/* Fiscal Block (Company Name, MOF, then Rate under MOF) */}
              <div className="border-t-2 border-slate-900 pt-3 text-center space-y-1 text-[11px]">
                <div className="font-bold text-slate-900 text-[11px] uppercase">
                  {companyLegalName || 'Neo Beirut S.A.L.'}
                </div>
                <div className="font-black text-slate-900 tracking-wider">
                  M.O.F: {mofNumber || '382910-601'}
                </div>
                <div className="font-bold text-slate-800 text-[10px]">
                  Rate: 1 USD = {Number(exchangeRate).toLocaleString()} LBP
                </div>
                {commercialRegister && (
                  <div className="text-[10px] text-slate-500">
                    R.C: {commercialRegister}
                  </div>
                )}
              </div>

              {/* Footer Appreciation */}
              <div className="border-t border-dashed border-slate-300 pt-3 text-center">
                <p className="text-[11px] italic font-sans text-slate-600 leading-tight">
                  "{receiptFooterText || 'Thank you for dining with us! Come back soon.'}"
                </p>
                <div className="text-[9px] text-slate-400 mt-2 font-sans">
                  Powered by FLOW Unified POS & Admin
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl text-blue-900 text-[11px] font-medium flex items-start gap-2 mt-3">
              <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
              <span>
                <strong>Fiscal Note:</strong> As required, the USD/LBP exchange rate is positioned immediately under the Ministry of Finance (M.O.F) number on all thermal slips and digital bills.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
