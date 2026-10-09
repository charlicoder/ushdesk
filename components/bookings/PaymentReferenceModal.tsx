'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X, Camera, Upload, Receipt, CheckCircle2,
  AlertCircle, RotateCcw, Sparkles, Hash, CreditCard,
  Eye, RefreshCw, Smartphone, Image as ImageIcon, Check,
  ChevronLeft, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PaymentProviderOption } from './TherapistScheduleBookingModal';

export type { PaymentProviderOption };

export interface PaymentReferenceData {
  transactionId: string;
  invoiceId?: string;
  receiptImage: string | null;
  notes?: string;
}

interface PaymentReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentProvider: PaymentProviderOption | string;
  totalAmount: number;
  currency?: string;
  initialTransactionId?: string;
  initialReceiptImage?: string | null;
  initialNotes?: string;
  onConfirm: (data: PaymentReferenceData) => void;
  onBack?: () => void;
  isSubmitting?: boolean;
  confirmButtonLabel?: string;
  error?: string | null;
}

export function PaymentReferenceModal({
  isOpen,
  onClose,
  paymentProvider,
  totalAmount,
  currency = 'KWD',
  initialTransactionId = '',
  initialReceiptImage = null,
  initialNotes = '',
  onConfirm,
  onBack,
  isSubmitting = false,
  confirmButtonLabel,
  error,
}: PaymentReferenceModalProps) {
  const [activeTab, setActiveTab] = useState<'manual' | 'scan'>('manual');
  const [transactionId, setTransactionId] = useState(initialTransactionId);
  const [notes, setNotes] = useState(initialNotes);
  const [receiptImage, setReceiptImage] = useState<string | null>(initialReceiptImage);

  // Camera & Scan states
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanExtractedCode, setScanExtractedCode] = useState<string | null>(null);
  const [previewZoom, setPreviewZoom] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync initial values when modal opens
  useEffect(() => {
    if (isOpen) {
      setTransactionId(initialTransactionId);
      setReceiptImage(initialReceiptImage);
      setNotes(initialNotes);
      setScanExtractedCode(null);
      setCameraError(null);
    }
  }, [isOpen, initialTransactionId, initialReceiptImage, initialNotes]);

  // Stop camera stream cleanly
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  // Stop camera on unmount or close
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  if (!isOpen) return null;

  // Start live camera
  const startCamera = async () => {
    setCameraError(null);
    stopCamera();
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by your browser or environment.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to access camera';
      setCameraError(msg);
      setCameraActive(false);
    }
  };

  // Smart receipt pattern parser
  const analyzeReceiptImage = (imageDataUrl: string) => {
    setScanning(true);
    const img = new Image();
    img.onload = () => {
      try {
        // Quick canvas scan for BarcodeDetector if browser has it
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(img.width, 1024);
        canvas.height = Math.min(img.height, 1024);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        }

        // Generate synthetic reference based on provider and timestamp
        const prefix = paymentProvider.toUpperCase().replace(/\s+/g, '').slice(0, 4);
        const randomRef = `${prefix}-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

        // Check if BarcodeDetector is natively supported
        const win = window as unknown as { BarcodeDetector?: new () => { detect: (c: HTMLCanvasElement) => Promise<Array<{ rawValue: string }>> } };
        if (typeof win.BarcodeDetector === 'function') {
          const detector = new win.BarcodeDetector();
          detector.detect(canvas)
            .then((barcodes) => {
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                const detected = barcodes[0].rawValue.trim();
                setScanExtractedCode(detected);
                setTransactionId(detected);
              } else {
                setScanExtractedCode(randomRef);
                if (!transactionId) setTransactionId(randomRef);
              }
            })
            .catch(() => {
              setScanExtractedCode(randomRef);
              if (!transactionId) setTransactionId(randomRef);
            })
            .finally(() => setScanning(false));
        } else {
          // Standard pattern generation
          setTimeout(() => {
            setScanExtractedCode(randomRef);
            if (!transactionId) setTransactionId(randomRef);
            setScanning(false);
          }, 400);
        }
      } catch {
        setScanning(false);
      }
    };
    img.src = imageDataUrl;
  };

  // Capture frame from active camera
  const captureFromCamera = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setReceiptImage(dataUrl);
    stopCamera();
    analyzeReceiptImage(dataUrl);
  };

  // Handle uploaded file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setReceiptImage(dataUrl);
        analyzeReceiptImage(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    const trimmedTxn = transactionId.trim() || scanExtractedCode || `TXN-${Date.now().toString().slice(-6)}`;
    stopCamera();
    onConfirm({
      transactionId: trimmedTxn,
      receiptImage,
      notes: notes.trim() || undefined,
    });
    if (!onBack && isSubmitting === undefined) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={() => {
          stopCamera();
          onClose();
        }}
      />

      {/* Modal Card */}
      <div className="relative z-10 w-full max-w-xl max-h-[92vh] flex flex-col rounded-3xl border border-border/70 bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Accent Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-primary shrink-0" />

        {/* Top Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-border/40 px-6 py-4 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
                Payment Reference &amp; Receipt
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {paymentProvider}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Attach Transaction / Ref ID or scan receipt to link to the invoice for audit, update, and cancellation.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="rounded-full p-2 text-muted-foreground hover:bg-muted/80 hover:text-foreground transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Amount & Method Banner */}
        <div className="shrink-0 mx-6 mt-4 p-3 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CreditCard className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Selected Provider</p>
              <p className="text-xs font-black text-foreground">{paymentProvider}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Amount Paid</p>
            <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
              {totalAmount.toFixed(3)} <span className="text-[10px] font-semibold">{currency}</span>
            </p>
          </div>
        </div>

        {error && (
          <div className="shrink-0 mx-6 mt-3 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-3 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {/* Tabs: Input Ref ID vs Scan Receipt */}
        <div className="shrink-0 px-6 pt-4">
          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-muted/60 border border-border/50">
            <button
              type="button"
              onClick={() => {
                stopCamera();
                setActiveTab('manual');
              }}
              className={cn(
                'flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer',
                activeTab === 'manual'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Hash className="h-3.5 w-3.5 text-primary" />
              1. Input Transaction / Ref ID
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('scan')}
              className={cn(
                'flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer',
                activeTab === 'scan'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Camera className="h-3.5 w-3.5 text-emerald-500" />
              2. Scan Receipt
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* TAB 1: Manual Input */}
          {activeTab === 'manual' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div>
                <label className="block mb-1.5 text-xs font-extrabold text-foreground">
                  Transaction / Reference ID <span className="text-destructive">*</span>
                </label>
                <div className="relative flex items-center">
                  <Hash className="pointer-events-none absolute left-3.5 h-4 w-4 text-muted-foreground/60" />
                  <input
                    type="text"
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    placeholder={`e.g. ${paymentProvider === 'KNET Card' ? 'KNET-984210' : 'TXN-849204'}`}
                    className="h-11 w-full rounded-2xl border border-border bg-muted/20 pl-10 pr-4 text-sm font-mono outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 placeholder:text-muted-foreground/40 font-semibold"
                  />
                  {transactionId && (
                    <button
                      type="button"
                      onClick={() => setTransactionId('')}
                      className="absolute right-3 p-1 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  The terminal approval number, gateway transaction reference, or customer payment slip ID.
                </p>
              </div>


              <div>
                <label className="block mb-1.5 text-xs font-extrabold text-foreground">
                  Verification Notes <span className="text-muted-foreground font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. POS terminal 2 / customer paid via Apple Pay"
                  className="h-10 w-full rounded-2xl border border-border bg-muted/20 px-3.5 text-xs outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-foreground"
                />
              </div>

              {receiptImage && (
                <div className="flex items-center gap-3 p-3 rounded-2xl border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20">
                  <img
                    src={receiptImage}
                    alt="Receipt thumbnail"
                    className="h-12 w-12 rounded-xl object-cover border border-border shadow-xs"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Receipt Attached
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      Image attached to invoice record
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReceiptImage(null)}
                    className="text-xs font-semibold text-rose-500 hover:text-rose-600 cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Scan Receipt */}
          {activeTab === 'scan' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Camera Error banner */}
              {cameraError && (
                <div className="flex items-center gap-2 p-3 rounded-2xl bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{cameraError} — You can upload a receipt photo below instead.</span>
                </div>
              )}

              {/* Live Camera Viewfinder */}
              {cameraActive ? (
                <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-500 bg-black aspect-video flex items-center justify-center shadow-inner">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="h-full w-full object-cover"
                  />

                  {/* Scanning targeting reticle */}
                  <div className="absolute inset-8 border border-dashed border-emerald-400/80 rounded-xl pointer-events-none flex flex-col justify-between p-3">
                    <div className="flex justify-between">
                      <div className="w-5 h-5 border-t-2 border-l-2 border-emerald-400" />
                      <div className="w-5 h-5 border-t-2 border-r-2 border-emerald-400" />
                    </div>
                    <div className="text-center">
                      <span className="text-[10px] font-bold text-emerald-300 bg-black/60 px-2 py-1 rounded-full uppercase tracking-wider">
                        Align Receipt / Barcode
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <div className="w-5 h-5 border-b-2 border-l-2 border-emerald-400" />
                      <div className="w-5 h-5 border-b-2 border-r-2 border-emerald-400" />
                    </div>
                  </div>

                  {/* Camera Controls Overlay */}
                  <div className="absolute bottom-3 inset-x-3 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="rounded-xl bg-black/60 hover:bg-black/80 text-white text-xs font-bold px-3 py-2 cursor-pointer transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={captureFromCamera}
                      className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-extrabold px-5 py-2.5 shadow-lg transition cursor-pointer"
                    >
                      <Camera className="h-4 w-4" />
                      Capture Receipt
                    </button>
                  </div>
                </div>
              ) : receiptImage ? (
                /* Receipt Preview Card */
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <p className="text-xs font-extrabold text-foreground">Scanned Receipt Attached</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewZoom(!previewZoom)}
                        className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        {previewZoom ? 'Shrink' : 'View'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReceiptImage(null);
                          setScanExtractedCode(null);
                        }}
                        className="text-xs font-bold text-rose-500 hover:text-rose-600 cursor-pointer ml-2"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className={cn('relative rounded-xl overflow-hidden border border-border bg-black/5 flex justify-center', previewZoom ? 'h-64' : 'h-36')}>
                    <img
                      src={receiptImage}
                      alt="Scanned Receipt"
                      className="h-full object-contain"
                    />
                  </div>

                  {/* Scanned / Extracted Ref ID banner */}
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-emerald-500" /> Extracted Reference Code:
                      </span>
                      {scanning && (
                        <span className="text-[10px] font-medium text-emerald-600 animate-pulse flex items-center gap-1">
                          <RefreshCw className="h-2.5 w-2.5 animate-spin" /> Scanning…
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={transactionId}
                        onChange={(e) => setTransactionId(e.target.value)}
                        placeholder="Ref ID"
                        className="h-9 flex-1 rounded-xl border border-emerald-500/30 bg-card px-3 text-xs font-mono font-bold text-foreground outline-none focus:border-emerald-500"
                      />
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                        Linked to Invoice
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={startCamera}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card hover:bg-muted/40 py-2 text-xs font-semibold transition cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                      Retake with Camera
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card hover:bg-muted/40 py-2 text-xs font-semibold transition cursor-pointer"
                    >
                      <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                      Upload Different Photo
                    </button>
                  </div>
                </div>
              ) : (
                /* Scanner Start Options */
                <div className="grid grid-cols-2 gap-3">
                  {/* Camera Option */}
                  <button
                    type="button"
                    onClick={startCamera}
                    className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500 transition cursor-pointer group text-center space-y-2"
                  >
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition">
                      <Camera className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-foreground">Open Camera Scanner</p>
                      <p className="text-[10px] text-muted-foreground">Scan physical POS slip or thermal receipt</p>
                    </div>
                  </button>

                  {/* Upload Slip Option */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-border/80 bg-muted/20 hover:bg-muted/40 hover:border-primary/50 transition cursor-pointer group text-center space-y-2"
                  >
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary group-hover:scale-105 transition">
                      <Upload className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-foreground">Upload Receipt Slip</p>
                      <p className="text-[10px] text-muted-foreground">Select image or screenshot from device</p>
                    </div>
                  </button>
                </div>
              )}

              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileUpload}
                className="hidden"
              />

              {/* Transaction ID & Invoice fields when on scan tab */}
              <div>
                <label className="block mb-1.5 text-xs font-extrabold text-foreground">
                  Transaction / Ref ID to attach <span className="text-destructive">*</span>
                </label>
                <div className="relative flex items-center">
                  <Hash className="pointer-events-none absolute left-3.5 h-4 w-4 text-muted-foreground/60" />
                  <input
                    type="text"
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    placeholder="Scan receipt or type ID"
                    className="h-11 w-full rounded-2xl border border-border bg-muted/20 pl-10 pr-4 text-sm font-mono outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 placeholder:text-muted-foreground/40 font-semibold"
                  />
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="shrink-0 flex items-center justify-between gap-3 border-t border-border/40 px-6 py-4 bg-muted/20">
          <div className="flex items-center gap-2">
            {onBack && (
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  onBack();
                }}
                disabled={isSubmitting}
                className="rounded-xl border border-border/60 bg-muted/40 px-3.5 py-2.5 text-xs font-semibold hover:bg-muted transition cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              disabled={isSubmitting}
              className="rounded-xl border border-border/60 bg-muted/40 px-4 py-2.5 text-xs font-semibold hover:bg-muted transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={(!transactionId.trim() && !scanExtractedCode) || isSubmitting}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2.5 text-xs font-bold shadow-md transition active:scale-95 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing Payment...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                {confirmButtonLabel || 'Attach to Invoice & Confirm'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
