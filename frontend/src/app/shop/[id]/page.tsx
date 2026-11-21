"use client";

import React, { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  GitCompare,
  Heart,
  Info,
  Layers,
  Palette,
  RotateCcw,
  Ruler,
  Scissors,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  Star,
} from "lucide-react";
import { MockGarment, GarmentType } from "@/lib/mock-data";
import { api, type ProductDetailItem, ApiError } from "@/lib/api";
import {
  MeasurementUnit,
  formatLengthFromCm,
} from "@/lib/body-profile-utils";
import {
  GarmentSize,
  getGarmentMeasurementSummary,
  getRelatedGarments,
} from "@/lib/shop-utils";
import { useFitloom } from "@/components/providers/fitloom-provider";
import { ProductAvatarTryOnPanel } from "@/components/avatar/ProductAvatarTryOnPanel";
import { ProductCard } from "@/components/shop/ProductCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { mapCategoryToGarmentType } from "@/lib/garments";
import { cn } from "@/lib/utils";

type GalleryViewId = "photo" | "swatch";

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const {
    eligibleCustomerGarments,
    addToCart,
    cartCount,
    wishlistIds,
    toggleWishlist,
    compareIds,
    toggleCompare,
    toast,
  } = useFitloom();

  const [productDetail, setProductDetail] = useState<ProductDetailItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState<boolean>(false);

  const fetchProduct = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setIsNotFound(false);
    try {
      const res = await api.getProduct(id);
      if (res?.product) {
        setProductDetail(res.product);
      } else {
        setIsNotFound(true);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setIsNotFound(true);
      } else {
        const msg =
          err instanceof Error ? err.message : "Failed to load product.";
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  const garment = useMemo<MockGarment | null>(() => {
    if (!productDetail) return null;
    return {
      id: productDetail.id,
      name: productDetail.name,
      category: productDetail.category as MockGarment["category"],
      garmentType: (productDetail.garmentType as GarmentType) ?? undefined,
      fitType: productDetail.fitType as MockGarment["fitType"],
      occasion: productDetail.occasion as MockGarment["occasion"],
      color: productDetail.color,
      swatchHex: productDetail.swatchHex,
      image: productDetail.imageUrl ?? undefined,
      fabric: productDetail.fabric,
      stretchNote: productDetail.stretchNote,
      priceInr: productDetail.priceInr,
      rating: productDetail.ratingAvg,
      reviewCount: productDetail.reviewCount,
      sizes: productDetail.sizes as GarmentSize[],
      chestMapCm: productDetail.chestMapCm as Record<GarmentSize, number>,
      waistMapCm: productDetail.waistMapCm as Record<GarmentSize, number>,
      description: productDetail.description ?? "",
    };
  }, [productDetail]);

  // Explicit size selection — never pre-selects a guessed default size
  const [selectedSize, setSelectedSize] = useState<GarmentSize | null>(null);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<GalleryViewId>("photo");
  const [imgError, setImgError] = useState(false);
  const [unit, setUnit] = useState<MeasurementUnit>("cm");
  const [justAdded, setJustAdded] = useState(false);

  const addTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset product-specific state when navigating between products
  useEffect(() => {
    setSelectedSize(null);
    setSizeError(null);
    setActiveView("photo");
    setImgError(false);
    setJustAdded(false);
  }, [id]);

  useEffect(() => {
    return () => {
      if (addTimerRef.current) clearTimeout(addTimerRef.current);
    };
  }, []);

  // Loading State
  if (loading) {
    return (
      <div
        role="status"
        className="mx-auto max-w-xl space-y-6 py-16 text-center"
      >
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-violet-200 border-t-[#6633EE]" />
        <p className="text-sm font-semibold text-slate-700">
          Loading product details...
        </p>
      </div>
    );
  }

  // Error State with Retry
  if (error) {
    return (
      <div
        role="alert"
        className="mx-auto max-w-xl space-y-6 py-12 text-center"
      >
        <div className="rounded-3xl border border-red-200 bg-red-50/80 p-8 shadow-xs sm:p-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600">
            <AlertTriangle className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold text-red-950">
            Failed to Load Product
          </h1>
          <p className="mt-2 text-sm text-red-700">{error}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button
              type="button"
              onClick={fetchProduct}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Retry
            </Button>
            <Link href="/shop">
              <Button variant="outline">Back to Shop Catalogue</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Section 11: Dedicated Not-Found State (no silent fallback to MOCK_GARMENTS[0])
  if (isNotFound || !garment) {
    return (
      <div className="mx-auto max-w-xl space-y-6 py-8">
        <nav aria-label="Breadcrumb" className="text-xs text-slate-500">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/" className="hover:text-[#6633EE]">
                Home
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="h-3.5 w-3.5" />
            </li>
            <li>
              <Link href="/shop" className="hover:text-[#6633EE]">
                Shop
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="h-3.5 w-3.5" />
            </li>
            <li aria-current="page" className="font-semibold text-slate-800">
              Product Not Found
            </li>
          </ol>
        </nav>

        <div className="rounded-3xl border border-dashed border-violet-200 bg-white/95 p-8 text-center shadow-xs sm:p-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <AlertTriangle className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold text-slate-950">
            Garment Not Found
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            No product matching{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-800">
              {id || "unknown"}
            </code>{" "}
            exists in the FITLOOM catalogue.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/shop">
              <Button>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back to Shop Catalogue
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="outline">Open Dashboard</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const hasValidPhoto = Boolean(garment.image) && !imgError;
  const effectiveGalleryView: GalleryViewId =
    hasValidPhoto && activeView === "photo" ? "photo" : "swatch";

  const specSummary = getGarmentMeasurementSummary(garment);
  const relatedGarments = getRelatedGarments(
    eligibleCustomerGarments,
    garment,
    3
  );
  const isWished = wishlistIds.includes(garment.id);
  const isCompared = compareIds.includes(garment.id);
  const compareLimitReached = !isCompared && compareIds.length >= 3;
  const hasAvailableSizes = garment.sizes.length > 0;
  const isCustomFitEligible = hasAvailableSizes && specSummary.hasSpecs;
  const mappedGarmentType = mapCategoryToGarmentType(garment.category);
  const isVtonEligible = mappedGarmentType !== null;

  function handleSelectSize(sz: GarmentSize) {
    setSelectedSize(sz);
    setSizeError(null);
  }

  function handleAddToCart() {
    if (!hasAvailableSizes) {
      setSizeError("This garment currently has no available sizes.");
      toast({
        type: "error",
        title: "Size Unavailable",
        message: "This garment has no available sizes to add to your bag.",
      });
      return;
    }

    if (!selectedSize || !garment?.sizes.includes(selectedSize)) {
      setSizeError(
        "Please select a size above before adding this garment to your bag."
      );
      toast({
        type: "warning",
        title: "Select a Size First",
        message: `Choose one of the available sizes (${garment?.sizes.join(", ")}) before adding to bag.`,
      });
      return;
    }

    setSizeError(null);
    addToCart({
      garmentId: garment.id,
      name: garment.name,
      size: selectedSize,
      priceInr: garment.priceInr,
    });
    setJustAdded(true);
    if (addTimerRef.current) clearTimeout(addTimerRef.current);
    addTimerRef.current = setTimeout(() => setJustAdded(false), 1800);

    toast({
      type: "success",
      title: "Added to Bag",
      message: `${garment.name} (Size ${selectedSize}) added to your shopping bag.`,
      action: { label: "View Cart", href: "/cart" },
    });
  }

  function handleToggleCurrentWishlist() {
    if (!garment) return;
    const removing = wishlistIds.includes(garment.id);
    toggleWishlist(garment.id);
    toast({
      type: removing ? "info" : "success",
      title: removing ? "Removed from Wishlist" : "Saved to Wishlist",
      message: `${garment.name} ${removing ? "removed from" : "saved to"} your wishlist.`,
      action: removing ? undefined : { label: "View Wishlist", href: "/wishlist" },
    });
  }

  function handleToggleCurrentCompare() {
    if (!garment) return;
    const removing = compareIds.includes(garment.id);
    const replacingOldest = !removing && compareIds.length >= 3;
    toggleCompare(garment.id);
    toast({
      type: removing ? "info" : "success",
      title: removing ? "Removed from Compare" : "Added to Compare",
      message: removing
        ? `${garment.name} removed from garment comparison.`
        : replacingOldest
        ? `3-product comparison limit reached — ${garment.name} replaced the oldest item.`
        : `${garment.name} added to garment comparison (${compareIds.length + 1}/3).`,
      action: removing ? undefined : { label: "Open Compare", href: "/compare" },
    });
  }

  function handleRelatedWishlist(item: MockGarment) {
    const removing = wishlistIds.includes(item.id);
    toggleWishlist(item.id);
    toast({
      type: removing ? "info" : "success",
      title: removing ? "Removed from Wishlist" : "Saved to Wishlist",
      message: `${item.name} ${removing ? "removed from" : "saved to"} your wishlist.`,
      action: removing ? undefined : { label: "View Wishlist", href: "/wishlist" },
    });
  }

  function handleRelatedCompare(item: MockGarment) {
    const removing = compareIds.includes(item.id);
    const replacingOldest = !removing && compareIds.length >= 3;
    toggleCompare(item.id);
    toast({
      type: removing ? "info" : "success",
      title: removing ? "Removed from Compare" : "Added to Compare",
      message: removing
        ? `${item.name} removed from comparison.`
        : replacingOldest
        ? `3-product limit reached — ${item.name} replaced the oldest comparison item.`
        : `${item.name} added to comparison.`,
      action: removing ? undefined : { label: "Open Compare", href: "/compare" },
    });
  }

  const selectedChestCm =
    selectedSize && garment.chestMapCm
      ? garment.chestMapCm[selectedSize]
      : undefined;
  const selectedWaistCm =
    selectedSize && garment.waistMapCm
      ? garment.waistMapCm[selectedSize]
      : undefined;

  return (
    <div className="space-y-10 pb-12">
      {/* 2A. Breadcrumb Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-violet-100 pb-4">
        <nav aria-label="Breadcrumb" className="min-w-0 text-xs text-slate-600">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link
                href="/"
                className="rounded font-medium hover:text-[#6633EE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6633EE]"
              >
                Home
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            </li>
            <li>
              <Link
                href="/shop"
                className="rounded font-medium hover:text-[#6633EE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6633EE]"
              >
                Shop
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            </li>
            <li>
              <Link
                href={`/shop?category=${encodeURIComponent(garment.category)}`}
                className="rounded font-medium hover:text-[#6633EE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6633EE]"
              >
                {garment.category}
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            </li>
            <li
              aria-current="page"
              className="truncate font-bold text-slate-950"
            >
              {garment.name}
            </li>
          </ol>
        </nav>

        <Link
          href="/shop"
          className="inline-flex items-center gap-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-[#6633EE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6633EE]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to Catalogue
        </Link>
      </div>

      {/* Main Product Section: Image Gallery (Left) + Product Info & Actions (Right) */}
      <div className="grid items-start gap-8 lg:grid-cols-12 lg:gap-10">
        {/* 2B. Product Image Gallery */}
        <section
          aria-label="Product Gallery"
          className="space-y-3.5 lg:col-span-6"
        >
          <div className="relative aspect-[4/4] w-full overflow-hidden rounded-3xl border border-violet-100 bg-gradient-to-br from-white via-violet-50/40 to-violet-100/60 shadow-xs">
            {effectiveGalleryView === "photo" && hasValidPhoto ? (
              <Image
                src={garment.image!}
                alt={`${garment.name} in ${garment.color} (${garment.fabric})`}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                onError={() => setImgError(true)}
                className="object-cover object-top"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-8 text-center">
                <div
                  className="h-36 w-32 rounded-3xl border border-black/10 shadow-md"
                  style={{ backgroundColor: garment.swatchHex || "#E2E8F0" }}
                  aria-hidden="true"
                />
                <div className="max-w-xs space-y-1">
                  <Badge variant="outline" size="sm">
                    Colour &amp; Fabric Swatch
                  </Badge>
                  <p className="text-base font-extrabold text-slate-950">
                    {garment.color || "Standard Swatch"}
                  </p>
                  <p className="text-xs text-slate-600">
                    {garment.fabric || "Fabric composition unavailable"}
                  </p>
                  {garment.stretchNote && (
                    <p className="text-[11px] text-slate-500">
                      {garment.stretchNote}
                    </p>
                  )}
                </div>
              </div>
            )}

            {hasValidPhoto && (
              <span className="sr-only">
                {effectiveGalleryView === "photo"
                  ? "Catalogue Image"
                  : "Colour Swatch View"}
              </span>
            )}
          </div>

          {/* Gallery View Selector (Truthful views only — never duplicate photo URLs) */}
          <div
            role="group"
            aria-label="Select product view"
            className="flex flex-wrap items-center gap-3"
          >
            {hasValidPhoto && (
              <button
                type="button"
                onClick={() => setActiveView("photo")}
                aria-current={effectiveGalleryView === "photo" ? "true" : undefined}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-2xl border p-2 pr-3.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6633EE]",
                  effectiveGalleryView === "photo"
                    ? "border-[#6633EE] bg-violet-50/70 ring-2 ring-[#6633EE]/20"
                    : "border-slate-200 bg-white hover:border-violet-300"
                )}
              >
                <div className="relative h-12 w-10 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  <Image
                    src={garment.image!}
                    alt={`${garment.name} thumbnail`}
                    fill
                    sizes="40px"
                    className="object-cover object-top"
                  />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-950">
                    Product Photo
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {effectiveGalleryView === "photo" ? "Active view" : "View photo"}
                  </p>
                </div>
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveView("swatch")}
              aria-current={effectiveGalleryView === "swatch" ? "true" : undefined}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-2xl border p-2 pr-3.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6633EE]",
                effectiveGalleryView === "swatch"
                  ? "border-[#6633EE] bg-violet-50/70 ring-2 ring-[#6633EE]/20"
                  : "border-slate-200 bg-white hover:border-violet-300"
              )}
            >
              <span
                className="flex h-12 w-10 shrink-0 items-center justify-center rounded-xl border border-black/15 shadow-2xs"
                style={{ backgroundColor: garment.swatchHex || "#E2E8F0" }}
                aria-hidden="true"
              >
                <Palette className="h-4 w-4 text-white drop-shadow" />
              </span>
              <div>
                <p className="text-xs font-bold text-slate-950">
                  {garment.color} Swatch
                </p>
                <p className="text-[11px] text-slate-500">
                  {effectiveGalleryView === "swatch"
                    ? "Active view"
                    : "Inspect fabric & tone"}
                </p>
              </div>
            </button>
          </div>
        </section>

        {/* 2C, 2D, 3, 7, 8, 9. Product Information, Size Selection & Actions */}
        <section className="space-y-6 lg:col-span-6">
          {/* Header & Price */}
          <div className="space-y-2.5 border-b border-slate-100 pb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {garment.category} · {garment.fitType} Fit · {garment.occasion}
            </p>

            <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl break-words">
              {garment.name}
            </h1>

            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <span className="text-2xl font-extrabold text-slate-950 sm:text-3xl">
                ₹{garment.priceInr.toLocaleString("en-IN")}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50/80 px-3 py-1 text-xs font-semibold text-amber-950">
                <Star
                  className="h-3.5 w-3.5 fill-amber-400 text-amber-500"
                  aria-hidden="true"
                />
                {garment.rating}
                <span className="text-amber-800">
                  ({garment.reviewCount.toLocaleString("en-IN")} catalogue reviews)
                </span>
              </span>
            </div>

            {/* 2D. Product Description */}
            <p className="text-sm leading-relaxed text-slate-600">
              {garment.description || "Product description unavailable."}
            </p>
          </div>

          {/* Core Attributes Summary Grid */}
          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200/80 bg-white/95 p-4 text-xs sm:grid-cols-4">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Colour
              </span>
              <p className="mt-1 flex items-center gap-1.5 font-bold text-slate-950">
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-full border border-black/15"
                  style={{ backgroundColor: garment.swatchHex || "#E2E8F0" }}
                  aria-hidden="true"
                />
                <span className="truncate">{garment.color || "Unavailable"}</span>
              </p>
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Fit Cut
              </span>
              <p className="mt-1 font-bold text-slate-950">
                {garment.fitType} Fit
              </p>
            </div>
            <div className="col-span-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Fabric Composition
              </span>
              <p className="mt-1 font-bold text-slate-950 break-words">
                {garment.fabric || "Unavailable"}
              </p>
            </div>
          </div>

          {/* 3. Explicit Size Selection */}
          <div className="space-y-3 rounded-2xl border border-violet-200/80 bg-white/95 p-5 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span
                  id="size-selector-label"
                  className="text-xs font-extrabold uppercase tracking-wider text-slate-900"
                >
                  Select Garment Size <span className="text-red-500">*</span>
                </span>
                <p className="mt-0.5 text-xs text-slate-500">
                  {selectedSize
                    ? `Selected Size: ${selectedSize}`
                    : "Choose an available size before adding to bag"}
                </p>
              </div>
              <a
                href="#garment-measurements"
                className="text-xs font-semibold text-[#6633EE] hover:underline"
              >
                View Garment Size Chart ↓
              </a>
            </div>

            {!hasAvailableSizes ? (
              <div
                role="status"
                className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs font-semibold text-amber-900"
              >
                Sizes are currently unavailable for this garment.
              </div>
            ) : (
              <div
                role="radiogroup"
                aria-labelledby="size-selector-label"
                className="grid grid-cols-2 gap-2.5 sm:grid-cols-4"
              >
                {garment.sizes.map((sz) => {
                  const isSelected = selectedSize === sz;
                  const chestCm = garment.chestMapCm?.[sz];
                  return (
                    <button
                      key={sz}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => handleSelectSize(sz)}
                      className={cn(
                        "cursor-pointer rounded-xl border px-3 py-2.5 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6633EE]",
                        isSelected
                          ? "border-[#6633EE] bg-[#6633EE] text-white shadow-xs"
                          : "border-slate-200 bg-white text-slate-900 hover:border-violet-300 hover:bg-violet-50/40"
                      )}
                    >
                      <span className="block text-sm font-extrabold">{sz}</span>
                      {typeof chestCm === "number" && (
                        <span
                          className={cn(
                            "mt-0.5 block text-[11px]",
                            isSelected ? "text-violet-100" : "text-slate-500"
                          )}
                        >
                          {formatLengthFromCm(chestCm, unit)} {unit} chest
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Selected size measurement preview or prompt */}
            {selectedSize ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-violet-100 bg-violet-50/60 px-3.5 py-2.5 text-xs text-slate-800">
                <span>
                  <strong>Size {selectedSize} Garment Specs:</strong>{" "}
                  {typeof selectedChestCm === "number"
                    ? `Chest ${formatLengthFromCm(selectedChestCm, unit)} ${unit}`
                    : "Chest N/A"}{" "}
                  ·{" "}
                  {typeof selectedWaistCm === "number"
                    ? `Waist ${formatLengthFromCm(selectedWaistCm, unit)} ${unit}`
                    : "Waist N/A"}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedSize(null)}
                  className="cursor-pointer font-semibold text-[#6633EE] hover:underline"
                >
                  Clear size
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                No size selected yet. Click one of the available sizes above to
                enable Add to Bag.
              </p>
            )}

            {sizeError && (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700"
              >
                {sizeError}
              </p>
            )}
          </div>

          {/* 7 & 8. Cart, Wishlist & Compare Actions */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                size="lg"
                disabled={!hasAvailableSizes}
                onClick={handleAddToCart}
                className="flex-1 min-w-[180px]"
              >
                {justAdded ? (
                  <>
                    <Check className="h-4 w-4" aria-hidden="true" />
                    Added Size {selectedSize} to Bag
                  </>
                ) : (
                  <>
                    <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                    {selectedSize
                      ? `Add Size ${selectedSize} to Bag`
                      : "Select a Size to Add"}
                  </>
                )}
              </Button>

              <Button
                type="button"
                size="lg"
                variant={isWished ? "secondary" : "outline"}
                aria-pressed={isWished}
                aria-label={
                  isWished
                    ? `Remove ${garment.name} from wishlist`
                    : `Save ${garment.name} to wishlist`
                }
                onClick={handleToggleCurrentWishlist}
              >
                <Heart
                  className={cn("h-4 w-4", isWished && "fill-current text-[#6633EE]")}
                  aria-hidden="true"
                />
                {isWished ? "Wishlisted" : "Wishlist"}
              </Button>

              <Button
                type="button"
                size="lg"
                variant={isCompared ? "secondary" : "outline"}
                aria-pressed={isCompared}
                onClick={handleToggleCurrentCompare}
              >
                <GitCompare className="h-4 w-4" aria-hidden="true" />
                {isCompared ? "Comparing" : `Compare (${compareIds.length}/3)`}
              </Button>
            </div>

            {/* Secondary Cart / Compare Status Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
              {compareLimitReached ? (
                <span className="text-amber-800">
                  Comparison list is at 3/3 capacity — adding this item replaces
                  the oldest entry.
                </span>
              ) : (
                <span>
                  {isCompared
                    ? "Included in your active garment comparison."
                    : "Compare up to 3 garments side-by-side."}
                </span>
              )}

              <div className="flex flex-wrap items-center gap-3">
                {cartCount > 0 && (
                  <Link
                    href="/cart"
                    className="font-bold text-[#6633EE] hover:underline"
                  >
                    View Shopping Bag ({cartCount}) →
                  </Link>
                )}
                {compareIds.length > 0 && (
                  <Link
                    href="/compare"
                    className="font-semibold text-slate-700 hover:text-[#6633EE] hover:underline"
                  >
                    Open Compare →
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* 9. CUSTOMFIT & Virtual Try-On Entry Points */}
          <div className={cn("grid gap-3", isVtonEligible && "sm:grid-cols-2")}>
            {/* Virtual Try-On Entry Point — shown ONLY for mapped garment categories */}
            {isVtonEligible && (
              <div className="flex flex-col justify-between rounded-2xl border border-violet-200 bg-violet-50/50 p-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#4C1D95]">
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      3D Avatar Try-On &amp; Studio
                    </span>
                    <Badge variant="default" size="sm">
                      Live 3D Engine
                    </Badge>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-600">
                    Drape this {garment.category.toLowerCase()} item on your 3D
                    avatar below and evaluate live engine size recommendations.
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a href="#try-on-my-avatar">
                    <Button size="sm" variant="secondary">
                      Try on my avatar
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </a>
                  <Link href={`/studio?product=${encodeURIComponent(garment.id)}`}>
                    <Button size="sm" variant="ghost">
                      Style Studio
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {/* CUSTOMFIT Entry Point */}
            {isCustomFitEligible ? (
              <div className="flex flex-col justify-between rounded-2xl border border-dashed border-violet-300 bg-white/90 p-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
                      <Scissors
                        className="h-3.5 w-3.5 text-[#6633EE]"
                        aria-hidden="true"
                      />
                      CUSTOMFIT Eligible
                    </span>
                    <Badge variant="outline" size="sm">
                      Optional Tailoring
                    </Badge>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-600">
                    Customization availability is product-specific. If standard
                    sizes S–XL do not align with your proportions, configure
                    made-to-measure tailoring on the CUSTOMFIT page.
                  </p>
                </div>
                <div className="mt-3">
                  <Link
                    href={`/customfit?product=${encodeURIComponent(garment.id)}`}
                  >
                    <Button size="sm" variant="outline" className="w-full">
                      Explore CUSTOMFIT Options →
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
                CUSTOMFIT tailoring is unavailable for this garment because size
                measurement specifications are incomplete.
              </div>
            )}
          </div>
        </section>
      </div>

      {/* 3B. Try on my avatar panel (rendered ONLY for mapped garment categories) */}
      <ProductAvatarTryOnPanel
        category={garment.category}
        productName={garment.name}
        swatchHex={garment.swatchHex}
      />

      {/* 4 & 5. Garment Measurements + Fit & Fabric Intelligence Architecture */}
      <div
        id="garment-measurements"
        className="grid items-start gap-6 lg:grid-cols-12"
      >
        {/* 4. Garment Measurements Table */}
        <section
          aria-labelledby="measurements-heading"
          className="space-y-4 rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-xs lg:col-span-7"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2
                id="measurements-heading"
                className="flex items-center gap-2 text-lg font-extrabold text-slate-950"
              >
                <Ruler className="h-4 w-4 text-[#6633EE]" aria-hidden="true" />
                Garment Measurements ({unit.toUpperCase()})
              </h2>
              <p className="mt-0.5 text-xs text-slate-600">
                Actual physical garment dimensions across available sizes —{" "}
                <strong>not body measurements</strong>.
              </p>
            </div>

            {/* Unit Toggle */}
            <div
              role="group"
              aria-label="Garment measurement unit"
              className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5 text-xs font-bold"
            >
              {(["cm", "in"] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  aria-pressed={unit === u}
                  onClick={() => setUnit(u)}
                  className={cn(
                    "cursor-pointer rounded-lg px-2.5 py-1 uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6633EE]",
                    unit === u
                      ? "bg-[#6633EE] text-white"
                      : "text-slate-600 hover:text-slate-950"
                  )}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          {!specSummary.hasSpecs || !hasAvailableSizes ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-600">
              Size-wise garment measurements are unavailable for this item.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
              <table className="w-full min-w-[340px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/90 text-slate-600">
                    <th className="px-4 py-3 font-bold uppercase tracking-wider">
                      Size
                    </th>
                    <th className="px-4 py-3 font-bold uppercase tracking-wider">
                      Garment Chest ({unit})
                    </th>
                    <th className="px-4 py-3 font-bold uppercase tracking-wider">
                      Garment Waist ({unit})
                    </th>
                    <th className="px-4 py-3 font-bold uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {garment.sizes.map((sz) => {
                    const chestVal = garment.chestMapCm?.[sz];
                    const waistVal = garment.waistMapCm?.[sz];
                    const isSelected = selectedSize === sz;
                    return (
                      <tr
                        key={sz}
                        className={cn(
                          "transition-colors",
                          isSelected ? "bg-violet-50/80" : "hover:bg-slate-50/70"
                        )}
                      >
                        <td className="px-4 py-3 font-extrabold text-slate-950">
                          <span className="inline-flex items-center gap-2">
                            {sz}
                            {isSelected && (
                              <Badge variant="default" size="sm">
                                Selected
                              </Badge>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {typeof chestVal === "number"
                            ? `${formatLengthFromCm(chestVal, unit)} ${unit}`
                            : "Unavailable"}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {typeof waistVal === "number"
                            ? `${formatLengthFromCm(waistVal, unit)} ${unit}`
                            : "Unavailable"}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => handleSelectSize(sz)}
                            className="cursor-pointer rounded font-semibold text-[#6633EE] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6633EE]"
                          >
                            {isSelected ? "Active" : `Select ${sz}`}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-100 bg-violet-50/50 p-4 text-xs text-slate-700">
            <p className="leading-relaxed">
              Need to record or update your own anatomical measurements?
            </p>
            <Link
              href="/body-profile"
              className="inline-flex items-center gap-1 font-bold text-[#6633EE] hover:underline"
            >
              Manage Body Profile
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </section>

        {/* 5. Fit & Fabric Information */}
        <section
          aria-labelledby="fit-fabric-heading"
          className="space-y-4 rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-xs lg:col-span-5"
        >
          <div className="border-b border-slate-100 pb-4">
            <h2
              id="fit-fabric-heading"
              className="flex items-center gap-2 text-lg font-extrabold text-slate-950"
            >
              <Layers className="h-4 w-4 text-[#6633EE]" aria-hidden="true" />
              Fit &amp; Fabric Architecture
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Construction details and how garment dimensions relate to your body.
            </p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5">
              <span className="font-bold uppercase tracking-wider text-slate-500">
                Garment Cut &amp; Ease Summary
              </span>
              <p className="mt-1 text-sm font-bold text-slate-950">
                {garment.fitType} Cut
                {specSummary.chestRangeText
                  ? ` · ${specSummary.chestRangeText}`
                  : ""}
                {specSummary.waistRangeText
                  ? ` · ${specSummary.waistRangeText}`
                  : ""}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5">
              <span className="font-bold uppercase tracking-wider text-slate-500">
                Fabric &amp; Stretch Behavior
              </span>
              <p className="mt-1 text-sm font-bold text-slate-950">
                {garment.fabric || "Fabric composition unavailable"}
              </p>
              <p className="mt-1 leading-relaxed text-slate-600">
                {garment.stretchNote || "No stretch specification listed."}
              </p>
            </div>

            {/* Distinction Between Body vs Garment vs Preferred Fit */}
            <div className="space-y-2 rounded-2xl border border-violet-100 bg-violet-50/40 p-4 text-slate-700">
              <p className="font-extrabold text-slate-950">
                Understanding Fit Calibration
              </p>
              <ul className="space-y-1.5 leading-relaxed">
                <li>
                  <strong>1. Body Measurements:</strong> Your physical chest,
                  waist, and hip circumference stored in your Body Profile.
                </li>
                <li>
                  <strong>2. Garment Measurements:</strong> The actual cloth
                  dimensions shown in the table (larger than body size to allow
                  movement).
                </li>
                <li>
                  <strong>3. Preferred Fit:</strong> The target ease allowance
                  (Slim, Regular, Relaxed, or Oversized) you prefer between body
                  and garment.
                </li>
              </ul>
              <div className="pt-2">
                <Link
                  href={`/fit-check?product=${encodeURIComponent(garment.id)}`}
                >
                  <Button variant="secondary" size="sm" className="w-full">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    Evaluate in Fit Intelligence →
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* 6. Product Trust & Seller Evidence */}
      <section
        aria-labelledby="trust-evidence-heading"
        className="space-y-4 rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-xs"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2
              id="trust-evidence-heading"
              className="flex items-center gap-2 text-lg font-extrabold text-slate-950"
            >
              <ShieldAlert
                className="h-4 w-4 text-[#6633EE]"
                aria-hidden="true"
              />
              Product Trust &amp; Seller Evidence Status
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Transparent disclosure of what is present in the product dataset
              versus unverified attributes.
            </p>
          </div>
          <Badge variant="warning">Verification Metadata Unavailable</Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 text-xs">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
            <span className="font-bold text-slate-900">Verification Status</span>
            <p className="mt-1 leading-relaxed text-slate-600">
              Not verified. No physical inspection certificate exists in the
              current mock record.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
            <span className="font-bold text-slate-900">Product Imagery</span>
            <p className="mt-1 leading-relaxed text-slate-600">
              {hasValidPhoto
                ? "Catalogue studio image present. Not treated as proof of physical garment verification."
                : "No product photo available; displaying colour swatch fallback."}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
            <span className="font-bold text-slate-900">Fabric Details</span>
            <p className="mt-1 leading-relaxed text-slate-600">
              {garment.fabric
                ? `Composition listed (${garment.fabric}); mill certification unavailable.`
                : "Fabric composition unavailable."}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
            <span className="font-bold text-slate-900">
              Garment Measurements
            </span>
            <p className="mt-1 leading-relaxed text-slate-600">
              {specSummary.hasSpecs
                ? `Chest & waist spec map available for ${garment.sizes.join(", ")}.`
                : "Garment measurement map unavailable."}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 sm:col-span-2 lg:col-span-1">
            <span className="font-bold text-slate-900">
              Seller Declarations
            </span>
            <p className="mt-1 leading-relaxed text-slate-600">
              Seller identity and physical QC declarations are unavailable in
              this dataset (scheduled for Phase 6 / P3).
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2 text-[11px] text-slate-500">
          <Info
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#6633EE]"
            aria-hidden="true"
          />
          <p>
            FITLOOM never marks a garment as Verified unless explicit physical
            evidence and seller verification records exist in the data source.
          </p>
        </div>
      </section>

      {/* 10. Related Products */}
      {relatedGarments.length > 0 && (
        <section aria-labelledby="related-products-heading" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-violet-100 pb-3">
            <div>
              <h2
                id="related-products-heading"
                className="text-lg font-extrabold text-slate-950"
              >
                Related Garments
              </h2>
              <p className="text-xs text-slate-600">
                Matched by category ({garment.category}), fit cut ({garment.fitType}
                ), and occasion ({garment.occasion}).
              </p>
            </div>
            <Link
              href="/shop"
              className="text-xs font-semibold text-[#6633EE] hover:underline"
            >
              View Full Catalogue →
            </Link>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {relatedGarments.map((rel) => (
              <ProductCard
                key={rel.id}
                garment={rel}
                isWished={wishlistIds.includes(rel.id)}
                isCompared={compareIds.includes(rel.id)}
                onToggleWishlist={handleRelatedWishlist}
                onToggleCompare={handleRelatedCompare}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
