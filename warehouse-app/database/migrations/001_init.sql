-- 001_init.sql — MVP 数据库初始化
-- 在 Supabase SQL Editor 中执行此文件

-- 1. 启用 trigram 扩展（模糊搜索）
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. 用户档案表
CREATE TABLE public.profiles (
  id         UUID REFERENCES auth.users(id) PRIMARY KEY,
  nickname   TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 分类表（支持二级分类）
CREATE TABLE public.categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  icon       TEXT,
  color      TEXT,
  parent_id  UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_categories_user   ON public.categories(user_id);
CREATE INDEX idx_categories_parent ON public.categories(parent_id);

-- 4. 物品表
CREATE TABLE public.items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  category_id      UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  brand            TEXT,
  purchase_date    DATE,
  purchase_price   DECIMAL(12,2),
  purchase_platform TEXT,
  store_name       TEXT,
  location         TEXT,
  quantity         INTEGER DEFAULT 1 CHECK (quantity > 0),
  status           TEXT DEFAULT '使用中' CHECK (status IN ('使用中','闲置中','已损坏','已出售','已送人','收藏中')),
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_items_user       ON public.items(user_id);
CREATE INDEX idx_items_category   ON public.items(category_id);
CREATE INDEX idx_items_status     ON public.items(status);
CREATE INDEX idx_items_platform   ON public.items(purchase_platform);
CREATE INDEX idx_items_name_trgm  ON public.items USING GIN (name gin_trgm_ops);
CREATE INDEX idx_items_brand_trgm ON public.items USING GIN (brand gin_trgm_ops);

-- 5. 自动创建 profile 触发器
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Row Level Security
ALTER TABLE public.profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own profile"
  ON public.profiles FOR ALL
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can manage own categories"
  ON public.categories FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can manage own items"
  ON public.items FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
