"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, LogIn, Sparkles, User } from "lucide-react";
import { useFitloom } from "@/components/providers/fitloom-provider";
import {
  Avatar3DViewer,
  type Avatar3DViewerProps,
} from "@/components/avatar/Avatar3DViewer";
import { AvatarTryOnControls } from "@/components/avatar/AvatarTryOnControls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import type {
  AvatarSizeItem,
  FitPreferenceAvatarOption,
} from "@/lib/api/types";
import {
  FABRIC_COLOR_OPTIONS,
  type AvatarGarmentSize,
  type GarmentViewMode,
} from "@/lib/garments";
import {
  resolveProductTryOnPanelStatus,
  fetchProductTryOnSizing,
  dressProductOnAvatar,
  type ProductTryOnPanelStatus,
} from "@/lib/product-tryon";

export {
  resolveProductTryOnPanelStatus,
  fetchProductTryOnSizing,
  dressProductOnAvatar,
  type ProductTryOnPanelStatus,
};

export interface ProductAvatarTryOnPanelProps {
  category: string | null | undefined;
  productName: string;
  swatchHex?: string;
  isAuthenticatedOverride?: boolean;
  avatarIdOverride?: string | null;
  avatarServiceOfflineOverride?: boolean;
  initialSizesOverride?: AvatarSizeItem[];
  initialRecommendedSizeOverride?: string | null;
  initialDressedUrlOverride?: string | null;
  viewerComponentOverride?: React.ComponentType<Avatar3DViewerProps>;
}

