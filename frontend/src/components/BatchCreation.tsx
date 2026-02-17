import { useEffect, useState } from "react";
import type { ViewMode } from "../types";
import { getInventory, createBatch, addProduct, type Product } from "../api/farmer";

interface BatchCreationProps {
  onNavigate?: (view: ViewMode) => void;
}

const BatchCreation = ({ onNavigate }: BatchCreationProps) => {
  const [mode, setMode] = useState<'select' | 'create'>('create');
  const [inventory, setInventory] = useState<Product[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

  // Form state for new product
  const [newProduct, setNewProduct] = useState({
    name: "",
    quantity: "",
    unit: "kg",
    pricePerUnit: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [totalPrice, setTotalPrice] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    loadInventory();
  }, []);

  // Update total price when new product form changes
  useEffect(() => {
    if (mode === 'create') {
      const qty = Number(newProduct.quantity) || 0;
      const price = Number(newProduct.pricePerUnit) || 0;
      setTotalPrice(qty * price);
    } else {
      // Recalculate based on selection if switching back
      calculateTotals(selectedProductIds);
    }
  }, [newProduct, mode]);

  const loadInventory = async () => {
    try {
      const result = await getInventory();
      // @ts-ignore
      setInventory(result || []);
    } catch (err) {
      console.error("Failed to load inventory for batch", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (product: Product) => {
    const newSelection = new Set(selectedProductIds);
    if (newSelection.has(product._id)) {
      newSelection.delete(product._id);
    } else {
      newSelection.add(product._id);
    }
    setSelectedProductIds(newSelection);
    calculateTotals(newSelection);
  };

  const calculateTotals = (selection: Set<string>) => {
    const selectedItems = inventory.filter(p => selection.has(p._id));
    const total = selectedItems.reduce((sum, item) => {
      const price = item.pricePerUnit || 500;
      return sum + (item.quantity * price);
    }, 0);
    setTotalPrice(total);
  };

  const handleCreateBatch = async () => {
    setSubmitting(true);
    try {
      let batchProducts = [];
      let batchTotalWeight = 0;

      if (mode === 'create') {
        if (!newProduct.name || !newProduct.quantity) {
          alert("Please fill in crop name and quantity");
          setSubmitting(false);
          return;
        }

        // 1. Create the product in Inventory first
        const addedProduct = await addProduct({
          name: newProduct.name,
          quantity: Number(newProduct.quantity),
          unit: newProduct.unit,
          pricePerUnit: Number(newProduct.pricePerUnit),
          // If no file, backend might set default or we can send a placeholder string if we want
          // But here let's rely on the file if present
          imageFile: imageFile || undefined,
          // Fallback image if no file upload (optional, but good for UI consistency if backend requires one)
          image: !imageFile ? "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=400&q=80" : undefined
        });

        // @ts-ignore
        const productId = addedProduct._id || addedProduct.data?._id || addedProduct.id;

        batchProducts = [{
          product: productId,
          quantity: Number(newProduct.quantity)
        }];
        batchTotalWeight = Number(newProduct.quantity);

      } else {
        // Use selected items
        const selectedItems = inventory.filter(p => selectedProductIds.has(p._id));
        if (selectedItems.length === 0) return;

        batchProducts = selectedItems.map(item => ({
          product: item._id,
          quantity: item.quantity
        }));
        batchTotalWeight = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
      }

      // 2. Create the Batch
      await createBatch({
        products: batchProducts,
        totalWeight: batchTotalWeight,
        totalPrice,
        status: 'active'
      });

      onNavigate?.("dashboard");
    } catch (err) {
      console.error("Failed to create batch", err);
      // @ts-ignore
      alert(`Failed to create batch: ${err.message || "Unknown error"}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="w-full max-w-[520px] flex flex-col gap-6 animate-[rise_0.6s_ease_both] pb-8">
      <header className="flex items-center justify-between">
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-full border border-[var(--stroke)] bg-[var(--surface-2)]"
          onClick={() => onNavigate?.("dashboard")}
          aria-label="Go back"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <p className="m-0 text-base font-semibold">Batch Creation</p>
        <span className="text-xs font-semibold text-[var(--accent)]">Draft</span>
      </header>

      <div>
        <h1 className="m-0 text-2xl font-semibold">Finalize your sale batch</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Fill in your produce details or select from existing inventory.
        </p>
      </div>

      {/* Toggle Mode */}
      <div className="flex p-1 bg-[var(--surface-2)] rounded-[14px]">
        <button
          onClick={() => setMode('create')}
          className={`flex-1 py-2 text-xs font-semibold rounded-[10px] transition-all ${mode === 'create' ? 'bg-[var(--surface)] shadow-sm text-[var(--text)]' : 'text-[var(--muted)]'}`}
        >
          New Crop Entry
        </button>
        <button
          onClick={() => setMode('select')}
          className={`flex-1 py-2 text-xs font-semibold rounded-[10px] transition-all ${mode === 'select' ? 'bg-[var(--surface)] shadow-sm text-[var(--text)]' : 'text-[var(--muted)]'}`}
        >
          Select from Inventory
        </button>
      </div>

      {mode === 'create' ? (
        <div className="flex flex-col gap-4 rounded-[22px] border border-[var(--stroke)] bg-[var(--surface)] p-5">
          <h3 className="m-0 text-sm font-semibold text-[var(--muted)]">Crop Details</h3>


          {/* Image Upload Section */}
          <div className="flex flex-col items-center justify-center gap-3">
            <div
              className="relative h-32 w-full rounded-[16px] border-2 border-dashed border-[var(--stroke)] bg-[var(--bg)] grid place-items-center cursor-pointer overflow-hidden hover:border-[var(--accent)] transition-colors"
              onClick={() => document.getElementById('crop-image-upload')?.click()}
            >
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-[var(--muted)]">
                  <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  <span className="text-xs font-semibold">Tap to upload crop image</span>
                </div>
              )}
              <input
                type="file"
                id="crop-image-upload"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">Crop Name</label>
            <input
              type="text"
              className="w-full rounded-[12px] border border-[var(--stroke)] bg-[var(--bg)] px-4 py-3 text-sm focus:border-[var(--accent)] focus:outline-none"
              placeholder="e.g. Maize, Potatoes"
              value={newProduct.name}
              onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">Quantity</label>
              <input
                type="number"
                className="w-full rounded-[12px] border border-[var(--stroke)] bg-[var(--bg)] px-4 py-3 text-sm focus:border-[var(--accent)] focus:outline-none"
                placeholder="0"
                value={newProduct.quantity}
                onChange={(e) => setNewProduct({ ...newProduct, quantity: e.target.value })}
              />
            </div>
            <div className="w-24">
              <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">Unit</label>
              <select
                className="w-full rounded-[12px] border border-[var(--stroke)] bg-[var(--bg)] px-3 py-3 text-sm focus:border-[var(--accent)] focus:outline-none"
                value={newProduct.unit}
                onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })}
              >
                <option value="kg">kg</option>
                <option value="tons">tons</option>
                <option value="pcs">pcs</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">Price per Unit (RWF)</label>
            <input
              type="number"
              className="w-full rounded-[12px] border border-[var(--stroke)] bg-[var(--bg)] px-4 py-3 text-sm focus:border-[var(--accent)] focus:outline-none"
              placeholder="e.g. 500"
              value={newProduct.pricePerUnit}
              onChange={(e) => setNewProduct({ ...newProduct, pricePerUnit: e.target.value })}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h3 className="m-0 text-base font-semibold">Select Items</h3>
            <span className="text-xs font-semibold text-[var(--accent)]">{selectedProductIds.size} Selected</span>
          </div>

          {loading ? (
            <p className="text-sm text-[var(--muted)]">Loading inventory...</p>
          ) : inventory.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Inventory is empty. Switch to "New Crop Entry" to add items.</p>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {inventory.map((item) => {
                const isSelected = selectedProductIds.has(item._id);
                return (
                  <div
                    key={item._id}
                    onClick={() => toggleSelection(item)}
                    className={`min-w-[220px] cursor-pointer rounded-[22px] border ${isSelected ? 'border-[var(--accent)] bg-[var(--accent-soft)]/10' : 'border-[var(--stroke)] bg-[var(--surface)]'} p-4 shadow-[0_12px_28px_rgba(0,0,0,0.18)] transition-all`}
                  >
                    <div className="relative">
                      <img src={item.image || "https://placehold.co/100"} alt="" className="h-28 w-full rounded-[16px] object-cover" loading="lazy" />
                      {isSelected && (
                        <span className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-[var(--accent)] text-[#0b1307]">
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M5 12l4 4 10-10" />
                          </svg>
                        </span>
                      )}
                    </div>
                    <div className="mt-4">
                      <p className="m-0 text-sm font-semibold">{item.name}</p>
                      <p className="mt-2 text-xs text-[var(--muted)]">{item.quantity} {item.unit}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <div>
        <h3 className="m-0 text-base font-semibold">Set Batch Price</h3>
      </div>
      <div className="rounded-[22px] border border-[var(--stroke)] bg-[var(--surface)] p-5 shadow-[0_12px_28px_rgba(0,0,0,0.18)]">
        <p className="m-0 text-xs font-semibold text-[var(--muted)]">Total Price (RWF)</p>
        <div className="mt-2 flex items-baseline justify-between">
          <input
            type="number"
            className="text-3xl font-bold bg-transparent border-none focus:outline-none w-full"
            value={totalPrice}
            onChange={(e) => setTotalPrice(Number(e.target.value))}
          />
          <span className="text-sm font-semibold text-[var(--accent)]">RWF</span>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--stroke)] pt-4">
          <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <svg className="h-4 w-4 text-[var(--accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M3 12l6-6 4 4 7-7" />
              <path d="M21 10v5h-5" />
            </svg>
            Est. Market Value: {totalPrice.toLocaleString()} RWF
          </div>
          <button type="button" className="rounded-full bg-[var(--accent-soft)] px-4 py-2 text-xs font-semibold text-[var(--accent)]">
            Apply Suggestion
          </button>
        </div>
      </div>

      <div>
        <h3 className="m-0 text-base font-semibold">Destination Hub</h3>
      </div>
      <button
        type="button"
        className="flex items-center justify-between rounded-[20px] border border-[var(--stroke)] bg-[var(--surface)] px-4 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-[var(--surface-2)] text-[var(--accent)]">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7z" />
              <path d="M9 9h6" />
            </svg>
          </span>
          <div>
            <p className="m-0 text-sm font-semibold">Kigali Central Aggregator</p>
            <p className="m-0 text-xs text-[var(--muted)]">Kigali, Rwanda · 12km away</p>
          </div>
        </div>
        <svg className="h-4 w-4 text-[var(--muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <div className="rounded-[22px] border border-[var(--stroke)] bg-[var(--surface)] p-5">
        <div className="grid gap-3 text-sm">
          <div className="flex items-center justify-between text-[var(--muted)]">
            <span>Total Items</span>
            <span className="text-[var(--text)]">{mode === 'create' ? '1' : selectedProductIds.size} Crops</span>
          </div>
          <div className="flex items-center justify-between text-[var(--muted)]">
            <span>Total Weight</span>
            <span className="text-[var(--text)]">{mode === 'create' ? (newProduct.quantity || 0) : Array.from(selectedProductIds).reduce((sum, id) => sum + (inventory.find(p => p._id === id)?.quantity || 0), 0)} kg</span>
          </div>
          <div className="flex items-center justify-between text-[var(--accent)]">
            <span>Total Value</span>
            <span className="font-semibold">{totalPrice.toLocaleString()} RWF</span>
          </div>
        </div>
      </div>

      <button
        onClick={handleCreateBatch}
        disabled={submitting || (mode === 'select' && selectedProductIds.size === 0)}
        className="w-full rounded-[18px] bg-[var(--accent)] px-4 py-4 text-base font-semibold text-[#0b1307] shadow-[0_16px_28px_rgba(73,197,26,0.3)] disabled:opacity-50 disabled:shadow-none"
      >
        {submitting ? "Creating..." : "Create & Publish Batch"}
      </button>
    </section>
  );
};

export default BatchCreation;
