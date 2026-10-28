// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchProjects: vi.fn(),
  saveProject: vi.fn(),
  deleteProjects: vi.fn(),
  bulkUpdateProjects: vi.fn(),
  fetchProjectFilterOptions: vi.fn(),
  isShowOnHomeReady: vi.fn(),
  isProjectGalleryReady: vi.fn(),
  fetchProjectContent: vi.fn(),
  toggleProjectPinned: vi.fn(),
  navigate: vi.fn(),
  profile: { role: 'admin' },
  t: (zh: string) => zh,
}));

vi.mock('@/lib/api', () => ({
  fetchProjects: mocks.fetchProjects,
  saveProject: mocks.saveProject,
  deleteProjects: mocks.deleteProjects,
  bulkUpdateProjects: mocks.bulkUpdateProjects,
  deleteProject: vi.fn(),
  ACCESS_LABELS: {
    free: { zh: '免费', en: 'Free' },
    member: { zh: '会员', en: 'Member' },
    pro: { zh: '专业', en: 'Pro' },
    private: { zh: '私有', en: 'Private' },
  },
  fetchProjectFilterOptions: mocks.fetchProjectFilterOptions,
  isShowOnHomeReady: mocks.isShowOnHomeReady,
  isProjectGalleryReady: mocks.isProjectGalleryReady,
  fetchProjectContent: mocks.fetchProjectContent,
  toggleProjectPinned: mocks.toggleProjectPinned,
}));

vi.mock('@/contexts/I18nContext', () => ({ useI18n: () => ({ t: mocks.t, lang: 'zh' }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ profile: mocks.profile }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/lib/documentImport', () => ({ importMarkdown: vi.fn(), importDocx: vi.fn(), importPdf: vi.fn() }));
vi.mock('@/lib/useLocalDraft', () => ({ useLocalDraft: () => ({ clearDraft: vi.fn() }) }));
vi.mock('@/components/editor/ImmersiveEditor', async () => {
  const React = await import('react');
  return { default: React.forwardRef(() => React.createElement('div')) };
});
vi.mock('@/components/common/FileUploadField', () => ({ default: () => <div /> }));
vi.mock('@/components/admin/NumberField', () => ({ default: () => <div /> }));
vi.mock('@/components/admin/PreviewChapterPicker', () => ({ default: () => <div /> }));

import AdminProjects from './AdminProjects';

afterEach(cleanup);

describe('AdminProjects save', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchProjects.mockResolvedValue([]);
    mocks.saveProject.mockResolvedValue(undefined);
    mocks.fetchProjectFilterOptions.mockResolvedValue([]);
    mocks.isShowOnHomeReady.mockResolvedValue(true);
    mocks.isProjectGalleryReady.mockResolvedValue(true);
  });

  it('sends only one create request when Save is clicked repeatedly while pending', async () => {
    let finishSave!: () => void;
    mocks.saveProject.mockImplementation(() => new Promise<void>((resolve) => { finishSave = resolve; }));
    render(<AdminProjects />);

    fireEvent.click(await screen.findByRole('button', { name: '新建项目' }));
    await screen.findByRole('dialog');
    const titleInput = document.querySelector('[role="dialog"] input');
    if (!titleInput) throw new Error('Project title input was not rendered');
    fireEvent.change(titleInput, { target: { value: '重复项目测试' } });

    const saveButton = screen.getByRole('button', { name: '保存' });
    fireEvent.click(saveButton);
    fireEvent.click(saveButton);

    expect(mocks.saveProject).toHaveBeenCalledTimes(1);
    expect(mocks.saveProject).toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.any(String) }),
      { idempotentCreate: true },
    );
    finishSave();
    await waitFor(() => expect(screen.queryByRole('button', { name: '保存' })).toBeNull());
  });

  it('deletes only the selected projects after explicit confirmation', async () => {
    mocks.fetchProjects.mockResolvedValue([
      { id: 'p1', title: '重复项目一', scene: 'AI', access_level: 'free', likes: 0, favorites: 0, views: 0 },
      { id: 'p2', title: '重复项目二', scene: 'AI', access_level: 'free', likes: 0, favorites: 0, views: 0 },
    ]);
    mocks.deleteProjects.mockResolvedValue(undefined);
    render(<AdminProjects />);

    fireEvent.click(await screen.findByRole('checkbox', { name: '选择项目 重复项目一' }));
    fireEvent.click(screen.getByRole('button', { name: '批量删除' }));
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }));

    await waitFor(() => expect(mocks.deleteProjects).toHaveBeenCalledWith(['p1']));
    await waitFor(() => expect(screen.queryByText('重复项目一')).toBeNull());
    expect(screen.getByText('重复项目二')).toBeTruthy();
  });

  it('rechecks gallery readiness after the database probe reports unavailable', async () => {
    mocks.isProjectGalleryReady
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    render(<AdminProjects />);

    fireEvent.click(await screen.findByRole('button', { name: '新建项目' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '添加图片' })).toHaveProperty('disabled', true));
    fireEvent.click(screen.getByRole('button', { name: '重新检查' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '添加图片' })).toHaveProperty('disabled', false));
  });
});
