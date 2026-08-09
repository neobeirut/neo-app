import { useWhatsAppTemplates } from "./SettingsView/useWhatsAppTemplates";
import { usePromoPopup } from "./SettingsView/usePromoPopup";
import { WhatsAppTemplatesSection } from "./SettingsView/WhatsAppTemplatesSection";
import { PromoPopupSection } from "./SettingsView/PromoPopupSection";
import { BranchBackgroundSection } from "./SettingsView/BranchBackgroundSection";
import { WebsiteIconSection } from "./SettingsView/WebsiteIconSection";
import { ChannelDiscountSection } from "./SettingsView/ChannelDiscountSection";
import { PrinterSection } from "./SettingsView/PrinterSection";

export default function SettingsView({
  branchBackgroundUrl,
  onUpdateBranchBackground,
  websiteIconUrl,
  onUpdateWebsiteIcon,
}) {
  const {
    waTemplates,
    setWaTemplates,
    waTemplateLoading,
    waTemplateSaving,
    waTemplateUpdatedAt,
    handleSaveWhatsAppTemplates,
  } = useWhatsAppTemplates();

  const {
    promo,
    setPromo,
    promoLoading,
    promoSaving,
    promoError,
    setPromoError,
    promoUpdatedAt,
    products,
    events,
    handleSavePromo,
  } = usePromoPopup();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">
          App Settings
        </h2>

        <PrinterSection />

        <ChannelDiscountSection />

        <WebsiteIconSection
          websiteIconUrl={websiteIconUrl}
          onUpdateWebsiteIcon={onUpdateWebsiteIcon}
        />

        <WhatsAppTemplatesSection
          waTemplates={waTemplates}
          setWaTemplates={setWaTemplates}
          waTemplateLoading={waTemplateLoading}
          waTemplateSaving={waTemplateSaving}
          waTemplateUpdatedAt={waTemplateUpdatedAt}
          handleSaveWhatsAppTemplates={handleSaveWhatsAppTemplates}
        />

        <PromoPopupSection
          promo={promo}
          setPromo={setPromo}
          promoLoading={promoLoading}
          promoSaving={promoSaving}
          promoError={promoError}
          setPromoError={setPromoError}
          promoUpdatedAt={promoUpdatedAt}
          products={products}
          events={events}
          handleSavePromo={handleSavePromo}
        />

        <BranchBackgroundSection
          branchBackgroundUrl={branchBackgroundUrl}
          onUpdateBranchBackground={onUpdateBranchBackground}
        />
      </div>
    </div>
  );
}
