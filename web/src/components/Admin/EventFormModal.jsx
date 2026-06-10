import { ModalHeader } from "./EventFormModal/ModalHeader";
import { BasicInfoSection } from "./EventFormModal/BasicInfoSection";
import { RecurrenceSection } from "./EventFormModal/RecurrenceSection";
import { MediaSection } from "./EventFormModal/MediaSection";
import { ReservationSection } from "./EventFormModal/ReservationSection";
import { RecapSection } from "./EventFormModal/RecapSection";
import { useEventForm } from "./EventFormModal/useEventForm";

export default function EventFormModal({
  isOpen,
  editingItem,
  onClose,
  onSaved,
  getAdminHeaders,
}) {
  const {
    saving,
    error,
    name,
    setName,
    description,
    setDescription,
    startAt,
    setStartAt,
    endAt,
    setEndAt,
    coverImage,
    images,
    setImages,
    reservationRequired,
    setReservationRequired,
    showInReservationTab,
    setShowInReservationTab,
    reservationUrl,
    setReservationUrl,
    reservationPhone,
    setReservationPhone,
    price,
    setPrice,
    currency,
    setCurrency,
    capacity,
    setCapacity,
    status,
    setStatus,
    featured,
    setFeatured,
    recapCaption,
    setRecapCaption,
    recapImages,
    setRecapImages,
    recapVideos,
    setRecapVideos,
    isRecurring,
    setIsRecurring,
    recurrenceInterval,
    setRecurrenceInterval,
    recurrenceByWeekday,
    setRecurrenceByWeekday,
    recurrenceUntil,
    setRecurrenceUntil,
    uploadLoading,
    isPast,
    handleCoverUpload,
    handleImagesUpload,
    handleRecapImagesUpload,
    handleRecapVideosUpload,
    handleSave,
  } = useEventForm({ isOpen, editingItem });

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl bg-white rounded-xl shadow-xl overflow-hidden">
        <ModalHeader editingItem={editingItem} onClose={onClose} />

        <div className="p-5 max-h-[75vh] overflow-y-auto space-y-6">
          {error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          ) : null}

          <BasicInfoSection
            name={name}
            setName={setName}
            featured={featured}
            setFeatured={setFeatured}
            status={status}
            setStatus={setStatus}
            startAt={startAt}
            setStartAt={setStartAt}
            endAt={endAt}
            setEndAt={setEndAt}
          />

          <RecurrenceSection
            isRecurring={isRecurring}
            setIsRecurring={setIsRecurring}
            recurrenceByWeekday={recurrenceByWeekday}
            setRecurrenceByWeekday={setRecurrenceByWeekday}
            recurrenceInterval={recurrenceInterval}
            setRecurrenceInterval={setRecurrenceInterval}
            recurrenceUntil={recurrenceUntil}
            setRecurrenceUntil={setRecurrenceUntil}
            endAt={endAt}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg min-h-[90px]"
              placeholder="Optional"
            />
          </div>

          <MediaSection
            coverImage={coverImage}
            handleCoverUpload={handleCoverUpload}
            images={images}
            setImages={setImages}
            handleImagesUpload={handleImagesUpload}
            uploadLoading={uploadLoading}
          />

          <ReservationSection
            reservationRequired={reservationRequired}
            setReservationRequired={setReservationRequired}
            showInReservationTab={showInReservationTab}
            setShowInReservationTab={setShowInReservationTab}
            reservationUrl={reservationUrl}
            setReservationUrl={setReservationUrl}
            reservationPhone={reservationPhone}
            setReservationPhone={setReservationPhone}
            price={price}
            setPrice={setPrice}
            currency={currency}
            setCurrency={setCurrency}
            capacity={capacity}
            setCapacity={setCapacity}
          />

          <RecapSection
            isPast={isPast}
            recapCaption={recapCaption}
            setRecapCaption={setRecapCaption}
            recapImages={recapImages}
            setRecapImages={setRecapImages}
            handleRecapImagesUpload={handleRecapImagesUpload}
            recapVideos={recapVideos}
            setRecapVideos={setRecapVideos}
            handleRecapVideosUpload={handleRecapVideosUpload}
          />
        </div>

        <div className="px-5 py-4 border-t flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border hover:bg-gray-50"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={() => handleSave(getAdminHeaders, onSaved, onClose)}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={saving || uploadLoading}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
