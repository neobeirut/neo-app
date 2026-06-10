import { useEffect, useMemo, useState } from "react";
import { useUpload } from "@/utils/useUpload";
import { toDatetimeLocalValue, toDateValue, isPastEvent } from "./utils";

export function useEventForm({ isOpen, editingItem }) {
  const [upload, { loading: uploadLoading }] = useUpload();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");

  const [coverImage, setCoverImage] = useState("");
  const [images, setImages] = useState([]);

  const [reservationRequired, setReservationRequired] = useState(false);
  const [showInReservationTab, setShowInReservationTab] = useState(false);
  const [reservationUrl, setReservationUrl] = useState("");
  const [reservationPhone, setReservationPhone] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("");
  const [capacity, setCapacity] = useState("");

  const [status, setStatus] = useState("draft");
  const [featured, setFeatured] = useState(false);

  const [recapCaption, setRecapCaption] = useState("");
  const [recapImages, setRecapImages] = useState([]);
  const [recapVideos, setRecapVideos] = useState([]);

  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceInterval, setRecurrenceInterval] = useState("1");
  const [recurrenceByWeekday, setRecurrenceByWeekday] = useState([]);
  const [recurrenceUntil, setRecurrenceUntil] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setError(null);

    if (editingItem) {
      setName(editingItem.name || "");
      setDescription(editingItem.description || "");
      setStartAt(toDatetimeLocalValue(editingItem.start_at));
      setEndAt(toDatetimeLocalValue(editingItem.end_at));
      setCoverImage(editingItem.cover_image || "");
      setImages(Array.isArray(editingItem.images) ? editingItem.images : []);
      setReservationRequired(!!editingItem.reservation_required);
      setShowInReservationTab(!!editingItem.show_in_reservation_tab);
      setReservationUrl(editingItem.reservation_url || "");
      setReservationPhone(editingItem.reservation_phone || "");
      setPrice(
        editingItem.price === null || editingItem.price === undefined
          ? ""
          : String(editingItem.price),
      );
      setCurrency(editingItem.currency || "");
      setCapacity(
        editingItem.capacity === null || editingItem.capacity === undefined
          ? ""
          : String(editingItem.capacity),
      );
      setStatus(editingItem.status || "draft");
      setFeatured(!!editingItem.featured);

      setRecapCaption(editingItem.recap_caption || "");
      setRecapImages(
        Array.isArray(editingItem.recap_images) ? editingItem.recap_images : [],
      );
      setRecapVideos(
        Array.isArray(editingItem.recap_videos) ? editingItem.recap_videos : [],
      );

      setIsRecurring(!!editingItem.is_recurring);
      setRecurrenceInterval(
        editingItem.recurrence_interval === null ||
          editingItem.recurrence_interval === undefined
          ? "1"
          : String(editingItem.recurrence_interval),
      );
      setRecurrenceByWeekday(
        Array.isArray(editingItem.recurrence_byweekday)
          ? editingItem.recurrence_byweekday
          : [],
      );
      setRecurrenceUntil(toDateValue(editingItem.recurrence_until));
    } else {
      setName("");
      setDescription("");
      setStartAt("");
      setEndAt("");
      setCoverImage("");
      setImages([]);
      setReservationRequired(false);
      setShowInReservationTab(false);
      setReservationUrl("");
      setReservationPhone("");
      setPrice("");
      setCurrency("");
      setCapacity("");
      setStatus("draft");
      setFeatured(false);
      setRecapCaption("");
      setRecapImages([]);
      setRecapVideos([]);
      setIsRecurring(false);
      setRecurrenceInterval("1");
      setRecurrenceByWeekday([]);
      setRecurrenceUntil("");
    }
  }, [isOpen, editingItem]);

  const isPast = useMemo(() => {
    const startIso = startAt ? new Date(startAt).toISOString() : null;
    const endIso = endAt ? new Date(endAt).toISOString() : null;
    return isPastEvent(startIso, endIso);
  }, [startAt, endAt]);

  const uploadSingle = async (file) => {
    const result = await upload({ file });
    if (result?.error) {
      throw new Error(result.error);
    }
    if (!result?.url) {
      throw new Error("Upload did not return a URL");
    }
    return result.url;
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      setError(null);
      const url = await uploadSingle(file);
      setCoverImage(url);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to upload cover");
    }
  };

  const handleImagesUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;

    try {
      setError(null);
      const uploaded = [];
      for (const f of files) {
        const url = await uploadSingle(f);
        uploaded.push(url);
      }
      setImages((prev) => [...prev, ...uploaded]);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to upload images");
    }
  };

  const handleRecapImagesUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;

    try {
      setError(null);
      const uploaded = [];
      for (const f of files) {
        if (!String(f.type || "").startsWith("image/")) {
          throw new Error("Recap images must be image files");
        }
        const url = await uploadSingle(f);
        uploaded.push(url);
      }
      setRecapImages((prev) => [...prev, ...uploaded]);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to upload recap images");
    }
  };

  const handleRecapVideosUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;

    try {
      setError(null);
      const uploaded = [];
      for (const f of files) {
        const type = String(f.type || "");
        const ok = type.startsWith("video/");
        if (!ok) {
          throw new Error("Recap videos must be video files (mp4 preferred)");
        }
        const url = await uploadSingle(f);
        uploaded.push(url);
      }
      setRecapVideos((prev) => [...prev, ...uploaded]);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to upload recap videos");
    }
  };

  const handleSave = async (getAdminHeaders, onSaved, onClose) => {
    setError(null);

    const trimmedName = String(name || "").trim();
    if (!trimmedName) {
      setError("Name is required");
      return;
    }

    if (!coverImage) {
      setError("Cover image is required");
      return;
    }

    if (!startAt) {
      setError("Start date/time is required");
      return;
    }

    if (isRecurring && recurrenceByWeekday.length === 0) {
      setError("Pick at least one day for a recurring event");
      return;
    }

    const intervalNum = Number.parseInt(String(recurrenceInterval || "1"), 10);
    const intervalSafe =
      Number.isFinite(intervalNum) && intervalNum >= 1 ? intervalNum : 1;

    const startIso = new Date(startAt).toISOString();
    const endIso = endAt ? new Date(endAt).toISOString() : null;

    // Only require URL/phone when the event is meant to appear in the Reservation tab
    if (
      reservationRequired &&
      showInReservationTab &&
      !reservationUrl &&
      !reservationPhone
    ) {
      setError("Reservation requires a URL or phone");
      return;
    }

    const payload = {
      name: trimmedName,
      description: description || null,
      start_at: startIso,
      end_at: endIso,
      cover_image: coverImage,
      images,
      reservation_required: !!reservationRequired,
      show_in_reservation_tab: reservationRequired
        ? !!showInReservationTab
        : false,
      reservation_url: reservationUrl || null,
      reservation_phone: reservationPhone || null,
      price: price === "" ? null : Number(price),
      currency: currency || null,
      capacity: capacity === "" ? null : Number(capacity),
      status,
      featured,
      recap_caption: recapCaption || null,
      recap_images: recapImages,
      recap_videos: recapVideos,

      // Recurrence (Option B)
      is_recurring: !!isRecurring,
      recurrence_frequency: isRecurring ? "weekly" : null,
      recurrence_interval: isRecurring ? intervalSafe : null,
      recurrence_byweekday: isRecurring ? recurrenceByWeekday : null,
      recurrence_until: isRecurring && recurrenceUntil ? recurrenceUntil : null,
    };

    setSaving(true);
    try {
      const isEdit = !!editingItem?.id;
      const url = isEdit
        ? `/api/events/admin/${editingItem.id}`
        : "/api/events/admin";

      const method = isEdit ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(getAdminHeaders ? getAdminHeaders() : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          data?.error || `Failed to save (status ${response.status})`,
        );
      }

      const data = await response.json().catch(() => ({}));
      if (onSaved) {
        onSaved(data);
      }

      onClose();
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return {
    // State
    saving,
    error,
    setError,
    name,
    setName,
    description,
    setDescription,
    startAt,
    setStartAt,
    endAt,
    setEndAt,
    coverImage,
    setCoverImage,
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

    // Handlers
    handleCoverUpload,
    handleImagesUpload,
    handleRecapImagesUpload,
    handleRecapVideosUpload,
    handleSave,
  };
}