export function ProductAvatarTryOnPanel({
  category,
  productName,
  swatchHex,
  isAuthenticatedOverride,
  avatarIdOverride,
  avatarServiceOfflineOverride,
  initialSizesOverride,
  initialRecommendedSizeOverride,
  initialDressedUrlOverride,
  viewerComponentOverride,
}: ProductAvatarTryOnPanelProps) {
  let contextUser: { id?: string; role?: string } | null = null;
  let contextAvatarId: string | null = null;
  let contextOffline = false;
  let contextFitPref: FitPreferenceAvatarOption = "regular";
  let contextCheckStatus: (() => Promise<boolean>) | null = null;
  let contextToast: ((input: {
    type?: "info" | "success" | "warning" | "error";
    title: string;
    message: string;
  }) => void) | null = null;

  try {
    const fitloom = useFitloom();
    contextUser = fitloom.user;
    contextAvatarId = fitloom.avatarId;
    contextOffline = fitloom.avatarServiceOffline;
    contextFitPref =
      (fitloom.bodyProfile?.fitPreference as FitPreferenceAvatarOption) ||
      "regular";
    contextCheckStatus = fitloom.checkAvatarStatus;
    contextToast = fitloom.toast;
  } catch {
    // Allows isolated rendering in unit tests when overrides are passed
  }

  const isAuthenticated =
    isAuthenticatedOverride !== undefined
      ? isAuthenticatedOverride
      : Boolean(contextUser?.id && contextUser.role !== "guest");

  const effectiveAvatarId =
    avatarIdOverride !== undefined ? avatarIdOverride : contextAvatarId;

  const [localOffline, setLocalOffline] = useState<boolean>(false);
  const effectiveOffline =
    avatarServiceOfflineOverride !== undefined
      ? avatarServiceOfflineOverride
      : contextOffline || localOffline;

  const { status, garmentType } = resolveProductTryOnPanelStatus({
    category,
    isAuthenticated,
    avatarId: effectiveAvatarId,
    avatarServiceOffline: effectiveOffline,
  });

  const defaultColor =
    swatchHex && /^#[0-9a-fA-F]{6}$/.test(swatchHex)
      ? swatchHex
      : FABRIC_COLOR_OPTIONS[0].hex;

  const [fitPreference, setFitPreference] =
    useState<FitPreferenceAvatarOption>(contextFitPref);
  const [availableSizes, setAvailableSizes] = useState<AvatarSizeItem[]>(
    initialSizesOverride ?? []
  );
  const [recommendedSize, setRecommendedSize] =
    useState<AvatarGarmentSize | null>(
      initialRecommendedSizeOverride !== undefined
        ? initialRecommendedSizeOverride
        : null
    );
  const [selectedSize, setSelectedSize] = useState<AvatarGarmentSize>(
    initialRecommendedSizeOverride ||
      initialSizesOverride?.[0]?.size ||
      "M"
  );
  const [sizingLoading, setSizingLoading] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<GarmentViewMode>("fabric");
  const [colorHex, setColorHex] = useState<string>(defaultColor);
  const [dressingLoading, setDressingLoading] = useState<boolean>(false);
  const [dressedUrl, setDressedUrl] = useState<string | null>(
    initialDressedUrlOverride ?? null
  );
  const [panelError, setPanelError] = useState<string | null>(null);

  useEffect(() => {
    if (
      isAuthenticated &&
      avatarServiceOfflineOverride === undefined &&
      contextCheckStatus
    ) {
      contextCheckStatus();
    }
  }, [isAuthenticated, avatarServiceOfflineOverride, contextCheckStatus]);

  useEffect(() => {
    if (status !== "ready" || !effectiveAvatarId || !garmentType) {
      if (!initialSizesOverride) {
        setAvailableSizes([]);
        setRecommendedSize(null);
      }
      return;
    }

    let cancelled = false;
    setSizingLoading(true);
    setPanelError(null);

    fetchProductTryOnSizing({
      avatarId: effectiveAvatarId,
      garmentType,
      fitPreference,
    })
      .then((res) => {
        if (cancelled) return;
        const sizes = res.sizes || [];
        setAvailableSizes(sizes);
        const rec = res.recommended_size || null;
        setRecommendedSize(rec);
        setSelectedSize((prev) => {
          if (sizes.some((s) => s.size === prev)) return prev;
          return rec || sizes[0]?.size || "M";
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setAvailableSizes([]);
        setRecommendedSize(null);
        if (err instanceof ApiError) {
          if (err.status === 503 || err.code === "SERVICE_UNAVAILABLE") {
            setLocalOffline(true);
            setPanelError("Avatar service offline");
          } else if (err.status === 404) {
            setPanelError("Create your avatar first");
          } else {
            setPanelError(err.message || "Failed to load sizes from avatar engine.");
          }
        } else {
          setLocalOffline(true);
          setPanelError("Avatar service offline");
        }
      })
      .finally(() => {
        if (!cancelled) setSizingLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    status,
    effectiveAvatarId,
    garmentType,
    fitPreference,
    initialSizesOverride,
  ]);

  const handleDressAvatar = useCallback(async () => {
    if (!effectiveAvatarId || !garmentType) {
      setPanelError("Create your avatar first");
      return;
    }
    if (effectiveOffline) {
      setPanelError("Avatar service offline");
      return;
    }

    setDressingLoading(true);
    setPanelError(null);

    try {
      const { dressedUrl: nextUrl } = await dressProductOnAvatar({
        avatarId: effectiveAvatarId,
        garmentType,
        size: selectedSize,
        fitPreference,
        colorHex,
        viewMode,
      });
      setDressedUrl(nextUrl);
      contextToast?.({
        type: "success",
        title: "Avatar Dressed",
        message: `${productName} (Size ${selectedSize}) applied to your 3D avatar.`,
      });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 503 || err.code === "SERVICE_UNAVAILABLE") {
          setLocalOffline(true);
          setPanelError("Avatar service offline");
        } else if (err.status === 404) {
          setPanelError("Create your avatar first");
        } else {
          setPanelError(err.message || "Failed to dress avatar.");
        }
      } else {
        setLocalOffline(true);
        setPanelError("Avatar service offline");
      }
    } finally {
      setDressingLoading(false);
    }
  }, [
    effectiveAvatarId,
    garmentType,
    effectiveOffline,
    selectedSize,
    fitPreference,
    colorHex,
    viewMode,
    productName,
    contextToast,
  ]);

  const handleRemoveGarment = useCallback(() => {
    setDressedUrl(null);
    contextToast?.({
      type: "info",
      title: "Garment Removed",
      message: "The garment has been removed from your avatar.",
    });
  }, [contextToast]);

  // Unmapped category -> show NO panel
  if (status === "unmapped" || !garmentType) {
    return null;
  }

  const ViewerComponent = viewerComponentOverride ?? Avatar3DViewer;

  return (
    <section
      id="try-on-my-avatar"
      aria-labelledby="product-try-on-heading"
      className="space-y-5 rounded-3xl border border-violet-200/80 bg-gradient-to-b from-white via-[#FAF7FF] to-violet-50/60 p-6 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-violet-100 pb-4">
        <div>
          <h2
            id="product-try-on-heading"
            className="flex items-center gap-2 text-lg font-extrabold text-slate-950"
          >
            <Sparkles className="h-4 w-4 text-[#6633EE]" aria-hidden="true" />
            Try on my avatar
          </h2>
          <p className="mt-0.5 text-xs text-slate-600">
            Drape <strong>{productName}</strong> on your 3D SMPL avatar and
            evaluate live engine size scores.
          </p>
        </div>
        <Badge variant="default" size="sm">
          3D Avatar Engine
        </Badge>
      </div>

      {status === "unauthenticated" && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-violet-200 bg-white/95 p-5 text-xs text-slate-700"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-[#6633EE]">
              <LogIn className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-950">
                Sign in to try on your avatar
              </p>
              <p className="mt-0.5 text-xs text-slate-600">
                Log in to your customer account to load your 3D avatar and see
                personalized engine size scores.
              </p>
            </div>
          </div>
          <Link href="/auth/login">
            <Button size="sm">
              Sign in
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </Link>
        </div>
      )}

      {status === "offline" && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50/95 p-4 text-xs text-amber-950"
        >
          <AlertTriangle
            className="h-5 w-5 shrink-0 text-amber-600"
            aria-hidden="true"
          />
          <div>
            <p className="font-bold text-amber-900">Avatar service offline</p>
            <p className="mt-0.5 text-[11px] text-amber-800">
              The 3D avatar engine is temporarily unavailable. Live 3D try-on
              and engine sizing cannot be loaded right now.
            </p>
          </div>
        </div>
      )}

      {status === "no_avatar" && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-5 text-xs text-amber-950"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <User className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-950">
                Create your avatar first
              </p>
              <p className="mt-0.5 text-xs text-amber-800">
                Generate your 3D avatar from your measurements or photos on your
                Body Profile before trying on garments.
              </p>
            </div>
          </div>
          <Link href="/body-profile">
            <Button size="sm">
              Create your avatar first
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </Link>
        </div>
      )}

      {status === "ready" && effectiveAvatarId && (
        <div className="grid items-start gap-6 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <ViewerComponent
              avatarId={effectiveAvatarId}
              garmentUrl={dressedUrl}
            />
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-2xs lg:col-span-6">
            <AvatarTryOnControls
              availableSizes={availableSizes}
              selectedSize={selectedSize}
              recommendedSize={recommendedSize}
              onSelectSize={setSelectedSize}
              sizingLoading={sizingLoading}
              fitPreference={fitPreference}
              onSelectFitPreference={setFitPreference}
              viewMode={viewMode}
              onSelectViewMode={setViewMode}
              colorHex={colorHex}
              onSelectColorHex={setColorHex}
              onDress={handleDressAvatar}
              onRemoveGarment={handleRemoveGarment}
              dressingLoading={dressingLoading}
              dressDisabled={
                dressingLoading ||
                sizingLoading ||
                availableSizes.length === 0 ||
                effectiveOffline
              }
              hasDressedGarment={Boolean(dressedUrl)}
              avatarServiceOffline={effectiveOffline}
              hasAvatar={Boolean(effectiveAvatarId)}
            />

            {panelError && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
              >
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{panelError}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
