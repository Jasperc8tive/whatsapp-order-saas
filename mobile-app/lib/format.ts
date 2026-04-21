export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount ?? 0);
};

export const formatDateTime = (isoDate: string): string => {
  return new Date(isoDate).toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};
