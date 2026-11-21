"use client";

import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bookmark,
  Check,
  CheckCircle2,
  Info,
  Layers,
  Loader2,
  Palette,
  RotateCcw,
  ShoppingBag,
  Shuffle,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { MOCK_GARMENTS, MockGarment, GarmentType } from "@/lib/mock-data";
import { GarmentSize } from "@/lib/shop-utils";
import {
  resolveExplicitGarmentSize,
  validateExplicitOutfitSizes,
} from "@/lib/studio-utils";
import {
  MockSavedLook,
  useFitloom,
} from "@/components/providers/fitloom-provider";
import { Avatar3DViewer } from "@/components/avatar/Avatar3DViewer";
import { AvatarTryOnControls } from "@/components/avatar/AvatarTryOnControls";
import { DigitalAvatarPreview } from "@/components/body-profile/DigitalAvatarPreview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import {
  AvatarDressInput,
  AvatarDressResponse,
  ProductsQuery,
  ProductItem,
  GarmentTypeOption,
  FitPreferenceAvatarOption,
  AvatarSizeItem,
} from "@/lib/api/types";
import {
  GARMENT_TYPE_OPTIONS,
  appendCacheBusterToGarmentUrl,
  type AvatarGarmentSize,
  type GarmentViewMode,
} from "@/lib/garments";

type StudioBackdrop = "violet" | "light" | "slate";

const BACKDROP_OPTIONS: ReadonlyArray<{
  id: StudioBackdrop;
  label: string;
  stageClass: string;
  dark: boolean;
}> = [
  {
    id: "violet",
    label: "Soft Violet",
    stageClass:
      "border-violet-200/80 bg-gradient-to-br from-violet-50/70 via-white to-violet-100/50",
    dark: false,
  },
  {
    id: "light",
    label: "Clean White",
    stageClass: "border-slate-200 bg-white",
    dark: false,
  },
  {
    id: "slate",
    label: "Deep Slate",
    stageClass: "border-slate-800 bg-slate-900",
    dark: true,
  },
];

interface LayerSlots {
  topId: string;
  bottomId: string;
  outerId: string;
}

const DEFAULT_TITLE = "Editorial Studio Look";

function resolveSlotsFromGarmentIds(garmentIds: readonly string[]): LayerSlots {
  let topId = "";
  let bottomId = "";
  let outerId = "";

  for (const id of garmentIds) {
    const garment = MOCK_GARMENTS.find((g) => g.id === id);
    if (!garment) continue;
    if (
      !topId &&
      (garment.category === "Shirts" ||
        garment.category === "T-Shirts" ||
        garment.category === "Hoodies")
    ) {
      topId = garment.id;
    } else if (!bottomId && garment.category === "Trousers") {
      bottomId = garment.id;
    } else if (!outerId && garment.category === "Outerwear") {
      outerId = garment.id;
    }
  }

  return { topId, bottomId, outerId };
}

function StudioQuerySync({
  savedLooks,
  onHydrateLook,
  onClearInvalidLook,
  onHydrateProduct,
}: {
  savedLooks: readonly MockSavedLook[];
  onHydrateLook: (lookId: string, look: MockSavedLook | undefined) => void;
  onClearInvalidLook: () => void;
  onHydrateProduct: (productId: string) => void;
}) {
  const searchParams = useSearchParams();
  const lookParam = searchParams.get("look");
  const productParam = searchParams.get("product");

  const handledLookRef = useRef<string | null>(null);
  const handledProductRef = useRef<string | null>(null);

  useEffect(() => {
    if (lookParam === null) {
      handledLookRef.current = null;
      onClearInvalidLook();
      return;
    }
    const trimmed = lookParam.trim();
    if (trimmed === "") {
      if (handledLookRef.current === "__empty__") return;
      handledLookRef.current = "__empty__";
      onHydrateLook("", undefined);
      return;
    }
    if (handledLookRef.current === trimmed) return;
    handledLookRef.current = trimmed;
    const found = savedLooks.find((look) => look.id === trimmed);
    onHydrateLook(trimmed, found);
  }, [lookParam, savedLooks, onHydrateLook, onClearInvalidLook]);

  useEffect(() => {
    if (!productParam || lookParam !== null) {
      if (!productParam) handledProductRef.current = null;
      return;
    }
    if (handledProductRef.current === productParam) return;
    handledProductRef.current = productParam;
    onHydrateProduct(productParam);
  }, [productParam, lookParam, onHydrateProduct]);

  return null;
}



