'use client';

interface DiscountBadgeProps {
  discountType?: string | null;
  discountValue?: number | null;
  originalPrice: number;
  discountedPrice?: number | null;
  className?: string;
  position?: 'top-right' | 'top-left' | 'inline';
}

export function DiscountBadge({
  discountType,
  discountValue,
  originalPrice,
  discountedPrice,
  className = '',
  position = 'top-right',
}: DiscountBadgeProps) {
  if (!discountType || !discountValue) {
    return null;
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

  // Calculate final price if not provided
  let finalPrice = discountedPrice || originalPrice;
  if (!discountedPrice && discountType === 'percentage') {
    finalPrice = originalPrice - (originalPrice * discountValue) / 100;
  } else if (!discountedPrice && discountType === 'fixed_amount') {
    finalPrice = originalPrice - discountValue;
  }

  const badgeContent =
    discountType === 'percentage' ? `${discountValue}% Off` : `-₦${discountValue.toFixed(2)}`;

  const positionClasses = {
    'top-right': 'absolute top-2 right-2',
    'top-left': 'absolute top-2 left-2',
    'inline': 'inline-block',
  };

  return (
    <>
      {/* Badge */}
      <div
        className={`${positionClasses[position]} ${className} bg-red-500 text-white px-2 py-1 rounded-md text-xs font-semibold`}
      >
        {badgeContent}
      </div>

      {/* Price Display */}
      {position === 'inline' && (
        <div className="flex flex-col gap-1">
          <span className="text-xs line-through text-gray-500">
            {formatCurrency(originalPrice)}
          </span>
          <span className="text-sm font-bold text-green-600">
            {formatCurrency(finalPrice)}
          </span>
        </div>
      )}
    </>
  );
}

export function DiscountPriceDisplay({
  discountType,
  discountValue,
  originalPrice,
  discountedPrice,
  showStrikethrough = true,
}: DiscountBadgeProps & { showStrikethrough?: boolean }) {
  if (!discountType || !discountValue) {
    return (
      <span className="font-semibold">
        {new Intl.NumberFormat('en-NG', {
          style: 'currency',
          currency: 'NGN',
        }).format(originalPrice)}
      </span>
    );
  }

  // Calculate final price if not provided
  let finalPrice = discountedPrice || originalPrice;
  if (!discountedPrice && discountType === 'percentage') {
    finalPrice = originalPrice - (originalPrice * discountValue) / 100;
  } else if (!discountedPrice && discountType === 'fixed_amount') {
    finalPrice = originalPrice - discountValue;
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

  return (
    <div className="flex flex-col gap-1">
      {showStrikethrough && (
        <span className="text-xs line-through text-gray-500">
          {formatCurrency(originalPrice)}
        </span>
      )}
      <span className="font-semibold text-green-600">{formatCurrency(finalPrice)}</span>
    </div>
  );
}
