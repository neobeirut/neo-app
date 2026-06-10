import { useWhatsAppTemplates } from "./SettingsView/useWhatsAppTemplates";
import { usePromoPopup } from "./SettingsView/usePromoPopup";
import { WhatsAppProviderSection } from "./SettingsView/WhatsAppProviderSection";
import { WhatsAppTemplatesSection } from "./SettingsView/WhatsAppTemplatesSection";
import { PromoPopupSection } from "./SettingsView/PromoPopupSection";
import { DeliveryCostSection } from "./SettingsView/DeliveryCostSection";
import { BranchBackgroundSection } from "./SettingsView/BranchBackgroundSection";
import { WebsiteIconSection } from "./SettingsView/WebsiteIconSection";

export default function SettingsView({
  deliveryCost,
  onUpdateDeliveryCost,
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
    waTestLoading,
    handleSaveWhatsAppTemplates,
    handleTestBirdConfig,
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

        <WebsiteIconSection
          websiteIconUrl={websiteIconUrl}
          onUpdateWebsiteIcon={onUpdateWebsiteIcon}
        />

        <WhatsAppProviderSection />

        <WhatsAppTemplatesSection
          waTemplates={waTemplates}
          setWaTemplates={setWaTemplates}
          waTemplateLoading={waTemplateLoading}
          waTemplateSaving={waTemplateSaving}
          waTemplateUpdatedAt={waTemplateUpdatedAt}
          waTestLoading={waTestLoading}
          handleSaveWhatsAppTemplates={handleSaveWhatsAppTemplates}
          handleTestBirdConfig={handleTestBirdConfig}
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

        <DeliveryCostSection
          deliveryCost={deliveryCost}
          onUpdateDeliveryCost={onUpdateDeliveryCost}
        />

        <BranchBackgroundSection
          branchBackgroundUrl={branchBackgroundUrl}
          onUpdateBranchBackground={onUpdateBranchBackground}
        />
      </div>
    </div>
  );
}