export default function StyleStudioPage() {
  const router = useRouter();
  const {
    bodyProfile,
    hasBodyProfile,
    avatarId,
    avatarServiceOffline,
    isGeneratingAvatar,
    generateAvatarPreset,
    checkAvatarStatus,
    savedLooks,
    saveLook,
    updateSavedLook,
    deleteSavedLook,
    addToCart,
    toast,
  } = useFitloom();

  const [stageMode, setStageMode] = useState<"canvas" | "avatar">("canvas");

  useEffect(() => {
    checkAvatarStatus();
  }, [checkAvatarStatus]);

  async function handleGenerateAvatar() {
    const res = await generateAvatarPreset();
    if (res.ok) {
      toast({
        type: "success",
        title: "3D Avatar Calibrated",
        message: "Your SMPL 3D mesh is ready in Style Studio.",
      });
    } else {
      toast({
        type: "error",
        title: "Avatar Engine Offline",
        message:
          res.error ?? "Avatar engine offline. Showing deterministic fit fallback.",
      });
    }
  }

  const tops = useMemo(
    () =>
      MOCK_GARMENTS.filter(
        (g) => g.category === "Shirts" || g.category === "T-Shirts"
      ),
    []
  );
  const bottoms = useMemo(
    () => MOCK_GARMENTS.filter((g) => g.category === "Trousers"),
    []
  );
  const outer = useMemo(
    () => MOCK_GARMENTS.filter((g) => g.category === "Outerwear"),
    []
  );

  const defaultSlots = useMemo<LayerSlots>(
    () => ({
      topId: tops[0]?.id ?? "",
      bottomId: bottoms[0]?.id ?? "",
      outerId: outer[0]?.id ?? "",
    }),
    [tops, bottoms, outer]
  );

  const [topId, setTopId] = useState<string>(defaultSlots.topId);
  const [bottomId, setBottomId] = useState<string>(defaultSlots.bottomId);
  const [outerId, setOuterId] = useState<string>(defaultSlots.outerId);
  const [garmentSizes, setGarmentSizes] = useState<Record<string, GarmentSize>>(
    {}
  );
  const [lookTitle, setLookTitle] = useState<string>(DEFAULT_TITLE);
  const [titleTouched, setTitleTouched] = useState<boolean>(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [canvasError, setCanvasError] = useState<string | null>(null);
  const [backdrop, setBackdrop] = useState<StudioBackdrop>("violet");
  const [activeLookId, setActiveLookId] = useState<string | null>(null);
  const [invalidLookId, setInvalidLookId] = useState<string | null>(null);
  const [queryNotice, setQueryNotice] = useState<{
    type: "info" | "warning";
    text: string;
  } | null>(null);
  const [savedTitleBanner, setSavedTitleBanner] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState<boolean>(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // Garment Panel State
  const [garmentPanelGarmentType, setGarmentPanelGarmentType] = useState<GarmentTypeOption>("shirt");
  const [garmentPanelCatalogue, setGarmentPanelCatalogue] = useState<ProductItem[]>([]);
  const [garmentPanelSelectedProductId, setGarmentPanelSelectedProductId] = useState<string | null>(null);
  const [garmentPanelSelectedSize, setGarmentPanelSelectedSize] = useState<AvatarGarmentSize>("M");
  const [garmentPanelFitPreference, setGarmentPanelFitPreference] = useState<FitPreferenceAvatarOption>("regular");
  const [garmentPanelRecommendedSize, setGarmentPanelRecommendedSize] = useState<AvatarGarmentSize | null>(null);
  const [garmentPanelAvailableSizes, setGarmentPanelAvailableSizes] = useState<AvatarSizeItem[]>([]);
  const [garmentPanelSizingLoading, setGarmentPanelSizingLoading] = useState<boolean>(false);
  const [garmentPanelColorHex, setGarmentPanelColorHex] = useState<string>("#2563eb");
  const [garmentPanelViewMode, setGarmentPanelViewMode] = useState<GarmentViewMode>("fabric");
  const [garmentPanelLoading, setGarmentPanelLoading] = useState(false);
  const [garmentPanelError, setGarmentPanelError] = useState<string | null>(null);
  const [garmentPanelDressedUrl, setGarmentPanelDressedUrl] = useState<string | null>(null);
  const [garmentPanelCatalogueLoading, setGarmentPanelCatalogueLoading] = useState(false);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const addTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (addTimerRef.current) clearTimeout(addTimerRef.current);
    };
  }, []);

  const topGarment = useMemo(
    () => MOCK_GARMENTS.find((g) => g.id === topId),
    [topId]
  );
  const bottomGarment = useMemo(
    () => MOCK_GARMENTS.find((g) => g.id === bottomId),
    [bottomId]
  );
  const outerGarment = useMemo(
    () => MOCK_GARMENTS.find((g) => g.id === outerId),
    [outerId]
  );

  const selectedSlots = useMemo(
    () =>
      [
        { slotKey: "top" as const, label: "Top Layer", garment: topGarment },
        {
          slotKey: "bottom" as const,
          label: "Bottom Layer",
          garment: bottomGarment,
        },
        {
          slotKey: "outer" as const,
          label: "Outerwear Layer",
          garment: outerGarment,
        },
      ].filter(
        (
          entry
        ): entry is {
          slotKey: "top" | "bottom" | "outer";
          label: string;
          garment: MockGarment;
        } => Boolean(entry.garment)
      ),
    [topGarment, bottomGarment, outerGarment]
  );

  const selectedGarments = useMemo(
    () => selectedSlots.map((slot) => slot.garment),
    [selectedSlots]
  );

  const primaryTryOnGarment =
    topGarment ?? outerGarment ?? bottomGarment ?? null;

  const totalInr = useMemo(
    () => selectedGarments.reduce((sum, g) => sum + g.priceInr, 0),
    [selectedGarments]
  );

  const uniqueFits = useMemo(
    () => Array.from(new Set(selectedGarments.map((g) => `${g.fitType} Fit`))),
    [selectedGarments]
  );
  const uniqueOccasions = useMemo(
    () => Array.from(new Set(selectedGarments.map((g) => g.occasion))),
    [selectedGarments]
  );

  const activeBackdrop =
    BACKDROP_OPTIONS.find((opt) => opt.id === backdrop) ?? BACKDROP_OPTIONS[0];

  const getSizeForGarment = useCallback(
    (garment: MockGarment): GarmentSize | "" =>
      resolveExplicitGarmentSize(garment, garmentSizes[garment.id]),
    [garmentSizes]
  );

  const applySavedLookToCanvas = useCallback(
    (look: MockSavedLook, noticePrefix: string) => {
      const slots = resolveSlotsFromGarmentIds(look.garmentIds);
      setInvalidLookId(null);
      setTopId(slots.topId);
      setBottomId(slots.bottomId);
      setOuterId(slots.outerId);
      setLookTitle(look.title || "Untitled Studio Look");
      setTitleTouched(false);
      setTitleError(null);
      setCanvasError(null);
      setSavedTitleBanner(null);
      setActiveLookId(look.id);
      setQueryNotice({
        type: "info",
        text: `${noticePrefix} "${look.title || "Untitled Studio Look"}" (${
          [slots.topId, slots.bottomId, slots.outerId].filter(Boolean).length
        } layer(s)).`,
      });
    },
    []
  );

  const handleClearInvalidLook = useCallback(() => {
    setInvalidLookId(null);
  }, []);

  const handleHydrateLook = useCallback(
    (lookId: string, look: MockSavedLook | undefined) => {
      if (!look) {
        setActiveLookId(null);
        setInvalidLookId(lookId || "unknown");
        setTopId("");
        setBottomId("");
        setOuterId("");
        setQueryNotice(null);
        return;
      }
      applySavedLookToCanvas(look, "Loaded saved look:");
    },
    [applySavedLookToCanvas]
  );

  const handleHydrateProduct = useCallback((productId: string) => {
    const garment = MOCK_GARMENTS.find((g) => g.id === productId);
    if (!garment) return;
    setInvalidLookId(null);
    if (garment.category === "Shirts" || garment.category === "T-Shirts") {
      setTopId(garment.id);
    } else if (garment.category === "Trousers") {
      setBottomId(garment.id);
    } else if (garment.category === "Outerwear") {
      setOuterId(garment.id);
    }
    setActiveLookId(null);
    setCanvasError(null);
    setQueryNotice({
      type: "info",
      text: `Pre-selected ${garment.name} in your outfit composer.`,
    });
  }, []);

  // Garment Panel: Fetch catalogue when garment type changes
  useEffect(() => {
    let cancelled = false;
    setGarmentPanelCatalogueLoading(true);
    setGarmentPanelCatalogue([]);
    setGarmentPanelSelectedProductId(null);

    const query: ProductsQuery = {
      garmentType: garmentPanelGarmentType,
      limit: 50,
    };

    api.getProducts(query)
      .then((res) => {
        if (!cancelled) {
          setGarmentPanelCatalogue(res.products);
          if (res.products.length > 0) {
            setGarmentPanelSelectedProductId(res.products[0].id);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGarmentPanelCatalogue([]);
        }
      })
      .finally(() => {
        if (!cancelled) setGarmentPanelCatalogueLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [garmentPanelGarmentType]);

  // Garment Panel: Fetch sizing from avatar engine when garment type or fit preference changes
  useEffect(() => {
    if (!avatarId) {
      setGarmentPanelAvailableSizes([]);
      setGarmentPanelRecommendedSize(null);
      return;
    }
    if (avatarServiceOffline) {
      setGarmentPanelAvailableSizes([]);
      setGarmentPanelRecommendedSize(null);
      return;
    }

    let cancelled = false;
    setGarmentPanelSizingLoading(true);

    api.getAvatarSizing({
      avatarId,
      garmentType: garmentPanelGarmentType,
      fitPreference: garmentPanelFitPreference,
    })
      .then((res) => {
        if (!cancelled) {
          const sizes = res.sizes || [];
          setGarmentPanelAvailableSizes(sizes);
          const rec = res.recommended_size;
          setGarmentPanelRecommendedSize(rec || null);

          // Update selected size if current selection is not among available sizes
          setGarmentPanelSelectedSize((prev) => {
            if (sizes.some((s) => s.size === prev)) return prev;
            return rec || sizes[0]?.size || "M";
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGarmentPanelAvailableSizes([]);
          setGarmentPanelRecommendedSize(null);
        }
      })
      .finally(() => {
        if (!cancelled) setGarmentPanelSizingLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [avatarId, avatarServiceOffline, garmentPanelGarmentType, garmentPanelFitPreference]);

  // Garment Panel: Dress avatar
  const handleDressAvatar = useCallback(async () => {
    if (!avatarId) {
      toast({
        type: "warning",
        title: "Create your avatar first",
        message: "Generate a 3D avatar from your Body Profile before dressing it.",
      });
      return;
    }
    if (avatarServiceOffline) {
      toast({
        type: "error",
        title: "Avatar service offline",
        message: "The 3D avatar engine is temporarily unavailable. Please try again later.",
      });
      return;
    }
    if (!garmentPanelSelectedProductId) {
      toast({
        type: "warning",
        title: "Select a Garment",
        message: "Choose a garment from the catalogue before dressing your avatar.",
      });
      return;
    }

    setGarmentPanelLoading(true);
    setGarmentPanelError(null);

    const input: AvatarDressInput = {
      avatarId,
      garmentType: garmentPanelGarmentType,
      size: garmentPanelSelectedSize,
      fitPreference: garmentPanelFitPreference,
      colorHex: garmentPanelColorHex,
      viewMode: garmentPanelViewMode,
    };

    try {
      const res: AvatarDressResponse = await api.dressAvatar(input);
      const dressedUrl = appendCacheBusterToGarmentUrl(res.garment.url);
      setGarmentPanelDressedUrl(dressedUrl);
      toast({
        type: "success",
        title: "Avatar Dressed",
        message: `Garment applied in ${res.mode === "live_avatar_engine" ? "live avatar engine" : "fallback demo"} mode.`,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setGarmentPanelError("Please sign in to use the avatar dressing feature.");
        } else if (err.status === 404) {
          setGarmentPanelError("Avatar not found. Please regenerate your avatar.");
        } else if (err.status === 422) {
          setGarmentPanelError(err.message || "Invalid garment selection.");
        } else if (err.status === 503) {
          setGarmentPanelError("Avatar engine temporarily unavailable. Please try again later.");
        } else {
          setGarmentPanelError(err.message || "Failed to dress avatar.");
        }
      } else {
        setGarmentPanelError("An unexpected error occurred.");
      }
    } finally {
      setGarmentPanelLoading(false);
    }
  }, [avatarId, avatarServiceOffline, garmentPanelGarmentType, garmentPanelSelectedProductId, garmentPanelSelectedSize, garmentPanelFitPreference, garmentPanelColorHex, garmentPanelViewMode, toast]);

  // Garment Panel: Remove garment
  const handleRemoveGarment = useCallback(() => {
    setGarmentPanelDressedUrl(null);
    toast({
      type: "info",
      title: "Garment Removed",
      message: "The garment has been removed from your avatar.",
    });
  }, [toast]);

  function validateLookTitle(value: string): string | null {
    if (!value.trim()) {
      return "Please enter a look name before saving.";
    }
    return null;
  }

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const nextValue = e.target.value;
    setLookTitle(nextValue);
    setTitleTouched(true);
    setSavedTitleBanner(null);
    if (titleError && !validateLookTitle(nextValue)) {
      setTitleError(null);
    }
  }

  function handleTitleBlur() {
    if (!titleTouched) return;
    setTitleError(validateLookTitle(lookTitle));
  }

  function handleLayerChange(
    slotKey: "top" | "bottom" | "outer",
    nextId: string
  ) {
    if (slotKey === "top") setTopId(nextId);
    if (slotKey === "bottom") setBottomId(nextId);
    if (slotKey === "outer") setOuterId(nextId);
    setCanvasError(null);
    setSavedTitleBanner(null);
  }

  function applyManualPreset(
    presetTitle: string,
    slots: LayerSlots,
    announceText: string
  ) {
    setInvalidLookId(null);
    setTopId(slots.topId);
    setBottomId(slots.bottomId);
    setOuterId(slots.outerId);
    setLookTitle(presetTitle);
    setTitleTouched(false);
    setTitleError(null);
    setCanvasError(null);
    setSavedTitleBanner(null);
    setActiveLookId(null);
    setQueryNotice({ type: "info", text: announceText });
  }

  function handleCycleTop() {
    if (tops.length === 0) return;
    const currentIdx = tops.findIndex((g) => g.id === topId);
    const nextTop = tops[(currentIdx + 1) % tops.length];
    setTopId(nextTop.id);
    setCanvasError(null);
    setSavedTitleBanner(null);
  }

  function handleClearCanvas() {
    setTopId("");
    setBottomId("");
    setOuterId("");
    setActiveLookId(null);
    setSavedTitleBanner(null);
    setQueryNotice(null);
  }

  function handleStartFreshStudio() {
    setInvalidLookId(null);
    setTopId(defaultSlots.topId);
    setBottomId(defaultSlots.bottomId);
    setOuterId(defaultSlots.outerId);
    setLookTitle(DEFAULT_TITLE);
    setTitleTouched(false);
    setTitleError(null);
    setCanvasError(null);
    setSavedTitleBanner(null);
    setActiveLookId(null);
    setQueryNotice(null);
    router.replace("/studio", { scroll: false });
  }

  const isEditingExistingLook = Boolean(
    activeLookId && savedLooks.some((look) => look.id === activeLookId)
  );

  function persistLook(mode: "auto" | "new") {
    setTitleTouched(true);

    const err = validateLookTitle(lookTitle);
    if (err) {
      setTitleError(err);
      toast({
        type: "warning",
        title: "Look Name Required",
        message: err,
      });
      titleInputRef.current?.focus();
      return;
    }

    if (selectedGarments.length === 0) {
      const msg =
        "Select at least one garment layer before saving to your lookbook.";
      setCanvasError(msg);
      toast({
        type: "warning",
        title: "Empty Outfit Canvas",
        message: msg,
      });
      return;
    }

    const trimmedTitle = lookTitle.trim();
    const garmentIds = selectedGarments.map((g) => g.id);
    setTitleError(null);
    setCanvasError(null);

    if (mode === "auto" && activeLookId && isEditingExistingLook) {
      updateSavedLook(activeLookId, {
        title: trimmedTitle,
        garmentIds,
        source: "Style Studio",
      });
      setSavedTitleBanner(trimmedTitle);
      toast({
        type: "success",
        title: "Look Updated",
        message: `Updated "${trimmedTitle}" (${selectedGarments.length} garment${
          selectedGarments.length === 1 ? "" : "s"
        }) in your session lookbook.`,
        action: { label: "View Saved Looks", href: "/saved-looks" },
      });
      return;
    }

    const created = saveLook({
      title: trimmedTitle,
      garmentIds,
      source: "Style Studio",
    });
    setActiveLookId(created.id);
    setSavedTitleBanner(trimmedTitle);
    toast({
      type: "success",
      title: "Look Saved",
      message: `"${trimmedTitle}" (${selectedGarments.length} garment${
        selectedGarments.length === 1 ? "" : "s"
      }) saved to your local lookbook.`,
      action: { label: "View Saved Looks", href: "/saved-looks" },
    });
  }

  function handleSaveLook(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    persistLook("auto");
  }

  function handleAddAllToCart() {
    const check = validateExplicitOutfitSizes(selectedGarments, garmentSizes);

    if (!check.ok) {
      setCanvasError(check.error);
      const isNoGarments = selectedGarments.length === 0;
      toast({
        type: isNoGarments ? "warning" : "error",
        title: isNoGarments
          ? "No Garments Selected"
          : "Size Selection Required",
        message: check.error,
      });

      if (!isNoGarments && check.missingGarments.length > 0) {
        const firstMissingId = check.missingGarments[0].id;
        const firstSlot = selectedSlots.find(
          (s) => s.garment.id === firstMissingId
        );
        if (firstSlot) {
          document.getElementById(`studio-size-${firstSlot.slotKey}`)?.focus();
        }
      }
      return;
    }

    setCanvasError(null);
    for (const { garment: g, size } of check.items) {
      addToCart({
        garmentId: g.id,
        name: g.name,
        size,
        priceInr: g.priceInr,
      });
    }

    setJustAdded(true);
    if (addTimerRef.current) clearTimeout(addTimerRef.current);
    addTimerRef.current = setTimeout(() => setJustAdded(false), 1800);

    const displayName = lookTitle.trim() || "your composed outfit";
    toast({
      type: "success",
      title: "Outfit Added to Bag",
      message: `Added ${check.items.length} garment${
        check.items.length === 1 ? "" : "s"
      } from "${displayName}" to your shopping bag.`,
      action: { label: "View Cart", href: "/cart" },
    });
  }

  function handleEmptyTryOn() {
    const msg =
      "Select at least one garment layer before opening Virtual Try-On.";
    setCanvasError(msg);
    toast({
      type: "warning",
      title: "Select a Garment First",
      message: msg,
    });
  }

  function handleDeleteSessionLook(look: MockSavedLook) {
    deleteSavedLook(look.id);
    if (activeLookId === look.id) {
      setActiveLookId(null);
    }
    toast({
      type: "info",
      title: "Look Removed",
      message: `"${look.title || "Untitled Look"}" removed from your local session lookbook.`,
    });
  }

  const displayTitle = lookTitle.trim() || "Untitled Studio Look";
  const addCartLabel =
    selectedGarments.length === 0
      ? "Add Outfit to Cart"
      : selectedGarments.length === 3
      ? "Add All 3 to Cart"
      : `Add All ${selectedGarments.length} to Cart`;

  const selectedGarmentPanelProduct = useMemo(
    () =>
      garmentPanelCatalogue.find(
        (g) => g.id === garmentPanelSelectedProductId
      ) ?? null,
    [garmentPanelCatalogue, garmentPanelSelectedProductId]
  );

  return (
    <div className="space-y-8 pb-10">
      <Suspense fallback={null}>
        <StudioQuerySync
          savedLooks={savedLooks}
          onHydrateLook={handleHydrateLook}
          onClearInvalidLook={handleClearInvalidLook}
          onHydrateProduct={handleHydrateProduct}
        />
      </Suspense>

      {invalidLookId ? (
        <div
          role="alert"
          className="mx-auto max-w-xl space-y-5 rounded-3xl border border-dashed border-amber-300 bg-white/95 p-8 text-center shadow-xs"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <AlertCircle className="h-6 w-6" aria-hidden="true" />
          </div>
          <Badge variant="amber">Saved Look Not Found</Badge>
          <h1 className="text-2xl font-extrabold text-slate-950">
            Saved Look Unavailable
          </h1>
          <p className="text-sm text-slate-600">
            No saved outfit matching{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-800">
              {invalidLookId}
            </code>{" "}
            exists in this browser session&apos;s lookbook. Saved looks are
            stored in active session memory only and are not persisted across
            full reloads.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link href="/saved-looks">
              <Button>Open Saved Looks</Button>
            </Link>
            <Button
              type="button"
              variant="outline"
              onClick={handleStartFreshStudio}
            >
              Start Fresh in Studio
            </Button>
          </div>
        </div>
      ) : (
        <>
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 border-b border-violet-100 pb-6 sm:flex-row sm:items-end">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 break-words">
                Style Studio
              </h1>
              <Badge variant="amber">Session Composer</Badge>
            </div>
            <p className="max-w-2xl text-sm text-slate-600">
              Pair tops, trousers, and outerwear from the collection, pick exact
              bag sizes, and save outfits to your session lookbook.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Link href="/shop">
              <Button type="button" variant="ghost" size="sm">
                Browse Catalogue
              </Button>
            </Link>
            <Link href="/saved-looks">
              <Button type="button" variant="outline" size="sm">
                <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
                View Saved Looks ({savedLooks.length})
              </Button>
            </Link>
          </div>
        </div>

        {/* Honest Frontend / Mock Scope Disclosure */}
        <aside
          aria-label="Style Studio demo disclosure"
          className="flex items-start gap-3 rounded-2xl border border-violet-200/80 bg-violet-50/50 px-4 py-3 text-xs text-slate-700"
        >
          <Info
            className="mt-0.5 h-4 w-4 shrink-0 text-[#6633EE]"
            aria-hidden="true"
          />
          <p className="leading-relaxed">
            <strong>Frontend Demo Notice:</strong> Style Studio uses the local{" "}
            {MOCK_GARMENTS.length}-piece mock catalogue for manual outfit pairing
            and does not generate AI styling scores or persist looks to a
            database. Saved looks remain in your active browser session.
          </p>
        </aside>

        {/* Query Hydration / Preset Status Notice */}
        {queryNotice && (
          <div
            role="status"
            className={cn(
              "flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-xs font-medium",
              queryNotice.type === "warning"
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-violet-200 bg-white text-slate-800"
            )}
          >
            <span className="min-w-0 break-words">{queryNotice.text}</span>
            <button
              type="button"
              onClick={() => setQueryNotice(null)}
              aria-label="Dismiss notice"
              className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6633EE]"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Main Composer Workspace */}
        <div className="grid items-start gap-8 lg:grid-cols-12">
          {/* Left: Garment Selection & Look Form + Garment Panel */}
          <section
            aria-labelledby="composer-controls-heading"
            className="min-w-0 space-y-5 rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-2xs sm:p-6 lg:col-span-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3.5">
              <div>
                <h2
                  id="composer-controls-heading"
                  className="flex items-center gap-2 text-base font-extrabold text-slate-950"
                >
                  <Layers className="h-4 w-4 text-[#6633EE]" aria-hidden="true" />
                  Outfit Layer Controls
                </h2>
                <p className="mt-0.5 text-xs text-slate-600">
                  Choose up to 3 layers or skip any slot.
                </p>
              </div>
              <button
                type="button"
                onClick={handleClearCanvas}
                disabled={selectedGarments.length === 0}
                className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6633EE]"
              >
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                Clear All
              </button>
            </div>

            {/* Manual Presets (Non-AI) */}
            <div className="space-y-2">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Quick Catalogue Pairings (Manual)
              </span>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    applyManualPreset(
                      "Editorial Studio Look",
                      defaultSlots,
                      "Loaded 3-layer pairing from the mock catalogue."
                    )
                  }
                >
                  Full 3-Layer
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    applyManualPreset(
                      "Formal Work Pairing",
                      {
                        topId: "classic-navy-shirt",
                        bottomId: "architectural-pleated-trouser",
                        outerId: "",
                      },
                      "Loaded 2-piece Formal / Work pairing."
                    )
                  }
                >
                  Work Smart
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    applyManualPreset(
                      "Relaxed Travel Look",
                      {
                        topId: "olive-linen-shirt",
                        bottomId: "architectural-pleated-trouser",
                        outerId: "",
                      },
                      "Loaded 2-piece Casual / Travel pairing."
                    )
                  }
                >
                  Casual Travel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleCycleTop}
                >
                  <Shuffle className="h-3.5 w-3.5" aria-hidden="true" />
                  Swap Top
                </Button>
              </div>
            </div>

            {/* Layer Selectors */}
            <div className="space-y-4">
              {/* Top Layer */}
              <div className="space-y-1.5">
                <label
                  htmlFor="studio-top-select"
                  className="block text-xs font-bold text-slate-800"
                >
                  Top Layer (Shirts & Tees)
                </label>
                <select
                  id="studio-top-select"
                  value={topId}
                  onChange={(e) => handleLayerChange("top", e.target.value)}
                  className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#6633EE] focus:outline-none focus:ring-2 focus:ring-[#6633EE]/20"
                >
                  <option value="">None (Skip top layer)</option>
                  {tops.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} — ₹{g.priceInr.toLocaleString("en-IN")} ({g.color})
                    </option>
                  ))}
                </select>
                {topGarment ? (
                  <p className="flex items-center gap-1.5 text-[11px] text-slate-600">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-black/15"
                      style={{ backgroundColor: topGarment.swatchHex }}
                      aria-hidden="true"
                    />
                    <span className="truncate">
                      {topGarment.fitType} Fit · {topGarment.fabric}
                    </span>
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    No top layer selected.
                  </p>
                )}
              </div>

              {/* Bottom Layer */}
              <div className="space-y-1.5">
                <label
                  htmlFor="studio-bottom-select"
                  className="block text-xs font-bold text-slate-800"
                >
                  Bottom Layer (Trousers)
                </label>
                <select
                  id="studio-bottom-select"
                  value={bottomId}
                  onChange={(e) => handleLayerChange("bottom", e.target.value)}
                  className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#6633EE] focus:outline-none focus:ring-2 focus:ring-[#6633EE]/20"
                >
                  <option value="">None (Skip bottom layer)</option>
                  {bottoms.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} — ₹{g.priceInr.toLocaleString("en-IN")} ({g.color})
                    </option>
                  ))}
                </select>
                {bottomGarment ? (
                  <p className="flex items-center gap-1.5 text-[11px] text-slate-600">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-black/15"
                      style={{ backgroundColor: bottomGarment.swatchHex }}
                      aria-hidden="true"
                    />
                    <span className="truncate">
                      {bottomGarment.fitType} Fit · {bottomGarment.fabric}
                    </span>
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    No bottom layer selected.
                  </p>
                )}
              </div>

              {/* Outerwear Layer */}
              <div className="space-y-1.5">
                <label
                  htmlFor="studio-outer-select"
                  className="block text-xs font-bold text-slate-800"
                >
                  Outerwear Layer
                </label>
                <select
                  id="studio-outer-select"
                  value={outerId}
                  onChange={(e) => handleLayerChange("outer", e.target.value)}
                  className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#6633EE] focus:outline-none focus:ring-2 focus:ring-[#6633EE]/20"
                >
                  <option value="">None (Skip outerwear layer)</option>
                  {outer.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} — ₹{g.priceInr.toLocaleString("en-IN")} ({g.color})
                    </option>
                  ))}
                </select>
                {outerGarment ? (
                  <p className="flex items-center gap-1.5 text-[11px] text-slate-600">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-black/15"
                      style={{ backgroundColor: outerGarment.swatchHex }}
                      aria-hidden="true"
                    />
                    <span className="truncate">
                      {outerGarment.fitType} Fit · {outerGarment.fabric}
                    </span>
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    No outerwear layer selected.
                  </p>
                )}
              </div>
            </div>

            {/* Look Name Form */}
            <form
              id="studio-save-form"
              onSubmit={handleSaveLook}
              noValidate
              className="space-y-2 border-t border-slate-100 pt-4"
            >
              <label
                htmlFor="studio-look-title"
                className="block text-xs font-bold text-slate-800"
              >
                Look Name <span className="text-red-600" aria-hidden="true">*</span>
              </label>
              <p
                id="studio-look-title-help"
                className="text-[11px] text-slate-500"
              >
                Name this pairing (1–60 characters) before saving to your session
                lookbook.
              </p>
              <Input
                ref={titleInputRef}
                id="studio-look-title"
                name="lookTitle"
                type="text"
                value={lookTitle}
                onChange={handleTitleChange}
                onBlur={handleTitleBlur}
                maxLength={60}
                required
                placeholder="e.g. Atelier Smart Casual"
                aria-invalid={titleError ? "true" : "false"}
                aria-describedby={
                  titleError
                    ? "studio-look-title-error studio-look-title-help"
                    : "studio-look-title-help"
                }
                className={cn(
                  titleError &&
                    "border-red-500 focus:border-red-600 focus:ring-red-200"
                )}
              />
              {titleError && (
                <p
                  id="studio-look-title-error"
                  role="alert"
                  className="flex items-center gap-1.5 text-xs font-semibold text-red-600"
                >
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{titleError}</span>
                </p>
              )}
            </form>

            {/* Garment Panel */}
            <section
              aria-labelledby="garment-panel-heading"
              className="space-y-4 border-t border-slate-100 pt-4"
            >
              <div className="flex items-center justify-between gap-2">
                <h3
                  id="garment-panel-heading"
                  className="flex items-center gap-2 text-sm font-extrabold text-slate-950"
                >
                  <Sparkles className="h-4 w-4 text-[#6633EE]" aria-hidden="true" />
                  Dress Your Avatar
                </h3>
                <Badge variant="neutral" size="sm">
                  Beta
                </Badge>
              </div>
              <p className="text-xs text-slate-600">
                Select a garment from the live catalogue, pick your size and fit
                preference, and see it on your 3D avatar.
              </p>

              {/* Garment Type Selector */}
              <div className="space-y-1.5">
                <label
                  htmlFor="garment-panel-type"
                  className="block text-xs font-bold text-slate-800"
                >
                  Garment Type
                </label>
                <select
                  id="garment-panel-type"
                  value={garmentPanelGarmentType}
                  onChange={(e) =>
                    setGarmentPanelGarmentType(e.target.value as GarmentType)
                  }
                  className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#6633EE] focus:outline-none focus:ring-2 focus:ring-[#6633EE]/20"
                  disabled={garmentPanelCatalogueLoading}
                >
                  {GARMENT_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Catalogue Garment Picker */}
              <div className="space-y-1.5">
                <label
                  htmlFor="garment-panel-catalogue"
                  className="block text-xs font-bold text-slate-800"
                >
                  Catalogue Garment
                </label>
                {garmentPanelCatalogueLoading ? (
                  <div className="min-h-10 w-full rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-[#6633EE]" />
                    <span className="ml-2 text-xs text-slate-500">Loading catalogue...</span>
                  </div>
                ) : garmentPanelCatalogue.length === 0 ? (
                  <div className="min-h-10 w-full rounded-lg border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-xs text-slate-500">
                    No garments available for this type.
                  </div>
                ) : (
                  <select
                    id="garment-panel-catalogue"
                    value={garmentPanelSelectedProductId ?? ""}
                    onChange={(e) =>
                      setGarmentPanelSelectedProductId(e.target.value || null)
                    }
                    className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#6633EE] focus:outline-none focus:ring-2 focus:ring-[#6633EE]/20"
                  >
                    <option value="">Select a garment...</option>
                    {garmentPanelCatalogue.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} — ₹{g.priceInr.toLocaleString("en-IN")} ({g.color})
                      </option>
                    ))}
                  </select>
                )}
                {selectedGarmentPanelProduct ? (
                  <p className="flex items-center gap-1.5 text-[11px] text-slate-600">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-black/15"
                      style={{ backgroundColor: selectedGarmentPanelProduct.swatchHex }}
                      aria-hidden="true"
                    />
                    <span className="truncate">
                      {selectedGarmentPanelProduct.fitType} Fit · {selectedGarmentPanelProduct.fabric}
                    </span>
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-500">No garment selected.</p>
                )}
              </div>

              <AvatarTryOnControls
                availableSizes={garmentPanelAvailableSizes}
                selectedSize={garmentPanelSelectedSize}
                recommendedSize={garmentPanelRecommendedSize}
                onSelectSize={setGarmentPanelSelectedSize}
                sizingLoading={garmentPanelSizingLoading}
                fitPreference={garmentPanelFitPreference}
                onSelectFitPreference={setGarmentPanelFitPreference}
                viewMode={garmentPanelViewMode}
                onSelectViewMode={setGarmentPanelViewMode}
                colorHex={garmentPanelColorHex}
                onSelectColorHex={setGarmentPanelColorHex}
                onDress={handleDressAvatar}
                onRemoveGarment={handleRemoveGarment}
                dressingLoading={garmentPanelLoading}
                dressDisabled={
                  garmentPanelLoading ||
                  !avatarId ||
                  avatarServiceOffline ||
                  !garmentPanelSelectedProductId
                }
                hasDressedGarment={Boolean(garmentPanelDressedUrl)}
                avatarServiceOffline={avatarServiceOffline}
                hasAvatar={Boolean(avatarId)}
              />

              {/* Error / Status Messages */}
              {garmentPanelError && (
                <div
                  role="alert"
                  className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
                >
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{garmentPanelError}</span>
                </div>
              )}
              {!avatarId && !garmentPanelError && !garmentPanelLoading && (
                <div
                  className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
                >
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <span>Create your avatar first to use the dressing feature.</span>
                </div>
              )}
              {avatarServiceOffline && !garmentPanelError && !garmentPanelLoading && (
                <div
                  className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
                >
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <span>Avatar service offline — dressing unavailable.</span>
                </div>
              )}
              {garmentPanelDressedUrl && !garmentPanelError && !garmentPanelLoading && (
                <div
                  className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span>Garment applied to avatar. Switch to 3D Avatar view to see it.</span>
                </div>
              )}
            </section>
          </section>

          {/* Right: Live Outfit Canvas */}
          <section
            aria-labelledby="live-canvas-heading"
            className="min-w-0 space-y-5 rounded-2xl border border-violet-200/80 bg-white/95 p-5 shadow-2xs sm:p-6 lg:col-span-7"
          >
            {/* Canvas Header (wraps cleanly at 375px) */}
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Live Outfit Canvas
                  </span>
                  <Badge variant="neutral" size="sm">
                    {selectedGarments.length} of 3 layers
                  </Badge>
                </div>
                <h2
                  id="live-canvas-heading"
                  className="text-xl font-extrabold text-slate-950 break-words"
                >
                  {displayTitle}
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <div
                  role="group"
                  aria-label="Studio stage view"
                  className="inline-flex rounded-xl border border-violet-200 bg-violet-50/70 p-0.5 text-[11px] font-semibold"
                >
                  <button
                    type="button"
                    aria-pressed={stageMode === "canvas"}
                    onClick={() => setStageMode("canvas")}
                    className={cn(
                      "cursor-pointer rounded-lg px-2.5 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6633EE]",
                      stageMode === "canvas"
                        ? "bg-[#6633EE] text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-950"
                    )}
                  >
                    Outfit Canvas
                  </button>
                  <button
                    type="button"
                    aria-pressed={stageMode === "avatar"}
                    onClick={() => setStageMode("avatar")}
                    className={cn(
                      "cursor-pointer rounded-lg px-2.5 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6633EE]",
                      stageMode === "avatar"
                        ? "bg-[#6633EE] text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-950"
                    )}
                  >
                    3D Avatar
                  </button>
                </div>

                {stageMode === "canvas" && (
                  <div
                    role="group"
                    aria-label="Preview backdrop surface"
                    className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5 text-[11px] font-semibold"
                  >
                    {BACKDROP_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        aria-pressed={backdrop === opt.id}
                        onClick={() => setBackdrop(opt.id)}
                        className={cn(
                          "cursor-pointer rounded-lg px-2.5 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6633EE]",
                          backdrop === opt.id
                            ? "bg-[#6633EE] text-white"
                            : "text-slate-600 hover:text-slate-950"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}

                <span className="text-lg font-extrabold text-[#6633EE]">
                  ₹{totalInr.toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {stageMode === "avatar" ? (
              <div className="space-y-4">
                {avatarServiceOffline ? (
                  <div className="space-y-4">
                    <div
                      role="status"
                      aria-live="polite"
                      className="rounded-2xl border border-amber-300 bg-amber-50/95 p-4 text-xs text-amber-950 shadow-2xs"
                    >
                      <div className="flex items-center gap-2 font-bold text-amber-900">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                        <span>Avatar service offline — Using deterministic fit preview</span>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-amber-800">
                        The 3D avatar engine is temporarily offline (DEC-005: Never present
                        fallback output as a real avatar). The silhouette below is an
                        illustrative 2D proportional guide based on your saved measurements,
                        not a 3D anatomical scan.
                      </p>
                    </div>
                    <DigitalAvatarPreview
                      metricsCm={{
                        heightCm: bodyProfile.heightCm,
                        chestCm: bodyProfile.chestCm,
                        waistCm: bodyProfile.waistCm,
                        hipCm: bodyProfile.hipCm,
                        shoulderCm: bodyProfile.shoulderCm,
                        sleeveCm: bodyProfile.sleeveCm,
                        inseamCm: bodyProfile.inseamCm,
                      }}
                      unit="cm"
                      fitPreference={bodyProfile.fitPreference}
                      bodyType={bodyProfile.bodyType}
                      weightKg={
                        bodyProfile.weightKg
                          ? String(bodyProfile.weightKg)
                          : undefined
                      }
                      hasSavedProfile={hasBodyProfile}
                      isEditing={false}
                      activeZone="chestCm"
                      onSelectZone={() => {}}
                    />
                  </div>
                ) : avatarId ? (
                  <Avatar3DViewer
                    avatarId={avatarId}
                    garmentUrl={garmentPanelDressedUrl}
                    className="h-[460px]"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-violet-300 bg-violet-50/50 p-8 text-center">
                    <Sparkles className="h-8 w-8 text-[#6633EE]" />
                    <p className="mt-3 text-base font-extrabold text-slate-900">
                      {hasBodyProfile
                        ? "Calibrated 3D Avatar Ready to Build"
                        : "Body Profile Required"}
                    </p>
                    <p className="mt-1 max-w-sm text-xs text-slate-600">
                      {hasBodyProfile
                        ? "Generate an interactive 3D SMPL mesh from your calibrated measurements to preview proportions in Style Studio."
                        : "Save your Body Profile first to enable 3D avatar generation and proportional fit calibration."}
                    </p>
                    <div className="mt-4 flex gap-2">
                      {hasBodyProfile ? (
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleGenerateAvatar}
                          disabled={isGeneratingAvatar}
                          className="cursor-pointer"
                        >
                          {isGeneratingAvatar ? (
                            <>
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              Generating 3D Avatar...
                            </>
                          ) : (
                            <>
                              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                              Generate 3D Avatar
                            </>
                          )}
                        </Button>
                      ) : (
                        <Link href="/body-profile">
                          <Button type="button" size="sm">
                            Go to Body Profile
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Canvas Preview Stage */
              <div
                className={cn(
                  "rounded-2xl border p-4 transition-colors sm:p-5",
                  activeBackdrop.stageClass
                )}
              >
              {selectedSlots.length === 0 ? (
                <div className="rounded-xl border border-dashed border-violet-300/80 bg-white/95 p-8 text-center">
                  <Layers
                    className="mx-auto h-8 w-8 text-violet-300"
                    aria-hidden="true"
                  />
                  <p className="mt-3 text-base font-extrabold text-slate-950">
                    Your outfit canvas is empty
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Select a Top, Bottom, or Outerwear garment from Outfit Layer
                    Controls, or load a manual catalogue pairing.
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2.5">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        applyManualPreset(
                          DEFAULT_TITLE,
                          defaultSlots,
                          "Loaded default 3-layer pairing."
                        )
                      }
                    >
                      Load Default Pairing
                    </Button>
                    <Link href="/shop">
                      <Button type="button" size="sm" variant="outline">
                        Explore Shop
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                  {selectedSlots.map(({ slotKey, label, garment }) => {
                    const hasValidImage =
                      Boolean(garment.image) && !failedImages[garment.id];
                    const chosenSize = getSizeForGarment(garment);

                    return (
                      <article
                        key={`${slotKey}-${garment.id}`}
                        className={cn(
                          "flex flex-col justify-between rounded-xl border p-3.5 shadow-2xs",
                          activeBackdrop.dark
                            ? "border-slate-700 bg-slate-800/95 text-slate-100"
                            : "border-slate-200/80 bg-white/95 text-slate-900"
                        )}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={cn(
                                "text-[10px] font-bold uppercase tracking-wider",
                                activeBackdrop.dark
                                  ? "text-violet-300"
                                  : "text-[#4C1D95]"
                              )}
                            >
                              {label}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleLayerChange(slotKey, "")}
                              aria-label={`Remove ${garment.name} from ${label}`}
                              className={cn(
                                "inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6633EE]",
                                activeBackdrop.dark
                                  ? "text-slate-300 hover:bg-slate-700 hover:text-white"
                                  : "text-slate-400 hover:bg-slate-100 hover:text-slate-900"
                              )}
                            >
                              <X className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>

                          <Link
                            href={`/shop/${garment.id}`}
                            className="group relative mt-2 block aspect-[4/4] w-full overflow-hidden rounded-xl border border-slate-200/70 bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6633EE]"
                          >
                            {hasValidImage ? (
                              <Image
                                src={garment.image!}
                                alt={`${garment.name} in ${garment.color}`}
                                fill
                                sizes="(max-width: 640px) 100vw, 220px"
                                onError={() =>
                                  setFailedImages((prev) => ({
                                    ...prev,
                                    [garment.id]: true,
                                  }))
                                }
                                className="object-cover object-top transition-transform duration-300 group-hover:scale-105"
                              />
                            ) : (
                              <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center">
                                <div
                                  className="h-14 w-12 rounded-lg border border-black/10 shadow-xs"
                                  style={{
                                    backgroundColor:
                                      garment.swatchHex || "#E2E8F0",
                                  }}
                                  aria-hidden="true"
                                />
                                <span className="text-[11px] font-semibold text-slate-600">
                                  {garment.color} Swatch
                                </span>
                              </div>
                            )}
                          </Link>

                          <div className="mt-3 space-y-1">
                            <Link
                              href={`/shop/${garment.id}`}
                              className={cn(
                                "block text-sm font-extrabold leading-snug hover:underline break-words",
                                activeBackdrop.dark
                                  ? "text-white"
                                  : "text-slate-950"
                              )}
                            >
                              {garment.name}
                            </Link>
                            <p
                              className={cn(
                                "text-[11px]",
                                activeBackdrop.dark
                                  ? "text-slate-300"
                                  : "text-slate-600"
                              )}
                            >
                              {garment.fitType} Fit · {garment.color}
                            </p>
                            <p
                              className={cn(
                                "text-xs font-bold",
                                activeBackdrop.dark
                                  ? "text-violet-300"
                                  : "text-slate-900"
                              )}
                            >
                              ₹{garment.priceInr.toLocaleString("en-IN")}
                            </p>
                          </div>
                        </div>

                        {/* Per-Layer Cart Size Control */}
                        <div
                          className={cn(
                            "mt-3 flex items-center justify-between gap-2 border-t pt-2.5",
                            activeBackdrop.dark
                              ? "border-slate-700"
                              : "border-slate-100"
                          )}
                        >
                          <label
                            htmlFor={`studio-size-${slotKey}`}
                            className={cn(
                              "text-[11px] font-semibold",
                              activeBackdrop.dark
                                ? "text-slate-300"
                                : "text-slate-600"
                            )}
                          >
                            Bag Size{" "}
                            <span
                              className={cn(
                                "font-normal",
                                activeBackdrop.dark
                                  ? "text-slate-400"
                                  : "text-slate-500"
                              )}
                            >
                              (Required)
                            </span>
                          </label>
                          <select
                            id={`studio-size-${slotKey}`}
                            value={chosenSize}
                            aria-invalid={Boolean(canvasError && !chosenSize)}
                            onChange={(e) => {
                              const nextVal = e.target.value;
                              setCanvasError(null);
                              setGarmentSizes((prev) => {
                                if (!nextVal) {
                                  const next = { ...prev };
                                  delete next[garment.id];
                                  return next;
                                }
                                return {
                                  ...prev,
                                  [garment.id]: nextVal as GarmentSize,
                                };
                              });
                            }}
                            className={cn(
                              "min-h-8 rounded-md border bg-white px-2 py-1 text-xs font-bold text-slate-900 focus:border-[#6633EE] focus:outline-none focus:ring-2 focus:ring-[#6633EE]/20",
                              canvasError && !chosenSize
                                ? "border-red-500 ring-1 ring-red-400"
                                : "border-slate-300"
                            )}
                          >
                            <option value="">Choose size...</option>
                            {garment.sizes.map((sz) => (
                              <option key={sz} value={sz}>
                                {sz}
                              </option>
                            ))}
                          </select>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
              </div>
            )}

            {/* Truthful Palette & Garment Summary */}
            {selectedGarments.length > 0 && (
              <div className="grid gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 text-xs sm:grid-cols-2">
                <div className="space-y-1.5">
                  <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-slate-500">
                    <Palette className="h-3.5 w-3.5 text-[#6633EE]" aria-hidden="true" />
                    Outfit Colour Palette
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {selectedGarments.map((g) => (
                      <span
                        key={`palette-${g.id}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-800"
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/15"
                          style={{ backgroundColor: g.swatchHex }}
                          aria-hidden="true"
                        />
                        {g.color}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="font-bold uppercase tracking-wider text-slate-500">
                    Silhouettes & Occasions
                  </span>
                  <p className="font-semibold text-slate-800 break-words">
                    {uniqueFits.join(" · ")}
                  </p>
                  <p className="text-slate-600 break-words">
                    {uniqueOccasions.join(" · ")}
                  </p>
                </div>
              </div>
            )}

            {/* Validation & Save Confirmation Feedback */}
            {canvasError && (
              <p
                role="alert"
                className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700"
              >
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{canvasError}</span>
              </p>
            )}

            {savedTitleBanner && (
              <div
                role="status"
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-900"
              >
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    &ldquo;{savedTitleBanner}&rdquo; saved to your local Saved
                    Looks gallery!
                  </span>
                </span>
                <Link
                  href="/saved-looks"
                  className="inline-flex items-center gap-1 font-bold text-emerald-950 underline-offset-2 hover:underline"
                >
                  Open Saved Looks
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              </div>
            )}

            {/* Primary Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" form="studio-save-form">
                <Bookmark className="h-4 w-4" aria-hidden="true" />
                {isEditingExistingLook ? "Update Saved Look" : "Save Look"}
              </Button>

              {isEditingExistingLook && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => persistLook("new")}
                >
                  Save as New Look
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={handleAddAllToCart}
              >
                {justAdded ? (
                  <>
                    <Check className="h-4 w-4" aria-hidden="true" />
                    Added to Bag
                  </>
                ) : (
                  <>
                    <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                    {addCartLabel}
                  </>
                )}
              </Button>

              {primaryTryOnGarment ? (
                <Link
                  href={`/try-on?product=${encodeURIComponent(
                    primaryTryOnGarment.id
                  )}`}
                >
                  <Button type="button" variant="secondary">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    Try On in Fitting Room
                  </Button>
                </Link>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleEmptyTryOn}
                >
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  Try On in Fitting Room
                </Button>
              )}
            </div>
          </section>
        </div>

        {/* Local Session Lookbook */}
        <section
          aria-labelledby="session-lookbook-heading"
          className="space-y-4 rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-2xs sm:p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="min-w-0">
              <h2
                id="session-lookbook-heading"
                className="text-lg font-extrabold text-slate-950"
              >
                Session Lookbook ({savedLooks.length})
              </h2>
              <p className="mt-0.5 text-xs text-slate-600">
                Load any saved outfit back into the composer or manage looks in
                Saved Looks (stored in local session state only).
              </p>
            </div>
            <Link
              href="/saved-looks"
              className="text-xs font-bold text-[#6633EE] hover:underline"
            >
              Open Saved Looks Gallery →
            </Link>
          </div>

          {savedLooks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50/30 p-8 text-center">
              <Bookmark
                className="mx-auto h-7 w-7 text-violet-300"
                aria-hidden="true"
              />
              <p className="mt-2.5 text-sm font-bold text-slate-950">
                No saved looks in this session yet
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Compose an outfit above, enter a look name, and click Save Look to
                store it here.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {savedLooks.map((look) => {
                const items = look.garmentIds
                  .map((gid) => MOCK_GARMENTS.find((g) => g.id === gid))
                  .filter((g): g is MockGarment => Boolean(g));
                const isLoaded = activeLookId === look.id;

                return (
                  <article
                    key={look.id}
                    className={cn(
                      "flex flex-col justify-between rounded-xl border p-4 transition-colors",
                      isLoaded
                        ? "border-[#6633EE] bg-violet-50/50"
                        : "border-slate-200/80 bg-slate-50/60"
                    )}
                  >
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge variant="neutral" size="sm">
                          {look.source}
                        </Badge>
                        <span className="text-[11px] text-slate-500">
                          {look.createdAt}
                        </span>
                      </div>

                      <h3 className="mt-2.5 text-sm font-extrabold text-slate-950 break-words">
                        {look.title || "Untitled Studio Look"}
                      </h3>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {items.map((g) => {
                          const showImg =
                            Boolean(g.image) && !failedImages[g.id];
                          return showImg ? (
                            <div
                              key={`${look.id}-${g.id}`}
                              className="relative h-12 w-10 overflow-hidden rounded-lg border border-slate-200 bg-white"
                            >
                              <Image
                                src={g.image!}
                                alt={g.name}
                                fill
                                sizes="40px"
                                onError={() =>
                                  setFailedImages((prev) => ({
                                    ...prev,
                                    [g.id]: true,
                                  }))
                                }
                                className="object-cover object-top"
                              />
                            </div>
                          ) : (
                            <div
                              key={`${look.id}-${g.id}`}
                              title={g.name}
                              className="h-12 w-10 rounded-lg border border-slate-200"
                              style={{ backgroundColor: g.swatchHex }}
                              aria-hidden="true"
                            />
                          );
                        })}
                      </div>

                      <p className="mt-2.5 text-xs text-slate-600 break-words">
                        {items.length > 0
                          ? items.map((g) => g.name).join(" + ")
                          : "Referenced garments unavailable."}
                      </p>
                    </div>

                    <div className="mt-4 flex items-center gap-2 border-t border-slate-200/70 pt-3">
                      <Button
                        type="button"
                        size="sm"
                        variant={isLoaded ? "secondary" : "outline"}
                        className="flex-1"
                        onClick={() =>
                          applySavedLookToCanvas(look, "Loaded look into canvas:")
                        }
                      >
                        {isLoaded ? "Loaded in Canvas" : "Load in Canvas"}
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Delete ${look.title || "saved look"}`}
                        onClick={() => handleDeleteSessionLook(look)}
                      >
                        <Trash2
                          className="h-4 w-4 text-red-600"
                          aria-hidden="true"
                        />
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
        </>
      )}
    </div>
  );
}