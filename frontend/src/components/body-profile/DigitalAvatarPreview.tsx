"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { AlertTriangle, Camera, CheckCircle2, Info, Loader2, Sparkles, Upload, User } from "lucide-react";
import { BodyType, FitPreference, GarmentType, getFitPreferenceEaseCm } from "@/lib/mock-data";
import {
  LengthFieldKey,
  MEASUREMENT_FIELDS,
  MeasurementUnit,
  formatLengthFromCm,
} from "@/lib/body-profile-utils";
import { useFitloom } from "@/components/providers/fitloom-provider";
import { Avatar3DViewer } from "@/components/avatar/Avatar3DViewer";
import { AvatarTryOnControls } from "@/components/avatar/AvatarTryOnControls";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  api,
  ApiError,
  createAvatarFromImages,
  type PhotoBodyModelOption,
  type PhotoClothingFitOption,
  type PhotoBuildTypeOption,
} from "@/lib/api";
import {
  ProductsQuery,
  ProductItem,
  AvatarDressInput,
  AvatarDressResponse,
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

interface DigitalAvatarPreviewProps {
  metricsCm: Partial<Record<LengthFieldKey, number>>;
  unit: MeasurementUnit;
  fitPreference: FitPreference;
  bodyType?: BodyType | "";
  weightKg?: string;
  hasSavedProfile: boolean;
  isEditing: boolean;
  activeZone: LengthFieldKey;
  onSelectZone: (zone: LengthFieldKey) => void;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function DigitalAvatarPreview({
  metricsCm,
  unit,
  fitPreference,
  bodyType,
  weightKg,
  hasSavedProfile,
  isEditing,
  activeZone,
  onSelectZone,
}: DigitalAvatarPreviewProps) {
  const completedKeys = MEASUREMENT_FIELDS.filter(
    (f) => typeof metricsCm[f.key] === "number" && (metricsCm[f.key] ?? 0) > 0
  );
  const missingFields = MEASUREMENT_FIELDS.filter(
    (f) => !(typeof metricsCm[f.key] === "number" && (metricsCm[f.key] ?? 0) > 0)
  );
  const completedCount = completedKeys.length;
  const totalCount = MEASUREMENT_FIELDS.length;
  const isComplete = completedCount === totalCount;

  // Bounded proportional offsets for illustrative 2D silhouette only
  const shoulderHalf = clamp(
    36 + ((metricsCm.shoulderCm ?? 40) - 40) * 0.7,
    30,
    46
  );
  const chestHalf = clamp(
    28 + ((metricsCm.chestCm ?? 92) - 92) * 0.35,
    22,
    38
  );
  const waistHalf = clamp(
    20 + ((metricsCm.waistCm ?? 70) - 70) * 0.35,
    16,
    34
  );
  const hipHalf = clamp(
    28 + ((metricsCm.hipCm ?? 98) - 98) * 0.35,
    22,
    40
  );

  const cx = 110;
  const sL = cx - shoulderHalf;
  const sR = cx + shoulderHalf;
  const cL = cx - chestHalf;
  const cR = cx + chestHalf;
  const wL = cx - waistHalf;
  const wR = cx + waistHalf;
  const hL = cx - hipHalf;
  const hR = cx + hipHalf;

  const activeMeta =
    MEASUREMENT_FIELDS.find((f) => f.key === activeZone) ??
    MEASUREMENT_FIELDS[1];
  const activeValueCm = metricsCm[activeMeta.key];
  const activeDisplayValue = activeValueCm
    ? `${formatLengthFromCm(activeValueCm, unit)} ${unit}`
    : "Not entered";

  const easeCm = getFitPreferenceEaseCm(fitPreference);

  const {
    avatarId,
    setAvatarId,
    avatarServiceOffline,
    isGeneratingAvatar,
    generateAvatarPreset,
    checkAvatarStatus,
    bodyProfile,
    hasBodyProfile,
    toast,
  } = useFitloom();

  const [localAvatarId, setLocalAvatarId] = useState<string | null>(null);
  const effectiveAvatarId = localAvatarId || avatarId;
  const isEmpty = !hasSavedProfile && completedCount === 0 && !effectiveAvatarId;

  const hasExistingProfile = hasSavedProfile || hasBodyProfile;
  const savedProfileHeightCm = useMemo(() => {
    if (!hasExistingProfile) return undefined;
    const candidate = bodyProfile?.heightCm ?? metricsCm.heightCm;
    return typeof candidate === "number" && candidate > 0 ? candidate : undefined;
  }, [hasExistingProfile, bodyProfile?.heightCm, metricsCm.heightCm]);

  const savedProfileWeightKg = useMemo(() => {
    if (!hasExistingProfile) return undefined;
    if (typeof bodyProfile?.weightKg === "number" && bodyProfile.weightKg > 0) {
      return bodyProfile.weightKg;
    }
    if (weightKg && weightKg.trim() !== "") {
      const parsed = Number(weightKg.trim());
      if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    }
    return undefined;
  }, [hasExistingProfile, bodyProfile?.weightKg, weightKg]);

  // Photo Upload State
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [sideFile, setSideFile] = useState<File | null>(null);
  const [photoGender, setPhotoGender] = useState<PhotoBodyModelOption>("neutral");
  const [photoHeightUnit, setPhotoHeightUnit] = useState<"cm" | "ft-in">("cm");
  const [photoHeightCm, setPhotoHeightCm] = useState<string>(() =>
    savedProfileHeightCm ? String(savedProfileHeightCm) : ""
  );
  const [photoHeightFt, setPhotoHeightFt] = useState<string>(() => {
    if (!savedProfileHeightCm) return "";
    const totalIn = savedProfileHeightCm / 2.54;
    let ft = Math.floor(totalIn / 12);
    const inch = Math.round((totalIn - ft * 12) * 2) / 2;
    if (inch >= 12) ft += 1;
    return String(ft);
  });
  const [photoHeightIn, setPhotoHeightIn] = useState<string>(() => {
    if (!savedProfileHeightCm) return "";
    const totalIn = savedProfileHeightCm / 2.54;
    const ft = Math.floor(totalIn / 12);
    let inch = Math.round((totalIn - ft * 12) * 2) / 2;
    if (inch >= 12) inch = 0;
    return String(inch);
  });
  const [photoWeightUnit, setPhotoWeightUnit] = useState<"kg" | "lb">("kg");
  const [photoWeight, setPhotoWeight] = useState<string>(() =>
    savedProfileWeightKg ? String(savedProfileWeightKg) : ""
  );
  const [photoClothingFit, setPhotoClothingFit] =
    useState<PhotoClothingFitOption>("regular");
  const [photoBuildType, setPhotoBuildType] =
    useState<PhotoBuildTypeOption>("average");
  const [photoHeightTouched, setPhotoHeightTouched] = useState<boolean>(false);
  const [photoWeightTouched, setPhotoWeightTouched] = useState<boolean>(false);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState<boolean>(false);
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);

  // Sync prefilled height from saved body profile if user has not manually edited it
  useEffect(() => {
    if (!hasExistingProfile || photoHeightTouched) return;
    if (typeof savedProfileHeightCm === "number" && savedProfileHeightCm > 0) {
      setPhotoHeightCm(String(savedProfileHeightCm));
      const totalIn = savedProfileHeightCm / 2.54;
      let ft = Math.floor(totalIn / 12);
      let inch = Math.round((totalIn - ft * 12) * 2) / 2;
      if (inch >= 12) {
        ft += 1;
        inch = 0;
      }
      setPhotoHeightFt(String(ft));
      setPhotoHeightIn(String(inch));
    }
  }, [hasExistingProfile, savedProfileHeightCm, photoHeightTouched]);

  // Sync prefilled weight from saved body profile if user has not manually edited it
  useEffect(() => {
    if (!hasExistingProfile || photoWeightTouched) return;
    if (typeof savedProfileWeightKg === "number" && savedProfileWeightKg > 0) {
      if (photoWeightUnit === "kg") {
        setPhotoWeight(String(savedProfileWeightKg));
      } else {
        const lbs = Math.round((savedProfileWeightKg / 0.45359237) * 10) / 10;
        setPhotoWeight(String(lbs));
      }
    }
  }, [hasExistingProfile, savedProfileWeightKg, photoWeightTouched, photoWeightUnit]);

  function handlePhotoHeightUnitSwitch(nextUnit: "cm" | "ft-in") {
    if (nextUnit === photoHeightUnit) return;
    if (nextUnit === "ft-in") {
      const trimmed = photoHeightCm.trim();
      if (trimmed !== "" && !Number.isNaN(Number(trimmed)) && Number(trimmed) > 0) {
        const totalIn = Number(trimmed) / 2.54;
        let ft = Math.floor(totalIn / 12);
        let inch = Math.round((totalIn - ft * 12) * 2) / 2;
        if (inch >= 12) {
          ft += 1;
          inch = 0;
        }
        setPhotoHeightFt(String(ft));
        setPhotoHeightIn(String(inch));
      } else {
        setPhotoHeightFt("");
        setPhotoHeightIn("");
      }
    } else {
      const ftTrim = photoHeightFt.trim();
      const inTrim = photoHeightIn.trim();
      if (ftTrim !== "" || inTrim !== "") {
        const ft = Number(ftTrim) || 0;
        const inch = Number(inTrim) || 0;
        const cm = (ft * 12 + inch) * 2.54;
        setPhotoHeightCm(cm > 0 ? String(Math.round(cm * 10) / 10) : "");
      } else {
        setPhotoHeightCm("");
      }
    }
    setPhotoHeightUnit(nextUnit);
  }

  function handlePhotoWeightUnitSwitch(nextUnit: "kg" | "lb") {
    if (nextUnit === photoWeightUnit) return;
    const trimmed = photoWeight.trim();
    if (trimmed !== "" && !Number.isNaN(Number(trimmed)) && Number(trimmed) > 0) {
      if (nextUnit === "lb") {
        const lbs = Math.round((Number(trimmed) / 0.45359237) * 10) / 10;
        setPhotoWeight(String(lbs));
      } else {
        const kg = Math.round(Number(trimmed) * 0.45359237 * 10) / 10;
        setPhotoWeight(String(kg));
      }
    }
    setPhotoWeightUnit(nextUnit);
  }

  const [viewMode, setViewMode] = useState<"3d" | "2d">("2d");

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

  const selectedGarmentPanelProduct = useMemo(
    () => garmentPanelCatalogue.find((g) => g.id === garmentPanelSelectedProductId) ?? null,
    [garmentPanelCatalogue, garmentPanelSelectedProductId]
  );

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

  useEffect(() => {
    checkAvatarStatus();
  }, [checkAvatarStatus]);

  useEffect(() => {
    if (effectiveAvatarId && !avatarServiceOffline) {
      setViewMode("3d");
    } else {
      setViewMode("2d");
    }
  }, [effectiveAvatarId, avatarServiceOffline]);

  async function handleGenerateAvatar() {
    const res = await generateAvatarPreset();
    if (res.ok) {
      if (res.avatarId) {
        setLocalAvatarId(res.avatarId);
      }
      setViewMode("3d");
      toast({
        type: "success",
        title: "3D Avatar Calibrated",
        message: "Your SMPL 3D mesh was generated from your body profile measurements.",
      });
    } else {
      toast({
        type: "error",
        title: "Avatar Engine Offline",
        message: res.error ?? "Avatar engine is temporarily offline. Using deterministic fit preview.",
      });
    }
  }

  async function handlePhotoUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!frontFile) {
      setPhotoUploadError("Front photo is required");
      return;
    }

    if (avatarServiceOffline) {
      setPhotoUploadError("Avatar service offline");
      return;
    }

    // Convert ft/in -> cm and lb -> kg on the client before sending
    let resolvedHeightCm: number | undefined = undefined;
    if (photoHeightUnit === "cm") {
      if (photoHeightCm.trim() !== "") {
        resolvedHeightCm = Math.round(Number(photoHeightCm.trim()) * 10) / 10;
      }
    } else {
      if (photoHeightFt.trim() !== "" || photoHeightIn.trim() !== "") {
        const ft = Number(photoHeightFt.trim()) || 0;
        const inch = Number(photoHeightIn.trim()) || 0;
        resolvedHeightCm = Math.round((ft * 12 + inch) * 2.54 * 10) / 10;
      }
    }

    let resolvedWeightKg: number | undefined = undefined;
    if (photoWeight.trim() !== "") {
      const rawWeight = Number(photoWeight.trim());
      resolvedWeightKg =
        photoWeightUnit === "lb"
          ? Math.round(rawWeight * 0.45359237 * 10) / 10
          : Math.round(rawWeight * 10) / 10;
    }

    if (
      resolvedHeightCm !== undefined &&
      (Number.isNaN(resolvedHeightCm) || resolvedHeightCm < 130 || resolvedHeightCm > 220)
    ) {
      setPhotoUploadError("Height must be between 130 and 220 cm");
      return;
    }

    if (
      resolvedWeightKg !== undefined &&
      (Number.isNaN(resolvedWeightKg) || resolvedWeightKg < 30 || resolvedWeightKg > 200)
    ) {
      setPhotoUploadError(
        photoWeightUnit === "lb"
          ? "Weight must be between 66 and 441 lb (30–200 kg)"
          : "Weight must be between 30 and 200 kg"
      );
      return;
    }

    setIsUploadingPhotos(true);
    setPhotoUploadError(null);

    try {
      const res = await createAvatarFromImages({
        front: frontFile,
        side: sideFile,
        gender: photoGender,
        heightCm: resolvedHeightCm,
        weightKg: resolvedWeightKg,
        clothingFit: photoClothingFit,
        buildType: photoBuildType,
      });

      setAvatarId(res.avatarId);
      setLocalAvatarId(res.avatarId);
      setViewMode("3d");
      toast({
        type: "success",
        title: "3D Avatar Created",
        message: "Your 3D avatar has been generated from your photos.",
      });
      setFrontFile(null);
      setSideFile(null);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 503 || err.code === "SERVICE_UNAVAILABLE") {
          setPhotoUploadError("Avatar service offline");
        } else if (err.status === 422 || err.code === "AVATAR_GENERATION_FAILED") {
          setPhotoUploadError("Could not read a body in this photo, try again");
        } else {
          setPhotoUploadError(err.message || "Failed to create avatar from photos");
        }
      } else {
        setPhotoUploadError("Avatar service offline");
      }
    } finally {
      setIsUploadingPhotos(false);
    }
  }

  const is3DActive = Boolean(effectiveAvatarId) && !avatarServiceOffline && viewMode === "3d";

  return (
    <div className="flex flex-col rounded-3xl border border-violet-200/80 bg-gradient-to-b from-white via-[#FAF7FF] to-violet-50/70 p-5 shadow-xs sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-violet-100 pb-3.5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#6633EE]" aria-hidden="true" />
          <h2 className="text-sm font-bold text-slate-950">
            {is3DActive
              ? "3D Digital Avatar (SMPL)"
              : "Illustrative 2D Digital Avatar"}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {effectiveAvatarId && !avatarServiceOffline && (
            <div className="flex items-center rounded-lg border border-violet-200 bg-white p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode("3d")}
                className={cn(
                  "cursor-pointer rounded-md px-2 py-0.5 text-xs font-semibold transition-colors",
                  viewMode === "3d"
                    ? "bg-[#6633EE] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                3D Avatar
              </button>
              <button
                type="button"
                onClick={() => setViewMode("2d")}
                className={cn(
                  "cursor-pointer rounded-md px-2 py-0.5 text-xs font-semibold transition-colors",
                  viewMode === "2d"
                    ? "bg-[#6633EE] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                2D Zones
              </button>
            </div>
          )}

          {isEmpty ? (
            <Badge variant="neutral" size="sm">
              No Profile Yet
            </Badge>
          ) : isComplete ? (
            <Badge variant="success" size="sm">
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              {completedCount}/{totalCount} Zones Active
            </Badge>
          ) : (
            <Badge variant="warning" size="sm">
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              Incomplete ({completedCount}/{totalCount})
            </Badge>
          )}
        </div>
      </div>

      {/* Honest 503 / Offline Banner (DEC-005) */}
      {avatarServiceOffline && (
        <div
          role="status"
          aria-live="polite"
          className="mt-3 rounded-2xl border border-amber-300 bg-amber-50/95 p-3.5 text-xs text-amber-950 shadow-2xs"
        >
          <div className="flex items-center gap-2 font-bold text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>Avatar service offline — Using deterministic fit preview</span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-amber-800">
            The 3D avatar engine is temporarily unavailable (DEC-005: Never present
            fallback output as a real avatar). The silhouette below is an
            illustrative 2D proportional guide based on your entered measurements,
            not an anatomical 3D scan.
          </p>
        </div>
      )}

      {/* Generate 3D Avatar Prompt when profile exists */}
      {hasSavedProfile && !avatarId && !avatarServiceOffline && !isEditing && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-200 bg-violet-50/80 p-3.5">
          <div>
            <p className="text-xs font-bold text-slate-900">
              Generate 3D Avatar (SMPL Mesh)
            </p>
            <p className="text-[11px] text-slate-600">
              Calibrate an interactive 3D avatar with A-Pose and T-Pose from your measurements.
            </p>
          </div>
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
        </div>
      )}

      {/* Empty State when no profile exists & nothing typed */}
      {isEmpty ? (
        <div className="my-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-violet-200 bg-white/85 px-5 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-[#6633EE]">
            <User className="h-7 w-7" aria-hidden="true" />
          </div>
          <p className="mt-3 text-sm font-extrabold text-slate-950">
            No Body Profile Saved Yet
          </p>
          <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-600">
            {isEditing
              ? "Enter your measurements in the form or apply Smart Estimate to preview your illustrative fit zones here."
              : "Create your Body Profile to unlock personalized Fit Intelligence scores, Digital Avatar zone mapping, and CUSTOMFIT sizing."}
          </p>
        </div>
      ) : is3DActive && effectiveAvatarId ? (
        <>
          <Avatar3DViewer avatarId={effectiveAvatarId} garmentUrl={garmentPanelDressedUrl} className="mt-4" />
          {/* Garment Panel */}
          <section
            aria-labelledby="garment-panel-heading"
            className="mt-4 space-y-4 rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-2xs"
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
                htmlFor="garment-panel-type-bp"
                className="block text-xs font-bold text-slate-800"
              >
                Garment Type
              </label>
              <select
                id="garment-panel-type-bp"
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
                htmlFor="garment-panel-catalogue-bp"
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
                  id="garment-panel-catalogue-bp"
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
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
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
          </section>
        </>
      ) : (
        <>
          {/* 2D SVG Mannequin + Zone Guides */}
          <div className="relative mt-4 flex flex-col items-center justify-center rounded-2xl border border-violet-100 bg-white/90 px-4 py-5 shadow-2xs">
            <svg
              viewBox="0 0 220 330"
              className="h-64 w-auto sm:h-72"
              role="img"
              aria-label="Illustrative 2D fashion tailoring silhouette showing height, shoulder, chest, waist, hip, sleeve, and inseam measurement zones"
            >
              <defs>
                <linearGradient
                  id="ph5dAvatarGrad"
                  x1="0%"
                  y1="0%"
                  x2="0%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#EDE9FE" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#DDD6FE" stopOpacity="0.9" />
                </linearGradient>
              </defs>

              {/* Height vertical axis (left) */}
              <line
                x1="20"
                y1="22"
                x2="20"
                y2="308"
                stroke={activeZone === "heightCm" ? "#6633EE" : "#CBD5E1"}
                strokeWidth={activeZone === "heightCm" ? 2.5 : 1.5}
                strokeDasharray="4 3"
              />
              <line
                x1="15"
                y1="22"
                x2="25"
                y2="22"
                stroke={activeZone === "heightCm" ? "#6633EE" : "#CBD5E1"}
                strokeWidth={2}
              />
              <line
                x1="15"
                y1="308"
                x2="25"
                y2="308"
                stroke={activeZone === "heightCm" ? "#6633EE" : "#CBD5E1"}
                strokeWidth={2}
              />

              {/* Head */}
              <circle
                cx={cx}
                cy="38"
                r="16"
                fill="url(#ph5dAvatarGrad)"
                stroke="#7C3AED"
                strokeWidth="1.5"
              />

              {/* Proportional Body Silhouette */}
              <path
                d={`
                  M ${sL} 74
                  C ${sL} 64, ${sR} 64, ${sR} 74
                  L ${sR + 12} 166
                  L ${sR - 2} 168
                  L ${cR + 4} 102
                  L ${cR} 112
                  Q ${wR + 2} 142, ${wR} 150
                  Q ${hR} 174, ${hR - 2} 194
                  L ${cx + 22} 304
                  L ${cx + 6} 304
                  L ${cx} 214
                  L ${cx - 6} 304
                  L ${cx - 22} 304
                  L ${hL + 2} 194
                  Q ${hL} 174, ${wL} 150
                  Q ${wL - 2} 142, ${cL} 112
                  L ${cL - 4} 102
                  L ${sL + 2} 168
                  L ${sL - 12} 166
                  Z
                `}
                fill="url(#ph5dAvatarGrad)"
                stroke="#7C3AED"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />

              {/* Shoulder Zone */}
              <line
                x1={sL}
                y1="72"
                x2={sR}
                y2="72"
                stroke={activeZone === "shoulderCm" ? "#6633EE" : "#4C1D95"}
                strokeWidth={activeZone === "shoulderCm" ? 3 : 1.5}
                strokeDasharray={activeZone === "shoulderCm" ? undefined : "3 3"}
              />

              {/* Chest Zone */}
              <ellipse
                cx={cx}
                cy="108"
                rx={chestHalf + 3}
                ry="7"
                fill="none"
                stroke={activeZone === "chestCm" ? "#6633EE" : "#7C3AED"}
                strokeWidth={activeZone === "chestCm" ? 2.75 : 1.3}
                strokeDasharray={activeZone === "chestCm" ? undefined : "4 3"}
              />

              {/* Waist Zone */}
              <ellipse
                cx={cx}
                cy="148"
                rx={waistHalf + 2}
                ry="6"
                fill="none"
                stroke={activeZone === "waistCm" ? "#6633EE" : "#7C3AED"}
                strokeWidth={activeZone === "waistCm" ? 2.75 : 1.3}
                strokeDasharray={activeZone === "waistCm" ? undefined : "4 3"}
              />

              {/* Hip Zone */}
              <ellipse
                cx={cx}
                cy="184"
                rx={hipHalf + 3}
                ry="7"
                fill="none"
                stroke={activeZone === "hipCm" ? "#6633EE" : "#7C3AED"}
                strokeWidth={activeZone === "hipCm" ? 2.75 : 1.3}
                strokeDasharray={activeZone === "hipCm" ? undefined : "4 3"}
              />

              {/* Sleeve Line (Right arm outer line) */}
              <line
                x1={sR + 4}
                y1="74"
                x2={sR + 16}
                y2="166"
                stroke={activeZone === "sleeveCm" ? "#6633EE" : "#94A3B8"}
                strokeWidth={activeZone === "sleeveCm" ? 3 : 1.5}
                strokeDasharray={activeZone === "sleeveCm" ? undefined : "3 3"}
              />

              {/* Inseam Line (Inner leg) */}
              <line
                x1={cx + 3}
                y1="214"
                x2={cx + 8}
                y2="304"
                stroke={activeZone === "inseamCm" ? "#6633EE" : "#64748B"}
                strokeWidth={activeZone === "inseamCm" ? 3 : 1.5}
                strokeDasharray={activeZone === "inseamCm" ? undefined : "3 3"}
              />
            </svg>

            {/* Active Zone Callout */}
            <div className="mt-3 flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-violet-200 bg-violet-50/70 px-3.5 py-2.5 text-xs">
              <div>
                <span className="font-bold text-[#4C1D95]">
                  {activeMeta.label} Zone
                </span>
                <p className="text-[11px] text-slate-600">
                  {activeMeta.guidance}
                </p>
              </div>
              <Badge variant={activeValueCm ? "default" : "warning"} size="sm">
                {activeDisplayValue}
              </Badge>
            </div>
          </div>

          {/* Interactive Zone Chips */}
          <div className="mt-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Select Zone to Highlight
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {MEASUREMENT_FIELDS.map((field) => {
                const val = metricsCm[field.key];
                const isSelected = activeZone === field.key;
                return (
                  <button
                    key={field.key}
                    type="button"
                    onClick={() => onSelectZone(field.key)}
                    aria-pressed={isSelected}
                    className={cn(
                      "cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6633EE]",
                      isSelected
                        ? "border-[#6633EE] bg-[#6633EE] text-white shadow-2xs"
                        : val
                        ? "border-violet-200 bg-white text-slate-800 hover:border-[#6633EE]/50"
                        : "border-amber-200 bg-amber-50/80 text-amber-900 hover:border-amber-400"
                    )}
                  >
                    {field.shortLabel}:{" "}
                    {val ? `${formatLengthFromCm(val, unit)} ${unit}` : "Missing"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Missing Zones Notice if Incomplete */}
          {!isComplete && (
            <div className="mt-3.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900">
              <p className="font-bold">Incomplete Measurements</p>
              <p className="mt-0.5 text-[11px]">
                Missing: {missingFields.map((f) => f.label).join(", ")}. Complete
                all 7 required zones for accurate Fit Intelligence scoring.
              </p>
            </div>
          )}
        </>
      )}

      {/* Create from photos section */}
      <section
        aria-labelledby="create-from-photos-heading"
        className="mt-4 rounded-2xl border border-violet-200/80 bg-white/95 p-4 shadow-2xs space-y-3"
      >
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-[#6633EE]" aria-hidden="true" />
          <h3
            id="create-from-photos-heading"
            className="text-xs font-bold text-slate-900"
          >
            Create from photos
          </h3>
        </div>

        <form onSubmit={handlePhotoUpload} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="photo-front"
                className="block text-xs font-semibold text-slate-700"
              >
                Front photo <span className="text-red-500">*</span>
              </label>
              <input
                id="photo-front"
                type="file"
                accept="image/jpeg,image/png"
                required
                onChange={(e) => {
                  setFrontFile(e.target.files?.[0] ?? null);
                  setPhotoUploadError(null);
                }}
                disabled={isUploadingPhotos}
                className="mt-1 block w-full text-xs text-slate-600 file:mr-2 file:cursor-pointer file:rounded-lg file:border-0 file:bg-violet-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#6633EE] hover:file:bg-violet-200 focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="photo-side"
                className="block text-xs font-semibold text-slate-700"
              >
                Side photo <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                id="photo-side"
                type="file"
                accept="image/jpeg,image/png"
                onChange={(e) => {
                  setSideFile(e.target.files?.[0] ?? null);
                  setPhotoUploadError(null);
                }}
                disabled={isUploadingPhotos}
                className="mt-1 block w-full text-xs text-slate-600 file:mr-2 file:cursor-pointer file:rounded-lg file:border-0 file:bg-violet-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#6633EE] hover:file:bg-violet-200 focus:outline-none"
              />
            </div>
          </div>

          {/* Optional Calibration Inputs matching Engine Demo */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-1 border-t border-slate-100">
            {/* Body Model */}
            <div>
              <label
                htmlFor="photo-body-model"
                className="block text-xs font-semibold text-slate-700"
              >
                Body Model
              </label>
              <select
                id="photo-body-model"
                value={photoGender}
                onChange={(e) =>
                  setPhotoGender(e.target.value as PhotoBodyModelOption)
                }
                disabled={isUploadingPhotos}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-[#6633EE] focus:outline-none focus:ring-2 focus:ring-[#6633EE]/20"
              >
                <option value="neutral">Neutral</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>

            {/* Height with cm / ft-in toggle */}
            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor={
                    photoHeightUnit === "cm" ? "photo-height-cm" : "photo-height-ft"
                  }
                  className="block text-xs font-semibold text-slate-700"
                >
                  Height ({photoHeightUnit === "cm" ? "cm" : "ft / in"})
                </label>
                <div
                  className="inline-flex rounded-md border border-slate-200 bg-slate-100 p-0.5 text-[10px] font-bold"
                  role="group"
                  aria-label="Height unit"
                >
                  <button
                    type="button"
                    aria-pressed={photoHeightUnit === "cm"}
                    onClick={() => handlePhotoHeightUnitSwitch("cm")}
                    disabled={isUploadingPhotos}
                    className={cn(
                      "cursor-pointer rounded px-1.5 py-0.5 transition-colors",
                      photoHeightUnit === "cm"
                        ? "bg-[#6633EE] text-white"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    cm
                  </button>
                  <button
                    type="button"
                    aria-pressed={photoHeightUnit === "ft-in"}
                    onClick={() => handlePhotoHeightUnitSwitch("ft-in")}
                    disabled={isUploadingPhotos}
                    className={cn(
                      "cursor-pointer rounded px-1.5 py-0.5 transition-colors",
                      photoHeightUnit === "ft-in"
                        ? "bg-[#6633EE] text-white"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    ft / in
                  </button>
                </div>
              </div>
              {photoHeightUnit === "cm" ? (
                <div className="relative mt-1">
                  <input
                    id="photo-height-cm"
                    type="number"
                    step="0.5"
                    min="130"
                    max="220"
                    placeholder="172"
                    value={photoHeightCm}
                    onChange={(e) => {
                      setPhotoHeightTouched(true);
                      setPhotoHeightCm(e.target.value);
                      setPhotoUploadError(null);
                    }}
                    disabled={isUploadingPhotos}
                    className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-2.5 pr-8 text-xs text-slate-900 focus:border-[#6633EE] focus:outline-none focus:ring-2 focus:ring-[#6633EE]/20"
                  />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">
                    cm
                  </span>
                </div>
              ) : (
                <div className="mt-1 grid grid-cols-2 gap-1.5">
                  <div className="relative">
                    <input
                      id="photo-height-ft"
                      type="number"
                      step="1"
                      min="4"
                      max="7"
                      placeholder="5"
                      aria-label="Height feet"
                      value={photoHeightFt}
                      onChange={(e) => {
                        setPhotoHeightTouched(true);
                        setPhotoHeightFt(e.target.value);
                        setPhotoUploadError(null);
                      }}
                      disabled={isUploadingPhotos}
                      className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-2.5 pr-6 text-xs text-slate-900 focus:border-[#6633EE] focus:outline-none focus:ring-2 focus:ring-[#6633EE]/20"
                    />
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">
                      ft
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      id="photo-height-in"
                      type="number"
                      step="0.5"
                      min="0"
                      max="11.5"
                      placeholder="8"
                      aria-label="Height inches"
                      value={photoHeightIn}
                      onChange={(e) => {
                        setPhotoHeightTouched(true);
                        setPhotoHeightIn(e.target.value);
                        setPhotoUploadError(null);
                      }}
                      disabled={isUploadingPhotos}
                      className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-2.5 pr-6 text-xs text-slate-900 focus:border-[#6633EE] focus:outline-none focus:ring-2 focus:ring-[#6633EE]/20"
                    />
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">
                      in
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Weight with kg / lb toggle */}
            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="photo-weight"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Weight ({photoWeightUnit})
                </label>
                <div
                  className="inline-flex rounded-md border border-slate-200 bg-slate-100 p-0.5 text-[10px] font-bold"
                  role="group"
                  aria-label="Weight unit"
                >
                  <button
                    type="button"
                    aria-pressed={photoWeightUnit === "kg"}
                    onClick={() => handlePhotoWeightUnitSwitch("kg")}
                    disabled={isUploadingPhotos}
                    className={cn(
                      "cursor-pointer rounded px-1.5 py-0.5 transition-colors",
                      photoWeightUnit === "kg"
                        ? "bg-[#6633EE] text-white"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    kg
                  </button>
                  <button
                    type="button"
                    aria-pressed={photoWeightUnit === "lb"}
                    onClick={() => handlePhotoWeightUnitSwitch("lb")}
                    disabled={isUploadingPhotos}
                    className={cn(
                      "cursor-pointer rounded px-1.5 py-0.5 transition-colors",
                      photoWeightUnit === "lb"
                        ? "bg-[#6633EE] text-white"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    lb
                  </button>
                </div>
              </div>
              <div className="relative mt-1">
                <input
                  id="photo-weight"
                  type="number"
                  step="0.5"
                  min={photoWeightUnit === "kg" ? "30" : "66"}
                  max={photoWeightUnit === "kg" ? "200" : "441"}
                  placeholder={photoWeightUnit === "kg" ? "e.g. 55" : "e.g. 121"}
                  value={photoWeight}
                  onChange={(e) => {
                    setPhotoWeightTouched(true);
                    setPhotoWeight(e.target.value);
                    setPhotoUploadError(null);
                  }}
                  disabled={isUploadingPhotos}
                  className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-2.5 pr-8 text-xs text-slate-900 focus:border-[#6633EE] focus:outline-none focus:ring-2 focus:ring-[#6633EE]/20"
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">
                  {photoWeightUnit}
                </span>
              </div>
            </div>

            {/* Clothing in Photo */}
            <div>
              <label
                htmlFor="photo-clothing-fit"
                className="block text-xs font-semibold text-slate-700"
              >
                Clothing in Photo
              </label>
              <select
                id="photo-clothing-fit"
                value={photoClothingFit}
                onChange={(e) =>
                  setPhotoClothingFit(e.target.value as PhotoClothingFitOption)
                }
                disabled={isUploadingPhotos}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-[#6633EE] focus:outline-none focus:ring-2 focus:ring-[#6633EE]/20"
              >
                <option value="fitted">Fitted (tight)</option>
                <option value="regular">Regular</option>
                <option value="loose">Loose / baggy</option>
              </select>
            </div>

            {/* Body Build Hint */}
            <div className="sm:col-span-2">
              <label
                htmlFor="photo-build-type"
                className="block text-xs font-semibold text-slate-700"
              >
                Body Build Hint
              </label>
              <select
                id="photo-build-type"
                value={photoBuildType}
                onChange={(e) =>
                  setPhotoBuildType(e.target.value as PhotoBuildTypeOption)
                }
                disabled={isUploadingPhotos}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-[#6633EE] focus:outline-none focus:ring-2 focus:ring-[#6633EE]/20"
              >
                <option value="slim">Slim / lean</option>
                <option value="average">Average</option>
                <option value="athletic">Athletic (broad chest, trim waist)</option>
                <option value="broad">Broad / stocky</option>
              </select>
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            Photos are sent to the avatar engine, not stored
          </p>

          {photoUploadError && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50/90 p-2.5 text-xs text-red-900"
            >
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-600" />
                <span>{photoUploadError}</span>
              </div>
            </div>
          )}

          <Button
            type="submit"
            disabled={isUploadingPhotos || !frontFile}
            className="w-full cursor-pointer bg-[#6633EE] hover:bg-[#5522DD] text-white font-semibold text-xs py-2"
          >
            {isUploadingPhotos ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                This can take up to a minute
              </>
            ) : (
              <>
                <Upload className="mr-2 h-3.5 w-3.5" />
                Upload
              </>
            )}
          </Button>
        </form>
      </section>

      {/* Available Profile Summary Tags */}
      <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-violet-100 bg-white/85 p-3.5 text-xs sm:grid-cols-3">
        <div>
          <span className="text-[11px] font-medium text-slate-500">
            Preferred Fit
          </span>
          <p className="font-bold capitalize text-slate-950">
            {fitPreference} (+{easeCm} cm)
          </p>
        </div>
        <div>
          <span className="text-[11px] font-medium text-slate-500">
            Body Type
          </span>
          <p className="font-bold capitalize text-slate-950">
            {bodyType ? bodyType.replace("-", " ") : "Not specified"}
          </p>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <span className="text-[11px] font-medium text-slate-500">
            Weight (Optional)
          </span>
          <p className="font-bold text-slate-950">
            {weightKg?.trim() ? `${weightKg} kg` : "Optional"}
          </p>
        </div>
      </div>

      {/* Honest Disclaimer */}
      <div className="mt-3.5 flex items-start gap-2 text-[11px] leading-relaxed text-slate-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#6633EE]" aria-hidden="true" />
        <p>
          Illustrative 2D proportion guide only — not a 3D body scan or exact
          anatomical reconstruction.
        </p>
      </div>
    </div>
  );
}
