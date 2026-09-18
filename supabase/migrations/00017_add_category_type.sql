-- 为 categories 表增加 type 字段，区分案例/项目/活动分类
ALTER TABLE categories ADD COLUMN type text NOT NULL DEFAULT 'case';

-- 已有数据全部归为案例分类
UPDATE categories SET type = 'case' WHERE type IS NULL;
