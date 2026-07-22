// ---- Custom Field ----
export type CustomField = {
  id: string;
  name: string;
  type: "text" | "number" | "date";
  sortOrder: number;
};

// ---- Item ----
export type AiReviewStatus = "idle" | "pending" | "succeeded" | "failed";

export type AiReviewFailureCode =
  | "not_configured"
  | "authorization_required"
  | "timeout"
  | "network"
  | "authentication"
  | "rate_limited"
  | "http_error"
  | "empty_response"
  | "invalid_response";

export type Item = {
  id: string;
  name: string;
  category: { id: string; name: string } | null;
  brand: string | null;
  purchaseDate: string | null;
  purchasePrice: number | null;
  purchasePlatform: string | null;
  storeName: string | null;
  location: string | null;
  quantity: number;
  status: string;
  notes: string | null;
  images: string[];
  customValues: Record<string, string>;
  aiComment: string | null;
  aiCommentAt: string | null;
  aiReviewStatus: AiReviewStatus;
  aiReviewRequestId: string | null;
  aiReviewStartedAt: string | null;
  aiReviewError: AiReviewFailureCode | null;
  createdAt: string;
  updatedAt: string;
};

export type ItemSummary = {
  id: string;
  name: string;
  category: { name: string } | null;
  purchasePrice: number | null;
  status: string;
  purchaseDate: string | null;
  brand: string | null;
  images: string[];
  customValues: Record<string, string>;
};

export type CreateItemInput = {
  name: string;
  categoryId: string | null;
  brand: string | null;
  purchaseDate: string | null;
  purchasePrice: number | null;
  purchasePlatform: string | null;
  storeName: string | null;
  location: string | null;
  quantity: number;
  status: string;
  notes: string | null;
  images: string[];
  customValues: Record<string, string>;
};

export type UpdateItemInput = Partial<CreateItemInput>;

export type SearchFilters = {
  categoryId?: string;
  status?: string;
};

// ---- Category ----
export type Category = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  parentId: string | null;
  sortOrder: number;
  customFields: CustomField[];
  createdAt: string;
  updatedAt: string;
};

export type CreateCategoryInput = {
  name: string;
  icon: string | null;
  color: string | null;
  customFields: Omit<CustomField, "id" | "sortOrder">[];
};

export type UpdateCategoryInput = Partial<CreateCategoryInput>;

// ---- Profile ----
export type Profile = {
  nickname: string;
  avatarUrl: string | null;
};

// ---- Stats ----
export type ItemStats = {
  total: number;
  totalValue: number;
  idle: number;
  /** 超过提醒阈值的闲置物品数 */
  idleOverdue: number;
};
